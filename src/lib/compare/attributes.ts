import type { CompareListing } from "./types";

/**
 * Customer-facing facts that matter for digital downloads, pulled out of a
 * listing's own text with the snippet that proves each one. Nothing here is
 * guessed: if the words aren't in the listing, the attribute isn't stated.
 */

export type AttributeKey =
  | "formats"
  | "sizes"
  | "quantity"
  | "software"
  | "editing"
  | "license"
  | "delivery"
  | "audience";

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  formats: "File formats",
  sizes: "Sizes / dimensions",
  quantity: "What's included (count)",
  software: "Software / compatibility",
  editing: "Editing requirements",
  license: "Licence / usage terms",
  delivery: "Delivery (instant / no physical item)",
  audience: "Intended buyer or use",
};

/** Why each fact matters to a buyer, used in findings. */
export const ATTRIBUTE_WHY: Record<AttributeKey, string> = {
  formats: "buyers need to know they can open the files",
  sizes: "buyers check whether it fits their printer, frame or device",
  quantity: "buyers compare how much they get for the price",
  software: "buyers need to know which app or device it works with",
  editing: "buyers want to know whether and how they can customise it",
  license: "buyers need to know what they're allowed to do with it",
  delivery: "buyers should know it's a download and nothing will be posted",
  audience: "buyers look for something made for their situation",
};

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABELS) as AttributeKey[];

interface Matcher {
  re: RegExp;
  /** Canonical value; defaults to the matched text. */
  value?: (m: RegExpMatchArray) => string;
}

