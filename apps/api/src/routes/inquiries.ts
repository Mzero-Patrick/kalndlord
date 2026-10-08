import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { inquirySchema, replySchema } from "@kalndlord/shared";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { sendError, zodFields } from "../lib/http";
import { notifyUser } from "../lib/notify-user";
import { contactSelect, toInquiry } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import { canManage } from "./listings";

const include = {
  property: { select: { id: true, title: true, landlordId: true } },
  from: { select: contactSelect },
} as const;

// The contact section. A question about a listing goes to its landlord (and is
// visible to the administrator); a general question goes to the administrator.
export function inquiriesRouter(prisma: PrismaClient, notifier: Notifier, config: Config) {
  const router = Router();
  const auth = requireAuth(prisma, config.jwtSecret);

  router.post("/", auth, async (req, res) => {
    const parsed = inquirySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const { propertyId, subject, message } = parsed.data;

    const property = propertyId
      ? await prisma.property.findUnique({ where: { id: propertyId }, include: { landlord: true } })
      : null;
    if (propertyId && !property) return sendError(res, 404, "This listing doesn't exist");

    const inquiry = await prisma.inquiry.create({
      data: { fromId: req.user!.id, propertyId: property?.id, subject, message },
      include,
    });
    const recipients = property
      ? [property.landlord]
      : await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const r of recipients) {
      await notifyUser(notifier, r, "New question",
        `${req.user!.fullName} asked: "${subject}". Open your dashboard to reply.`);
    }
    res.status(201).json({ inquiry: toInquiry(inquiry) });
  });

  router.get("/", auth, async (req, res) => {
    const user = req.user!;
    const where: Prisma.InquiryWhereInput =
      user.role === "ADMIN"
        ? {}
        : user.role === "LANDLORD"
          ? { OR: [{ property: { landlordId: user.id } }, { fromId: user.id }] }
          : { fromId: user.id };
    const items = await prisma.inquiry.findMany({ where, include, orderBy: { createdAt: "desc" } });
    res.json({
      items: items.map((i) => ({
        ...toInquiry(i),
        canReply: !i.reply && i.fromId !== user.id && (user.role === "ADMIN" || (!!i.property && canManage(user, i.property))),
      })),
    });
  });

  router.post("/:id/reply", auth, async (req, res) => {
    const inquiry = await prisma.inquiry.findUnique({ where: { id: String(req.params.id) }, include });
    const user = req.user!;
    const allowed = inquiry && (user.role === "ADMIN" || (inquiry.property && canManage(user, inquiry.property)));
    if (!inquiry || !allowed) return sendError(res, 404, "Question not found");
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Write a reply", zodFields(parsed.error));

    const updated = await prisma.inquiry.update({
      where: { id: inquiry.id },
      data: { reply: parsed.data.reply, repliedAt: new Date() },
      include,
    });
    await notifyUser(notifier, inquiry.from, "Reply to your question",
      `You have a reply to "${inquiry.subject}". Open Kalndlord to read it.`);
    res.json({ inquiry: toInquiry(updated) });
  });

  return router;
}
