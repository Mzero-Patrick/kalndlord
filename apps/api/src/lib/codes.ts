import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Channel, PrismaClient } from "@prisma/client";
import type { Notifier } from "../notify";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function maskDestination(channel: Channel, destination: string): string {
  if (channel === "EMAIL") {
    const [name, domain] = destination.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${destination.slice(0, 6)}*****${destination.slice(-2)}`;
}

// Creates a fresh code (older unused ones stop working) and sends it.
export async function issueCode(
  prisma: PrismaClient,
  notifier: Notifier,
  userId: string,
  channel: Channel,
  destination: string,
  purpose: "verify" | "reset" = "verify",
) {
  const code = generateCode();
  await prisma.$transaction([
    prisma.verificationCode.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.verificationCode.create({
      data: {
        userId,
        channel,
        destination,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    }),
  ]);
  const text =
    purpose === "reset"
      ? `Your Kalndlord password reset code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this message.`
      : `Your Kalndlord verification code is ${code}. It expires in 10 minutes.`;
  const subject = purpose === "reset" ? "Reset your Kalndlord password" : "Your Kalndlord verification code";
  if (channel === "PHONE") await notifier.sendSms(destination, text);
  else await notifier.sendEmail(destination, subject, text);
}

export type CheckResult = "ok" | "invalid" | "expired" | "too_many_attempts" | "none";

export async function checkCode(prisma: PrismaClient, userId: string, code: string) {
  const record = await prisma.verificationCode.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { result: "none" as CheckResult };
  if (record.expiresAt < new Date()) return { result: "expired" as CheckResult };
  if (record.attempts >= MAX_ATTEMPTS) return { result: "too_many_attempts" as CheckResult };

  const match = await bcrypt.compare(code, record.codeHash);
  if (!match) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { result: "invalid" as CheckResult };
  }
  await prisma.verificationCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { result: "ok" as CheckResult, channel: record.channel };
}
