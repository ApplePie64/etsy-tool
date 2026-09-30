import { ARCHETYPES, type ModelId, type SellerProfile } from "../sellers/archetypes";

/** Visits by source, matching the traffic sources in Etsy Stats. */
export interface TrafficSources {
  etsySearch: number;
  etsyApp: number;
  etsyAds: number;
  etsyMarketing: number;
  social: number;
  direct: number;
}

export const SOURCE_LABELS: Record<keyof TrafficSources, string> = {
  etsySearch: "Etsy search",
  etsyApp: "Etsy app & other Etsy pages",
  etsyAds: "Etsy Ads",
  etsyMarketing: "Etsy marketing & SEO (offsite)",
  social: "Social media",
  direct: "Direct & other",
};

export const SOURCE_KEYS = Object.keys(SOURCE_LABELS) as (keyof TrafficSources)[];

export interface WeekStats {
  id: string;
  /** ISO date (YYYY-MM-DD) of the first day of the week. */
  weekStart: string;
  visits: number;
  views: number;
  favorites: number;
  orders: number;
  revenue: number;
  adSpend?: number;
  adRevenue?: number;
  sources?: Partial<TrafficSources>;
}

export interface WeekMetrics extends WeekStats {
  conversionRate: number;
  aov: number;
  revenuePerVisit: number;
  viewsPerVisit: number;
  favoriteRate: number;
  roas: number | null;
}

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function computeMetrics(w: WeekStats): WeekMetrics {
  return {
    ...w,
    conversionRate: safeDiv(w.orders, w.visits),
    aov: safeDiv(w.revenue, w.orders),
    revenuePerVisit: safeDiv(w.revenue, w.visits),
    viewsPerVisit: safeDiv(w.views, w.visits),
    favoriteRate: safeDiv(w.favorites, w.visits),
    roas: w.adSpend && w.adSpend > 0 && w.adRevenue !== undefined ? w.adRevenue / w.adSpend : null,
  };
}

