import type { Category, CompareListing } from "./types";

/**
 * Customer-facing facts pulled out of a listing's own text, with the words
 * that prove each one. Nothing is guessed: if the words aren't in the
 * listing (or in notes the seller added), the fact isn't stated.
 *
 * Which facts matter depends on what's being sold, so each category has its
 * own list: file formats and licences for digital downloads; materials,
 * sizes, personalisation and production time for physical products.
 */

export type AttributeKey =
  // digital
  | "formats"
  | "software"
  | "editing"
  | "license"
  | "delivery"
  // physical
  | "materials"
  | "personalization"
  | "options"
  | "production"
  | "shipping"
  | "care"
  | "packaging"
  // both
  | "sizes"
  | "quantity"
  | "audience";

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  formats: "File formats",
  software: "Software / compatibility",
  editing: "Editing requirements",
  license: "Licence / usage terms",
  delivery: "Delivery (instant / no physical item)",
  materials: "Materials",
  personalization: "Personalisation",
  options: "Colours / options",
  production: "Production / processing time",
  shipping: "Shipping & delivery",
  care: "Care & safety",
  packaging: "Packaging / gifting",
  sizes: "Size / dimensions",
  quantity: "What's included",
  audience: "Intended buyer or use",
};

/** Why each fact matters to a buyer, used in findings. */
export const ATTRIBUTE_WHY: Record<AttributeKey, string> = {
  formats: "buyers need to know they can open the files",
  software: "buyers need to know which app or device it works with",
  editing: "buyers want to know whether and how they can customise it",
  license: "buyers need to know what they're allowed to do with it",
  delivery: "buyers should know it's a download and nothing will be posted",
  materials: "buyers judge quality and price by what it's made of",
  personalization: "buyers need to know exactly what they can customise and how",
  options: "buyers look for their colour, size or style before buying",
  production: "gift buyers check whether it will arrive in time",
  shipping: "shipping cost and speed are often the deciding factor",
  care: "buyers want to know it's safe and how to look after it",
  packaging: "many buyers are sending it as a gift",
  sizes: "buyers check whether it fits what they need",
  quantity: "buyers compare how much they get for the price",
  audience: "buyers look for something made for their situation",
};

export const CATEGORY_ATTRIBUTES: Record<Category, AttributeKey[]> = {
  digital: ["formats", "sizes", "quantity", "software", "editing", "license", "delivery", "audience"],
  physical: ["materials", "sizes", "personalization", "options", "production", "shipping", "care", "packaging", "quantity", "audience"],
};

/** The facts most buyers check first, per category; missing ones are high priority. */
export const HIGH_IMPACT: Record<Category, AttributeKey[]> = {
  digital: ["formats", "delivery", "license", "sizes"],
  physical: ["materials", "sizes", "personalization", "production"],
};

interface Matcher {
  re: RegExp;
  /** Canonical value; defaults to the matched text. */
  value?: (m: RegExpMatchArray) => string;
}

