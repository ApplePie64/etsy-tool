/**
 * Seller archetypes: what you sell (business model) × how far along you are
 * (stage). Benchmarks are rules of thumb gathered from seller communities —
 * Etsy doesn't publish category benchmarks — so treat them as a sanity
 * check and compare yourself mostly against your own trend.
 */

export type ModelId = "handmade" | "personalized" | "pod" | "digital" | "vintage" | "supplies" | "art";
export type StageId = "launch" | "traction" | "growth" | "established";
export type Level = "Low" | "Medium" | "High";

export interface Range {
  low: number;
  high: number;
}

export interface Archetype {
  id: ModelId;
  name: string;
  tagline: string;
  examples: string;
  description: string;
  /** Orders ÷ visits, as a fraction. `low`–`high` is a typical healthy band. */
  conversion: Range;
  /** Average order value in USD. */
  aov: Range;
  compare: {
    startupCost: Level;
    margin: Level;
    timePerSale: Level;
    scalability: Level;
    competition: Level;
    policyRisk: Level;
  };
  peakSeasons: string;
  strengths: string[];
  challenges: string[];
  seo: string[];
  traffic: string[];
  pricing: string[];
  watchOut: string[];
}

export const ARCHETYPES: Record<ModelId, Archetype> = {
  handmade: {
    id: "handmade",
    name: "Handmade maker",
    tagline: "You make physical goods yourself.",
    examples: "Jewelry, candles, ceramics, bags, soap, home decor, knitwear",
    description:
      "The classic Etsy shop. Your edge is craft and story; your ceiling is production time. Growth comes from better prices, fewer but better-selling designs, and batching production.",
    conversion: { low: 0.01, high: 0.03 },
    aov: { low: 25, high: 80 },
    compare: { startupCost: "Medium", margin: "Medium", timePerSale: "High", scalability: "Low", competition: "Medium", policyRisk: "Low" },
    peakSeasons: "Nov–Dec, then Valentine's and Mother's Day",
    strengths: ["Genuinely unique product", "Strong fit with Etsy's handmade identity", "Room to charge for craftsmanship"],
    challenges: ["Production time caps revenue", "Underpricing labour", "Photos must convey quality you can't touch"],
    seo: [
      "Lead with what the item is in plain words (\"sterling silver hoop earrings\"), then the style or material that sets it apart.",
      "Use tags for the gift angles: recipient, occasion, and style words shoppers pair with your product.",
      "Fill materials and every attribute — colour, occasion and style filters are how shoppers narrow results.",
    ],
    traffic: [
      "Pinterest works well for visual handmade goods: pin every listing photo with a keyword-rich description.",
      "Short process videos (Reels/TikTok) showing the making build an audience that buys again.",
      "Try Etsy Ads on your 3–5 best converters only, with a small daily budget, and judge after 30 days.",
    ],
    pricing: [
      "Price = materials + labour (your hourly rate) + overhead + Etsy fees + profit, then check the market.",
      "Build shipping into the price to offer free shipping — it's a US search priority.",
    ],
    watchOut: [
      "Limit custom one-off requests: offer fixed options (sizes, colours) instead, so orders don't outgrow your hours.",
      "Photograph and date your designs and process — it deters copycats and helps with IP reports.",
    ],
  },
  personalized: {
    id: "personalized",
    name: "Personalised & custom gifts",
    tagline: "You make items with names, dates, photos or custom details.",
    examples: "Name necklaces, custom portraits, engraved boards, wedding signs, pet portraits",
    description:
      "Gift buyers search with intent (\"personalized gift for mom\") and convert well, but every order carries messages, proofs and deadline pressure. Systems matter more than in any other model.",
    conversion: { low: 0.015, high: 0.04 },
    aov: { low: 25, high: 70 },
    compare: { startupCost: "Medium", margin: "High", timePerSale: "Medium", scalability: "Medium", competition: "High", policyRisk: "Low" },
    peakSeasons: "Nov–Dec, Mother's/Father's Day, Valentine's, wedding season (May–Sep)",
    strengths: ["High purchase intent", "Premium pricing for personalisation", "Strong review and repeat-gifting potential"],
    challenges: ["Order errors are costly", "Holiday cut-off dates", "High competition on generic phrases"],
    seo: [
      "Pair \"personalized\" / \"custom\" with the product and the recipient: \"personalized cutting board for couple\".",
      "Create occasion-specific listings (wedding, anniversary, new home) rather than one catch-all listing.",
      "Show the personalisation clearly in photo 1 — a real name example lifts clicks.",
    ],
    traffic: [
      "Plan Q4 early: update listings and photos in September–October so they gain history before the rush.",
      "Etsy Ads perform well on high-intent gift searches — tag seasonal variants.",
      "Collect photos of customers' items (with permission) for social proof.",
    ],
    pricing: [
      "Charge for the proof and the personalisation, not just materials.",
      "Offer a rush option as a paid variation during peak season.",
    ],
    watchOut: ["Use the personalisation field with a clear example format", "Publish holiday order deadlines on the shop banner"],
  },
  pod: {
    id: "pod",
    name: "Print-on-demand",
    tagline: "Your designs, printed and shipped by a production partner.",
    examples: "T-shirts, mugs, posters, tote bags, phone cases via Printify/Printful/Gelato",
    description:
      "Low inventory risk and fast to list, which means very high competition. Wins come from tight niches, original designs and many listings — not from generic slogans.",
    conversion: { low: 0.008, high: 0.025 },
    aov: { low: 20, high: 45 },
    compare: { startupCost: "Low", margin: "Low", timePerSale: "Low", scalability: "High", competition: "High", policyRisk: "High" },
    peakSeasons: "Nov–Dec, plus niche holidays (teacher appreciation, Pride, Halloween)",
    strengths: ["No inventory", "Scale by designs, not hours", "Test ideas quickly"],
    challenges: ["Thin margins after fees", "Saturated generic niches", "Quality and shipping times you don't control"],
    seo: [
      "Target specific niches and identities: \"funny nurse shirt for night shift\" beats \"funny shirt\".",
      "Name the product type and the design theme — shoppers search for both.",
      "Use lifestyle mockups; the first photo decides the click in a crowded results page.",
    ],
    traffic: [
      "Volume matters: many well-targeted listings in one niche build shop authority.",
      "Pinterest and niche communities (teachers, nurses, hobby groups) drive qualified traffic.",
      "Be careful with ads: margins are thin, so compute your break-even ROAS first.",
    ],
    pricing: [
      "Know your true margin: base cost + shipping + Etsy fees + offsite ads fee exposure.",
      "Bundles (2 shirts) and matching sets raise order value.",
    ],
    watchOut: [
      "You must list your production partner in the listing — Etsy's creativity standards require it.",
      "Trademarks and fan art are the #1 reason POD shops get suspended. Only sell original designs.",
    ],
  },
  digital: {
    id: "digital",
    name: "Digital downloads",
    tagline: "Files the buyer downloads: printables, templates, patterns.",
    examples: "Planners, wall-art printables, SVG cut files, Canva templates, sewing/crochet patterns",
    description:
      "No shipping, no production per sale, instant delivery. Prices are low, so revenue comes from volume, bundles and many listings. Mockups are your product photos.",
    conversion: { low: 0.015, high: 0.04 },
    aov: { low: 4, high: 15 },
    compare: { startupCost: "Low", margin: "High", timePerSale: "Low", scalability: "High", competition: "High", policyRisk: "Medium" },
    peakSeasons: "Jan (planners), Aug–Sep (back to school), Oct–Dec (holiday printables)",
    strengths: ["Near-100% margin after fees", "Sells while you sleep", "Easy to create variations"],
    challenges: ["Low order value", "Buyers must understand what they get", "Easy for others to copy"],
    seo: [
      "Include the format in title and tags: \"printable\", \"digital download\", \"SVG\", \"Canva template\".",
      "Say who it's for and the use case: \"budget planner for couples\", \"teacher classroom decor printable\".",
      "Make photo 1 a clear mockup and photo 2 a \"what you get\" graphic listing files and sizes.",
    ],
    traffic: [
      "Pinterest is the strongest external channel for printables and templates.",
      "Bundles and \"mega packs\" lift order value — list them alongside singles.",
      "Seasonal listings should go live 6–8 weeks before the season.",
    ],
    pricing: [
      "The $0.20 listing fee and $0.25+ processing fee weigh heavily on a $3 item — test $5+ prices and bundles.",
      "Use \"buy 3 save 25%\" sales to raise average order value.",
    ],
    watchOut: ["Only use fonts, graphics and AI tools whose licences allow commercial resale", "State clearly that nothing physical ships"],
  },
  vintage: {
    id: "vintage",
    name: "Vintage curator",
    tagline: "You source and resell items 20+ years old.",
    examples: "Vintage clothing, mid-century decor, retro kitchenware, antique jewelry",
    description:
      "Every item is a one-off, so each listing is its own SEO project. Your edge is sourcing and knowing what things are called — era, maker and pattern names are the keywords collectors search.",
    conversion: { low: 0.005, high: 0.02 },
    aov: { low: 30, high: 120 },
    compare: { startupCost: "Medium", margin: "High", timePerSale: "Medium", scalability: "Medium", competition: "Low", policyRisk: "Low" },
    peakSeasons: "Steady year-round, holiday bump in Nov–Dec",
    strengths: ["Less direct competition per item", "Collectors search precisely", "Good margins on smart finds"],
    challenges: ["Quantity is one — no bestseller to optimise", "Sourcing time", "Condition disputes"],
    seo: [
      "Use collector vocabulary: era (\"1970s\"), maker, pattern name, model number, material.",
      "Put \"vintage\" plus the era in the title — shoppers filter by both.",
      "Measurements and condition notes in the description prevent returns.",
    ],
    traffic: [
      "List consistently (e.g. 5 a day); fresh listings get recency exposure.",
      "Instagram and Pinterest reward cohesive, styled photos of your aesthetic.",
      "Tell your repeat buyers when you drop new finds.",
    ],
    pricing: ["Research sold prices on comparable items, not asking prices.", "Price in room for offers and coupons."],
    watchOut: ["Check every vintage listing is at least 20 years old — that's Etsy's rule for the vintage category.", "Photograph and describe every flaw to prevent returns and disputes."],
  },
  supplies: {
    id: "supplies",
    name: "Craft supplies",
    tagline: "You sell materials and tools other makers use.",
    examples: "Beads, yarn, fabric, findings, stickers, wax, packaging, tools",
    description:
      "Buyers are makers who reorder. Search is spec-driven (size, quantity, material), conversion is high and loyalty matters. Win on reliability, clear specs and bundles.",
    conversion: { low: 0.02, high: 0.05 },
    aov: { low: 12, high: 40 },
    compare: { startupCost: "Medium", margin: "Medium", timePerSale: "Low", scalability: "High", competition: "Medium", policyRisk: "Low" },
    peakSeasons: "Aug–Nov (makers stock up for the holidays)",
    strengths: ["Repeat customers", "Predictable demand", "Easy to bundle"],
    challenges: ["Price comparison is easy for buyers", "Inventory management", "Low differentiation"],
    seo: [
      "Put specs in the title: size, quantity, material, colour — \"6mm round glass beads 100 pcs\".",
      "Use variations for sizes and colours so one strong listing collects the reviews.",
      "Tag the projects buyers make with it (\"jewelry making supplies\", \"candle making kit\").",
    ],
    traffic: [
      "Repeat buyers are your engine: thank-you coupons for the next order work well.",
      "Tutorials and project ideas on YouTube/Pinterest bring makers to you.",
    ],
    pricing: ["Tiered quantities (50 / 100 / 500) with better unit prices raise order value.", "Watch competitors' shipping thresholds."],
    watchOut: ["Keep stock counts accurate — cancellations hurt your customer-experience score"],
  },
  art: {
    id: "art",
    name: "Artist & prints",
    tagline: "You sell original art and reproductions of your work.",
    examples: "Paintings, illustration prints, photography, ceramics art pieces",
    description:
      "Art is bought on emotion and fit. Buyers need to picture it in their home, so room mockups and size guidance matter as much as keywords. Prints scale an original.",
    conversion: { low: 0.005, high: 0.02 },
    aov: { low: 30, high: 150 },
    compare: { startupCost: "Low", margin: "High", timePerSale: "Medium", scalability: "Medium", competition: "High", policyRisk: "Low" },
    peakSeasons: "Nov–Dec, spring home refresh",
    strengths: ["Unique IP you own", "Prints scale one original", "High perceived value"],
    challenges: ["Subjective demand", "Keyword research is harder for art", "Shipping large pieces"],
    seo: [
      "Describe subject, style, medium and room: \"abstract botanical watercolor print for living room\".",
      "Tag decor styles (boho, mid century, coastal) and colours — shoppers decorate by palette.",
      "Show the piece in a room and next to furniture for scale.",
    ],
    traffic: ["Instagram and Pinterest are natural fits.", "Offer size variations to catch more searches in one listing."],
    pricing: ["Sell originals and prints side by side.", "Offer framed options as a higher-priced variation."],
    watchOut: ["Protect your work: watermark social previews, not listing photos"],
  },
};

