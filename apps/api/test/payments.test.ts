import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { paymentsOff, type PaymentGateway, type VerifyResult } from "../src/lib/gateway";
import { makeUser, rentedPlace, resetDb, setup } from "./helpers";

// A provider whose answers each test controls.
let answer: VerifyResult = { status: "pending" };
const fake: PaymentGateway = {
  name: "fake",
  createCheckout: async (req) => ({ url: `https://pay.example/${req.txRef}?back=${encodeURIComponent(req.redirectUrl)}` }),
  verify: async () => answer,
  webhookTxRef: (headers, body) =>
    headers["verif-hash"] === "secret" ? ((body as { data: { tx_ref: string } }).data.tx_ref ?? null) : null,
};

const { prisma, notifier, app } = setup(fake);
const sandboxed = setup();
const off = setup(paymentsOff);

beforeEach(async () => {
  await resetDb(prisma);
  notifier.sent = [];
  answer = { status: "pending" };
});
afterAll(async () => {
  await prisma.$disconnect();
  await sandboxed.prisma.$disconnect();
  await off.prisma.$disconnect();
});

const RETURN = "http://localhost:3000/payments/result";

function startPayment(auth: Record<string, string>, chargeId: string) {
  return request(app).post(`/charges/${chargeId}/pay`).set(auth).send({ redirectUrl: RETURN });
}

