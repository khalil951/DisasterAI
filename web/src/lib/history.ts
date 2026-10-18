/** Saved runs, server only: one JSON file per run in eval/results/ui_runs/ with the photo next to it.
 *  Same file format as the Streamlit console (ui/history.py), so each UI can reopen the other's runs. */
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config";
import type { RunRecord, RunResult, RunSummary } from "./types";

export const runsDir = (): string => path.join(getConfig().repoRoot, "eval", "results", "ui_runs");

const ID = /^\d{8}-\d{6}-\d{3}_[a-z0-9_]{1,30}$/;
export const isRunId = (id: string): boolean => ID.test(id);

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
function stamp(d = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`;
}

const MIME_BY_EXT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const EXT_BY_MIME: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

export interface SaveArgs {
  result: RunResult;
  url: string;
  profile: string;
  mock: boolean;
  text: string;
  language: string;
  image?: { bytes: Uint8Array; name: string; type: string } | null;
  sampleId?: string | null;
  dir?: string;
}

/** Writes the run and returns its id (the file name without .json). */
export async function saveRun(a: SaveArgs): Promise<string> {
  const dir = a.dir ?? runsDir();
  await fs.mkdir(dir, { recursive: true });
  const s = stamp();
  const slug = (a.sampleId || "free_text").toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 30) || "free_text";
  let imageFile: string | null = null;
  if (a.image) {
    imageFile = `${s}_${slug}${EXT_BY_MIME[a.image.type] ?? path.extname(a.image.name) ?? ".img"}`;
    await fs.writeFile(path.join(dir, imageFile), a.image.bytes);
  }
  const record: RunRecord = {
    saved_at: s,
    sample_id: a.sampleId ?? null,
    url: a.url,
    profile: a.profile,
    mock: a.mock,
    language: a.language,
    text: a.text,
    image_file: imageFile,
    kind: a.result.kind,
    seconds: Math.round(a.result.seconds * 10) / 10,
    http_status: a.result.httpStatus ?? null,
    message: a.result.message,
    response: a.result.body ?? null,
  };
  const id = `${s}_${slug}`;
  await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(record, null, 1), "utf-8");
  return id;
}

const summarise = (id: string, r: RunRecord): RunSummary => ({
  id,
  saved_at: r.saved_at,
  sample_id: r.sample_id ?? null,
  kind: r.kind,
  severity: r.response?.severity ?? null,
  incident_type: r.response?.incident_type ?? null,
  seconds: r.seconds,
  mock: Boolean(r.mock),
  language: r.language,
  text: r.text,
  has_image: Boolean(r.image_file),
});

/** Newest first. Files that cannot be read are skipped. */
export async function listRuns(limit = 10, dir = runsDir()): Promise<RunSummary[]> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const ids = names.filter((n) => n.endsWith(".json") && isRunId(n.slice(0, -5))).map((n) => n.slice(0, -5)).sort().reverse().slice(0, limit);
  const out: RunSummary[] = [];
  for (const id of ids) {
    try {
      out.push(summarise(id, JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), "utf-8")) as RunRecord));
    } catch {
      /* skip a broken file */
    }
  }
  return out;
}

export async function getRun(id: string, dir = runsDir()): Promise<RunRecord | null> {
  if (!isRunId(id)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), "utf-8")) as RunRecord;
  } catch {
    return null;
  }
}

export async function runImage(id: string, dir = runsDir()): Promise<{ bytes: Buffer; type: string } | null> {
  const record = await getRun(id, dir);
  const name = record?.image_file;
  if (!name || name !== path.basename(name)) return null;
  try {
    return { bytes: await fs.readFile(path.join(dir, name)), type: MIME_BY_EXT[path.extname(name).toLowerCase()] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
