import { Fragment } from "react";
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABELS } from "../../lib/compare/attributes";
import { formatAmount, formatCount, formatPrice, labelOf, parseRef, FIELD_LABELS, type ComparisonAnalysis, type CompareFinding, type CoverageStatus } from "../../lib/compare/analyze";
import { GUIDANCE_BY_ID } from "../../lib/compare/guidance";
import type { Evidence } from "../../lib/compare/types";
import type { Severity } from "../../lib/stats/metrics";
import { StatusBadge } from "../ui";

const UNKNOWN = <span className="unknown">Unknown</span>;
const NOT_STATED = <span className="muted">Not stated</span>;

/** Side-by-side table: basic fields plus customer-facing details, with the source snippet on hover. */
export function ComparisonTable({ a }: { a: ComparisonAnalysis }) {
  const L = a.listings;
  const row = (label: string, render: (id: string) => React.ReactNode) => (
    <tr>
      <th scope="row">{label}</th>
      {L.map((l) => (
        <td key={l.id} className={l.role === "mine" ? "mine-col" : undefined}>
          {render(l.id)}
        </td>
      ))}
    </tr>
  );
  const get = (id: string) => L.find((l) => l.id === id)!;
  return (
    <div className="table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th />
            {L.map((l) => (
              <th key={l.id} className={l.role === "mine" ? "mine-col" : undefined}>
                {l.label}
                {l.url && (
                  <>
                    {" "}
                    <a href={l.url} target="_blank" rel="noreferrer noopener" aria-label={`Open ${l.label} on Etsy`}>
                      ↗
                    </a>
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row("Title", (id) => <span className="clamp-2" title={get(id).title}>{get(id).title}</span>)}
          {row("Price", (id) => (get(id).price === null ? UNKNOWN : formatPrice(get(id).price, get(id).currency)))}
          {row("Photos", (id) => (get(id).photoCount === null ? UNKNOWN : get(id).photoCount))}
          {row("Video", (id) => (get(id).hasVideo === null ? UNKNOWN : get(id).hasVideo ? "Yes" : "No"))}
          {row("Tags", (id) => (get(id).tags === null ? UNKNOWN : get(id).tags!.length))}
          {row("Reviews", (id) => (get(id).reviewCount === null ? UNKNOWN : get(id).reviewCount!.toLocaleString("en-US")))}
          <tr>
            <th colSpan={L.length + 1} className="section-row">
              Customer-facing details (found in each listing's own text)
            </th>
          </tr>
          {ATTRIBUTE_KEYS.map((k) => (
            <Fragment key={k}>
              {row(ATTRIBUTE_LABELS[k], (id) => {
                const r = a.attributes[id]![k];
                if (r.status === "unknown") return UNKNOWN;
                if (r.status === "not_stated") return NOT_STATED;
                return <span title={r.evidence.map((e) => `${e.field}: ${e.snippet}`).join("\n")}>{r.values.join(", ")}</span>;
              })}
            </Fragment>
          ))}
          {row("Recorded", (id) => <span className="tiny muted">{get(id).capturedAt}</span>)}
        </tbody>
      </table>
    </div>
  );
}

const COVERAGE_LABEL: Record<CoverageStatus, string> = { both: "Title + tags", title: "Title", tags: "Tags", none: "—", unknown: "?" };

export function CoverageTable({ a }: { a: ComparisonAnalysis }) {
  if (!a.coverage.terms.length) return <p className="small muted">No phrases are shared across these listings yet.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>Phrase</th>
              <th className="num">Used by</th>
              {a.listings.map((l) => (
                <th key={l.id} className={l.role === "mine" ? "mine-col" : undefined}>
                  {l.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.coverage.terms.map((t) => {
              const gap = a.coverage.gaps.some((g) => g.term === t.term);
              return (
                <tr key={t.term} className={gap ? "gap-row" : undefined}>
                  <th scope="row">
                    {t.term}
                    {gap && <span className="badge" style={{ marginLeft: 6 }}>gap</span>}
                  </th>
                  <td className="num">
                    {t.competitorCount} of {a.competitors.length}
                  </td>
                  {a.listings.map((l) => {
                    const st = t.byListing[l.id]!;
                    return (
                      <td key={l.id} className={l.role === "mine" ? "mine-col" : undefined} title={st === "unknown" ? "Not in the title; tags unknown" : undefined}>
                        <span className={st === "none" || st === "unknown" ? "muted" : undefined}>{COVERAGE_LABEL[st]}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ marginTop: 6 }}>
        "Used by" counts the listings you chose — it is not search volume. "?" means the phrase isn't in the title and that listing's tags are unknown. Check demand in{" "}
        <a href={GUIDANCE_BY_ID.get("marketplace-insights")!.url} target="_blank" rel="noreferrer noopener">
          Etsy Marketplace Insights
        </a>
        .
      </p>
    </>
  );
}

export function PriceSummary({ a }: { a: ComparisonAnalysis }) {
  const mine = a.mine;
  return (
    <div className="stack-sm small">
      {a.price.groups.map((g) => (
        <div key={g.currency}>
          <strong>{g.currency}</strong>: {g.listings.length} listing{g.listings.length === 1 ? "" : "s"}
          {g.listings.some((x) => x.id === mine?.id) ? " incl. yours" : ""}, {formatAmount(g.min)}–{formatAmount(g.max)} (median {formatAmount(g.median)})
        </div>
      ))}
      {mine && a.price.position !== "unknown" && a.price.position !== "no-comparison" && (
        <div>
          Yours ({formatPrice(mine.price, mine.currency)}) is <strong>{a.price.position === "within" ? "within the range" : `${a.price.position} every comparison listing`}</strong> in {mine.currency}
          {a.price.rank !== null &&
            (a.price.rank === 1 ? ` — the lowest of ${a.price.comparable.length + 1}` : ` — ${a.price.rank} of ${a.price.comparable.length + 1} counting from the lowest`)}
          .
        </div>
      )}
      {a.price.position === "no-comparison" && <div>No comparison listing is priced in {mine?.currency}; prices aren't converted between currencies.</div>}
      {a.price.excluded.map((e) => (
        <div key={e.id} className="muted">
          Not compared: {labelOf(a.listings, e.id)} — {e.reason}
        </div>
      ))}
      <div className="muted">
        Photos: yours {a.photos.mine ?? "unknown"} · comparison median {a.photos.competitorMedian === null ? "unknown" : formatCount(a.photos.competitorMedian)}
      </div>
    </div>
  );
}

const SEV: Record<CompareFinding["severity"], { sev: Severity; label: string }> = {
  high: { sev: "critical", label: "High" },
  medium: { sev: "warning", label: "Medium" },
  low: { sev: "info", label: "Low" },
  info: { sev: "info", label: "Note" },
};

export function EvidenceList({ a, evidence }: { a: ComparisonAnalysis; evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return (
    <ul className="evidence">
      {evidence.map((e, i) => {
        const p = parseRef(e.ref);
        return (
          <li key={i}>
            <span className="evidence-src">
              {p ? `${labelOf(a.listings, p.listingId)} · ${FIELD_LABELS[p.field]}` : e.ref}
            </span>{" "}
            <q>{e.quote.length > 160 ? e.quote.slice(0, 159) + "…" : e.quote}</q>
          </li>
        );
      })}
    </ul>
  );
}

export function GuidanceLinks({ ids }: { ids: string[] }) {
  const gs = ids.map((id) => GUIDANCE_BY_ID.get(id)).filter((g) => !!g);
  if (!gs.length) return null;
  return (
    <div className="tiny" style={{ marginTop: 6 }}>
      Guidance:{" "}
      {gs.map((g, i) => (
        <span key={g!.id}>
          {i > 0 && " · "}
          <a href={g!.url} target="_blank" rel="noreferrer noopener" title={g!.summary}>
            {g!.title}
          </a>
        </span>
      ))}
    </div>
  );
}

export function FindingsList({ a }: { a: ComparisonAnalysis }) {
  if (!a.findings.length) return <p className="small muted">No differences found on the checks this app runs.</p>;
  return (
    <div className="stack-sm">
      {a.findings.map((f) => (
        <article key={f.id} className="finding">
          <StatusBadge severity={SEV[f.severity].sev} label={SEV[f.severity].label} />
          <h4>{f.title}</h4>
          <p className="small" style={{ color: "var(--ink-2)" }}>
            {f.detail}
          </p>
          <EvidenceList a={a} evidence={f.evidence} />
          {f.ask && <p className="small ask">{f.ask}</p>}
          <GuidanceLinks ids={f.guidance} />
        </article>
      ))}
    </div>
  );
}
