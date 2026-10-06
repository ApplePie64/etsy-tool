import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Markdown } from "../components/ui";
import { buildAdvisorContext } from "../lib/advisor/context";
import { localAnswer } from "../lib/advisor/localAdvisor";
import { aiAvailable, ApiError, streamText } from "../lib/sse";
import { useStore, type ChatTurn } from "../store";

const SUGGESTIONS = [
  "Give me an overview of my shop",
  "Why did my traffic change this week?",
  "What should I do this week?",
  "How do I compare with other kinds of Etsy sellers?",
  "How do I get more visits from Etsy search?",
  "Are my Etsy Ads worth it?",
  "How should I price my best seller?",
];

type Mode = "checking" | "ai" | "offline";

export function Advisor() {
  const { data, update, advisorState, go } = useStore();
  const [mode, setMode] = useState<Mode>("checking");
  const [model, setModel] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const context = useMemo(() => buildAdvisorContext(advisorState), [advisorState]);
  const chat = data.chat;

  useEffect(() => {
    let alive = true;
    void aiAvailable().then((h) => {
      if (!alive) return;
      setMode(h.ai ? "ai" : "offline");
      setModel(h.model);
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chat.length, pending]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    const history: ChatTurn[] = [...chat, { role: "user", content: question }];
    update({ chat: history });

    if (mode !== "ai") {
      update({ chat: [...history, { role: "assistant", content: localAnswer(question, advisorState) }] });
      return;
    }

    setBusy(true);
    setPending("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let text = "";
    try {
      const { notice } = await streamText(
        "/api/advisor",
        { messages: history, context },
        (t) => {
          text += t;
          setPending(text);
        },
        ctrl.signal,
      );
      const content = notice ? `${text}${text ? "\n\n" : ""}_${notice}_` : text;
      update({ chat: [...history, { role: "assistant", content: content || "_No answer received._" }] });
    } catch (e) {
      if (ctrl.signal.aborted) {
        if (text) update({ chat: [...history, { role: "assistant", content: `${text}\n\n_(stopped)_` }] });
      } else {
        if (e instanceof ApiError && e.code === "not_configured") setMode("offline");
        // Fall back to the offline advisor so the seller still gets an answer.
        const fallback = localAnswer(question, advisorState);
        update({
          chat: [...history, { role: "assistant", content: `${text ? text + "\n\n" : ""}_The AI advisor is unavailable (${(e as Error).message}). Here's the offline answer:_\n\n${fallback}` }],
        });
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
      setPending(null);
      abortRef.current = null;
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Advisor</h1>
          <p>Talk through your shop — traffic, conversion, SEO, pricing, ads, and how you compare with other kinds of sellers. Answers use the data you've entered in the other tabs.</p>
        </div>
        <span className="badge" title={mode === "ai" ? `Powered by ${model}` : "Rule-based answers from this app's diagnostics"}>
          {mode === "checking" ? "Connecting…" : mode === "ai" ? "● Claude AI" : "● Built-in rules"}
        </span>
      </div>

      <div className="split split-main-aside">
        <div className="card stack">
          <div className="chat" aria-live="polite">
            {chat.length === 0 && pending === null && (
              <div className="msg msg-assistant">
                <Markdown
                  text={`Hi! I'm your Etsy growth advisor. I can see your seller profile${data.weeks.length ? `, ${data.weeks.length} week(s) of stats` : ""}${data.audit ? ", your listing audit" : ""}${advisorState.lastListing ? " and the listing in the SEO Lab" : ""}.\n\nAsk me anything, or pick a question below.${mode === "offline" ? "\n\n_AI is off, so answers come from this app's built-in rules — free and private._" : ""}`}
                />
              </div>
            )}
            {chat.map((m, i) =>
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
            {pending !== null && (
              <div className="msg msg-assistant">
                {pending ? <Markdown text={pending} /> : <span className="typing muted small">Thinking</span>}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => void ask(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>

          <form className="composer" onSubmit={onSubmit}>
            <label className="visually-hidden" htmlFor="advisor-input">
              Your question
            </label>
            <textarea
              id="advisor-input"
              rows={1}
              value={input}
              placeholder="Ask about your traffic, listings, pricing…"
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
                Send
              </button>
            )}
          </form>
          {error && <p className="tiny muted">Last error: {error}</p>}
        </div>

        <aside className="stack">
          <div className="card stack-sm">
            <h3>Better answers need data</h3>
            <p className="small sub">The advisor reads what you've entered:</p>
            <button className="btn btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => go("sellers")}>
              {data.profileSet ? "✓" : "○"} Seller type & stage
            </button>
            <button className="btn btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => go("stats")}>
              {data.weeks.length ? "✓" : "○"} Weekly stats
            </button>
            <button className="btn btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => go("seo")}>
              {data.audit || advisorState.lastListing ? "✓" : "○"} Listing SEO
            </button>
          </div>
          <details className="card">
            <summary>What the advisor sees</summary>
            <p className="tiny muted" style={{ margin: "8px 0" }}>
              Only these aggregates are sent{mode === "ai" ? " to Claude" : ""} — never buyer names or addresses.
            </p>
            <pre className="context">{context}</pre>
          </details>
          {chat.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={() => update({ chat: [] })} disabled={busy}>
              Clear conversation
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
