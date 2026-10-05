import { describe, expect, it } from "vitest";
import { parseCsv, parseMoney } from "../csv";
import { calcProfit, priceForMargin, US_FEES } from "./fees";
import { aggregate, computeMetrics, diagnose, shopHealth, summarize, type WeekStats } from "./metrics";
import { parseEtsyDate, summarizeOrdersCsv, weekStartOf } from "./orders";
import { sampleWeeks } from "./sample";

const wk = (weekStart: string, visits: number, orders: number, revenue: number, extra: Partial<WeekStats> = {}): WeekStats => ({
  id: weekStart,
  weekStart,
  visits,
  views: visits * 2,
  favorites: Math.round(visits * 0.05),
  orders,
  revenue,
  ...extra,
});

describe("metrics", () => {
  it("keeps views and favourites unknown when they weren't entered", () => {
    const m = computeMetrics({ id: "w", weekStart: "2026-09-07", visits: 200, orders: 4, revenue: 120 });
    expect(m.viewsPerVisit).toBeNull();
    expect(m.favoriteRate).toBeNull();
    const agg = aggregate([
      { id: "a", weekStart: "2026-09-07", visits: 100, views: 250, favorites: 5, orders: 1, revenue: 30 },
      { id: "b", weekStart: "2026-09-14", visits: 100, orders: 1, revenue: 30 },
    ])!;
    expect(agg.views).toBeUndefined();
    expect(agg.viewsPerVisit).toBeNull();
    const f = diagnose([{ id: "b", weekStart: "2026-09-14", visits: 300, orders: 0, revenue: 0 }]);
    expect(f.some((x) => x.id === "shallow-browsing")).toBe(false);
  });

  it("computes rates and guards against zero division", () => {
    const m = computeMetrics(wk("2026-09-07", 200, 4, 120));
    expect(m.conversionRate).toBeCloseTo(0.02);
    expect(m.aov).toBe(30);
    expect(m.revenuePerVisit).toBeCloseTo(0.6);
    const z = computeMetrics(wk("2026-09-07", 0, 0, 0));
    expect(z.conversionRate).toBe(0);
    expect(z.aov).toBe(0);
    expect(z.roas).toBeNull();
  });

  it("aggregates weeks on totals, not averages of rates", () => {
    const a = aggregate([wk("2026-09-07", 100, 1, 30), wk("2026-09-14", 300, 9, 270)])!;
    expect(a.visits).toBe(400);
    expect(a.conversionRate).toBeCloseTo(10 / 400);
  });

  it("sorts weeks and computes week-over-week and 4-week trends", () => {
    const weeks = sampleWeeks(new Date("2026-09-30T12:00:00Z"));
    const s = summarize([...weeks].reverse());
    expect(s.weeks[0]!.weekStart < s.weeks.at(-1)!.weekStart).toBe(true);
    expect(s.latest!.visits).toBe(262);
    expect(s.wow.visits).toBeCloseTo(262 / 341 - 1);
    expect(s.trend4.visits).not.toBeNull();
    expect(s.latest!.weekStart).toBe("2026-09-21");
  });
});

