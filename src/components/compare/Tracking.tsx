import { useMemo, useState } from "react";
import type { ComparisonAnalysis } from "../../lib/compare/analyze";
import type { Plan } from "../../lib/compare/plan";
import {
  compareStats,
  conversion,
  daysBetween,
  DEFAULT_WINDOW,
  diffSnapshots,
  googleCalendarUrl,
  localToday,
  reminderIcs,
  resultsSummary,
  shopTrend,
  snapshotOf,
  trackingStage,
  trackingWindows,
  VERDICT_TEXT,
  WINDOW_OPTIONS,
  type MetricResult,
  type PeriodStats,
  type TrackedChange,
} from "../../lib/compare/tracking";
import type { CompareListing } from "../../lib/compare/types";
import type { WeekStats } from "../../lib/stats/metrics";
import { QuickFill } from "./ListingEditor";

const uid = () => `trk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const EMPTY_STATS: PeriodStats = { visits: null, favorites: null, orders: null };
const longDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(n))}%`);
const appUrl = () => `${location.origin}${location.pathname}#compare`;

function saveFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * "Did it work?": record a change made on Etsy, then compare the listing's
 * Etsy Stats for equal periods before and after.
 */
export function TrackSection({
  changes,
  mine,
  analysis,
  plan,
  weeks,
  onChanges,
  onEditMine,
}: {
  changes: TrackedChange[];
  mine: CompareListing;
  analysis: ComparisonAnalysis;
  plan: Plan | null;
  weeks: WeekStats[];
  onChanges: (changes: TrackedChange[]) => void;
  onEditMine: (patch: Partial<CompareListing>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const showForm = adding || changes.length === 0;
  const patchChange = (id: string, p: Partial<TrackedChange>) => onChanges(changes.map((t) => (t.id === id ? { ...t, ...p } : t)));

  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>6. Did it work?</h2>
          <p>Record the changes you make on Etsy, then compare this listing's Etsy Stats before and after.</p>
        </div>
        {!showForm && (
          <button className="btn btn-sm" onClick={() => setAdding(true)}>
            Record another change
          </button>
        )}
      </div>
      {showForm && (
        <RecordForm
          plan={plan}
          onCancel={changes.length ? () => setAdding(false) : undefined}
          onSave={(t) => {
            onChanges([{ ...t, before: snapshotOf(mine) }, ...changes]);
            setAdding(false);
          }}
        />
      )}
      {changes.map((t) => (
        <TrackedCard
          key={t.id}
          t={t}
          mine={mine}
          analysis={analysis}
          weeks={weeks}
          onPatch={(p) => patchChange(t.id, p)}
          onDelete={() => {
            if (confirm("Delete this record of your change?")) onChanges(changes.filter((x) => x.id !== t.id));
          }}
          onEditMine={onEditMine}
        />
      ))}
    </div>
  );
}

function RecordForm({ plan, onSave, onCancel }: { plan: Plan | null; onSave: (t: Omit<TrackedChange, "before">) => void; onCancel?: () => void }) {
  const [applied, setApplied] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [changedOn, setChangedOn] = useState(localToday());
  const [windowDays, setWindowDays] = useState<number>(DEFAULT_WINDOW);
  const actions = plan?.suggestions.map((s) => s.action) ?? [];
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(changedOn) && changedOn <= localToday();
  return (
    <form
      className="subcard stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({ id: uid(), changedOn, windowDays, after: null, applied, note: note.trim(), statsBefore: null, statsAfter: null });
      }}
    >
      <p className="small" style={{ margin: 0 }}>
        Changed your listing on Etsy? Save a record <strong>before</strong> you update "Your listing" here — it keeps the current version as "before".
      </p>
      {actions.length > 0 && (
        <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
            Which suggestions did you apply?
          </legend>
          {actions.map((a) => (
            <label key={a} className="check">
              <input type="checkbox" checked={applied.includes(a)} onChange={(e) => setApplied(e.target.checked ? [...applied, a] : applied.filter((x) => x !== a))} />
              {a}
            </label>
          ))}
        </fieldset>
      )}
      <label className="field">
        <span>
          Anything else you changed <span className="field-hint">optional</span>
        </span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. new main photo, free shipping" />
      </label>
      <div className="row" style={{ alignItems: "end" }}>
        <label className="field" style={{ flex: "1 1 160px" }}>
          <span>
            Date you changed it on Etsy <span className="field-hint">set an earlier date if it was a while ago</span>
          </span>
          <input type="date" value={changedOn} max={localToday()} onChange={(e) => setChangedOn(e.target.value)} />
        </label>
        <label className="field" style={{ flex: "1 1 160px" }}>
          <span>Compare periods of</span>
          <select value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))}>
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days{d === DEFAULT_WINDOW ? " (recommended)" : d === 60 ? " (low-traffic listings)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>
          Save — I've changed my listing on Etsy
        </button>
        {onCancel && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function TrackedCard({
  t,
  mine,
  analysis,
  weeks,
  onPatch,
  onDelete,
  onEditMine,
}: {
  t: TrackedChange;
  mine: CompareListing;
  analysis: ComparisonAnalysis;
  weeks: WeekStats[];
  onPatch: (p: Partial<TrackedChange>) => void;
  onDelete: () => void;
  onEditMine: (patch: Partial<CompareListing>) => void;
}) {
  const w = trackingWindows(t);
  const now = localToday();
  const stage = trackingStage(t, now);
  const after = t.after ?? snapshotOf(mine);
  const diff = diffSnapshots(t.before, after, analysis.category);
  const trend = useMemo(() => shopTrend(weeks, t), [weeks, t]);
  const results = t.statsBefore && t.statsAfter ? compareStats(t.statsBefore, t.statsAfter, trend) : null;
  const afterOpen = now >= w.checkOn;

  const setStat = (side: "statsBefore" | "statsAfter", key: keyof PeriodStats, raw: string) => {
    const n = raw.trim() === "" ? null : Math.max(0, Math.round(Number(raw)));
    const next = { ...(t[side] ?? EMPTY_STATS), [key]: Number.isFinite(n) ? n : null };
    const empty = Object.values(next).every((v) => v === null);
    const p: Partial<TrackedChange> = { [side]: empty ? null : next };
    // Freeze the after version once results come in, so later edits don't rewrite history.
    if (side === "statsAfter" && !empty && !t.after) p.after = snapshotOf(mine);
    onPatch(p);
  };

  const statInputs = (side: "statsBefore" | "statsAfter", label: string, range: { from: string; to: string }, disabled: boolean) => (
    <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} disabled={disabled}>
      <legend className="small" style={{ fontWeight: 600 }}>
        {label}: {longDate(range.from)} – {longDate(range.to)}
      </legend>
      <div className="row" style={{ gap: 8 }}>
        {(
          [
            ["visits", "Visits / views"],
            ["favorites", "Favourites"],
            ["orders", "Orders"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="field" style={{ flex: "1 1 90px" }}>
            <span>{l}</span>
            <input type="number" min={0} inputMode="numeric" value={t[side]?.[k] ?? ""} onChange={(e) => setStat(side, k, e.target.value)} />
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <article className="subcard stack-sm">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 8 }}>
          <strong>Changed on {longDate(t.changedOn)}</strong>
          <span className={`badge${stage === "due" ? " badge-accent" : ""}`}>
            {stage === "done" ? "Results in" : stage === "due" ? "Ready to check" : `Results from ${longDate(w.checkOn)} · ${daysBetween(now, w.checkOn)} days to go`}
          </span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onDelete}>
          Delete
        </button>
      </div>

      {(t.applied.length > 0 || t.note) && (
        <ul className="plain small" style={{ margin: 0 }}>
          {t.applied.map((a) => (
            <li key={a}>Applied: {a}</li>
          ))}
          {t.note && <li>Also: {t.note}</li>}
        </ul>
      )}

      <div>
        <div className="small" style={{ fontWeight: 600 }}>
          What changed in the listing
        </div>
        {diff.length ? (
          <ul className="plain small" style={{ margin: "4px 0 0" }}>
            {diff.map((d) => (
              <li key={d.field}>
                <span className="muted">{d.label}:</span> {d.summary}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted" style={{ margin: "4px 0 0" }}>
            "Your listing" here still matches the before version. Paste the updated listing so the comparison above shows what's left to do:
          </p>
        )}
        {!t.after && !diff.length && (
          <div style={{ marginTop: 8 }}>
            <QuickFill listing={mine} onChange={onEditMine} />
          </div>
        )}
      </div>

      {stage === "waiting" && (
        <div className="callout small stack-sm">
          <span>
            Etsy needs time to show results. On <strong>{longDate(w.checkOn)}</strong>, come back and enter this listing's numbers for {t.windowDays} days before and after the change.
          </span>
          <div className="row">
            <a className="btn btn-sm" href={googleCalendarUrl(t, mine.title, appUrl())} target="_blank" rel="noreferrer noopener">
              Add to Google Calendar
            </a>
            <button className="btn btn-sm" onClick={() => saveFile("listing-results-reminder.ics", reminderIcs(t, mine.title, appUrl()), "text/calendar")}>
              Download reminder (.ics)
            </button>
          </div>
        </div>
      )}

      <p className="tiny muted" style={{ margin: 0 }}>
        Where to find the numbers: Etsy Shop Manager → Stats → set the date range → scroll to Listings → this listing. Use the same measure (visits or views) both times.
      </p>
      <div className="grid grid-2" style={{ gap: 12 }}>
        {statInputs("statsBefore", "Before", w.before, false)}
        {statInputs("statsAfter", "After", w.after, !afterOpen && !t.statsAfter)}
      </div>
      {!afterOpen && !t.statsAfter && <p className="tiny muted" style={{ margin: 0 }}>The "after" numbers open on {longDate(w.checkOn)}, once the whole period is in Etsy Stats.</p>}

      {results && <Results results={results} before={t.statsBefore} after={t.statsAfter} trend={trend} />}
    </article>
  );
}

const VERDICT_CLASS: Record<MetricResult["verdict"], string> = { up: "delta-good", down: "delta-bad", chance: "delta-flat", "too-few": "muted", unknown: "muted" };

function Results({ results, before, after, trend }: { results: MetricResult[]; before: PeriodStats | null; after: PeriodStats | null; trend: ReturnType<typeof shopTrend> }) {
  const cb = conversion(before);
  const ca = conversion(after);
  return (
    <div className="stack-sm">
      <div className="table-wrap">
        <table className="compare-table results-table">
          <thead>
            <tr>
              <th />
              <th className="num">Before → after</th>
              <th className="num">Change</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.key}>
                <th scope="row">
                  {r.label}
                  <div className={`tiny ${VERDICT_CLASS[r.verdict]}`}>{VERDICT_TEXT[r.verdict]}</div>
                </th>
                <td className="num">
                  {r.before ?? "—"} → {r.after ?? "—"}
                </td>
                <td className="num">
                  {pct(r.change)}
                  {trend && r.vsShop !== null && <div className="tiny muted">{pct(r.vsShop)} vs shop</div>}
                </td>
              </tr>
            ))}
            {cb !== null && ca !== null && (
              <tr>
                <th scope="row">
                  Conversion
                  <div className="tiny muted">Orders ÷ visits</div>
                </th>
                <td className="num">
                  {cb.toFixed(1)}% → {ca.toFixed(1)}%
                </td>
                <td className="num">
                  {ca - cb >= 0 ? "+" : "−"}
                  {Math.abs(ca - cb).toFixed(1)} pts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="small" style={{ margin: 0 }}>
        {resultsSummary(results, trend)}
      </p>
      {trend && (
        <p className="tiny muted" style={{ margin: 0 }}>
          "vs your shop" allows for your whole shop's trend from Shop Stats ({trend.weeksBefore} weeks before, {trend.weeksAfter} after): shop visits {pct(trend.visits === null ? null : (trend.visits - 1) * 100)}
          {trend.orders !== null && `, orders ${pct((trend.orders - 1) * 100)}`}.
        </p>
      )}
    </div>
  );
}
