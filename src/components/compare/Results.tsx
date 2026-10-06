import { Fragment, useState } from "react";
import { ATTRIBUTE_LABELS, type AttributeKey } from "../../lib/compare/attributes";
import { displayAmount, formatCount, formatPrice, labelOf, parseRef, FIELD_LABELS, type ComparisonAnalysis, type CompareFinding, type CoverageStatus } from "../../lib/compare/analyze";
import { GUIDANCE_BY_ID } from "../../lib/compare/guidance";
import { CATEGORY_LABELS, type Evidence } from "../../lib/compare/types";
import type { Severity } from "../../lib/stats/metrics";
import { StatusBadge } from "../ui";

const UNKNOWN = <span className="unknown">Unknown</span>;

/** "+ Add" link that opens a one-line input; saves "Label: value" into the listing's notes. */
function AddDetail({ label, onAdd }: { label: string; onAdd: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open) {
    return (
      <button type="button" className="add-detail" onClick={() => setOpen(true)} title={`Add ${label.toLowerCase()} you've seen, e.g. in the photos`}>
        Not stated · add
      </button>
    );
  }
  const save = () => {
    if (value.trim()) onAdd(value.trim());
    setOpen(false);
    setValue("");
  };
  return (
    <form
      className="add-detail-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={label} aria-label={label} onBlur={save} />
    </form>
  );
}

/**
 * Side-by-side table: basic fields plus customer-facing details, with the
 * source snippet on hover. Missing details can be added in place; details no
 * listing mentions are folded into one line instead of a wall of "Not stated".
 */
export function ComparisonTable({ a, onAddDetail }: { a: ComparisonAnalysis; onAddDetail?: (listingId: string, key: AttributeKey, value: string) => void }) {
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
  const mentioned = a.attributeKeys.filter((k) => L.some((l) => a.attributes[l.id]![k].status === "stated"));
  const unmentioned = a.attributeKeys.filter((k) => !mentioned.includes(k));
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
          {row("Tags", (id) => {
            const l = get(id);
            if (l.tags !== null) return l.tags.length;
            return <span className="muted">{l.role === "mine" ? "Not added" : "Not shown on Etsy"}</span>;
          })}
          {row("Reviews", (id) => {
            const l = get(id);
            if (l.role === "mine") return <span className="muted">—</span>;
            return l.reviewCount === null ? UNKNOWN : l.reviewCount.toLocaleString("en-US");
          })}
          <tr>
            <th colSpan={L.length + 1} className="section-row">
              What each listing tells buyers ({CATEGORY_LABELS[a.category].toLowerCase()})
            </th>
          </tr>
          {mentioned.map((k) => (
            <Fragment key={k}>
              {row(ATTRIBUTE_LABELS[k], (id) => {
                const r = a.attributes[id]![k];
                if (r.status === "stated") {
                  return <span title={r.evidence.map((e) => `${e.field}: ${e.snippet}`).join("\n")}>{r.values.join(", ")}</span>;
                }
                if (onAddDetail) return <AddDetail label={ATTRIBUTE_LABELS[k]} onAdd={(v) => onAddDetail(id, k, v)} />;
                return r.status === "unknown" ? UNKNOWN : <span className="muted">Not stated</span>;
              })}
            </Fragment>
          ))}
          {unmentioned.length > 0 && (
            <tr>
              <td colSpan={L.length + 1} className="tiny muted">
                No listing mentions: {unmentioned.map((k) => ATTRIBUTE_LABELS[k].toLowerCase()).join(", ")}.
              </td>
            </tr>
          )}
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
          {g.listings.some((x) => x.id === mine?.id) ? " incl. yours" : ""}, {displayAmount(g.min)}–{displayAmount(g.max)} (median {displayAmount(g.median)})
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
