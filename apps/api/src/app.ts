import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "@prisma/client";
import type { Config } from "./config";
import type { Notifier } from "./notify";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { listingsRouter } from "./routes/listings";
import { applicationsRouter } from "./routes/applications";
import { inquiriesRouter } from "./routes/inquiries";
import { paymentsRouter } from "./routes/payments";
import { noticesRouter } from "./routes/notices";
import { issuesRouter } from "./routes/issues";
import { localStorage, s3Storage, type Storage } from "./lib/storage";
import { flutterwave, paymentsOff, sandbox, type PaymentGateway } from "./lib/gateway";
import { sendError } from "./lib/http";

export interface AppDeps {
  prisma: PrismaClient;
  notifier: Notifier;
  config: Config;
  storage?: Storage;
  gateway?: PaymentGateway;
  rateLimit?: boolean;
}

export function createGateway(config: Config): PaymentGateway {
  if (config.payments.provider === "flutterwave")
    return flutterwave(config.payments.flwSecretKey!, config.payments.flwWebhookHash);
  return config.payments.provider === "off" ? paymentsOff : sandbox(config.publicUrl);
}

export function createApp({ prisma, notifier, config, storage, gateway, rateLimit: limit = true }: AppDeps) {
  const app = express();
  const photos = storage ?? (config.s3 ? s3Storage(config.s3) : localStorage(config.uploadDir, config.publicUrl));
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  if (limit) {
    app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));
  }

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter(prisma, notifier, config));
  app.use("/dashboard", dashboardRouter(prisma, config));
  app.use("/listings", listingsRouter(prisma, notifier, photos, config));
  app.use("/inquiries", inquiriesRouter(prisma, notifier, config));
  app.use("/notices", noticesRouter(prisma, notifier, config));
  app.use("/issues", issuesRouter(prisma, notifier, photos, config));
  app.use("/", applicationsRouter(prisma, notifier, config));
  app.use("/", paymentsRouter(prisma, notifier, gateway ?? createGateway(config), config));
  app.use("/uploads", express.static(config.uploadDir, { maxAge: "7d", index: false }));

  app.use((_req, res) => sendError(res, 404, "Not found"));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "Each photo must be under 5 MB" : "Too many photos at once (up to 4 on a report, 8 on a listing)";
      return sendError(res, 400, message);
    }
    console.error(err);
    sendError(res, 500, "Something went wrong. Please try again");
  });
  return app;
}
