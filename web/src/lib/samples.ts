/** Ready-made examples: the six fixed incidents and the test images that carry a short report text (port of ui/samples.py). Server only.
 *  The browser only ever sends an example id; it never names a file. */
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./config";
import type { Sample } from "./types";

const FEATURED: Record<string, string> = {
  fire_01: "Wildfire near a village",
  flood_01: "Flooded square (French report)",
  structural_01: "Collapsed apartment building",
  edge_02_conflict: "Report and photo disagree",
  edge_01_vague: "Vague report",
  edge_03_injection: "Hidden instruction in the report",
};

const MORE: Record<string, string> = {
  fire_02: "Smoke column near a farm",
  fire_03: "Smoke over open fields",
  fire_04_house: "House on fire",
  fire_05_training: "Burning building, firefighters",
  edge_04_blurred_water: "Blurred night photo",
  flood_03_satellite: "Satellite view of a flood",
  structural_02: "Earthquake-damaged brick building",
  control_01_night: "Quiet night street (no incident)",
};

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

interface Internal extends Sample {
  imagePath: string | null;
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadAll(root: string): Promise<Internal[]> {
  const images = path.join(root, "vision", "test_images");
  const out: Internal[] = [];
  let names: string[] = [];
  try {
    names = (await fs.readdir(path.join(root, "eval", "incidents"))).filter((n) => n.endsWith(".json")).sort();
  } catch {
    /* none */
  }
  const usedImages = new Set<string>();
  for (const n of names) {
    const d = await readJson<{ id: string; text: string; output_language?: string; image?: string; designed_to_test?: string }>(path.join(root, "eval", "incidents", n));
    if (!d?.id || !d.text) continue;
    const imagePath = d.image && (await exists(path.join(images, d.image))) ? path.join(images, d.image) : null;
    if (d.image) usedImages.add(d.image);
    out.push({
      id: d.id,
      label: FEATURED[d.id] ?? MORE[d.id] ?? d.id.replace(/_/g, " "),
      text: d.text,
      language: d.output_language === "fr" ? "fr" : "en",
      hasImage: Boolean(imagePath),
      featured: d.id in FEATURED,
      note: d.designed_to_test ?? "",
      imagePath,
    });
  }
  const truth = (await readJson<Record<string, { report_text?: string; comment?: string }>>(path.join(images, "GROUND_TRUTH.json"))) ?? {};
  for (const [file, t] of Object.entries(truth)) {
    if (!file.endsWith(".jpg") || usedImages.has(file) || !t.report_text) continue;
    const imagePath = path.join(images, file);
    if (!(await exists(imagePath))) continue;
    const id = file.replace(/\.jpg$/, "");
    out.push({ id, label: MORE[id] ?? id.replace(/_/g, " "), text: t.report_text, language: "en", hasImage: true, featured: false, note: t.comment ?? "", imagePath });
  }
  const order = Object.keys(FEATURED);
  return out.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99) || a.id.localeCompare(b.id));
}

export async function listSamples(root = getConfig().repoRoot): Promise<Sample[]> {
  return (await loadAll(root)).map(({ imagePath: _unused, ...s }) => s);
}

/** The text and the photo of one example, by id. */
export async function getSample(id: string, root = getConfig().repoRoot): Promise<{ sample: Sample; image: { bytes: Buffer; name: string; type: string } | null } | null> {
  const s = (await loadAll(root)).find((x) => x.id === id);
  if (!s) return null;
  const { imagePath, ...sample } = s;
  if (!imagePath) return { sample, image: null };
  const ext = path.extname(imagePath).toLowerCase();
  return { sample, image: { bytes: await fs.readFile(imagePath), name: path.basename(imagePath), type: MIME[ext] ?? "application/octet-stream" } };
}