export function sortWeeks(weeks: WeekStats[]): WeekStats[] {
  return [...weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** Relative change, or null when there's no baseline. */
export function pctChange(cur: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return (cur - prev) / prev;
}

/** Sums a run of weeks into one period so rates are computed on totals. */
export function aggregate(weeks: WeekStats[]): WeekMetrics | null {
  if (weeks.length === 0) return null;
  const sources: Partial<TrafficSources> = {};
  let hasSources = false;
  let adSpend = 0;
  let adRevenue = 0;
  let hasAds = false;
  let hasAdRevenue = false;
  for (const w of weeks) {
    if (w.sources) {
      hasSources = true;
      for (const k of SOURCE_KEYS) {
        const v = w.sources[k];
        if (v !== undefined) sources[k] = (sources[k] ?? 0) + v;
      }
    }
    if (w.adSpend !== undefined) {
      hasAds = true;
      adSpend += w.adSpend;
    }
    if (w.adRevenue !== undefined) {
      hasAdRevenue = true;
      adRevenue += w.adRevenue;
    }
  }
  const sum = (k: "visits" | "views" | "favorites" | "orders" | "revenue") => weeks.reduce((s, w) => s + (w[k] || 0), 0);
  return computeMetrics({
    id: `agg-${weeks[0]!.weekStart}`,
    weekStart: weeks[0]!.weekStart,
    visits: sum("visits"),
    views: sum("views"),
    favorites: sum("favorites"),
    orders: sum("orders"),
    revenue: sum("revenue"),
    adSpend: hasAds ? adSpend : undefined,
    adRevenue: hasAdRevenue ? adRevenue : undefined,
    sources: hasSources ? sources : undefined,
  });
}

export interface SourceShare {
  key: keyof TrafficSources;
  label: string;
  visits: number;
  share: number;
}

export function sourceShares(sources: Partial<TrafficSources> | undefined): SourceShare[] {
  if (!sources) return [];
  const total = SOURCE_KEYS.reduce((s, k) => s + (sources[k] ?? 0), 0);
  if (total <= 0) return [];
  return SOURCE_KEYS.map((k) => ({
    key: k,
    label: SOURCE_LABELS[k],
    visits: sources[k] ?? 0,
    share: (sources[k] ?? 0) / total,
  })).sort((a, b) => b.visits - a.visits);
}

export interface StatsSummary {
  weeks: WeekMetrics[];
  latest: WeekMetrics | null;
  previous: WeekMetrics | null;
  /** Latest vs previous week. */
  wow: {
    visits: number | null;
    orders: number | null;
    revenue: number | null;
    conversionRate: number | null;
    aov: number | null;
  };
  /** Up to the last 4 weeks, aggregated, and the 4 before that. */
  last4: WeekMetrics | null;
  prior4: WeekMetrics | null;
  trend4: { visits: number | null; orders: number | null; revenue: number | null };
}

export function summarize(weeksIn: WeekStats[]): StatsSummary {
  const sorted = sortWeeks(weeksIn);
  const weeks = sorted.map(computeMetrics);
  const latest = weeks.at(-1) ?? null;
  const previous = weeks.at(-2) ?? null;
  const last4 = aggregate(sorted.slice(-4));
  const prior4 = sorted.length > 4 ? aggregate(sorted.slice(-8, -4)) : null;
  const ch = (k: keyof WeekMetrics) =>
    latest && previous ? pctChange(latest[k] as number, previous[k] as number) : null;
  // Compare per-week averages so a short prior period doesn't skew the trend.
  const perWeek = (m: WeekMetrics | null, n: number, k: "visits" | "orders" | "revenue") => (m ? m[k] / n : 0);
  const n4 = Math.min(4, sorted.length);
  const nPrior = Math.max(0, Math.min(4, sorted.length - 4));
  const t = (k: "visits" | "orders" | "revenue") =>
    prior4 && nPrior > 0 ? pctChange(perWeek(last4, n4, k), perWeek(prior4, nPrior, k)) : null;
  return {
    weeks,
    latest,
    previous,
    wow: {
      visits: ch("visits"),
      orders: ch("orders"),
      revenue: ch("revenue"),
      conversionRate: ch("conversionRate"),
      aov: ch("aov"),
    },
    last4,
    prior4,
    trend4: { visits: t("visits"), orders: t("orders"), revenue: t("revenue") },
  };
}

export type Severity = "critical" | "warning" | "info" | "good";
export type FindingArea = "traffic" | "conversion" | "seo" | "ads" | "pricing" | "customer";

export interface Finding {
  id: string;
  severity: Severity;
  area: FindingArea;
  title: string;
  detail: string;
  actions: string[];
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2, good: 3 };

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const money = (x: number) =>
  x >= 1000 ? `$${Math.round(x).toLocaleString("en-US")}` : `$${x.toFixed(2).replace(/\.00$/, "")}`;

/** Visits over this many make a conversion rate worth judging. */
export const MIN_VISITS_FOR_CR = 100;

export interface DiagnoseOptions {
  profile?: Pick<SellerProfile, "model" | "margin" | "activeListings">;
  /** Average SEO score from a bulk audit, if one was run. */
  seoAverage?: number;
}

/**
 * Turns the weekly numbers into findings a seller can act on. Rates are judged
 * on the last four weeks combined so one quiet week doesn't trigger alarms.
 */
export function diagnose(weeksIn: WeekStats[], opts: DiagnoseOptions = {}): Finding[] {
  const s = summarize(weeksIn);
  const out: Finding[] = [];
  const model: ModelId = opts.profile?.model ?? "handmade";
  const bench = ARCHETYPES[model];
  const margin = opts.profile?.margin && opts.profile.margin > 0 ? opts.profile.margin : 0.35;
  const { latest, previous, last4 } = s;

  if (!latest || !last4) {
    return [
      {
        id: "no-data",
        severity: "info",
        area: "traffic",
        title: "Add your first week of stats",
        detail: "Copy visits, orders, revenue and traffic sources from Shop Manager → Stats for the last 7 days.",
        actions: ["Open Shop Manager → Stats, set the range to the last 7 days, and enter the numbers here."],
      },
    ];
  }

  const nWeeks = Math.min(4, s.weeks.length);
  const weeklyVisits = last4.visits / nWeeks;

  // Traffic volume
  const listings = opts.profile?.activeListings ?? 0;
  if (weeklyVisits < 50) {
    out.push({
      id: "low-traffic",
      severity: weeklyVisits < 20 ? "critical" : "warning",
      area: "traffic",
      title: "Very few shoppers are finding the shop",
      detail: `About ${Math.round(weeklyVisits)} visits a week${listings ? ` across ${listings} listings` : ""}. At this level the problem is visibility, not persuasion.`,
      actions: [
        listings && listings < 20 ? `Add listings — ${listings} is a small footprint; aim for 20–30.` : "Add new listings or variations of your best seller each week.",
        "Run the SEO Lab on every listing: 13 multi-word tags, keyword at the start of the title.",
        "Fill every attribute and pick the most specific category.",
        "Share each listing on Pinterest with a keyword-rich pin description.",
      ],
    });
  } else if (listings > 0 && weeklyVisits / listings < 1) {
    out.push({
      id: "thin-traffic-per-listing",
      severity: "warning",
      area: "traffic",
      title: "Most listings get almost no traffic",
      detail: `${(weeklyVisits / listings).toFixed(1)} visits per listing per week. A few listings probably carry the shop.`,
      actions: [
        "Sort listings by views in Stats and rewrite titles and tags on the bottom half.",
        "Retire or merge listings that got no views in 90 days.",
      ],
    });
  }

  // Week-over-week traffic movement
  if (previous && previous.visits >= 30 && s.wow.visits !== null) {
    if (s.wow.visits <= -0.2) {
      const drops = latest.sources && previous.sources
        ? SOURCE_KEYS.map((k) => ({ k, d: (latest.sources?.[k] ?? 0) - (previous.sources?.[k] ?? 0) })).sort((a, b) => a.d - b.d)
        : [];
      const worst = drops[0] && drops[0].d < 0 ? drops[0] : null;
      const actions = [
        "Check for expired or sold-out listings (Shop Manager → Listings → Expired / Sold out).",
        "Compare with the same week last year — seasonality explains most swings.",
      ];
      if (worst?.k === "etsyAds") actions.unshift("Etsy Ads traffic fell most — check whether your budget ran out or ads were paused.");
      if (worst?.k === "etsySearch") actions.unshift("Etsy search traffic fell most — recheck titles/tags on top listings and whether competitors updated theirs.");
      if (worst?.k === "social") actions.unshift("Social traffic fell most — a post that drove last week's visits probably stopped circulating.");
      out.push({
        id: "traffic-drop",
        severity: s.wow.visits <= -0.4 ? "critical" : "warning",
        area: "traffic",
        title: `Visits fell ${pct(-s.wow.visits, 0)} week over week`,
        detail: worst ? `Biggest drop: ${SOURCE_LABELS[worst.k]} (${worst.d} visits).` : "Add traffic sources to see where the drop came from.",
        actions,
      });
    } else if (s.wow.visits >= 0.2) {
      out.push({
        id: "traffic-up",
        severity: "good",
        area: "traffic",
        title: `Visits up ${pct(s.wow.visits, 0)} week over week`,
        detail: "Find out what changed (new listing, a pin, a feature) and repeat it.",
        actions: ["Note what you changed last week so you can repeat it."],
      });
    }
  }

  // Conversion (judged on 4-week totals)
  if (last4.visits >= MIN_VISITS_FOR_CR) {
    const cr = last4.conversionRate;
    if (cr < bench.conversion.low) {
      const fav = last4.favoriteRate;
      out.push({
        id: "low-conversion",
        severity: cr < bench.conversion.low / 2 ? "critical" : "warning",
        area: "conversion",
        title: `Conversion ${pct(cr)} is below the ${pct(bench.conversion.low, 1)}–${pct(bench.conversion.high, 1)} typical for ${bench.name.toLowerCase()} shops`,
        detail: `${last4.orders} orders from ${last4.visits} visits over the last ${nWeeks} week(s). Shoppers arrive but don't buy.`,
        actions: [
          "Make photo 1 bright, clear, and on a simple background. Add scale and lifestyle shots.",
          "Compare your price and shipping with the top 5 results for your main keyword.",
          "Answer the common questions (size, materials, timing) in the first lines of the description.",
          fav >= 0.08
            ? "Shoppers favourite but don't buy: turn on targeted offers to favouriters and abandoned carts (Marketing → Sales and discounts)."
            : "Check that shop policies, About section and reviews build trust.",
        ],
      });
    } else if (cr >= bench.conversion.high) {
      out.push({
        id: "strong-conversion",
        severity: "good",
        area: "conversion",
        title: `Strong conversion: ${pct(cr)}`,
        detail: `Above the typical ${pct(bench.conversion.high, 1)} for ${bench.name.toLowerCase()} shops. Your listings persuade; more traffic will pay off.`,
        actions: [
          "Test a 5–10% price increase on your best seller.",
          "Put a small Etsy Ads budget behind your best converters.",
        ],
      });
    }
  } else {
    out.push({
      id: "cr-sample",
      severity: "info",
      area: "conversion",
      title: "Not enough visits to judge conversion yet",
      detail: `${last4.visits} visits in the last ${nWeeks} week(s). Conversion rates swing wildly under ~${MIN_VISITS_FOR_CR} visits.`,
      actions: ["Focus on traffic first; revisit conversion when you pass 100 visits in 4 weeks."],
    });
  }

  // Browsing depth
  if (last4.visits >= 50 && last4.views > 0 && last4.viewsPerVisit < 1.5) {
    out.push({
      id: "shallow-browsing",
      severity: "info",
      area: "conversion",
      title: "Shoppers view one listing and leave",
      detail: `${last4.viewsPerVisit.toFixed(2)} listing views per visit.`,
      actions: [
        "Organise listings into shop sections and feature your best 4 on the shop home.",
        "Link related items in descriptions and create matching sets or bundles.",
      ],
    });
  }

  // Order value
  if (last4.orders >= 3 && last4.aov < bench.aov.low) {
    out.push({
      id: "low-aov",
      severity: "info",
      area: "pricing",
      title: `Average order ${money(last4.aov)} is on the low side`,
      detail: `${bench.name} shops typically see ${money(bench.aov.low)}–${money(bench.aov.high)} per order. Fixed fees hit small orders hardest.`,
      actions: [
        "Create bundles or multi-packs of your best seller.",
        "Run a \"buy 2, save 10%\" sale, or set free shipping at a threshold just above your average order.",
      ],
    });
  }

  // Traffic mix
  const shares = sourceShares(last4.sources);
  if (shares.length) {
    const share = (k: keyof TrafficSources) => shares.find((x) => x.key === k)?.share ?? 0;
    if (share("etsySearch") < 0.25) {
      out.push({
        id: "weak-search",
        severity: "warning",
        area: "seo",
        title: `Only ${pct(share("etsySearch"), 0)} of visits come from Etsy search`,
        detail: "Healthy shops usually get a large part of their traffic from search. Yours may not rank for the phrases buyers use.",
        actions: [
          "Run your listings through the SEO Lab and fix the priority items.",
          "Check the \"How shoppers found you\" search terms in Stats and put the converting ones into titles.",
        ],
      });
    }
    if (share("etsyAds") > 0.4) {
      out.push({
        id: "ads-dependence",
        severity: "warning",
        area: "ads",
        title: `${pct(share("etsyAds"), 0)} of visits are paid Etsy Ads clicks`,
        detail: "If the ads stop, most of your traffic stops with them.",
        actions: ["Improve organic SEO on the listings you advertise so they rank without ads.", "Check that ads are profitable (see ROAS)."],
      });
    }
    if (share("social") >= 0.2) {
      out.push({
        id: "social-strength",
        severity: "good",
        area: "traffic",
        title: `Social brings ${pct(share("social"), 0)} of visits`,
        detail: "You have an audience of your own. That's resilient traffic Etsy's algorithm can't take away.",
        actions: ["Keep a steady posting rhythm and link straight to listings."],
      });
    }
  }

  // Ads profitability
  if (last4.adSpend && last4.adSpend > 0) {
    const breakEven = 1 / margin;
    if (last4.roas === null) {
      out.push({
        id: "ads-unknown",
        severity: "info",
        area: "ads",
        title: "Track revenue from ads",
        detail: `You spent ${money(last4.adSpend)} on Etsy Ads. Add ad revenue from the Advertising dashboard to see if it pays.`,
        actions: ["Marketing → Etsy Ads shows spend, orders and revenue from ads."],
      });
    } else if (last4.roas < breakEven) {
      out.push({
        id: "ads-unprofitable",
        severity: "critical",
        area: "ads",
        title: `Etsy Ads are losing money (ROAS ${last4.roas.toFixed(1)}×)`,
        detail: `With a ${pct(margin, 0)} margin you need at least ${breakEven.toFixed(1)}× return to break even.`,
        actions: [
          "Turn off ads on listings with clicks but no orders after 30 days.",
          "Lower the daily budget and keep ads only on your best converters.",
        ],
      });
    } else if (last4.roas < breakEven * 1.5) {
      out.push({
        id: "ads-thin",
        severity: "warning",
        area: "ads",
        title: `Etsy Ads roughly break even (ROAS ${last4.roas.toFixed(1)}×)`,
        detail: `Break-even for your margin is ${breakEven.toFixed(1)}×. Ads bring customers but little profit.`,
        actions: ["Prune the listings with the worst click-to-order ratio from the ad campaign."],
      });
    } else {
      out.push({
        id: "ads-profitable",
        severity: "good",
        area: "ads",
        title: `Etsy Ads are profitable (ROAS ${last4.roas.toFixed(1)}×)`,
        detail: `Comfortably above your ${breakEven.toFixed(1)}× break-even.`,
        actions: ["Raise the budget in small steps while ROAS stays above break-even."],
      });
    }
  }

  // Four-week revenue trend
  if (s.trend4.revenue !== null) {
    if (s.trend4.revenue <= -0.15) {
      out.push({
        id: "revenue-trend-down",
        severity: "warning",
        area: "pricing",
        title: `Revenue down ${pct(-s.trend4.revenue, 0)} vs the previous 4 weeks`,
        detail: "A sustained decline, not just one slow week.",
        actions: ["Check whether traffic or conversion fell — the fix differs.", "Review seasonality for your category."],
      });
    } else if (s.trend4.revenue >= 0.15) {
      out.push({
        id: "revenue-trend-up",
        severity: "good",
        area: "pricing",
        title: `Revenue up ${pct(s.trend4.revenue, 0)} vs the previous 4 weeks`,
        detail: "Momentum is building.",
        actions: ["Make sure stock and production can keep up."],
      });
    }
  }

  if (opts.seoAverage !== undefined && opts.seoAverage < 70) {
    out.push({
      id: "seo-average",
      severity: opts.seoAverage < 55 ? "critical" : "warning",
      area: "seo",
      title: `Average listing SEO score is ${opts.seoAverage}/100`,
      detail: "Many listings are missing easy search wins.",
      actions: ["Start with the lowest-scoring listings in the bulk audit and fix the most common issue across the shop."],
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export interface HealthComponent {
  id: "seo" | "conversion" | "momentum" | "search";
  label: string;
  score: number;
  note: string;
}

export interface ShopHealth {
  score: number | null;
  components: HealthComponent[];
}

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * One 0–100 number built only from the parts we have data for. Each
 * component is shown alongside it so the score is never a black box.
 */
export function shopHealth(weeks: WeekStats[], opts: DiagnoseOptions = {}): ShopHealth {
  const s = summarize(weeks);
  const bench = ARCHETYPES[opts.profile?.model ?? "handmade"];
  const components: HealthComponent[] = [];

  if (opts.seoAverage !== undefined) {
    components.push({ id: "seo", label: "Listing SEO", score: clamp(opts.seoAverage), note: `Average audit score ${opts.seoAverage}/100` });
  }
  if (s.last4 && s.last4.visits >= MIN_VISITS_FOR_CR) {
    const cr = s.last4.conversionRate;
    components.push({
      id: "conversion",
      label: "Conversion",
      score: Math.round(clamp((cr / bench.conversion.high) * 85)),
      note: `${pct(cr)} vs typical ${pct(bench.conversion.low, 1)}–${pct(bench.conversion.high, 1)}`,
    });
  }
  const momentum = s.trend4.visits ?? s.wow.visits;
  if (momentum !== null) {
    components.push({
      id: "momentum",
      label: "Traffic momentum",
      score: Math.round(clamp(60 + momentum * 133)),
      note: `${momentum >= 0 ? "+" : ""}${pct(momentum, 0)} ${s.trend4.visits !== null ? "vs previous 4 weeks" : "week over week"}`,
    });
  }
  const shares = sourceShares(s.last4?.sources);
  if (shares.length) {
    const search = shares.find((x) => x.key === "etsySearch")?.share ?? 0;
    const ads = shares.find((x) => x.key === "etsyAds")?.share ?? 0;
    // Search share of ~50%+ with modest ad reliance scores well.
    const sc = clamp(search * 160 - Math.max(0, ads - 0.3) * 100);
    components.push({ id: "search", label: "Organic search reach", score: Math.round(sc), note: `${pct(search, 0)} of visits from Etsy search` });
  }

  const score = components.length ? Math.round(components.reduce((a, c) => a + c.score, 0) / components.length) : null;
  return { score, components };
}
