import bcrypt from "bcryptjs";
import request from "supertest";
import type { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";
import type { Config } from "../src/config";
import type { Notifier } from "../src/notify";
import type { PaymentGateway } from "../src/lib/gateway";

export const config: Config = {
  port: 0,
  jwtSecret: "test-secret-test-secret-test-secret",
  corsOrigins: ["http://localhost:3000"],
  publicUrl: "http://localhost:4000",
  uploadDir: "uploads-test",
  payments: { provider: "sandbox", allowedRedirects: ["http://localhost:3000/", "kalndlord://"] },
  rentJobMinutes: 0,
  sms: { provider: "console" },
  email: { provider: "console", from: "test@example.com" },
};

// Records outgoing messages so tests can read the verification code.
export class MemoryNotifier implements Notifier {
  sent: { to: string; text: string }[] = [];
  async sendSms(to: string, text: string) {
    this.sent.push({ to, text });
  }
  async sendEmail(to: string, _subject: string, text: string) {
    this.sent.push({ to, text });
  }
  lastCode(to: string): string {
    const msg = [...this.sent].reverse().find((m) => m.to === to);
    const code = msg?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`No code sent to ${to}`);
    return code;
  }
}

export function setup(gateway?: PaymentGateway) {
  const prisma = new PrismaClient({
    datasourceUrl:
      process.env.TEST_DATABASE_URL ?? "postgresql://kalndlord:kalndlord@localhost:5432/kalndlord_test",
  });
  const notifier = new MemoryNotifier();
  const app = createApp({ prisma, notifier, config, gateway, rateLimit: false });
  return { prisma, notifier, app };
}

export async function resetDb(prisma: PrismaClient) {
  await prisma.notice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.rentCharge.deleteMany();
  await prisma.inquiry.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.application.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.property.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.user.deleteMany();
}

// Creates a verified user directly and returns a bearer header for them.
let counter = 0;
export async function makeUser(
  app: Express,
  prisma: PrismaClient,
  role: "ADMIN" | "LANDLORD" | "TENANT",
  fullName = `${role.toLowerCase()} ${++counter}`,
) {
  const phone = `+25078${String(1_000_000 + Math.floor(Math.random() * 8_999_999)).slice(0, 7)}`;
  const user = await prisma.user.create({
    data: { fullName, phone, role, passwordHash: await bcrypt.hash("password1", 4), phoneVerifiedAt: new Date() },
  });
  const res = await request(app).post("/auth/login").send({ identifier: phone, password: "password1" });
  return { user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

// A landlord with one place rented to one tenant, ready for billing tests.
export async function rentedPlace(app: Express, prisma: PrismaClient, rent = 200000) {
  const landlord = await makeUser(app, prisma, "LANDLORD");
  const tenant = await makeUser(app, prisma, "TENANT");
  const listing = await request(app)
    .post("/listings")
    .set(landlord.auth)
    .send({
      title: "Shop on KN 3 Ave",
      type: "SHOP",
      description: "Street-facing shop with a storeroom.",
      district: "Nyarugenge",
      sector: "Nyarugenge",
      monthlyRent: rent,
      terms: "Rent is due monthly. No subletting.",
    });
  const application = await request(app)
    .post(`/listings/${listing.body.listing.id}/applications`)
    .set(tenant.auth)
    .send({ acceptTerms: true });
  const accepted = await request(app).post(`/applications/${application.body.application.id}/accept`).set(landlord.auth);
  return { landlord, tenant, leaseId: accepted.body.lease.id as string, propertyId: listing.body.listing.id as string };
}
