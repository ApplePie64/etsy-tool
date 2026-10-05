import { buildWeeklyPlan } from "../plan/weeklyPlan";
import { RANKING_FACTORS } from "../seo/rules";
import { ARCHETYPES, classifySeller, type ModelId } from "../sellers/archetypes";
import { diagnose, money, pct, shopHealth, sourceShares, summarize, type Finding } from "../stats/metrics";
import type { AdvisorState } from "./context";

/**
 * Offline advisor used when no Claude API key is configured. It routes the
 * question to a topic and answers from the app's own rule engine and the
 * seller's data. Output is lightweight markdown (headings, bullets, bold).
 */

type Topic = "traffic" | "conversion" | "seo" | "photos" | "pricing" | "ads" | "sellers" | "customer" | "plan" | "algorithm" | "overview";

const TOPIC_PATTERNS: [Topic, RegExp][] = [
  ["plan", /\b(plan|what should i (do|work on|focus on)|where (do|should) i start|priorit\w*|to-?do|next steps?|7 days?)\b/i],
  ["ads", /\b(ads?|advertis\w*|roas|offsite|promot\w*|budget|ppc)\b/i],
  ["photos", /\b(photos?|pictures?|images?|video|thumbnail|mockups?)\b/i],
  ["pricing", /\b(pric\w*|fees?|profit|margin|costs?|shipping|aov|order value|discounts?|coupons?)\b/i],
  ["customer", /\b(reviews?|star seller|customer service|messages?|policies|about section|trust)\b/i],
  ["algorithm", /\b(algorithm|ranking|rank|how does (etsy )?search|search works?)\b/i],
  ["sellers", /\b(seller types?|types? of sellers?|kinds? of sellers?|kind of seller|archetypes?|business model|print on demand|compare sellers?|other sellers|which type|my stage|what stage)\b/i],
  ["seo", /\b(seo|keywords?|titles?|tags?|attributes?|categor\w*|search terms?|found|findable)\b/i],
  ["conversion", /\b(conversion|convert\w*|not selling|no sales|few sales|orders?|buy\w*|sell more)\b/i],
  ["traffic", /\b(traffic|visits?|visitors?|views?|impressions?|sources?|pinterest|instagram|tiktok|social|google)\b/i],
];

const MODEL_MENTIONS: Record<ModelId, RegExp> = {
  handmade: /\bhandmade\b|\bmakers?\b/i,
  personalized: /personali[sz]ed|\bcustom\b/i,
  pod: /print[- ]on[- ]demand|\bpod\b|printify|printful/i,
  digital: /\bdigital\b|printables?|\bsvg\b|templates?/i,
  vintage: /\bvintage\b/i,
  supplies: /\bsuppl(y|ies)\b/i,
  art: /\bart(ists?)?\b|\bprints\b/i,
};

export function detectTopic(q: string): Topic {
  for (const [t, re] of TOPIC_PATTERNS) if (re.test(q)) return t;
  return "overview";
}

const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");

function findingBlock(fs: Finding[], max = 3): string {
  if (!fs.length) return "";
  return fs
    .slice(0, max)
    .map((f) => `**${f.title}.** ${f.detail}\n${bullets(f.actions.slice(0, 3))}`)
    .join("\n\n");
}

