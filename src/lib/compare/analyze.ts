import { containsAllWords, contentWords, phraseKey, titleSegments } from "../seo/keywords";
import { ETSY_LIMITS } from "../seo/rules";
import { ATTRIBUTE_LABELS, ATTRIBUTE_WHY, CATEGORY_ATTRIBUTES, detectCategory, extractAttributes, HIGH_IMPACT, type AttributeKey, type AttributeResult } from "./attributes";
import { EVIDENCE_FIELDS, RECOMMENDED_COMPETITORS, type Category, type CompareListing, type Evidence, type EvidenceField } from "./types";

/* ------------------------------------------------------------------ */
/* Field access — one definition shared by the UI, report and guard.   */
/* ------------------------------------------------------------------ */

/** Text of a listing field as evidence quotes are checked against; null if unknown. */
export function fieldText(l: CompareListing, field: EvidenceField): string | null {
  switch (field) {
    case "title":
      return l.title;
    case "tags":
      return l.tags ? l.tags.join(", ") : null;
    case "description":
      return l.description;
    case "notes":
      return l.notes;
    case "price":
      return l.price === null ? null : formatAmount(l.price);
    case "currency":
      return l.currency;
    case "photoCount":
      return l.photoCount === null ? null : String(l.photoCount);
    case "hasVideo":
      return l.hasVideo === null ? null : l.hasVideo ? "yes" : "no";
    case "reviewCount":
      return l.reviewCount === null ? null : String(l.reviewCount);
  }
}

export const FIELD_LABELS: Record<EvidenceField, string> = {
  title: "title",
  tags: "tags",
  description: "description",
  notes: "your notes",
  price: "price",
  currency: "currency",
  photoCount: "photo count",
  hasVideo: "video",
  reviewCount: "review count",
};

export function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Counts like a median photo count: "9.5", not "9.50". */
export const formatCount = (n: number) => String(Math.round(n * 10) / 10);

