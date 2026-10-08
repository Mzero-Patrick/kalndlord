import "dotenv/config";
import type { S3Settings } from "./lib/storage";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export interface Config {
  port: number;
  jwtSecret: string;
  corsOrigins: string[];
  // Address the API is reachable at, used to build photo links.
  publicUrl: string;
  uploadDir: string;
  // Set when photos go to cloud storage instead of uploadDir.
  s3?: S3Settings;
  blobToken?: string;
  // Vercel's daily timer calls /jobs/rent with this secret.
  cronSecret?: string;
  payments: {
    // "off" hides online payment (landlords still record cash) until Flutterwave is set up.
    provider: "sandbox" | "flutterwave" | "off";
    flwSecretKey?: string;
    flwWebhookHash?: string;
    // Where the payment page may send people back to (web app and mobile app links).
    allowedRedirects: string[];
  };
  // How often the rent job (bills and reminders) runs inside the API. 0 turns it off.
  rentJobMinutes: number;
  sms: { provider: "console" | "africastalking"; username?: string; apiKey?: string; senderId?: string };
  email: { provider: "console" | "smtp"; smtpUrl?: string; from: string };
}

export function loadConfig(): Config {
  const jwtSecret = required("JWT_SECRET");
  if (process.env.NODE_ENV === "production" && jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  if (process.env.PAYMENT_PROVIDER === "flutterwave" && !process.env.FLW_SECRET_KEY) {
    throw new Error("FLW_SECRET_KEY is required when PAYMENT_PROVIDER is flutterwave");
  }
  const provider = process.env.PAYMENT_PROVIDER;
  if (process.env.NODE_ENV === "production" && provider !== "flutterwave" && provider !== "off") {
    throw new Error("Set PAYMENT_PROVIDER to flutterwave (or off) in production; the sandbox moves no money");
  }
  let s3: S3Settings | undefined;
  if (process.env.STORAGE === "s3") {
    s3 = {
      bucket: required("S3_BUCKET"),
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      publicUrl: required("S3_PUBLIC_URL"),
    };
  }
  const blobToken = process.env.STORAGE === "blob" ? required("BLOB_READ_WRITE_TOKEN") : undefined;
  if (!s3 && !blobToken && process.env.NODE_ENV === "production") {
    console.warn("Photos are saved on the server's disk. Set STORAGE=s3 so they survive redeploys.");
  }
  return {
    port: Number(process.env.PORT ?? 4000),
    jwtSecret,
    corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((s) => s.trim()),
    publicUrl: (process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, ""),
    uploadDir: process.env.UPLOAD_DIR ?? "uploads",
    s3,
    blobToken,
    cronSecret: process.env.CRON_SECRET || undefined,
    payments: {
      provider: provider === "flutterwave" || provider === "off" ? provider : "sandbox",
      flwSecretKey: process.env.FLW_SECRET_KEY,
      flwWebhookHash: process.env.FLW_WEBHOOK_HASH,
      allowedRedirects: (process.env.PAYMENT_REDIRECTS ?? "http://localhost:3000/,kalndlord://,exp://")
        .split(",").map((s) => s.trim()).filter(Boolean),
    },
    rentJobMinutes: Number(process.env.RENT_JOB_MINUTES ?? 60),
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
