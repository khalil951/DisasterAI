import fs from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { GET as getEntry } from "./entries/[id]/route";
import { GET as getHealth } from "./health/route";
import { GET as getRuns } from "./runs/route";
import { GET as getRun } from "./runs/[id]/route";
import { POST as postRun } from "./run/route";
import { GET as getSamples } from "./samples/route";
import { GET as getSampleImage } from "./samples/[id]/image/route";
import type { RunResult } from "@/lib/types";

const OK_BODY = {
  status: "ok",
  incident_type: "forest_fire",
  severity: "high",
  report_markdown: "# r",
  knowledge_coverage: "partial",
  report: { severity: "high", image_status: "analysed" },
  validation: { status: "pass", violations: [], repaired: false },
  degraded_steps: [],
  models_used: [],
};

let server: http.Server;
let base: string;
let tmp: string;
const seen: { path: string; body: string; headers: http.IncomingHttpHeaders }[] = [];

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "disasterai-api-"));
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const url = req.url ?? "";
      seen.push({ path: url, body: Buffer.concat(chunks).toString("latin1"), headers: req.headers });
      const send = (code: number, body: string, type = "application/json") => {
        res.writeHead(code, { "Content-Type": type });
        res.end(body);
      };
      if (url === "/healthz") return send(200, '{"status":"ok"}');
      if (url === "/health") return send(200, '{"status":"ok"}');
      if (url === "/llm/status") return send(200, JSON.stringify({ chain: [{ key: true, cooling_seconds: 0 }, { key: true, cooling_seconds: 60 }], vision_chain: [{ key: true, cooling_seconds: 0 }] }));
      if (url === "/api/tags") return send(200, '{"models":[{"name":"qwen3-vl:4b-instruct"}]}');
      if (url.startsWith("/slow")) return void setTimeout(() => send(200, JSON.stringify(OK_BODY)), 2500);
      if (url.startsWith("/degraded")) return send(200, JSON.stringify({ ...OK_BODY, status: "degraded", degraded_steps: [{ step: "vision", reason: "failed" }] }));
      if (url.startsWith("/flagged")) return send(200, JSON.stringify({ ...OK_BODY, status: "flagged", validation: { status: "fail", violations: [{ check: "scope", message: "m" }] } }));
      if (url.startsWith("/rejected")) return send(200, JSON.stringify({ status: "rejected", error: "incident_text is missing or too short" }));
      if (url.startsWith("/notjson")) return send(200, "<html>oops</html>", "text/html");
      if (url.startsWith("/empty")) return send(200, "");
      if (url.startsWith("/500")) return send(500, "boom");
      if (url.startsWith("/404")) return send(404, '{"message":"not registered"}');
      if (url.startsWith("/400")) return send(400, '{"message":"bad"}');
      return send(200, JSON.stringify(OK_BODY));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.REPO_ROOT = tmp; // saved runs go to a temp folder, not into the repository
  process.env.RUN_TIMEOUT_MS = "1000";
  process.env.RAG_URL = base;
  process.env.OLLAMA_URL = base;
});

afterAll(async () => {
  server.close();
  await fs.rm(tmp, { recursive: true, force: true });
});

afterEach(() => {
  seen.length = 0;
});

function runForm(fields: Record<string, string>, image?: File): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (image) form.append("image", image);
  return new Request("http://localhost/api/run", { method: "POST", body: form });
}

async function run(pathname: string, fields: Record<string, string> = { text: "Smoke is rising from the hills behind the village.", language: "en" }, image?: File) {
  process.env.N8N_WEBHOOK_URL = `${base}${pathname}`;
  const res = await postRun(runForm(fields, image));
  return (await res.json()) as { result: RunResult; runId: string | null; demo: boolean };
}

