import { ATTRIBUTE_LABELS, type AttributeKey } from "./attributes";
import { formatCount, formatPrice, labelOf, type ComparisonAnalysis } from "./analyze";
import { GUIDANCE_BY_ID } from "./guidance";
import type { Plan } from "./plan";
import { SAMPLE_NOTICE } from "./sample";
import { compareStats, conversion, diffSnapshots, resultsSummary, shopTrend, snapshotOf, trackingWindows, VERDICT_TEXT, type TrackedChange } from "./tracking";
import { CATEGORY_LABELS } from "./types";
import type { WeekStats } from "../stats/metrics";

export interface Feedback {
  changedDecision: "yes" | "no" | "unsure" | null;
  wouldReuse: "yes" | "no" | null;
  note: string;
}

export interface ReportInput {
  name: string;
  createdAt: string;
  analysis: ComparisonAnalysis;
  plan: Plan | null;
  feedback: Feedback | null;
  /** Changes made on Etsy and their before/after stats. */
  changes?: TrackedChange[];
  /** The shop's weekly stats, for the shop-trend comparison. */
  weeks?: WeekStats[];
}

const DISCLAIMER =
  "This report compares listing content you supplied. It is not Etsy's ranking score and does not predict ranking, traffic or sales. Counts of phrases come from the listings you chose, not from shopper searches.";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function attrCell(a: ComparisonAnalysis, id: string, key: AttributeKey): string {
  const r = a.attributes[id]![key];
  return r.status === "stated" ? r.values.join(", ") : r.status === "unknown" ? "Unknown" : "Not stated";
}

const pctText = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${Math.round(n)}%`);

function trackingMarkdown(changes: TrackedChange[], a: ComparisonAnalysis, weeks: WeekStats[]): string[] {
  const lines: string[] = ["## Changes made on Etsy", ""];
  for (const t of changes) {
    const w = trackingWindows(t);
    lines.push(`### Changed on ${t.changedOn}`, "");
    for (const x of t.applied) lines.push(`- Applied: ${x}`);
    if (t.note) lines.push(`- Also: ${t.note}`);
    const after = t.after ?? (a.mine ? snapshotOf(a.mine) : null);
    const diff = after ? diffSnapshots(t.before, after, a.category) : [];
    for (const d of diff) lines.push(`- ${d.label}: ${cell(d.summary)}`);
    if (!diff.length) lines.push("- The listing recorded here hasn't changed since this record was saved.");
    lines.push("");
    if (!t.statsBefore || !t.statsAfter) {
      lines.push(`Results: compare ${w.before.from}–${w.before.to} with ${w.after.from}–${w.after.to} in Etsy Stats from ${w.checkOn}.`, "");
      continue;
    }
    const trend = shopTrend(weeks, t);
    const results = compareStats(t.statsBefore, t.statsAfter, trend);
    lines.push(`Etsy Stats, ${w.before.from}–${w.before.to} vs ${w.after.from}–${w.after.to}:`, "");
    lines.push(`| | Before | After | Change |${trend ? " vs your shop |" : ""} Reading |`, `|---|---|---|---|${trend ? "---|" : ""}---|`);
    for (const r of results) {
      lines.push(`| ${r.label} | ${r.before ?? "—"} | ${r.after ?? "—"} | ${pctText(r.change)} |${trend ? ` ${pctText(r.vsShop)} |` : ""} ${VERDICT_TEXT[r.verdict]} |`);
    }
    const cb = conversion(t.statsBefore);
    const ca = conversion(t.statsAfter);
    if (cb !== null && ca !== null) lines.push(`| Conversion | ${cb.toFixed(1)}% | ${ca.toFixed(1)}% | ${(ca - cb).toFixed(1)} pts |${trend ? " |" : ""} Orders ÷ visits |`);
    lines.push("", resultsSummary(results, trend), "");
  }
  return lines;
}