describe("diagnose", () => {
  it("asks for data when there is none", () => {
    expect(diagnose([])[0]!.id).toBe("no-data");
  });

  it("flags low traffic for a tiny shop", () => {
    const f = diagnose([wk("2026-09-14", 12, 0, 0)], { profile: { model: "handmade", margin: 0.3, activeListings: 6 } });
    expect(f[0]!.id).toBe("low-traffic");
    expect(f[0]!.severity).toBe("critical");
  });

  it("flags low conversion only with enough visits, relative to seller type", () => {
    const weeks = [wk("2026-09-07", 300, 1, 30), wk("2026-09-14", 300, 1, 30)];
    const handmade = diagnose(weeks, { profile: { model: "handmade", margin: 0.3, activeListings: 40 } });
    expect(handmade.some((x) => x.id === "low-conversion")).toBe(true);
    const few = diagnose([wk("2026-09-14", 60, 0, 0)], { profile: { model: "handmade", margin: 0.3, activeListings: 40 } });
    expect(few.some((x) => x.id === "low-conversion")).toBe(false);
    expect(few.some((x) => x.id === "cr-sample")).toBe(true);
  });

  it("explains a traffic drop by its source", () => {
    const prev = wk("2026-09-07", 300, 6, 180, { sources: { etsySearch: 150, etsyAds: 100, social: 50 } });
    const cur = wk("2026-09-14", 180, 4, 120, { sources: { etsySearch: 150, etsyAds: 0, social: 30 } });
    const f = diagnose([prev, cur]);
    const drop = f.find((x) => x.id === "traffic-drop")!;
    expect(drop).toBeDefined();
    expect(drop.detail).toMatch(/Etsy Ads/);
    expect(drop.actions[0]).toMatch(/budget/);
  });

  it("judges ad profitability against the seller's margin", () => {
    const w = [wk("2026-09-14", 400, 8, 240, { adSpend: 50, adRevenue: 100 })];
    const tight = diagnose(w, { profile: { model: "handmade", margin: 0.3, activeListings: 30 } });
    expect(tight.find((x) => x.area === "ads")!.id).toBe("ads-unprofitable"); // needs 3.3x
    const rich = diagnose(w, { profile: { model: "handmade", margin: 0.8, activeListings: 30 } });
    expect(rich.find((x) => x.area === "ads")!.id).toBe("ads-profitable"); // needs 1.25x
  });

  it("orders findings by severity", () => {
    const order = { critical: 0, warning: 1, info: 2, good: 3 } as const;
    const f = diagnose(sampleWeeks(new Date("2026-09-30T00:00:00Z")), { profile: { model: "handmade", margin: 0.35, activeListings: 24 }, seoAverage: 52 });
    const ranks = f.map((x) => order[x.severity]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});

describe("shopHealth", () => {
  it("only scores the components it has data for", () => {
    expect(shopHealth([]).score).toBeNull();
    const h = shopHealth(sampleWeeks(new Date("2026-09-30T00:00:00Z")), { seoAverage: 70 });
    expect(h.components.map((c) => c.id)).toEqual(["seo", "conversion", "momentum", "search"]);
    expect(h.score).toBeGreaterThan(0);
    expect(h.score).toBeLessThanOrEqual(100);
  });
});

describe("csv", () => {
  it("handles quotes, embedded commas, newlines and BOM", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""","multi\nline"\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'he said "hi"', "multi\nline"],
    ]);
  });

  it("parses money in both decimal styles", () => {
    expect(parseMoney("$1,234.50")).toBe(1234.5);
    expect(parseMoney("1.234,50")).toBe(1234.5);
    expect(parseMoney("")).toBeNaN();
  });
});

describe("orders", () => {
  it("parses Etsy dates and week starts (Monday)", () => {
    expect(parseEtsyDate("09/28/26")!.toISOString().slice(0, 10)).toBe("2026-09-28");
    expect(weekStartOf(new Date("2026-09-30T00:00:00Z"))).toBe("2026-09-28");
    expect(weekStartOf(new Date("2026-09-27T00:00:00Z"))).toBe("2026-09-21");
  });

  it("aggregates the orders export without keeping buyer details", () => {
    const csv = [
      "Sale Date,Order ID,Buyer User ID,Full Name,Number of Items,Order Value,Discount Amount,Coupon Code,Ship Country",
      "09/21/26,1001,b1,Ann Smith,1,30.00,0,,United States",
      "09/23/26,1002,b2,Bo Lee,2,50.00,5.00,THANKS10,Canada",
      "09/29/26,1003,b1,Ann Smith,1,20.00,0,,United States",
      "09/29/26,1003,b1,Ann Smith,1,20.00,0,,United States",
    ].join("\n");
    const s = summarizeOrdersCsv(csv);
    expect(s.orders).toBe(3); // duplicate order id ignored
    expect(s.sales).toBe(95);
    expect(s.repeatBuyerRate).toBe(0.5);
    expect(s.couponRate).toBeCloseTo(1 / 3);
    expect(s.byWeek).toEqual([
      { weekStart: "2026-09-21", orders: 2, sales: 75 },
      { weekStart: "2026-09-28", orders: 1, sales: 20 },
    ]);
    expect(JSON.stringify(s)).not.toMatch(/Ann|Smith/);
  });

  it("never adds different currencies together and leaves out cancelled orders", () => {
    const csv = [
      "Sale Date,Order ID,Buyer User ID,Currency,Order Value,Discount Amount,Order Total,Adjusted Order Total,Status",
      "09/21/26,1,b1,USD,30.00,0,30.00,,Completed",
      "09/22/26,2,b2,USD,20.00,0,20.00,10.00,Completed",
      "09/23/26,3,b3,EUR,25.00,0,25.00,,Completed",
      "09/24/26,4,b4,USD,99.00,0,99.00,,Canceled",
    ].join("\n");
    const s = summarizeOrdersCsv(csv);
    expect(s.currency).toBe("USD");
    expect(s.orders).toBe(2);
    expect(s.sales).toBe(50);
    expect(s.otherCurrencies).toEqual([{ currency: "EUR", orders: 1, sales: 25 }]);
    expect(s.excludedCancelled).toBe(1);
    expect(s.adjusted).toBe(1);
  });
});

describe("fees", () => {
  it("matches the worked example in the academy", () => {
    const r = calcProfit({ price: 25, shippingCharged: 5, itemCost: 0, shippingCost: 0, labourMinutes: 0, hourlyRate: 0 });
    const txn = r.fees.find((f) => f.label.startsWith("Transaction"))!.amount;
    const proc = r.fees.find((f) => f.label.startsWith("Payment"))!.amount;
    expect(txn + proc).toBeCloseTo(3.1, 2);
  });

  it("finds the price that reaches a target margin", () => {
    const input = { price: 0, shippingCharged: 0, itemCost: 8, shippingCost: 4, labourMinutes: 30, hourlyRate: 20 };
    const p = priceForMargin(input, 0.25)!;
    expect(calcProfit({ ...input, price: p }).margin).toBeGreaterThanOrEqual(0.25);
    expect(calcProfit({ ...input, price: p - 0.05 }).margin).toBeLessThan(0.25);
    expect(priceForMargin(input, 0.95, US_FEES)).toBeNull();
  });
});

describe("sample data", () => {
  it("demonstrates a diagnosable traffic drop caused by ads", () => {
    const f = diagnose(sampleWeeks(new Date("2026-09-30T00:00:00Z")), { profile: { model: "handmade", margin: 0.35, activeListings: 24 } });
    const drop = f.find((x) => x.id === "traffic-drop");
    expect(drop?.severity).toBe("warning");
    expect(drop?.detail).toMatch(/Etsy Ads/);
  });
});