export interface Stage {
  id: StageId;
  name: string;
  range: string;
  focus: string;
  keyMetric: string;
  goals: string[];
  ignore: string;
}

export const STAGES: Record<StageId, Stage> = {
  launch: {
    id: "launch",
    name: "Launch",
    range: "0–10 sales",
    focus: "Getting found at all.",
    keyMetric: "Visits per week",
    goals: [
      "Reach 20–30 active listings — each listing is another way into search.",
      "Make every listing search-ready (13 multi-word tags, clear title, 10 photos).",
      "Complete About, policies and shop announcement — they feed the customer-experience score.",
      "Get your first 5 reviews: ship fast and include a thank-you note.",
    ],
    ignore: "Conversion rate — too few visits to mean anything yet.",
  },
  traction: {
    id: "traction",
    name: "Traction",
    range: "10–100 sales",
    focus: "Finding out what sells and why.",
    keyMetric: "Conversion rate",
    goals: [
      "Identify your top 3–5 listings by orders and make variations of them.",
      "Fix listings with visits but no sales: first photo, price, shipping.",
      "Test Etsy Ads on proven listings only, with a small daily budget.",
      "Work towards Star Seller: reply within 24h, ship on time with tracking.",
    ],
    ignore: "Total listing count for its own sake — double down on what converts.",
  },
  growth: {
    id: "growth",
    name: "Growth",
    range: "100–1,000 sales",
    focus: "Scaling what works without breaking.",
    keyMetric: "Revenue per visit",
    goals: [
      "Raise average order value: bundles, sets, free-shipping threshold.",
      "Build one off-Etsy channel (Pinterest, Instagram or email) you own.",
      "Batch production and templatise messages and packaging.",
      "Test price increases of 5–10% on bestsellers and watch conversion.",
    ],
    ignore: "Chasing every trend — protect the core catalogue.",
  },
  established: {
    id: "established",
    name: "Established",
    range: "1,000+ sales",
    focus: "Margin, resilience and diversification.",
    keyMetric: "Profit per order",
    goals: [
      "Audit ads profitability monthly against break-even ROAS.",
      "Reduce single-listing dependence: no listing should be >30% of revenue.",
      "Consider help (production partners within Etsy rules, assistants).",
      "Grow repeat customers with follow-up offers and new collections.",
    ],
    ignore: "Vanity metrics like favourites and followers.",
  },
};

