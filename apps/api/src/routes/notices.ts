import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { noticeSchema, type Notice } from "@kalndlord/shared";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { sendError, zodFields } from "../lib/http";
import { notifyUser } from "../lib/notify-user";
import { requireAuth } from "../middleware/auth";

const include = {
  sender: { select: { id: true, fullName: true, role: true } },
  recipient: { select: { id: true, fullName: true } },
} as const;

// Notices from a landlord to their tenants (or from the administrator to any
// tenant). Each one is texted or emailed and kept in the tenant's dashboard.
export function noticesRouter(prisma: PrismaClient, notifier: Notifier, config: Config) {
  const router = Router();

  router.post("/", requireAuth(prisma, config.jwtSecret, ["LANDLORD", "ADMIN"]), async (req, res) => {
    const parsed = noticeSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const { to, subject, message } = parsed.data;
    const sender = req.user!;

    // A landlord can reach tenants with an active lease on one of their places.
    const tenants =
      sender.role === "ADMIN"
        ? await prisma.user.findMany({ where: { role: "TENANT", ...(to === "ALL" ? {} : { id: to }) } })
        : await prisma.user.findMany({
            where: {
              role: "TENANT",
              tenantLeases: { some: { landlordId: sender.id, status: "ACTIVE" } },
              ...(to === "ALL" ? {} : { id: to }),
            },
          });
    if (!tenants.length) return sendError(res, 400, "No tenant to send this to", { to: "Choose one of your tenants" });

    await prisma.notice.createMany({
      data: tenants.map((t) => ({ senderId: sender.id, recipientId: t.id, subject, message })),
    });
    for (const t of tenants) await notifyUser(notifier, t, subject, `${subject}: ${message} (from ${sender.fullName})`);
    res.status(201).json({ sent: tenants.length });
  });

  // Tenants see notices sent to them; senders see what they sent.
  router.get("/", requireAuth(prisma, config.jwtSecret), async (req, res) => {
    const user = req.user!;
    const items = await prisma.notice.findMany({
      where: user.role === "TENANT" ? { recipientId: user.id } : user.role === "ADMIN" ? {} : { senderId: user.id },
      include,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const body: Notice[] = items.map((n) => ({
      id: n.id,
      subject: n.subject,
      message: n.message,
      createdAt: n.createdAt.toISOString(),
      sender: n.sender,
      recipient: n.recipient,
    }));
    res.json({ items: body });
  });

  return router;
}
