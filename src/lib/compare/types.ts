/**
 * Listing comparison: the seller's own listing next to 1–5 listings they chose
 * to study. Every field a seller didn't supply is `null`, which means
 * "unknown" — never zero, never "no".
 */

export type ListingRole = "mine" | "competitor";
export type ListingSource = "manual" | "csv" | "sample";

export interface CompareListing {
  /** "mine" for the seller's listing, "c1".."c5" for comparison listings. */
  id: string;
  role: ListingRole;
  label: string;
  url: string | null;
  title: string;
  /** Competitor tags are usually not visible on Etsy, so this is often null. */
  tags: string[] | null;
  description: string | null;
  price: number | null;
  /** ISO 4217 code, e.g. "USD". Prices in different currencies are never compared. */
  currency: string | null;
  photoCount: number | null;
  hasVideo: boolean | null;
  /** Review count as the seller saw it on the listing page. Context only; never turned into sales. */
  reviewCount: number | null;
  source: ListingSource;
  /** Date (YYYY-MM-DD) the seller recorded this listing's details. */
  capturedAt: string;
}

/** Fields an evidence reference may point at, e.g. "c2.description". */
export const EVIDENCE_FIELDS = ["title", "tags", "description", "price", "currency", "photoCount", "hasVideo", "reviewCount"] as const;
export type EvidenceField = (typeof EVIDENCE_FIELDS)[number];

export interface Evidence {
  /** `${listingId}.${field}` */
  ref: string;
  /** Verbatim text from that field (or the value, for numbers). */
  quote: string;
}

export type Category = "digital";

export const CATEGORY_LABELS: Record<Category, string> = {
  digital: "Digital downloads",
};

export const MAX_COMPETITORS = 5;
export const RECOMMENDED_COMPETITORS = 3;
