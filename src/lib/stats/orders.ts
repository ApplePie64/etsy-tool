import { parseCsvRecords, parseMoney } from "../csv";

/**
 * Aggregates Etsy's "Orders" CSV (Shop Manager → Settings → Options →
 * Download Data → Orders). Buyer names and addresses never leave this
 * function — only counts and totals are kept.
 */
export interface OrdersSummary {
  /** Orders in the main currency (the one most orders use). */
  orders: number;
  items: number;
  /** Currency of `sales` and `aov`; null if the export has no currency column. */
  currency: string | null;
  /** Item sales after discounts, before shipping and tax, in `currency`. */
  sales: number;
  aov: number;
  /** Orders in other currencies, totalled separately — never added to `sales`. */
  otherCurrencies: { currency: string; orders: number; sales: number }[];
  /** Orders left out because their status says cancelled or refunded. */
  excludedCancelled: number;
  /** Orders whose adjusted total differs from the original (e.g. partial refunds); not reflected in sales. */
  adjusted: number;
  uniqueBuyers: number;
  repeatBuyerRate: number;
  couponRate: number;
  firstDate: string;
  lastDate: string;
  byWeek: { weekStart: string; orders: number; sales: number }[];
  byWeekday: number[];
  topCountries: { country: string; orders: number }[];
}

/** Parses Etsy's MM/DD/YY or MM/DD/YYYY, and ISO dates. */
export function parseEtsyDate(v: string): Date | null {
  const s = v.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (m) {
    const yy = Number(m[3]);
    const year = yy < 100 ? 2000 + yy : yy;
    const d = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Monday of the week containing `d` (UTC). */
export function weekStartOf(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return isoDate(m);
}

export function summarizeOrdersCsv(csv: string): OrdersSummary {
  const recs = parseCsvRecords(csv).filter((r) => r["SALE DATE"] && r["ORDER ID"]);
  if (recs.length === 0) {
    throw new Error("No orders found. Use Etsy's Orders CSV — it needs \"Sale Date\" and \"Order ID\" columns.");
  }

  // Totals are per currency; the most common currency becomes the headline.
  const currencyCounts = new Map<string, number>();
  for (const r of recs) {
    const c = (r.CURRENCY ?? "").trim().toUpperCase();
    if (c) currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1);
  }
  const mainCurrency = [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const others = new Map<string, { orders: number; sales: number }>();
  let excludedCancelled = 0;
  let adjusted = 0;

  const seen = new Set<string>();
  const buyers = new Map<string, number>();
  const weeks = new Map<string, { orders: number; sales: number }>();
  const countries = new Map<string, number>();
  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  let orders = 0;
  let items = 0;
  let sales = 0;
  let withCoupon = 0;
  let first: Date | null = null;
  let last: Date | null = null;

  for (const r of recs) {
    const id = r["ORDER ID"]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const date = parseEtsyDate(r["SALE DATE"] ?? "");
    if (!date) continue;
    if (/cancel|refund/i.test(r.STATUS ?? "")) {
      excludedCancelled++;
      continue;
    }
    const value = parseMoney(r["ORDER VALUE"]);
    const discount = parseMoney(r["DISCOUNT AMOUNT"]);
    const net = (Number.isNaN(value) ? 0 : value) - (Number.isNaN(discount) ? 0 : discount);
    const adjustedTotal = parseMoney(r["ADJUSTED ORDER TOTAL"]);
    const orderTotal = parseMoney(r["ORDER TOTAL"]);
    if (!Number.isNaN(adjustedTotal) && !Number.isNaN(orderTotal) && Math.abs(adjustedTotal - orderTotal) > 0.005) adjusted++;
    const currency = (r.CURRENCY ?? "").trim().toUpperCase() || null;
    if (mainCurrency && currency && currency !== mainCurrency) {
      const o = others.get(currency) ?? { orders: 0, sales: 0 };
      o.orders++;
      o.sales += net;
      others.set(currency, o);
      continue;
    }

    orders++;
    items += Number(r["NUMBER OF ITEMS"]) || 1;
    sales += net;
    if ((r["COUPON CODE"] ?? "").trim()) withCoupon++;
    const buyer = r["BUYER USER ID"] || r["BUYER"] || "";
    if (buyer) buyers.set(buyer, (buyers.get(buyer) ?? 0) + 1);
    const country = r["SHIP COUNTRY"] || "Unknown";
    countries.set(country, (countries.get(country) ?? 0) + 1);
    const wk = weekStartOf(date);
    const cur = weeks.get(wk) ?? { orders: 0, sales: 0 };
    cur.orders++;
    cur.sales += net;
    weeks.set(wk, cur);
    byWeekday[(date.getUTCDay() + 6) % 7]!++;
    if (!first || date < first) first = date;
    if (!last || date > last) last = date;
  }

  const uniqueBuyers = buyers.size;
  const repeat = [...buyers.values()].filter((n) => n > 1).length;
  return {
    orders,
    items,
    currency: mainCurrency,
    otherCurrencies: [...others.entries()].map(([currency, o]) => ({ currency, orders: o.orders, sales: Math.round(o.sales * 100) / 100 })),
    excludedCancelled,
    adjusted,
    sales: Math.round(sales * 100) / 100,
    aov: orders ? sales / orders : 0,
    uniqueBuyers,
    repeatBuyerRate: uniqueBuyers ? repeat / uniqueBuyers : 0,
    couponRate: orders ? withCoupon / orders : 0,
    firstDate: first ? isoDate(first) : "",
    lastDate: last ? isoDate(last) : "",
    byWeek: [...weeks.entries()]
      .map(([weekStart, v]) => ({ weekStart, orders: v.orders, sales: Math.round(v.sales * 100) / 100 }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    byWeekday,
    topCountries: [...countries.entries()]
      .map(([country, n]) => ({ country, orders: n }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5),
  };
}
