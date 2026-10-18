"use client";
import { AlertTriangle, BookOpen, CheckCircle2, Info, OctagonAlert, ShieldAlert, ShieldCheck, ShieldQuestion, Siren } from "lucide-react";
import { useState } from "react";
import { type Level, type Tone, severityTone, sourceLabel } from "@/lib/render";
import type { Source } from "@/lib/types";

const SEV_ICON: Record<Tone, React.ReactNode> = {
  low: <ShieldCheck size={16} />,
  moderate: <ShieldAlert size={16} />,
  high: <AlertTriangle size={16} />,
  critical: <Siren size={16} />,
  undetermined: <ShieldQuestion size={16} />,
};

/** Colour, icon and word together, so severity never relies on colour alone. */
export function SeverityBadge({ severity, large }: { severity?: string | null; large?: boolean }) {
  const tone = severityTone(severity);
  return (
    <span className={`sev-${tone} inline-flex items-center gap-1.5 rounded-full font-semibold capitalize ${large ? "px-4 py-1.5 text-base" : "px-2.5 py-1 text-xs"}`}>
      {SEV_ICON[tone]}
      {tone === "undetermined" ? "Undetermined" : tone}
    </span>
  );
}

const LEVEL_ICON: Record<Level, React.ReactNode> = {
  success: <CheckCircle2 size={20} />,
  warning: <AlertTriangle size={20} />,
  error: <OctagonAlert size={20} />,
  info: <Info size={20} />,
};

export function Notice({ level, title, children }: { level: Level; title: string; children?: React.ReactNode }) {
  return (
    <div role={level === "error" ? "alert" : "status"} className={`tone-${level} flex gap-3 rounded-xl border p-4`}>
      <span className="mt-0.5 shrink-0">{LEVEL_ICON[level]}</span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function SourceChip({ source }: { source?: Source | string | null }) {
  return <span className="whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{sourceLabel(source)}</span>;
}

interface EntryData {
  id: string;
  title: string;
  text: string;
  source: string;
  language: string;
}

/** The knowledge-base passage behind a recommendation, loaded when asked for. */
export function EntryButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "loading" | "open" | "missing">("idle");
  const [entry, setEntry] = useState<EntryData | null>(null);
  async function toggle() {
    if (state === "open" || state === "missing") return setState("idle");
    setState("loading");
    try {
      const res = await fetch(`/api/entries/${encodeURIComponent(id)}`);
      if (!res.ok) return setState("missing");
      setEntry(((await res.json()) as { entry: EntryData }).entry);
      setState("open");
    } catch {
      setState("missing");
    }
  }
  return (
    <span className="block">
      <button type="button" onClick={toggle} aria-expanded={state === "open" || state === "missing"} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        <BookOpen size={12} /> {id}
      </button>
      {state === "loading" && <span className="ml-2 text-xs text-muted">Loading…</span>}
      {state === "missing" && <span className="mt-1 block rounded-lg bg-surface-2 p-3 text-xs text-muted">The passage {id} could not be found in the knowledge base.</span>}
      {state === "open" && entry && (
        <span className="mt-1 block rounded-lg border border-border bg-surface-2 p-3 text-xs">
          <span className="block font-semibold">{entry.title}</span>
          <span className="mt-1 block whitespace-pre-line">{entry.text}</span>
          {entry.source && <span className="mt-1 block text-muted">Source: {entry.source}</span>}
        </span>
      )}
    </span>
  );
}
