"use client";
import { Check, Loader2, PlayCircle, RotateCcw } from "lucide-react";
import { progressAt } from "@/lib/estimate";
import type { RunResult } from "@/lib/types";
import { Notice } from "./Bits";

export function RunProgress({ elapsed, hasImage, typical, onCancel }: { elapsed: number; hasImage: boolean; typical: number | null; onCancel: () => void }) {
  const p = progressAt(elapsed, hasImage, typical);
  return (
    <section className="card rise p-5 sm:p-6" aria-live="polite" aria-label="Assessment in progress">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Loader2 size={18} className="animate-spin text-accent" /> Assessing the incident
        </h2>
        <span className="tabular-nums text-sm text-muted">{Math.floor(elapsed)} s</span>
      </div>
      <ol className="space-y-2.5">
        {p.stages.map((s, i) => {
          const done = i < p.index;
          const current = i === p.index;
          return (
            <li key={s.key} className={`flex items-center gap-3 text-sm ${done || current ? "" : "text-muted"}`} aria-current={current ? "step" : undefined}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${done ? "border-transparent bg-accent text-accent-contrast" : current ? "border-accent text-accent" : "border-border"}`}>
                {done ? <Check size={14} /> : current ? <span className="pulse-dot h-2 w-2 rounded-full bg-accent" /> : i + 1}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted">
        {p.overrun ? "Taking longer than usual; the models may be busy or a fallback is being tried. " : ""}
        Steps are an estimate from typical run times; the exact timeline appears with the result. {typical ? `Your recent runs took about ${Math.round(typical)} seconds.` : "A run can take from 15 seconds to a couple of minutes."}
      </p>
      <button type="button" className="btn mt-4" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}

const TITLES: Record<string, string> = {
  unreachable: "The workflow engine cannot be reached",
  timeout: "The workflow took too long",
  not_listening: "The workflow is not listening",
  bad_request: "The request was not accepted",
  server_error: "The workflow returned an error",
  not_json: "The answer was not in the expected format",
  empty: "The workflow returned nothing",
  rejected: "The workflow rejected this input",
};

export function ErrorCard({ result, demo, onDemo, onRetry }: { result: RunResult; demo: boolean; onDemo: () => void; onRetry: () => void }) {
  const problems = result.problems ?? [];
  return (
    <section className="rise space-y-4" aria-live="assertive">
      <Notice level="error" title={TITLES[result.kind] ?? "Something went wrong"}>
        {result.message && <p>{result.message}</p>}
        {problems.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {result.hint && (
          <p className="mt-2">
            <strong>What to do:</strong> {result.hint}
          </p>
        )}
      </Notice>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={onRetry}>
          <RotateCcw size={16} /> Try again
        </button>
        {!demo && (
          <button type="button" className="btn" onClick={onDemo}>
            <PlayCircle size={16} /> Try with demo data
          </button>
        )}
      </div>
    </section>
  );
}
