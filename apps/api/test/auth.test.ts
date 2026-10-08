import request from "supertest";
import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, setup } from "./helpers";

const { prisma, notifier, app } = setup();

beforeEach(async () => {
  await resetDb(prisma);
  notifier.sent = [];
});
afterAll(() => prisma.$disconnect());

const tenant = { fullName: "Aline Uwase", phone: "0788123456", password: "secret123", role: "TENANT" };

async function registerAndVerify(body: Record<string, unknown>, to: string) {
  const reg = await request(app).post("/auth/register").send(body).expect(201);
  const res = await request(app)
    .post("/auth/verify")
    .send({ userId: reg.body.userId, code: notifier.lastCode(to) })
    .expect(200);
  return res.body as { token: string; user: { role: string } };
}

describe("sign-up and verification", () => {
  it("sends a code by SMS and logs the user in once verified", async () => {
    const reg = await request(app).post("/auth/register").send(tenant).expect(201);
    expect(reg.body.channel).toBe("PHONE");
    expect(reg.body.sentTo).not.toContain("123456");

    const res = await request(app)
      .post("/auth/verify")
      .send({ userId: reg.body.userId, code: notifier.lastCode("+250788123456") })
      .expect(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ role: "TENANT", phone: "+250788123456", phoneVerified: true });
  });

  it("can verify by email instead", async () => {
    const body = { ...tenant, email: "aline@example.rw", verifyVia: "EMAIL" };
    const { user } = await registerAndVerify(body, "aline@example.rw");
    expect(user).toMatchObject({ emailVerified: true, phoneVerified: false });
  });

  it("rejects a wrong code and locks after 5 attempts", async () => {
    const reg = await request(app).post("/auth/register").send(tenant).expect(201);
    const real = notifier.lastCode("+250788123456");
    const wrong = real === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      await request(app).post("/auth/verify").send({ userId: reg.body.userId, code: wrong }).expect(400);
    }
    const res = await request(app).post("/auth/verify").send({ userId: reg.body.userId, code: real }).expect(400);
    expect(res.body.error).toMatch(/Too many/);
  });

  it("refuses duplicate phone numbers", async () => {
    await request(app).post("/auth/register").send(tenant).expect(201);
    const res = await request(app).post("/auth/register").send({ ...tenant, phone: "+250 788 123 456" }).expect(409);
    expect(res.body.fields.phone).toBeTruthy();
  });

  it("refuses admin self sign-up", async () => {
    await request(app).post("/auth/register").send({ ...tenant, role: "ADMIN" }).expect(400);
  });

  it("throttles resending codes", async () => {
    const reg = await request(app).post("/auth/register").send(tenant).expect(201);
    await request(app).post("/auth/resend").send({ userId: reg.body.userId }).expect(429);
  });
});

describe("login", () => {
  it("logs in with phone or email once verified", async () => {
    await registerAndVerify({ ...tenant, email: "aline@example.rw" }, "+250788123456");
    await request(app).post("/auth/login").send({ identifier: "078 812 3456", password: "secret123" }).expect(200);
    await request(app).post("/auth/login").send({ identifier: "ALINE@example.rw", password: "secret123" }).expect(200);
  });

  it("asks unverified users to verify first", async () => {
    const reg = await request(app).post("/auth/register").send(tenant).expect(201);
    const res = await request(app).post("/auth/login").send({ identifier: "0788123456", password: "secret123" }).expect(403);
    expect(res.body).toMatchObject({ needsVerification: true, userId: reg.body.userId });
  });

  it("rejects a wrong password", async () => {
    await registerAndVerify(tenant, "+250788123456");
    await request(app).post("/auth/login").send({ identifier: "0788123456", password: "nope12345" }).expect(401);
  });
});

describe("dashboards by role", () => {
  it("lets each role reach only its dashboard", async () => {
    const t = await registerAndVerify(tenant, "+250788123456");
    const l = await registerAndVerify(
      { ...tenant, phone: "0722000111", role: "LANDLORD", fullName: "Eric Landlord" },
      "+250722000111",
    );
    await prisma.user.create({
      data: {
        fullName: "Admin",
        email: "admin@example.rw",
        role: "ADMIN",
        passwordHash: await bcrypt.hash("adminpass1", 4),
        emailVerifiedAt: new Date(),
      },
    });
    const a = await request(app).post("/auth/login").send({ identifier: "admin@example.rw", password: "adminpass1" }).expect(200);

    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
    await request(app).get("/dashboard/tenant").set(auth(t.token)).expect(200);
    await request(app).get("/dashboard/landlord").set(auth(t.token)).expect(403);
    await request(app).get("/dashboard/landlord").set(auth(l.token)).expect(200);
    await request(app).get("/dashboard/admin").set(auth(l.token)).expect(403);

    const admin = await request(app).get("/dashboard/admin").set(auth(a.body.token)).expect(200);
    expect(admin.body.users).toMatchObject({ TENANT: 1, LANDLORD: 1, ADMIN: 1 });
    await request(app).get("/dashboard/landlord").set(auth(a.body.token)).expect(200);
  });

  it("requires a token", async () => {
    await request(app).get("/auth/me").expect(401);
    await request(app).get("/auth/me").set({ Authorization: "Bearer junk" }).expect(401);
  });
});
