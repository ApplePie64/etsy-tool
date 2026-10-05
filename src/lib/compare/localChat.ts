import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS, type AttributeKey } from "./attributes";
import { formatCount, formatPrice, labelOf, type ComparisonAnalysis } from "./analyze";
import type { Plan } from "./plan";

/**
 * Offline answers about a comparison, used when the AI is off. Everything is
 * read from the analysis, so it can't invent facts; questions unrelated to
 * the comparison get a short scope reply.
 */

type Topic = "plan" | "price" | "coverage" | "info" | "photos" | "safety" | "listing" | "overview" | "offtopic";

const PATTERNS: [Topic, RegExp][] = [
  ["safety", /\b(ignore|instructions?|injection|hidden text|suspicious)\b/i],
  ["plan", /\b(what should i|first|priorit\w*|plan|improve|fix|change|next|to-?do|suggest\w*)\b/i],
  ["price", /\b(pric\w*|cost|cheap\w*|expensive|charge|currency|eur|usd|gbp)\b/i],
  ["photos", /\b(photos?|pictures?|images?|video|mockups?|thumbnails?)\b/i],
  ["coverage", /\b(tags?|keywords?|titles?|phrases?|search|seo|terms?|wording)\b/i],
  ["info", /\b(descriptions?|info\w*|missing|formats?|sizes?|licen[cs]e|delivery|download|software|canva|pdf|editable|what you get|included?)\b/i],
];

const ON_TOPIC = /\b(listing|listings|etsy|shop|compar\w*|competitors?|mine|my|sell\w*|buyers?|sample|them|they|others?|better|worse|different|difference)\b/i;

export function detectCompareTopic(q: string, a: ComparisonAnalysis): Topic {
  if (mentionedListing(q, a)) return "listing";
  for (const [t, re] of PATTERNS) if (re.test(q)) return t;
  return ON_TOPIC.test(q) ? "overview" : "offtopic";
}

function mentionedListing(q: string, a: ComparisonAnalysis): string | null {
  for (const c of a.competitors) {
    const label = c.label.toLowerCase();
    const n = c.id.slice(1);
    if (q.toLowerCase().includes(label) || new RegExp(`\\b(competitor|listing|comparison listing|#)\\s?${n}\\b`, "i").test(q)) return c.id;
  }
  return null;
}

const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");

function attrLine(a: ComparisonAnalysis, id: string, key: AttributeKey): string {
  const r = a.attributes[id]![key];
  return r.status === "stated" ? r.values.join(", ") : r.status === "unknown" ? "unknown (no description)" : "not stated";
}

