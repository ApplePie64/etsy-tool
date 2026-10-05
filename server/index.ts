import Anthropic from "@anthropic-ai/sdk";
import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeComparison } from "../src/lib/compare/analyze";
import { validatePlan } from "../src/lib/compare/guard";
import type { RawPlan } from "../src/lib/compare/plan";
import { sanitizeListings } from "../src/lib/compare/validate";
import { ADVISOR_MODEL, aiConfigured, sanitizeChat, streamAdvisorReply } from "./advisor";
import { generateAiPlan, PlanError, streamCompareChat } from "./compare";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file — fine, the advisor falls back to offline mode.
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// A CLI flag rather than NODE_ENV=... so `npm start` also works in Windows shells.
const isProd = process.env.NODE_ENV === "production" || process.argv.includes("--production");
const port = Number(process.env.PORT) || 8787;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// Small per-IP limit so a publicly deployed instance can't run up the API bill.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 40;
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: aiConfigured(), model: aiConfigured() ? ADVISOR_MODEL : null });
});

/** Shared preconditions for AI routes; sends the error response and returns false if not met. */
function aiReady(req: Request, res: Response): boolean {
  if (!aiConfigured()) {
    res.status(503).json({ error: "not_configured", message: "Set ANTHROPIC_API_KEY to enable AI features." });
    return false;
  }
  if (rateLimited(req.ip ?? "unknown")) {
    res.status(429).json({ error: "rate_limited", message: "Too many requests in a short time. Try again in a few minutes." });
    return false;
  }
  return true;
}

function aiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof PlanError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The AI service is busy (rate limited). Try again in a minute.";
  if (err instanceof Anthropic.APIError) return `AI service error (${err.status ?? "network"}). Try again shortly.`;
  return fallback;
}

/** Runs `stream` as a server-sent-events response: text chunks, an optional notice, then done or error. */
async function sse(
  res: Response,
  label: string,
  stream: (onText: (text: string) => void, signal: AbortSignal) => Promise<"done" | "refusal" | "truncated">,
) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  res.on("close", () => abort.abort());
  try {
    const outcome = await stream((text) => send({ type: "text", text }), abort.signal);
    if (outcome === "refusal") send({ type: "notice", message: "That one couldn't be answered. Try rephrasing the question." });
    else if (outcome === "truncated") send({ type: "notice", message: "The answer was cut off. Ask me to continue." });
    send({ type: "done" });
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error(`[${label}]`, err);
    send({ type: "error", message: aiErrorMessage(err, "The AI is unavailable right now.") });
  } finally {
    res.end();
  }
}

app.post("/api/advisor", async (req: Request, res: Response) => {
  if (!aiReady(req, res)) return;
  const chat = sanitizeChat(req.body);
  if (!chat) {
    res.status(400).json({ error: "bad_request", message: "Expected { messages: [...], context } ending with a user message." });
    return;
  }
  await sse(res, "advisor", async (onText, signal) => (await streamAdvisorReply(chat, { onText, signal })).kind);
});

app.post("/api/compare/plan", async (req: Request, res: Response) => {
  if (!aiReady(req, res)) return;
  const parsed = sanitizeListings((req.body as { listings?: unknown } | undefined)?.listings);
  if ("error" in parsed) {
    res.status(400).json({ error: "bad_request", message: parsed.error });
    return;
  }
  const abort = new AbortController();
  res.on("close", () => abort.abort());
  try {
    res.json({ plan: await generateAiPlan(parsed.listings, abort.signal) });
  } catch (err) {
    if (abort.signal.aborted) return;
    console.error("[compare/plan]", err);
    res.status(502).json({ error: "ai_failed", message: aiErrorMessage(err, "The AI couldn't write a plan right now.") });
  }
});

app.post("/api/compare/chat", async (req: Request, res: Response) => {
  if (!aiReady(req, res)) return;
  const body = (req.body ?? {}) as { listings?: unknown; plan?: unknown };
  const parsed = sanitizeListings(body.listings);
  const chat = sanitizeChat(req.body);
  if ("error" in parsed || !chat) {
    res.status(400).json({ error: "bad_request", message: "error" in parsed ? parsed.error : "Expected messages ending with a user message." });
    return;
  }
  // The plan is only context for follow-up questions; re-validate it against this comparison.
  const plan = isPlanLike(body.plan)
    ? validatePlan(body.plan, analyzeComparison(parsed.listings), { source: body.plan.source === "ai" ? "ai" : "rules", model: null })
    : null;
  await sse(res, "compare/chat", (onText, signal) => streamCompareChat(parsed.listings, plan, chat.messages, { onText, signal }));
});

function isPlanLike(v: unknown): v is RawPlan & { source?: string } {
  return !!v && typeof v === "object" && Array.isArray((v as RawPlan).suggestions) && typeof (v as RawPlan).summary === "string";
}

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

if (isProd) {
  const dist = path.join(root, "dist");
  if (!fs.existsSync(path.join(dist, "index.html"))) {
    console.error("No build found. Run `npm run build` first.");
    process.exit(1);
  }
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.use((_req, res) => res.sendFile(path.join(dist, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`SellerScope running at http://localhost:${port}`);
  console.log(aiConfigured() ? `AI advisor: on (${ADVISOR_MODEL})` : "AI advisor: offline mode (set ANTHROPIC_API_KEY to enable Claude)");
});
