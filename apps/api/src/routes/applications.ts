import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { sendError } from "../lib/http";
import { notifyUser } from "../lib/notify-user";
import { contactSelect, toApplication, toLease } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";
import { canManage } from "./listings";

const appInclude = {
  property: { select: { id: true, title: true, monthlyRent: true, landlordId: true, terms: true, status: true } },
  tenant: { select: contactSelect },
} as const;

const leaseInclude = {
  property: { select: { id: true, title: true, district: true, sector: true } },
  tenant: { select: { id: true, fullName: true } },
  landlord: { select: contactSelect },
} as const;

class Conflict extends Error {}

export function applicationsRouter(prisma: PrismaClient, notifier: Notifier, config: Config) {
  const router = Router();
  const auth = requireAuth(prisma, config.jwtSecret);

  // Tenants see their own, landlords see those on their listings, admin sees all.
  router.get("/applications", auth, async (req, res) => {
    const user = req.user!;
    const where: Prisma.ApplicationWhereInput =
      user.role === "ADMIN" ? {} : user.role === "LANDLORD" ? { property: { landlordId: user.id } } : { tenantId: user.id };
    if (typeof req.query.propertyId === "string") where.propertyId = req.query.propertyId;
    const items = await prisma.application.findMany({ where, include: appInclude, orderBy: { createdAt: "desc" } });
    res.json({ items: items.map(toApplication) });
  });

  router.post("/applications/:id/accept", auth, async (req, res) => {
    const app = await prisma.application.findUnique({ where: { id: String(req.params.id) }, include: appInclude });
    if (!app || !canManage(req.user, app.property)) return sendError(res, 404, "Application not found");
    if (app.status !== "PENDING") return sendError(res, 409, "This application was already answered");
    if (app.property.status === "OCCUPIED") return sendError(res, 409, "This place already has a tenant");

    const others = await prisma.application.findMany({
      where: { propertyId: app.property.id, status: "PENDING", id: { not: app.id } },
      include: { tenant: true },
    });
    const now = new Date();
    // Conditional updates inside one transaction, so two people accepting at
    // the same moment can't create two leases for one place.
    const lease = await prisma
      .$transaction(async (tx) => {
        // Lock the property row first so concurrent accepts queue up behind it
        // instead of deadlocking on each other's application rows.
        const taken = await tx.property.updateMany({
          where: { id: app.property.id, status: { not: "OCCUPIED" } },
          data: { status: "OCCUPIED" },
        });
        const claimed = await tx.application.updateMany({
          where: { id: app.id, status: "PENDING" },
          data: { status: "ACCEPTED", decidedAt: now },
        });
        if (!claimed.count || !taken.count) throw new Conflict();
        await tx.application.updateMany({
          where: { id: { in: others.map((o) => o.id) }, status: "PENDING" },
          data: { status: "REJECTED", decidedAt: now },
        });
        return tx.lease.create({
          data: {
            propertyId: app.property.id,
            tenantId: app.tenant.id,
            landlordId: app.property.landlordId,
            applicationId: app.id,
            monthlyRent: app.property.monthlyRent,
            terms: app.acceptedTerms,
            startDate: app.moveInDate ?? now,
          },
          include: leaseInclude,
        });
      })
      .catch((err) => {
        if (err instanceof Conflict) return null;
        throw err;
      });
    if (!lease) return sendError(res, 409, "This application or place was already answered");

    await notifyUser(notifier, app.tenant, "Application accepted",
      `Your application for "${app.property.title}" was accepted. Open Kalndlord to see your rental.`);
    for (const o of others) {
      await notifyUser(notifier, o.tenant, "Application update",
        `"${app.property.title}" has been taken by another tenant. Keep browsing for other places.`);
    }
    res.json({ lease: toLease(lease) });
  });

  router.post("/applications/:id/reject", auth, async (req, res) => {
    const app = await prisma.application.findUnique({ where: { id: String(req.params.id) }, include: appInclude });
    if (!app || !canManage(req.user, app.property)) return sendError(res, 404, "Application not found");
    if (app.status !== "PENDING") return sendError(res, 409, "This application was already answered");
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: { status: "REJECTED", decidedAt: new Date() },
      include: appInclude,
    });
    await notifyUser(notifier, app.tenant, "Application update",
      `Your application for "${app.property.title}" was not accepted. Keep browsing for other places.`);
    res.json({ application: toApplication(updated) });
  });

  router.post("/applications/:id/withdraw", auth, async (req, res) => {
    const app = await prisma.application.findUnique({ where: { id: String(req.params.id) } });
    if (!app || app.tenantId !== req.user!.id) return sendError(res, 404, "Application not found");
    if (app.status !== "PENDING") return sendError(res, 409, "Only a pending application can be withdrawn");
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: { status: "WITHDRAWN", decidedAt: new Date() },
      include: appInclude,
    });
    res.json({ application: toApplication(updated) });
  });

  router.get("/leases", auth, async (req, res) => {
    const user = req.user!;
    const where: Prisma.LeaseWhereInput =
      user.role === "ADMIN" ? {} : user.role === "LANDLORD" ? { landlordId: user.id } : { tenantId: user.id };
    const items = await prisma.lease.findMany({ where, include: leaseInclude, orderBy: { createdAt: "desc" } });
    res.json({ items: items.map(toLease) });
  });

  return router;
}