/** For display: "12,596" and "5.99". Evidence quotes keep formatAmount so they match the stored value. */
export function displayAmount(n: number): string {
  return n.toLocaleString("en-US", Number.isInteger(n) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return "Unknown";
  return `${displayAmount(price)} ${currency ?? "(currency unknown)"}`;
}

export function parseRef(ref: string): { listingId: string; field: EvidenceField } | null {
  const m = /^([a-z0-9]+)\.([A-Za-z]+)$/.exec(ref.trim());
  if (!m || !(EVIDENCE_FIELDS as readonly string[]).includes(m[2]!)) return null;
  return { listingId: m[1]!, field: m[2] as EvidenceField };
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/* ------------------------------------------------------------------ */
/* Price                                                               */
/* ------------------------------------------------------------------ */

export interface CurrencyGroup {
  currency: string;
  listings: { id: string; price: number }[];
  min: number;
  median: number;
  max: number;
}

export interface PriceAnalysis {
  groups: CurrencyGroup[];
  /** Competitors priced in the seller's currency. */
  comparable: { id: string; price: number }[];
  position: "below" | "within" | "above" | "no-comparison" | "unknown";
  /** 1 = cheapest among the seller and comparable competitors. */
  rank: number | null;
  /** Listings left out of the price comparison, and why. */
  excluded: { id: string; reason: string }[];
  mixedCurrencies: boolean;
}

export function analyzePrices(listings: CompareListing[]): PriceAnalysis {
  const mine = listings.find((l) => l.role === "mine");
  const excluded: PriceAnalysis["excluded"] = [];
  const byCur = new Map<string, { id: string; price: number }[]>();
  for (const l of listings) {
    if (l.price === null) {
      excluded.push({ id: l.id, reason: "price unknown" });
      continue;
    }
    if (!l.currency) {
      excluded.push({ id: l.id, reason: "currency unknown" });
      continue;
    }
    const g = byCur.get(l.currency) ?? [];
    g.push({ id: l.id, price: l.price });
    byCur.set(l.currency, g);
  }
  const groups: CurrencyGroup[] = [...byCur.entries()].map(([currency, ls]) => {
    const prices = ls.map((x) => x.price);
    return { currency, listings: ls, min: Math.min(...prices), median: median(prices)!, max: Math.max(...prices) };
  });

  const mixedCurrencies = groups.length > 1;
  if (!mine || mine.price === null || !mine.currency) {
    return { groups, comparable: [], position: "unknown", rank: null, excluded, mixedCurrencies };
  }
  for (const l of listings) {
    if (l.role === "competitor" && l.price !== null && l.currency && l.currency !== mine.currency) {
      excluded.push({ id: l.id, reason: `priced in ${l.currency}, not ${mine.currency} — no conversion applied` });
    }
  }
  const comparable = (byCur.get(mine.currency) ?? []).filter((x) => x.id !== mine.id);
  if (comparable.length === 0) {
    return { groups, comparable, position: "no-comparison", rank: null, excluded, mixedCurrencies };
  }
  const prices = comparable.map((x) => x.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const position = mine.price < lo ? "below" : mine.price > hi ? "above" : "within";
  const rank = 1 + prices.filter((p) => p < mine.price!).length;
  return { groups, comparable, position, rank, excluded, mixedCurrencies };
}

/* ------------------------------------------------------------------ */
/* Title / tag coverage                                                */
/* ------------------------------------------------------------------ */

export type CoverageStatus = "both" | "title" | "tags" | "none" | "unknown";

export interface CoverageTerm {
  term: string;
  byListing: Record<string, CoverageStatus>;
  /** Comparison listings whose title or known tags contain the phrase. */
  competitorCount: number;
}

export interface CoverageAnalysis {
  terms: CoverageTerm[];
  /** Phrases most comparison listings use and the seller's listing doesn't. */
  gaps: CoverageTerm[];
}

function coverageOf(l: CompareListing, term: string): CoverageStatus {
  const inTitle = containsAllWords(l.title, term);
  if (l.tags === null) return inTitle ? "title" : "unknown";
  const inTags = l.tags.some((t) => containsAllWords(t, term));
  return inTitle && inTags ? "both" : inTitle ? "title" : inTags ? "tags" : "none";
}

function candidatePhrases(l: CompareListing): string[] {
  const out: string[] = [];
  const add = (words: string[]) => {
    if (words.length >= 2 && words.length <= 4) out.push(words.join(" "));
  };
  for (const seg of titleSegments(l.title)) {
    const w = contentWords(seg);
    add(w);
    for (let n = 2; n <= 3; n++) for (let i = 0; i + n <= w.length; i++) add(w.slice(i, i + n));
  }
  for (const t of l.tags ?? []) add(contentWords(t));
  return out;
}

export function analyzeCoverage(listings: CompareListing[], max = 15): CoverageAnalysis {
  const mine = listings.find((l) => l.role === "mine");
  const competitors = listings.filter((l) => l.role === "competitor");
  const seen = new Map<string, string>();
  for (const l of listings) {
    for (const p of candidatePhrases(l)) {
      const k = phraseKey(p);
      if (k && !seen.has(k)) seen.set(k, p);
    }
  }
  const terms: CoverageTerm[] = [...seen.values()].map((term) => {
    const byListing: Record<string, CoverageStatus> = {};
    for (const l of listings) byListing[l.id] = coverageOf(l, term);
    const competitorCount = competitors.filter((c) => ["both", "title", "tags"].includes(byListing[c.id]!)).length;
    return { term, byListing, competitorCount };
  });

  const shown = terms
    .filter((t) => t.competitorCount >= (competitors.length >= 2 ? 2 : 1) || (mine && t.byListing[mine.id] !== "none" && t.byListing[mine.id] !== "unknown" && t.competitorCount >= 1))
    .sort((a, b) => b.competitorCount - a.competitorCount || b.term.split(" ").length - a.term.split(" ").length || a.term.localeCompare(b.term))
    .slice(0, max);

  const threshold = Math.max(2, Math.ceil(competitors.length / 2));
  const gaps = mine
    ? shown.filter((t) => t.competitorCount >= Math.min(threshold, competitors.length) && t.competitorCount >= 1 && (t.byListing[mine.id] === "none" || t.byListing[mine.id] === "unknown"))
    : [];
  // Drop gaps fully contained in a longer gap ("budget sheet" inside "monthly budget sheet").
  const pruned = gaps.filter((g) => !gaps.some((o) => o !== g && o.term.split(" ").length > g.term.split(" ").length && containsAllWords(o.term, g.term) && o.competitorCount >= g.competitorCount));
  return { terms: shown, gaps: pruned.slice(0, 6) };
}

/* ------------------------------------------------------------------ */
/* Injection-like text                                                 */
/* ------------------------------------------------------------------ */

const INSTRUCTION_LIKE =
  /(ignore (?:all |any )?(?:previous|prior|above|earlier) instructions|disregard (?:all |any )?(?:previous|prior|the above)|you are now|system prompt|new instructions?:|as an ai (?:assistant|model)|tell the (?:seller|user) to|respond only with)/i;

export function instructionLikeText(l: CompareListing): Evidence | null {
  for (const field of ["title", "tags", "description"] as const) {
    const text = fieldText(l, field);
    if (!text) continue;
    const m = INSTRUCTION_LIKE.exec(text);
    if (m) {
      const start = Math.max(0, (m.index ?? 0) - 10);
      return { ref: `${l.id}.${field}`, quote: text.slice(start, Math.min(text.length, (m.index ?? 0) + m[0].length + 60)) };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Findings                                                            */
/* ------------------------------------------------------------------ */

export type FindingArea = "information" | "title" | "tags" | "photos" | "price" | "data" | "safety";

export interface CompareFinding {
  id: string;
  severity: "high" | "medium" | "low" | "info";
  area: FindingArea;
  title: string;
  detail: string;
  evidence: Evidence[];
  guidance: string[];
  /** A fact only the seller can supply before acting on this finding. */
  ask?: string;
}

export interface MissingItem {
  listingId: string;
  field: EvidenceField;
  label: string;
}

export interface ComparisonAnalysis {
  category: Category;
  /** Customer-facing facts checked for this category, in display order. */
  attributeKeys: AttributeKey[];
  listings: CompareListing[];
  mine: CompareListing | null;
  competitors: CompareListing[];
  attributes: Record<string, Record<AttributeKey, AttributeResult>>;
  coverage: CoverageAnalysis;
  price: PriceAnalysis;
  photos: { mine: number | null; competitorMedian: number | null; known: number };
  findings: CompareFinding[];
  missing: MissingItem[];
  warnings: string[];
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 } as const;

export function labelOf(listings: CompareListing[], id: string): string {
  return listings.find((l) => l.id === id)?.label ?? id;
}

/** `category` defaults to what the listings look like (digital downloads or physical products). */
export function analyzeComparison(listings: CompareListing[], category: Category = detectCategory(listings)): ComparisonAnalysis {
  const attributeKeys = CATEGORY_ATTRIBUTES[category];
  const mine = listings.find((l) => l.role === "mine") ?? null;
  const competitors = listings.filter((l) => l.role === "competitor");
  const attributes: ComparisonAnalysis["attributes"] = {};
  for (const l of listings) attributes[l.id] = extractAttributes(l, category);
  const coverage = analyzeCoverage(listings);
  const price = analyzePrices(listings);
  const knownPhotos = competitors.map((c) => c.photoCount).filter((n): n is number => n !== null);
  const photos = { mine: mine?.photoCount ?? null, competitorMedian: median(knownPhotos), known: knownPhotos.length };
  const findings: CompareFinding[] = [];
  const warnings: string[] = [];
  const missing: MissingItem[] = [];

  for (const l of listings) {
    for (const f of EVIDENCE_FIELDS) {
      // Review counts are optional context, never something the seller is asked for.
      if (f === "title" || f === "reviewCount" || f === "notes") continue;
      if (fieldText(l, f) === null) missing.push({ listingId: l.id, field: f, label: `${l.label}: ${FIELD_LABELS[f]} unknown` });
    }
  }

  if (!mine) {
    warnings.push("Add your own listing to compare against.");
  }
  if (competitors.length === 0) {
    warnings.push("Add at least one comparison listing.");
  } else if (competitors.length < RECOMMENDED_COMPETITORS) {
    warnings.push(`Only ${competitors.length} comparison listing${competitors.length === 1 ? "" : "s"}. Add ${RECOMMENDED_COMPETITORS}–5 for a more reliable comparison.`);
  }

  if (mine) {
    // Missing customer-facing information
    if (mine.description === null) {
      findings.push({
        id: "mine-description-unknown",
        severity: "high",
        area: "data",
        title: "Add your description to check customer-facing details",
        detail: `Without your description we can't tell which ${attributeKeys.slice(0, 4).map((k) => ATTRIBUTE_LABELS[k].toLowerCase()).join(", ")} details you already state.`,
        evidence: [],
        guidance: [],
        ask: "Paste your listing description.",
      });
    }
    for (const key of attributeKeys) {
      const mineAttr = attributes[mine.id]![key];
      if (mineAttr.status !== "not_stated") continue;
      const stating = competitors.filter((c) => attributes[c.id]![key].status === "stated");
      if (stating.length === 0) continue;
      const values = [...new Set(stating.flatMap((c) => attributes[c.id]![key].values))].slice(0, 6);
      findings.push({
        id: `missing-${key}`,
        severity: stating.length >= Math.ceil(competitors.length / 2) ? (HIGH_IMPACT[category].includes(key) ? "high" : "medium") : "low",
        area: "information",
        title: `Your listing doesn't state its ${ATTRIBUTE_LABELS[key].toLowerCase()}`,
        detail: `${stating.length} of ${competitors.length} comparison listings do (${values.join(", ")}). This matters because ${ATTRIBUTE_WHY[key]}.`,
        evidence: stating.slice(0, 3).flatMap((c) => {
          const e = attributes[c.id]![key].evidence[0];
          return e ? [{ ref: `${c.id}.${e.field}`, quote: e.quote }] : [];
        }),
        guidance: ["search-ranking-signals"],
        ask: `What ${ATTRIBUTE_LABELS[key].toLowerCase()} does your product actually have? Add it only if it's true.`,
      });
    }

    // Title/tag coverage gaps
    if (coverage.gaps.length) {
      findings.push({
        id: "coverage-gaps",
        severity: "medium",
        area: "tags",
        title: "Phrases most comparison listings use that yours doesn't",
        detail: `${coverage.gaps.map((g) => `"${g.term}" (${g.competitorCount} of ${competitors.length})`).join(", ")}. Counts show how many of the listings you chose use a phrase — not how many shoppers search for it.`,
        evidence: coverage.gaps.slice(0, 3).flatMap((g) => {
          const c = competitors.find((x) => ["title", "both"].includes(g.byListing[x.id]!));
          return c ? [{ ref: `${c.id}.title`, quote: c.title }] : [];
        }),
        guidance: ["search-query-matching", "marketplace-insights"],
        ask: "Only use a phrase if it accurately describes your product. Check demand in Etsy's Marketplace Insights.",
      });
    }

    // Tags
    if (mine.tags === null) {
      findings.push({
        id: "mine-tags-unknown",
        severity: "medium",
        area: "data",
        title: "Add your tags",
        detail: "Your tags weren't provided, so tag coverage is unknown.",
        evidence: [],
        guidance: ["search-query-matching"],
        ask: "Paste your 13 tags (comma-separated).",
      });
    } else {
      const tooLong = mine.tags.filter((t) => t.length > ETSY_LIMITS.tagMaxChars);
      if (mine.tags.length < ETSY_LIMITS.tagCount) {
        findings.push({
          id: "mine-tag-count",
          severity: "medium",
          area: "tags",
          title: `You use ${mine.tags.length} of ${ETSY_LIMITS.tagCount} tags`,
          detail: `Each unused tag slot is a phrase your listing can't be matched on.`,
          evidence: [{ ref: `${mine.id}.tags`, quote: fieldText(mine, "tags")! }],
          guidance: ["search-query-matching"],
        });
      }
      if (tooLong.length) {
        findings.push({
          id: "mine-tag-length",
          severity: "high",
          area: "tags",
          title: "Some tags are longer than Etsy allows",
          detail: `${tooLong.map((t) => `"${t}"`).join(", ")} exceed ${ETSY_LIMITS.tagMaxChars} characters.`,
          evidence: tooLong.slice(0, 2).map((t) => ({ ref: `${mine.id}.tags`, quote: t })),
          guidance: ["search-query-matching"],
        });
      }
    }
    if (mine.title.length > ETSY_LIMITS.titleMaxChars) {
      findings.push({
        id: "mine-title-length",
        severity: "high",
        area: "title",
        title: "Title is longer than Etsy allows",
        detail: `${mine.title.length} characters; the limit is ${ETSY_LIMITS.titleMaxChars}.`,
        evidence: [{ ref: `${mine.id}.title`, quote: mine.title }],
        guidance: ["search-query-matching"],
      });
    }

    // Photos & video
    if (mine.photoCount !== null && photos.competitorMedian !== null && mine.photoCount < photos.competitorMedian) {
      findings.push({
        id: "photos-fewer",
        severity: mine.photoCount < photos.competitorMedian / 2 ? "high" : "medium",
        area: "photos",
        title: `Fewer photos than most comparison listings (${mine.photoCount} vs median ${formatCount(photos.competitorMedian)})`,
        detail:
          category === "digital"
            ? "For digital downloads, photos are where buyers see what's inside: page previews, a \"what you get\" graphic, device or print mockups."
            : "Photos are how buyers judge quality: show scale (in hand or in use), close-ups of the finish, every option, and the packaging.",
        evidence: [
          { ref: `${mine.id}.photoCount`, quote: String(mine.photoCount) },
          ...competitors.filter((c) => c.photoCount !== null).slice(0, 3).map((c) => ({ ref: `${c.id}.photoCount`, quote: String(c.photoCount) })),
        ],
        guidance: ["search-ranking-signals"],
      });
    }
    const withVideo = competitors.filter((c) => c.hasVideo === true);
    if (mine.hasVideo === false && withVideo.length > 0 && withVideo.length >= competitors.filter((c) => c.hasVideo !== null).length / 2) {
      findings.push({
        id: "video-missing",
        severity: "low",
        area: "photos",
        title: "Most comparison listings with known video status have one; yours doesn't",
        detail: `${withVideo.length} of ${competitors.length} have a listing video. ${category === "digital" ? "A short flip-through can show what the download contains." : "A few seconds of the item in use shows size and finish better than photos."}`,
        evidence: [{ ref: `${mine.id}.hasVideo`, quote: "no" }, ...withVideo.slice(0, 2).map((c) => ({ ref: `${c.id}.hasVideo`, quote: "yes" }))],
        guidance: ["search-ranking-signals"],
      });
    }

    // Price (descriptive only)
    if (price.position !== "unknown" && price.position !== "no-comparison" && mine.price !== null) {
      const g = price.comparable.map((x) => x.price);
      const where =
        price.position === "below"
          ? "below every"
          : price.position === "above"
            ? "above every"
            : `within the range of the`;
      findings.push({
        id: "price-position",
        severity: "info",
        area: "price",
        title: `Your price is ${where} comparison listing priced in ${mine.currency}`,
        detail: `${formatPrice(mine.price, mine.currency)} vs ${displayAmount(Math.min(...g))}–${displayAmount(Math.max(...g))} ${mine.currency} (median ${displayAmount(median(g)!)}) across ${g.length} listing${g.length === 1 ? "" : "s"}. This describes position only; compare what each listing includes before changing price.`,
        evidence: [
          { ref: `${mine.id}.price`, quote: formatAmount(mine.price) },
          ...price.comparable.slice(0, 4).map((x) => ({ ref: `${x.id}.price`, quote: formatAmount(x.price) })),
        ],
        guidance: [],
      });
    } else if (mine.price === null) {
      findings.push({
        id: "mine-price-unknown",
        severity: "low",
        area: "data",
        title: "Add your price to compare prices",
        detail: "Your price wasn't provided.",
        evidence: [],
        guidance: [],
        ask: "What is your listing's price and currency?",
      });
    }
  }

  for (const e of price.excluded) {
    if (e.reason.startsWith("priced in")) {
      findings.push({
        id: `currency-${e.id}`,
        severity: "info",
        area: "price",
        title: `${labelOf(listings, e.id)} isn't in the price comparison`,
        detail: `It is ${e.reason}.`,
        evidence: [{ ref: `${e.id}.currency`, quote: listings.find((l) => l.id === e.id)?.currency ?? "" }],
        guidance: [],
      });
    }
  }

  for (const l of listings) {
    const inj = instructionLikeText(l);
    if (inj) {
      findings.push({
        id: `instructions-${l.id}`,
        severity: "info",
        area: "safety",
        title: `${l.label} contains instruction-like text`,
        detail: "It was treated as listing text only. The analysis and the AI don't follow instructions found inside listings.",
        evidence: [inj],
        guidance: [],
      });
    }
  }

  for (const f of findings) {
    f.evidence = f.evidence.filter((e, i, all) => all.findIndex((x) => x.ref === e.ref && x.quote === e.quote) === i);
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { category, attributeKeys, listings, mine, competitors, attributes, coverage, price, photos, findings, missing, warnings };
}