const MATCHERS: Record<AttributeKey, Matcher[]> = {
  formats: [
    { re: /\b(pdf|png|jpe?g|svg|dxf|eps|psd|docx?|xlsx?|pptx?|zip|epub|mp3|mp4|ttf|otf)\b/gi, value: (m) => m[1]!.toUpperCase().replace("JPEG", "JPG") },
    { re: /\bcanva (template|link)\b/gi, value: () => "Canva template" },
    { re: /\bgoogle (sheets?|docs|slides)\b/gi, value: (m) => `Google ${m[1]!.replace(/s$/i, "s")}` },
    { re: /\bhyperlinked pdf\b/gi, value: () => "PDF (hyperlinked)" },
    { re: /\bnotion template\b/gi, value: () => "Notion template" },
  ],
  sizes: [
    { re: /\b(a[3-6])\b(?!-?\w)/gi, value: (m) => m[1]!.toUpperCase() },
    { re: /\b(us letter|half letter|letter size|legal size|tabloid)\b/gi, value: (m) => titleCase(m[1]!) },
    { re: /\b(\d{1,2}(?:\.\d+)?)\s?(?:x|×|by)\s?(\d{1,2}(?:\.\d+)?)\s?(in(?:ch(?:es)?)?|"|cm|mm)?(?=\W|$)/gi, value: (m) => `${m[1]}x${m[2]}${m[3] ? (/cm|mm/i.test(m[3]) ? ` ${m[3].toLowerCase()}` : " in") : ""}` },
    { re: /\b(\d{3,4})\s?(?:x|×)\s?(\d{3,4})\s?(px|pixels)\b/gi, value: (m) => `${m[1]}x${m[2]} px` },
    { re: /\b(\d{2,4})\s?dpi\b/gi, value: (m) => `${m[1]} dpi` },
  ],
  quantity: [
    {
      re: /\b(\d{1,4})\+?\s?(pages?|files?|templates?|designs?|sheets?|printables?|svgs?|pngs?|worksheets?|cards?|stickers?|slides?|images?|patterns?|fonts?|presets?)\b/gi,
      value: (m) => `${m[1]} ${m[2]!.toLowerCase()}`,
    },
  ],
  software: [
    {
      re: /\b(canva|adobe (?:acrobat|reader|photoshop|illustrator)|photoshop|illustrator|procreate|cricut(?: design space)?|silhouette(?: studio)?|goodnotes|notability|ipad|android|google sheets|excel|microsoft word|notion|lightroom|xodo|zinnia)\b/gi,
      value: (m) => titleCase(m[1]!),
    },
  ],
  editing: [
    { re: /\b(fully editable|editable|customi[sz]able|personali[sz]able|not editable|non-editable|free canva account|canva free account|edit (?:it )?in canva)\b/gi, value: (m) => m[1]!.toLowerCase() },
  ],
  license: [
    { re: /\b(personal use(?: only)?|commercial use(?: (?:allowed|permitted|not permitted|not allowed))?|commercial licen[cs]e|small business licen[cs]e|no resale|not for resale|do not resell|pod allowed)\b/gi, value: (m) => m[1]!.toLowerCase() },
  ],
  delivery: [
    { re: /\b(instant(?:ly)? download(?:able)?|digital download|no physical (?:item|product)s?(?: will be (?:shipped|sent|mailed))?|nothing will be (?:shipped|sent|mailed)|download link|digital file)\b/gi, value: (m) => m[1]!.toLowerCase() },
  ],
  audience: [
    {
      re: /\bfor (teachers?|students?|kids|toddlers|moms?|dads?|couples|families|small business(?:es)?|beginners|homeschool(?:ers|ing)?|nurses?|brides?|weddings?|college|busy (?:moms|parents)|freelancers|crafters|etsy sellers)\b/gi,
      value: (m) => `for ${m[1]!.toLowerCase()}`,
    },
    { re: /\b(teacher|classroom|homeschool|wedding|baby shower|bridal shower|birthday party|small business|college students?)\b/gi, value: (m) => m[1]!.toLowerCase() },
  ],
};

function titleCase(s: string): string {
  return s
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bipad\b/i, "iPad")
    .replace(/\bgoodnotes\b/i, "GoodNotes");
}

export type TextField = "title" | "tags" | "description";

export interface AttributeEvidence {
  field: TextField;
  /** The exact matched words, verbatim from the field. */
  quote: string;
  /** The match with surrounding context, for display. */
  snippet: string;
}

export type AttributeStatus = "stated" | "not_stated" | "unknown";

export interface AttributeResult {
  key: AttributeKey;
  status: AttributeStatus;
  values: string[];
  evidence: AttributeEvidence[];
}

/** A short window of text around a match, used as visible evidence. */
export function snippetAround(text: string, index: number, length: number, pad = 40): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

/** Values of one attribute found in a piece of text, with match positions. */
export function findAttributeValues(key: AttributeKey, text: string): { value: string; index: number; match: string }[] {
  const out: { value: string; index: number; match: string }[] = [];
  for (const m of MATCHERS[key]) {
    for (const hit of text.matchAll(m.re)) {
      out.push({ value: m.value ? m.value(hit) : hit[0], index: hit.index ?? 0, match: hit[0] });
    }
  }
  return out;
}

function fieldTexts(l: CompareListing): { field: TextField; text: string }[] {
  const out: { field: TextField; text: string }[] = [{ field: "title", text: l.title }];
  if (l.tags) out.push({ field: "tags", text: l.tags.join(", ") });
  if (l.description !== null) out.push({ field: "description", text: l.description });
  return out;
}

export function extractAttributes(l: CompareListing): Record<AttributeKey, AttributeResult> {
  const fields = fieldTexts(l);
  const result = {} as Record<AttributeKey, AttributeResult>;
  for (const key of ATTRIBUTE_KEYS) {
    const values: string[] = [];
    const evidence: AttributeEvidence[] = [];
    for (const { field, text } of fields) {
      for (const hit of findAttributeValues(key, text)) {
        if (!values.some((v) => v.toLowerCase() === hit.value.toLowerCase())) values.push(hit.value);
        if (evidence.length < 3 && !evidence.some((e) => e.field === field)) {
          evidence.push({ field, quote: hit.match, snippet: snippetAround(text, hit.index, hit.match.length) });
        }
      }
    }
    // Without a description we can't say a fact is missing — it may be stated there.
    const status: AttributeStatus = values.length ? "stated" : l.description === null ? "unknown" : "not_stated";
    result[key] = { key, status, values, evidence };
  }
  return result;
}

/**
 * Every product fact (format, size, count, software, licence term) mentioned
 * in `text`. Used to catch suggested edits that state facts the seller's own
 * listing never mentions.
 */
export function factsIn(text: string): { key: AttributeKey; value: string }[] {
  const keys: AttributeKey[] = ["formats", "sizes", "quantity", "software", "license", "editing"];
  const out: { key: AttributeKey; value: string }[] = [];
  for (const key of keys) {
    for (const hit of findAttributeValues(key, text)) {
      if (!out.some((o) => o.key === key && o.value.toLowerCase() === hit.value.toLowerCase())) out.push({ key, value: hit.value });
    }
  }
  return out;
}
