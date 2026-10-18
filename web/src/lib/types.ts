/** The contract of the n8n workflow's answer, as saved in eval/results/ui_runs (see prompts/README.md and backend/schemas). */
export type Source = "report" | "image" | "knowledge_base" | "model_inference";
export type Confidence = "high" | "medium" | "low";

export interface Sourced {
  text: string;
  source?: Source;
  confidence?: Confidence;
}

export interface Recommendation {
  text: string;
  entry_id?: string;
  chunk_id?: string;
  source?: Source;
}

export interface Report {
  language?: string;
  location?: string | null;
  severity?: string;
  summary?: string;
  reported?: Sourced[];
  image_status?: string;
  observed?: Sourced[];
  knowledge?: { coverage?: string; guidance?: Recommendation[]; no_guidance_statement?: string | null };
  assessment?: { basis?: Sourced[]; risks?: Sourced[]; possibly_affected?: Sourced[]; conflicts?: string[] };
  recommendations?: Recommendation[];
  uncertainties?: string[];
  information_needed?: string[];
  disclaimer?: string;
  report_markdown?: string;
}

export interface ModelUsed {
  step: string;
  provider?: string | null;
  model?: string | null;
  seconds?: number;
  failed_attempts?: string[];
  error?: string;
  views_called?: number;
  views_ok?: number;
}

export interface Violation {
  check: string;
  message: string;
}

export interface Validation {
  status?: string;
  violations?: Violation[];
  repaired?: boolean;
  first_violations?: Violation[];
  repair_discarded?: boolean;
  repair_violations?: Violation[];
}

export interface DegradedStep {
  step: string;
  reason: string;
}

export interface RunBody {
  status: string;
  incident_type?: string | null;
  severity?: string | null;
  report_markdown?: string;
  report?: Report | null;
  validation?: Validation | null;
  degraded_steps?: DegradedStep[];
  knowledge_coverage?: string | null;
  retrieved_entry_ids?: string[];
  models_used?: ModelUsed[];
  prompt_versions?: Record<string, string>;
  error?: string | null;
}

export type RunKind =
  | "ok"
  | "degraded"
  | "flagged"
  | "rejected"
  | "unreachable"
  | "timeout"
  | "not_listening"
  | "bad_request"
  | "server_error"
  | "not_json"
  | "empty"
  | "cancelled";

export interface RunResult {
  kind: RunKind;
  seconds: number;
  httpStatus?: number;
  body?: RunBody;
  message: string;
  hint: string;
  problems: string[];
}

/** What the server saves for a run: the same keys as ui/history.py, so the Streamlit console can read these files too. */
export interface RunRecord {
  saved_at: string;
  sample_id: string | null;
  url: string;
  profile: string;
  mock: boolean;
  language: string;
  text: string;
  image_file: string | null;
  kind: RunKind;
  seconds: number;
  http_status: number | null;
  message: string;
  response: RunBody | null;
}

export interface RunSummary {
  id: string;
  saved_at: string;
  sample_id: string | null;
  kind: RunKind;
  severity: string | null;
  incident_type: string | null;
  seconds: number;
  mock: boolean;
  language: string;
  text: string;
  has_image: boolean;
}

export interface Sample {
  id: string;
  label: string;
  text: string;
  language: "en" | "fr";
  hasImage: boolean;
  featured: boolean;
  note: string;
}

export type HealthState = "ok" | "warn" | "down";

export interface HealthRow {
  key: string;
  name: string;
  state: HealthState;
  detail: string;
}
