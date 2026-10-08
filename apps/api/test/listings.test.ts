import request from "supertest";
import fs from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { config, makeUser, resetDb, setup } from "./helpers";

const { prisma, notifier, app } = setup();

beforeEach(async () => {
  await resetDb(prisma);
  notifier.sent = [];
});
afterAll(async () => {
  await prisma.$disconnect();
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
});

const house = {
  title: "Two-bedroom house in Kimironko",
  type: "HOUSE",
  description: "Quiet house near the market with parking.",
  district: "Gasabo",
  sector: "Kimironko",
  monthlyRent: 250000,
  terms: "Rent is due on the 5th of each month. No subletting.",
};

// Smallest valid PNG (1x1 pixel).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function listing(auth: Record<string, string>, body: Record<string, unknown> = house) {
  const res = await request(app).post("/listings").set(auth).send(body).expect(201);
  return res.body.listing as { id: string };
}

describe("listings", () => {
  it("lets a landlord list a place that anyone can find", async () => {
    const { auth } = await makeUser(app, prisma, "LANDLORD");
    const created = await listing(auth);

    const search = await request(app).get("/listings").query({ district: "Gasabo", maxRent: 300000 }).expect(200);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0]).toMatchObject({ id: created.id, terms: house.terms });

    const none = await request(app).get("/listings").query({ q: "workshop", type: "WORKSHOP" }).expect(200);
    expect(none.body.total).toBe(0);
  });

  it("keeps tenants from creating listings", async () => {
    const { auth } = await makeUser(app, prisma, "TENANT");
    await request(app).post("/listings").set(auth).send(house).expect(403);
  });

  it("lets the administrator list on behalf of a landlord", async () => {
    const admin = await makeUser(app, prisma, "ADMIN");
    const landlord = await makeUser(app, prisma, "LANDLORD");
    const created = await listing(admin.auth, { ...house, landlordId: landlord.user.id });
    const mine = await request(app).get("/listings/mine").set(landlord.auth).expect(200);
    expect(mine.body.items.map((i: { id: string }) => i.id)).toEqual([created.id]);
  });

  it("only lets the owner edit, and hidden listings leave search", async () => {
    const owner = await makeUser(app, prisma, "LANDLORD");
    const other = await makeUser(app, prisma, "LANDLORD");
    const created = await listing(owner.auth);
    await request(app).patch(`/listings/${created.id}`).set(other.auth).send({ monthlyRent: 1 }).expect(404);
    await request(app).patch(`/listings/${created.id}`).set(owner.auth).send({ status: "HIDDEN" }).expect(200);
    expect((await request(app).get("/listings")).body.total).toBe(0);
    await request(app).get(`/listings/${created.id}`).expect(404);
    await request(app).get(`/listings/${created.id}`).set(owner.auth).expect(200);
  });

  it("accepts real images and refuses other files", async () => {
    const { auth } = await makeUser(app, prisma, "LANDLORD");
    const created = await listing(auth);
    const ok = await request(app)
      .post(`/listings/${created.id}/photos`)
      .set(auth)
      .attach("photos", PNG, "front.png")
      .expect(201);
    expect(ok.body.listing.photos).toHaveLength(1);
    const url: string = ok.body.listing.photos[0].url;
    await request(app).get(new URL(url).pathname).expect(200).expect("content-type", /png/);

    await request(app)
      .post(`/listings/${created.id}/photos`)
      .set(auth)
      .attach("photos", Buffer.from("<script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" })
      .expect(400);

    await request(app).delete(`/listings/${created.id}/photos/${ok.body.listing.photos[0].id}`).set(auth).expect(204);
  });
});

