import type { BulkAuditSummary } from "../seo/bulk";
import { ARCHETYPES, STAGES, stageFor, type SellerProfile } from "../sellers/archetypes";
import type { Finding } from "../stats/metrics";

export interface PlanTask {
  id: string;
  text: string;
  minutes: number;
  /** Why this task is in the plan (a finding title, the seller type...). */
  reason?: string;
}

export interface PlanDay {
  day: number;
  theme: string;
  goal: string;
  priority: boolean;
  tasks: PlanTask[];
}

export interface PlanInput {
  profile: SellerProfile;
  findings: Finding[];
  audit?: Pick<BulkAuditSummary, "averageScore" | "commonIssues" | "listings"> | null;
}

const MAX_TASKS = 4;

/**
 * A 7-day plan: one theme per day, base tasks everyone should do, plus tasks
 * pulled in by this shop's findings and seller type. Days that address a
 * critical or warning finding are flagged as priority.
 */
export function buildWeeklyPlan({ profile, findings, audit }: PlanInput): PlanDay[] {
  const arche = ARCHETYPES[profile.model];
  const stage = STAGES[stageFor(profile.totalSales)];
  const has = (id: string) => findings.find((f) => f.id === id);
  const serious = (id: string) => {
    const f = has(id);
    return !!f && (f.severity === "critical" || f.severity === "warning");
  };
  const issue = (id: string) => audit?.commonIssues.find((i) => i.id === id);

  const days: PlanDay[] = [
    {
      day: 1,
      theme: "Measure & audit",
      goal: "Know your baseline before changing anything.",
      priority: false,
      tasks: [
        { id: "d1-stats", text: "Record last week's visits, orders, revenue and traffic sources in Shop Stats.", minutes: 10 },
        { id: "d1-audit", text: audit ? `Re-run the bulk SEO audit (last average: ${audit.averageScore}/100).` : "Export \"Currently for sale listings\" CSV and run the bulk SEO audit.", minutes: 10 },
        { id: "d1-pick", text: "Pick 5 listings to work on this week: your 2 best sellers and 3 with views but no sales.", minutes: 15 },
      ],
    },
    {
      day: 2,
      theme: "Titles & keywords",
      goal: "Match the words shoppers actually type.",
      priority: false,
      tasks: [
        { id: "d2-research", text: "For each of the 5 listings, type the main product into Etsy search and note 5 autocomplete phrases.", minutes: 20 },
        { id: "d2-titles", text: "Rewrite the 5 titles: main keyword first, one clear description, no repeated words.", minutes: 25 },
      ],
    },
    {
      day: 3,
      theme: "Tags, attributes & category",
      goal: "Use all 13 tags and every attribute as extra ways to be found.",
      priority: false,
      tasks: [
        { id: "d3-tags", text: "Fill all 13 tags with multi-word phrases on the 5 listings (use SEO Lab suggestions).", minutes: 25 },
        { id: "d3-attrs", text: "Complete every attribute and choose the most specific category.", minutes: 10 },
      ],
    },
    {
      day: 4,
      theme: "Photos & conversion",
      goal: "Turn more visits into orders.",
      priority: false,
      tasks: [
        { id: "d4-hero", text: "Reshoot or re-crop photo 1 on the 5 listings: bright, clear, product filling the frame.", minutes: 40 },
        { id: "d4-desc", text: "Open each description with one keyword-rich sentence, then size, materials and timing.", minutes: 20 },
      ],
    },
    {
      day: 5,
      theme: "Pricing, shipping & offers",
      goal: "Protect margin and raise order value.",
      priority: false,
      tasks: [
        { id: "d5-profit", text: "Run your best seller through the profit calculator. Is every sale actually profitable?", minutes: 15 },
        { id: "d5-shipping", text: "Check shipping prices; consider free shipping built into the price for US buyers.", minutes: 15 },
      ],
    },
    {
      day: 6,
      theme: "Traffic beyond search",
      goal: "Add one more reliable source of visitors.",
      priority: false,
      tasks: [{ id: "d6-channel", text: arche.traffic[0] ?? "Share your best listings on one social channel.", minutes: 30, reason: arche.name }],
    },
    {
      day: 7,
      theme: "Customer experience & review",
      goal: "Earn trust signals and plan next week.",
      priority: false,
      tasks: [
        { id: "d7-cx", text: "Check About section, policies and FAQs are complete; reply to all messages within 24h.", minutes: 15 },
        { id: "d7-review", text: "Compare this week's numbers with last week in Shop Stats and pick next week's 5 listings.", minutes: 15 },
      ],
    },
  ];

  const add = (day: number, task: PlanTask, priority = false) => {
    const d = days[day - 1]!;
    if (d.tasks.some((t) => t.id === task.id)) return;
    d.tasks.unshift(task);
    if (d.tasks.length > MAX_TASKS) d.tasks.length = MAX_TASKS;
    if (priority) d.priority = true;
  };

  // Stage-specific focus goes on day 1.
  add(1, { id: "stage-focus", text: `Stage focus (${stage.name}): ${stage.goals[0]}`, minutes: 20, reason: `${stage.name} stage` });

  // Findings → tasks
  const lowTraffic = has("low-traffic");
  if (lowTraffic) {
    add(2, { id: "f-lowtraffic", text: "Add 2 new listings targeting phrases your current listings don't cover.", minutes: 60, reason: lowTraffic.title }, true);
  }
  if (serious("weak-search") || serious("seo-average")) {
    const f = has("weak-search") ?? has("seo-average")!;
    add(2, { id: "f-search", text: "Fix the top 2 priority items from the SEO Lab on your 10 lowest-scoring listings.", minutes: 45, reason: f.title }, true);
  }
  const titleIssue = issue("title-keyword") ?? issue("title-frontload") ?? issue("title-stuffing");
  if (titleIssue && audit && titleIssue.count >= Math.max(2, audit.listings * 0.3)) {
    add(2, { id: "a-title", text: `${titleIssue.count} listings fail "${titleIssue.label}". ${titleIssue.fix ?? ""}`.trim(), minutes: 30, reason: "Bulk audit" }, true);
  }
  const tagIssue = issue("tags-count") ?? issue("tags-longtail") ?? issue("tags-duplicates");
  if (tagIssue && audit && tagIssue.count >= Math.max(2, audit.listings * 0.3)) {
    add(3, { id: "a-tags", text: `${tagIssue.count} listings fail "${tagIssue.label}". ${tagIssue.fix ?? ""}`.trim(), minutes: 30, reason: "Bulk audit" }, true);
  }
  const lowCr = has("low-conversion");
  if (lowCr) {
    add(4, { id: "f-cr", text: "Compare your listing side-by-side with the top 3 search results for the same keyword: photo, price, shipping, reviews.", minutes: 30, reason: lowCr.title }, true);
  }
  if (has("shallow-browsing")) {
    add(4, { id: "f-browse", text: "Create shop sections and feature your 4 best listings on the shop home.", minutes: 20, reason: has("shallow-browsing")!.title });
  }
  const aov = has("low-aov");
  if (aov) add(5, { id: "f-aov", text: "Create one bundle or set listing from items people often buy together.", minutes: 30, reason: aov.title });
  const adsBad = has("ads-unprofitable") ?? has("ads-thin");
  if (adsBad) {
    add(5, { id: "f-ads", text: "In Etsy Ads, turn off listings with 30+ clicks and no orders; keep your best converters.", minutes: 20, reason: adsBad.title }, adsBad.severity === "critical");
  }
  const adsDep = has("ads-dependence");
  if (adsDep) add(6, { id: "f-adsdep", text: "Improve organic SEO on your advertised listings so they rank without ads.", minutes: 30, reason: adsDep.title }, true);
  const drop = has("traffic-drop");
  if (drop) add(1, { id: "f-drop", text: drop.actions[0] ?? "Find where the traffic drop came from.", minutes: 15, reason: drop.title }, true);
  const strong = has("strong-conversion");
  if (strong) add(5, { id: "f-price", text: "Test a 5–10% price increase on your best seller and watch conversion for 2 weeks.", minutes: 10, reason: strong.title });

  // Seller-type tasks
  if (arche.watchOut[0]) add(7, { id: "type-watch", text: arche.watchOut[0], minutes: 15, reason: arche.name });
  if (arche.seo[0]) add(3, { id: "type-seo", text: arche.seo[0], minutes: 20, reason: arche.name });

  return days;
}

export const planMinutes = (d: PlanDay) => d.tasks.reduce((s, t) => s + t.minutes, 0);
