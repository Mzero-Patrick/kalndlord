import { PrismaClient } from "@prisma/client";
import { loadConfig } from "./config";
import { createNotifier } from "./notify";
import { createApp } from "./app";
import { runRentJob } from "./lib/billing";

const config = loadConfig();
const prisma = new PrismaClient();
const notifier = createNotifier(config);
const app = createApp({ prisma, notifier, config });

app.listen(config.port, () => {
  console.log(`Kalndlord API listening on http://localhost:${config.port}`);
});

// Monthly bills and rent reminders. Each step is safe to run more than once,
// so running this on several servers at the same time does no harm.
if (config.rentJobMinutes > 0) {
  const run = () =>
    runRentJob(prisma, notifier, new Date(), config.payments.provider !== "off")
      .then((r) => (r.created || r.reminders) && console.log(`Rent job: ${r.created} bills, ${r.reminders} reminders`))
      .catch((err) => console.error("Rent job failed", err));
  run();
  setInterval(run, config.rentJobMinutes * 60 * 1000);
}
