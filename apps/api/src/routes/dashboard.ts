import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Config } from "../config";
import { requireAuth } from "../middleware/auth";
import { toPublicUser } from "../lib/users";

// Role-gated dashboard summaries. Payments and maintenance figures are added in
// the later steps.
export function dashboardRouter(prisma: PrismaClient, config: Config) {
  const router = Router();

  router.get("/admin", requireAuth(prisma, config.jwtSecret, ["ADMIN"]), async (_req, res) => {
    const [counts, recent, listings, pendingApplications, activeLeases, unansweredQuestions, landlords] =
      await Promise.all([
        prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
        prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
        prisma.property.count(),
        prisma.application.count({ where: { status: "PENDING" } }),
        prisma.lease.count({ where: { status: "ACTIVE" } }),
        prisma.inquiry.count({ where: { reply: null } }),
        prisma.user.findMany({ where: { role: "LANDLORD" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
      ]);
    res.json({
      users: Object.fromEntries(counts.map((c) => [c.role, c._count._all])),
      recentUsers: recent.map(toPublicUser),
      listings,
      pendingApplications,
      activeLeases,
      unansweredQuestions,
      landlords,
    });
  });

  router.get("/landlord", requireAuth(prisma, config.jwtSecret, ["LANDLORD", "ADMIN"]), async (req, res) => {
    const id = req.user!.id;
    const [listings, tenants, pendingApplications, unansweredQuestions] = await Promise.all([
      prisma.property.count({ where: { landlordId: id } }),
      prisma.lease.count({ where: { landlordId: id, status: "ACTIVE" } }),
      prisma.application.count({ where: { status: "PENDING", property: { landlordId: id } } }),
      prisma.inquiry.count({ where: { reply: null, property: { landlordId: id } } }),
    ]);
    res.json({ user: toPublicUser(req.user!), listings, tenants, pendingApplications, unansweredQuestions, openRequests: 0 });
  });

  router.get("/tenant", requireAuth(prisma, config.jwtSecret, ["TENANT"]), async (req, res) => {
    const id = req.user!.id;
    const [leases, pendingApplications] = await Promise.all([
      prisma.lease.count({ where: { tenantId: id, status: "ACTIVE" } }),
      prisma.application.count({ where: { tenantId: id, status: "PENDING" } }),
    ]);
    res.json({ user: toPublicUser(req.user!), leases, pendingApplications, nextPayment: null, openRequests: 0 });
  });

  return router;
}
