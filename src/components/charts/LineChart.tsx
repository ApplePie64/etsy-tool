import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { labelIndices, niceTicks, shortDate, useWidth } from "./scale";

export interface Point {
  x: string;
  y: number;
}

interface Props {
  data: Point[];
  label: string;
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  height?: number;
}

const PAD = { top: 14, right: 52, bottom: 26, left: 44 };

/**
 * Single-series line: 2px line, 10% area wash, end-dot with a surface ring and
 * an end label. Hover or arrow keys move a crosshair that snaps to the nearest week.
 */
export function LineChart({ data, label, format, tickFormat = format, height = 210 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const innerW = Math.max(40, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const ticks = niceTicks(Math.max(...data.map((d) => d.y), 0));
  const top = ticks.at(-1) || 1;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.y).toFixed(1)}`);
  const line = `M${pts.join("L")}`;
  const area = n > 1 ? `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const shown = labelIndices(n, innerW);
  const last = data[n - 1];

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? n - 1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
    else return;
    e.preventDefault();
  };

  if (n === 0) return <div className="empty small">No data yet</div>;
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${label}: ${data.map((d) => `${shortDate(d.x)} ${format(d.y)}`).join(", ")}`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 ? "baseline" : "gridline"} x1={PAD.left} x2={PAD.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {tickFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          shown.has(i) ? (
            <text key={d.x} className="tick" x={x(i)} y={height - 6} textAnchor={n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
              {shortDate(d.x)}
            </text>
          ) : null,
        )}
        {area && <path className="area" d={area} />}
        {n > 1 && <path className="line" d={line} />}
        {hover !== null && <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} />}
        {last && <circle className="dot" cx={x(n - 1)} cy={y(last.y)} r={4.5} />}
        {last && hover === null && (
          <text className="end-label" x={x(n - 1) + 9} y={y(last.y)} dy="0.32em">
            {format(last.y)}
          </text>
        )}
        {h && hover !== null && <circle className="dot" cx={x(hover)} cy={y(h.y)} r={5} />}
        <rect
          x={PAD.left - 10}
          y={PAD.top}
          width={innerW + 20}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {h && hover !== null && (
        <div className="tooltip" style={{ left: x(hover), top: y(h.y) }}>
          <strong>{format(h.y)}</strong>
          <span className="muted">
            <span className="tooltip-key" />
            {label} · week of {shortDate(h.x)}
          </span>
        </div>
      )}
      <div className="visually-hidden">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.x}>
                <th>{d.x}</th>
                <td>{format(d.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
