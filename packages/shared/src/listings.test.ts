import { describe, expect, it } from "vitest";
import { applicationSchema, listingSchema } from "./listings";

const valid = {
  title: "Two-bedroom house in Kimironko",
  type: "HOUSE",
  description: "Quiet house near the market with parking.",
  district: "Gasabo",
  sector: "Kimironko",
  monthlyRent: "250000",
  terms: "Rent is due on the 5th of each month. No subletting.",
};

describe("listingSchema", () => {
  it("accepts a listing and turns form strings into numbers", () => {
    expect(listingSchema.parse(valid).monthlyRent).toBe(250000);
  });

  it("requires terms and conditions", () => {
    expect(listingSchema.safeParse({ ...valid, terms: "" }).success).toBe(false);
  });

  it("rejects an unknown district", () => {
    expect(listingSchema.safeParse({ ...valid, district: "Nairobi" }).success).toBe(false);
  });
});

describe("applicationSchema", () => {
  it("requires accepting the terms", () => {
    expect(applicationSchema.safeParse({ acceptTerms: false }).success).toBe(false);
    expect(applicationSchema.safeParse({ acceptTerms: true }).success).toBe(true);
  });
});
