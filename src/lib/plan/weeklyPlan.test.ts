import { describe, expect, it } from "vitest";
import { localAnswer, detectTopic } from "../advisor/localAdvisor";
import { buildAdvisorContext, type AdvisorState } from "../advisor/context";
import { ARCHETYPES, classifySeller, DEFAULT_PROFILE, stageFor } from "../sellers/archetypes";
import { diagnose } from "../stats/metrics";
import { sampleWeeks } from "../stats/sample";
import { buildWeeklyPlan } from "./weeklyPlan";

const profile = { ...DEFAULT_PROFILE, activeListings: 24, totalSales: 57 };
const weeks = sampleWeeks(new Date("2026-09-30T00:00:00Z"));

describe("seller archetypes", () => {
  it("maps sales to stages", () => {
    expect(stageFor(0)).toBe("launch");
    expect(stageFor(10)).toBe("traction");
    expect(stageFor(150)).toBe("growth");
    expect(stageFor(5000)).toBe("established");
  });

  it("has sane benchmark ranges for every type", () => {
    for (const a of Object.values(ARCHETYPES)) {
      expect(a.conversion.low).toBeLessThan(a.conversion.high);
      expect(a.aov.low).toBeLessThan(a.aov.high);
    }
  });

  it("adds notes specific to the profile", () => {
    const c = classifySeller({ ...profile, model: "pod", activeListings: 12, margin: 0.15 });
    expect(c.stage.id).toBe("traction");
    expect(c.notes.join(" ")).toMatch(/50\+ listings/);
    expect(c.notes.join(" ")).toMatch(/15% margin/);
  });
});

describe("weekly plan", () => {
  it("always has 7 days with 1-4 tasks each", () => {
    const plan = buildWeeklyPlan({ profile, findings: diagnose(weeks, { profile }), audit: null });
    expect(plan).toHaveLength(7);
    for (const d of plan) {
      expect(d.tasks.length).toBeGreaterThan(0);
      expect(d.tasks.length).toBeLessThanOrEqual(4);
      expect(new Set(d.tasks.map((t) => t.id)).size).toBe(d.tasks.length);
    }
  });

  it("marks days that address serious findings as priority", () => {
    const findings = diagnose([{ id: "w", weekStart: "2026-09-21", visits: 10, views: 12, favorites: 0, orders: 0, revenue: 0 }], { profile });
    const plan = buildWeeklyPlan({ profile, findings, audit: null });
    expect(plan[1]!.priority).toBe(true);
    expect(plan[1]!.tasks.some((t) => t.id === "f-lowtraffic")).toBe(true);
  });

  it("pulls shop-wide audit issues into the plan", () => {
    const audit = { averageScore: 48, listings: 10, commonIssues: [{ id: "tags-count", label: "All 13 tags used", count: 8, fix: "Add tags." }] };
    const plan = buildWeeklyPlan({ profile, findings: [], audit });
    expect(plan[2]!.tasks.some((t) => t.id === "a-tags")).toBe(true);
    expect(plan[2]!.priority).toBe(true);
  });
});

describe("advisor", () => {
  const state: AdvisorState = { profile, weeks, audit: null, lastListing: null, orders: null };

  it("routes questions to topics", () => {
    expect(detectTopic("why is my traffic down?")).toBe("traffic");
    expect(detectTopic("Why did my traffic change this week?")).toBe("traffic");
    expect(detectTopic("how many tags should I use")).toBe("seo");
    expect(detectTopic("are my etsy ads worth it")).toBe("ads");
    expect(detectTopic("what kind of seller am I compared to other sellers")).toBe("sellers");
    expect(detectTopic("what should I do this week")).toBe("plan");
    expect(detectTopic("how many photos for a digital download")).toBe("photos");
    expect(detectTopic("hello")).toBe("overview");
  });

  it("answers with the seller's own numbers", () => {
    expect(localAnswer("how is my traffic", state)).toMatch(/262 visits/);
    expect(localAnswer("is my conversion ok", state)).toMatch(/%/);
  });

  it("expands on seller types the question mentions", () => {
    const a = localAnswer("How do I compare with other kinds of sellers like print on demand?", state);
    expect(a).toMatch(/\*\*Print-on-demand:\*\*/);
  });

  it("builds a context with aggregates only", () => {
    const ctx = buildAdvisorContext(state);
    expect(ctx).toMatch(/Seller type: Handmade maker/);
    expect(ctx).toMatch(/Week over week/);
    expect(ctx).toMatch(/Traffic mix/);
  });
});
