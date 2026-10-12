import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { comparePackages, type CompareResult, type TravelPackage } from "@/lib/packages.functions";
import { flightStatus, perPersonPrice, totalPerPerson, inr } from "@/lib/package-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  MapPin,
  Calendar,
  Wallet,
  Clock,
  Star,
  Tag,
  Sparkles,
  ExternalLink,
  Plane,
  Palmtree,
  Compass,
  ArrowUpDown,
  Filter,
  Trophy,
  Cloud,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PackCompare — Compare Holiday Packages Across Sites" },
      {
        name: "description",
        content:
          "Compare travel packages from MakeMyTrip, Holidify, Yatra and more by destination, duration, price and cancellation policy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "PackCompare — Holiday Package Comparison" },
      {
        property: "og:description",
        content:
          "One search, every holiday package. Compare prices, inclusions and cancellation terms side by side.",
      },
    ],
  }),
  component: Index,
});

// Per-source color theming (uses design tokens where possible)
const SOURCE_STYLES: Record<
  string,
  { badge: string; ring: string; tab: string; dot: string }
> = {
  MakeMyTrip: {
    badge: "bg-red-500 text-white hover:bg-red-500",
    ring: "hover:border-red-400/60 hover:shadow-red-200/40",
    tab: "data-[state=active]:bg-red-500 data-[state=active]:text-white",
    dot: "bg-red-500",
  },
  Holidify: {
    badge: "bg-emerald-500 text-white hover:bg-emerald-500",
    ring: "hover:border-emerald-400/60 hover:shadow-emerald-200/40",
    tab: "data-[state=active]:bg-emerald-500 data-[state=active]:text-white",
    dot: "bg-emerald-500",
  },
  Yatra: {
    badge: "bg-amber-500 text-white hover:bg-amber-500",
    ring: "hover:border-amber-400/60 hover:shadow-amber-200/40",
    tab: "data-[state=active]:bg-amber-500 data-[state=active]:text-white",
    dot: "bg-amber-500",
  },
};
const DEFAULT_STYLE = {
  badge: "bg-primary text-primary-foreground hover:bg-primary",
  ring: "hover:border-primary/50",
  tab: "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
  dot: "bg-primary",
};
const styleFor = (source: string) => SOURCE_STYLES[source] ?? DEFAULT_STYLE;

