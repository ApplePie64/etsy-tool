import { useMemo, useState, type KeyboardEvent } from "react";
import { BarList, Meter } from "../components/charts/Tiles";
import { CheckIcon, Empty, ScoreRing } from "../components/ui";
import { analyzeListing, AREA_LABELS, type ListingInput } from "../lib/seo/analyzer";
import { auditListingsCsv } from "../lib/seo/bulk";
import { parseCsvRecords } from "../lib/csv";
import { ANGLE_LABELS } from "../lib/seo/keywords";
import { ETSY_LIMITS, SEO_GUIDANCE } from "../lib/seo/rules";
import { SAMPLE_LISTING } from "../lib/stats/sample";
import { EMPTY_DRAFT, useStore, type SavedAudit } from "../store";

export function SeoLab() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>SEO Lab</h1>
          <p>Score a listing against how Etsy search matches and ranks listings, then fix the highest-impact items first.</p>
        </div>
        <div className="segmented" role="group" aria-label="Mode">
          <button aria-pressed={mode === "single"} onClick={() => setMode("single")}>
            Single listing
          </button>
          <button aria-pressed={mode === "bulk"} onClick={() => setMode("bulk")}>
            Whole shop (CSV)
          </button>
        </div>
      </div>
      {mode === "single" ? <SingleListing /> : <BulkAudit onOpen={() => setMode("single")} />}
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState("");
  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...tags];
    for (const p of parts) if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next.slice(0, ETSY_LIMITS.tagCount));
    setText("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(text);
    } else if (e.key === "Backspace" && !text && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className={`chip${t.length > ETSY_LIMITS.tagMaxChars ? " over" : ""}`} title={`${t.length} characters`}>
          {t}
          <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      {tags.length < ETSY_LIMITS.tagCount && (
        <input
          aria-label="Add tag"
          value={text}
          placeholder={tags.length ? "Add tag…" : "Type a tag and press Enter (or paste comma-separated)"}
          onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value) : setText(e.target.value))}
          onKeyDown={onKey}
          onBlur={() => commit(text)}
        />
      )}
    </div>
  );
}

