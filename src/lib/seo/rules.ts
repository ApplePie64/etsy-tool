/**
 * Etsy listing limits and search guidance the analyzer is built on.
 *
 * Hard limits come from Etsy's listing form. The "guidance" values are the
 * recommendations Etsy publishes in its Seller Handbook ("How Etsy Search
 * Works", "Etsy SEO") plus widely used seller rules of thumb. Etsy changes
 * these from time to time, so every number lives here in one place.
 */
export const ETSY_LIMITS = {
  titleMaxChars: 140,
  tagCount: 13,
  tagMaxChars: 20,
  maxPhotos: 20,
  maxVideos: 1,
} as const;

export const SEO_GUIDANCE = {
  /** Titles shorter than this rarely say what the item is plus a key detail. */
  titleMinChars: 25,
  /** Past this, titles start reading like keyword lists; Etsy asks for concise titles. */
  titleComfortMaxChars: 110,
  /** Etsy mobile search results cut titles off after roughly this many characters. */
  mobileTitleChars: 45,
  /** Desktop search cards show roughly this many characters. */
  desktopTitleChars: 70,
  /** Keyword should start inside this window so it survives truncation. */
  frontLoadChars: 40,
  /** Google shows roughly the first 160 characters of the description as the snippet. */
  googleSnippetChars: 160,
  googleTitleChars: 60,
  /** Photo count that uses the slots shoppers actually swipe through. */
  goodPhotoCount: 10,
  okPhotoCount: 5,
  descriptionGoodWords: 80,
  descriptionMinWords: 30,
} as const;

/** Words that are fine in ALL CAPS in a title. */
export const ALLOWED_CAPS = new Set([
  "SVG", "PNG", "PDF", "JPG", "JPEG", "DXF", "EPS", "USA", "UK", "DIY", "XL", "XXL", "XS",
  "LED", "USB", "ABC", "BFF", "DND", "NYC", "LA", "3D", "4K", "14K", "18K", "10K", "925", "II", "III",
]);

/** The ranking factors Etsy describes publicly, used by the academy and the advisor. */
export const RANKING_FACTORS = [
  {
    id: "relevancy",
    name: "Query matching & relevancy",
    summary:
      "Etsy first gathers listings whose title, tags, categories and attributes match the shopper's words, then ranks them.",
  },
  {
    id: "listing-quality",
    name: "Listing quality score",
    summary:
      "How shoppers react when your listing is shown: clicks, favorites, add-to-carts and purchases relative to how often it appears. Great photos and fair prices move this.",
  },
  {
    id: "recency",
    name: "Recency",
    summary:
      "New and newly renewed listings get a short, temporary boost so Etsy can learn how shoppers respond to them.",
  },
  {
    id: "customer-experience",
    name: "Customer & market experience",
    summary:
      "Reviews, a complete About section and shop policies, on-time shipping and message response. Policy or intellectual-property violations push listings down.",
  },
  {
    id: "shipping",
    name: "Shipping price",
    summary:
      "For US shoppers, Etsy gives priority to listings with free shipping and to shops offering the free-shipping guarantee on US orders of $35+.",
  },
  {
    id: "context",
    name: "Shopper context",
    summary:
      "Language, location, device and each shopper's own browsing and purchase history personalise results, so two people can see different rankings for the same search.",
  },
] as const;
