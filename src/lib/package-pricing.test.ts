import { describe, expect, it } from "vitest";
import { perPersonPrice, totalPerPerson, flightStatus } from "./package-pricing";
import type { TravelPackage } from "./packages.functions";

const packageData: TravelPackage = { source: "Holidify", title: "Goa", currency: "INR", priceNumber: 10000, priceBasis: "per-person" };

describe("source-based package pricing", () => {
  it("does not guess undisclosed taxes", () => expect(totalPerPerson(packageData)).toBeUndefined());
  it("uses explicit tax-inclusive totals", () => expect(totalPerPerson({ ...packageData, taxStatus: "included" })).toBe(10000));
  it("adds only disclosed tax amounts", () => expect(totalPerPerson({ ...packageData, taxStatus: "excluded", taxAmount: 500 })).toBe(10500));
  it("does not assume a GST rate", () => expect(totalPerPerson({ ...packageData, taxStatus: "excluded", taxLabel: "5% GST extra" })).toBeUndefined());
  it("divides group price and tax by the quoted matching group size", () => expect(totalPerPerson({ ...packageData, priceBasis: "group", quotedTravelers: 2, requestedTravelers: 2, taxStatus: "excluded", taxAmount: 500 })).toBe(5250));
  it("does not turn unknown or mismatched group prices into per-person prices", () => {
    expect(perPersonPrice({ ...packageData, priceBasis: "unknown" })).toBeUndefined();
    expect(perPersonPrice({ ...packageData, priceBasis: "group", quotedTravelers: 4, requestedTravelers: 2 })).toBeUndefined();
  });
  it("does not infer flights are excluded from missing inclusions", () => expect(flightStatus(packageData)).toBe("unknown"));
});