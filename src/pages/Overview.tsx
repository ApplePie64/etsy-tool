import { useMemo } from "react";
import { shortDate } from "../components/charts/scale";
import { Meter, StatTile } from "../components/charts/Tiles";
import { FindingCard } from "../components/ui";
import { COURSE } from "../lib/academy/course";
import { localToday, trackingStage } from "../lib/compare/tracking";
import { buildWeeklyPlan, planMinutes } from "../lib/plan/weeklyPlan";
import { classifySeller } from "../lib/sellers/archetypes";
import { diagnose, money, pct, shopHealth, summarize } from "../lib/stats/metrics";
import { SAMPLE_LISTING, sampleWeeks } from "../lib/stats/sample";
import { useStore } from "../store";

export function Overview() {
  const { data, update, go } = useStore();
  const s = useMemo(() => summarize(data.weeks), [data.weeks]);
  const { findings, health } = useMemo(() => {
    const opts = { profile: data.profile, seoAverage: data.audit?.averageScore };
    return { findings: diagnose(data.weeks, opts), health: shopHealth(data.weeks, opts) };
  }, [data.weeks, data.profile, data.audit]);
  const plan = useMemo(() => buildWeeklyPlan({ profile: data.profile, findings, audit: data.audit }), [data.profile, findings, data.audit]);
  const { archetype, stage } = classifySeller(data.profile);
  const allTasks = plan.flatMap((d) => d.tasks.map((t) => `${d.day}:${t.id}`));
  const doneCount = allTasks.filter((k) => data.planDone[k]).length;
  const nextLesson = COURSE.find((l) => !data.academy.completed.includes(l.day));
  const tracked = data.comparisons.flatMap((c) => c.changes ?? []);
  const dueCount = tracked.filter((t) => trackingStage(t, localToday()) === "due").length;
  const isNew = !data.profileSet && data.weeks.length === 0 && !data.audit;

  const loadDemo = () =>
    update({
      weeks: sampleWeeks(),
      draft: { ...SAMPLE_LISTING },
      profile: { ...data.profile, model: "handmade", activeListings: 24, totalSales: 57, hoursPerWeek: 12, margin: 0.35, shopName: "Demo shop" },
      profileSet: true,
    });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{data.profile.shopName ? `${data.profile.shopName} overview` : "Shop overview"}</h1>
          <p>
            Your shop at a glance: health, last week's numbers, what needs attention, and a 7-day plan built from your data and your seller type.
          </p>
        </div>
        <div className="row">
          <span className="badge badge-accent">{archetype.name}</span>
          <span className="badge">
            {stage.name} · {stage.range}
          </span>
        </div>
      </div>

      {isNew && (
        <div className="card stack">
          <h2>Get started</h2>
          <button className="type-card" onClick={() => go("compare")} style={{ borderColor: "var(--accent)" }}>
            <strong>Compare your listing with 3–5 others</strong>
            <span>See what they tell buyers that you don't, how prices and phrases differ, and get an evidence-backed improvement plan.</span>
          </button>
          <p className="small muted">Or set up your shop dashboard:</p>
          <div className="grid grid-3">
            <button className="type-card" onClick={() => go("sellers")}>
              <strong>1. Your seller type</strong>
              <span>What you sell and how far along you are — sets your benchmarks.</span>
            </button>
            <button className="type-card" onClick={() => go("stats")}>
              <strong>2. Last week's stats</strong>
              <span>Visits, orders, revenue and traffic sources from Shop Manager → Stats.</span>
            </button>
            <button className="type-card" onClick={() => go("seo")}>
              <strong>3. Audit your listings</strong>
              <span>Paste one listing or upload your listings CSV to the SEO Lab.</span>
            </button>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={loadDemo}>
              Explore with a demo shop
            </button>
            <span className="small muted">Everything you enter stays in this browser.</span>
          </div>
        </div>
      )}

      <div className="split split-health">
        <div className="card stack-sm">
          <span className="tile-label">Shop health</span>
          {health.score !== null ? (
            <>
              <span className="hero-figure">
                {health.score}
                <span className="muted" style={{ fontSize: "1.2rem", fontWeight: 500 }}>
                  /100
                </span>
              </span>
              <div className="stack-sm" style={{ marginTop: 8 }}>
                {health.components.map((c) => (
                  <Meter key={c.id} label={c.label} score={c.score} note={c.note} />
                ))}
              </div>
            </>
          ) : (
            <p className="small muted">Log a week of stats or audit your listings to see a health score.</p>
          )}
        </div>
        {s.latest ? (
          <div className="grid grid-2" style={{ alignContent: "start" }}>
            <StatTile label={`Visits · week of ${shortDate(s.latest.weekStart)}`} value={s.latest.visits.toLocaleString("en-US")} delta={s.wow.visits} trend={s.weeks.map((w) => w.visits)} />
            <StatTile label="Orders" value={String(s.latest.orders)} delta={s.wow.orders} trend={s.weeks.map((w) => w.orders)} />
            <StatTile label="Conversion rate" value={pct(s.latest.conversionRate)} delta={s.wow.conversionRate} trend={s.weeks.map((w) => w.conversionRate)} />
            <StatTile label="Revenue" value={money(s.latest.revenue)} delta={s.wow.revenue} trend={s.weeks.map((w) => w.revenue)} />
          </div>
        ) : (
          <div className="card empty" style={{ display: "grid", placeItems: "center" }}>
            <div>
              <h3>No weekly stats yet</h3>
              <p className="small">Week-over-week changes appear once you log a week.</p>
              <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => go("stats")}>
                Log a week
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>What needs attention</h2>
          <button className="btn btn-sm btn-ghost" onClick={() => go("advisor")}>
            Discuss with the advisor →
          </button>
        </div>
        <div className="grid grid-2">
          {findings.slice(0, 4).map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Your 7-day plan</h2>
            <p>
              Built for a {archetype.name.toLowerCase()} shop at the {stage.name.toLowerCase()} stage. Days marked <strong>Priority</strong> address your most serious findings.
            </p>
          </div>
          <div style={{ minWidth: 180 }}>
            <div className="row small" style={{ justifyContent: "space-between" }}>
              <span>
                {doneCount}/{allTasks.length} tasks
              </span>
              {doneCount > 0 && (
                <button className="btn btn-sm btn-ghost" onClick={() => update({ planDone: {} })}>
                  Reset
                </button>
              )}
            </div>
            <div className="progress">
              <div style={{ width: `${allTasks.length ? (doneCount / allTasks.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-2">
          {plan.map((d) => (
            <section key={d.day} className={`plan-day${d.priority ? " priority" : ""}`}>
              <header>
                <h3>
                  Day {d.day} · {d.theme}
                </h3>
                <span className="row" style={{ gap: 6 }}>
                  {d.priority && <span className="badge badge-accent">Priority</span>}
                  <span className="tiny muted">~{planMinutes(d)} min</span>
                </span>
              </header>
              <p className="tiny muted" style={{ marginBottom: 4 }}>
                {d.goal}
              </p>
              {d.tasks.map((t) => {
                const k = `${d.day}:${t.id}`;
                const done = !!data.planDone[k];
                return (
                  <label key={t.id} className={`plan-task${done ? " done" : ""}`}>
                    <input type="checkbox" checked={done} onChange={() => update((st) => ({ planDone: { ...st.planDone, [k]: !done } }))} />
                    <span>
                      {t.text}
                      {t.reason && <span className="tiny muted"> — {t.reason}</span>}
                    </span>
                    <span className="tiny muted num">{t.minutes}m</span>
                  </label>
                );
              })}
            </section>
          ))}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card stack-sm">
          <h2>Listing comparisons</h2>
          <p className="sub">
            {data.comparisons.length
              ? `${data.comparisons.length} saved. Latest: ${data.comparisons[0]!.name}${data.comparisons[0]!.plan ? ` — ${data.comparisons[0]!.plan.suggestions.length} suggestions` : ""}.`
              : "Compare your listing with listings you want to learn from."}
          </p>
          {tracked.length > 0 && (
            <p className={`small${dueCount ? " ask" : " muted"}`} style={{ margin: 0 }}>
              {tracked.length} change{tracked.length === 1 ? "" : "s"} tracked
              {dueCount ? ` · ${dueCount} ready to check — enter the Etsy Stats to see if it worked` : ""}.
            </p>
          )}
          <button className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => go("compare")}>
            Open Compare Listings
          </button>
        </div>
        <div className="card stack-sm">
          <h2>7-Day Academy</h2>
          <p className="sub">
            {data.academy.completed.length}/{COURSE.length} lessons complete.{" "}
            {nextLesson ? `Next: Day ${nextLesson.day} — ${nextLesson.title}.` : "Course complete — revisit any day for a refresher."}
          </p>
          <div className="progress">
            <div style={{ width: `${(data.academy.completed.length / COURSE.length) * 100}%` }} />
          </div>
          <button className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => go("academy")}>
            {nextLesson ? `Continue Day ${nextLesson.day}` : "Open Academy"}
          </button>
        </div>
        <div className="card stack-sm">
          <h2>Listing SEO</h2>
          {data.audit ? (
            <p className="sub">
              Average score <strong>{data.audit.averageScore}/100</strong> across {data.audit.listings} listings. Most common issue: {data.audit.commonIssues[0]?.label ?? "none"}.
            </p>
          ) : (
            <p className="sub">Upload your listings CSV to audit every listing and find shop-wide fixes.</p>
          )}
          <button className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={() => go("seo")}>
            Open SEO Lab
          </button>
        </div>
      </div>
    </div>
  );
}
