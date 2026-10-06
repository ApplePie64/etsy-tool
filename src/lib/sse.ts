/** Error from an API route, with the server's error code (e.g. "not_configured"). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
  return new ApiError(body?.message ?? `Request failed (${res.status})`, body?.error, res.status);
}

/** POSTs JSON and parses a JSON reply, throwing ApiError on failure. */
export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

/**
 * POSTs JSON to a server-sent-events route and calls onText for each text
 * chunk. Resolves with an optional notice (refusal / cut-off) when done.
 */
export async function streamText(url: string, body: unknown, onText: (t: string) => void, signal: AbortSignal): Promise<{ notice?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) throw await errorFrom(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let notice: string | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const evt = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string };
      if (evt.type === "text" && evt.text) onText(evt.text);
      else if (evt.type === "notice") notice = evt.message;
      else if (evt.type === "error") throw new ApiError(evt.message ?? "AI error");
    }
  }
  return { notice };
}

/** Whether the server has an AI key configured. False when there's no server (static hosting). */
export async function aiAvailable(): Promise<{ ai: boolean; model: string | null }> {
  // Static hosting (GitHub Pages) has no server to ask.
  if (import.meta.env.VITE_STATIC === "1") return { ai: false, model: null };
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return { ai: false, model: null };
    const h = (await r.json()) as { ai?: boolean; model?: string | null };
    return { ai: !!h.ai, model: h.model ?? null };
  } catch {
    return { ai: false, model: null };
  }
}
