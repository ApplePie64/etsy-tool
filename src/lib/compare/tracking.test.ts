import { describe, expect, it } from "vitest";
import type { WeekStats } from "../stats/metrics";
import { analyzeComparison } from "./analyze";
import { reportMarkdown } from "./report";
import { sampleComparison } from "./sample";
import {
  addDays,
  binomialTwoSided,
  compareStats,
  diffSnapshots,
  googleCalendarUrl,
  localToday,
  reminderIcs,
  resultsSummary,
  shopTrend,
  trackingStage,
  trackingWindows,
  type ListingSnapshot,
  type TrackedChange,
} from "./tracking";

const before: ListingSnapshot = {
  title: "Personalized Ceramic Plate, Custom Name Plate",
  tags: ["name plate", "wedding gift", "ceramic plate"],
  description: "A handmade ceramic plate personalised with your names.",
  price: 12596,
  currency: "INR",
  photoCount: 6,
  hasVideo: false,
};

const change = (over: Partial<TrackedChange> = {}): TrackedChange => ({
  id: "t1",
  changedOn: "2026-10-06",
  windowDays: 30,
  before,
  after: null,
  applied: [],
  note: "",
  statsBefore: null,
  statsAfter: null,
  ...over,
});

describe("tracking windows", () => {
  it("compares equal periods either side of the change day, leaving the day itself out", () => {
    const w = trackingWindows(change());
    expect(w.before).toEqual({ from: "2026-09-06", to: "2026-10-05" });
    expect(w.after).toEqual({ from: "2026-10-07", to: "2026-11-05" });
    expect(w.checkOn).toBe("2026-11-06");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(localToday(new Date(2026, 0, 5, 1, 30))).toBe("2026-01-05");
  });

  it("is due once the whole after-period is in Etsy Stats", () => {
    expect(trackingStage(change(), "2026-11-05")).toBe("waiting");
    expect(trackingStage(change(), "2026-11-06")).toBe("due");
    expect(trackingStage(change({ statsAfter: { visits: 1, favorites: null, orders: null } }), "2026-10-07")).toBe("done");
  });
});

describe("diffSnapshots", () => {
  it("lists what changed in words, including details the description now states", () => {
    const after: ListingSnapshot = {
      ...before,
      tags: ["name plate", "wedding gift", "anniversary gift"],
      description: `${before.description} Dispatched within 3 working days. Hand wash only. Comes in a gift box.`,
      photoCount: 9,
    };
    const d = diffSnapshots(before, after, "physical");
    expect(d.map((x) => x.field)).toEqual(["tags", "description", "photos"]);
    expect(d[0]!.summary).toBe("added anniversary gift; removed ceramic plate");
    expect(d[1]!.summary).toMatch(/^\+\d+ characters; now states production \/ processing time, care & safety, packaging \/ gifting$/);
    expect(d[2]!.summary).toBe("6 → 9");
  });

  it("returns nothing when nothing changed", () => {
    expect(diffSnapshots(before, { ...before }, "physical")).toEqual([]);
  });
});

describe("binomialTwoSided", () => {
  it("matches known values", () => {
    // 10 of 10 heads with a fair coin: 2 × 0.5^10
    expect(binomialTwoSided(10, 10, 0.5)).toBeCloseTo(2 / 1024, 6);
    expect(binomialTwoSided(5, 10, 0.5)).toBe(1);
    expect(binomialTwoSided(0, 0, 0.5)).toBe(1);
  });

  it("handles large counts without underflow", () => {
    expect(binomialTwoSided(5200, 10000, 0.5)).toBeLessThan(0.001);
    expect(binomialTwoSided(5040, 10000, 0.5)).toBeGreaterThan(0.2);
    expect(binomialTwoSided(52_000, 100_000, 0.5)).toBeLessThan(1e-6);
  });
});

