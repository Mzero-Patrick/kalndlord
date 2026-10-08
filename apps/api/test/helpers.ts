import bcrypt from "bcryptjs";
import request from "supertest";
import type { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";
import type { Config } from "../src/config";
import type { Notifier } from "../src/notify";

export const config: Config = {
  port: 0,
  jwtSecret: "test-secret-test-secret-test-secret",
  corsOrigins: ["http://localhost:3000"],
  publicUrl: "http://localhost:4000",
  uploadDir: "uploads-test",
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

export function setup() {
  const prisma = new PrismaClient({
    datasourceUrl:
      process.env.TEST_DATABASE_URL ?? "postgresql://kalndlord:kalndlord@localhost:5432/kalndlord_test",
  });
  const notifier = new MemoryNotifier();
  const app = createApp({ prisma, notifier, config, rateLimit: false });
  return { prisma, notifier, app };
}

export async function resetDb(prisma: PrismaClient) {
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
