import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  place: z.string().trim().min(2, "Destination is required").max(80),
  from: z.string().trim().min(2, "Starting city is required").max(80),
  days: z.number().int().min(1, "At least 1 day").max(30),
  month: z.string().max(40).optional(),
  travelers: z.number().int().min(1).max(20).default(2),
  flights: z.enum(["any", "included", "excluded"]).default("any"),
  maxBudget: z.number().int().min(0).optional(),
  tripType: z.string().max(40).optional(),
  hotelStars: z.number().int().min(1).max(5).optional(),
  mealPlan: z.string().max(40).optional(),
  travelDate: z.string().max(20).optional(),
});

export type TravelPackage = {
  source: string;
  title: string;
  url?: string;
  price?: string;
  priceNumber?: number;
  duration?: string;
  days?: number;
  nights?: number;
  inclusions?: string[];
  cancellation?: string;
  rating?: string;
  highlights?: string;
  currency?: string;
  priceBasis?: "per-person" | "group" | "unknown";
  quotedTravelers?: number;
  requestedTravelers?: number;
  taxStatus?: "included" | "excluded" | "unknown";
  taxAmount?: number;
  taxLabel?: string;
  priceEvidence?: string;
  flightStatus?: "included" | "excluded" | "unknown";
  linkType?: "package" | "listing";
  quoteType?: "from" | "listed";
  checkedAt?: string;
};

export type CompareResult = {
  place: string;
  packages: TravelPackage[];
  errors: { source: string; error: string }[];
};

