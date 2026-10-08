import { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";
import type { Config } from "../src/config";
import type { Notifier } from "../src/notify";

export const config: Config = {
  port: 0,
  jwtSecret: "test-secret-test-secret-test-secret",
  corsOrigins: ["http://localhost:3000"],
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