export function reportMarkdown({ name, createdAt, analysis: a, plan, feedback, changes = [], weeks = [] }: ReportInput): string {
  const L = a.listings;
  const lines: string[] = [];
  lines.push(`# ${name}`, "");
  lines.push(`${CATEGORY_LABELS[a.category]} · created ${createdAt.slice(0, 10)} · report generated ${new Date().toISOString().slice(0, 10)}`, "");
  if (L.some((l) => l.source === "sample")) lines.push(`> ${SAMPLE_NOTICE}`, "");
  lines.push(`> ${DISCLAIMER}`, "");

  lines.push("## Listings compared", "");
  lines.push("| | Listing | Source | Recorded | Price | Photos | Video | Tags |", "|---|---|---|---|---|---|---|---|");
  for (const l of L) {
    lines.push(
      `| ${l.role === "mine" ? "★" : ""} | ${cell(l.label)}: ${cell(l.title)}${l.url ? ` ([link](${l.url}))` : ""} | ${l.source} | ${l.capturedAt} | ${formatPrice(l.price, l.currency)} | ${l.photoCount ?? "Unknown"} | ${l.hasVideo === null ? "Unknown" : l.hasVideo ? "Yes" : "No"} | ${l.tags ? l.tags.length : "Unknown"} |`,
    );
  }
  lines.push("");

  lines.push("## Customer-facing details", "");
  lines.push(`| Detail | ${L.map((l) => cell(l.label)).join(" | ")} |`, `|---|${L.map(() => "---").join("|")}|`);
  for (const k of a.attributeKeys) lines.push(`| ${ATTRIBUTE_LABELS[k]} | ${L.map((l) => cell(attrCell(a, l.id, k))).join(" | ")} |`);
  lines.push("");

  if (a.coverage.terms.length) {
    lines.push("## Title & tag phrase coverage", "", "Where each phrase appears. \"Unknown\" = not in the title, tags not provided.", "");
    lines.push(`| Phrase | Used by | ${L.map((l) => cell(l.label)).join(" | ")} |`, `|---|---|${L.map(() => "---").join("|")}|`);
    for (const t of a.coverage.terms) {
      lines.push(`| ${cell(t.term)} | ${t.competitorCount} of ${a.competitors.length} | ${L.map((l) => t.byListing[l.id]).join(" | ")} |`);
    }
    lines.push("");
  }

  lines.push("## Price", "");
  if (a.mine?.price != null && a.mine.currency) {
    lines.push(`Yours: ${formatPrice(a.mine.price, a.mine.currency)}. Position among listings in ${a.mine.currency}: ${a.price.position}.`);
  } else lines.push("Your price or currency is unknown.");
  for (const e of a.price.excluded) lines.push(`- Not compared: ${labelOf(L, e.id)} — ${e.reason}.`);
  lines.push("");

  lines.push("## Findings", "");
  for (const f of a.findings) {
    lines.push(`- **[${f.severity}] ${f.title}.** ${f.detail}`);
    for (const e of f.evidence) lines.push(`  - Evidence (${e.ref}): "${e.quote.slice(0, 160)}"`);
    if (f.ask) lines.push(`  - You need to confirm: ${f.ask}`);
  }
  lines.push("");

  if (plan) {
    lines.push(`## Improvement plan (${plan.source === "ai" ? `AI${plan.model ? `, ${plan.model}` : ""}` : "rules engine"}, ${plan.generatedAt.slice(0, 10)})`, "", plan.summary, "");
    plan.suggestions.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.action}`, "", `Priority: ${s.priority} · Area: ${s.area}`, "", s.why, "");
      if (s.proposedText) lines.push("Suggested wording:", "", "```", s.proposedText, "```", "");
      if (s.needsSellerInput) lines.push(`**Before you change anything:** ${s.needsSellerInput}`, "");
      for (const e of s.evidence) lines.push(`- Evidence — ${labelOf(L, e.ref.split(".")[0]!)} ${e.ref.split(".")[1]}: "${e.quote.slice(0, 200)}"`);
      for (const g of s.guidance) {
        const gd = GUIDANCE_BY_ID.get(g);
        if (gd) lines.push(`- Guidance: [${gd.title}](${gd.url})`);
      }
      for (const n of s.notes) lines.push(`- Safety check: ${n}`);
      lines.push("");
    });
    if (plan.rejected.length) {
      lines.push("### Removed by safety checks", "");
      for (const r of plan.rejected) lines.push(`- ${r.action} — ${r.reasons.join("; ")}`);
      lines.push("");
    }
    if (plan.missingInfo.length) {
      lines.push("### Information that would improve this comparison", "", ...plan.missingInfo.map((m) => `- ${m}`), "");
    }
  }

  if (changes.length) lines.push(...trackingMarkdown(changes, a, weeks));

  if (feedback && (feedback.changedDecision || feedback.wouldReuse || feedback.note)) {
    lines.push("## Your feedback", "");
    if (feedback.changedDecision) lines.push(`- Changed a decision: ${feedback.changedDecision}`);
    if (feedback.wouldReuse) lines.push(`- Would use again on another listing: ${feedback.wouldReuse}`);
    if (feedback.note) lines.push(`- Note: ${feedback.note}`);
    lines.push("");
  }
  lines.push(`Photo median across comparison listings: ${a.photos.competitorMedian === null ? "unknown" : formatCount(a.photos.competitorMedian)}.`);
  return lines.join("\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Self-contained printable HTML version of the report (print to PDF from the browser). */
export function reportHtml(input: ReportInput): string {
  const md = reportMarkdown(input);
  const html: string[] = [];
  let inList = false;
  let inCode = false;
  let table: string[][] | null = null;
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  const flushTable = () => {
    if (!table) return;
    const [head, , ...rows] = table;
    html.push(
      `<table><thead><tr>${head!.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`,
    );
    table = null;
  };
  for (const line of md.split("\n")) {
    if (line.startsWith("```")) {
      html.push(inCode ? "</pre>" : "<pre>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(esc(line));
      continue;
    }
    if (line.startsWith("|")) {
      (table ??= []).push(line.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|")));
      continue;
    }
    flushTable();
    const li = /^(\s*)- (.*)$/.exec(line);
    if (li) {
      if (!inList) html.push("<ul>");
      inList = true;
      html.push(`<li${li[1] ? ' class="sub"' : ""}>${inline(li[2]!)}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) html.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`);
    else if (line.startsWith("> ")) html.push(`<p class="note">${inline(line.slice(2))}</p>`);
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  }
  flushTable();
  if (inList) html.push("</ul>");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(input.name)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#111}table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0 16px}th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f4f4f2}.note{background:#f1effb;padding:8px 12px;border-radius:6px}pre{background:#f4f4f2;padding:10px;white-space:pre-wrap}li.sub{margin-left:20px;color:#555;list-style:circle}h3{margin-top:20px}@media print{a{color:inherit}}</style></head><body>${html.join("\n")}</body></html>`;
}