const PackageSchema = {
  type: "object",
  properties: {
    packages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string", description: "Exact package detail or booking URL found on the page; never construct parameters or guess links" },
          price: { type: "string", description: "Price with currency, e.g. ₹12,999" },
          priceNumber: { type: "number", description: "Numeric advertised price as shown, not an estimated or converted price" },
          currency: { type: "string", description: "Explicit currency, INR for rupee prices" },
          priceBasis: { type: "string", enum: ["per-person", "group", "unknown"], description: "Only per-person when explicitly stated; group if stated total for named traveler count, otherwise unknown" },
          quotedTravelers: { type: "number", description: "Traveler count explicitly associated with the quoted group total; never infer from search" },
          taxStatus: { type: "string", enum: ["included", "excluded", "unknown"], description: "Whether ALL taxes are explicitly included or excluded. Unknown if not disclosed or ambiguous" },
          taxAmount: { type: "number", description: "Total mandatory tax amount explicitly stated in INR for this quoted price basis; do not assume GST rates or calculate it" },
          taxLabel: { type: "string", description: "Verbatim GST/tax/fee terms; preserve disclosures such as plus 5% GST, TCS extra" },
          priceEvidence: { type: "string", description: "Verbatim source excerpt containing this listing's price, per-person/group basis, and taxes" },
          flightStatus: { type: "string", enum: ["included", "excluded", "unknown"], description: "Only classify flights when explicitly included or excluded for this package; missing mentions are unknown" },
          linkType: { type: "string", enum: ["package", "listing"], description: "package only for an actual individual package detail/booking page, listing for category pages" },
          quoteType: { type: "string", enum: ["from", "listed"], description: "from if advertised starting/from price, otherwise listed; not a confirmed live quote" },
          duration: { type: "string", description: "e.g. 5 Days / 4 Nights" },
          days: { type: "number" },
          nights: { type: "number" },
          inclusions: { type: "array", items: { type: "string" } },
          cancellation: { type: "string", description: "Cancellation policy summary if visible" },
          rating: { type: "string" },
          highlights: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["packages"],
};

async function scrapeSite(source: string, query: string): Promise<TravelPackage[]> {
  const apiKey = process.env['FIRECRAWL_API_KEY'];
  if (!apiKey) throw new Error("Travel search is not configured");
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query, limit: 3,
      scrapeOptions: { formats: ["markdown", "links", {
        type: "json", schema: PackageSchema,
        prompt: "Extract real individual holiday packages sold on the page with advertised prices, durations, inclusions, cancellation, ratings and actual package URLs. Extract price basis and taxes ONLY when explicitly stated for that package, with a verbatim priceEvidence excerpt. Do NOT infer GST, currency conversions, traveler counts or totals from search criteria. Label starting prices as from, missing tax or flight details as unknown. Never claim search criteria are selected on the provider or generate booking URL parameters.",
      }] },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Travel search failed [${response.status}]: ${body}`);
    throw new Error(`Travel provider search unavailable (${response.status})`);
  }
  const result = await response.json();

  const r = result as {
    web?: unknown[] | { results?: unknown[] };
    data?: unknown[] | { web?: unknown[] };
  };
  const items: unknown[] = Array.isArray(r.web)
    ? r.web
    : (r.web?.results ??
        (Array.isArray(r.data) ? r.data : r.data?.web) ??
        []);

  const packages: TravelPackage[] = [];
  for (const raw of items as Array<Record<string, unknown>>) {
    const url = (raw.url as string) ?? (raw.sourceURL as string) ?? undefined;
    const json =
      (raw.json as { packages?: TravelPackage[] } | undefined) ??
      ((raw as { extract?: { packages?: TravelPackage[] } }).extract);
    const list = json?.packages ?? [];
    for (const p of list) {
      const candidate = p.url ?? url;
      const knownLinks = new Set([
        url,
        ...((raw.links as string[] | undefined) ?? []),
        ...Array.from(String(raw.markdown ?? "").matchAll(/https?:\/\/[^\s)<>"']+/g), (m) => m[0]),
      ]);
      let safeUrl: string | undefined;
      try {
        const parsed = new URL(candidate ?? "");
        const domain = { Holidify: "holidify.com", MakeMyTrip: "makemytrip.com", Yatra: "yatra.com" }[source];
        if (domain && parsed.protocol === "https:" && (parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)) && knownLinks.has(candidate)) safeUrl = parsed.href;
      } catch { /* No verified link */ }
      packages.push({
        source,
        title: String(p.title ?? "Untitled package"),
        url: safeUrl,
        currency: p.currency,
        priceBasis: p.priceBasis ?? "unknown",
        quotedTravelers: p.quotedTravelers,
        taxStatus: p.taxStatus ?? "unknown",
        taxAmount: p.taxAmount,
        taxLabel: p.taxLabel,
        priceEvidence: p.priceEvidence,
        flightStatus: p.flightStatus ?? "unknown",
        linkType: safeUrl && p.linkType === "package" ? "package" : "listing",
        quoteType: p.quoteType,
        checkedAt: new Date().toISOString(),
        price: p.price,
        priceNumber: p.priceNumber,
        duration: p.duration,
        days: p.days,
        nights: p.nights,
        inclusions: p.inclusions,
        cancellation: p.cancellation,
        rating: p.rating,
        highlights: p.highlights,
      });
    }
  }
  return packages;
}

export const comparePackages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<CompareResult> => {
    const { place, from, days, month, travelers, maxBudget, tripType, hotelStars, mealPlan, travelDate, flights } = data;
    const extra = [
      `from ${from}`,
      flights === "included" ? "including flights" : flights === "excluded" ? "excluding flights land only" : "",
      `${days} days`,
      month ? month : "",
      travelDate ? `starting ${travelDate}` : "",
      travelers ? `for ${travelers} travelers` : "",
      maxBudget ? `under ${maxBudget} INR` : "",
      tripType ? `${tripType} trip` : "",
      hotelStars ? `${hotelStars} star hotel` : "",
      mealPlan ? `${mealPlan} meals` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const sites: { name: string; query: string }[] = [
      {
        name: "Holidify",
        query: `site:holidify.com ${place} holiday packages ${extra}`.trim(),
      },
      {
        name: "MakeMyTrip",
        query: `site:makemytrip.com ${place} holiday packages ${extra}`.trim(),
      },
      {
        name: "Yatra",
        query: `site:yatra.com ${place} holiday packages ${extra}`.trim(),
      },
    ];

    const errors: { source: string; error: string }[] = [];
    const results = await Promise.all(
      sites.map(async (s) => {
        try {
          return await scrapeSite(s.name, s.query);
        } catch (err) {
          errors.push({
            source: s.name,
            error: err instanceof Error ? err.message : "Failed to scrape",
          });
          return [] as TravelPackage[];
        }
      }),
    );

    let packages = results.flat().map((p) => ({ ...p, requestedTravelers: travelers }));
    if (flights !== "any") packages = packages.filter((p) => p.flightStatus === flights);
    if (maxBudget) {
      packages = packages.filter((p) => !p.priceNumber || p.priceNumber <= maxBudget);
    }
    if (days) {
      packages = packages.filter((p) => !p.days || Math.abs(p.days - days) <= 2);
    }
    packages.sort((a, b) => (a.priceNumber ?? 1e12) - (b.priceNumber ?? 1e12));

    return { place, packages, errors };
  });