describe("applications and leases", () => {
  it("requires accepting the terms, then the landlord's acceptance creates a lease", async () => {
    const landlord = await makeUser(app, prisma, "LANDLORD");
    const aline = await makeUser(app, prisma, "TENANT", "Aline");
    const eric = await makeUser(app, prisma, "TENANT", "Eric");
    const created = await listing(landlord.auth);

    await request(app).post(`/listings/${created.id}/applications`).set(aline.auth).send({ acceptTerms: false }).expect(400);
    const a = await request(app)
      .post(`/listings/${created.id}/applications`)
      .set(aline.auth)
      .send({ acceptTerms: true, message: "I work nearby" })
      .expect(201);
    await request(app).post(`/listings/${created.id}/applications`).set(aline.auth).send({ acceptTerms: true }).expect(409);
    const e = await request(app).post(`/listings/${created.id}/applications`).set(eric.auth).send({ acceptTerms: true }).expect(201);

    // The landlord was told about each application.
    expect(notifier.sent.filter((m) => m.to === landlord.user.phone)).toHaveLength(2);

    // Another landlord or a tenant can't decide.
    const stranger = await makeUser(app, prisma, "LANDLORD");
    await request(app).post(`/applications/${a.body.application.id}/accept`).set(stranger.auth).expect(404);
    await request(app).post(`/applications/${a.body.application.id}/accept`).set(eric.auth).expect(404);

    const accepted = await request(app).post(`/applications/${a.body.application.id}/accept`).set(landlord.auth).expect(200);
    expect(accepted.body.lease).toMatchObject({ status: "ACTIVE", monthlyRent: 250000, tenant: { fullName: "Aline" } });

    // The place is taken: out of search, Eric's application closed, and he was told.
    expect((await request(app).get("/listings")).body.total).toBe(0);
    const ericApps = await request(app).get("/applications").set(eric.auth).expect(200);
    expect(ericApps.body.items[0]).toMatchObject({ id: e.body.application.id, status: "REJECTED" });
    expect(notifier.sent.some((m) => m.to === eric.user.phone && /taken/.test(m.text))).toBe(true);

    // Aline can still open the listing and sees her lease with the terms she accepted.
    await request(app).get(`/listings/${created.id}`).set(aline.auth).expect(200);
    const leases = await request(app).get("/leases").set(aline.auth).expect(200);
    expect(leases.body.items).toHaveLength(1);
    const stored = await prisma.lease.findFirstOrThrow();
    expect(stored.terms).toBe(house.terms);
  });

  it("creates only one lease when two applications are accepted at once", async () => {
    const landlord = await makeUser(app, prisma, "LANDLORD");
    const t1 = await makeUser(app, prisma, "TENANT");
    const t2 = await makeUser(app, prisma, "TENANT");
    const created = await listing(landlord.auth);
    const a1 = await request(app).post(`/listings/${created.id}/applications`).set(t1.auth).send({ acceptTerms: true });
    const a2 = await request(app).post(`/listings/${created.id}/applications`).set(t2.auth).send({ acceptTerms: true });
    const results = await Promise.all([
      request(app).post(`/applications/${a1.body.application.id}/accept`).set(landlord.auth),
      request(app).post(`/applications/${a2.body.application.id}/accept`).set(landlord.auth),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.lease.count()).toBe(1);
  });

  it("lets a tenant withdraw a pending application", async () => {
    const landlord = await makeUser(app, prisma, "LANDLORD");
    const tenant = await makeUser(app, prisma, "TENANT");
    const created = await listing(landlord.auth);
    const a = await request(app).post(`/listings/${created.id}/applications`).set(tenant.auth).send({ acceptTerms: true });
    await request(app).post(`/applications/${a.body.application.id}/withdraw`).set(tenant.auth).expect(200);
    await request(app).post(`/applications/${a.body.application.id}/accept`).set(landlord.auth).expect(409);
  });
});

describe("contact section", () => {
  it("sends listing questions to the landlord and general ones to the administrator", async () => {
    const admin = await makeUser(app, prisma, "ADMIN");
    const landlord = await makeUser(app, prisma, "LANDLORD");
    const tenant = await makeUser(app, prisma, "TENANT");
    const created = await listing(landlord.auth);

    const q1 = await request(app)
      .post("/inquiries")
      .set(tenant.auth)
      .send({ propertyId: created.id, subject: "Parking", message: "Is there parking for a car?" })
      .expect(201);
    await request(app).post("/inquiries").set(tenant.auth).send({ subject: "Help", message: "How do I pay rent?" }).expect(201);

    const forLandlord = await request(app).get("/inquiries").set(landlord.auth).expect(200);
    expect(forLandlord.body.items).toHaveLength(1);
    expect(forLandlord.body.items[0].canReply).toBe(true);
    const forAdmin = await request(app).get("/inquiries").set(admin.auth).expect(200);
    expect(forAdmin.body.items).toHaveLength(2);
    expect(notifier.sent.some((m) => m.to === admin.user.phone)).toBe(true);

    // A landlord can't answer general questions.
    const general = forAdmin.body.items.find((i: { property: unknown }) => !i.property);
    await request(app).post(`/inquiries/${general.id}/reply`).set(landlord.auth).send({ reply: "x" }).expect(404);

    await request(app).post(`/inquiries/${q1.body.inquiry.id}/reply`).set(landlord.auth).send({ reply: "Yes, one space." }).expect(200);
    const mine = await request(app).get("/inquiries").set(tenant.auth).expect(200);
    expect(mine.body.items.find((i: { id: string }) => i.id === q1.body.inquiry.id).reply).toBe("Yes, one space.");
    expect(notifier.sent.some((m) => m.to === tenant.user.phone && /reply/.test(m.text))).toBe(true);
  });
});
