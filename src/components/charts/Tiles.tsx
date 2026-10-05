import type { ReactNode } from "react";

/** 12-point trend in the de-emphasis hue with the current period in the series colour. */
export function Sparkline({ values, width = 84, height = 26 }: { values: number[]; width?: number; height?: number }) {
  const v = values.slice(-12);
  if (v.length < 2) return null;
  const max = Math.max(...v);
  const min = Math.min(...v);
  const span = max - min || 1;
  const x = (i: number) => 3 + (i / (v.length - 1)) * (width - 6);
  const y = (n: number) => 3 + (height - 6) * (1 - (n - min) / span);
  const d = v.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ overflow: "visible" }}>
      <path d={d} fill="none" stroke="var(--baseline)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(v.length - 1)} cy={y(v.at(-1)!)} r={3} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}

export function Delta({ value, upIsGood = true, suffix = "vs prior week" }: { value: number | null; upIsGood?: boolean; suffix?: string }) {
  if (value === null || !Number.isFinite(value)) return <span className="delta delta-flat">— {suffix}</span>;
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : value > 0 === upIsGood;
  const arrow = flat ? "→" : value > 0 ? "▲" : "▼";
  return (
    <span className={`delta ${good === null ? "delta-flat" : good ? "delta-good" : "delta-bad"}`}>
      {arrow} {Math.abs(value * 100).toFixed(0)}% <span className="muted" style={{ fontWeight: 400 }}>{suffix}</span>
    </span>
  );
}

export function StatTile({
  label,
  value,
  delta,
  trend,
  upIsGood = true,
  note,
}: {
  label: string;
  value: string;
  delta?: number | null;
  trend?: number[];
  upIsGood?: boolean;
  note?: ReactNode;
}) {
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <div className="tile-foot">
        {delta !== undefined ? <Delta value={delta} upIsGood={upIsGood} /> : <span className="small muted">{note}</span>}
        {trend && <Sparkline values={trend} />}
      </div>
    </div>
  );
}

export function Meter({ label, score, note, severity }: { label: string; score: number; note?: string; severity?: "critical" | "warning" | "good" }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="stack-sm" style={{ gap: 2 }}>
      <div className="meter">
        <span>{label}</span>
        <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
          <div className={`meter-fill${severity ? ` sev-${severity}` : ""}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="num" style={{ textAlign: "right", fontWeight: 600 }}>
          {Math.round(score)}
        </span>
      </div>
      {note && <span className="tiny muted">{note}</span>}
    </div>
  );
}

export interface BarItem {
  key: string;
  label: string;
  value: number;
  display: string;
  hint?: string;
}

/** Horizontal bars, one series, one colour; values read as text beside the bar. */
export function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="barlist">
      {items.map((it) => (
        <div className="barlist-row" key={it.key} title={it.hint}>
          <div className="barlist-label">
            <span>{it.label}</span>
            <span className="num" style={{ fontWeight: 600 }}>
              {it.display}
            </span>
          </div>
          <div className="barlist-track">
            <div className="barlist-fill" style={{ width: `${(it.value / top) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Each step's bar and rate are relative to the first step (visits). */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0];
  const top = Math.max(first?.value ?? 0, 1);
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const rate = i > 0 && first && first.value > 0 ? s.value / first.value : null;
        return (
          <div key={s.label}>
            <div className="funnel-step">
              <span className="small">{s.label}</span>
              <div className="funnel-value">
                <div className="funnel-bar" style={{ width: `${Math.max(0.5, (s.value / top) * 72)}%` }} />
                <span className="num" style={{ fontWeight: 600 }}>
                  {s.value.toLocaleString("en-US")}
                </span>
                {rate !== null && (
                  <span className="tiny muted num">
                    {(rate * 100).toFixed(rate < 0.1 ? 1 : 0)}% of {first!.label.toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
