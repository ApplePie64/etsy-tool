import { ATTRIBUTE_LABELS, extractAttributes, type AttributeKey } from "./attributes";
import { displayAmount } from "./analyze";
import type { Category, CompareListing } from "./types";
import type { WeekStats } from "../stats/metrics";

/**
 * Before/after tracking: the seller records when they changed their listing
 * on Etsy, then enters the listing's Etsy Stats for the same number of days
 * before and after. The app says how big the change is, whether it's bigger
 * than chance would usually produce, and how it compares with the shop's
 * overall trend. It never claims the edit caused the change.
 */

export type ListingSnapshot = Pick<CompareListing, "title" | "tags" | "description" | "price" | "currency" | "photoCount" | "hasVideo">;

/** One period of a listing's Etsy Stats. Blank stays unknown (null), never zero. */
export interface PeriodStats {
  /** Visits or views — whichever the seller reads from Etsy, as long as it's the same both times. */
  visits: number | null;
  favorites: number | null;
  orders: number | null;
}

export interface TrackedChange {
  id: string;
  /** YYYY-MM-DD the seller changed the listing on Etsy. */
  changedOn: string;
  /** Days in each comparison period (before and after). */
  windowDays: number;
  before: ListingSnapshot;
  /** Frozen when results are saved; until then the live "Your listing" is the after version. */
  after: ListingSnapshot | null;
  /** The plan suggestions the seller says they applied (their wording at the time). */
  applied: string[];
  note: string;
  statsBefore: PeriodStats | null;
  statsAfter: PeriodStats | null;
}

export const WINDOW_OPTIONS = [14, 30, 60] as const;
export const DEFAULT_WINDOW = 30;

export const snapshotOf = (l: CompareListing): ListingSnapshot => ({
  title: l.title,
  tags: l.tags,
  description: l.description,
  price: l.price,
  currency: l.currency,
  photoCount: l.photoCount,
  hasVideo: l.hasVideo,
});

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
/** Today's date where the seller is (not UTC), as YYYY-MM-DD. */
export const localToday = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(toTime(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);

/**
 * The two periods to look up in Etsy Stats. The change day itself is left
 * out: it's part before, part after.
 */
export function trackingWindows(t: Pick<TrackedChange, "changedOn" | "windowDays">) {
  return {
    before: { from: addDays(t.changedOn, -t.windowDays), to: addDays(t.changedOn, -1) },
    after: { from: addDays(t.changedOn, 1), to: addDays(t.changedOn, t.windowDays) },
    /** First day the whole after-period is in Etsy Stats. */
    checkOn: addDays(t.changedOn, t.windowDays + 1),
  };
}

export type TrackingStage = "waiting" | "due" | "done";

export function trackingStage(t: TrackedChange, today: string): TrackingStage {
  if (t.statsAfter) return "done";
  return today >= trackingWindows(t).checkOn ? "due" : "waiting";
}

/* ------------------------------------------------------------------ */
/* What changed                                                        */
/* ------------------------------------------------------------------ */

export interface SnapshotChange {
  field: "title" | "tags" | "description" | "price" | "photos" | "video";
  label: string;
  summary: string;
}

const cut = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Human-readable list of what differs between two versions of the listing. */
export function diffSnapshots(before: ListingSnapshot, after: ListingSnapshot, category: Category): SnapshotChange[] {
  const out: SnapshotChange[] = [];
  if (before.title.trim() !== after.title.trim()) {
    out.push({ field: "title", label: "Title", summary: `"${cut(before.title)}" → "${cut(after.title)}"` });
  }
  if (before.tags && after.tags) {
    const was = new Set(before.tags.map((t) => t.toLowerCase()));
    const now = new Set(after.tags.map((t) => t.toLowerCase()));
    const added = [...now].filter((t) => !was.has(t));
    const removed = [...was].filter((t) => !now.has(t));
    if (added.length || removed.length) {
      out.push({
        field: "tags",
        label: "Tags",
        summary: [added.length ? `added ${added.join(", ")}` : "", removed.length ? `removed ${removed.join(", ")}` : ""].filter(Boolean).join("; "),
      });
    }
  } else if (!before.tags && after.tags?.length) {
    out.push({ field: "tags", label: "Tags", summary: `${after.tags.length} tags recorded (none recorded before, so changes can't be shown)` });
  }
  if ((before.description ?? "") !== (after.description ?? "")) {
    const asListing = (s: ListingSnapshot) =>
      ({ ...s, id: "x", role: "mine", label: "", url: null, reviewCount: null, notes: null, source: "manual", capturedAt: "" }) as CompareListing;
    const was = extractAttributes(asListing(before), category);
    const now = extractAttributes(asListing(after), category);
    const newly = (Object.keys(now) as AttributeKey[]).filter((k) => now[k].status === "stated" && was[k]?.status !== "stated");
    const dropped = (Object.keys(was) as AttributeKey[]).filter((k) => was[k].status === "stated" && now[k]?.status !== "stated");
    const lenDiff = (after.description ?? "").length - (before.description ?? "").length;
    const parts = [
      before.description === null ? "added" : after.description === null ? "removed" : `${lenDiff >= 0 ? "+" : "−"}${Math.abs(lenDiff)} characters`,
      newly.length ? `now states ${newly.map((k) => ATTRIBUTE_LABELS[k].toLowerCase()).join(", ")}` : "",
      dropped.length ? `no longer states ${dropped.map((k) => ATTRIBUTE_LABELS[k].toLowerCase()).join(", ")}` : "",
    ];
    out.push({ field: "description", label: "Description", summary: parts.filter(Boolean).join("; ") });
  }
  if (before.price !== after.price || before.currency !== after.currency) {
    const fmt = (s: ListingSnapshot) => (s.price === null ? "unknown" : `${displayAmount(s.price)} ${s.currency ?? ""}`.trim());
    out.push({ field: "price", label: "Price", summary: `${fmt(before)} → ${fmt(after)}` });
  }
  if (before.photoCount !== after.photoCount) {
    out.push({ field: "photos", label: "Photos", summary: `${before.photoCount ?? "unknown"} → ${after.photoCount ?? "unknown"}` });
  }
  if (before.hasVideo !== after.hasVideo) {
    const v = (x: boolean | null) => (x === null ? "unknown" : x ? "yes" : "no");
    out.push({ field: "video", label: "Video", summary: `${v(before.hasVideo)} → ${v(after.hasVideo)}` });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/** Natural log of the sum of exp(xs), without overflow. */
function logSumExp(xs: number[]): number {
  const m = Math.max(...xs);
  return m === -Infinity ? -Infinity : m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0));
}

/**
 * Two-sided binomial test: how surprising is `k` of `n` events landing in the
 * after-period, if each event had probability `p` of doing so? Exact for
 * moderate n, normal approximation for very large n.
 */
export function binomialTwoSided(k: number, n: number, p: number): number {
  if (n <= 0) return 1;
  if (p <= 0 || p >= 1) return 1;
  if (n > 20_000) {
    const mean = n * p;
    const sd = Math.sqrt(n * p * (1 - p));
    const z = (Math.abs(k - mean) - 0.5) / sd;
    return Math.min(1, 2 * (1 - normalCdf(Math.max(0, z))));
  }
  const logs: number[] = new Array(n + 1);
  logs[0] = n * Math.log(1 - p);
  for (let i = 0; i < n; i++) logs[i + 1] = logs[i]! + Math.log((n - i) / (i + 1)) + Math.log(p / (1 - p));
  const lower = Math.exp(logSumExp(logs.slice(0, k + 1)));
  const upper = Math.exp(logSumExp(logs.slice(k)));
  return Math.min(1, 2 * Math.min(lower, upper));
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496735) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + erf);
}

