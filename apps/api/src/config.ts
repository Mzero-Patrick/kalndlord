import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export interface Config {
  port: number;
  jwtSecret: string;
  corsOrigins: string[];
  sms: { provider: "console" | "africastalking"; username?: string; apiKey?: string; senderId?: string };
  email: { provider: "console" | "smtp"; smtpUrl?: string; from: string };
}

export function loadConfig(): Config {
  const jwtSecret = required("JWT_SECRET");
  if (process.env.NODE_ENV === "production" && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  return {
    port: Number(process.env.PORT ?? 4000),
    jwtSecret,
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()),
    sms: {
      provider: process.env.SMS_PROVIDER === "africastalking" ? "africastalking" : "console",
      username: process.env.AT_USERNAME,
      apiKey: process.env.AT_API_KEY,
      senderId: process.env.AT_SENDER_ID || undefined,
    },
    email: {
      provider: process.env.EMAIL_PROVIDER === "smtp" ? "smtp" : "console",
      smtpUrl: process.env.SMTP_URL,
      from: process.env.EMAIL_FROM ?? "Kalndlord <no-reply@example.com>",
    },
  };
}
