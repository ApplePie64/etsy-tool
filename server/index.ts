import Anthropic from "@anthropic-ai/sdk";
import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADVISOR_MODEL, aiConfigured, sanitizeChat, streamAdvisorReply } from "./advisor";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file — fine, the advisor falls back to offline mode.
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isProd = process.env.NODE_ENV === "production";
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

app.post("/api/advisor", async (req: Request, res: Response) => {
  if (!aiConfigured()) {
    res.status(503).json({ error: "not_configured", message: "Set ANTHROPIC_API_KEY to enable the AI advisor." });
    return;
  }
  if (rateLimited(req.ip ?? "unknown")) {
    res.status(429).json({ error: "rate_limited", message: "Too many questions in a short time. Try again in a few minutes." });
    return;
  }
  const chat = sanitizeChat(req.body);
  if (!chat) {
    res.status(400).json({ error: "bad_request", message: "Expected { messages: [...], context } ending with a user message." });
    return;
  }

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
    const outcome = await streamAdvisorReply(chat, { onText: (text) => send({ type: "text", text }), signal: abort.signal });
    if (outcome.kind === "refusal") {
      send({ type: "notice", message: "The advisor couldn't answer that one. Try rephrasing the question." });
    } else if (outcome.kind === "truncated") {
      send({ type: "notice", message: "The answer was cut off. Ask me to continue." });
    }
    send({ type: "done" });
  } catch (err) {
    if (abort.signal.aborted) return;
    let message = "The advisor is unavailable right now.";
    if (err instanceof Anthropic.AuthenticationError) message = "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
    else if (err instanceof Anthropic.RateLimitError) message = "The AI service is busy (rate limited). Try again in a minute.";
    else if (err instanceof Anthropic.APIError) message = `AI service error (${err.status ?? "network"}). Try again shortly.`;
    console.error("[advisor]", err);
    send({ type: "error", message });
  } finally {
    res.end();
  }
});

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
