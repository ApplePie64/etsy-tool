import { ETSY_LIMITS } from "../seo/rules";
import { ATTRIBUTE_LABELS, factsIn, type AttributeKey } from "./attributes";
import type { ComparisonAnalysis } from "./analyze";
import type { Evidence } from "./types";

export const PLAN_AREAS = ["title", "tags", "description", "photos", "price", "information", "other"] as const;
export type PlanArea = (typeof PLAN_AREAS)[number];
export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A suggestion as produced by the AI or the rules engine, before checking. */
export interface RawSuggestion {
  priority: Priority;
  area: PlanArea;
  action: string;
  why: string;
  evidence: Evidence[];
  guidance: string[];
  /** Ready-to-use wording, built only from facts in the seller's own listing. */
  proposedText: string | null;
  /** A fact the seller must confirm or supply first. */
  needsSellerInput: string | null;
}

export interface RawPlan {
  summary: string;
  suggestions: RawSuggestion[];
  missingInfo: string[];
}

export interface PlanSuggestion extends RawSuggestion {
  id: string;
  /** What the safety checks changed, shown to the seller. */
  notes: string[];
}

export interface RejectedSuggestion {
  action: string;
  reasons: string[];
}

export interface Plan {
  source: "ai" | "rules";
  model: string | null;
  generatedAt: string;
  summary: string;
  suggestions: PlanSuggestion[];
  missingInfo: string[];
  rejected: RejectedSuggestion[];
}

/** JSON schema the AI must answer in (structured outputs). */
export const RAW_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "suggestions", "missingInfo"],
  properties: {
    summary: { type: "string", description: "2–3 sentences: the most important differences and what to do first." },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "area", "action", "why", "evidence", "guidance", "proposedText", "needsSellerInput"],
        properties: {
          priority: { type: "string", enum: [...PRIORITIES] },
          area: { type: "string", enum: [...PLAN_AREAS] },
          action: { type: "string", description: "One concrete change to the seller's listing." },
          why: { type: "string", description: "Why it matters to buyers, tied to the evidence." },
          evidence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["ref", "quote"],
              properties: {
                ref: { type: "string", description: 'Listing id and field, e.g. "c2.description" or "mine.title".' },
                quote: { type: "string", description: "Text copied exactly from that field, or the value for numeric fields." },
              },
            },
          },
          guidance: { type: "array", items: { type: "string" }, description: "Ids from the guidance list." },
          proposedText: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Replacement wording using only facts from the seller's listing; [placeholders] for anything unknown. Null if not applicable.",
          },
          needsSellerInput: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "A question the seller must answer before making this change, or null.",
          },
        },
      },
    },
    missingInfo: { type: "array", items: { type: "string" }, description: "Information that would make the comparison more reliable." },
  },
} as const;

/** Lowercased text of the seller's own listing, the only source of facts for edits. */
export function ownFactsText(a: ComparisonAnalysis): string {
  if (!a.mine) return "";
  return [a.mine.title, ...(a.mine.tags ?? []), a.mine.description ?? "", a.mine.notes ?? ""].join("\n");
}

/** Phrases whose product facts (formats, sizes...) all appear in the seller's listing. */
function safeForSeller(a: ComparisonAnalysis, phrase: string): boolean {
  const own = factsIn(ownFactsText(a)).map((f) => f.value.toLowerCase());
  return factsIn(phrase).every((f) => own.includes(f.value.toLowerCase()));
}

/**
 * Deterministic plan used when the AI is off, and as a baseline. It only
 * restates what the analysis found, so every suggestion is evidence-backed.
 */
