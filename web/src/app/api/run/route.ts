import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { saveRun } from "@/lib/history";
import { postIncident } from "@/lib/n8n";
import { getSample } from "@/lib/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

const SAMPLE_ID = /^[a-z0-9_]{1,40}$/;

/** POST multipart: text, language (en|fr), demo (true|false), image (file, optional), sampleId and sampleImage (to use an example's photo).
 *  The browser never names the target: demo mode picks the replay webhook, otherwise the configured n8n. */
export async function POST(request: Request) {
  const cfg = getConfig();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The request was not a form." }, { status: 400 });
  }
  const text = String(form.get("text") ?? "");
  const language = form.get("language") === "fr" ? "fr" : "en";
  const demo = form.get("demo") === "true";
  const rawSample = String(form.get("sampleId") ?? "");
  const sampleId = SAMPLE_ID.test(rawSample) ? rawSample : null;

  let image: { bytes: Uint8Array; name: string; type: string } | null = null;
  const upload = form.get("image");
  if (upload instanceof File && upload.size > 0) {
    image = { bytes: new Uint8Array(await upload.arrayBuffer()), name: upload.name || "photo", type: upload.type };
  } else if (sampleId && form.get("sampleImage") === "true") {
    const s = await getSample(sampleId);
    if (s?.image) image = { bytes: new Uint8Array(s.image.bytes), name: s.image.name, type: s.image.type };
  }

  const url = demo ? cfg.replayUrl : cfg.n8nUrl;
  const result = await postIncident({ url, text, language, image, timeoutMs: cfg.timeoutMs, signal: request.signal });

  let runId: string | null = null;
  if (result.kind !== "cancelled" && !(result.kind === "bad_request" && result.problems.length)) {
    try {
      runId = await saveRun({ result, url: demo ? "replay webhook" : "n8n webhook", profile: demo ? "Next.js demo (replay, demo data)" : "Next.js demo", mock: demo, text, language, image, sampleId });
    } catch {
      /* a run that cannot be saved is still shown */
    }
  }
  return NextResponse.json({ result, runId, demo });
}
