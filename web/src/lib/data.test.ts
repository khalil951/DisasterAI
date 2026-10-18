import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENTRY_ID, getEntry, parseEntries } from "./entries";
import { getRun, isRunId, listRuns, runImage, saveRun } from "./history";
import { getSample, listSamples } from "./samples";
import type { RunResult } from "./types";

const REPO = path.resolve(process.cwd(), "..");
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "disasterai-web-"));
});
afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const result = (extra: Partial<RunResult> = {}): RunResult => ({ kind: "ok", seconds: 12.34, message: "", hint: "", problems: [], httpStatus: 200, body: { status: "ok", severity: "high", incident_type: "flood" }, ...extra });

describe("entries", () => {
  it("parses headings, body and source like the Streamlit console", () => {
    const md = "# Title\n\nintro\n\n## FL-04 Never walk through floodwater\n\nTurn around.\n\nSource: Red Cross, page 1.\nOrigin of the sources: US. Audience: public.\nTeam note, not from the sources: x\n\n## not an entry\n\nignored";
    const [e] = parseEntries(md, "en");
    expect(e).toMatchObject({ id: "FL-04", title: "Never walk through floodwater", text: "Turn around.", source: "Red Cross, page 1.", language: "en" });
    expect(parseEntries(md, "en")).toHaveLength(1);
  });
  it("reads the real corpus: English and French entries", async () => {
    expect((await getEntry("FI-09", REPO))?.text).toBeTruthy();
    expect((await getEntry("FL-27", REPO))?.language).toBe("fr");
    expect(await getEntry("XX-99", REPO)).toBeNull();
  });
  it("only accepts entry ids, never paths", async () => {
    expect(ENTRY_ID.test("FI-09")).toBe(true);
    expect(await getEntry("../../.env", REPO)).toBeNull();
  });
});

describe("history", () => {
  it("saves a run in the console's format, lists it and reads it back", async () => {
    const id = await saveRun({ result: result(), url: "n8n webhook", profile: "Next.js demo", mock: false, text: "A flood", language: "en", sampleId: "flood_01", image: { bytes: new Uint8Array([1, 2, 3]), name: "p.png", type: "image/png" }, dir: tmp });
    expect(isRunId(id)).toBe(true);
    const record = await getRun(id, tmp);
    expect(record).toMatchObject({ sample_id: "flood_01", kind: "ok", seconds: 12.3, mock: false, language: "en", http_status: 200 });
    expect(record?.image_file).toMatch(/\.png$/);
    expect((await runImage(id, tmp))?.bytes.length).toBe(3);
    const [s] = await listRuns(10, tmp);
    expect(s).toMatchObject({ id, severity: "high", incident_type: "flood", has_image: true, mock: false });
  });
  it("lists newest first and respects the limit", async () => {
    await saveRun({ result: result({ kind: "degraded" }), url: "u", profile: "p", mock: true, text: "second", language: "fr", dir: tmp });
    const runs = await listRuns(1, tmp);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.mock).toBe(true);
  });
  it("refuses ids that are paths", async () => {
    expect(await getRun("../secret", tmp)).toBeNull();
    expect(await runImage("..%2f..%2fetc", tmp)).toBeNull();
  });
  it("returns nothing for a missing folder", async () => expect(await listRuns(10, path.join(tmp, "nope"))).toEqual([]));
});

describe("samples", () => {
  it("lists the fixed incidents first, with their photos", async () => {
    const samples = await listSamples(REPO);
    expect(samples.slice(0, 3).map((s) => s.id)).toEqual(["fire_01", "flood_01", "structural_01"]);
    expect(samples.find((s) => s.id === "fire_01")).toMatchObject({ featured: true, hasImage: true, language: "en" });
    expect(samples.find((s) => s.id === "flood_01")?.language).toBe("fr");
    expect(samples.find((s) => s.id === "edge_01_vague")?.hasImage).toBe(false);
  });
  it("adds the extra test images with their invented report text", async () => {
    const more = (await listSamples(REPO)).filter((s) => !s.featured);
    expect(more.length).toBeGreaterThanOrEqual(8);
    expect(more.every((s) => s.text.length > 10)).toBe(true);
  });
  it("returns the image bytes of one example, and null for unknown ids", async () => {
    const s = await getSample("fire_01", REPO);
    expect(s?.image?.type).toBe("image/jpeg");
    expect(s?.image?.bytes.length).toBeGreaterThan(1000);
    expect(await getSample("../../etc/passwd", REPO)).toBeNull();
  });
});
