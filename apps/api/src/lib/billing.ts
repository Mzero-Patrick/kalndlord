import type { PrismaClient } from "@prisma/client";
import { formatPeriod, formatRwf } from "@kalndlord/shared";
import type { Notifier } from "../notify";
import { notifyUser } from "./notify-user";

const DAY = 24 * 60 * 60 * 1000;
// Bills are created this far ahead of their due date so tenants can pay early.
export const BILL_AHEAD_DAYS = 7;
export const REMIND_BEFORE_DAYS = 3;
export const OVERDUE_AFTER_DAYS = 3;

// Rent for month k of a lease is due on the same day of the month as the lease
// started (capped at the 28th so every month has that day).
export function dueDateFor(start: Date, k: number): Date {
  const day = k === 0 ? start.getUTCDate() : Math.min(start.getUTCDate(), 28);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, day));
}

export const periodOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// Creates any missing monthly bills for active leases, up to a week ahead.
export async function ensureCharges(prisma: PrismaClient, now = new Date(), leaseId?: string) {
  const horizon = new Date(now.getTime() + BILL_AHEAD_DAYS * DAY);
  const leases = await prisma.lease.findMany({ where: { status: "ACTIVE", id: leaseId } });
  let created = 0;
  for (const lease of leases) {
    const rows = [];
    for (let k = 0; ; k++) {
      const due = dueDateFor(lease.startDate, k);
      if (due > horizon) break;
      if (lease.endDate && due >= lease.endDate) break;
      rows.push({ leaseId: lease.id, period: periodOf(due), amount: lease.monthlyRent, dueDate: due });
    }
    if (rows.length) {
      const res = await prisma.rentCharge.createMany({ data: rows, skipDuplicates: true });
      created += res.count;
    }
  }
  return created;
}

// Sends at most one reminder per stage for each unpaid bill: three days before,
// on the due date, and three days late (the landlord is told then too).
export async function sendReminders(prisma: PrismaClient, notifier: Notifier, now = new Date()) {
  const today = startOfDay(now);
  const charges = await prisma.rentCharge.findMany({
    where: { status: "DUE", reminderStage: { lt: 3 }, dueDate: { lte: new Date(today.getTime() + REMIND_BEFORE_DAYS * DAY) } },
    include: { lease: { include: { tenant: true, landlord: true, property: true } } },
  });
  let sent = 0;
  for (const c of charges) {
    const daysLate = Math.round((today.getTime() - startOfDay(c.dueDate).getTime()) / DAY);
    const stage = daysLate >= OVERDUE_AFTER_DAYS ? 3 : daysLate >= 0 ? 2 : 1;
    if (stage <= c.reminderStage) continue;

    const what = `${formatPeriod(c.period)} rent of ${formatRwf(c.amount)} for "${c.lease.property.title}"`;
    const due = c.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    const text =
      stage === 1 ? `Reminder: your ${what} is due on ${due}. Pay from your Kalndlord account with MoMo, Airtel Money or card.`
      : stage === 2 ? `Your ${what} is due today. Pay from your Kalndlord account with MoMo, Airtel Money or card.`
      : `Your ${what} was due on ${due} and is still unpaid. Please pay as soon as possible.`;

    // Claim the stage first so two job runs can't both send it.
    const claimed = await prisma.rentCharge.updateMany({
      where: { id: c.id, reminderStage: c.reminderStage, status: "DUE" },
      data: { reminderStage: stage },
    });
    if (!claimed.count) continue;
    await notifyUser(notifier, c.lease.tenant, "Rent reminder", text);
    if (stage === 3) {
      await notifyUser(notifier, c.lease.landlord, "Unpaid rent",
        `${c.lease.tenant.fullName} has not paid the ${what}, due ${due}.`);
    }
    sent++;
  }
  return sent;
}

export async function runRentJob(prisma: PrismaClient, notifier: Notifier, now = new Date()) {
  const created = await ensureCharges(prisma, now);
  const reminders = await sendReminders(prisma, notifier, now);
  return { created, reminders };
}

export const isOverdue = (c: { status: string; dueDate: Date }, now = new Date()) =>
  c.status === "DUE" && startOfDay(c.dueDate) < startOfDay(now);
