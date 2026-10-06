import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ListingEditor } from "../components/compare/ListingEditor";
import { ComparisonTable, CoverageTable, EvidenceList, FindingsList, GuidanceLinks, PriceSummary } from "../components/compare/Results";
import { TrackSection } from "../components/compare/Tracking";
import { Empty, Markdown } from "../components/ui";
import { parseCsvRecords, parseMoney } from "../lib/csv";
import { analyzeComparison } from "../lib/compare/analyze";
import { validatePlan } from "../lib/compare/guard";
import { localCompareAnswer } from "../lib/compare/localChat";
import { rulesPlan, type Plan } from "../lib/compare/plan";
import { reportHtml, reportMarkdown, type Feedback } from "../lib/compare/report";
import { SAMPLE_NOTICE, sampleComparison } from "../lib/compare/sample";
import { localToday, trackingStage } from "../lib/compare/tracking";
import { ATTRIBUTE_LABELS, detectCategory, type AttributeKey } from "../lib/compare/attributes";
import { CATEGORY_LABELS, MAX_COMPETITORS, RECOMMENDED_COMPETITORS, type Category, type CompareListing } from "../lib/compare/types";
import { aiAvailable, ApiError, postJson, streamText } from "../lib/sse";
import type { WeekStats } from "../lib/stats/metrics";
import { useStore, type ChatTurn, type SavedComparison } from "../store";

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function blankListing(id: string, role: CompareListing["role"]): CompareListing {
  return {
    id,
    role,
    label: role === "mine" ? "Your listing" : `Listing ${id.slice(1)}`,
    url: null,
    title: "",
    tags: null,
    description: null,
    price: null,
    currency: null,
    photoCount: null,
    hasVideo: null,
    reviewCount: null,
    notes: null,
    source: "manual",
    capturedAt: today(),
  };
}

const EMPTY_FEEDBACK: Feedback = { changedDecision: null, wouldReuse: null, note: "" };