export interface SellerProfile {
  model: ModelId;
  /** Other models the shop also sells, if hybrid. */
  secondary?: ModelId[];
  activeListings: number;
  totalSales: number;
  hoursPerWeek: number;
  /** Profit margin before ad spend (after materials and Etsy fees), 0–1. Used for ad break-even. */
  margin: number;
  shopName?: string;
}

export const DEFAULT_PROFILE: SellerProfile = {
  model: "handmade",
  activeListings: 0,
  totalSales: 0,
  hoursPerWeek: 10,
  margin: 0.35,
};

export function stageFor(totalSales: number): StageId {
  if (totalSales >= 1000) return "established";
  if (totalSales >= 100) return "growth";
  if (totalSales >= 10) return "traction";
  return "launch";
}

export interface Classification {
  archetype: Archetype;
  stage: Stage;
  /** Short observations specific to this profile. */
  notes: string[];
}

export function classifySeller(p: SellerProfile): Classification {
  const archetype = ARCHETYPES[p.model];
  const stage = STAGES[stageFor(p.totalSales)];
  const notes: string[] = [];

  if (p.activeListings < 20 && (stage.id === "launch" || stage.id === "traction")) {
    notes.push(
      `${p.activeListings} active listings is a small footprint in search. Most shops at this stage grow fastest by getting to 20–30 well-optimised listings.`,
    );
  }
  if ((p.model === "digital" || p.model === "pod") && p.activeListings < 50) {
    notes.push(`${archetype.name} shops usually need a larger catalogue (50+ listings in a focused niche) because prices are low and competition is high.`);
  }
  if (p.model === "vintage" && p.activeListings < 50) {
    notes.push("Vintage shops sell one-offs, so a steady flow of new listings is what keeps traffic up.");
  }
  if (p.hoursPerWeek > 0 && p.hoursPerWeek < 6) {
    notes.push(`With about ${p.hoursPerWeek} hours a week, pick one improvement per week and batch it — e.g. photos on Saturday, listings on Sunday.`);
  }
  if (p.margin > 0 && p.margin < 0.2) {
    notes.push(`A ${Math.round(p.margin * 100)}% margin leaves little room for ads or offsite-ads fees. Revisit pricing before paying for traffic.`);
  }
  if (p.secondary?.length) {
    notes.push(`Hybrid shop: keep ${p.secondary.map((m) => ARCHETYPES[m].name.toLowerCase()).join(" and ")} listings in their own shop sections so shoppers (and you) can tell the lines apart.`);
  }
  return { archetype, stage, notes };
}

export const COMPARE_ROWS: { key: keyof Archetype["compare"]; label: string; goodWhen: Level }[] = [
  { key: "startupCost", label: "Startup cost", goodWhen: "Low" },
  { key: "margin", label: "Margin per sale", goodWhen: "High" },
  { key: "timePerSale", label: "Your time per sale", goodWhen: "Low" },
  { key: "scalability", label: "Scalability", goodWhen: "High" },
  { key: "competition", label: "Competition", goodWhen: "Low" },
  { key: "policyRisk", label: "Policy / IP risk", goodWhen: "Low" },
];
