import { useState } from "react";
import { NumberField } from "../components/ui";
import { ARCHETYPES, classifySeller, COMPARE_ROWS, STAGES, type ModelId, type StageId } from "../lib/sellers/archetypes";
import { money, pct } from "../lib/stats/metrics";
import { useStore } from "../store";

const MODEL_IDS = Object.keys(ARCHETYPES) as ModelId[];
const STAGE_IDS = Object.keys(STAGES) as StageId[];

export function SellerTypes() {
  const { data, update, go } = useStore();
  const p = data.profile;
  const setP = (patch: Partial<typeof p>) => update((s) => ({ profile: { ...s.profile, ...patch }, profileSet: true }));
  const { archetype, stage, notes } = classifySeller(p);
  const [explore, setExplore] = useState<ModelId>(p.model);
  const ex = ARCHETYPES[explore];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Seller Types</h1>
          <p>
            Etsy shops grow differently depending on what they sell and how far along they are. Tell us about your shop to get benchmarks and priorities that fit — and see how the other kinds of sellers compare.
          </p>
        </div>
      </div>

      <div className="card stack">
        <h2>What do you mainly sell?</h2>
        <div className="type-grid">
          {MODEL_IDS.map((id) => {
            const a = ARCHETYPES[id];
            return (
              <button key={id} className="type-card" aria-pressed={p.model === id} onClick={() => {
                setP({ model: id, secondary: (p.secondary ?? []).filter((m) => m !== id) });
                setExplore(id);
              }}>
                <strong>{a.name}</strong>
                <span>{a.tagline}</span>
                <span className="tiny">{a.examples}</span>
              </button>
            );
          })}
        </div>
        <div className="stack-sm">
          <span className="small" style={{ fontWeight: 500 }}>
            Also sell (hybrid shop)?
          </span>
          <div className="chips">
            {MODEL_IDS.filter((m) => m !== p.model).map((m) => {
              const on = p.secondary?.includes(m) ?? false;
              return (
                <label key={m} className="chip check" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setP({ secondary: on ? (p.secondary ?? []).filter((x) => x !== m) : [...(p.secondary ?? []), m] })}
                  />
                  {ARCHETYPES[m].name}
                </label>
              );
            })}
          </div>
        </div>
        <div className="grid grid-4" style={{ gap: 12 }}>
          <NumberField label="Active listings" value={p.activeListings} onChange={(v) => setP({ activeListings: v ?? 0 })} />
          <NumberField label="Lifetime sales" value={p.totalSales} onChange={(v) => setP({ totalSales: v ?? 0 })} />
          <NumberField label="Hours per week" value={p.hoursPerWeek} onChange={(v) => setP({ hoursPerWeek: v ?? 0 })} />
          <NumberField
            label="Profit margin"
            hint="% before ads"
            value={Math.round(p.margin * 100)}
            onChange={(v) => setP({ margin: Math.max(0, Math.min(95, v ?? 0)) / 100 })}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stack-sm">
          <span className="badge badge-accent" style={{ alignSelf: "flex-start" }}>
            Your type
          </span>
          <h2>{archetype.name}</h2>
          <p className="sub">{archetype.description}</p>
          <div className="grid grid-2" style={{ gap: 10, marginTop: 6 }}>
            <div className="tile">
              <span className="tile-label">Typical conversion</span>
              <span className="tile-value" style={{ fontSize: "1.25rem" }}>
                {pct(archetype.conversion.low, 1)}–{pct(archetype.conversion.high, 1)}
              </span>
            </div>
            <div className="tile">
              <span className="tile-label">Typical order value</span>
              <span className="tile-value" style={{ fontSize: "1.25rem" }}>
                {money(archetype.aov.low)}–{money(archetype.aov.high)}
              </span>
            </div>
          </div>
          <p className="tiny muted">Community rules of thumb — Etsy doesn't publish category benchmarks. Your own trend matters most.</p>
          <p className="small">
            <strong>Peak seasons:</strong> {archetype.peakSeasons}
          </p>
        </div>

        <div className="card stack-sm">
          <span className="badge badge-accent" style={{ alignSelf: "flex-start" }}>
            Your stage
          </span>
          <h2>
            {stage.name} <span className="muted small">({stage.range})</span>
          </h2>
          <p className="sub">
            Focus: <strong>{stage.focus}</strong> Key metric: <strong>{stage.keyMetric}</strong>.
          </p>
          <ul className="plain">
            {stage.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <p className="small muted">Ignore for now: {stage.ignore}</p>
          {notes.length > 0 && (
            <div className="callout stack-sm">
              {notes.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => go("overview")}>
              See my 7-day plan
            </button>
            <button className="btn btn-sm" onClick={() => go("advisor")}>
              Ask the advisor
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Growth stages</h2>
          <p>Based on lifetime sales</p>
        </div>
        <div className="stage-ladder">
          {STAGE_IDS.map((id) => {
            const st = STAGES[id];
            return (
              <div key={id} className={`stage${id === stage.id ? " current" : ""}`} aria-current={id === stage.id ? "step" : undefined}>
                <strong>{st.name}</strong> <span className="muted">{st.range}</span>
                <div style={{ marginTop: 4 }}>{st.focus}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  Watch: {st.keyMetric}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Compare the kinds of Etsy sellers</h2>
          <p>Your type is highlighted</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th />
                {MODEL_IDS.map((id) => (
                  <th key={id} style={id === p.model ? { background: "var(--accent-soft)", color: "var(--ink)" } : undefined}>
                    {ARCHETYPES[id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {MODEL_IDS.map((id) => {
                    const v = ARCHETYPES[id].compare[row.key];
                    const cls = v === "Medium" ? "" : v === row.goodWhen ? "level-good" : "level-bad";
                    return (
                      <td key={id} style={id === p.model ? { background: "var(--accent-soft)" } : undefined}>
                        <span className={`level ${cls}`}>{v}</span>
                        {v !== "Medium" && <span className="visually-hidden">{v === row.goodWhen ? " (favourable)" : " (challenging)"}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row">Conversion</th>
                {MODEL_IDS.map((id) => (
                  <td key={id} className="num" style={id === p.model ? { background: "var(--accent-soft)" } : undefined}>
                    {pct(ARCHETYPES[id].conversion.low, 1)}–{pct(ARCHETYPES[id].conversion.high, 1)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Order value</th>
                {MODEL_IDS.map((id) => (
                  <td key={id} className="num" style={id === p.model ? { background: "var(--accent-soft)" } : undefined}>
                    {money(ARCHETYPES[id].aov.low)}–{money(ARCHETYPES[id].aov.high)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Peak seasons</th>
                {MODEL_IDS.map((id) => (
                  <td key={id} className="small" style={id === p.model ? { background: "var(--accent-soft)" } : undefined}>
                    {ARCHETYPES[id].peakSeasons}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Green = favourable, red = challenging for that row. Conversion and order-value ranges are rules of thumb.
        </p>
      </div>

      <div className="card stack">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>Playbook: {ex.name}</h2>
          <label className="field" style={{ minWidth: 220 }}>
            <span className="visually-hidden">Choose a seller type</span>
            <select value={explore} onChange={(e) => setExplore(e.target.value as ModelId)}>
              {MODEL_IDS.map((id) => (
                <option key={id} value={id}>
                  {ARCHETYPES[id].name}
                  {id === p.model ? " (you)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="sub">{ex.description}</p>
        <div className="grid grid-3">
          <PlaybookList title="Strengths" items={ex.strengths} />
          <PlaybookList title="Challenges" items={ex.challenges} />
          <PlaybookList title="Watch out" items={ex.watchOut} />
          <PlaybookList title="SEO" items={ex.seo} />
          <PlaybookList title="Traffic" items={ex.traffic} />
          <PlaybookList title="Pricing" items={ex.pricing} />
        </div>
      </div>
    </div>
  );
}

function PlaybookList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul className="plain">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