function SingleListing() {
  const { data, update } = useStore();
  const d = data.draft;
  const set = (patch: Partial<ListingInput>) => update((s) => ({ draft: { ...s.draft, ...patch } }));
  const report = useMemo(() => analyzeListing(d), [d]);
  const hasInput = d.title.trim() || d.tags.length || d.description.trim();
  const titleLen = d.title.length;

  return (
    <div className="split">
      <section className="card stack" aria-label="Listing details">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <h2>Your listing</h2>
          <div className="row">
            <button className="btn btn-sm" onClick={() => update({ draft: { ...SAMPLE_LISTING } })}>
              Load example
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => update({ draft: EMPTY_DRAFT })}>
              Clear
            </button>
          </div>
        </div>

        <label className="field">
          <span>
            Target keyword <span className="field-hint">the search phrase this listing should rank for</span>
          </span>
          <input type="text" value={d.primaryKeyword ?? ""} placeholder="e.g. gold initial necklace" onChange={(e) => set({ primaryKeyword: e.target.value })} />
        </label>

        <label className="field">
          <span className="field-label">
            <span>Title</span>
            <span className={`field-hint num${titleLen > ETSY_LIMITS.titleMaxChars ? " delta-bad" : ""}`}>
              {titleLen}/{ETSY_LIMITS.titleMaxChars}
            </span>
          </span>
          <textarea
            rows={2}
            style={{ minHeight: 60 }}
            className={titleLen > ETSY_LIMITS.titleMaxChars ? "over" : ""}
            value={d.title}
            placeholder="Gold Initial Necklace, Dainty Personalized Letter Pendant"
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, " ") })}
          />
        </label>

        <div className="field">
          <span className="field-label" style={{ fontSize: "0.85rem", fontWeight: 500 }}>
            <span>Tags</span>
            <span className="field-hint num">
              {d.tags.length}/{ETSY_LIMITS.tagCount} · max {ETSY_LIMITS.tagMaxChars} chars each
            </span>
          </span>
          <TagInput tags={d.tags} onChange={(tags) => set({ tags })} />
        </div>

        <label className="field">
          <span className="field-label">
            <span>Description</span>
            <span className="field-hint">first ~{SEO_GUIDANCE.googleSnippetChars} characters become the Google snippet</span>
          </span>
          <textarea rows={5} value={d.description} onChange={(e) => set({ description: e.target.value })} />
        </label>

        <div className="grid grid-2" style={{ gap: 12 }}>
          <label className="field">
            <span>Category</span>
            <input type="text" value={d.category ?? ""} placeholder="e.g. Necklaces" onChange={(e) => set({ category: e.target.value })} />
          </label>
          <label className="field">
            <span>
              Photos <span className="field-hint">0–{ETSY_LIMITS.maxPhotos}</span>
            </span>
            <input
              type="number"
              min={0}
              max={ETSY_LIMITS.maxPhotos}
              value={d.photoCount}
              onChange={(e) => set({ photoCount: Math.max(0, Math.min(ETSY_LIMITS.maxPhotos, Number(e.target.value) || 0)) })}
            />
          </label>
        </div>

        <div className="grid grid-2" style={{ gap: 8 }}>
          <label className="check">
            <input type="checkbox" checked={d.hasVideo} onChange={(e) => set({ hasVideo: e.target.checked })} /> Has a listing video
          </label>
          <label className="check">
            <input type="checkbox" checked={d.freeShipping} onChange={(e) => set({ freeShipping: e.target.checked })} /> Free shipping (US)
          </label>
          <label className="check">
            <input type="checkbox" checked={d.attributesComplete} onChange={(e) => set({ attributesComplete: e.target.checked })} /> All attributes filled in
          </label>
          <label className="check">
            <input type="checkbox" checked={!!d.isDigital} onChange={(e) => set({ isDigital: e.target.checked })} /> Digital download
          </label>
        </div>
      </section>

      <section className="stack" aria-label="SEO report" aria-live="polite">
        {!hasInput ? (
          <Empty
            title="Paste a listing to see its score"
            action={
              <button className="btn btn-primary" onClick={() => update({ draft: { ...SAMPLE_LISTING } })}>
                Try the example listing
              </button>
            }
          >
            Copy the title, tags and description from Shop Manager → Listings. Everything stays in your browser.
          </Empty>
        ) : (
          <>
            <div className="card">
              <div className="row" style={{ gap: 20, alignItems: "center", flexWrap: "nowrap" }}>
                <ScoreRing score={report.score} grade={report.grade} />
                <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                  <h2>{report.verdict}</h2>
                  {report.areas.map((a) => (
                    <Meter key={a.area} label={AREA_LABELS[a.area]} score={(a.points / a.maxPoints) * 100} />
                  ))}
                </div>
              </div>
            </div>

            {report.priorities.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h2>Fix these first</h2>
                  <p>Ordered by points you'd gain</p>
                </div>
                <ul className="check-list">
                  {report.priorities.slice(0, 6).map((c) => (
                    <li key={c.id} className="check-item">
                      <CheckIcon status={c.status} />
                      <div>
                        <strong>{c.label}</strong>
                        <div className="fix">{c.fix}</div>
                        <div className="tiny muted">{c.detail}</div>
                      </div>
                      <span className="badge num">+{c.maxPoints - c.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card">
              <div className="card-head">
                <h2>Tag ideas</h2>
                <p>From your own words and missing shopper angles — check each in Etsy's search autocomplete</p>
              </div>
              {report.missingAngles.length > 0 && (
                <p className="small" style={{ marginBottom: 8 }}>
                  Angles your tags don't cover yet: <strong>{report.missingAngles.map((a) => ANGLE_LABELS[a]).join(", ")}</strong>
                </p>
              )}
              <div className="chips">
                {report.tagSuggestions.map((t) => (
                  <button
                    key={t}
                    className="chip"
                    disabled={d.tags.length >= ETSY_LIMITS.tagCount}
                    title={d.tags.length >= ETSY_LIMITS.tagCount ? "All 13 tags used — remove one first" : "Add as a tag"}
                    onClick={() => set({ tags: [...d.tags, t].slice(0, ETSY_LIMITS.tagCount) })}
                  >
                    + {t}
                  </button>
                ))}
                {report.tagSuggestions.length === 0 && <span className="small muted">Add a title to get ideas.</span>}
              </div>
            </div>

            <div className="grid grid-2">
              <div className="card">
                <h3 style={{ marginBottom: 8 }}>In Etsy search (mobile)</h3>
                <div className="preview-card">
                  <div className="preview-thumb">photo 1</div>
                  <div>{report.preview.mobileTitle || <span className="muted">No title</span>}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {d.freeShipping ? "FREE shipping" : "+ shipping"}
                  </div>
                </div>
              </div>
              <div className="card">
                <h3 style={{ marginBottom: 8 }}>In Google</h3>
                <div className="preview-card" style={{ background: "var(--surface)" }}>
                  <div className="tiny muted">etsy.com › listing</div>
                  <div className="google-title">{report.preview.googleTitle || "No title"}</div>
                  <div className="small" style={{ color: "var(--ink-2)" }}>
                    {report.preview.googleSnippet || <span className="muted">No description — Google will pick text for you.</span>}
                  </div>
                </div>
                <div className="stack-sm small" style={{ marginTop: 10 }}>
                  <strong>Keyword "{report.coverage.keyword || "—"}"{report.coverage.inferred ? " (inferred)" : ""}</strong>
                  {(
                    [
                      ["In title", report.coverage.inTitle],
                      ["In first 40 characters", report.coverage.frontLoaded],
                      ["Used as a tag", report.coverage.inTags],
                      ["In description opening", report.coverage.inDescriptionOpening],
                    ] as const
                  ).map(([label, ok]) => (
                    <span key={label} className="row" style={{ gap: 6 }}>
                      <CheckIcon status={ok ? "pass" : "fail"} /> {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <details className="card">
              <summary>All {report.checks.length} checks</summary>
              <ul className="check-list" style={{ marginTop: 8 }}>
                {report.checks.map((c) => (
                  <li key={c.id} className="check-item">
                    <CheckIcon status={c.status} />
                    <div>
                      <strong>{c.label}</strong>
                      <div className="fix">{c.detail}</div>
                    </div>
                    <span className="small muted num">
                      {c.points}/{c.maxPoints}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

function BulkAudit({ onOpen }: { onOpen: () => void }) {
  const { data, update } = useStore();
  const [opts, setOpts] = useState({ freeShipping: false, attributesComplete: false, isDigital: data.profile.model === "digital" });
  const [error, setError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const byTitle = useMemo(
    () => new Map(csvText ? parseCsvRecords(csvText).map((r) => [r.TITLE ?? "", r] as const) : []),
    [csvText],
  );
  const audit = data.audit;

  const run = (text: string, o = opts) => {
    try {
      const res = auditListingsCsv(text, o);
      const saved: SavedAudit = {
        listings: res.listings,
        averageScore: res.averageScore,
        gradeCounts: res.gradeCounts,
        commonIssues: res.commonIssues,
        rows: res.rows.map((r) => ({
          title: r.title,
          score: r.report.score,
          grade: r.report.grade,
          topIssue: r.report.priorities[0]?.label ?? "—",
          tagCount: r.tagCount,
          photoCount: r.photoCount,
          price: r.price,
        })),
      };
      update({ audit: saved });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    run(text);
  };

  const setOpt = (k: keyof typeof opts, v: boolean) => {
    const next = { ...opts, [k]: v };
    setOpts(next);
    if (csvText) run(csvText, next);
  };

  return (
    <div className="stack">
      <div className="card stack">
        <div>
          <h2>Audit every listing at once</h2>
          <p className="sub" style={{ marginTop: 4 }}>
            In Shop Manager go to <strong>Settings → Options → Download Data</strong> and download <strong>Currently for sale listings</strong>. The CSV is read in your browser; nothing is uploaded.
          </p>
        </div>
        <div className="row" style={{ gap: 16 }}>
          <label className="btn btn-primary">
            Choose listings CSV
            <input type="file" accept=".csv,text/csv" className="visually-hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.freeShipping} onChange={(e) => setOpt("freeShipping", e.target.checked)} /> Shop offers free shipping
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.attributesComplete} onChange={(e) => setOpt("attributesComplete", e.target.checked)} /> Attributes filled in
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.isDigital} onChange={(e) => setOpt("isDigital", e.target.checked)} /> Digital downloads
          </label>
        </div>
        {error && (
          <p className="small delta-bad" role="alert">
            {error}
          </p>
        )}
        {audit && !csvText && <p className="tiny muted">Showing your last audit. Choose the CSV again to refresh it.</p>}
      </div>

      {!audit ? (
        <Empty title="No audit yet">The export doesn't include videos, shipping or attributes, so set those with the checkboxes above.</Empty>
      ) : (
        <>
          <div className="grid grid-4">
            <div className="card tile">
              <span className="tile-label">Listings audited</span>
              <span className="tile-value">{audit.listings}</span>
            </div>
            <div className="card tile">
              <span className="tile-label">Average SEO score</span>
              <span className="tile-value">{audit.averageScore}</span>
            </div>
            <div className="card tile">
              <span className="tile-label">Search-ready (A/B)</span>
              <span className="tile-value">{audit.gradeCounts.A + audit.gradeCounts.B}</span>
            </div>
            <div className="card tile">
              <span className="tile-label">Need work (D/F)</span>
              <span className="tile-value">{audit.gradeCounts.D + audit.gradeCounts.F}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Most common issues</h2>
              <p>Fix one issue across many listings for the biggest shop-wide lift</p>
            </div>
            <BarList
              max={audit.listings}
              items={audit.commonIssues.slice(0, 8).map((i) => ({
                key: i.id,
                label: i.label,
                value: i.count,
                display: `${i.count} of ${audit.listings}`,
                hint: i.fix,
              }))}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Listings, lowest score first</h2>
              <p>Click a listing to open it in the analyser</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">Score</th>
                    <th>Title</th>
                    <th>Top issue</th>
                    <th className="num">Tags</th>
                    <th className="num">Photos</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.rows.slice(0, 200).map((r, i) => (
                    <tr
                      key={i}
                      className={csvText ? "clickable" : ""}
                      onClick={() => {
                        const rec = byTitle.get(r.title);
                        if (!rec) return;
                        update({
                          draft: {
                            ...EMPTY_DRAFT,
                            title: r.title,
                            tags: (rec.TAGS ?? "").split(",").map((t) => t.trim()).filter(Boolean),
                            description: rec.DESCRIPTION ?? "",
                            photoCount: r.photoCount,
                            freeShipping: opts.freeShipping,
                            attributesComplete: opts.attributesComplete,
                            isDigital: opts.isDigital,
                          },
                        });
                        onOpen();
                      }}
                    >
                      <td className="num">
                        <strong>{r.score}</strong> <span className="muted tiny">{r.grade}</span>
                      </td>
                      <td>
                        <div className="truncate" title={r.title}>
                          {r.title}
                        </div>
                      </td>
                      <td className="small">{r.topIssue}</td>
                      <td className="num">{r.tagCount}</td>
                      <td className="num">{r.photoCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
