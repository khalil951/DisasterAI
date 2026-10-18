/** What the workflow depends on, checked in parallel (port of ui/client.py check_services). Server only. */
import fs from "node:fs/promises";
import { n8nBase, type Config } from "./config";
import type { HealthRow, HealthState } from "./types";

async function get(url: string, timeoutMs = 2000): Promise<{ status: number; json: unknown } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* not JSON */
    }
    return { status: res.status, json };
  } catch {
    return null;
  }
}

interface Chain {
  key?: boolean;
  cooling_seconds?: number;
}

const chainState = (chain: Chain[] | undefined): { state: HealthState; detail: string } => {
  const list = chain ?? [];
  const ready = list.filter((m) => (m.key ?? true) && !m.cooling_seconds);
  const state: HealthState = ready.length ? "ok" : list.length ? "warn" : "down";
  return { state, detail: `${ready.length} of ${list.length} ready${ready.length ? "" : " (cooling down or no key)"}` };
};

export async function checkServices(cfg: Config, webhookUrl: string): Promise<HealthRow[]> {
  const [n8n, rag, llm, ollama] = await Promise.all([
    get(`${n8nBase(webhookUrl)}/healthz`),
    get(`${cfg.ragUrl}/health`),
    get(`${cfg.ragUrl}/llm/status`),
    get(`${cfg.ollamaUrl}/api/tags`),
  ]);
  const rows: HealthRow[] = [];
  rows.push({ key: "n8n", name: "Workflow engine (n8n)", state: n8n?.status === 200 ? "ok" : "down", detail: n8n?.status === 200 ? "answers" : "no answer" });
  rows.push({ key: "rag", name: "Knowledge and checks service", state: rag?.status === 200 ? "ok" : "down", detail: rag?.status === 200 ? "ready" : "no answer" });
  const status = llm?.status === 200 ? (llm.json as { chain?: Chain[]; vision_chain?: Chain[] }) : null;
  if (status) {
    const t = chainState(status.chain);
    const v = chainState(status.vision_chain);
    rows.push({ key: "text", name: "Text models", state: t.state, detail: t.detail });
    rows.push({ key: "vision", name: "Vision models", state: v.state, detail: v.detail });
  } else {
    rows.push({ key: "models", name: "Models", state: "down", detail: "unknown: the service did not answer" });
  }
  const models = ((ollama?.json as { models?: { name?: string }[] } | null)?.models ?? []).map((m) => m.name).filter(Boolean) as string[];
  rows.push({
    key: "ollama",
    name: "Local vision model",
    state: models.length ? "ok" : ollama?.status === 200 ? "warn" : "down",
    detail: models.length ? models.join(", ") : ollama?.status === 200 ? "running, no model pulled" : "not running (photos use cloud models)",
  });
  try {
    const s = await fs.statfs(cfg.repoRoot);
    const free = (Number(s.bavail) * Number(s.bsize)) / 1e9;
    rows.push({ key: "disk", name: "Disk space", state: free > 5 ? "ok" : free > 1 ? "warn" : "down", detail: `${free.toFixed(1)} GB free` });
  } catch {
    /* not available on this platform */
  }
  return rows;
}

/** One word for the header: ready, limited or down. The workflow engine and the service are required; the rest only limits. */
export function overall(rows: HealthRow[]): HealthState {
  const need = rows.filter((r) => r.key === "n8n" || r.key === "rag");
  if (need.some((r) => r.state === "down")) return "down";
  return rows.some((r) => r.state !== "ok") ? "warn" : "ok";
}