describe("compareStats", () => {
  it("calls a large rise clear and a small one chance", () => {
    const r = compareStats({ visits: 400, favorites: 20, orders: 4 }, { visits: 560, favorites: 24, orders: 3 }, null);
    expect(r.find((x) => x.key === "visits")).toMatchObject({ verdict: "up", change: 40 });
    expect(r.find((x) => x.key === "favorites")!.verdict).toBe("chance");
    expect(r.find((x) => x.key === "orders")!.verdict).toBe("too-few");
  });

  it("keeps blanks unknown instead of treating them as zero", () => {
    const r = compareStats({ visits: 100, favorites: null, orders: 2 }, { visits: 90, favorites: 5, orders: null }, null);
    expect(r.find((x) => x.key === "favorites")).toMatchObject({ verdict: "unknown", change: null });
    expect(r.find((x) => x.key === "orders")!.verdict).toBe("unknown");
  });

  it("allows for the shop's overall trend", () => {
    // The listing rose 40%, but the whole shop rose 40% too.
    const trend = { visits: 1.4, orders: null, weeksBefore: 4, weeksAfter: 4 };
    const r = compareStats({ visits: 400, favorites: null, orders: null }, { visits: 560, favorites: null, orders: null }, trend);
    const v = r.find((x) => x.key === "visits")!;
    expect(v.vsShop).toBeCloseTo(0, 6);
    expect(v.verdict).toBe("chance");
    expect(resultsSummary(r, trend)).not.toMatch(/Log weekly shop stats/);
  });

  it("never claims the edit caused the change", () => {
    const r = compareStats({ visits: 400, favorites: null, orders: null }, { visits: 700, favorites: null, orders: null }, null);
    const s = resultsSummary(r, null);
    expect(s).toMatch(/^Visits \/ views rose by more than chance/);
    expect(s).toMatch(/not proof/);
    expect(s).not.toMatch(/\b(because of|caused|thanks to)\b/i);
  });
});

describe("shopTrend", () => {
  const week = (weekStart: string, visits: number, orders: number): WeekStats => ({ id: weekStart, weekStart, visits, orders, revenue: 0 });

  it("uses only weeks wholly inside each period", () => {
    const weeks = [
      week("2026-09-07", 100, 2),
      week("2026-09-14", 100, 2),
      week("2026-09-21", 100, 2),
      week("2026-09-30", 999, 9), // runs into the change day
      week("2026-10-12", 150, 3),
      week("2026-10-19", 150, 3),
    ];
    const t = shopTrend(weeks, change())!;
    expect(t.weeksBefore).toBe(3);
    expect(t.weeksAfter).toBe(2);
    expect(t.visits).toBeCloseTo(1.5);
    expect(t.orders).toBeCloseTo(1.5);
  });

  it("needs at least two weeks either side", () => {
    expect(shopTrend([week("2026-09-07", 100, 2), week("2026-10-12", 100, 2)], change())).toBeNull();
  });
});

describe("calendar reminder", () => {
  it("writes a valid all-day event on the check date", () => {
    const ics = reminderIcs(change(), "Personalized Ceramic Plate, Custom Name Plate", "https://example.com/etsy-tool/#compare", new Date("2026-10-06T12:00:00Z"));
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261106");
    expect(ics).toContain("DTEND;VALUE=DATE:20261107");
    expect(ics).toContain("DTSTAMP:20261006T120000Z");
    // Commas are escaped, and no physical line is longer than 75 bytes.
    expect(ics).toContain("Plate\\, Custom");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("links to Google Calendar with the same date", () => {
    const u = new URL(googleCalendarUrl(change(), "Plate", "https://example.com/"));
    expect(u.searchParams.get("dates")).toBe("20261106/20261107");
    expect(u.searchParams.get("details")).toMatch(/2026-09-06 to 2026-10-05/);
  });
});

describe("report", () => {
  it("includes the change, what changed and the before/after reading", () => {
    const listings = sampleComparison();
    const a = analyzeComparison(listings);
    const mine = a.mine!;
    const t = change({
      before: { ...before, title: "Old title", tags: mine.tags, description: mine.description, price: mine.price, currency: mine.currency, photoCount: 3, hasVideo: mine.hasVideo },
      applied: ["Add a short flip-through video of the pages or files."],
      statsBefore: { visits: 400, favorites: 20, orders: 4 },
      statsAfter: { visits: 560, favorites: 24, orders: 6 },
    });
    const md = reportMarkdown({ name: "R", createdAt: "2026-10-06", analysis: a, plan: null, feedback: null, changes: [t] });
    expect(md).toContain("## Changes made on Etsy");
    expect(md).toContain("- Applied: Add a short flip-through video");
    expect(md).toMatch(/- Title: "Old title" → "Budget Planner Printable/);
    expect(md).toContain("- Photos: 3 → 5");
    expect(md).toMatch(/\| Visits \/ views \| 400 \| 560 \| \+40% \| Clear increase \|/);
    expect(md).toMatch(/not proof/);
  });
});
