import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { config, rentedPlace, resetDb, setup } from "./helpers";

const { prisma, notifier, app } = setup();
const timed = createApp({ prisma, notifier, config: { ...config, cronSecret: "cron-secret" }, rateLimit: false });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

describe("daily rent job endpoint", () => {
  it("runs only with the cron secret", async () => {
    await rentedPlace(timed, prisma);
    await request(app).get("/jobs/rent").set("Authorization", "Bearer cron-secret").expect(404);
    await request(timed).get("/jobs/rent").expect(404);
    await request(timed).get("/jobs/rent").set("Authorization", "Bearer wrong").expect(404);
    const res = await request(timed).get("/jobs/rent").set("Authorization", "Bearer cron-secret").expect(200);
    expect(res.body).toEqual({ created: expect.any(Number), reminders: expect.any(Number) });
  });
});
