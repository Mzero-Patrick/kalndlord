import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeUser, rentedPlace, resetDb, setup } from "./helpers";

const { prisma, notifier, app } = setup();

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

beforeEach(async () => {
  await resetDb(prisma);
  notifier.sent = [];
});
afterAll(async () => {
  await prisma.$disconnect();
});

const report = (auth: Record<string, string>) =>
  request(app)
    .post("/issues")
    .set(auth)
    .field("kind", "MAINTENANCE")
    .field("urgent", "on")
    .field("subject", "Leaking pipe")
    .field("message", "Water is leaking under the kitchen sink.");

describe("maintenance and other issues", () => {
  it("lets a tenant report a repair with photos and tells the landlord", async () => {
    const { landlord, tenant, propertyId } = await rentedPlace(app, prisma);
    const res = await report(tenant.auth).attach("photos", PNG, "sink.png").expect(201);
    expect(res.body.issue).toMatchObject({
      kind: "MAINTENANCE",
      urgent: true,
      status: "OPEN",
      property: { id: propertyId },
      landlord: { id: landlord.user.id },
    });
    expect(res.body.issue.photos).toHaveLength(1);
    await request(app).get(new URL(res.body.issue.photos[0].url).pathname).expect(200);
    expect([...notifier.sent].reverse().find((m) => m.to === landlord.user.phone)?.text).toMatch(/URGENT.*Leaking pipe/);

    const dash = await request(app).get("/dashboard/landlord").set(landlord.auth).expect(200);
    expect(dash.body.openRequests).toBe(1);
    const tdash = await request(app).get("/dashboard/tenant").set(tenant.auth).expect(200);
    expect(tdash.body.openRequests).toBe(1);
  });

  it("accepts other business issues without photos", async () => {
    const { tenant } = await rentedPlace(app, prisma);
    const res = await request(app)
      .post("/issues")
      .set(tenant.auth)
      .send({ kind: "OTHER", subject: "Noisy neighbour shop", message: "The shop next door plays music all day." })
      .expect(201);
    expect(res.body.issue).toMatchObject({ kind: "OTHER", urgent: false, photos: [] });
  });

  it("rejects reports from tenants without a rental, bad fields and non-image files", async () => {
    const loner = await makeUser(app, prisma, "TENANT");
    await report(loner.auth).expect(400);
    const { tenant, landlord } = await rentedPlace(app, prisma);
    const bad = await request(app).post("/issues").set(tenant.auth).send({ kind: "X", subject: "", message: "" }).expect(400);
    expect(Object.keys(bad.body.fields)).toEqual(expect.arrayContaining(["kind", "subject", "message"]));
    await report(tenant.auth)
      .attach("photos", Buffer.from("<script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" })
      .expect(400);
    await report(landlord.auth).expect(403);
  });

  it("lets the landlord move a report to done and the tenant reopen it", async () => {
    const { landlord, tenant } = await rentedPlace(app, prisma);
    const id = (await report(tenant.auth).expect(201)).body.issue.id;

    // Tenants can't mark their own report as being fixed.
    await request(app).post(`/issues/${id}/updates`).set(tenant.auth).send({ status: "DONE" }).expect(403);

    await request(app)
      .post(`/issues/${id}/updates`)
      .set(landlord.auth)
      .send({ status: "IN_PROGRESS", message: "Plumber coming tomorrow at 9." })
      .expect(201);
    expect([...notifier.sent].reverse().find((m) => m.to === tenant.user.phone)?.text).toMatch(/being fixed.*Plumber coming/);

    const done = await request(app).post(`/issues/${id}/updates`).set(landlord.auth).send({ status: "DONE" }).expect(201);
    expect(done.body.issue.status).toBe("DONE");
    expect(done.body.issue.resolvedAt).not.toBeNull();
    expect((await request(app).get("/dashboard/landlord").set(landlord.auth)).body.openRequests).toBe(0);

    const reopened = await request(app)
      .post(`/issues/${id}/updates`)
      .set(tenant.auth)
      .send({ status: "OPEN", message: "Still dripping." })
      .expect(201);
    expect(reopened.body.issue).toMatchObject({ status: "OPEN", resolvedAt: null });
    expect(reopened.body.issue.updates.map((u: { status: string | null }) => u.status)).toEqual(["IN_PROGRESS", "DONE", "OPEN"]);
    expect(notifier.sent.at(-1)).toMatchObject({ to: landlord.user.phone });
  });

  it("only shows reports to the tenant, their landlord and the administrator", async () => {
    const a = await rentedPlace(app, prisma);
    const b = await rentedPlace(app, prisma);
    const admin = await makeUser(app, prisma, "ADMIN");
    const id = (await report(a.tenant.auth).expect(201)).body.issue.id;

    for (const who of [a.tenant, a.landlord, admin]) {
      await request(app).get(`/issues/${id}`).set(who.auth).expect(200);
    }
    for (const who of [b.tenant, b.landlord]) {
      await request(app).get(`/issues/${id}`).set(who.auth).expect(404);
      await request(app).post(`/issues/${id}/updates`).set(who.auth).send({ message: "hi there" }).expect(404);
      expect((await request(app).get("/issues").set(who.auth)).body.items).toHaveLength(0);
    }
    await request(app).post(`/issues/${id}/updates`).set(admin.auth).send({ status: "IN_PROGRESS" }).expect(201);
    expect((await request(app).get("/dashboard/admin").set(admin.auth)).body.openRequests).toBe(1);
  });
});