describe("paying rent", () => {
  it("refuses online payment while it is switched off, and cash can still be recorded", async () => {
    const { tenant, landlord, leaseId } = await rentedPlace(off.app, off.prisma);
    const charge = await off.prisma.rentCharge.findFirstOrThrow({ where: { leaseId } });
    const res = await request(off.app)
      .post(`/charges/${charge.id}/pay`)
      .set(tenant.auth)
      .send({ redirectUrl: "http://localhost:3000/payments/result" })
      .expect(503);
    expect(res.body.error).toMatch(/isn't switched on/);
    expect(await off.prisma.payment.count()).toBe(0);
    await request(off.app).post(`/charges/${charge.id}/cash`).set(landlord.auth).send({}).expect(201);
  });

  it("records a MoMo payment against the tenant's account and issues a receipt", async () => {
    const { tenant, landlord, leaseId } = await rentedPlace(app, prisma, 200000);
    const bills = await request(app).get("/charges").set(tenant.auth).expect(200);
    expect(bills.body.items).toHaveLength(1);
    const bill = bills.body.items[0];
    expect(bill).toMatchObject({ amount: 200000, status: "DUE", lease: { id: leaseId } });

    const started = await startPayment(tenant.auth, bill.id).expect(201);
    expect(started.body.checkoutUrl).toContain("pay.example");
    expect(decodeURIComponent(started.body.checkoutUrl)).toContain(`${RETURN}?ref=${started.body.txRef}`);

    // Still pending at the provider: nothing changes.
    const pending = await request(app).post("/payments/verify").set(tenant.auth).send({ txRef: started.body.txRef }).expect(200);
    expect(pending.body.payment.status).toBe("PENDING");

    answer = { status: "successful", amount: 200000, currency: "RWF", method: "MTN", providerRef: "FLW-1" };
    const done = await request(app).post("/payments/verify").set(tenant.auth).send({ txRef: started.body.txRef }).expect(200);
    expect(done.body.payment).toMatchObject({ status: "SUCCESSFUL", method: "MTN", tenant: { id: tenant.user.id } });
    expect(done.body.payment.receiptNo).toMatch(/^R\d{6}-/);

    const after = await request(app).get("/charges").set(landlord.auth).expect(200);
    expect(after.body.items[0]).toMatchObject({ status: "PAID", payment: { method: "MTN" } });
    expect(notifier.sent.some((m) => m.to === tenant.user.phone && /Receipt/.test(m.text))).toBe(true);
    expect(notifier.sent.some((m) => m.to === landlord.user.phone && /paid/.test(m.text))).toBe(true);

    // Verifying again doesn't send anything twice.
    const count = notifier.sent.length;
    await request(app).post("/payments/verify").set(tenant.auth).send({ txRef: started.body.txRef }).expect(200);
    expect(notifier.sent.length).toBe(count);

    await startPayment(tenant.auth, bill.id).expect(409);
    const receipt = await request(app).get(`/payments/${done.body.payment.id}`).set(landlord.auth).expect(200);
    expect(receipt.body.payment.amount).toBe(200000);
  });

  it("refuses a payment for less than the rent", async () => {
    const { tenant } = await rentedPlace(app, prisma, 200000);
    const bill = (await request(app).get("/charges").set(tenant.auth)).body.items[0];
    const started = await startPayment(tenant.auth, bill.id);
    answer = { status: "successful", amount: 2000, currency: "RWF", method: "MTN" };
    const res = await request(app).post("/payments/verify").set(tenant.auth).send({ txRef: started.body.txRef });
    expect(res.body.payment.status).toBe("FAILED");
    expect((await request(app).get("/charges").set(tenant.auth)).body.items[0].status).toBe("DUE");
  });

  it("only lets the bill's own tenant pay, and only back to allowed addresses", async () => {
    const { tenant } = await rentedPlace(app, prisma);
    const stranger = await makeUser(app, prisma, "TENANT");
    const bill = (await request(app).get("/charges").set(tenant.auth)).body.items[0];
    await startPayment(stranger.auth, bill.id).expect(404);
    expect((await request(app).get("/charges").set(stranger.auth)).body.items).toHaveLength(0);
    await request(app).post(`/charges/${bill.id}/pay`).set(tenant.auth).send({ redirectUrl: "https://evil.example/" }).expect(400);
  });

  it("settles from a signed webhook and ignores unsigned ones", async () => {
    const { tenant } = await rentedPlace(app, prisma);
    const bill = (await request(app).get("/charges").set(tenant.auth)).body.items[0];
    const started = await startPayment(tenant.auth, bill.id);
    answer = { status: "successful", amount: bill.amount, currency: "RWF", method: "AIRTEL" };
    const body = { data: { tx_ref: started.body.txRef } };
    await request(app).post("/payments/webhook").send(body).expect(401);
    expect((await prisma.payment.findFirstOrThrow()).status).toBe("PENDING");
    await request(app).post("/payments/webhook").set("verif-hash", "secret").send(body).expect(200);
    expect((await prisma.payment.findFirstOrThrow()).method).toBe("AIRTEL");
  });

  it("lets the landlord record a cash payment, once", async () => {
    const { tenant, landlord } = await rentedPlace(app, prisma);
    const other = await makeUser(app, prisma, "LANDLORD");
    const bill = (await request(app).get("/charges").set(landlord.auth)).body.items[0];
    await request(app).post(`/charges/${bill.id}/cash`).set(other.auth).send({}).expect(404);
    const res = await request(app).post(`/charges/${bill.id}/cash`).set(landlord.auth).send({ note: "Paid at the office" }).expect(201);
    expect(res.body.payment).toMatchObject({ method: "CASH", tenant: { id: tenant.user.id }, recordedBy: { id: landlord.user.id } });
    await request(app).post(`/charges/${bill.id}/cash`).set(landlord.auth).send({}).expect(409);
    const history = await request(app).get("/payments").set(tenant.auth).expect(200);
    expect(history.body.items).toHaveLength(1);
  });
});

describe("sandbox payment page", () => {
  it("lets a tester pay with MTN and come back", async () => {
    const { app: sApp, prisma: sPrisma } = sandboxed;
    const { tenant } = await rentedPlace(sApp, sPrisma);
    const bill = (await request(sApp).get("/charges").set(tenant.auth)).body.items[0];
    const started = await request(sApp).post(`/charges/${bill.id}/pay`).set(tenant.auth).send({ redirectUrl: RETURN }).expect(201);
    const page = new URL(started.body.checkoutUrl);
    const html = await request(sApp).get(page.pathname + page.search).expect(200);
    expect(html.text).toContain("Pay with MTN MoMo");

    const back = await request(sApp)
      .post(`${page.pathname}/complete`)
      .type("form")
      .send({ outcome: "MTN", redirect: page.searchParams.get("redirect")! })
      .expect(303);
    expect(back.headers.location).toBe(`${RETURN}?ref=${started.body.txRef}`);
    const done = await request(sApp).post("/payments/verify").set(tenant.auth).send({ txRef: started.body.txRef }).expect(200);
    expect(done.body.payment).toMatchObject({ status: "SUCCESSFUL", method: "MTN" });

    await request(sApp)
      .post(`${page.pathname}/complete`)
      .type("form")
      .send({ outcome: "MTN", redirect: "https://evil.example/" })
      .expect(400);
  });
});

describe("notices", () => {
  it("lets a landlord message only their own tenants", async () => {
    const a = await rentedPlace(app, prisma);
    const b = await rentedPlace(app, prisma);
    await request(app).post("/notices").set(a.landlord.auth).send({ to: b.tenant.user.id, subject: "Water", message: "Water off on Monday" }).expect(400);
    const sent = await request(app).post("/notices").set(a.landlord.auth).send({ to: "ALL", subject: "Water", message: "Water off on Monday" }).expect(201);
    expect(sent.body.sent).toBe(1);
    expect((await request(app).get("/notices").set(a.tenant.auth)).body.items).toHaveLength(1);
    expect((await request(app).get("/notices").set(b.tenant.auth)).body.items).toHaveLength(0);
    expect(notifier.sent.some((m) => m.to === a.tenant.user.phone && /Water off/.test(m.text))).toBe(true);
    await request(app).post("/notices").set(a.tenant.auth).send({ to: "ALL", subject: "Hi", message: "Hello all" }).expect(403);
  });
});
