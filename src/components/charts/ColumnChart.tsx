import { useState } from "react";
import type { Point } from "./LineChart";
import { labelIndices, niceTicks, shortDate, useWidth } from "./scale";

interface Props {
  data: Point[];
  label: string;
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  height?: number;
}

const PAD = { top: 22, right: 8, bottom: 26, left: 44 };
const MAX_BAR = 24;
const R = 4;

/** Column with a 4px rounded top and a square base. */
function columnPath(x: number, y: number, w: number, base: number): string {
  const h = base - y;
  if (h <= 0) return "";
  const r = Math.min(R, w / 2, h);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

/** Single-series weekly columns; each column is its own hover/focus target. */
export function ColumnChart({ data, label, format, tickFormat = format, height = 210 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const innerW = Math.max(40, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const ticks = niceTicks(Math.max(...data.map((d) => d.y), 0));
  const top = ticks.at(-1) || 1;
  const band = innerW / Math.max(1, n);
  const bw = Math.min(MAX_BAR, Math.max(4, band - 2));
  const cx = (i: number) => PAD.left + band * i + band / 2;
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const base = y(0);
  const shown = labelIndices(n, innerW);
  const maxIdx = data.reduce((m, d, i) => (d.y > (data[m]?.y ?? -Infinity) ? i : m), 0);

  if (n === 0) return <div className="empty small">No data yet</div>;
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`${label}: ${data.map((d) => `${shortDate(d.x)} ${format(d.y)}`).join(", ")}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "baseline" : "gridline"} x1={PAD.left} x2={PAD.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.x}>
            <path className={`bar${hover !== null && hover !== i ? " dim" : ""}`} d={columnPath(cx(i) - bw / 2, y(d.y), bw, base)} />
            {(i === n - 1 || i === maxIdx) && d.y > 0 && (
              <text className="tick" x={cx(i)} y={y(d.y) - 6} textAnchor="middle" style={{ fill: "var(--ink-2)" }}>
                {format(d.y)}
              </text>
            )}
            {shown.has(i) && (
              <text className="tick" x={cx(i)} y={height - 6} textAnchor="middle">
                {shortDate(d.x)}
              </text>
            )}
            <rect
              x={cx(i) - band / 2}
              y={PAD.top}
              width={band}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              aria-label={`${shortDate(d.x)}: ${format(d.y)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div className="tooltip" style={{ left: cx(hover), top: y(h.y) }}>
          <strong>{format(h.y)}</strong>
          <span className="muted">
            {label} · week of {shortDate(h.x)}
          </span>
        </div>
      )}
    </div>
  );
}
