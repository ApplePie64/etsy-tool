/**
 * Text helpers for Etsy keyword work: tokenising, light stemming so that
 * "earring" and "earrings" count as the same word, and the modifier lexicons
 * used to judge which search "angles" a set of tags covers.
 */

export const STOPWORDS = new Set([
  "a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "by", "at", "or", "from", "as",
  "is", "it", "its", "this", "that", "your", "you", "my", "our", "be", "are", "was", "will", "can",
  "into", "over", "per", "each", "any", "all", "&", "x",
]);

export type Angle = "product" | "recipient" | "occasion" | "style" | "material" | "color" | "format";

export const ANGLE_LABELS: Record<Angle, string> = {
  product: "What it is",
  recipient: "Who it's for",
  occasion: "Occasion",
  style: "Style / aesthetic",
  material: "Material",
  color: "Colour",
  format: "Digital format",
};

/** Multi-word entries are matched as phrases, single words as stems. */
export const ANGLE_LEXICON: Record<Exclude<Angle, "product">, string[]> = {
  recipient: [
    "mom", "mum", "mother", "dad", "father", "her", "him", "women", "woman", "men", "man", "kid", "kids",
    "baby", "toddler", "teacher", "bride", "groom", "bridesmaid", "wife", "husband", "girlfriend",
    "boyfriend", "grandma", "grandpa", "nana", "friend", "bestie", "sister", "brother", "nurse", "coworker",
    "boss", "couple", "dog lover", "cat lover", "pet lover", "new mom", "new dad", "daughter", "son",
    "aunt", "uncle", "niece", "nephew", "girl", "boy", "gardener", "gamer", "reader",
  ],
  occasion: [
    "birthday", "wedding", "anniversary", "christmas", "xmas", "holiday", "valentine", "valentines",
    "mothers day", "mother's day", "fathers day", "father's day", "graduation", "baby shower",
    "bridal shower", "housewarming", "retirement", "halloween", "easter", "thanksgiving", "engagement",
    "bachelorette", "proposal", "gift", "gifts", "stocking stuffer", "memorial", "sympathy",
    "new home", "back to school", "party", "hanukkah", "diwali", "eid", "lunar new year", "st patricks",
  ],
  style: [
    "boho", "bohemian", "minimalist", "minimal", "vintage", "retro", "rustic", "modern", "farmhouse",
    "cottagecore", "dainty", "personalized", "personalised", "custom", "handmade", "gothic", "goth",
    "kawaii", "aesthetic", "scandinavian", "nordic", "mid century", "art deco", "whimsical", "cute",
    "funny", "elegant", "luxury", "chunky", "delicate", "coastal", "western", "cowgirl", "y2k",
    "dark academia", "japandi", "maximalist", "floral", "botanical", "celestial", "abstract",
  ],
  material: [
    "gold", "silver", "sterling", "leather", "wood", "wooden", "ceramic", "pottery", "linen", "cotton",
    "wool", "resin", "glass", "brass", "copper", "clay", "macrame", "crochet", "knit", "knitted",
    "soy", "beeswax", "pearl", "gemstone", "crystal", "stainless", "steel", "14k", "18k", "925",
    "bamboo", "velvet", "silk", "canvas", "paper", "acrylic", "enamel", "porcelain", "stoneware",
    "felt", "yarn", "embroidered", "hand painted", "watercolor", "watercolour",
  ],
  color: [
    "black", "white", "pink", "blue", "green", "red", "sage", "navy", "beige", "neutral", "pastel",
    "rainbow", "terracotta", "cream", "ivory", "purple", "lilac", "lavender", "yellow", "mustard",
    "orange", "brown", "grey", "gray", "teal", "turquoise", "emerald", "burgundy", "blush", "mint",
  ],
  format: [
    "printable", "digital download", "digital", "svg", "png", "pdf", "template", "instant download",
    "canva", "editable", "cut file", "clipart", "sublimation", "procreate", "lightroom", "preset",
    "planner", "wall art print",
  ],
};

/** Lowercase, keep letters/numbers/apostrophes/hyphens inside words, drop the rest. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]+/gu, " ")
    .replace(/(^|\s)[-']+|[-']+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Content words only (no stopwords). */