const lower = (m: RegExpMatchArray) => m[1]!.toLowerCase().replace(/\s+/g, " ");
const DAYS = String.raw`\d+\s?(?:[–-]|to)?\s?\d*\s?(?:business |working )?(?:days?|weeks?)`;

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
    { re: /\b(\d{1,3}(?:\.\d+)?)\s?(?:x|×|by)\s?(\d{1,3}(?:\.\d+)?)(?:\s?(?:x|×)\s?(\d{1,3}(?:\.\d+)?))?\s?(in(?:ch(?:es)?)?|"|cm|mm)?(?=\W|$)/gi, value: (m) => `${m[1]}x${m[2]}${m[3] ? `x${m[3]}` : ""}${m[4] ? (/cm|mm/i.test(m[4]) ? ` ${m[4].toLowerCase()}` : " in") : ""}` },
    { re: /\b(\d{3,4})\s?(?:x|×)\s?(\d{3,4})\s?(px|pixels)\b/gi, value: (m) => `${m[1]}x${m[2]} px` },
    { re: /\b(\d{2,4})\s?dpi\b/gi, value: (m) => `${m[1]} dpi` },
    { re: /\b(\d+(?:\.\d+)?)\s?(oz|fl ?oz|ounces?|ml|millilit(?:er|re)s?|lit(?:er|re)s?)\b/gi, value: (m) => `${m[1]} ${/^m/i.test(m[2]!) ? "ml" : /^l/i.test(m[2]!) ? "l" : "oz"}` },
    { re: /\b(\d+(?:\.\d+)?)\s?(inch(?:es)?|cm|mm)\b/gi, value: (m) => `${m[1]} ${/^inch/i.test(m[2]!) ? "in" : m[2]!.toLowerCase()}` },
    { re: /\b(\d+(?:\.\d+)?)"(?=\s|$|[,.)])/g, value: (m) => `${m[1]} in` },
    { re: /\b(ring size \d+(?:\.\d+)?|us size \d+(?:\.\d+)?|one size(?: fits (?:all|most))?|adjustable)\b/gi, value: lower },
    { re: /\bsizes?:?\s((?:xxs|xs|s|m|l|xl|xxl|2xl|3xl)(?:\s?[,/-]\s?(?:xxs|xs|s|m|l|xl|xxl|2xl|3xl))+)\b/gi, value: (m) => m[1]!.toUpperCase().replace(/\s/g, "") },
  ],
  quantity: [
    {
      re: /\b(\d{1,4})\+?\s?(pages?|files?|templates?|designs?|sheets?|printables?|svgs?|pngs?|worksheets?|cards?|stickers?|slides?|images?|patterns?|fonts?|presets?)\b/gi,
      value: (m) => `${m[1]} ${m[2]!.toLowerCase()}`,
    },
    { re: /\b(set of \d+|pack of \d+|\d+ ?(?:pcs|pieces|pack)|pair of [a-z]+)\b/gi, value: lower },
  ],
  software: [
    {
      re: /\b(canva|adobe (?:acrobat|reader|photoshop|illustrator)|photoshop|illustrator|procreate|cricut(?: design space)?|silhouette(?: studio)?|goodnotes|notability|ipad|android|google sheets|excel|microsoft word|notion|lightroom|xodo|zinnia)\b/gi,
      value: (m) => titleCase(m[1]!),
    },
  ],
  editing: [
    { re: /\b(fully editable|editable|customi[sz]able|personali[sz]able|not editable|non-editable|free canva account|canva free account|edit (?:it )?in canva)\b/gi, value: lower },
  ],
  license: [
    { re: /\b(personal use(?: only)?|commercial use(?: (?:allowed|permitted|not permitted|not allowed))?|commercial licen[cs]e|small business licen[cs]e|no resale|not for resale|do not resell|pod allowed)\b/gi, value: lower },
  ],
  delivery: [
    { re: /\b(instant(?:ly)? download(?:able)?|digital download|no physical (?:item|product)s?(?: will be (?:shipped|sent|mailed))?|nothing will be (?:shipped|sent|mailed)|download link|digital file)\b/gi, value: lower },
  ],
  materials: [
    {
      re: /\b(polymer clay|ceramic|porcelain|stoneware|earthenware|bone china|clay|glass|crystal|stainless steel|surgical steel|sterling silver|925 silver|silver[- ]plated|gold[- ]plated|gold[- ]filled|(?:10|14|18|22|24)k(?:t)? (?:solid |yellow |white |rose )?gold|solid gold|rose gold|brass|copper|aluminium|aluminum|titanium|tungsten|walnut|oak|maple|cherry wood|birch|pine|bamboo|wood(?:en)?|vegan leather|faux leather|genuine leather|leather|suede|organic cotton|cotton|linen|merino wool|wool|silk|velvet|polyester|canvas|denim|acrylic|epoxy resin|resin|vinyl|cardstock|paper|soy wax|beeswax|coconut wax|enamel|pearls?|gemstones?|marble|concrete|plastic|pla)\b/gi,
      value: lower,
    },
  ],
  personalization: [
    {
      // One spelling for display: "personalised" and "personalized" are the same fact.
      re: /\b(personali[sz]ed|personali[sz]ation|custom(?:i[sz]ed)? (?:name|text|photo|message|date|engraving|portrait)|engrav(?:ed|ing)|monogram(?:med)?|your (?:own )?(?:name|photo|text|message|handwriting|initials?)|add (?:your |a )?(?:name|photo|text|message|date)|up to \d+ characters|photo upload|actual handwriting|handwriting|initials?)\b/gi,
      value: (m) => lower(m).replace(/personalis/g, "personaliz"),
    },
  ],
  options: [
    { re: /\b(available in \d+ (?:colou?rs|sizes|finishes|styles|designs)|\d+ (?:colou?rs|finishes|styles) available|colou?r options?|choose (?:your|from) (?:colou?rs?|sizes?|finish(?:es)?|styles?|fonts?))\b/gi, value: lower },
    { re: /\bcolou?rs?:\s*([a-z ,/&-]{3,60})/gi, value: (m) => m[1]!.trim().toLowerCase() },
  ],
  production: [
    {
      re: new RegExp(String.raw`\b(made to order|ready to ship|handmade to order|(?:ships?|dispatch(?:es|ed)?|sent|posted) (?:with)?in ${DAYS}|(?:processing|production|turnaround|lead) time:?\s?(?:is\s)?${DAYS}|${DAYS} (?:to make|processing|production|turnaround))`, "gi"),
      value: lower,
    },
  ],
  shipping: [
    {
      re: new RegExp(String.raw`\b(free (?:[a-z]{2,3} )?(?:shipping|delivery|postage)|express (?:shipping|delivery|postage)|tracked (?:shipping|delivery|postage)|worldwide (?:shipping|delivery)|international (?:shipping|delivery)|ships? from [a-z]+(?: [a-z]+)?|(?:delivery|shipping) (?:takes |time:?\s?)?(?:with)?in ${DAYS}|arrives? (?:with)?in ${DAYS})`, "gi"),
      value: lower,
    },
  ],
  care: [
    {
      // The optional "not" keeps "not microwave safe" from reading as "microwave safe".
      re: /\b((?:not |non[- ])?(?:dishwasher|microwave|oven|food)[- ]safe|hand[- ]wash(?: only)?|machine washable|do not (?:microwave|soak|put in (?:the )?dishwasher)|waterproof|water[- ]resistant|tarnish[- ](?:free|resistant)|hypoallergenic|nickel[- ]free|lead[- ]free|bpa[- ]free|care instructions?)\b/gi,
      value: lower,
    },
  ],
  packaging: [
    {
      re: /\b(gift[- ]box(?:ed)?|gift[- ]wrap(?:ped|ping)?|gift[- ]ready|ready to gift|gift (?:message|note)|comes (?:in|with) (?:a )?(?:gift )?(?:box|pouch|bag)|jewel(?:le)?ry (?:box|pouch)|eco[- ]friendly packaging|plastic[- ]free packaging|packaged (?:in|with) [a-z ]{3,20})\b/gi,
      value: lower,
    },
  ],
  audience: [
    {
      re: /\bfor (teachers?|students?|kids|toddlers|moms?|mums?|dads?|grandmas?|grandpas?|couples|families|small business(?:es)?|beginners|homeschool(?:ers|ing)?|nurses?|brides?|bridesmaids?|weddings?|college|busy (?:moms|parents)|freelancers|crafters|her|him|women|men|pet lovers|dog lovers|cat lovers)\b/gi,
      value: (m) => `for ${m[1]!.toLowerCase()}`,
    },
    { re: /\b(teacher|classroom|homeschool|wedding|anniversary|birthday|baby shower|bridal shower|mother'?s day|father'?s day|christmas|valentine'?s|memorial|graduation|retirement|housewarming|small business|college students?)\b/gi, value: lower },
  ],
};

function titleCase(s: string): string {
  return s
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bipad\b/i, "iPad")
    .replace(/\bgoodnotes\b/i, "GoodNotes");
}

export type TextField = "title" | "tags" | "description" | "notes";

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

/* ------------------------------------------------------------------ */
/* Notes the seller adds ("Material: stoneware")                       */
/* ------------------------------------------------------------------ */

const NOTE_LABELS: [RegExp, AttributeKey][] = [
  [/^(file )?formats?|file types?$/i, "formats"],
  [/^software|compatib|works with|app$/i, "software"],
  [/^editing|editable$/i, "editing"],
  [/^licen[cs]e|usage|terms$/i, "license"],
  [/^materials?|made (of|from)$/i, "materials"],
  [/^personali[sz]|custom/i, "personalization"],
  [/^colou?rs?|options?|variations?|styles?$/i, "options"],
  [/^production|processing|made to order|turnaround|lead time/i, "production"],
  [/^shipping|postage|ships/i, "shipping"],
  [/^care|safety|washing/i, "care"],
  [/^packaging|gift/i, "packaging"],
  [/^sizes?|dimensions?|capacity|measurements?|length|width|height/i, "sizes"],
  [/^(what'?s )?included|quantity|count|contents|pieces/i, "quantity"],
  [/^(intended )?(buyer|audience|for|occasion|use)/i, "audience"],
];

/** Lines like "Material: stoneware" in the seller's notes, mapped to an attribute. */
export function labelledNotes(notes: string | null, category: Category): { key: AttributeKey; value: string; line: string }[] {
  if (!notes) return [];
  const keys = CATEGORY_ATTRIBUTES[category];
  const out: { key: AttributeKey; value: string; line: string }[] = [];
  for (const line of notes.split("\n")) {
    const m = /^\s*([^:]{2,40}):\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const label = m[1]!.trim();
    let key = NOTE_LABELS.find(([re, k]) => re.test(label) && keys.includes(k))?.[1];
    // "Delivery: ..." means shipping for physical items.
    if (!key && /^delivery/i.test(label)) key = category === "physical" ? "shipping" : "delivery";
    if (!key) key = keys.find((k) => ATTRIBUTE_LABELS[k].toLowerCase() === label.toLowerCase());
    if (key) out.push({ key, value: m[2]!, line: line.trim() });
  }
  return out;
}

function fieldTexts(l: CompareListing): { field: TextField; text: string }[] {
  const out: { field: TextField; text: string }[] = [{ field: "title", text: l.title }];
  if (l.tags) out.push({ field: "tags", text: l.tags.join(", ") });
  if (l.description !== null) out.push({ field: "description", text: l.description });
  if (l.notes) out.push({ field: "notes", text: l.notes });
  return out;
}

/** Whole-word containment, so "1 oz" isn't treated as part of "11 oz". */
function containsPhrase(text: string, phrase: string): boolean {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`, "i").test(text);
}

export function extractAttributes(l: CompareListing, category: Category): Record<AttributeKey, AttributeResult> {
  const fields = fieldTexts(l);
  const noted = labelledNotes(l.notes, category);
  const result = {} as Record<AttributeKey, AttributeResult>;
  for (const key of CATEGORY_ATTRIBUTES[category]) {
    const values: string[] = [];
    const evidence: AttributeEvidence[] = [];
    for (const n of noted.filter((x) => x.key === key)) {
      values.push(n.value);
      evidence.push({ field: "notes", quote: n.line, snippet: n.line });
    }
    for (const { field, text } of fields) {
      for (const hit of findAttributeValues(key, text)) {
        if (!values.some((v) => v.toLowerCase() === hit.value.toLowerCase())) values.push(hit.value);
        if (evidence.length < 3 && !evidence.some((e) => e.field === field)) {
          evidence.push({ field, quote: hit.match, snippet: snippetAround(text, hit.index, hit.match.length) });
        }
      }
    }
    // Drop values another value already covers: "27 cm" next to "27 cm diameter".
    const shown = values.filter((v) => !values.some((w) => w.length > v.length && containsPhrase(w, v)));
    // Without a description we can't say a fact is missing — it may be stated there.
    const status: AttributeStatus = shown.length ? "stated" : l.description === null && !l.notes ? "unknown" : "not_stated";
    result[key] = { key, status, values: shown, evidence };
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Category detection                                                  */
/* ------------------------------------------------------------------ */

const DIGITAL_SIGNALS = /\b(digital download|instant download|printable|svg|pdf|png|canva|template|no physical|digital file|digital planner|clipart|procreate|editable|download)\b/gi;
const PHYSICAL_SIGNALS =
  /\b(ships?|shipping|dispatch(?:es|ed)?|handmade|hand[- ]made|made to order|ceramic|mug|plate|bowl|necklace|bracelet|earrings?|ring|pendant|tumbler|shirt|t-shirt|sweatshirt|hoodie|candle|blanket|pillow|tote|bag|sign|wood(?:en)?|leather|sterling|gold|silver|oz|cm|gift box|engraved|frame|framed|keychain|ornament|coaster|jewel(?:le)?ry)\b/gi;

/** "digital" when most listings read as downloads, otherwise "physical". */
export function detectCategory(listings: CompareListing[]): Category {
  if (!listings.length) return "digital";
  const digital = listings.filter((l) => {
    const text = [l.title, l.description ?? "", ...(l.tags ?? [])].join(" ");
    return (text.match(DIGITAL_SIGNALS)?.length ?? 0) > (text.match(PHYSICAL_SIGNALS)?.length ?? 0);
  }).length;
  return digital > listings.length / 2 ? "digital" : "physical";
}

/**
 * Every product fact (format, size, count, material, care claim...) in
 * `text`. Used to catch suggested edits that state facts the seller's own
 * listing never mentions.
 */
export function factsIn(text: string): { key: AttributeKey; value: string }[] {
  const keys: AttributeKey[] = ["formats", "sizes", "quantity", "software", "license", "editing", "materials", "care", "production"];
  const out: { key: AttributeKey; value: string }[] = [];
  for (const key of keys) {
    for (const hit of findAttributeValues(key, text)) {
      if (!out.some((o) => o.key === key && o.value.toLowerCase() === hit.value.toLowerCase())) out.push({ key, value: hit.value });
    }
  }
  return out;
}
