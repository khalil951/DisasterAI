# Demo UI (Next.js): what it is and how it was checked

Added 2026-10-19 in `web/`. No change to the workflow, the prompts or the Python backend.

## Decisions
- Demo-first: one flow; pipeline, validation, retrieved entries, versions and raw JSON are in a collapsible "Technical details".
- The Streamlit console stays as the internal test tool. Both write the same run records.
- English interface; the EN/FR switch sets the report language only.
- Light theme with dark mode (system default, manual toggle).

## Checked
- `npm test`: 57 tests (port of the console's parity cases, data readers against the real corpus and examples, every API route against a fake n8n: ok, degraded, flagged, rejected, not JSON, empty, 500, 404, 400, timeout, unreachable, photo forwarded with its own content type, client-supplied target ignored, demo mode, path whitelist).
- `tsc --noEmit`, `eslint`, `next build`: clean.
- In the built-in browser against `scripts/replay_webhook.py`: the example flow with demo data (stepper, result with degraded banner, sources, recommendations), the "workflow not listening" error card with its hint and "Try with demo data", no horizontal overflow at 375 px.

## Not checked (be honest in the report)
- No live run through n8n (real models) from this UI yet.
- Screenshot comparison of every state in light and dark, and a keyboard-only and contrast audit, were not completed (the browser pane could not draw screenshots after the first run).
- The result text was read from the page, not judged visually in print preview.
