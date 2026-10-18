/** Calls the n8n webhook. Server only. Every way a call can fail becomes an error `kind` and a plain-language hint (port of ui/client.py post_incident). */
import { Agent } from "undici";
import { HINTS, checkInput, classifyBody } from "./client";
import type { RunBody, RunKind, RunResult } from "./types";

// n8n answers once, when the whole run ends. Node's fetch gives up after 5 minutes without headers by default; a slow run on free tiers can take longer.
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0, connectTimeout: 10_000 });

export interface PostArgs {
  url: string;
  text: string;
  language: "en" | "fr";
  image?: { bytes: Uint8Array; name: string; type: string } | null;
  timeoutMs: number;
  signal?: AbortSignal;
}

const result = (kind: RunKind, seconds: number, extra: Partial<RunResult> = {}): RunResult => ({
  kind,
  seconds,
  message: "",
  hint: HINTS[kind] ?? "",
  problems: [],
  ...extra,
});

export async function postIncident(a: PostArgs): Promise<RunResult> {
  const problems = checkInput(a.text, a.image ? { size: a.image.bytes.byteLength, type: a.image.type } : null);
  if (problems.length) {
    return result("bad_request", 0, { message: problems.join(" "), hint: "Fix the input and try again.", problems });
  }
  const form = new FormData();
  form.append("incident_text", a.text);
  form.append("output_language", a.language);
  // the image part needs its own Content-Type, otherwise n8n delivers it as text and the Vision step is skipped
  if (a.image) form.append("image", new File([a.image.bytes as BlobPart], a.image.name, { type: a.image.type }), a.image.name);

  const started = Date.now();
  const elapsed = () => (Date.now() - started) / 1000;
  const signals = [AbortSignal.timeout(a.timeoutMs), ...(a.signal ? [a.signal] : [])];
  let res: Response;
  try {
    res = await fetch(a.url, { method: "POST", body: form, signal: AbortSignal.any(signals), cache: "no-store", dispatcher } as RequestInit);
  } catch (e) {
    if (a.signal?.aborted) return result("cancelled", elapsed(), { message: "Cancelled." });
    const name = (e as { name?: string }).name;
    if (name === "TimeoutError" || name === "AbortError") return result("timeout", elapsed(), { message: `No answer after ${Math.round(a.timeoutMs / 1000)} s.` });
    return result("unreachable", elapsed(), { message: "Could not connect to the workflow." });
  }
  const seconds = elapsed();
  let text: string;
  try {
    text = await res.text();
  } catch {
    return result("timeout", elapsed(), { httpStatus: res.status, message: "The answer was cut off." });
  }
  if (res.status === 404) return result("not_listening", seconds, { httpStatus: 404, message: "HTTP 404 from n8n." });
  if (res.status >= 500) return result("server_error", seconds, { httpStatus: res.status, message: `HTTP ${res.status}. ${text.slice(0, 200)}` });
  if (!text.trim()) return result("empty", seconds, { httpStatus: res.status, message: "Empty answer." });
  let body: RunBody;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed as RunBody;
  } catch {
    return result("not_json", seconds, { httpStatus: res.status, message: text.slice(0, 200) });
  }
  if (res.status >= 400 && body.status !== "rejected") {
    const msg = (body as { message?: string }).message;
    return result("bad_request", seconds, { httpStatus: res.status, body, message: String(body.error ?? msg ?? text.slice(0, 200)) });
  }
  const kind = classifyBody(body);
  return result(kind, seconds, { httpStatus: res.status, body, hint: "", message: kind === "rejected" ? String(body.error ?? "") : "" });
}
