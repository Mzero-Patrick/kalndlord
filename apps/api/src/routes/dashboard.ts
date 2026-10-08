import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Config } from "../config";
import { requireAuth } from "../middleware/auth";
import { toPublicUser } from "../lib/users";

// Role-gated dashboard data. Listings, payments and maintenance figures are
// added to these summaries in the later steps.
export function dashboardRouter(prisma: PrismaClient, config: Config) {
  const router = Router();

  router.get("/admin", requireAuth(prisma, config.jwtSecret, ["ADMIN"]), async (_req, res) => {
    const counts = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
    const recent = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    res.json({
      users: Object.fromEntries(counts.map((c) => [c.role, c._count._all])),
      recentUsers: recent.map(toPublicUser),
    });
  });

  router.get("/landlord", requireAuth(prisma, config.jwtSecret, ["LANDLORD", "ADMIN"]), (req, res) => {
    res.json({ user: toPublicUser(req.user!), listings: 0, tenants: 0, openRequests: 0 });
  });

  router.get("/tenant", requireAuth(prisma, config.jwtSecret, ["TENANT"]), (req, res) => {
    res.json({ user: toPublicUser(req.user!), leases: 0, nextPayment: null, openRequests: 0 });
  });

  return router;
}
