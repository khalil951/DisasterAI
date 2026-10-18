"use client";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { incidentTypeLabel, short } from "@/lib/render";
import type { RunSummary } from "@/lib/types";
import { SeverityBadge } from "./Bits";

export function HistoryDrawer({ open, runs, onClose, onOpen }: { open: boolean; runs: RunSummary[]; onClose: () => void; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="drawer" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Recent assessments">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold">Recent assessments</h2>
        <button type="button" className="btn btn-ghost !p-2" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <ul className="divide-y divide-border overflow-y-auto" style={{ maxHeight: "calc(100dvh - 3.5rem)" }}>
        {runs.length === 0 && <li className="p-4 text-sm text-muted">No saved assessments yet.</li>}
        {runs.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r.id)} className="block w-full px-4 py-3 text-left hover:bg-surface-2">
              <span className="flex items-center gap-2">
                <SeverityBadge severity={r.severity} />
                <span className="text-sm font-medium">{incidentTypeLabel(r.incident_type)}</span>
                {r.mock && <span className="rounded bg-surface-2 px-1.5 text-[11px] text-muted">demo</span>}
              </span>
              <span className="mt-1 block text-sm text-muted">{short(r.text, 90)}</span>
              <span className="mt-1 block text-xs text-muted">
                {new Date(r.saved_at).toLocaleString()} · {r.kind} · {r.seconds.toFixed(0)} s
              </span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
