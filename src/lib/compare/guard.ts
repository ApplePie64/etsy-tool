import { factsIn } from "./attributes";
import { fieldText, parseRef, type ComparisonAnalysis } from "./analyze";
import { GUIDANCE_BY_ID } from "./guidance";
import { ownFactsText, PLAN_AREAS, PRIORITIES, type Plan, type PlanSuggestion, type RawPlan, type RejectedSuggestion } from "./plan";
import type { Evidence } from "./types";

/**
 * Every plan — from the AI or the rules engine — passes through here before a
 * seller sees it. The checks are deterministic:
 *  1. evidence must point at a real field and quote it exactly,
 *  2. suggested wording may only state product facts the seller's own listing states,
 *  3. sales, revenue, traffic or ranking predictions are rejected.
 */

const CLAIM =
  /\b(guarantee[sd]?|guaranteed|will (?:definitely |certainly |surely )?(?:rank|increase|boost|double|triple|skyrocket|improve (?:your )?(?:ranking|sales|conversion))|rank (?:#\s?1|first|number one|on (?:the )?first page)|top (?:of|spot in) (?:etsy )?search(?: results)?|first page of (?:etsy|search)|\d+(?:\.\d+)?\s?%\s?(?:more|increase|boost|higher|lift)|(?:increase|boost|double|triple|grow) (?:your )?(?:sales|revenue|orders|traffic|conversions?|views) by|\d+\s?(?:sales|orders)\s?(?:per|a|\/|each)\s?(?:month|week|day)|monthly sales|(?:sales|revenue) estimates?|estimated (?:monthly )?(?:sales|revenue)|bestseller badge)\b/i;

export function hasUnsupportedClaim(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = CLAIM.exec(text);
  return m ? m[0] : null;
}

/** Price changes are the seller's call; the comparison only describes price position. */
const PRICE_PRESCRIPTION = /(?:(?:lower|raise|drop|cut|increase|reduce|change|set)\s+(?:your\s+|the\s+)?price\s+to\b|(?:charge|price (?:it|this|your listing) at)\s+[$€£]?\s?\d)/i;

export function prescribesPrice(text: string | null | undefined): boolean {
  return !!text && PRICE_PRESCRIPTION.test(text);
}

/** Four-word sequences from instruction-like text found inside listings. */
function injectedPhrases(a: ComparisonAnalysis): Set<string> {
  const out = new Set<string>();
  for (const f of a.findings) {
    if (f.area !== "safety") continue;
    for (const e of f.evidence) {
      const w = e.quote.toLowerCase().match(/[a-z0-9$#]+/g) ?? [];
      for (let i = 0; i + 4 <= w.length; i++) out.add(w.slice(i, i + 4).join(" "));
    }
  }
  return out;
}

/** True when `text` repeats four or more consecutive words of an injected instruction. */
export function echoesInjection(text: string, phrases: Set<string>): boolean {
  if (!phrases.size) return false;
  const w = text.toLowerCase().match(/[a-z0-9$#]+/g) ?? [];
  for (let i = 0; i + 4 <= w.length; i++) if (phrases.has(w.slice(i, i + 4).join(" "))) return true;
  return false;
}

const norm = (s: string) => s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();

export function verifyEvidence(e: Evidence, a: ComparisonAnalysis): { ok: boolean; reason?: string } {
  const parsed = parseRef(e.ref);
  if (!parsed) return { ok: false, reason: `"${e.ref}" isn't a valid field reference` };
  const listing = a.listings.find((l) => l.id === parsed.listingId);
  if (!listing) return { ok: false, reason: `no listing "${parsed.listingId}"` };
  const text = fieldText(listing, parsed.field);
  if (text === null) return { ok: false, reason: `${listing.label}'s ${parsed.field} is unknown` };
  const q = (e.quote ?? "").trim();
  if (!q) return { ok: false, reason: "empty quote" };
  if (["price", "photoCount", "reviewCount"].includes(parsed.field)) {
    const n = Number(q.replace(/[^\d.]/g, ""));
    return Math.abs(n - Number(text)) < 0.005 ? { ok: true } : { ok: false, reason: `${e.ref} is ${text}, not ${q}` };
  }
  if (parsed.field === "hasVideo" || parsed.field === "currency") {
    return norm(q) === norm(text) ? { ok: true } : { ok: false, reason: `${e.ref} is "${text}"` };
  }
  return norm(text).includes(norm(q.replace(/^…|…$/g, ""))) ? { ok: true } : { ok: false, reason: `quote not found in ${e.ref}` };
}

/** Product facts and numbers in `proposed` that the seller's own listing never states. */
export function inventedFacts(proposed: string, a: ComparisonAnalysis): string[] {
  const own = ownFactsText(a);
  const ownFacts = new Set(factsIn(own).map((f) => f.value.toLowerCase()));
  const invented = factsIn(proposed)
    .filter((f) => !ownFacts.has(f.value.toLowerCase()))
    .map((f) => f.value);
  const ownNumbers = new Set(own.match(/\d+(?:\.\d+)?/g) ?? []);
  for (const n of proposed.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!ownNumbers.has(n) && !invented.some((v) => v.includes(n))) invented.push(n);
  }
  return [...new Set(invented)];
}

const MAX_SUGGESTIONS = 8;
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function validatePlan(raw: RawPlan, a: ComparisonAnalysis, meta: { source: Plan["source"]; model: string | null }): Plan {
  const rejected: RejectedSuggestion[] = [];
  const accepted: PlanSuggestion[] = [];
  const seen = new Set<string>();
  const injected = injectedPhrases(a);

  for (const s of raw.suggestions ?? []) {
    const action = clip(String(s.action ?? "").trim(), 400);
    const why = clip(String(s.why ?? "").trim(), 800);
    if (!action) continue;
    const key = norm(action);
    if (seen.has(key)) continue;
    seen.add(key);

    const reasons: string[] = [];
    const claim = hasUnsupportedClaim(action) ?? hasUnsupportedClaim(why) ?? hasUnsupportedClaim(s.proposedText);
    if (claim) reasons.push(`makes an unsupported sales or ranking claim ("${claim}")`);
    if (prescribesPrice(action) || prescribesPrice(s.proposedText)) reasons.push("prescribes a specific price; the comparison only describes price position");
    if (echoesInjection([action, why, s.proposedText ?? ""].join(" "), injected)) reasons.push("repeats instructions found inside a listing");

    const notes: string[] = [];
    const evidence: Evidence[] = [];
    for (const e of s.evidence ?? []) {
      const v = verifyEvidence(e, a);
      if (v.ok) evidence.push({ ref: e.ref.trim(), quote: e.quote.trim() });
      else notes.push(`Dropped evidence: ${v.reason}.`);
    }
    if (evidence.length === 0) reasons.push("cites no evidence that can be found in the listings");

    if (reasons.length) {
      rejected.push({ action, reasons });
      continue;
    }

    let proposedText = typeof s.proposedText === "string" && s.proposedText.trim() ? clip(s.proposedText.trim(), 1200) : null;
    let needsSellerInput = typeof s.needsSellerInput === "string" && s.needsSellerInput.trim() ? clip(s.needsSellerInput.trim(), 400) : null;
    if (proposedText) {
      const invented = inventedFacts(proposedText, a);
      if (invented.length) {
        notes.push(`Suggested wording removed: it states ${invented.map((x) => `"${x}"`).join(", ")}, which your listing doesn't mention.`);
        proposedText = null;
        needsSellerInput = needsSellerInput ?? `Does your product really include ${invented.join(", ")}? Add it only if it's true.`;
      }
    }

    accepted.push({
      id: `s${accepted.length + 1}`,
      priority: (PRIORITIES as readonly string[]).includes(s.priority) ? s.priority : "medium",
      area: (PLAN_AREAS as readonly string[]).includes(s.area) ? s.area : "other",
      action,
      why,
      evidence,
      guidance: [...new Set((s.guidance ?? []).filter((g) => GUIDANCE_BY_ID.has(g)))],
      proposedText,
      needsSellerInput,
      notes,
    });
    if (accepted.length >= MAX_SUGGESTIONS) break;
  }

  // Summary: keep only sentences without unsupported claims.
  const sentences = String(raw.summary ?? "").split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((x) => !hasUnsupportedClaim(x) && !echoesInjection(x, injected));
  if (kept.length < sentences.length) {
    rejected.push({ action: "Part of the summary", reasons: ["made an unsupported claim or repeated instructions found in a listing"] });
  }

  const order = { high: 0, medium: 1, low: 2 } as const;
  accepted.sort((x, y) => order[x.priority] - order[y.priority]);
  accepted.forEach((s, i) => (s.id = `s${i + 1}`));

  return {
    source: meta.source,
    model: meta.model,
    generatedAt: new Date().toISOString(),
    summary: clip(kept.join(" ").trim(), 1200) || "Suggestions below are based on differences between your listing and the comparison set.",
    suggestions: accepted,
    missingInfo: (raw.missingInfo ?? []).map((m) => clip(String(m), 300)).filter((m) => m && !hasUnsupportedClaim(m)).slice(0, 10),
    rejected,
  };
}
