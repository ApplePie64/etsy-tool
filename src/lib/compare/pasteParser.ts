/**
 * Turns text the seller copied from an Etsy listing page (Ctrl+A, Ctrl+C)
 * into listing fields. This only reads text the seller copied themselves —
 * no fetching or scraping. Etsy's layout changes, so every field is a best
 * guess that the seller sees and can correct; anything not found stays
 * unknown.
 */

export interface ParsedListing {
  title: string | null;
  price: number | null;
  currency: string | null;
  /** True when "$" alone was read as USD. */
  currencyAssumed: boolean;
  description: string | null;
  reviewCount: number | null;
  url: string | null;
  shopName: string | null;
  /** Field names that were filled, for the summary shown to the seller. */
  found: string[];
}

/** Lines that are page furniture, never a title or part of a description. */
const BOILERPLATE = [
  /^skip to (content|main)/i,
  /^etsy$/i,
  /^search for anything/i,
  /^(sign in|register|cart|favorites|gift mode|gifts?|home favorites|holiday shop|registry|fashion finds|home|categories)$/i,
  /^(add to (cart|collection|favorites)|buy it now|buy now|add to basket|loading|share|report this item.*|more from this shop|see more|show more|view all|close|next|previous)$/i,
  /^(item details|highlights|description|delivery and return policies|shipping and return policies|meet your seller|reviews for this (item|shop).*|explore (more )?related searches|you may also like|faqs?|related searches|popular now|visit shop|message seller|follow shop|following)$/i,
  /^(price|sale price|original price|local taxes included.*|vat included.*|in \d+\+? carts?|only \d+ left.*|low in stock|in demand.*|star seller|bestseller|etsy's pick|free shipping|arrives soon.*|returns? (&|and) exchanges? (not )?accepted)$/i,
  /^(learn more about this item|read the full description|read more|less)$/i,
  /^\d(\.\d)? out of 5 stars/i,
  /^(©|\(c\)).*etsy/i,
  /cookies? (settings|policy)|privacy settings|terms of use|interest-based ads/i,
];

const isBoilerplate = (l: string) => BOILERPLATE.some((re) => re.test(l));

const DESCRIPTION_START = /^(description|item details|about this item)$/i;
const DESCRIPTION_END =
  /^(learn more about this item|read the full description|shipping and return policies|delivery and return policies|meet your seller|reviews for this (item|shop)|explore (more )?related searches|you may also like|faqs?|frequently asked questions|report this item|more from this shop|explore related searches|related searches|listed on|popular now)/i;

const CURRENCY_TOKENS: [RegExp, string][] = [
  [/^(US\$|USD)$/i, "USD"],
  [/^(CA\$|CAD)$/i, "CAD"],
  [/^(A\$|AU\$|AUD)$/i, "AUD"],
  [/^(NZ\$|NZD)$/i, "NZD"],
  [/^(€|EUR)$/i, "EUR"],
  [/^(£|GBP)$/i, "GBP"],
  [/^(₹|INR|RS\.?)$/i, "INR"],
  [/^(¥|JPY)$/i, "JPY"],
  [/^(CHF)$/i, "CHF"],
  [/^\$$/, "USD"],
];

const AMOUNT_SOURCE =
  /(US\$|CA\$|AU\$|NZ\$|A\$|\$|€|£|₹|¥|USD|CAD|AUD|NZD|EUR|GBP|INR|JPY|CHF)\s?(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\+)?|(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{1,2})?)\s?(€|£|EUR|GBP|USD|CHF)(?![A-Za-z])/;
/** First money amount in a line (fresh regex each call — no shared state). */
const findAmount = (l: string) => new RegExp(AMOUNT_SOURCE.source).exec(l);

function toNumber(raw: string): number | null {
  let s = raw.replace(/\s/g, "");
  // "1.234,50" or "12,50" → European decimal comma
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function currencyOf(token: string): { code: string; assumed: boolean } | null {
  for (const [re, code] of CURRENCY_TOKENS) if (re.test(token.trim())) return { code, assumed: token.trim() === "$" };
  return null;
}

/** Lines that read like prose (description) rather than a title or UI. */
const isSentence = (l: string) => /[.!?:)]$/.test(l) || l.split(/\s+/).length >= 14;

function titleScore(line: string, index: number, priceIndex: number): number {
  const len = line.length;
  if (len < 15 || len > 160 || isBoilerplate(line)) return -1;
  if (/^https?:\/\//i.test(line) || findAmount(line)) return -1;
  const words = line.split(/\s+/);
  if (words.length < 3) return -1;
  let score = 0;
  if (len >= 30 && len <= 140) score += 2;
  if (/[,|–—-]/.test(line)) score += 2;
  const capitalised = words.filter((w) => /^[A-Z0-9]/.test(w)).length / words.length;
  score += capitalised * 3;
  if (/[.!?]$/.test(line)) score -= 3;
  if (/\b(you|your|our|we|i|this listing|thank)\b/i.test(line)) score -= 2;
  if (priceIndex >= 0) {
    const d = Math.abs(index - priceIndex);
    score += d <= 3 ? 3 : d <= 8 ? 1.5 : 0;
  } else if (index < 15) {
    score += 1;
  }
  return score;
}

function parseCount(raw: string): number | null {
  const m = /^(\d+(?:[.,]\d+)?)\s?(k)?$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]!.replace(",", m[2] ? "." : ""));
  return Number.isFinite(n) ? Math.round(m[2] ? n * 1000 : n) : null;
}