function newComparison(name: string, listings: CompareListing[]): SavedComparison {
  const now = new Date().toISOString();
  return { id: uid(), name, category: "digital", createdAt: now, updatedAt: now, listingsUpdatedAt: now, listings, plan: null, chat: [], feedback: EMPTY_FEEDBACK };
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "comparison";

export function Compare() {
  const { data, update } = useStore();
  const [ai, setAi] = useState<{ ai: boolean; model: string | null } | null>(null);
  useEffect(() => {
    void aiAvailable().then(setAi);
  }, []);

  const active = data.comparisons.find((c) => c.id === data.activeComparison) ?? null;

  const create = (c: SavedComparison) => update((d) => ({ comparisons: [c, ...d.comparisons], activeComparison: c.id }));
  const startBlank = () => create(newComparison(`Comparison ${data.comparisons.length + 1}`, [blankListing("mine", "mine"), blankListing("c1", "competitor"), blankListing("c2", "competitor"), blankListing("c3", "competitor")]));
  const startSample = () => create(newComparison("Sample: budget planner printables", sampleComparison()));
  const due = data.comparisons.flatMap((c) => (c.changes ?? []).filter((t) => trackingStage(t, localToday()) === "due").map((t) => ({ c, t })));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Compare Listings</h1>
          <p>
            Put your listing next to 3–5 listings you want to study. See how prices, customer-facing details and title/tag phrases differ, then get an improvement plan where every suggestion
            points at the listing text it's based on.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={startBlank}>
            New comparison
          </button>
          <button className="btn" onClick={startSample}>
            Load sample (fictional)
          </button>
        </div>
      </div>

      {data.comparisons.length > 0 && (
        <div className="card row" style={{ padding: "10px 14px" }}>
          <label className="row small" style={{ gap: 6, flex: 1, minWidth: 220 }}>
            <span style={{ fontWeight: 600 }}>Saved analyses</span>
            <select value={active?.id ?? ""} onChange={(e) => update({ activeComparison: e.target.value || null })} style={{ flex: 1, minWidth: 0 }}>
              {!active && <option value="">Choose…</option>}
              {data.comparisons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.updatedAt.slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
          <span className="tiny muted">{data.comparisons.length} saved in this browser · changes save automatically</span>
        </div>
      )}

      {due.length > 0 && (
        <div className="callout small row" role="status">
          <span style={{ flex: 1, minWidth: 200 }}>
            <strong>Results ready to check:</strong> {due.map(({ c, t }) => `${c.name} (changed ${t.changedOn})`).join(", ")}. Enter the listing's Etsy Stats in "Did it work?".
          </span>
          {due[0]!.c.id !== active?.id && (
            <button className="btn btn-sm" onClick={() => update({ activeComparison: due[0]!.c.id })}>
              Open
            </button>
          )}
        </div>
      )}

      {active ? (
        <Workspace key={active.id} comparison={active} ai={ai} />
      ) : (
        <Empty
          title="Start a comparison"
          action={
            <>
              <button className="btn btn-primary" onClick={startBlank}>
                New comparison
              </button>
              <button className="btn" onClick={startSample}>
                Load sample (fictional)
              </button>
            </>
          }
        >
          Works for physical products and digital downloads. Open a listing on Etsy, press Ctrl+A then Ctrl+C, and paste it into a Quick fill box — the details fill in for you.
        </Empty>
      )}
    </div>
  );
}

function Workspace({ comparison: c, ai }: { comparison: SavedComparison; ai: { ai: boolean; model: string | null } | null }) {
  const { data, update } = useStore();
  const patch = (p: Partial<SavedComparison>) =>
    update((d) => ({ comparisons: d.comparisons.map((x) => (x.id === c.id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x)) }));
  const setListings = (listings: CompareListing[]) => patch({ listings, listingsUpdatedAt: new Date().toISOString() });
  const editListing = (id: string, p: Partial<CompareListing>) => setListings(c.listings.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const ready = c.listings.filter((l) => l.title.trim());
  const analysis = useMemo(() => {
    const ls = c.listings.filter((l) => l.title.trim());
    return ls.some((l) => l.role === "mine") && ls.some((l) => l.role === "competitor") ? analyzeComparison(ls, c.categoryChoice) : null;
  }, [c.listings, c.categoryChoice]);
  const detected = useMemo(() => detectCategory(c.listings.filter((l) => l.title.trim())), [c.listings]);
  const addDetail = (listingId: string, key: AttributeKey, value: string) => {
    const l = c.listings.find((x) => x.id === listingId);
    if (!l) return;
    const line = `${ATTRIBUTE_LABELS[key]}: ${value}`;
    editListing(listingId, { notes: l.notes ? `${l.notes.trimEnd()}\n${line}` : line });
  };
  // Open the input sections only if the comparison starts empty; never collapse them while typing.
  const [inputsOpen] = useState(() => !analysis);
  const competitors = c.listings.filter((l) => l.role === "competitor");
  const mine = c.listings.find((l) => l.role === "mine")!;
  const hasSample = c.listings.some((l) => l.source === "sample");
  // The rules plan is free and instant, so it's always live; a Claude plan is kept until the seller resets it.
  const rulesLive = useMemo(() => (analysis ? validatePlan(rulesPlan(analysis), analysis, { source: "rules", model: null }) : null), [analysis]);
  const aiPlan = c.plan?.source === "ai" ? c.plan : null;
  const shownPlan = aiPlan ?? rulesLive;
  const planStale = !!aiPlan && aiPlan.generatedAt < c.listingsUpdatedAt;

  const addCompetitor = () => {
    const used = new Set(competitors.map((l) => l.id));
    const id = [1, 2, 3, 4, 5].map((n) => `c${n}`).find((x) => !used.has(x));
    if (id) setListings([...c.listings, blankListing(id, "competitor")]);
  };

  // Bumped on imports so the editor re-reads fields it keeps as local text.
  const [mineVersion, setMineVersion] = useState(0);
  const [csvRows, setCsvRows] = useState<Record<string, string>[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const applyCsvRow = (r: Record<string, string>) => {
    const tags = (r.TAGS ?? "").split(",").map((t) => t.trim()).filter(Boolean);
    const price = parseMoney(r.PRICE);
    editListing("mine", {
      title: r.TITLE ?? "",
      tags: tags.length ? tags : null,
      description: r.DESCRIPTION?.trim() ? r.DESCRIPTION : null,
      price: Number.isNaN(price) ? null : price,
      currency: /^[A-Z]{3}$/.test(r.CURRENCY_CODE ?? "") ? r.CURRENCY_CODE! : null,
      photoCount: Object.keys(r).filter((k) => /^IMAGE\d+$/.test(k) && r[k]).length,
      source: "csv",
      capturedAt: today(),
    });
    setMineVersion((v) => v + 1);
    setCsvRows(null);
  };

  return (
    <>
      <div className="card stack-sm">
        <div className="row">
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            <span className="visually-hidden">Analysis name</span>
            <input type="text" value={c.name} onChange={(e) => patch({ name: e.target.value })} style={{ fontWeight: 600, fontSize: "1rem" }} />
          </label>
          <label className="row small" style={{ gap: 6 }}>
            <span className="muted">Product type</span>
            <select value={c.categoryChoice ?? "auto"} onChange={(e) => patch({ categoryChoice: e.target.value === "auto" ? undefined : (e.target.value as Category) })}>
              <option value="auto">Auto ({CATEGORY_LABELS[detected].toLowerCase()})</option>
              <option value="physical">{CATEGORY_LABELS.physical}</option>
              <option value="digital">{CATEGORY_LABELS.digital}</option>
            </select>
          </label>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (confirm(`Delete "${c.name}"?`)) update((d) => ({ comparisons: d.comparisons.filter((x) => x.id !== c.id), activeComparison: null }));
            }}
          >
            Delete
          </button>
        </div>
        {hasSample && <p className="callout small">{SAMPLE_NOTICE}</p>}
        <p className="tiny muted">
          Data comes from what you enter (or your own listings CSV). Live Etsy listing import needs approved Etsy API access, which this app doesn't have yet. Blank fields stay "unknown".
        </p>
      </div>

      <details className="card" open={inputsOpen}>
        <summary>
          <strong>1. Your listing</strong> <span className="muted small">{mine.title || "not entered yet"}</span>
        </summary>
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <div className="row small">
            <label className="btn btn-sm">
              Import from listings CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="visually-hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const rows = parseCsvRecords(await f.text()).filter((r) => r.TITLE);
                  if (!rows.length) setCsvError("No listings found — use Etsy's \"Currently for sale listings\" CSV.");
                  else if (rows.length === 1) applyCsvRow(rows[0]!);
                  else {
                    setCsvRows(rows);
                    setCsvError(null);
                  }
                }}
              />
            </label>
            {data.draft.title.trim() && (
              <button
                className="btn btn-sm"
                onClick={() => {
                  editListing("mine", {
                    title: data.draft.title,
                    tags: data.draft.tags.length ? data.draft.tags : null,
                    description: data.draft.description.trim() ? data.draft.description : null,
                    photoCount: data.draft.photoCount,
                    hasVideo: data.draft.hasVideo,
                    source: "manual",
                    capturedAt: today(),
                  });
                  setMineVersion((v) => v + 1);
                }}
              >
                Use the listing in SEO Lab
              </button>
            )}
          </div>
          {csvError && <p className="small delta-bad">{csvError}</p>}
          {csvRows && (
            <label className="field">
              <span>Which listing?</span>
              <select defaultValue="" onChange={(e) => e.target.value !== "" && applyCsvRow(csvRows[Number(e.target.value)]!)}>
                <option value="">Choose one of {csvRows.length} listings…</option>
                {csvRows.map((r, i) => (
                  <option key={i} value={i}>
                    {r.TITLE}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ListingEditor key={`mine-${mineVersion}`} listing={mine} onChange={(p) => editListing("mine", p)} />
        </div>
      </details>

      <details className="card" open={inputsOpen}>
        <summary>
          <strong>2. Listings to compare</strong>{" "}
          <span className="muted small">
            {competitors.filter((l) => l.title.trim()).length} entered · {RECOMMENDED_COMPETITORS}–{MAX_COMPETITORS} recommended
          </span>
        </summary>
        <div className="stack" style={{ marginTop: 12 }}>
          {competitors.map((l) => (
            <div key={l.id} className="subcard">
              <ListingEditor
                listing={l}
                onChange={(p) => editListing(l.id, p)}
                onRemove={competitors.length > 1 ? () => setListings(c.listings.filter((x) => x.id !== l.id)) : undefined}
              />
            </div>
          ))}
          {competitors.length < MAX_COMPETITORS && (
            <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={addCompetitor}>
              + Add listing
            </button>
          )}
        </div>
      </details>

      {!analysis ? (
        <Empty title="Enter your listing and at least one comparison listing">A title is enough to start; add descriptions, prices and photo counts for a fuller comparison.</Empty>
      ) : (
        <>
          {analysis.warnings.length > 0 && (
            <div className="callout small">
              {analysis.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
          <div className="card">
            <div className="card-head">
              <h2>3. Side by side</h2>
              <p>Hover a detail to see the text it was found in</p>
            </div>
            <ComparisonTable a={analysis} onAddDetail={addDetail} />
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Price & photos</h2>
              <p>Prices are compared only within the same currency</p>
            </div>
            <PriceSummary a={analysis} />
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Title & tag phrases</h2>
              <p>Where each shared phrase appears</p>
            </div>
            <CoverageTable a={analysis} />
          </div>
          <details className="card">
            <summary>
              <strong>Findings ({analysis.findings.length})</strong> <span className="muted small">objective checks, each with the listing text behind it</span>
            </summary>
            <div style={{ marginTop: 12 }}>
              <FindingsList a={analysis} />
            </div>
          </details>

          <PlanSection plan={shownPlan} hasAiPlan={!!aiPlan} analysis={analysis} ai={ai} stale={planStale} onPlan={(plan) => patch({ plan })} />
          <ChatSection comparison={c} plan={shownPlan} analysis={analysis} ai={ai} onChat={(chat) => patch({ chat })} />
          <TrackSection
            changes={c.changes ?? []}
            mine={mine}
            analysis={analysis}
            plan={shownPlan}
            weeks={data.weeks}
            onChanges={(changes) => patch({ changes })}
            onEditMine={(p) => {
              editListing("mine", p);
              setMineVersion((v) => v + 1);
            }}
          />
          <ReportSection comparison={c} plan={shownPlan} analysis={analysis} weeks={data.weeks} onFeedback={(feedback) => patch({ feedback })} />
          <p className="tiny muted">{ready.length} listings in this analysis · created {c.createdAt.slice(0, 10)}</p>
        </>
      )}
    </>
  );
}

function PlanSection({
  plan,
  hasAiPlan,
  analysis,
  ai,
  stale,
  onPlan,
}: {
  plan: Plan | null;
  hasAiPlan: boolean;
  analysis: ReturnType<typeof analyzeComparison>;
  ai: { ai: boolean; model: string | null } | null;
  stale: boolean;
  onPlan: (p: Plan | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const askClaude = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const { plan } = await postJson<{ plan: Plan }>("/api/compare/plan", { listings: analysis.listings, category: analysis.category });
      onPlan(plan);
    } catch (e) {
      setNotice(`Claude couldn't write a plan (${e instanceof ApiError ? e.message : "network error"}). The rules-based plan below still applies.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>4. Improvement plan</h2>
          <p>
            {hasAiPlan
              ? "Written by Claude, then checked by the rules engine."
              : "Updates automatically as you edit — free, no AI needed."}{" "}
            Suggested wording only uses facts from your own listing.
          </p>
        </div>
        {ai?.ai && (
          <div className="row">
            {hasAiPlan && (
              <button className="btn btn-sm btn-ghost" onClick={() => onPlan(null)} disabled={busy}>
                Back to automatic plan
              </button>
            )}
            <button className="btn btn-primary" onClick={askClaude} disabled={busy}>
              {busy ? "Working…" : hasAiPlan ? "Rewrite with Claude" : "Write with Claude"}
            </button>
          </div>
        )}
      </div>
      {notice && <p className="callout small">{notice}</p>}
      {stale && <p className="callout small">The listings changed after Claude wrote this plan. Rewrite it, or go back to the automatic plan.</p>}
      {plan && (
        <>
          <div className="row small">
            <span className="badge">{plan.source === "ai" ? `AI · ${plan.model ?? "Claude"}` : "Rules engine"}</span>
            <span className="tiny muted">{new Date(plan.generatedAt).toLocaleString()}</span>
          </div>
          <p>{plan.summary}</p>
          <div className="stack-sm">
            {plan.suggestions.map((s, i) => (
              <article key={s.id} className="finding">
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge badge-accent">{i + 1}</span>
                  <span className={`badge prio-${s.priority}`}>{s.priority} priority</span>
                  <span className="badge">{s.area}</span>
                </div>
                <h4>{s.action}</h4>
                <p className="small" style={{ color: "var(--ink-2)" }}>
                  {s.why}
                </p>
                {s.needsSellerInput && <p className="small ask">Before you change anything: {s.needsSellerInput}</p>}
                {s.proposedText && (
                  <div className="proposed">
                    <pre>{s.proposedText}</pre>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        void navigator.clipboard?.writeText(s.proposedText!).then(() => {
                          setCopied(s.id);
                          setTimeout(() => setCopied(null), 1500);
                        });
                      }}
                    >
                      {copied === s.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
                <EvidenceList a={analysis} evidence={s.evidence} />
                <GuidanceLinks ids={s.guidance} />
                {s.notes.map((n) => (
                  <p key={n} className="tiny muted">
                    Safety check: {n}
                  </p>
                ))}
              </article>
            ))}
          </div>
          {plan.missingInfo.length > 0 && (
            <div className="callout small">
              <strong>Would make this comparison more reliable:</strong>
              <ul className="plain" style={{ color: "var(--ink)" }}>
                {plan.missingInfo.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {plan.rejected.length > 0 && (
            <details>
              <summary>Removed by safety checks ({plan.rejected.length})</summary>
              <ul className="plain">
                {plan.rejected.map((r, i) => (
                  <li key={i}>
                    {r.action} — {r.reasons.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

const CHAT_SUGGESTIONS = ["What should I change first?", "How does my price compare?", "What do the others state that I don't?", "Which phrases am I missing?"];

function ChatSection({
  comparison: c,
  plan,
  analysis,
  ai,
  onChat,
}: {
  comparison: SavedComparison;
  plan: Plan | null;
  analysis: ReturnType<typeof analyzeComparison>;
  ai: { ai: boolean; model: string | null } | null;
  onChat: (chat: ChatTurn[]) => void;
}) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    const history: ChatTurn[] = [...c.chat, { role: "user", content: question }];
    onChat(history);
    if (!ai?.ai) {
      onChat([...history, { role: "assistant", content: localCompareAnswer(question, analysis, plan) }]);
      return;
    }
    setBusy(true);
    setPending("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let text = "";
    try {
      const { notice } = await streamText(
        "/api/compare/chat",
        { listings: analysis.listings, category: analysis.category, plan, messages: history },
        (t) => {
          text += t;
          setPending(text);
        },
        ctrl.signal,
      );
      onChat([...history, { role: "assistant", content: notice ? `${text}\n\n_${notice}_` : text || "_No answer received._" }]);
    } catch (e) {
      if (!ctrl.signal.aborted) {
        onChat([...history, { role: "assistant", content: `_The AI is unavailable (${(e as Error).message}). Offline answer:_\n\n${localCompareAnswer(question, analysis, plan)}` }]);
      } else if (text) onChat([...history, { role: "assistant", content: `${text}\n\n_(stopped)_` }]);
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="card stack">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <div>
          <h2>5. Ask about this comparison</h2>
          <p>Answers use only these listings. Instructions hidden in listing text are ignored.</p>
        </div>
        {c.chat.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={() => onChat([])} disabled={busy}>
            Clear
          </button>
        )}
      </div>
      {(c.chat.length > 0 || pending !== null) && (
        <div className="chat" style={{ minHeight: 0 }} aria-live="polite">
          {c.chat.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg msg-user">
                {m.content}
              </div>
            ) : (
              <div key={i} className="msg msg-assistant">
                <Markdown text={m.content} />
              </div>
            ),
          )}
          {pending !== null && <div className="msg msg-assistant">{pending ? <Markdown text={pending} /> : <span className="typing muted small">Thinking</span>}</div>}
        </div>
      )}
      <div className="chips">
        {CHAT_SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => void ask(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label className="visually-hidden" htmlFor="compare-input">
          Question about this comparison
        </label>
        <textarea
          id="compare-input"
          rows={1}
          value={input}
          placeholder="e.g. What does Sample B include that mine doesn't?"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(input);
            }
          }}
        />
        {busy ? (
          <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
            Stop
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
            Ask
          </button>
        )}
      </form>
    </div>
  );
}

function ReportSection({
  comparison: c,
  plan,
  analysis,
  weeks,
  onFeedback,
}: {
  comparison: SavedComparison;
  plan: Plan | null;
  analysis: ReturnType<typeof analyzeComparison>;
  weeks: WeekStats[];
  onFeedback: (f: Feedback) => void;
}) {
  const input = { name: c.name, createdAt: c.createdAt, analysis, plan, feedback: c.feedback, changes: c.changes ?? [], weeks };
  const fb = c.feedback;
  const radio = <K extends "changedDecision" | "wouldReuse">(k: K, v: NonNullable<Feedback[K]>, label: string) => (
    <label className="check" key={`${k}-${v}`}>
      <input type="radio" name={`${c.id}-${k}`} checked={fb[k] === v} onChange={() => onFeedback({ ...fb, [k]: v })} /> {label}
    </label>
  );
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div className="card stack-sm">
        <h2>7. Download the report</h2>
        <p className="sub">Everything above — listings, evidence, plan, and what the safety checks removed — with the date. Open the HTML file and print it to save a PDF.</p>
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={() => download(`${slug(c.name)}.html`, reportHtml(input), "text/html")}>
            Download HTML
          </button>
          <button className="btn btn-sm" onClick={() => download(`${slug(c.name)}.md`, reportMarkdown(input), "text/markdown")}>
            Download Markdown
          </button>
        </div>
      </div>
      <div className="card stack-sm">
        <h2>Was this useful?</h2>
        <p className="sub">Saved with this analysis and included in the report.</p>
        <span className="small" style={{ fontWeight: 600 }}>
          Did it change what you'll do with your listing?
        </span>
        <div className="row">
          {radio("changedDecision", "yes", "Yes")}
          {radio("changedDecision", "no", "No")}
          {radio("changedDecision", "unsure", "Not sure")}
        </div>
        <span className="small" style={{ fontWeight: 600 }}>
          Would you use it again on another listing?
        </span>
        <div className="row">
          {radio("wouldReuse", "yes", "Yes")}
          {radio("wouldReuse", "no", "No")}
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={fb.note} onChange={(e) => onFeedback({ ...fb, note: e.target.value })} placeholder="What did you change? What was missing?" />
        </label>
      </div>
    </div>
  );
}