export function localAnswer(question: string, state: AdvisorState): string {
  const topic = detectTopic(question);
  const opts = { profile: state.profile, seoAverage: state.audit?.averageScore };
  const findings = diagnose(state.weeks, opts);
  const s = summarize(state.weeks);
  const { archetype, stage } = classifySeller(state.profile);
  const byArea = (...areas: Finding["area"][]) => findings.filter((f) => areas.includes(f.area) && f.id !== "no-data");
  const hasStats = !!s.latest;
  const noStats = "_Add your weekly numbers in **Shop Stats** and I can make this specific to your shop._";

  switch (topic) {
    case "traffic": {
      const parts = ["### Traffic"];
      if (s.last4 && s.latest) {
        parts.push(
          `Last week: **${s.latest.visits} visits**${s.wow.visits !== null ? ` (${s.wow.visits >= 0 ? "+" : ""}${pct(s.wow.visits, 0)} vs the week before)` : ""}.`,
        );
        const shares = sourceShares(s.last4.sources);
        if (shares.length) parts.push(`Where visits came from (last 4 weeks): ${shares.slice(0, 4).map((x) => `${x.label} ${pct(x.share, 0)}`).join(", ")}.`);
      } else parts.push(noStats);
      const fb = findingBlock(byArea("traffic", "seo"));
      if (fb) parts.push(fb);
      parts.push(`**Traffic ideas for ${archetype.name.toLowerCase()} shops:**\n${bullets(archetype.traffic)}`);
      return parts.join("\n\n");
    }
    case "conversion": {
      const parts = ["### Turning visits into orders"];
      if (s.last4 && s.last4.visits > 0) {
        parts.push(
          `Your conversion over the last ${Math.min(4, s.weeks.length)} weeks is **${pct(s.last4.conversionRate)}** (${s.last4.orders} orders / ${s.last4.visits} visits). Typical for ${archetype.name.toLowerCase()} shops: ${pct(archetype.conversion.low, 1)}–${pct(archetype.conversion.high, 1)}.`,
        );
      } else parts.push(noStats);
      const fb = findingBlock(byArea("conversion", "pricing"));
      parts.push(
        fb ||
          `Check, in order: photo 1 at thumbnail size, price vs the top 5 results for your keyword, shipping cost, reviews, and whether the description answers size/material/timing questions.`,
      );
      return parts.join("\n\n");
    }
    case "seo": {
      const parts = ["### Etsy SEO"];
      if (state.lastListing) {
        const r = state.lastListing.report;
        parts.push(`Your last analysed listing scored **${r.score}/100 (${r.grade})**. Top fixes:\n${bullets(r.priorities.slice(0, 4).map((p) => `${p.label}: ${p.fix ?? p.detail}`))}`);
      }
      if (state.audit) {
        parts.push(`Across ${state.audit.listings} listings the average is **${state.audit.averageScore}/100**. Most common issues:\n${bullets(state.audit.commonIssues.slice(0, 3).map((i) => `${i.label} — ${i.count} listings`))}`);
      }
      parts.push(
        `**Rules that matter most:**\n${bullets([
          "Main keyword at the start of the title; one readable description, no repeated words.",
          "All 13 tags, as 2–4 word phrases covering what it is, who it's for, occasion, style, material.",
          "Repeat your key title phrase as a tag so it appears in both places Etsy matches on.",
          "Fill every attribute and use the most specific category.",
          ...archetype.seo.slice(0, 1),
        ])}`,
      );
      if (!state.lastListing && !state.audit) parts.push("_Paste a listing into the **SEO Lab** and I'll point to exact fixes._");
      return parts.join("\n\n");
    }
    case "photos":
      return [
        "### Photos & video",
        "Photo 1 wins the click in search; the rest close the sale. Aim for 10+ photos (Etsy allows 20) and a 5–15 second video.",
        bullets([
          "Photo 1: bright natural light, simple background, product fills the frame, readable as a small thumbnail.",
          "Scale shot (in hand / worn / next to a familiar object).",
          "Detail close-ups of texture and finish.",
          "Lifestyle shot showing it in use.",
          "Every variation, plus what's included / packaging.",
        ]),
        state.profile.model === "digital" ? "For digital items, photo 2 should be a \"what you get\" graphic listing files, sizes and formats." : "",
      ].filter(Boolean).join("\n\n");
    case "pricing": {
      const parts = ["### Pricing, fees & order value"];
      parts.push(
        `US fees per order: $0.20 listing + 6.5% transaction + 3% + $0.25 processing (plus 12–15% Offsite Ads on orders from those ads). Use the **profit calculator** in Shop Stats to check each bestseller.`,
      );
      if (s.last4 && s.last4.orders > 0) parts.push(`Your average order over the last 4 weeks: **${money(s.last4.aov)}** (typical for your type: ${money(archetype.aov.low)}–${money(archetype.aov.high)}).`);
      parts.push(`**Pricing notes for ${archetype.name.toLowerCase()} shops:**\n${bullets(archetype.pricing)}`);
      const fb = findingBlock(byArea("pricing"), 2);
      if (fb) parts.push(fb);
      return parts.join("\n\n");
    }
    case "ads": {
      const parts = ["### Etsy Ads & Offsite Ads"];
      const breakEven = 1 / (state.profile.margin || 0.35);
      parts.push(`With your ${pct(state.profile.margin || 0.35, 0)} margin, ads break even at **${breakEven.toFixed(1)}× ROAS** (ad revenue ÷ ad spend).`);
      const fb = findingBlock(byArea("ads"));
      parts.push(
        fb ||
          bullets([
            "Advertise only listings that already convert organically.",
            "Start with a small daily budget and judge after ~30 days.",
            "Turn off listings with many clicks and no orders.",
            "Offsite Ads cost 15% of the order (12% and mandatory once you pass $10k/year), capped at $100 — include that in pricing.",
          ]),
      );
      return parts.join("\n\n");
    }
    case "sellers": {
      const mentioned = (Object.keys(MODEL_MENTIONS) as ModelId[]).filter((m) => MODEL_MENTIONS[m].test(question));
      const parts = [
        "### Kinds of Etsy sellers",
        `You're set up as **${archetype.name}** at the **${stage.name}** stage (${stage.range}). Focus now: ${stage.focus} Key metric: ${stage.keyMetric}.`,
        bullets(
          (Object.values(ARCHETYPES)).map(
            (a) => `**${a.name}** — ${a.tagline} Typical conversion ${pct(a.conversion.low, 1)}–${pct(a.conversion.high, 1)}, orders ${money(a.aov.low)}–${money(a.aov.high)}.`,
          ),
        ),
      ];
      for (const m of mentioned.filter((m) => m !== state.profile.model).slice(0, 2)) {
        const a = ARCHETYPES[m];
        parts.push(`**${a.name}:** ${a.description}\n${bullets([...a.challenges.slice(0, 2), ...a.watchOut.slice(0, 1)])}`);
      }
      parts.push("Compare them side by side on the **Seller Types** tab.");
      return parts.join("\n\n");
    }
    case "customer":
      return [
        "### Customer experience & Star Seller",
        "Customer experience is one of Etsy's ranking factors. Star Seller looks at the last 3 months:",
        bullets([
          "Reply to 95% of first messages within 24 hours.",
          "Ship 95% of orders on time with tracking (or confirmed on time).",
          "Keep a 4.8+ average review rating.",
          "At least 5 orders and $300 in sales in that period.",
        ]),
        "Also complete your About section, shop policies and FAQs, and include a thank-you note — it's the cheapest way to earn reviews.",
      ].join("\n\n");
    case "algorithm":
      return [
        "### How Etsy search ranks listings",
        "Etsy first finds listings whose title, tags, category and attributes match the search, then ranks them by:",
        bullets(RANKING_FACTORS.map((f) => `**${f.name}** — ${f.summary}`)),
        "Day 1 of the **7-Day Academy** walks through this in detail.",
      ].join("\n\n");
    case "plan": {
      const plan = buildWeeklyPlan({ profile: state.profile, findings, audit: state.audit });
      const pri = plan.filter((d) => d.priority);
      return [
        "### Your week",
        pri.length ? `Priority days this week: ${pri.map((d) => `Day ${d.day} (${d.theme})`).join(", ")}.` : "No urgent issues found — a steady improvement week.",
        plan.map((d) => `**Day ${d.day} — ${d.theme}:** ${d.tasks[0]?.text ?? ""}`).join("\n"),
        "The full checklist is on the **Overview** tab.",
      ].join("\n\n");
    }
    case "overview":
    default: {
      const health = shopHealth(state.weeks, opts);
      const parts = ["### Shop overview"];
      parts.push(`**${archetype.name}**, ${stage.name} stage (${stage.range}). ${stage.focus}`);
      if (health.score !== null) parts.push(`Shop health **${health.score}/100**: ${health.components.map((c) => `${c.label} ${c.score}`).join(", ")}.`);
      if (!hasStats) parts.push(noStats);
      const top = findings.filter((f) => f.severity !== "good" && f.id !== "no-data");
      if (top.length) parts.push(`**What I'd look at first:**\n\n${findingBlock(top, 2)}`);
      parts.push("Ask me about traffic, conversion, SEO, photos, pricing, ads, seller types, or \"what should I do this week?\"");
      return parts.join("\n\n");
    }
  }
}