export function rulesPlan(a: ComparisonAnalysis): RawPlan {
  const suggestions: RawSuggestion[] = [];
  const mine = a.mine;
  const missingInfo = new Set<string>();

  if (!mine) {
    return { summary: "Add your own listing to get suggestions.", suggestions: [], missingInfo: ["Your listing"] };
  }

  for (const f of a.findings) {
    if (f.id.startsWith("missing-")) {
      const key = f.id.slice("missing-".length) as AttributeKey;
      suggestions.push({
        priority: f.severity === "high" ? "high" : f.severity === "medium" ? "medium" : "low",
        area: "description",
        action: `State your ${ATTRIBUTE_LABELS[key].toLowerCase()} near the top of the description.`,
        why: f.detail,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: `${ATTRIBUTE_LABELS[key]}: [add yours]`,
        needsSellerInput: f.ask ?? null,
      });
    } else if (f.id === "coverage-gaps") {
      const safe = a.coverage.gaps.filter((g) => safeForSeller(a, g.term)).map((g) => g.term);
      const unsafe = a.coverage.gaps.filter((g) => !safeForSeller(a, g.term)).map((g) => g.term);
      suggestions.push({
        priority: "medium",
        area: "tags",
        action: "Use the phrases below in your title or tags if they describe your product.",
        why: f.detail,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: safe.length ? safe.join(", ") : null,
        needsSellerInput: unsafe.length
          ? `These phrases mention details your listing doesn't state: ${unsafe.join(", ")}. Use them only if they're true for your product.`
          : (f.ask ?? null),
      });
    } else if (f.id === "mine-tag-count" && mine.tags) {
      const free = ETSY_LIMITS.tagCount - mine.tags.length;
      const have = new Set(mine.tags.map((t) => t.toLowerCase()));
      // When the coverage suggestion already lists phrases, don't repeat them here.
      const ideas = a.findings.some((x) => x.id === "coverage-gaps")
        ? []
        : a.coverage.gaps
            .map((g) => g.term)
            .filter((t) => t.length <= ETSY_LIMITS.tagMaxChars && !have.has(t) && safeForSeller(a, t))
            .slice(0, free);
      suggestions.push({
        priority: "medium",
        area: "tags",
        action: `Fill your ${free} unused tag slot${free === 1 ? "" : "s"} with multi-word phrases buyers would type.`,
        why: f.detail,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: ideas.length ? ideas.join(", ") : null,
        needsSellerInput:
          ideas.length < free
            ? "Which other phrases describe your product? Candidates: the phrases in the coverage suggestion, then Etsy's search-bar autocomplete."
            : null,
      });
    } else if (f.id === "mine-tag-length" || f.id === "mine-title-length") {
      suggestions.push({
        priority: "high",
        area: f.area === "title" ? "title" : "tags",
        action: f.title.replace("Some tags are", "Shorten tags that are").replace("Title is", "Shorten your title — it is"),
        why: f.detail,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: null,
        needsSellerInput: null,
      });
    } else if (f.id === "photos-fewer") {
      suggestions.push({
        priority: f.severity === "high" ? "high" : "medium",
        area: "photos",
        action:
          a.category === "digital"
            ? "Add photos that show what's inside: page previews, a \"what you get\" graphic, and a print or device mockup."
            : "Add photos that show scale, close-ups of the finish, each option, and the packaging.",
        why: `${f.title}. ${f.detail}`,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: null,
        needsSellerInput: null,
      });
    } else if (f.id === "video-missing") {
      suggestions.push({
        priority: "low",
        area: "photos",
        action: a.category === "digital" ? "Add a short flip-through video of the pages or files." : "Add a short video of the item in use.",
        why: f.detail,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: null,
        needsSellerInput: null,
      });
    } else if (f.id === "price-position" && (a.price.position === "below" || a.price.position === "above")) {
      suggestions.push({
        priority: "low",
        area: "price",
        action:
          a.price.position === "below"
            ? "Before changing price, compare what each listing includes; if yours offers as much, your price may leave value on the table."
            : a.category === "digital"
              ? "Make sure the listing shows what justifies the higher price (more pages, formats, editing options or licence)."
              : "Make sure the listing shows what justifies the higher price (materials, size, craftsmanship, personalisation, packaging).",
        why: f.detail,
        evidence: f.evidence,
        guidance: f.guidance,
        proposedText: null,
        needsSellerInput: null,
      });
    } else if (f.ask && f.area === "data") {
      missingInfo.add(f.ask);
    }
  }

  for (const m of a.missing) {
    // Missing tags already have their own ask ("Paste your 13 tags").
    if (m.listingId === mine.id && m.field !== "tags") missingInfo.add(`Your ${m.label.split(": ")[1]?.replace(" unknown", "") ?? m.field}`);
  }
  if (a.competitors.some((c) => c.tags === null)) {
    missingInfo.add("Comparison listings' tags (usually not visible on Etsy) — coverage uses their titles only.");
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  const top = [...suggestions].sort((x, y) => rank[x.priority] - rank[y.priority]).slice(0, 8);
  const highs = top.filter((s) => s.priority === "high").length;
  const summary = top.length
    ? `Found ${top.length} change${top.length === 1 ? "" : "s"} worth considering${highs ? `, ${highs} high priority` : ""}, based only on differences between your listing and the ${a.competitors.length} you chose. These describe your listing's content; they don't predict ranking or sales.`
    : "No clear gaps between your listing and the comparison set on the checks this app runs.";
  return { summary, suggestions: top, missingInfo: [...missingInfo] };
}
