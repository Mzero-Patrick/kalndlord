import { PrismaClient } from "@prisma/client";
import { loadConfig } from "./config";
import { createNotifier } from "./notify";
import { createApp } from "./app";

// The API as a Vercel function. There is no long-running process here, so the
// rent job runs from Vercel's daily timer (see vercel.json) instead of server.ts.
const config = loadConfig();
const prisma = new PrismaClient();

export default createApp({ prisma, notifier: createNotifier(config), config });
