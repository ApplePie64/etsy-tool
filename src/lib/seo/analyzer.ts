import { ALLOWED_CAPS, ETSY_LIMITS, SEO_GUIDANCE } from "./rules";
import {
  ANGLE_LABELS,
  type Angle,
  anglesOf,
  containsAllWords,
  containsPhrase,
  contentWords,
  inferPrimaryKeyword,
  normalize,
  phraseIndex,
  phraseKey,
  productWords,
  stem,
  stems,
  tagAngles,
  titleSegments,
  tokenize,
} from "./keywords";

export interface ListingInput {
  title: string;
  tags: string[];
  description: string;
  /** The search phrase this listing should rank for. Inferred from the title when empty. */
  primaryKeyword?: string;
  /** Etsy category name, e.g. "Necklaces". Categories count as tags. */
  category?: string;
  photoCount: number;
  hasVideo: boolean;
  freeShipping: boolean;
  /** Seller filled in the optional attributes (colour, occasion, style...). */
  attributesComplete: boolean;
  isDigital?: boolean;
}

export type Area = "title" | "tags" | "description" | "visuals" | "shipping" | "attributes";
export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  area: Area;
  label: string;
  status: CheckStatus;
  points: number;
  maxPoints: number;
  detail: string;
  fix?: string;
}

export interface AreaScore {
  area: Area;
  label: string;
  points: number;
  maxPoints: number;
}

export interface KeywordCoverage {
  keyword: string;
  inferred: boolean;
  inTitle: boolean;
  frontLoaded: boolean;
  inTags: boolean;
  inDescriptionOpening: boolean;
}

export interface SeoReport {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  verdict: string;
  areas: AreaScore[];
  checks: SeoCheck[];
  /** Failing and warning checks ordered by points you'd gain by fixing them. */
  priorities: SeoCheck[];
  coverage: KeywordCoverage;
  missingAngles: Angle[];
  tagSuggestions: string[];
  preview: {
    mobileTitle: string;
    desktopTitle: string;
    googleTitle: string;
    googleSnippet: string;
  };
}

export const AREA_LABELS: Record<Area, string> = {
  title: "Title",
  tags: "Tags",
  description: "Description",
  visuals: "Photos & video",
  shipping: "Shipping",
  attributes: "Attributes",
};