function Index() {
  useRouter();
  const compare = useServerFn(comparePackages);
  const [place, setPlace] = useState("Goa");
  const [from, setFrom] = useState("");
  const [days, setDays] = useState<string>("3");
  const [month, setMonth] = useState<string>("");
  const [travelers, setTravelers] = useState<string>("2");
  const [maxBudget, setMaxBudget] = useState<string>("");
  const [travelDate, setTravelDate] = useState<string>("");
  const [tripType, setTripType] = useState<string>("");
  const [hotelStars, setHotelStars] = useState<string>("");
  const [mealPlan, setMealPlan] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<{ place?: string; from?: string; days?: string; travelers?: string }>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: { place?: string; from?: string; days?: string; travelers?: string } = {};
    if (place.trim().length < 2) errs.place = "Enter a destination (e.g. Goa, Manali)";
    if (from.trim().length < 2) errs.from = "Enter your starting city (e.g. Delhi, Mumbai)";
    const daysNum = Number(days);
    if (!days || !Number.isInteger(daysNum) || daysNum < 1 || daysNum > 30)
      errs.days = "Trip length must be 1–30 days";
    if (!travelers || !Number.isInteger(Number(travelers)) || Number(travelers) < 1 || Number(travelers) > 20) errs.travelers = "Enter 1–20 travelers";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fill the required fields before comparing");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await compare({
        data: {
          place: place.trim(),
          from: from.trim(),
          days: daysNum,
          month: month || undefined,
          travelers: Number(travelers),
          flights,
          maxBudget: maxBudget ? Number(maxBudget) : undefined,
          travelDate: travelDate || undefined,
          tripType: tripType || undefined,
          hotelStars: hotelStars ? Number(hotelStars) : undefined,
          mealPlan: mealPlan || undefined,
        },
      });
      setResult(res);
      setActiveTab("all");
      if (res.packages.length > 0) {
        toast.success(`Found ${res.packages.length} packages for ${res.place}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const [sortBy, setSortBy] = useState<"relevance" | "price-asc" | "price-desc" | "days" | "rating">("relevance");
  const [freeCancel, setFreeCancel] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [needInc, setNeedInc] = useState<string[]>([]);
  const [flights, setFlights] = useState<"any" | "included" | "excluded">("any");

  const filtered = useMemo(() => {
    if (!result) return [] as TravelPackage[];
    let list = result.packages.filter((p) => {
      if (freeCancel && !/free|full refund|no cancellation fee|refundable/i.test(p.cancellation ?? "")) return false;
      if (minRating > 0 && ratingNum(p) < minRating) return false;
      if (flights !== "any") {
        if (flightStatus(p) !== flights) return false;
      }
      for (const inc of needInc) {
        const text = (p.inclusions ?? []).join(" ") + " " + (p.highlights ?? "");
        if (!new RegExp(INC_PATTERNS[inc], "i").test(text)) return false;
      }
      return true;
    });
    const big = Number.MAX_SAFE_INTEGER;
    if (sortBy === "price-asc") list = [...list].sort((a, b) => (totalPerPerson(a) ?? big) - (totalPerPerson(b) ?? big));
    if (sortBy === "price-desc") list = [...list].sort((a, b) => (totalPerPerson(b) ?? 0) - (totalPerPerson(a) ?? 0));
    if (sortBy === "days") list = [...list].sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
    if (sortBy === "rating") list = [...list].sort((a, b) => ratingNum(b) - ratingNum(a));
    return list;
  }, [result, sortBy, freeCancel, minRating, needInc, flights]);

  const bestDeal = useMemo(() => {
    let best: TravelPackage | undefined;
    for (const p of filtered) {
      const total = totalPerPerson(p);
      if (total === undefined || total <= 0) continue;
      const per = total / (p.days || 1);
      const bestTotal = best ? totalPerPerson(best) : undefined;
      if (!best || bestTotal === undefined || per < bestTotal / (best.days || 1)) best = p;
    }
    return best;
  }, [filtered]);

  const grouped = useMemo(() => {
    const g: Record<string, TravelPackage[]> = {};
    for (const p of filtered) (g[p.source] ??= []).push(p);
    return g;
  }, [filtered]);

  const sources = Object.keys(grouped);

  function handleGetOffer(pkg: TravelPackage) {
    if (pkg.url) {
      toast.success(`Opening ${pkg.source} to grab your offer…`);
      window.open(pkg.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("No offer link available for this package");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-background to-orange-50">
      <Toaster position="top-center" richColors />

      <header className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="evening-sky absolute inset-0"
        />


        {/* Sun */}
        <div
          aria-hidden
          className="hero-sun evening-sun absolute right-10 top-6 h-16 w-16 rounded-full sm:right-24 sm:h-20 sm:w-20"
        />

        <div aria-hidden className="hero-birds pointer-events-none absolute top-10 left-0 text-foreground">
          <svg width="155" height="55" viewBox="0 0 155 55" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path className="bird-wing" d="M4 28 Q14 15 24 28 Q34 15 44 28" />
            <path className="bird-wing" d="M57 14 Q67 2 77 14 Q87 2 97 14" />
            <path className="bird-wing" d="M107 40 Q117 28 127 40 Q137 28 147 40" />
          </svg>
        </div>
        {/* Drifting clouds */}
        <div aria-hidden className="hero-cloud absolute top-8 opacity-70" style={{ animationDuration: "55s" }}>
          <Cloud className="h-10 w-10 text-white/80" />
        </div>
        <div
          aria-hidden
          className="hero-cloud absolute top-20 opacity-50"
          style={{ animationDuration: "75s", animationDelay: "-30s" }}
        >
          <Cloud className="h-7 w-7 text-white/70" />
        </div>

        {/* Family enjoying the beach; decorative illustration is hidden from assistive technology. */}
<div aria-hidden="true" className="hero-family pointer-events-none absolute bottom-[4.3rem] right-[4%] z-0">
  <svg viewBox="0 0 230 120" className="h-20 w-40 sm:h-28 sm:w-56" fill="none">
    <path d="M4 109 Q70 94 132 107 T226 103" stroke="#f7d794" strokeWidth="12" strokeLinecap="round"/>
    <circle cx="34" cy="35" r="10" fill="#b96d43"/><path d="M26 34 Q27 20 39 26 L44 35" fill="#4b3428"/>
    <path d="M21 47 L45 47 L40 92 L26 92 Z" fill="#f97316"/><path d="M27 56 L15 77 M39 56 L49 72 M29 91 L24 109 M39 91 L44 109" stroke="#b96d43" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="92" cy="44" r="11" fill="#d99a70"/><path d="M82 43 Q83 29 95 33 Q104 36 103 44" fill="#51392d"/>
    <path d="M80 57 L103 57 L100 99 L84 99 Z" fill="#0f766e"/><path d="M84 62 L70 80 M99 62 L112 77 M86 98 L80 111 M98 98 L104 111" stroke="#d99a70" strokeWidth="6" strokeLinecap="round"/>
    <circle cx="142" cy="66" r="8" fill="#b96d43"/><path d="M135 66 Q135 55 145 58 L150 66" fill="#4b3428"/>
    <path d="M134 76 L151 76 L148 102 L137 102 Z" fill="#facc15"/><path d="M137 80 L128 91 M147 80 L156 90 M138 101 L134 111 M148 101 L152 111" stroke="#b96d43" strokeWidth="5" strokeLinecap="round"/>
    <path d="M174 92 L174 42" stroke="#a16207" strokeWidth="3"/><path d="M174 42 L208 67 L174 67 Z" fill="#fb7185"/>
  </svg>
</div>

{/* Sea + sailing ship */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24">
          <div
            className="hero-wave absolute inset-x-0 bottom-0 h-16 opacity-80"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='64' viewBox='0 0 600 64'%3E%3Cpath d='M0 32 Q75 8 150 32 T300 32 T450 32 T600 32 V64 H0 Z' fill='%230ea5e9' fill-opacity='0.55'/%3E%3C/svg%3E\")",
              animationDuration: "9s",
            }}
          />
          <div
            className="hero-wave absolute inset-x-0 bottom-0 h-10"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='40' viewBox='0 0 600 40'%3E%3Cpath d='M0 20 Q75 2 150 20 T300 20 T450 20 T600 20 V40 H0 Z' fill='%230284c7' fill-opacity='0.7'/%3E%3C/svg%3E\")",
              animationDuration: "6s",
            }}
          />
          {/* Ship */}
          <div className="hero-ship absolute bottom-6 left-0">
            <div className="hero-ship-bob">
              <svg width="110" height="80" viewBox="0 0 110 80" fill="none" aria-hidden>
                {/* sails */}
                <path d="M55 6 L55 44 L24 44 Z" fill="#ffffff" opacity="0.95" />
                <path d="M59 12 L59 44 L86 44 Z" fill="#fef3c7" opacity="0.95" />
                {/* mast */}
                <rect x="53.5" y="4" width="3" height="44" rx="1.5" fill="#7c2d12" />
                {/* flag */}
                <path d="M56 4 L74 8 L56 12 Z" fill="#ef4444" />
                {/* hull */}
                <path d="M14 48 L96 48 L84 66 L26 66 Z" fill="#9a3412" />
                <path d="M14 48 L96 48 L92 56 L18 56 Z" fill="#c2410c" />
                {/* portholes */}
                <circle cx="40" cy="57" r="3" fill="#fde68a" />
                <circle cx="55" cy="57" r="3" fill="#fde68a" />
                <circle cx="70" cy="57" r="3" fill="#fde68a" />
              </svg>
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-14 text-white">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
            <Plane className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">PackCompare</span>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight drop-shadow sm:text-5xl">
            One search. <span className="text-yellow-200">Every holiday package.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/90">
            Compare deals from MakeMyTrip, Holidify, Yatra and more — side by side. Filter by
            destination, dates, budget and cancellation terms, then jump straight to the offer.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              <Palmtree className="h-3.5 w-3.5" /> Beach getaways
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              <Compass className="h-3.5 w-3.5" /> Adventure trips
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Compare travel offers
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Card className="-mt-10 border-primary/20 bg-card/95 shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Plan your trip
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <Label htmlFor="place" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Destination
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="place"
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="e.g. Goa, Bali, Manali"
                  aria-invalid={!!fieldErrors.place}
                  className={fieldErrors.place ? "border-destructive" : ""}
                />
                {fieldErrors.place && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.place}</p>
                )}
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="from" className="flex items-center gap-1.5">
                  <Plane className="h-3.5 w-3.5" /> Starting city
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="e.g. Delhi, Mumbai"
                  aria-invalid={!!fieldErrors.from}
                  className={fieldErrors.from ? "border-destructive" : ""}
                />
                {fieldErrors.from && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.from}</p>
                )}
              </div>
              <div>
                <Label htmlFor="days" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Days
                  <span className="text-destructive">*</span>
                </Label>
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger id="days" aria-invalid={!!fieldErrors.days} className={fieldErrors.days ? "border-destructive" : ""}>
                    <SelectValue placeholder="Choose duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days / 2 nights</SelectItem>
                    <SelectItem value="4">4 days / 2 nights</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.days && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.days}</p>
                )}
              </div>
              <div>
                <Label htmlFor="travelers" className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" /> Travelers
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="travelers"
                  type="number"
                  min={1}
                  max={20}
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  aria-invalid={!!fieldErrors.travelers}
                  className={fieldErrors.travelers ? "border-destructive" : ""}
                />
                {fieldErrors.travelers && <p className="mt-1 text-xs text-destructive">{fieldErrors.travelers}</p>}
              </div>
              <div>
                <Label htmlFor="month" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Month
                </Label>
                <Input
                  id="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="e.g. December"
                />
              </div>
              <div>
                <Label htmlFor="budget" className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Max budget (₹)
                </Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label htmlFor="travelDate" className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Travel date
                </Label>
                <Input
                  id="travelDate"
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Palmtree className="h-3.5 w-3.5" /> Trip type
                </Label>
                <Select value={tripType} onValueChange={setTripType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="honeymoon">Honeymoon</SelectItem>
                    <SelectItem value="adventure">Adventure</SelectItem>
                    <SelectItem value="beach">Beach</SelectItem>
                    <SelectItem value="wildlife">Wildlife</SelectItem>
                    <SelectItem value="pilgrimage">Pilgrimage</SelectItem>
                    <SelectItem value="group">Group tour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" /> Hotel star
                </Label>
                <Select value={hotelStars} onValueChange={setHotelStars}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 star</SelectItem>
                    <SelectItem value="4">4 star</SelectItem>
                    <SelectItem value="5">5 star</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Meal plan
                </Label>
                <Select value={mealPlan} onValueChange={setMealPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast only">Breakfast only</SelectItem>
                    <SelectItem value="breakfast and dinner">Breakfast &amp; dinner</SelectItem>
                    <SelectItem value="all meals">All meals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="flight-preference" className="flex items-center gap-1.5"><Plane className="h-3.5 w-3.5" /> Flights</Label>
                <Select value={flights} onValueChange={(value) => setFlights(value as typeof flights)}>
                  <SelectTrigger id="flight-preference" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any flight option</SelectItem>
                    <SelectItem value="included">Flight inclusive</SelectItem>
                    <SelectItem value="excluded">Flight exclusive (land only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 lg:col-span-6">
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                  className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-orange-500 text-white shadow-lg transition-transform hover:scale-[1.01] hover:from-sky-600 hover:via-cyan-600 hover:to-orange-600 sm:w-auto"
                >
                  {loading ? "Comparing packages…" : "✈  Compare packages"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-full" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && !loading && (
          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-semibold">
                {result.packages.length} package{result.packages.length === 1 ? "" : "s"} for{" "}
                <span className="bg-gradient-to-r from-sky-600 to-orange-500 bg-clip-text text-transparent">
                  {result.place}
                </span>
              </h2>
              {result.errors.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Couldn't fetch: {result.errors.map((e) => e.source).join(", ")}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-muted-foreground">Provider-listed prices, not confirmed booking quotes. Dates, travelers and flight choices may need selecting again on the provider’s page.</p>

            {result.packages.length > 0 && (
              <Card className="mt-4">
                <CardContent className="flex flex-wrap items-center gap-4 py-4 text-sm">
                  <label className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" /> Sort
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="rounded-md border bg-background px-2 py-1"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="price-asc">Price: low to high</option>
                      <option value="price-desc">Price: high to low</option>
                      <option value="days">Longest trip</option>
                      <option value="rating">Top rated</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" /> Min rating
                    <select
                      value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="rounded-md border bg-background px-2 py-1"
                    >
                      <option value={0}>Any</option>
                      <option value={3}>3+</option>
                      <option value={4}>4+</option>
                      <option value={4.5}>4.5+</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <Plane className="h-4 w-4 text-muted-foreground" /> Flights
                    <select
                      value={flights}
                      onChange={(e) => setFlights(e.target.value as typeof flights)}
                      className="rounded-md border bg-background px-2 py-1"
                    >
                      <option value="any">Any</option>
                      <option value="included">Inclusive</option>
                      <option value="excluded">Exclusive</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFreeCancel((v) => !v)}
                    className={`rounded-full border px-3 py-1 transition ${freeCancel ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    Free cancellation
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    {Object.keys(INC_PATTERNS).map((inc) => {
                      const on = needInc.includes(inc);
                      return (
                        <button
                          key={inc}
                          type="button"
                          onClick={() =>
                            setNeedInc((l) => (on ? l.filter((x) => x !== inc) : [...l, inc]))
                          }
                          className={`rounded-full border px-3 py-1 transition ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        >
                          {inc}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {bestDeal && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-400 bg-amber-400/10 p-4">
                <Trophy className="h-6 w-6 text-amber-500" />
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Lowest disclosed tax-inclusive price / day
                  </div>
                  <div className="font-medium">
                    {bestDeal.title} — {inr(totalPerPerson(bestDeal) ?? 0)} / person on {bestDeal.source}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleGetOffer(bestDeal)} disabled={!bestDeal.url}>
                  <Tag className="mr-1 h-4 w-4" /> {bestDeal.linkType === "package" ? "Get Offer" : "View provider listing"}
                </Button>
              </div>
            )}

            {filtered.length === 0 ? (
              <Card className="mt-4">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No packages match. Try a different destination or loosen your filters.
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/70 p-1.5">
                  <TabsTrigger
                    value="all"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-sky-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
                  >
                    All ({filtered.length})
                  </TabsTrigger>
                  {sources.map((s) => {
                    const st = styleFor(s);
                    return (
                      <TabsTrigger key={s} value={s} className={st.tab}>
                        <span className={`mr-2 inline-block h-2 w-2 rounded-full ${st.dot}`} />
                        {s} ({grouped[s].length})
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="all" className="mt-4">
                  <PackageGrid packages={filtered} best={bestDeal} onGetOffer={handleGetOffer} />
                </TabsContent>
                {sources.map((s) => (
                  <TabsContent key={s} value={s} className="mt-4">
                    <PackageGrid packages={grouped[s]} best={bestDeal} onGetOffer={handleGetOffer} />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-muted-foreground">
        Data scraped in real time. Prices and availability shown are indicative — always confirm on
        the provider's site.
      </footer>
    </div>
  );
}

const INC_PATTERNS: Record<string, string> = {
  Flights: "flight|air",
  Hotel: "hotel|stay|accommodation|resort",
  Meals: "meal|breakfast|dinner|lunch",
  Transfers: "transfer|cab|pickup|transport",
  Sightseeing: "sightseeing|tour|excursion",
};

function ratingNum(p: TravelPackage) {
  const m = (p.rating ?? "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

function PackageGrid({
  packages,
  best,
  onGetOffer,
}: {
  packages: TravelPackage[];
  best?: TravelPackage;
  onGetOffer: (p: TravelPackage) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {packages.map((p, i) => {
        const st = styleFor(p.source);
        const isBest = p === best;
        return (
          <Card
            key={`${p.source}-${i}`}
            onClick={(event) => { if (p.url && !(event.target as HTMLElement).closest("a,button")) onGetOffer(p); }}
            className={`group relative flex flex-col ${p.url ? "cursor-pointer" : ""} overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${isBest ? "ring-2 ring-amber-400" : st.ring}`}
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${st.dot}`} />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Badge className={st.badge}>{p.source}</Badge>
                  {isBest && (
                    <Badge className="bg-amber-400 text-amber-950 hover:bg-amber-400">
                      <Trophy className="mr-1 h-3 w-3" /> Best deal
                    </Badge>
                  )}
                </div>

              </div>
              <CardTitle className="text-base leading-snug">
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:underline"
                  >
                    {p.title}
                  </a>
                ) : (
                  p.title
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-2 text-sm">
              <PackagePrice packageData={p} travelers={Number(travelers) || 2} />
              <div className="flex items-center gap-1.5 text-muted-foreground"><Plane className="h-3.5 w-3.5" />
                {flightStatus(p) === "included" ? "Flights included" : flightStatus(p) === "excluded" ? "Flights excluded" : "Flight inclusion not disclosed"}
              </div>
              {p.duration && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {p.duration}
                </div>
              )}
              {p.rating && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {p.rating}
                </div>
              )}
              {p.highlights && <p className="text-muted-foreground">{p.highlights}</p>}
              {p.inclusions && p.inclusions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.inclusions.slice(0, 6).map((inc, j) => (
                    <Badge key={j} variant="outline" className="font-normal">
                      {inc}
                    </Badge>
                  ))}
                </div>
              )}
              {p.cancellation && (
                <div className="rounded bg-muted p-2 text-xs">
                  <span className="font-medium">Cancellation: </span>
                  {p.cancellation}
                </div>
              )}
              <div className="mt-auto flex gap-2 pt-3">
                <Button
                  onClick={() => onGetOffer(p)}
                  disabled={!p.url}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white shadow hover:from-orange-600 hover:to-red-600"
                  size="sm"
                >
                  <Tag className="mr-1 h-4 w-4" /> {p.linkType === "package" ? "Get Offer" : "View provider listing"}
                </Button>
                {p.url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={p.url} target="_blank" rel="noreferrer noopener">
                      View <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PackagePrice({ packageData: p, travelers }: { packageData: TravelPackage; travelers: number }) {
  const base = perPersonPrice(p);
  const total = totalPerPerson(p);
  const unit = total ?? base;
  const tripTotal = unit !== undefined ? unit * travelers : undefined;
  const tax = total !== undefined && base !== undefined ? total - base : undefined;
  return (
    <div className="space-y-1 border-y border-border py-3">
      <p className="text-xs text-muted-foreground">{p.quoteType === "from" ? "Starting price" : "Provider-listed price"}</p>
      <p className="text-xl font-bold text-accent">{tripTotal !== undefined ? inr(tripTotal) : p.price || "Price on request"}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{tripTotal !== undefined ? "total for " + travelers + " traveler" + (travelers === 1 ? "" : "s") : p.priceBasis === "group" ? " / group" + (p.quotedTravelers ? " of " + p.quotedTravelers : "") : " · provider price basis not confirmed"}</span>
      </p>
      {base !== undefined && <p className="text-sm font-medium">Approx. {inr(unit!)} / person × {travelers}</p>}
      <p className="text-xs text-muted-foreground">{p.taxStatus === "included" ? "GST / taxes included" : p.taxStatus === "excluded" ? "GST / taxes extra" : "GST / tax inclusion not disclosed"}</p>
      {p.taxLabel && <p className="text-xs text-muted-foreground">{p.taxLabel}</p>}
      {tax !== undefined && tax > 0 && <p className="text-xs">Taxes: {inr(tax)} / person</p>}
      <p className="text-xs text-muted-foreground">Provider price basis: {p.priceBasis === "per-person" ? "per person" : p.priceBasis === "group" ? "group" + (p.quotedTravelers ? " of " + p.quotedTravelers : "") : "not disclosed"}.</p>
      {p.priceEvidence && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Source price details</summary><p className="mt-1">{p.priceEvidence}</p></details>}
      {p.checkedAt && <p className="text-xs text-muted-foreground">Checked {new Date(p.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>}
      <p className="text-xs text-muted-foreground">Estimated total for your selected travelers when a per-person price is disclosed. Confirm the final quote on the provider site.</p>
    </div>
  );
}
