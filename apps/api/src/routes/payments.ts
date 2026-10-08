import crypto from "node:crypto";
import { Router, urlencoded } from "express";
import type { Prisma, PrismaClient, User } from "@prisma/client";
import {
  cashPaymentSchema,
  formatPeriod,
  formatRwf,
  payChargeSchema,
  verifyPaymentSchema,
  type Payment as PaymentDto,
  type RentCharge as ChargeDto,
} from "@kalndlord/shared";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { sendError, zodFields } from "../lib/http";
import { notifyUser } from "../lib/notify-user";
import { isOverdue } from "../lib/billing";
import type { PaymentGateway, SandboxOutcome, VerifyResult } from "../lib/gateway";
import { requireAuth } from "../middleware/auth";

const chargeInclude = {
  lease: {
    include: {
      property: { select: { id: true, title: true } },
      tenant: true,
      landlord: true,
    },
  },
  payments: { where: { status: "SUCCESSFUL" }, orderBy: { paidAt: "asc" } },
} satisfies Prisma.RentChargeInclude;
type ChargeRow = Prisma.RentChargeGetPayload<{ include: typeof chargeInclude }>;

const paymentInclude = {
  charge: { include: { lease: { include: { property: { select: { id: true, title: true } }, landlord: true } } } },
  tenant: true,
  recordedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PaymentInclude;
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

const summary = (p: { id: string; amount: number; method: PaymentDto["method"]; status: PaymentDto["status"]; receiptNo: string | null; paidAt: Date | null }) => ({
  id: p.id,
  amount: p.amount,
  method: p.method,
  status: p.status,
  receiptNo: p.receiptNo,
  paidAt: p.paidAt?.toISOString() ?? null,
});

function toCharge(c: ChargeRow): ChargeDto {
  return {
    id: c.id,
    period: c.period,
    amount: c.amount,
    dueDate: c.dueDate.toISOString(),
    status: c.status,
    overdue: isOverdue(c),
    paidAt: c.paidAt?.toISOString() ?? null,
    lease: {
      id: c.lease.id,
      property: c.lease.property,
      tenant: { id: c.lease.tenant.id, fullName: c.lease.tenant.fullName },
    },
    payment: c.payments[0] ? summary(c.payments[0]) : null,
  };
}

function toPayment(p: PaymentRow): PaymentDto {
  return {
    ...summary(p),
    txRef: p.txRef,
    provider: p.provider,
    createdAt: p.createdAt.toISOString(),
    period: p.charge.period,
    property: p.charge.lease.property,
    tenant: { id: p.tenant.id, fullName: p.tenant.fullName, phone: p.tenant.phone, email: p.tenant.email },
    landlord: { id: p.charge.lease.landlord.id, fullName: p.charge.lease.landlord.fullName },
    recordedBy: p.recordedBy,
  };
}

// Who may see a lease's money: its tenant, its landlord, or the administrator.
const leaseScope = (user: User): Prisma.LeaseWhereInput =>
  user.role === "ADMIN" ? {} : user.role === "LANDLORD" ? { landlordId: user.id } : { tenantId: user.id };

const newTxRef = () => `KL-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`.toUpperCase();
const receiptNo = (paidAt: Date) =>
  `R${paidAt.getUTCFullYear()}${String(paidAt.getUTCMonth() + 1).padStart(2, "0")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

export function paymentsRouter(
  prisma: PrismaClient,
  notifier: Notifier,
  gateway: PaymentGateway,
  config: Config,
) {
  const router = Router();
  const auth = (roles?: Parameters<typeof requireAuth>[2]) => requireAuth(prisma, config.jwtSecret, roles);

  // Applies a provider's answer to a pending payment exactly once.
  async function settle(paymentId: string, result: VerifyResult) {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.status !== "PENDING" || result.status === "pending") return;

    const ok = result.status === "successful" && result.currency === "RWF" && (result.amount ?? 0) >= payment.amount;
    const paidAt = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: ok
          ? { status: "SUCCESSFUL", paidAt, method: result.method ?? "OTHER", providerRef: result.providerRef, receiptNo: receiptNo(paidAt) }
          : { status: "FAILED", providerRef: result.providerRef },
      });
      if (!claimed.count) return false;
      if (ok) await tx.rentCharge.updateMany({ where: { id: payment.chargeId, status: "DUE" }, data: { status: "PAID", paidAt } });
      return true;
    });
    if (!updated) return;
    if (!ok && result.status === "successful") {
      console.error(`Payment ${payment.txRef} reported successful but amount or currency did not match`, result);
    }
    if (ok) await announcePaid(payment.id);
  }

  async function announcePaid(paymentId: string) {
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, include: paymentInclude });
    const what = `${formatPeriod(p.charge.period)} rent for "${p.charge.lease.property.title}"`;
    await notifyUser(notifier, p.tenant, "Payment received",
      `We received ${formatRwf(p.amount)} for your ${what}. Receipt ${p.receiptNo}.`);
    await notifyUser(notifier, p.charge.lease.landlord, "Rent paid",
      `${p.tenant.fullName} paid ${formatRwf(p.amount)}: ${what}. Receipt ${p.receiptNo}.`);
  }

  router.get("/charges", auth(), async (req, res) => {
    const items = await prisma.rentCharge.findMany({
      where: { lease: leaseScope(req.user!) },
      include: chargeInclude,
      orderBy: [{ dueDate: "desc" }],
      take: 200,
    });
    res.json({ items: items.map(toCharge) });
  });

  // The tenant starts paying a bill; they are sent to the provider's page.
  router.post("/charges/:id/pay", auth(["TENANT"]), async (req, res) => {
    const parsed = payChargeSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Missing return address", zodFields(parsed.error));
    const { redirectUrl } = parsed.data;
    if (!config.payments.allowedRedirects.some((prefix) => redirectUrl.startsWith(prefix))) {
      return sendError(res, 400, "That return address is not allowed");
    }
    const charge = await prisma.rentCharge.findUnique({ where: { id: String(req.params.id) }, include: chargeInclude });
    if (!charge || charge.lease.tenantId !== req.user!.id) return sendError(res, 404, "Bill not found");
    if (charge.status === "PAID") return sendError(res, 409, "This bill is already paid");

    const user = req.user!;
    const payment = await prisma.payment.create({
      data: { chargeId: charge.id, tenantId: user.id, amount: charge.amount, provider: gateway.name, txRef: newTxRef() },
    });
    const sep = redirectUrl.includes("?") ? "&" : "?";
    try {
      const { url } = await gateway.createCheckout({
        txRef: payment.txRef,
        amount: charge.amount,
        title: `${formatPeriod(charge.period)} rent, ${charge.lease.property.title}`,
        redirectUrl: `${redirectUrl}${sep}ref=${encodeURIComponent(payment.txRef)}`,
        // Flutterwave requires an email; phone-only tenants get a placeholder.
        customer: { name: user.fullName, email: user.email ?? `tenant-${user.id}@kalndlord.rw`, phone: user.phone },
      });
      res.status(201).json({ txRef: payment.txRef, checkoutUrl: url });
    } catch (err) {
      console.error(err);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      sendError(res, 502, "The payment service is not responding. Please try again in a moment");
    }
  });

  // Called when the tenant comes back from the payment page.
  router.post("/payments/verify", auth(), async (req, res) => {
    const parsed = verifyPaymentSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Missing payment reference");
    const payment = await prisma.payment.findUnique({ where: { txRef: parsed.data.txRef } });
    if (!payment || (payment.tenantId !== req.user!.id && req.user!.role !== "ADMIN")) {
      return sendError(res, 404, "Payment not found");
    }
    if (payment.status === "PENDING" && payment.provider === gateway.name) {
      await settle(payment.id, await gateway.verify(payment.txRef));
    }
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: paymentInclude });
    res.json({ payment: toPayment(fresh) });
  });

  // Provider webhook: the reliable path when the tenant closes the page early.
  router.post("/payments/webhook", async (req, res) => {
    const txRef = gateway.webhookTxRef(req.headers, req.body);
    if (!txRef) return res.status(401).end();
    const payment = await prisma.payment.findUnique({ where: { txRef } });
    // The webhook body is never trusted on its own: the result is re-checked with the provider.
    if (payment?.status === "PENDING") await settle(payment.id, await gateway.verify(txRef));
    res.status(200).end();
  });

  // A landlord (or the administrator) records rent paid in cash.
  router.post("/charges/:id/cash", auth(["LANDLORD", "ADMIN"]), async (req, res) => {
    const parsed = cashPaymentSchema.safeParse(req.body ?? {});
    if (!parsed.success) return sendError(res, 400, "Check the note");
    const charge = await prisma.rentCharge.findUnique({ where: { id: String(req.params.id) }, include: chargeInclude });
    const user = req.user!;
    if (!charge || (user.role !== "ADMIN" && charge.lease.landlordId !== user.id)) return sendError(res, 404, "Bill not found");
    if (charge.status === "PAID") return sendError(res, 409, "This bill is already paid");

    const paidAt = new Date();
    const payment = await prisma.$transaction(async (tx) => {
      const claimed = await tx.rentCharge.updateMany({ where: { id: charge.id, status: "DUE" }, data: { status: "PAID", paidAt } });
      if (!claimed.count) return null;
      return tx.payment.create({
        data: {
          chargeId: charge.id,
          tenantId: charge.lease.tenantId,
          amount: charge.amount,
          method: "CASH",
          provider: "manual",
          providerRef: parsed.data.note,
          txRef: newTxRef(),
          status: "SUCCESSFUL",
          receiptNo: receiptNo(paidAt),
          recordedById: user.id,
          paidAt,
        },
      });
    });
    if (!payment) return sendError(res, 409, "This bill is already paid");
    await notifyUser(notifier, charge.lease.tenant, "Payment recorded",
      `${user.fullName} recorded your ${formatPeriod(charge.period)} rent of ${formatRwf(charge.amount)} as paid in cash. Receipt ${payment.receiptNo}.`);
    const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: paymentInclude });
    res.status(201).json({ payment: toPayment(fresh) });
  });

  // Payment history: tenants see their own, landlords their tenants', admin all.
  router.get("/payments", auth(), async (req, res) => {
    const items = await prisma.payment.findMany({
      where: { status: "SUCCESSFUL", charge: { lease: leaseScope(req.user!) } },
      include: paymentInclude,
      orderBy: { paidAt: "desc" },
      take: 200,
    });
    res.json({ items: items.map(toPayment) });
  });

  router.get("/payments/:id", auth(), async (req, res) => {
    const p = await prisma.payment.findFirst({
      where: { id: String(req.params.id), status: "SUCCESSFUL", charge: { lease: leaseScope(req.user!) } },
      include: paymentInclude,
    });
    if (!p) return sendError(res, 404, "Receipt not found");
    res.json({ payment: toPayment(p) });
  });

  // Stand-in payment page for the sandbox provider.
  if ("complete" in gateway) {
    const sandbox = gateway as PaymentGateway & { complete(txRef: string, o: SandboxOutcome): void };
    router.get("/payments/sandbox/:txRef", async (req, res) => {
      const payment = await prisma.payment.findUnique({ where: { txRef: String(req.params.txRef) } });
      if (!payment) return res.status(404).send("Unknown payment");
      const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
      const redirect = String(req.query.redirect ?? "");
      // Browsers apply form-action to the redirect after submitting, so the
      // return addresses (web app and app links) must be listed here.
      const returnTargets = config.payments.allowedRedirects.map((p) =>
        /^https?:/.test(p) ? new URL(p).origin : `${p.split(":")[0]}:`,
      );
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${returnTargets.join(" ")}`,
      );
      res.type("html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test payment</title><style>body{font-family:system-ui;max-width:420px;margin:40px auto;padding:0 16px}
button{display:block;width:100%;margin:8px 0;padding:12px;font-size:16px;border-radius:8px;border:1px solid #0f766e;background:#0f766e;color:#fff}
button.fail{background:#fff;color:#b42318;border-color:#b42318}.note{background:#fff7e6;border:1px solid #f59e0b;padding:10px;border-radius:8px}</style></head>
<body><p class="note">Test mode: no money moves. This page stands in for Flutterwave.</p>
<h2>Pay ${esc(formatRwf(payment.amount))}</h2><p>${esc(String(req.query.title ?? ""))}</p>
<form method="post" action="/payments/sandbox/${esc(payment.txRef)}/complete">
<input type="hidden" name="redirect" value="${esc(redirect)}">
<button name="outcome" value="MTN">Pay with MTN MoMo</button>
<button name="outcome" value="AIRTEL">Pay with Airtel Money</button>
<button name="outcome" value="CARD">Pay with card</button>
<button name="outcome" value="FAIL" class="fail">Simulate a failed payment</button>
</form></body></html>`);
    });
    router.post("/payments/sandbox/:txRef/complete", urlencoded({ extended: false }), async (req, res) => {
      const payment = await prisma.payment.findUnique({ where: { txRef: String(req.params.txRef) } });
      const outcome = String(req.body?.outcome) as SandboxOutcome;
      const redirect = String(req.body?.redirect ?? "");
      if (!payment || !["MTN", "AIRTEL", "CARD", "FAIL"].includes(outcome)) return res.status(400).send("Bad request");
      if (!config.payments.allowedRedirects.some((p) => redirect.startsWith(p))) return res.status(400).send("Bad return address");
      sandbox.complete(payment.txRef, outcome);
      res.redirect(303, redirect);
    });
  }

  return router;
}
