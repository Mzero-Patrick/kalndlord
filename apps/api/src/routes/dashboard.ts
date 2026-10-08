import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import type { Config } from "../config";
import { requireAuth } from "../middleware/auth";
import { toPublicUser } from "../lib/users";

const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

// Rent collected this month and rent still owed, optionally for one landlord.
async function rentFigures(prisma: PrismaClient, landlordId?: string) {
  const lease = landlordId ? { landlordId } : {};
  const [collected, owed] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "SUCCESSFUL", paidAt: { gte: monthStart() }, charge: { lease } },
    }),
    prisma.rentCharge.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: "DUE", dueDate: { lte: new Date() }, lease },
    }),
  ]);
  return {
    collectedThisMonth: collected._sum.amount ?? 0,
    owed: owed._sum.amount ?? 0,
    unpaidBills: owed._count._all,
  };
}

// Role-gated dashboard summaries.
const open = { status: { not: "DONE" } } as const;
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
    const openRequests = await prisma.issue.count({ where: open });
    res.json({
      users: Object.fromEntries(counts.map((c) => [c.role, c._count._all])),
      recentUsers: recent.map(toPublicUser),
      listings,
      pendingApplications,
      activeLeases,
      unansweredQuestions,
      landlords,
      openRequests,
      ...(await rentFigures(prisma)),
    });
  });

  router.get("/landlord", requireAuth(prisma, config.jwtSecret, ["LANDLORD", "ADMIN"]), async (req, res) => {
    const id = req.user!.id;
    const [listings, tenants, pendingApplications, unansweredQuestions, openRequests] = await Promise.all([
      prisma.property.count({ where: { landlordId: id } }),
      prisma.lease.count({ where: { landlordId: id, status: "ACTIVE" } }),
      prisma.application.count({ where: { status: "PENDING", property: { landlordId: id } } }),
      prisma.inquiry.count({ where: { reply: null, property: { landlordId: id } } }),
      prisma.issue.count({ where: { ...open, landlordId: id } }),
    ]);
    res.json({
      user: toPublicUser(req.user!),
      listings,
      tenants,
      pendingApplications,
      unansweredQuestions,
      openRequests,
      ...(await rentFigures(prisma, id)),
    });
  });

  router.get("/tenant", requireAuth(prisma, config.jwtSecret, ["TENANT"]), async (req, res) => {
    const id = req.user!.id;
    const [leases, pendingApplications, next, openRequests] = await Promise.all([
      prisma.lease.count({ where: { tenantId: id, status: "ACTIVE" } }),
      prisma.application.count({ where: { tenantId: id, status: "PENDING" } }),
      prisma.rentCharge.findFirst({ where: { status: "DUE", lease: { tenantId: id } }, orderBy: { dueDate: "asc" } }),
      prisma.issue.count({ where: { ...open, tenantId: id } }),
    ]);
    res.json({
      user: toPublicUser(req.user!),
      leases,
      pendingApplications,
      nextPayment: next ? { amount: next.amount, dueDate: next.dueDate.toISOString(), chargeId: next.id } : null,
      openRequests,
    });
  });

  return router;
}
