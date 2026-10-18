"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { median } from "@/lib/estimate";
import type { HealthRow, HealthState, RunRecord, RunResult, RunSummary, Sample } from "@/lib/types";
import { Footer, Header } from "./Header";
import { HistoryDrawer } from "./HistoryDrawer";
import { type FormState, IncidentForm } from "./IncidentForm";
import { ResultView } from "./ResultView";
import { ErrorCard, RunProgress } from "./RunStates";

const EMPTY: FormState = { text: "", language: "en", file: null, sampleId: null, sampleImage: false };
const OK_KINDS = ["ok", "degraded", "flagged"];

interface Shown {
  result: RunResult;
  demo: boolean;
  imageSrc: string | null;
  sentImage: boolean;
}

export function App() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [health, setHealth] = useState<{ rows: HealthRow[]; overall: HealthState } | null>(null);
  const [demo, setDemo] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);
  const [drawer, setDrawer] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const results = useRef<HTMLDivElement>(null);

  const refreshRuns = useCallback(async () => {
    try {
      const r = await fetch("/api/runs?limit=10");
      setRuns(((await r.json()) as { runs: RunSummary[] }).runs);
    } catch {
      /* history is optional */
    }
  }, []);

  useEffect(() => {
    fetch("/api/samples")
      .then((r) => r.json())
      .then((d: { samples: Sample[] }) => setSamples(d.samples))
      .catch(() => setSamples([]));
    void Promise.resolve().then(() => {
      void refreshRuns();
      try {
        if (localStorage.getItem("disasterai-demo") === "1") setDemo(true);
      } catch {
        /* storage may be blocked */
      }
    });
  }, [refreshRuns]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/health${demo ? "?demo=true" : ""}`);
        const d = (await r.json()) as { rows: HealthRow[]; overall: HealthState };
        if (live) setHealth(d);
      } catch {
        if (live) setHealth({ rows: [], overall: "down" });
      }
    };
    void load();
    const t = setInterval(load, 30000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [demo]);

  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 250);
    return () => clearInterval(t);
  }, [running]);

  function changeDemo(v: boolean) {
    setDemo(v);
    setHealth(null);
    try {
      localStorage.setItem("disasterai-demo", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  async function submit(forceDemo = false) {
    const useDemo = demo || forceDemo;
    if (forceDemo) changeDemo(true);
    const data = new FormData();
    data.set("text", form.text);
    data.set("language", form.language);
    data.set("demo", String(useDemo));
    if (form.file) data.set("image", form.file);
    else if (form.sampleImage && form.sampleId) data.set("sampleImage", "true");
    if (form.sampleId) data.set("sampleId", form.sampleId);
    const imageSrc = form.file ? URL.createObjectURL(form.file) : form.sampleImage && form.sampleId ? `/api/samples/${form.sampleId}/image` : null;
    const ctl = new AbortController();
    abort.current = ctl;
    setShown(null);
    setElapsed(0);
    setRunning(true);
    try {
      const res = await fetch("/api/run", { method: "POST", body: data, signal: ctl.signal });
      const out = (await res.json()) as { result: RunResult; demo: boolean };
      setShown({ result: out.result, demo: out.demo, imageSrc, sentImage: Boolean(imageSrc) });
    } catch (e) {
      if (ctl.signal.aborted) {
        setShown(null);
      } else {
        const problem: RunResult = { kind: "unreachable", seconds: 0, message: e instanceof Error ? e.message : "The request failed.", hint: "The web app itself did not answer. Check that `npm run dev` is still running.", problems: [] };
        setShown({ result: problem, demo: useDemo, imageSrc, sentImage: Boolean(imageSrc) });
      }
    } finally {
      setRunning(false);
      abort.current = null;
      void refreshRuns();
      setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  async function openRun(id: string) {
    setDrawer(false);
    try {
      const r = await fetch(`/api/runs/${encodeURIComponent(id)}`);
      const { record } = (await r.json()) as { record: RunRecord };
      const result: RunResult = {
        kind: record.kind,
        seconds: record.seconds,
        httpStatus: record.http_status ?? undefined,
        body: record.response ?? undefined,
        message: record.message,
        hint: "",
        problems: [],
      };
      const imageSrc = record.image_file ? `/api/runs/${encodeURIComponent(id)}/image` : null;
      setForm({ ...EMPTY, text: record.text, language: record.language === "fr" ? "fr" : "en" });
      setShown({ result, demo: record.mock, imageSrc, sentImage: Boolean(imageSrc) });
      setTimeout(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      /* leave the screen as it is */
    }
  }

  const typical = median(runs.filter((r) => !r.mock && OK_KINDS.includes(r.kind)).map((r) => r.seconds));
  const hasImage = Boolean(form.file || (form.sampleImage && form.sampleId));
  const body = shown?.result.body;
  const success = shown && OK_KINDS.includes(shown.result.kind) && body;

  return (
    <>
      <Header rows={health?.rows ?? []} state={health?.overall ?? null} loading={health === null} demo={demo} onDemo={changeDemo} onHistory={() => setDrawer(true)} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {!shown && !running && (
          <div className="no-print max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Assess an incident</h1>
            <p className="mt-2 text-muted">Describe what was reported, add a photo if you have one, and get a clear assessment with recommended actions and the sources behind them.</p>
          </div>
        )}
        <div className="no-print">
          <IncidentForm value={form} onChange={setForm} samples={samples} running={running} onSubmit={() => void submit()} />
        </div>
        <div ref={results} className="scroll-mt-20 space-y-6">
          {running && <RunProgress elapsed={elapsed} hasImage={hasImage} typical={typical} onCancel={() => abort.current?.abort()} />}
          {shown && !running && (success && body ? (
            <ResultView body={body} seconds={shown.result.seconds} demo={shown.demo} imageSrc={shown.imageSrc} sentImage={shown.sentImage} onNew={() => { setShown(null); setForm(EMPTY); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          ) : (
            <ErrorCard result={shown.result} demo={demo} onDemo={() => void submit(true)} onRetry={() => void submit()} />
          ))}
        </div>
      </main>
      <Footer />
      <HistoryDrawer open={drawer} runs={runs} onClose={() => setDrawer(false)} onOpen={(id) => void openRun(id)} />
    </>
  );
}
