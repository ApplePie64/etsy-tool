import type { SeoReport } from "../seo/analyzer";
import type { BulkAuditSummary } from "../seo/bulk";
import { classifySeller, type SellerProfile } from "../sellers/archetypes";
import { diagnose, money, pct, shopHealth, sourceShares, summarize, type WeekStats } from "../stats/metrics";
import type { OrdersSummary } from "../stats/orders";

export interface AdvisorState {
  profile: SellerProfile;
  weeks: WeekStats[];
  audit: Pick<BulkAuditSummary, "averageScore" | "listings" | "commonIssues" | "gradeCounts"> | null;
  lastListing: { title: string; report: Pick<SeoReport, "score" | "grade" | "priorities" | "coverage"> } | null;
  orders: OrdersSummary | null;
}

const signed = (x: number | null) => (x === null ? "n/a" : `${x >= 0 ? "+" : ""}${pct(x, 0)}`);

/**
 * A compact, plain-text snapshot of the seller's shop for the AI advisor.
 * Only aggregates go in — no buyer names or addresses.
 */
export function buildAdvisorContext(state: AdvisorState): string {
  const { profile, weeks } = state;
  const { archetype, stage, notes } = classifySeller(profile);
  const lines: string[] = [];

  lines.push("## Seller profile");
  lines.push(`- Seller type: ${archetype.name} (${archetype.examples})`);
  if (profile.secondary?.length) lines.push(`- Also sells: ${profile.secondary.join(", ")}`);
  lines.push(`- Stage: ${stage.name} (${stage.range}); focus: ${stage.focus}`);
  lines.push(`- Active listings: ${profile.activeListings}; lifetime sales: ${profile.totalSales}; hours/week: ${profile.hoursPerWeek}; margin before ads: ${pct(profile.margin, 0)}`);
  lines.push(`- Typical conversion for this type: ${pct(archetype.conversion.low, 1)}–${pct(archetype.conversion.high, 1)}; typical AOV ${money(archetype.aov.low)}–${money(archetype.aov.high)} (community rules of thumb)`);
  for (const n of notes) lines.push(`- Note: ${n}`);

  const s = summarize(weeks);
  lines.push("", "## Weekly stats");
  if (!s.latest) {
    lines.push("- No weekly stats entered yet.");
  } else {
    lines.push(`- Weeks of data: ${s.weeks.length} (${s.weeks[0]!.weekStart} to ${s.latest.weekStart})`);
    for (const w of s.weeks.slice(-8)) {
      lines.push(
        `- Week of ${w.weekStart}: ${w.visits} visits, ${w.views} views, ${w.favorites} favs, ${w.orders} orders, ${money(w.revenue)} revenue, CR ${pct(w.conversionRate)}` +
          (w.adSpend ? `, ad spend ${money(w.adSpend)}${w.adRevenue !== undefined ? `, ad revenue ${money(w.adRevenue)}` : ""}` : ""),
      );
    }
    lines.push(`- Week over week: visits ${signed(s.wow.visits)}, orders ${signed(s.wow.orders)}, revenue ${signed(s.wow.revenue)}, conversion ${signed(s.wow.conversionRate)}`);
    if (s.last4) {
      lines.push(`- Last ${Math.min(4, s.weeks.length)} weeks combined: ${s.last4.visits} visits, ${s.last4.orders} orders, CR ${pct(s.last4.conversionRate)}, AOV ${money(s.last4.aov)}, revenue/visit ${money(s.last4.revenuePerVisit)}`);
      const shares = sourceShares(s.last4.sources);
      if (shares.length) lines.push(`- Traffic mix: ${shares.map((x) => `${x.label} ${pct(x.share, 0)}`).join(", ")}`);
      if (s.last4.roas !== null) lines.push(`- Etsy Ads ROAS: ${s.last4.roas.toFixed(2)}× (break-even ${(1 / (profile.margin || 0.35)).toFixed(2)}×)`);
    }
    if (s.trend4.visits !== null) lines.push(`- Last 4 vs previous 4 weeks: visits ${signed(s.trend4.visits)}, revenue ${signed(s.trend4.revenue)}`);
  }

  const opts = { profile, seoAverage: state.audit?.averageScore };
  const health = shopHealth(weeks, opts);
  if (health.score !== null) {
    lines.push("", `## Shop health: ${health.score}/100`);
    for (const c of health.components) lines.push(`- ${c.label}: ${c.score}/100 (${c.note})`);
  }

  const findings = diagnose(weeks, opts);
  lines.push("", "## Diagnostic findings (from the app's rule engine)");
  for (const f of findings.slice(0, 8)) lines.push(`- [${f.severity}] ${f.title} — ${f.detail}`);

  if (state.audit) {
    lines.push("", "## Bulk listing SEO audit");
    lines.push(`- ${state.audit.listings} listings, average score ${state.audit.averageScore}/100, grades ${Object.entries(state.audit.gradeCounts).map(([g, n]) => `${g}:${n}`).join(" ")}`);
    for (const i of state.audit.commonIssues.slice(0, 5)) lines.push(`- ${i.count} listings fail "${i.label}"`);
  }

  if (state.lastListing) {
    const r = state.lastListing.report;
    lines.push("", "## Last listing analysed in SEO Lab");
    lines.push(`- Title: ${state.lastListing.title.slice(0, 140)}`);
    lines.push(`- Score ${r.score}/100 (grade ${r.grade}); target keyword "${r.coverage.keyword}"${r.coverage.inferred ? " (inferred)" : ""}`);
    for (const p of r.priorities.slice(0, 5)) lines.push(`- Fix: ${p.label} — ${p.detail}`);
  }

  if (state.orders) {
    const o = state.orders;
    lines.push("", "## Orders export (aggregates only)");
    lines.push(`- ${o.orders} orders ${o.firstDate} to ${o.lastDate}, sales ${money(o.sales)}, AOV ${money(o.aov)}, repeat buyers ${pct(o.repeatBuyerRate, 0)}, coupon use ${pct(o.couponRate, 0)}`);
    if (o.topCountries.length) lines.push(`- Top countries: ${o.topCountries.map((c) => `${c.country} (${c.orders})`).join(", ")}`);
  }

  return lines.join("\n");
}
