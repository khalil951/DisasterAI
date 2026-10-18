import path from "node:path";

/** Server-side settings. The browser never sees them and cannot choose a target (no open proxy). Read at call time so tests can change the environment. */
export interface Config {
  n8nUrl: string;
  replayUrl: string;
  ragUrl: string;
  ollamaUrl: string;
  repoRoot: string;
  timeoutMs: number;
}

export function getConfig(): Config {
  const env = process.env;
  return {
    n8nUrl: env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/incident",
    replayUrl: env.REPLAY_WEBHOOK_URL || "http://localhost:5690/webhook/incident?delay=3",
    ragUrl: (env.RAG_URL || "http://localhost:8010").replace(/\/$/, ""),
    ollamaUrl: (env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, ""),
    repoRoot: path.resolve(process.cwd(), env.REPO_ROOT || ".."),
    timeoutMs: Number(env.RUN_TIMEOUT_MS) > 0 ? Number(env.RUN_TIMEOUT_MS) : 600_000,
  };
}

/** The base address of n8n, from the webhook address (for /healthz). */
export const n8nBase = (webhookUrl: string): string => webhookUrl.split("/webhook")[0] ?? webhookUrl;
