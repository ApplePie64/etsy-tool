/**
 * Official Etsy guidance the comparison can cite. Recommendations reference
 * these ids so a seller can read the source. Summaries paraphrase the linked
 * pages; they are not an Etsy ranking formula.
 */
export interface Guidance {
  id: string;
  title: string;
  summary: string;
  url: string;
}

const SEARCH_WORKS = "https://www.etsy.com/seller-handbook/article/375461474487";

export const GUIDANCE: Guidance[] = [
  {
    id: "search-query-matching",
    title: "How Etsy Search Works — query matching",
    summary: "Etsy first finds listings whose titles, tags, categories and attributes match a shopper's search, then ranks them.",
    url: SEARCH_WORKS,
  },
  {
    id: "search-ranking-signals",
    title: "How Etsy Search Works — ranking",
    summary:
      "Ranking considers several listing and shop signals, including relevance, how shoppers respond to the listing, customer and market experience, and shopper context. Title and tag edits are only part of it.",
    url: SEARCH_WORKS,
  },
  {
    id: "search-visibility-page",
    title: "Etsy Search Visibility page",
    summary: "Etsy's own Search Visibility page in Shop Manager lists improvement suggestions for your listings.",
    url: "https://help.etsy.com/hc/en-gb/articles/25869947521175-How-to-Use-the-Etsy-Search-Visibility-Page",
  },
  {
    id: "marketplace-insights",
    title: "Etsy Marketplace Insights",
    summary:
      "Etsy's Marketplace Insights tool shows search and listing counts for keywords over the preceding 30 days. Use it to check demand; this app doesn't have demand data.",
    url: "https://help.etsy.com/hc/en-gb/articles/35122361353239-How-Do-I-Use-Etsy-s-Marketplace-Insights-Tool",
  },
  {
    id: "listing-csv",
    title: "Download your listing information",
    summary: "Etsy's listing CSV export contains titles, descriptions, prices, currency, tags, materials, image URLs, quantity and SKU.",
    url: "https://help.etsy.com/hc/en-gb/articles/360000343508-How-to-Download-Your-Listing-Information",
  },
  {
    id: "shop-stats",
    title: "Etsy Stats",
    summary: "Traffic sources, visits and conversion live in Etsy Stats, not in the listing export.",
    url: "https://help.etsy.com/hc/en-us/articles/115015774268-How-to-Use-Etsy-Stats-for-Your-Shop",
  },
];

export const GUIDANCE_BY_ID = new Map(GUIDANCE.map((g) => [g.id, g]));
