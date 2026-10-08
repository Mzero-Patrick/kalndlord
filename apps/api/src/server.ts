import { PrismaClient } from "@prisma/client";
import { loadConfig } from "./config";
import { createNotifier } from "./notify";
import { createApp } from "./app";

const config = loadConfig();
const prisma = new PrismaClient();
const app = createApp({ prisma, notifier: createNotifier(config), config });

app.listen(config.port, () => {
  console.log(`Kalndlord API listening on http://localhost:${config.port}`);
});
