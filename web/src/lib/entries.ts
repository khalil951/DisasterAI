/** The passage behind a recommendation: entries read from rag/corpus/<lang>/*_kb.md (port of ui/render.py load_entries). Server only. */
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config";

export interface Entry {
  id: string;
  title: string;
  text: string;
  source: string;
  language: string;
}

const cache = new Map<string, Map<string, Entry>>();
export const ENTRY_ID = /^[A-Z]{2}-\d{1,3}$/;

export function parseEntries(markdown: string, language: string): Entry[] {
  const out: Entry[] = [];
  for (const block of markdown.replace(/\r\n/g, "\n").split(/^## /m).slice(1)) {
    const nl = block.indexOf("\n");
    const head = nl < 0 ? block : block.slice(0, nl);
    const m = /^([A-Z]{2}-\d+) (.*)$/.exec(head.trim());
    if (!m) continue;
    const lines = (nl < 0 ? "" : block.slice(nl + 1)).split("\n").map((l) => l.trim()).filter(Boolean);
    const body = lines.filter((l) => !/^(Source:|Origin of the sources:|Team note)/.test(l));
    const source = lines.find((l) => l.startsWith("Source:"))?.replace(/^Source:\s*/, "") ?? "";
    out.push({ id: m[1] as string, title: (m[2] as string).trim(), text: body.join("\n\n"), source, language });
  }
  return out;
}

export async function loadEntries(repoRoot = getConfig().repoRoot): Promise<Map<string, Entry>> {
  const hit = cache.get(repoRoot);
  if (hit) return hit;
  const map = new Map<string, Entry>();
  const base = path.join(repoRoot, "rag", "corpus");
  let langs: string[] = [];
  try {
    langs = (await fs.readdir(base, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch {
    /* no corpus here */
  }
  for (const lang of langs) {
    let files: string[] = [];
    try {
      files = (await fs.readdir(path.join(base, lang))).filter((f) => f.endsWith("_kb.md")).sort();
    } catch {
      continue;
    }
    for (const f of files) {
      const md = await fs.readFile(path.join(base, lang, f), "utf-8");
      for (const e of parseEntries(md, lang)) map.set(e.id, e);
    }
  }
  cache.set(repoRoot, map);
  return map;
}

export async function getEntry(id: string, repoRoot?: string): Promise<Entry | null> {
  if (!ENTRY_ID.test(id)) return null;
  return (await loadEntries(repoRoot)).get(id) ?? null;
}