export function localCompareAnswer(question: string, a: ComparisonAnalysis, plan: Plan | null): string {
  const mine = a.mine;
  if (!mine) return "Add your own listing first, then I can compare it.";
  const topic = detectCompareTopic(question, a);

  switch (topic) {
    case "offtopic":
      return "I can only help with this listing comparison — for example, what your listing is missing compared with the others, how prices compare, or what to change first.";
    case "safety": {
      const flagged = a.findings.filter((f) => f.area === "safety");
      return flagged.length
        ? `${flagged.map((f) => `**${f.title}.** ${f.detail}`).join("\n\n")}\n\nThe flagged text is shown in the evidence so you can see exactly what was ignored.`
        : "None of the listings contain instruction-like text. Listing text is always treated as data, never as instructions.";
    }
    case "listing": {
      const id = mentionedListing(question, a)!;
      const c = a.listings.find((l) => l.id === id)!;
      const diffs = ATTRIBUTE_KEYS.filter((k) => a.attributes[id]![k].status === "stated" && a.attributes[mine.id]![k].status === "not_stated").map(
        (k) => `**${ATTRIBUTE_LABELS[k]}:** ${c.label} states ${attrLine(a, id, k)}; yours doesn't.`,
      );
      const priceLine =
        c.currency && mine.currency && c.currency !== mine.currency
          ? `Price: ${formatPrice(c.price, c.currency)} — a different currency from yours, so not compared.`
          : `Price: ${formatPrice(c.price, c.currency)} vs yours ${formatPrice(mine.price, mine.currency)}.`;
      return [
        `### ${c.label} vs your listing`,
        `Title: "${c.title}"`,
        diffs.length ? bullets(diffs) : "It doesn't state any customer-facing details that yours leaves out.",
        bullets([priceLine, `Photos: ${c.photoCount ?? "unknown"} vs yours ${mine.photoCount ?? "unknown"}.`, `Tags: ${c.tags ? c.tags.length : "unknown (not visible)"}.`]),
        `_Recorded ${c.capturedAt}${c.source === "sample" ? " · sample data" : ""}._`,
      ].join("\n\n");
    }
    case "price": {
      const p = a.price;
      if (mine.price === null || !mine.currency) return "Your price or currency is unknown, so prices can't be compared. Add them to your listing details.";
      if (p.position === "no-comparison") return `None of the comparison listings are priced in ${mine.currency}, so there's nothing to compare against. No currency conversion is applied.`;
      const others = p.comparable.map((x) => `${labelOf(a.listings, x.id)} ${formatPrice(x.price, mine.currency)}`);
      return [
        `### Price`,
        `Yours: **${formatPrice(mine.price, mine.currency)}** — ${p.position === "below" ? "below every" : p.position === "above" ? "above every" : "within the range of the"} listing priced in ${mine.currency} (${others.join(", ")}).`,
        p.excluded.length ? `Not compared: ${p.excluded.map((e) => `${labelOf(a.listings, e.id)} (${e.reason})`).join("; ")}.` : "",
        "This describes position only. Compare what each listing includes — pages, formats, editing, licence — before changing your price.",
      ].filter(Boolean).join("\n\n");
    }
    case "coverage": {
      const gaps = a.coverage.gaps;
      const tagFinding = a.findings.find((f) => f.id === "mine-tag-count" || f.id === "mine-tags-unknown");
      return [
        "### Title & tag coverage",
        gaps.length
          ? `Phrases most of the listings you chose use, and yours doesn't:\n${bullets(gaps.map((g) => `"${g.term}" — ${g.competitorCount} of ${a.competitors.length}`))}`
          : "Your title and tags already cover the phrases the comparison listings share.",
        tagFinding ? `**${tagFinding.title}.** ${tagFinding.detail}` : "",
        "These counts come from the listings you picked, not from shopper searches. Check demand in Etsy's Marketplace Insights, and only use phrases that describe your product.",
      ].filter(Boolean).join("\n\n");
    }
    case "info": {
      const rows = ATTRIBUTE_KEYS.map((k) => {
        const others = a.competitors.filter((c) => a.attributes[c.id]![k].status === "stated").length;
        return `**${ATTRIBUTE_LABELS[k]}:** yours — ${attrLine(a, mine.id, k)}; ${others} of ${a.competitors.length} others state it.`;
      });
      return ["### Customer-facing details", bullets(rows), "Add only details that are true for your product."].join("\n\n");
    }
    case "photos":
      return [
        "### Photos & video",
        `Yours: ${mine.photoCount ?? "unknown"} photos${mine.hasVideo === null ? "" : mine.hasVideo ? ", with video" : ", no video"}. Comparison median: ${a.photos.competitorMedian === null ? "unknown" : formatCount(a.photos.competitorMedian)} (from ${a.photos.known} listing${a.photos.known === 1 ? "" : "s"} with a known count).`,
        "For digital downloads, use photos to show page previews, a \"what you get\" graphic and a print or device mockup.",
      ].join("\n\n");
    case "plan": {
      const s = plan?.suggestions ?? [];
      if (!s.length) return "Generate the improvement plan first — then I can walk you through it.";
      return ["### Where to start", bullets(s.slice(0, 3).map((x) => `**${x.action}** ${x.needsSellerInput ? `_First: ${x.needsSellerInput}_` : ""}`.trim()))].join("\n\n");
    }
    case "overview":
    default: {
      const top = a.findings.filter((f) => f.severity !== "info").slice(0, 3);
      return [
        "### What stands out",
        top.length ? bullets(top.map((f) => `**${f.title}.** ${f.detail}`)) : "No clear gaps on the checks this app runs.",
        "Ask about prices, tags and titles, missing details, photos, or a specific listing (e.g. \"Sample B\").",
      ].join("\n\n");
    }
  }
}