export type Verdict = "up" | "down" | "chance" | "too-few" | "unknown";

export interface MetricResult {
  key: keyof PeriodStats;
  label: string;
  before: number | null;
  after: number | null;
  /** Percentage change, null when it can't be computed. */
  change: number | null;
  /** Change after allowing for the shop's overall trend, when shop stats cover both periods. */
  vsShop: number | null;
  verdict: Verdict;
  p: number | null;
}

export interface ShopTrend {
  /** after / before, per week, for shop visits and orders. */
  visits: number | null;
  orders: number | null;
  weeksBefore: number;
  weeksAfter: number;
}

/**
 * The shop's own trend over the same two periods, from the weekly stats the
 * seller logged. Only weeks that fall wholly inside a period count; at least
 * two on each side are needed.
 */
export function shopTrend(weeks: WeekStats[], t: Pick<TrackedChange, "changedOn" | "windowDays">): ShopTrend | null {
  const w = trackingWindows(t);
  const inside = (r: { from: string; to: string }) => weeks.filter((x) => x.weekStart >= r.from && addDays(x.weekStart, 6) <= r.to);
  const before = inside(w.before);
  const after = inside(w.after);
  if (before.length < 2 || after.length < 2) return null;
  const ratio = (f: (x: WeekStats) => number) => {
    const b = before.reduce((s, x) => s + f(x), 0) / before.length;
    const a = after.reduce((s, x) => s + f(x), 0) / after.length;
    return b > 0 && a > 0 ? a / b : null;
  };
  return { visits: ratio((x) => x.visits), orders: ratio((x) => x.orders), weeksBefore: before.length, weeksAfter: after.length };
}