export function parseListingPaste(text: string): ParsedListing {
  const out: ParsedListing = { title: null, price: null, currency: null, currencyAssumed: false, description: null, reviewCount: null, url: null, shopName: null, found: [] };
  const raw = text.replace(/\r/g, "").replace(/ /g, " ");
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!lines.length) return out;

  // URL
  const url = /https?:\/\/(?:www\.)?etsy\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listing\/\d+[^\s)]*/i.exec(raw);
  if (url) {
    out.url = url[0].replace(/[?#].*$/, "");
    out.found.push("link");
  }

  // Price: first amount on a line that isn't an original/strikethrough, shipping or savings line.
  let priceIndex = -1;
  for (let i = 0; i < lines.length && out.price === null; i++) {
    const l = lines[i]!;
    if (/original price|was:|you save|\boff\b|shipping|delivery|per item in|vat|tax|coupon|orders? over|spend/i.test(l)) continue;
    const m = findAmount(l);
    if (!m) continue;
    // Skip prose that merely mentions money ("orders over $35 ship free")
    if (l.length > 60 && !/^(price|sale price|now)\b/i.test(l)) continue;
    const token = m[1] ?? m[4] ?? "";
    const amount = toNumber(m[2] ?? m[3] ?? "");
    const cur = currencyOf(token);
    if (amount === null || !cur || amount <= 0) continue;
    out.price = amount;
    out.currency = cur.code;
    out.currencyAssumed = cur.assumed;
    priceIndex = i;
  }
  if (out.price !== null) out.found.push("price");

  // Title: best-scoring title-like line, preferring ones near the price.
  let best = { score: 0, index: -1 };
  lines.forEach((l, i) => {
    const s = titleScore(l, i, priceIndex);
    if (s > best.score) best = { score: s, index: i };
  });
  if (best.index >= 0 && best.score >= 3) {
    out.title = lines[best.index]!;
    out.found.push("title");
  } else if (!isSentence(lines[0]!) && lines[0]!.length <= 160 && !isBoilerplate(lines[0]!)) {
    // Short paste: first line is the title.
    out.title = lines[0]!;
    out.found.push("title");
  }
  const titleIndex = out.title ? lines.indexOf(out.title) : -1;

  // Shop name: a short line followed by a rating or "Star Seller", near the title.
  for (let i = Math.max(0, titleIndex - 4); i < Math.min(lines.length - 1, titleIndex + 6); i++) {
    const l = lines[i]!;
    const next = lines.slice(i + 1, i + 3).join(" ");
    if (i !== titleIndex && l.length >= 3 && l.length <= 40 && !/\s{2,}/.test(l) && !isBoilerplate(l) && /(star seller|\d\.\d\s*(out of 5|★|stars?)|^\d\.\d\b)/i.test(next) && !findAmount(l)) {
      out.shopName = l;
      break;
    }
  }

  // Reviews: "Reviews for this item (1,240)", "1,240 reviews", "(1.2k)"
  const rev =
    /reviews for this item\s*\(?\s*([\d.,]+k?)\s*\)?/i.exec(raw) ??
    /\b([\d.,]+k?)\s+(?:item\s+)?reviews\b/i.exec(raw);
  if (rev) {
    out.reviewCount = parseCount(rev[1]!);
    if (out.reviewCount !== null) out.found.push("reviews");
  }

  // Description: between a "Description"/"Item details" heading and the next section; else the prose block.
  const desc: string[] = [];
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (DESCRIPTION_START.test(lines[i]!)) {
      start = i;
      if (/^description$/i.test(lines[i]!)) break;
    }
  }
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]!;
      if (DESCRIPTION_END.test(l)) break;
      if (DESCRIPTION_START.test(l) || isBoilerplate(l)) continue;
      desc.push(l);
    }
  }
  if (!desc.length) {
    // Longest run of prose lines (not the title).
    let run: string[] = [];
    let bestRun: string[] = [];
    lines.forEach((l, i) => {
      if (i !== titleIndex && !isBoilerplate(l) && (isSentence(l) || (run.length > 0 && l.length > 25))) run.push(l);
      else {
        if (run.join(" ").length > bestRun.join(" ").length) bestRun = run;
        run = [];
      }
    });
    if (run.join(" ").length > bestRun.join(" ").length) bestRun = run;
    if (bestRun.join(" ").length >= 40) desc.push(...bestRun);
  }
  const description = desc.filter((l) => l !== out.title).join("\n").trim();
  if (description.length >= 20) {
    out.description = description.slice(0, 10000);
    out.found.push("description");
  }
  return out;
}
