export type TabId = "overview" | "seo" | "stats" | "sellers" | "academy" | "advisor";

export const TABS: { id: TabId; label: string; short: string }[] = [
  { id: "overview", label: "Overview", short: "Overview" },
  { id: "seo", label: "SEO Lab", short: "SEO" },
  { id: "stats", label: "Shop Stats", short: "Stats" },
  { id: "sellers", label: "Seller Types", short: "Sellers" },
  { id: "academy", label: "7-Day Academy", short: "Learn" },
  { id: "advisor", label: "Advisor", short: "Advisor" },
];
