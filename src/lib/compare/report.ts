import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "./attributes";
import { formatCount, formatPrice, labelOf, type ComparisonAnalysis } from "./analyze";
import { GUIDANCE_BY_ID } from "./guidance";
import type { Plan } from "./plan";
import { SAMPLE_NOTICE } from "./sample";
import { CATEGORY_LABELS, type Category } from "./types";

export interface Feedback {
  changedDecision: "yes" | "no" | "unsure" | null;
  wouldReuse: "yes" | "no" | null;
  note: string;
}

export interface ReportInput {
  name: string;
  category: Category;
  createdAt: string;
  analysis: ComparisonAnalysis;
  plan: Plan | null;
  feedback: Feedback | null;
}

const DISCLAIMER =
  "This report compares listing content you supplied. It is not Etsy's ranking score and does not predict ranking, traffic or sales. Counts of phrases come from the listings you chose, not from shopper searches.";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

function attrCell(a: ComparisonAnalysis, id: string, key: (typeof ATTRIBUTE_KEYS)[number]): string {
  const r = a.attributes[id]![key];
  return r.status === "stated" ? r.values.join(", ") : r.status === "unknown" ? "Unknown" : "Not stated";
}

export function reportMarkdown({ name, category, createdAt, analysis: a, plan, feedback }: ReportInput): string {
  const L = a.listings;
  const lines: string[] = [];
  lines.push(`# ${name}`, "");
  lines.push(`${CATEGORY_LABELS[category]} · created ${createdAt.slice(0, 10)} · report generated ${new Date().toISOString().slice(0, 10)}`, "");
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
  for (const k of ATTRIBUTE_KEYS) lines.push(`| ${ATTRIBUTE_LABELS[k]} | ${L.map((l) => cell(attrCell(a, l.id, k))).join(" | ")} |`);
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