export function contentWords(text: string): string[] {
  return tokenize(text).filter((w) => !STOPWORDS.has(w));
}

/**
 * Very small English stemmer, enough to treat plural/singular as one word.
 * Etsy search already matches plurals, so repeating both forms wastes space.
 */
export function stem(word: string): string {
  const w = word.toLowerCase().replace(/'s$/, "");
  if (w.length <= 3) return w;
  if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + "y";
  if (/(ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function stems(text: string): string[] {
  return contentWords(text).map(stem);
}

/** Order-insensitive fingerprint, so "gold ring dainty" == "dainty gold rings". */
export function phraseKey(phrase: string): string {
  return [...new Set(stems(phrase))].sort().join(" ");
}

/** Does `haystack` contain every content word of `needle` (stem match, any order)? */
export function containsAllWords(haystack: string, needle: string): boolean {
  const hay = new Set(stems(haystack));
  const need = stems(needle);
  return need.length > 0 && need.every((s) => hay.has(s));
}

/** Does `haystack` contain `needle` as a contiguous phrase (stem match)? */
export function containsPhrase(haystack: string, needle: string): boolean {
  const hay = tokenize(haystack).map(stem);
  const need = tokenize(needle).map(stem);
  if (need.length === 0 || need.length > hay.length) return false;
  outer: for (let i = 0; i <= hay.length - need.length; i++) {
    for (let j = 0; j < need.length; j++) {
      if (hay[i + j] !== need[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Character index where the phrase starts in the raw text, or -1. */
export function phraseIndex(text: string, phrase: string): number {
  const need = tokenize(phrase).map(stem);
  if (need.length === 0) return -1;
  const re = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
  const words: { s: string; i: number }[] = [];
  for (const m of text.matchAll(re)) words.push({ s: stem(m[0].toLowerCase()), i: m.index ?? 0 });
  outer: for (let i = 0; i <= words.length - need.length; i++) {
    for (let j = 0; j < need.length; j++) {
      if (words[i + j]?.s !== need[j]) continue outer;
    }
    return words[i]?.i ?? -1;
  }
  return -1;
}

/** Splits a title on the separators sellers use between keyword phrases. */
export function titleSegments(title: string): string[] {
  return title
    .split(/\s[-–—|/]\s|[,|•·:;]|\s\+\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Best guess at the main search phrase when the seller didn't give one. */
export function inferPrimaryKeyword(title: string): string {
  const first = titleSegments(title)[0] ?? title;
  const words = contentWords(first);
  // Keep it to a realistic search phrase length.
  return words.slice(0, 4).join(" ");
}

function matchesLexiconEntry(textStems: string[], textNorm: string, entry: string): boolean {
  if (entry.includes(" ")) return ` ${textNorm} `.includes(` ${entry} `);
  return textStems.includes(stem(entry));
}

/** Which angles does a phrase speak to? */
export function anglesOf(phrase: string): Set<Angle> {
  const norm = normalize(phrase);
  const st = tokenize(phrase).map(stem);
  const found = new Set<Angle>();
  for (const [angle, entries] of Object.entries(ANGLE_LEXICON) as [Exclude<Angle, "product">, string[]][]) {
    if (entries.some((e) => matchesLexiconEntry(st, norm, e))) found.add(angle);
  }
  return found;
}

const MODIFIER_STEMS = new Set(
  Object.values(ANGLE_LEXICON)
    .flat()
    .filter((e) => !e.includes(" "))
    .map(stem),
);

/** The product nouns in a keyword, i.e. content words that are not modifiers. */
export function productWords(keyword: string): string[] {
  return stems(keyword).filter((s) => !MODIFIER_STEMS.has(s));
}

/** Angle coverage across a whole tag set. */
export function tagAngles(tags: string[], primaryKeyword: string): Set<Angle> {
  const covered = new Set<Angle>();
  const product = new Set(productWords(primaryKeyword));
  for (const tag of tags) {
    for (const a of anglesOf(tag)) covered.add(a);
    if (stems(tag).some((s) => product.has(s))) covered.add("product");
  }
  return covered;
}