describe("POST /api/run", () => {
  it("returns an ok result and saves the run", async () => {
    const out = await run("/ok");
    expect(out.result.kind).toBe("ok");
    expect(out.result.body?.severity).toBe("high");
    expect(out.runId).toMatch(/^\d{8}-\d{6}-\d{3}_free_text$/);
    const saved = await (await getRun(new Request("http://localhost"), { params: Promise.resolve({ id: out.runId as string }) })).json();
    expect(saved.record).toMatchObject({ kind: "ok", mock: false, language: "en" });
  });

  it.each([
    ["/degraded", "degraded"],
    ["/flagged", "flagged"],
    ["/rejected", "rejected"],
  ])("maps the workflow status of %s to %s", async (p, kind) => {
    expect((await run(p)).result.kind).toBe(kind);
  });

  it.each([
    ["/notjson", "not_json"],
    ["/empty", "empty"],
    ["/500", "server_error"],
    ["/404", "not_listening"],
    ["/400", "bad_request"],
  ])("turns %s into the error kind %s with a hint", async (p, kind) => {
    const { result } = await run(p);
    expect(result.kind).toBe(kind);
    expect(result.hint.length).toBeGreaterThan(10);
  });

  it("reports a timeout", async () => expect((await run("/slow")).result.kind).toBe("timeout"));

  it("reports an unreachable workflow", async () => {
    process.env.N8N_WEBHOOK_URL = "http://127.0.0.1:1/webhook/incident";
    const { result } = (await (await postRun(runForm({ text: "A fire near the village", language: "en" }))).json()) as { result: RunResult };
    expect(result.kind).toBe("unreachable");
    expect(result.hint).toContain("docker compose");
  });

  it("checks the input before sending anything, and does not save a run", async () => {
    const out = await run("/ok", { text: " ", language: "en" });
    expect(out.result.kind).toBe("bad_request");
    expect(out.result.problems).toHaveLength(1);
    expect(out.runId).toBeNull();
    expect(seen.filter((s) => s.path.startsWith("/ok"))).toHaveLength(0);
  });

  it("forwards the photo with its own content type and the language", async () => {
    await run("/ok", { text: "Flooding on the main road.", language: "fr" }, new File([new Uint8Array([137, 80, 78, 71])], "p.png", { type: "image/png" }));
    const call = seen.find((s) => s.path.startsWith("/ok"));
    expect(call?.headers["content-type"]).toContain("multipart/form-data");
    expect(call?.body).toMatch(/name="image"; filename="p\.png"\r\nContent-Type: image\/png/);
    expect(call?.body).toMatch(/name="output_language"\r\n\r\nfr/);
    expect(call?.body).toMatch(/name="incident_text"\r\n\r\nFlooding on the main road\./);
  });

  it("ignores any target the browser names", async () => {
    await run("/ok", { text: "A fire near the village", language: "en", url: "http://evil.example/steal", target: "http://evil.example" });
    expect(seen.some((s) => s.path.startsWith("/ok"))).toBe(true);
  });

  it("demo mode goes to the replay webhook and is saved as demo data", async () => {
    process.env.N8N_WEBHOOK_URL = `${base}/500`;
    process.env.REPLAY_WEBHOOK_URL = `${base}/degraded`;
    const out = (await (await postRun(runForm({ text: "A fire near the village", language: "en", demo: "true" }))).json()) as { result: RunResult; runId: string; demo: boolean };
    expect(out.demo).toBe(true);
    expect(out.result.kind).toBe("degraded");
    const rec = await (await getRun(new Request("http://localhost"), { params: Promise.resolve({ id: out.runId }) })).json();
    expect(rec.record.mock).toBe(true);
    expect(rec.record.profile).toContain("demo data");
  });

  it("refuses a body that is not a form", async () => {
    const res = await postRun(new Request("http://localhost/api/run", { method: "POST", body: "plain" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/health", () => {
  it("reports each dependency and an overall word", async () => {
    process.env.N8N_WEBHOOK_URL = `${base}/webhook/incident`;
    const body = (await (await getHealth(new Request("http://localhost/api/health"))).json()) as { rows: { key: string; state: string; detail: string }[]; overall: string };
    const byKey = Object.fromEntries(body.rows.map((r) => [r.key, r]));
    expect(byKey.n8n?.state).toBe("ok");
    expect(byKey.rag?.state).toBe("ok");
    expect(byKey.text?.detail).toBe("1 of 2 ready");
    expect(byKey.ollama?.detail).toContain("qwen3-vl");
    expect(body.overall).toBe("ok");
  });
  it("says down when the workflow engine does not answer", async () => {
    process.env.N8N_WEBHOOK_URL = "http://127.0.0.1:1/webhook/incident";
    const body = (await (await getHealth(new Request("http://localhost/api/health"))).json()) as { overall: string };
    expect(body.overall).toBe("down");
  });
});

describe("read-only routes", () => {
  it("lists saved runs newest first", async () => {
    const { runs } = (await (await getRuns(new Request("http://localhost/api/runs?limit=3"))).json()) as { runs: { id: string }[] };
    expect(runs.length).toBeGreaterThan(0);
    expect([...runs].map((r) => r.id).sort().reverse()).toEqual(runs.map((r) => r.id));
  });
  it("returns 404 for an unknown or malicious run id", async () => {
    for (const id of ["nope", "..%2F..%2Fsecret"]) {
      const res = await getRun(new Request("http://localhost"), { params: Promise.resolve({ id }) });
      expect(res.status).toBe(404);
    }
  });
  it("serves entries by id only", async () => {
    process.env.REPO_ROOT = path.resolve(process.cwd(), "..");
    const ok = await getEntry(new Request("http://localhost"), { params: Promise.resolve({ id: "FI-09" }) });
    expect(ok.status).toBe(200);
    const bad = await getEntry(new Request("http://localhost"), { params: Promise.resolve({ id: "../../.env" }) });
    expect(bad.status).toBe(404);
  });
  it("lists samples and serves a sample photo", async () => {
    const { samples } = (await (await getSamples()).json()) as { samples: { id: string }[] };
    expect(samples.map((s) => s.id)).toContain("fire_01");
    const img = await getSampleImage(new Request("http://localhost"), { params: Promise.resolve({ id: "fire_01" }) });
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/jpeg");
    expect((await getSampleImage(new Request("http://localhost"), { params: Promise.resolve({ id: "../x" }) })).status).toBe(404);
    expect((await getSampleImage(new Request("http://localhost"), { params: Promise.resolve({ id: "edge_01_vague" }) })).status).toBe(404);
  });
});
