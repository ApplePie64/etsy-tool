import { Fragment, type ReactNode } from "react";
import type { CheckStatus } from "../lib/seo/analyzer";
import type { Finding, Severity } from "../lib/stats/metrics";

const SEVERITY: Record<Severity, { icon: string; label: string }> = {
  critical: { icon: "!", label: "Critical" },
  warning: { icon: "!", label: "Needs attention" },
  info: { icon: "i", label: "Worth knowing" },
  good: { icon: "✓", label: "Going well" },
};

export function StatusBadge({ severity, label }: { severity: Severity; label?: string }) {
  const s = SEVERITY[severity];
  return (
    <span className={`status status-${severity}`}>
      <span className="status-dot" aria-hidden="true">
        {s.icon}
      </span>
      {label ?? s.label}
    </span>
  );
}

const CHECK_SEVERITY: Record<CheckStatus, Severity> = { pass: "good", warn: "warning", fail: "critical" };
const CHECK_LABEL: Record<CheckStatus, string> = { pass: "Pass", warn: "Improve", fail: "Fix" };

export function CheckIcon({ status }: { status: CheckStatus }) {
  const sev = CHECK_SEVERITY[status];
  return (
    <span className={`status status-${sev}`} title={CHECK_LABEL[status]}>
      <span className="status-dot" aria-hidden="true">
        {SEVERITY[sev].icon}
      </span>
      <span className="visually-hidden">{CHECK_LABEL[status]}</span>
    </span>
  );
}

export function FindingCard({ f, compact }: { f: Finding; compact?: boolean }) {
  return (
    <article className="finding">
      <StatusBadge severity={f.severity} />
      <h4>{f.title}</h4>
      <p className="small" style={{ color: "var(--ink-2)" }}>
        {f.detail}
      </p>
      {!compact && f.actions.length > 0 && (
        <ul>
          {f.actions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function ScoreRing({ score, grade, size = 120 }: { score: number; grade?: string; size?: number }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={9} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)}
        />
      </svg>
      <div className="score-ring-label">
        <div>
          <strong>{score}</strong>
          {grade && <div className="grade">Grade {grade}</div>}
        </div>
      </div>
    </div>
  );
}

/** Inline markdown: **bold**, _italic_, `code`. Builds React nodes, never HTML strings. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|(?<![\w])_[^_]+_(?![\w]))/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(<strong key={k++}>{inline(tok.slice(2, -2))}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={k++}>{inline(tok.slice(1, -1))}</em>);
    last = i + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Minimal markdown for advisor replies: headings, lists, paragraphs. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push(<h3 key={key++}>{inline(h[2]!)}</h3>);
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*•]\s+/, ""));
      blocks.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(
        <ol key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|\s*[-*•]\s|\s*\d+[.)]\s)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push(
      <p key={key++}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className="md">{blocks}</div>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p className="small">{children}</p>}
      {action && <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="field">
      <span>
        {label} {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}
