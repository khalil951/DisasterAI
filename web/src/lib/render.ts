/** Turning the workflow's JSON into what a person reads. Pure functions (port of ui/render.py), tested without a browser. */
import type { ModelUsed, Report, RunBody, Source, Validation, Violation } from "./types";

export type Level = "success" | "warning" | "error" | "info";

export interface Banner {
  level: Level;
  title: string;
  message: string;
}

export function statusBanner(body: RunBody | null | undefined): Banner {
  const status = body?.status;
  const degraded = body?.degraded_steps ?? [];
  const validation = body?.validation ?? {};
  if (status === "rejected") {
    return { level: "error", title: "The workflow rejected this input", message: String(body?.error ?? "No reason given.") };
  }
  if (status === "ok") {
    return { level: "success", title: "Assessment complete, all automatic checks passed", message: "Nothing was degraded." };
  }
  if (status === "flagged") {
    const n = (validation.violations ?? []).length;
    const title = `Assessment complete, but ${n} automatic check${n === 1 ? "" : "s"} failed`;
    if (validation.repair_discarded) {
      return {
        level: "warning",
        title,
        message:
          "An automatic repair was tried and made the report worse (it dropped required parts), so the original report is shown with its original problem.",
      };
    }
    return {
      level: "warning",
      title,
      message: validation.repaired
        ? "Read it with care: the guardrails found a problem that the repair pass did not remove."
        : "The guardrails found a problem.",
    };
  }
  if (status === "degraded") {
    const steps = [...new Set(degraded.map((d) => d.step || "?"))].join(", ") || "one step";
    return { level: "warning", title: "Assessment complete, with degraded steps", message: `Steps with a problem: ${steps}. Details are in Technical details.` };
  }
  if (!body?.report) return { level: "error", title: "No report was produced", message: "The report step failed even after its retry." };
  return { level: "info", title: `Status: ${status}`, message: "" };
}

const IMAGE_MESSAGES: Record<string, { level: Level; text: string }> = {
  analysed: { level: "success", text: "The photo was analysed and used in this report." },
  analysis_failed: { level: "warning", text: "A photo was sent but its analysis failed. This report uses the text only." },
  unusable: { level: "warning", text: "The photo could not be used (too dark, blurred, or not a scene). This report uses the text only." },
  not_provided: { level: "info", text: "No photo was sent. This report uses the text only." },
};

export function imageMessage(report: Report | null | undefined, sentImage: boolean): { level: Level; text: string; status: string } {
  const status = report?.image_status ?? (sentImage ? "analysis_failed" : "not_provided");
  const m = IMAGE_MESSAGES[status] ?? { level: "info" as Level, text: `Photo status: ${status}` };
  return { ...m, status };
}

export const SOURCE_LABELS: Record<Source, string> = {
  report: "Reported",
  image: "From the photo",
  knowledge_base: "Knowledge base",
  model_inference: "Model inference",
};

export const sourceLabel = (source?: Source | string | null): string =>
  source ? ((SOURCE_LABELS as Record<string, string>)[source] ?? String(source)) : "Unlabelled";

export interface TimelineRow {
  step: string;
  provider: string;
  model: string;
  seconds: number;
  failedAttempts: number;
  failedDetail: string;
}

export function timelineRows(models: ModelUsed[] | undefined): TimelineRow[] {
  return (models ?? []).map((m) => {
    const failed = m.failed_attempts ?? [];
    return {
      step: m.step || "?",
      provider: m.provider || "-",
      model: (m.model ?? m.error ?? "-").split("/").pop() ?? "-",
      seconds: Number(m.seconds ?? 0),
      failedAttempts: failed.length,
      failedDetail: failed.join("; ").slice(0, 200),
    };
  });
}

export const slowestStep = (rows: TimelineRow[]): TimelineRow | null => (rows.length ? rows.reduce((a, b) => (b.seconds > a.seconds ? b : a)) : null);

export const degradedLines = (steps: { step?: string; reason?: string }[] | undefined): string[] =>
  (steps ?? []).map((d) => `${d.step ?? "?"}: ${d.reason ?? ""}`);

export interface ValidationView {
  status: string;
  repaired: boolean;
  now: Violation[];
  first: Violation[];
}

export function validationView(v: Validation | null | undefined): ValidationView {
  return { status: v?.status ?? "not run", repaired: Boolean(v?.repaired), now: v?.violations ?? [], first: v?.first_violations ?? [] };
}

/** The problems of a repaired report that the workflow threw away because it was worse than the original. */
export const repairDiscardedProblems = (v: Validation | null | undefined): Violation[] => (v?.repair_discarded ? (v.repair_violations ?? []) : []);

export type Tone = "low" | "moderate" | "high" | "critical" | "undetermined";

export function severityTone(severity: string | null | undefined): Tone {
  const s = (severity ?? "").toLowerCase();
  return s === "low" || s === "moderate" || s === "high" || s === "critical" ? s : "undetermined";
}

const TYPE_LABELS: Record<string, string> = {
  forest_fire: "Forest fire",
  flood: "Flood",
  structural_emergency: "Structural emergency",
  other: "Other incident",
  unclear: "Unclear",
};

export const incidentTypeLabel = (t: string | null | undefined): string => TYPE_LABELS[t ?? ""] ?? (t ? t.replace(/_/g, " ") : "-");

export const short = (text: string | null | undefined, n = 120): string => {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
};
