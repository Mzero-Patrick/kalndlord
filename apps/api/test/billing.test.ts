import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { dueDateFor, ensureCharges, periodOf, sendReminders } from "../src/lib/billing";
import { rentedPlace, resetDb, setup } from "./helpers";

const { prisma, notifier, app } = setup();

beforeEach(async () => {
  await resetDb(prisma);
  notifier.sent = [];
});
afterAll(() => prisma.$disconnect());

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("due dates", () => {
  it("keeps the start day and caps it at the 28th", () => {
    expect(dueDateFor(d("2026-01-31"), 0).toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(dueDateFor(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(dueDateFor(d("2026-11-05"), 2).toISOString().slice(0, 10)).toBe("2027-01-05");
    expect(periodOf(d("2027-01-05"))).toBe("2027-01");
  });
});

describe("rent job", () => {
  it("bills the first month when the lease starts and later months a week ahead", async () => {
    const { leaseId } = await rentedPlace(app, prisma);
    // Accepting the application already created the first bill.
    expect(await prisma.rentCharge.count({ where: { leaseId } })).toBe(1);

    const lease = await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } });
    const nextDue = dueDateFor(lease.startDate, 1);
    await ensureCharges(prisma, new Date(nextDue.getTime() - 8 * 86400000));
    expect(await prisma.rentCharge.count({ where: { leaseId } })).toBe(1);
    await ensureCharges(prisma, new Date(nextDue.getTime() - 6 * 86400000));
    await ensureCharges(prisma, new Date(nextDue.getTime() - 6 * 86400000)); // running twice is harmless
    expect(await prisma.rentCharge.count({ where: { leaseId } })).toBe(2);
  });

  it("sends each reminder once, and tells the landlord when rent is late", async () => {
    const { leaseId, tenant, landlord } = await rentedPlace(app, prisma, 150000);
    const charge = await prisma.rentCharge.findFirstOrThrow({ where: { leaseId } });
    await prisma.rentCharge.update({ where: { id: charge.id }, data: { dueDate: d("2026-05-10") } });

    const toTenant = () => notifier.sent.filter((m) => m.to === tenant.user.phone && /rent/i.test(m.text));
    notifier.sent = [];
    await sendReminders(prisma, notifier, d("2026-05-07"));
    await sendReminders(prisma, notifier, d("2026-05-08"));
    expect(toTenant()).toHaveLength(1);
    expect(toTenant()[0].text).toMatch(/due on 10 May/);

    await sendReminders(prisma, notifier, d("2026-05-10"));
    expect(toTenant()[1].text).toMatch(/due today/);

    await sendReminders(prisma, notifier, d("2026-05-13"));
    await sendReminders(prisma, notifier, d("2026-05-20"));
    expect(toTenant()).toHaveLength(3);
    expect(notifier.sent.filter((m) => m.to === landlord.user.phone && /not paid/.test(m.text))).toHaveLength(1);
  });

  it("skips straight to the latest reminder instead of sending all of them", async () => {
    const { leaseId, tenant } = await rentedPlace(app, prisma);
    const charge = await prisma.rentCharge.findFirstOrThrow({ where: { leaseId } });
    await prisma.rentCharge.update({ where: { id: charge.id }, data: { dueDate: d("2026-05-10") } });
    notifier.sent = [];
    await sendReminders(prisma, notifier, d("2026-05-20"));
    const sent = notifier.sent.filter((m) => m.to === tenant.user.phone);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(/still unpaid/);
  });

  it("doesn't remind about paid rent", async () => {
    const { leaseId } = await rentedPlace(app, prisma);
    await prisma.rentCharge.updateMany({ where: { leaseId }, data: { status: "PAID", dueDate: d("2026-05-10") } });
    notifier.sent = [];
    expect(await sendReminders(prisma, notifier, d("2026-05-20"))).toBe(0);
  });
});