const METRICS: { key: keyof PeriodStats; label: string; trend: keyof Pick<ShopTrend, "visits" | "orders"> }[] = [
  { key: "visits", label: "Visits / views", trend: "visits" },
  { key: "favorites", label: "Favourites", trend: "visits" },
  { key: "orders", label: "Orders", trend: "orders" },
];

/** Fewer events than this across both periods is too few to say anything. */
export const MIN_EVENTS = 10;
/** Stricter than the usual 0.05: daily shop traffic is noisier than a coin toss. */
export const SIGNIFICANCE = 0.01;

export function compareStats(before: PeriodStats, after: PeriodStats, trend: ShopTrend | null): MetricResult[] {
  return METRICS.map(({ key, label, trend: tk }) => {
    const b = before[key];
    const a = after[key];
    if (b === null || a === null) return { key, label, before: b, after: a, change: null, vsShop: null, verdict: "unknown", p: null };
    const change = b > 0 ? ((a - b) / b) * 100 : null;
    const r = trend?.[tk] ?? null;
    const vsShop = b > 0 && r ? ((a / b / r) - 1) * 100 : null;
    if (a + b < MIN_EVENTS) return { key, label, before: b, after: a, change, vsShop, verdict: "too-few", p: null };
    // With equal-length periods and no trend, each event is equally likely to fall either side.
    const share = r ? r / (1 + r) : 0.5;
    const p = binomialTwoSided(a, a + b, share);
    const verdict: Verdict = p < SIGNIFICANCE ? (a / (a + b) > share ? "up" : "down") : "chance";
    return { key, label, before: b, after: a, change, vsShop, verdict, p };
  });
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  up: "Clear increase",
  down: "Clear decrease",
  chance: "Could be chance",
  "too-few": "Too few to tell",
  unknown: "Not entered",
};

export function conversion(s: PeriodStats | null): number | null {
  return s && s.visits && s.orders !== null ? (s.orders / s.visits) * 100 : null;
}

/** One-paragraph reading of the results, careful not to claim cause. */
export function resultsSummary(results: MetricResult[], trend: ShopTrend | null): string {
  const known = results.filter((r) => r.verdict !== "unknown");
  if (!known.length) return "Enter the numbers for both periods to see the results.";
  const clear = known.filter((r) => r.verdict === "up" || r.verdict === "down");
  const parts: string[] = [];
  if (clear.length) {
    const what = clear.map((r) => `${r.label.toLowerCase()} ${r.verdict === "up" ? "rose" : "fell"}`).join(" and ");
    parts.push(`${what[0]!.toUpperCase()}${what.slice(1)} by more than chance alone would usually explain${trend ? ", even allowing for your shop's overall trend" : ""}.`);
  } else if (known.every((r) => r.verdict === "too-few")) {
    parts.push("These numbers are too small to tell a real change from normal ups and downs. A longer period (60 days) will tell you more.");
  } else {
    parts.push("No change was bigger than normal ups and downs would produce.");
  }
  if (!trend) parts.push("Log weekly shop stats in Shop Stats to see whether your whole shop moved the same way.");
  parts.push("Season, Etsy search updates, ads and sales also move these numbers, so treat a clear change as a good sign, not proof.");
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Calendar reminder                                                   */
/* ------------------------------------------------------------------ */

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold lines at 75 octets, as RFC 5545 asks, without splitting a character. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function reminderText(t: TrackedChange, listingTitle: string) {
  const w = trackingWindows(t);
  return {
    title: `Check listing results: ${cut(listingTitle, 60)}`,
    details: [
      `You changed this listing on ${t.changedOn}.`,
      `In Etsy: Shop Manager → Stats → choose ${w.before.from} to ${w.before.to}, note this listing's visits, favourites and orders; then do the same for ${w.after.from} to ${w.after.to}.`,
      "Enter both in SellerScope → Compare Listings → Did it work?",
    ].join("\n"),
  };
}

/** An all-day calendar event on the check date. */
export function reminderIcs(t: TrackedChange, listingTitle: string, appUrl: string, now = new Date()): string {
  const day = trackingWindows(t).checkOn.replace(/-/g, "");
  const next = addDays(trackingWindows(t).checkOn, 1).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const { title, details } = reminderText(t, listingTitle);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SellerScope//Listing results//EN",
    "BEGIN:VEVENT",
    `UID:${t.id}@sellerscope`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(`${details}\n${appUrl}`)}`,
    `URL:${appUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

export function googleCalendarUrl(t: TrackedChange, listingTitle: string, appUrl: string): string {
  const day = trackingWindows(t).checkOn.replace(/-/g, "");
  const next = addDays(trackingWindows(t).checkOn, 1).replace(/-/g, "");
  const { title, details } = reminderText(t, listingTitle);
  const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${day}/${next}`, details: `${details}\n${appUrl}` });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
