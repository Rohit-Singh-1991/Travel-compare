import type { TravelPackage } from "./packages.functions";

export function perPersonPrice(p: TravelPackage): number | undefined {
  if (p.currency !== "INR") return undefined;
  if (p.priceBasis === "per-person") return p.priceNumber;
  if (p.priceBasis === "group" && p.quotedTravelers && p.requestedTravelers === p.quotedTravelers && p.priceNumber !== undefined) {
    return p.priceNumber / p.quotedTravelers;
  }
  return undefined;
}

export function totalPerPerson(p: TravelPackage): number | undefined {
  const base = perPersonPrice(p);
  if (base === undefined) return undefined;
  if (p.taxStatus === "included") return base;
  if (p.taxStatus === "excluded" && p.taxAmount !== undefined) {
    const divisor = p.priceBasis === "group" ? p.quotedTravelers : 1;
    if (divisor) return base + p.taxAmount / divisor;
  }
  return undefined;
}

export function flightStatus(p: TravelPackage): "included" | "excluded" | "unknown" {
  return p.flightStatus ?? "unknown";
}

export function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}