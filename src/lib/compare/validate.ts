import { MAX_COMPETITORS, type Category, type CompareListing, type ListingSource } from "./types";

/** "digital" or "physical"; anything else means detect it from the listings. */
export const sanitizeCategory = (v: unknown): Category | undefined => (v === "digital" || v === "physical" ? v : undefined);

/**
 * Turns an untrusted payload (from the browser, or the server's request body)
 * into well-formed listings. Anything malformed becomes `null` (unknown)
 * rather than a guessed value.
 */

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};

export function sanitizeListing(raw: unknown, index: number): CompareListing | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const role = r.role === "mine" ? "mine" : r.role === "competitor" ? "competitor" : null;
  const title = str(r.title, 300);
  if (!role || !title) return null;
  const id = role === "mine" ? "mine" : typeof r.id === "string" && /^c[1-9]$/.test(r.id) ? r.id : `c${index}`;
  const tags = Array.isArray(r.tags)
    ? r.tags
        .map((t) => str(t, 60))
        .filter((t): t is string => t !== null)
        .slice(0, 30)
    : null;
  // Validate the whole value; truncating "dollars" to "DOL" would invent a currency.
  const currency = str(r.currency, 10)?.toUpperCase() ?? null;
  const source: ListingSource = r.source === "csv" || r.source === "sample" ? r.source : "manual";
  const captured = str(r.capturedAt, 10);
  return {
    id,
    role,
    label: str(r.label, 80) ?? (role === "mine" ? "Your listing" : `Listing ${id.slice(1)}`),
    url: str(r.url, 500),
    title,
    tags: tags && tags.length ? tags : null,
    description: str(r.description, 10000),
    price: num(r.price),
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
    photoCount: int(r.photoCount),
    hasVideo: typeof r.hasVideo === "boolean" ? r.hasVideo : null,
    reviewCount: int(r.reviewCount),
    notes: str(r.notes, 2000),
    source,
    capturedAt: captured && /^\d{4}-\d{2}-\d{2}$/.test(captured) ? captured : new Date().toISOString().slice(0, 10),
  };
}

/** One "mine" listing plus 1–5 competitors with unique ids, or an error message. */
export function sanitizeListings(raw: unknown): { listings: CompareListing[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "listings must be an array" };
  const out: CompareListing[] = [];
  const ids = new Set<string>();
  raw.slice(0, MAX_COMPETITORS + 1).forEach((r, i) => {
    const l = sanitizeListing(r, i);
    if (!l || ids.has(l.id)) return;
    ids.add(l.id);
    out.push(l);
  });
  if (!out.some((l) => l.role === "mine")) return { error: "include your own listing (role \"mine\") with a title" };
  if (!out.some((l) => l.role === "competitor")) return { error: "include at least one comparison listing" };
  return { listings: out };
}
