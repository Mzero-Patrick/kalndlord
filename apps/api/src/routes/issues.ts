import { Router } from "express";
import multer from "multer";
import type { Prisma, PrismaClient, User } from "@prisma/client";
import {
  ISSUE_KIND_LABEL,
  ISSUE_STATUS_LABEL,
  MAX_ISSUE_PHOTOS,
  issueSchema,
  issueUpdateSchema,
  type Issue,
} from "@kalndlord/shared";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { sendError, zodFields } from "../lib/http";
import { notifyUser } from "../lib/notify-user";
import { imageExtension, type Storage } from "../lib/storage";
import { requireAuth } from "../middleware/auth";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: MAX_ISSUE_PHOTOS } });

const include = {
  property: { select: { id: true, title: true } },
  tenant: { select: { id: true, fullName: true, phone: true, email: true } },
  landlord: { select: { id: true, fullName: true, phone: true, email: true } },
  photos: { orderBy: { createdAt: "asc" } },
  updates: { include: { author: { select: { id: true, fullName: true, role: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.IssueInclude;
type IssueRow = Prisma.IssueGetPayload<{ include: typeof include }>;

function toIssue(i: IssueRow, storage: Storage): Issue {
  return {
    id: i.id,
    kind: i.kind,
    urgent: i.urgent,
    subject: i.subject,
    message: i.message,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    property: i.property,
    tenant: i.tenant,
    landlord: { id: i.landlord.id, fullName: i.landlord.fullName },
    photos: i.photos.map((p) => ({ id: p.id, url: storage.url(p.key) })),
    updates: i.updates.map((u) => ({
      id: u.id,
      message: u.message,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      author: u.author,
    })),
  };
}

const visibleTo = (user: User): Prisma.IssueWhereInput =>
  user.role === "ADMIN" ? {} : user.role === "LANDLORD" ? { landlordId: user.id } : { tenantId: user.id };

// Reports from tenants to their landlord: repairs (with photos) and any other
// issue about the rental or business. The landlord, or the administrator,
// moves each one to "being fixed" and "done"; both sides are messaged.
export function issuesRouter(prisma: PrismaClient, notifier: Notifier, storage: Storage, config: Config) {
  const router = Router();
  const auth = (roles?: User["role"][]) => requireAuth(prisma, config.jwtSecret, roles);

  router.post("/", auth(["TENANT"]), upload.array("photos", MAX_ISSUE_PHOTOS), async (req, res) => {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const { leaseId, ...data } = parsed.data;
    const tenant = req.user!;

    const leases = await prisma.lease.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE", ...(leaseId ? { id: leaseId } : {}) },
      include: { landlord: true },
      orderBy: { createdAt: "desc" },
    });
    if (!leases.length) return sendError(res, 400, "You can report issues once you rent a place here");
    if (!leaseId && leases.length > 1)
      return sendError(res, 400, "Choose which place this is about", { leaseId: "Choose a place" });
    const lease = leases[0]!;

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const exts = files.map((f) => imageExtension(f.buffer));
    if (exts.some((e) => !e)) return sendError(res, 400, "Photos must be JPG, PNG or WebP images");
    const keys: string[] = [];
    for (const [i, file] of files.entries()) keys.push(await storage.save(file.buffer, exts[i]!));

    const issue = await prisma.issue.create({
      data: {
        ...data,
        leaseId: lease.id,
        propertyId: lease.propertyId,
        tenantId: tenant.id,
        landlordId: lease.landlordId,
        photos: { create: keys.map((key) => ({ key })) },
      },
      include,
    });
    const tag = issue.urgent ? "URGENT " : "";
    await notifyUser(
      notifier,
      lease.landlord,
      `${tag}${ISSUE_KIND_LABEL[issue.kind]}: ${issue.subject}`,
      `${tag}${ISSUE_KIND_LABEL[issue.kind].toLowerCase()} from ${tenant.fullName} at ${issue.property.title}: ${issue.subject}. See your dashboard.`,
    );
    res.status(201).json({ issue: toIssue(issue, storage) });
  });

  router.get("/", auth(), async (req, res) => {
    const items = await prisma.issue.findMany({
      where: visibleTo(req.user!),
      include,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ items: items.map((i) => toIssue(i, storage)) });
  });

  router.get("/:id", auth(), async (req, res) => {
    const issue = await prisma.issue.findFirst({ where: { id: String(req.params.id), ...visibleTo(req.user!) }, include });
    if (!issue) return sendError(res, 404, "Report not found");
    res.json({ issue: toIssue(issue, storage) });
  });

  // A message and/or a status change. The landlord or administrator can set
  // any status; the tenant can only reopen a report marked done.
  router.post("/:id/updates", auth(), async (req, res) => {
    const parsed = issueUpdateSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const user = req.user!;
    const issue = await prisma.issue.findFirst({ where: { id: String(req.params.id), ...visibleTo(user) }, include });
    if (!issue) return sendError(res, 404, "Report not found");

    const { message } = parsed.data;
    const status = parsed.data.status === issue.status ? undefined : parsed.data.status;
    if (status && user.role === "TENANT" && !(status === "OPEN" && issue.status === "DONE"))
      return sendError(res, 403, "Only the landlord can change this report's status");
    if (!status && !message) return sendError(res, 400, "Write a message", { message: "Write a message" });

    const [, updated] = await prisma.$transaction([
      prisma.issueUpdate.create({ data: { issueId: issue.id, authorId: user.id, message, status } }),
      prisma.issue.update({
        where: { id: issue.id },
        data: status ? { status, resolvedAt: status === "DONE" ? new Date() : null } : { updatedAt: new Date() },
        include,
      }),
    ]);

    // Tell the other side: the tenant hears from the landlord (or admin), and
    // the landlord hears from the tenant.
    const to = user.id === issue.tenantId ? issue.landlord : issue.tenant;
    const what = status ? `marked "${ISSUE_STATUS_LABEL[status].toLowerCase()}"` : "has a new message";
    await notifyUser(
      notifier,
      to,
      `Report update: ${issue.subject}`,
      `Report "${issue.subject}" at ${issue.property.title} ${what}${message ? `: ${message}` : ""} (${user.fullName})`,
    );
    res.status(201).json({ issue: toIssue(updated, storage) });
  });

  return router;
}