const TAG_INVALID_CHARS = /[^\p{L}\p{N}\s'\-&™©®]/u;

function truncate(text: string, n: number): string {
  const t = text.trim();
  return t.length <= n ? t : t.slice(0, n).trimEnd() + "…";
}

function check(
  id: string,
  area: Area,
  label: string,
  maxPoints: number,
  points: number,
  detail: string,
  fix?: string,
): SeoCheck {
  const p = Math.max(0, Math.min(maxPoints, Math.round(points)));
  const status: CheckStatus = p >= maxPoints ? "pass" : p === 0 || p / maxPoints < 0.4 ? "fail" : "warn";
  return { id, area, label, status, points: p, maxPoints, detail, fix: status === "pass" ? undefined : fix };
}

export function cleanTags(tags: string[]): string[] {
  return tags.map((t) => t.trim()).filter(Boolean);
}

/** Groups of tags that Etsy would treat as the same keyword (plural / reordered). */
export function duplicateTagGroups(tags: string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const t of tags) {
    const key = phraseKey(t) || normalize(t);
    const g = groups.get(key) ?? [];
    g.push(t);
    groups.set(key, g);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

function titleChecks(input: ListingInput, keyword: string, inferred: boolean): SeoCheck[] {
  const title = input.title.trim();
  const len = title.length;
  const out: SeoCheck[] = [];

  // Length
  if (len === 0) {
    out.push(check("title-length", "title", "Title length", 8, 0, "No title yet.", "Write a title that says plainly what the item is."));
  } else if (len > ETSY_LIMITS.titleMaxChars) {
    out.push(
      check("title-length", "title", "Title length", 8, 0,
        `${len} characters — Etsy's limit is ${ETSY_LIMITS.titleMaxChars}, so it won't save.`,
        "Cut repeated or filler phrases until it fits; keep the words a shopper would type."),
    );
  } else if (len < SEO_GUIDANCE.titleMinChars) {
    out.push(
      check("title-length", "title", "Title length", 8, 3,
        `${len} characters — too thin to say what it is and why it's special.`,
        "Add the key detail shoppers filter on: material, size, style or who it's for."),
    );
  } else if (len > SEO_GUIDANCE.titleComfortMaxChars) {
    out.push(
      check("title-length", "title", "Title length", 8, 5,
        `${len} characters — valid, but long titles read like keyword lists. Etsy asks for concise, readable titles.`,
        "Keep one clear description up front and move extra keyword variations into tags."),
    );
  } else {
    out.push(check("title-length", "title", "Title length", 8, 8, `${len} characters — concise and within Etsy's ${ETSY_LIMITS.titleMaxChars} limit.`));
  }

  // Target keyword
  if (!keyword) {
    out.push(check("title-keyword", "title", "Target keyword in title", 8, 0, "No keyword to check.", "Enter the phrase you want to be found for."));
  } else if (inferred && contentWords(keyword).length < 2) {
    out.push(
      check("title-keyword", "title", "Target keyword in title", 8, 4,
        `The title leads with a single broad word ("${keyword}") that thousands of listings compete for.`,
        "Lead with the 2–4 word phrase a buyer would type, e.g. \"gold initial necklace\" rather than \"necklace\"."),
    );
  } else if (inferred) {
    out.push(
      check("title-keyword", "title", "Target keyword in title", 8, 8,
        `Using "${keyword}" (taken from the start of your title) as the target keyword. Set your own target for a sharper check.`),
    );
  } else if (containsPhrase(title, keyword)) {
    out.push(check("title-keyword", "title", "Target keyword in title", 8, 8, `"${keyword}" appears as an exact phrase.`));
  } else if (containsAllWords(title, keyword)) {
    out.push(
      check("title-keyword", "title", "Target keyword in title", 8, 5,
        `All the words of "${keyword}" are in the title, but not together as a phrase.`,
        `Use "${keyword}" exactly as shoppers type it — exact phrase matches are the strongest relevancy signal.`),
    );
  } else {
    out.push(
      check("title-keyword", "title", "Target keyword in title", 8, 0,
        `"${keyword}" is missing from the title.`,
        `Put "${keyword}" in the first few words of the title.`),
    );
  }

  // Front-loading
  const idx = keyword ? phraseIndex(title, keyword) : -1;
  if (!keyword || !title) {
    out.push(check("title-frontload", "title", "Keyword near the start", 6, 0, "Nothing to check yet.", "Lead the title with the main keyword."));
  } else if (idx >= 0 && idx <= SEO_GUIDANCE.frontLoadChars) {
    out.push(check("title-frontload", "title", "Keyword near the start", 6, 6, `Starts at character ${idx + 1}, visible even when mobile search truncates the title.`));
  } else {
    out.push(
      check("title-frontload", "title", "Keyword near the start", 6, 2,
        idx < 0
          ? "The target phrase isn't at the start of the title."
          : `The target phrase starts at character ${idx + 1}; mobile results cut titles after ~${SEO_GUIDANCE.mobileTitleChars}.`,
        "Move the main keyword to the first 40 characters — most Etsy traffic is on phones."),
    );
  }

  // Stuffing: repeated words and separator-heavy keyword lists
  const counts = new Map<string, number>();
  for (const s of stems(title)) counts.set(s, (counts.get(s) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]);
  const maxRepeat = repeated[0]?.[1] ?? 0;
  const segments = titleSegments(title).length;
  let stuffPts = 5;
  const stuffNotes: string[] = [];
  if (maxRepeat >= 3) {
    stuffPts -= 4;
    stuffNotes.push(`"${repeated[0]![0]}" appears ${maxRepeat} times`);
  } else if (repeated.length >= 2) {
    stuffPts -= 2;
    stuffNotes.push(`${repeated.length} words are repeated (${repeated.map(([w]) => w).join(", ")})`);
  }
  if (segments > 4) {
    stuffPts -= 2;
    stuffNotes.push(`${segments} comma/pipe-separated phrases`);
  }
  out.push(
    check("title-stuffing", "title", "Readable, not keyword-stuffed", 5, stuffPts,
      stuffNotes.length ? `Reads like a keyword list: ${stuffNotes.join("; ")}.` : "Reads naturally, no word repeated.",
      "Say each idea once. Etsy matches a word from the title or the tags — repeating it doesn't add ranking."),
  );

  // Caps
  const shouting = title
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length >= 3 && w === w.toUpperCase() && /\p{L}/u.test(w) && !ALLOWED_CAPS.has(w));
  out.push(
    check("title-caps", "title", "No ALL-CAPS shouting", 3, shouting.length > 1 ? 1 : shouting.length === 1 ? 2 : 3,
      shouting.length ? `All-caps words: ${shouting.slice(0, 4).join(", ")}.` : "Normal capitalisation.",
      "Use sentence or title case; all caps reads as spammy in search results."),
  );
  return out;
}

function tagChecks(input: ListingInput, tags: string[], keyword: string): SeoCheck[] {
  const out: SeoCheck[] = [];
  const n = tags.length;
  const free = ETSY_LIMITS.tagCount - n;

  out.push(
    check("tags-count", "tags", "All 13 tags used", 12, (Math.min(n, ETSY_LIMITS.tagCount) / ETSY_LIMITS.tagCount) * 12,
      n >= ETSY_LIMITS.tagCount ? "All 13 tag slots used." : `${n} of 13 tags — ${free} free search entry points unused.`,
      `Add ${free} more multi-word tags (see suggestions below).`),
  );

  const tooLong = tags.filter((t) => t.length > ETSY_LIMITS.tagMaxChars);
  const invalid = tags.filter((t) => TAG_INVALID_CHARS.test(t));
  const bad = [...new Set([...tooLong, ...invalid])];
  out.push(
    check("tags-valid", "tags", "Tags fit Etsy's rules", 5, n === 0 ? 0 : bad.length === 0 ? 5 : Math.max(0, 5 - bad.length * 2),
      n === 0
        ? "No tags yet."
        : bad.length === 0
          ? "Every tag is 20 characters or fewer with allowed characters."
          : `Etsy will reject: ${bad.map((t) => `"${t}"`).join(", ")} (max 20 characters; letters, numbers, spaces, - ' & only).`,
      "Shorten to 20 characters or split into two tags."),
  );

  const multi = tags.filter((t) => contentWords(t).length >= 2).length;
  const ratio = n ? multi / n : 0;
  out.push(
    check("tags-longtail", "tags", "Long-tail (multi-word) tags", 6, n === 0 ? 0 : ratio >= 0.7 ? 6 : ratio >= 0.4 ? 3 : 1,
      n === 0 ? "No tags yet." : `${multi} of ${n} tags are phrases of 2+ words.`,
      "Swap single words like \"necklace\" for phrases shoppers type, like \"gold bar necklace\". Specific phrases face less competition and convert better."),
  );

  const dupes = duplicateTagGroups(tags);
  const categoryDupes = input.category
    ? tags.filter((t) => phraseKey(t) === phraseKey(input.category ?? ""))
    : [];
  const wasted = dupes.reduce((s, g) => s + g.length - 1, 0) + categoryDupes.length;
  const dupeNotes = [
    ...dupes.map((g) => g.map((t) => `"${t}"`).join(" = ")),
    ...categoryDupes.map((t) => `"${t}" repeats your category`),
  ];
  out.push(
    check("tags-duplicates", "tags", "No wasted duplicate tags", 4, n === 0 ? 0 : 4 - wasted * 2,
      wasted === 0 ? "Each tag targets a different search." : `${wasted} tag slot(s) wasted: ${dupeNotes.join("; ")}.`,
      "Etsy already matches plurals, word order and your category — use those slots for new phrases."),
  );

  const aligned = tags.filter((t) => containsAllWords(input.title, t));
  const keywordTagged = keyword ? tags.some((t) => phraseKey(t) === phraseKey(keyword)) : false;
  let alignPts = aligned.length >= 3 ? 3 : aligned.length >= 1 ? 2 : 0;
  if (keywordTagged) alignPts += 1;
  out.push(
    check("tags-alignment", "tags", "Tags reinforce the title", 4, n === 0 ? 0 : alignPts,
      n === 0
        ? "No tags yet."
        : `${aligned.length} tag(s) also appear in the title${keyword ? `; target keyword ${keywordTagged ? "is" : "is not"} a tag` : ""}.`,
      keyword && !keywordTagged
        ? `Add "${keyword}" as a tag. A phrase in both the title and the tags is the strongest match.`
        : "Repeat your 2–3 most important title phrases as tags."),
  );

  const covered = tagAngles(tags, keyword);
  const coreAngles: Angle[] = ["product", "recipient", "occasion", "style", "material"];
  const coveredCore = coreAngles.filter((a) => covered.has(a) || (a === "material" && covered.has("color")));
  out.push(
    check("tags-angles", "tags", "Tags cover different shopper angles", 4, n === 0 ? 0 : coveredCore.length >= 3 ? 4 : coveredCore.length === 2 ? 2 : 1,
      n === 0
        ? "No tags yet."
        : `Covers: ${coveredCore.map((a) => ANGLE_LABELS[a]).join(", ") || "none"}.`,
      "Shoppers search by what it is, who it's for, the occasion, the style and the material. Spread tags across those."),
  );
  return out;
}

const DETAIL_PATTERNS: { label: string; re: RegExp; digital?: boolean; physical?: boolean }[] = [
  { label: "size or dimensions", re: /\b(size|sizes|dimension|dimensions|measure|measures|inch|inches|cm|mm|length|width|height|diameter|oz|ml|fits?)\b|\d+\s?("|in\b|x\s?\d)/i },
  { label: "materials", re: /\b(made (of|from|with)|material|materials|sterling|gold|silver|cotton|linen|wood|ceramic|leather|resin|glass|wool|paper|vinyl|steel|brass|clay)\b/i, physical: true },
  { label: "care or usage", re: /\b(care|clean|wash|use|how to|instructions?|store|avoid)\b/i },
  { label: "shipping or processing", re: /\b(ship|ships|shipping|dispatch|processing|deliver|delivery|arrive|gift box|packaged|packaging)\b/i, physical: true },
  { label: "what's included / file formats", re: /\b(includes?|included|you will receive|you'll receive|file|files|format|pdf|png|svg|jpg|resolution|dpi|download)\b/i, digital: true },
  { label: "personalisation instructions", re: /\b(personali[sz](e|ation|ed)|custom|engrav|monogram|name|initial)\b/i },
];

function descriptionChecks(input: ListingInput, keyword: string): SeoCheck[] {
  const out: SeoCheck[] = [];
  const desc = input.description.trim();
  const words = tokenize(desc).length;

  out.push(
    check("desc-length", "description", "Description depth", 5,
      words >= SEO_GUIDANCE.descriptionGoodWords ? 5 : words >= SEO_GUIDANCE.descriptionMinWords ? 3 : words > 0 ? 1 : 0,
      words === 0 ? "No description yet." : `${words} words.`,
      "Aim for 80+ words that answer the questions buyers message you about."),
  );

  const opening = desc.slice(0, SEO_GUIDANCE.googleSnippetChars);
  const openFull = keyword ? containsPhrase(opening, keyword) : false;
  const openPartial = keyword ? containsAllWords(opening, keyword) || productWords(keyword).some((p) => stems(opening).includes(p)) : false;
  out.push(
    check("desc-opening", "description", "Keyword in the first sentence", 5, !desc ? 0 : openFull ? 5 : openPartial ? 3 : 0,
      !desc
        ? "No description yet."
        : openFull
          ? "The opening line uses your keyword — good for Google and for shoppers skimming."
          : "The first ~160 characters don't use your main keyword.",
      "Start with one plain sentence saying what the item is using your main keyword. Google uses it as the search snippet."),
  );

  const relevant = DETAIL_PATTERNS.filter((p) => (input.isDigital ? !p.physical : !p.digital));
  const found = relevant.filter((p) => p.re.test(desc));
  const missing = relevant.filter((p) => !p.re.test(desc)).map((p) => p.label);
  out.push(
    check("desc-details", "description", "Answers buyer questions", 5, !desc ? 0 : found.length >= 3 ? 5 : found.length === 2 ? 3 : 1,
      !desc ? "No description yet." : `Mentions: ${found.map((p) => p.label).join(", ") || "none of the usual details"}.`,
      `Add: ${missing.slice(0, 3).join(", ")}.`),
  );
  return out;
}

function visualChecks(input: ListingInput): SeoCheck[] {
  const p = Math.max(0, Math.min(ETSY_LIMITS.maxPhotos, Math.round(input.photoCount)));
  return [
    check("photos", "visuals", "Photo count", 8,
      p >= SEO_GUIDANCE.goodPhotoCount ? 8 : p >= 7 ? 6 : p >= SEO_GUIDANCE.okPhotoCount ? 5 : p > 0 ? 2 : 0,
      `${p} photo${p === 1 ? "" : "s"} (Etsy allows up to ${ETSY_LIMITS.maxPhotos}).`,
      "Use at least 10: hero shot on a clean background, scale/in-hand, lifestyle, detail close-ups, variations, packaging."),
    check("video", "visuals", "Listing video", 4, input.hasVideo ? 4 : 0,
      input.hasVideo ? "Has a video." : "No video.",
      "Add a 5–15 second video. It autoplays in search and on the listing page and lifts clicks and conversion."),
  ];
}

export function analyzeListing(input: ListingInput): SeoReport {
  const tags = cleanTags(input.tags);
  const manual = (input.primaryKeyword ?? "").trim();
  const keyword = manual ? normalize(manual) : inferPrimaryKeyword(input.title);
  const inferred = !manual;

  const checks: SeoCheck[] = [
    ...titleChecks(input, keyword, inferred),
    ...tagChecks(input, tags, keyword),
    ...descriptionChecks(input, keyword),
    ...visualChecks(input),
    check("free-shipping", "shipping", "Free shipping (US search priority)", 4, input.freeShipping || input.isDigital ? 4 : 1,
      input.isDigital ? "Digital item — no shipping cost." : input.freeShipping ? "Offers free shipping." : "Charges shipping.",
      "Etsy prioritises free-shipping listings for US shoppers. Consider building shipping into the price."),
    check("attributes", "attributes", "Attributes filled in", 4, input.attributesComplete ? 4 : 0,
      input.attributesComplete ? "Attributes completed." : "Attributes incomplete.",
      "Fill every attribute (colour, occasion, style, material...). They act as extra tags and power search filters."),
  ];

  const areas: AreaScore[] = (Object.keys(AREA_LABELS) as Area[]).map((area) => {
    const cs = checks.filter((c) => c.area === area);
    return {
      area,
      label: AREA_LABELS[area],
      points: cs.reduce((s, c) => s + c.points, 0),
      maxPoints: cs.reduce((s, c) => s + c.maxPoints, 0),
    };
  });
  const score = Math.round(checks.reduce((s, c) => s + c.points, 0));

  const grade: SeoReport["grade"] = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  const verdict =
    grade === "A"
      ? "Search-ready. Focus on photos, price and reviews to lift conversion."
      : grade === "B"
        ? "Solid. A few fixes will make it more findable."
        : grade === "C"
          ? "Findable for some searches, but missing easy wins."
          : grade === "D"
            ? "Weak for search. Work through the priority fixes below."
            : "Unlikely to be found in Etsy search yet.";

  const priorities = checks
    .filter((c) => c.status !== "pass")
    .sort((a, b) => b.maxPoints - b.points - (a.maxPoints - a.points));

  const covered = tagAngles(tags, keyword);
  const missingAngles = (["product", "recipient", "occasion", "style", "material"] as Angle[]).filter(
    (a) => !covered.has(a) && !(a === "material" && covered.has("color")),
  );

  const title = input.title.trim();
  return {
    score,
    grade,
    verdict,
    areas,
    checks,
    priorities,
    coverage: {
      keyword,
      inferred,
      inTitle: keyword ? containsAllWords(title, keyword) : false,
      frontLoaded: keyword ? (() => {
        const i = phraseIndex(title, keyword);
        return i >= 0 && i <= SEO_GUIDANCE.frontLoadChars;
      })() : false,
      inTags: keyword ? tags.some((t) => phraseKey(t) === phraseKey(keyword)) : false,
      inDescriptionOpening: keyword ? containsAllWords(input.description.slice(0, SEO_GUIDANCE.googleSnippetChars), keyword) : false,
    },
    missingAngles,
    tagSuggestions: suggestTags({ ...input, tags }, keyword, missingAngles),
    preview: {
      mobileTitle: truncate(title, SEO_GUIDANCE.mobileTitleChars),
      desktopTitle: truncate(title, SEO_GUIDANCE.desktopTitleChars),
      googleTitle: truncate(title, SEO_GUIDANCE.googleTitleChars),
      googleSnippet: truncate(input.description.replace(/\s+/g, " "), SEO_GUIDANCE.googleSnippetChars),
    },
  };
}

const ANGLE_IDEAS: Partial<Record<Angle, (head: string) => string[]>> = {
  recipient: (h) => [`${h} for her`, `${h} for him`, `gift for mom`, `gift for her`, `${h} for women`],
  occasion: (h) => [`birthday gift`, `${h} gift`, `anniversary gift`, `christmas gift`, `bridesmaid gift`],
  style: (h) => [`minimalist ${h}`, `boho ${h}`, `personalized ${h}`, `dainty ${h}`, `vintage style ${h}`],
  material: (h) => [`handmade ${h}`, `gold ${h}`, `silver ${h}`, `wooden ${h}`, `ceramic ${h}`],
};

const GENERIC_GIFT = new Set(["gift", "gifts", "present"]);

/** Index of the last product noun (a non-modifier content word) in `words`. */
function headIndex(words: string[]): number {
  for (let i = words.length - 1; i >= 0; i--) {
    if (productWords(words[i]!).length > 0) return i;
  }
  return -1;
}

/**
 * Tag ideas built from the seller's own words first (title phrases, the target
 * keyword), then from shopper "angles" the current tags miss. Phrases are kept
 * inside one title segment and anchored on a product noun so they read like
 * real searches. These are ideas to validate in Etsy's search-bar
 * autocomplete, not search-volume data.
 */
export function suggestTags(input: ListingInput, keyword: string, missingAngles: Angle[]): string[] {
  const existing = new Set(input.tags.map((t) => phraseKey(t)));
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const t = normalize(raw).replace(/\s+/g, " ").trim();
    if (!t || t.length > ETSY_LIMITS.tagMaxChars) return;
    if (contentWords(t).length < 2) return;
    const key = phraseKey(t);
    if (existing.has(key) || seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  if (keyword) add(keyword);

  const segments = titleSegments(input.title).map((seg) => contentWords(seg));
  // 1. Whole title segments that fit ("gift for her" keeps its stopword).
  for (const seg of titleSegments(input.title)) add(seg);
  // 2. Sub-phrases of each segment that end on its product noun.
  const modifiers: string[] = [];
  const heads: string[] = [];
  for (const words of segments) {
    const h = headIndex(words);
    words.forEach((w, i) => {
      if (i !== h && productWords(w).length === 0) modifiers.push(w);
    });
    if (h < 1) continue;
    heads.push(words[h]!);
    for (let i = h - 1; i >= 0; i--) add(words.slice(i, h + 1).join(" "));
  }

  // 3. Modifiers from anywhere in the title paired with the main product noun.
  const kwWords = contentWords(keyword);
  const mainHead = kwWords[headIndex(kwWords)] ?? heads[0] ?? kwWords.at(-1) ?? "";
  if (mainHead) {
    for (const m of modifiers) {
      if (stem(m) === stem(mainHead) || GENERIC_GIFT.has(m)) continue;
      const angles = anglesOf(m);
      // "necklace for her", but "boho necklace" / "gold necklace".
      add(angles.has("recipient") ? `${mainHead} for ${m}` : `${m} ${mainHead}`);
    }
    // 4. Angles the tags don't cover yet.
    for (const angle of missingAngles) {
      for (const idea of ANGLE_IDEAS[angle]?.(mainHead) ?? []) add(idea);
    }
    // 5. Still short of filling the free slots? Offer general angle ideas.
    const wanted = Math.max(0, ETSY_LIMITS.tagCount - input.tags.length) + 4;
    for (const angle of Object.keys(ANGLE_IDEAS) as Angle[]) {
      if (out.length >= wanted) break;
      for (const idea of ANGLE_IDEAS[angle]?.(mainHead) ?? []) add(idea);
    }
  }
  return out.slice(0, 16);
}
