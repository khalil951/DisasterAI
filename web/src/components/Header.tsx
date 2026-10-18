"use client";
import { History, Moon, Radio, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { HealthRow, HealthState } from "@/lib/types";

const DOT: Record<HealthState, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", down: "bg-red-500" };
const WORD: Record<HealthState, string> = { ok: "Ready", warn: "Limited", down: "Offline" };

export function StatusPill({ rows, state, loading }: { rows: HealthRow[]; state: HealthState | null; loading: boolean }) {
  const s = state ?? "warn";
  return (
    <details className="relative">
      <summary className="chip list-none" aria-label={`System status: ${loading ? "checking" : WORD[s]}`}>
        <span className={`h-2 w-2 rounded-full ${loading ? "bg-slate-400 pulse-dot" : DOT[s]}`} aria-hidden />
        {loading ? "Checking" : WORD[s]}
      </summary>
      <div className="card absolute right-0 z-20 mt-2 w-72 p-3 text-sm shadow-lg">
        <p className="mb-2 font-semibold">System status</p>
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[r.state]}`} aria-hidden />
              <span>
                <span className="font-medium">{r.name}</span> <span className="text-muted">{r.detail}</span>
              </span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted">No answer yet.</li>}
        </ul>
      </div>
    </details>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button type="button" className="btn btn-ghost !p-2" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function Header(props: {
  rows: HealthRow[];
  state: HealthState | null;
  loading: boolean;
  demo: boolean;
  onDemo: (v: boolean) => void;
  onHistory: () => void;
}) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="mr-auto flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-contrast" aria-hidden>
            <Radio size={18} />
          </span>
          <div className="leading-tight">
            <p className="font-semibold">DisasterAI</p>
            <p className="hidden text-xs text-muted sm:block">Disaster assessment decision support</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm" title="Use saved answers instead of the live workflow">
          <input type="checkbox" role="switch" className="h-4 w-4 accent-[var(--accent)]" checked={props.demo} onChange={(e) => props.onDemo(e.target.checked)} />
          Demo data
        </label>
        <StatusPill rows={props.rows} state={props.state} loading={props.loading} />
        <button type="button" className="btn btn-ghost !px-2.5" onClick={props.onHistory}>
          <History size={16} /> <span className="hidden sm:inline">Recent</span>
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-10 pt-6 text-xs text-muted">
      <p>
        <strong>Decision support only.</strong> This is a university prototype, not an emergency service and not an official assessment. In an emergency call your local emergency number. The severity scale (low, moderate, high, critical) is this project&apos;s own working scale, not an official standard.
      </p>
    </footer>
  );
}
