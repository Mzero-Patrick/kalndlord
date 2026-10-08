import { describe, expect, it } from "vitest";
import { mobileNetworkOf, normalizeRwandaPhone } from "./phone";
import { registerSchema } from "./auth";

describe("normalizeRwandaPhone", () => {
  it.each([
    ["0788123456", "+250788123456"],
    ["+250 788 123 456", "+250788123456"],
    ["250722123456", "+250722123456"],
    ["073-123-4567", "+250731234567"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeRwandaPhone(input)).toBe(expected);
  });

  it.each(["0751234567", "078812345", "+254712345678", "hello"])("rejects %s", (input) => {
    expect(normalizeRwandaPhone(input)).toBeNull();
  });

  it("detects the network", () => {
    expect(mobileNetworkOf("+250788123456")).toBe("MTN");
    expect(mobileNetworkOf("+250731234567")).toBe("AIRTEL");
  });
});

describe("registerSchema", () => {
  const base = { fullName: "Jean Doe", password: "secret123", role: "TENANT" as const };

  it("requires a phone or an email", () => {
    expect(registerSchema.safeParse(base).success).toBe(false);
  });

  it("defaults to phone verification when a phone is given", () => {
    const r = registerSchema.parse({ ...base, phone: "0788123456", email: "A@B.rw" });
    expect(r.verifyVia).toBe("PHONE");
    expect(r.email).toBe("a@b.rw");
  });

  it("uses email when only an email is given", () => {
    expect(registerSchema.parse({ ...base, email: "a@b.rw" }).verifyVia).toBe("EMAIL");
  });

  it("refuses admin self sign-up", () => {
    expect(registerSchema.safeParse({ ...base, email: "a@b.rw", role: "ADMIN" }).success).toBe(false);
  });
});
