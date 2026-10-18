import type { RunBody, RunKind } from "./types";

export const SUPPORTED_IMAGES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MIN_TEXT = 3;
export const MAX_TEXT = 4000;

/** What to do for each way a call can fail (same wording as the Streamlit console, ui/client.py). */
export const HINTS: Record<string, string> = {
  unreachable: "Nothing answers at the workflow address. Start n8n (docker compose up -d) and check that the service is running.",
  timeout: "The run took longer than the limit. The workflow may still be running in n8n; check its executions list.",
  not_listening: "n8n answered 404: the workflow is not active at this path. Open the workflow in n8n and switch it on.",
  bad_request: "The workflow refused the request. Check the text and the photo.",
  server_error: "n8n or one of its steps failed (HTTP 5xx). Open the execution in n8n to see which step.",
  not_json: "The answer is not JSON. The workflow may have stopped before its response step, or the address points to something else.",
  empty: "The answer was empty. The workflow may have stopped before its response step.",
  cancelled: "The assessment was cancelled.",
};

export interface ImageInfo {
  size: number;
  type: string;
}

/** Problems with the input, found before anything is sent. An empty list means the input is fine. */
export function checkInput(text: string, image?: ImageInfo | null): string[] {
  const problems: string[] = [];
  const trimmed = (text ?? "").trim();
  if (trimmed.length < MIN_TEXT) problems.push(`Describe the incident in at least ${MIN_TEXT} characters.`);
  if (trimmed.length > MAX_TEXT) problems.push(`The description is too long (${trimmed.length} characters, the limit is ${MAX_TEXT}).`);
  if (image) {
    if (!(SUPPORTED_IMAGES as readonly string[]).includes(image.type)) {
      problems.push(`Photo type ${image.type || "unknown"} is not supported. Use PNG, JPEG or WebP.`);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      problems.push(`The photo is ${(image.size / 1e6).toFixed(1)} MB; the limit is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`);
    }
  }
  return problems;
}

/** The kind for an answer that is valid JSON: the workflow's own status decides. */
export function classifyBody(body: RunBody): RunKind {
  const status = body.status;
  if (status === "rejected") return "rejected";
  if (status === "ok" || status === "degraded" || status === "flagged") return status;
  return body.report ? "degraded" : "not_json";
}

export const isSuccess = (kind: RunKind): boolean => kind === "ok" || kind === "degraded" || kind === "flagged";
