import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import type { PrismaClient } from "@prisma/client";
import type { Config } from "./config";
import type { Notifier } from "./notify";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { sendError } from "./lib/http";

export interface AppDeps {
  prisma: PrismaClient;
  notifier: Notifier;
  config: Config;
  rateLimit?: boolean;
}

export function createApp({ prisma, notifier, config, rateLimit: limit = true }: AppDeps) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  if (limit) {
    app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }));
  }

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter(prisma, notifier, config));
  app.use("/dashboard", dashboardRouter(prisma, config));

  app.use((_req, res) => sendError(res, 404, "Not found"));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    sendError(res, 500, "Something went wrong. Please try again");
  });
  return app;
}
