# DisasterAI demo UI (Next.js)

A presentation interface for the DisasterAI workflow. The Streamlit console in `ui/` remains the team's test tool.

```bash
npm install
cp .env.example .env.local     # optional: change the targets
npm run dev                    # http://localhost:3000
npm test                       # Vitest: libraries and API routes against a fake n8n
npm run typecheck && npm run lint && npm run build
```

## How it works

Browser -> Next.js route handlers (server only) -> n8n webhook. The browser never learns the n8n address and cannot choose a target, so the app is not an open proxy. Targets come from `.env.local`:

| Variable | Default | Use |
|---|---|---|
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/incident` | the workflow |
| `REPLAY_WEBHOOK_URL` | `http://localhost:5690/webhook/incident?delay=3` | the "Demo data" switch |
| `RAG_URL`, `OLLAMA_URL` | `http://localhost:8010`, `http://localhost:11434` | the status pill |
| `REPO_ROOT` | `..` | where `eval/`, `vision/` and `rag/corpus` live (read-only, except `eval/results/ui_runs/`) |
| `RUN_TIMEOUT_MS` | `600000` | how long to wait for n8n |

- n8n answers once, at the end. The step list while waiting is an estimate from typical run times and says so; the real timeline is in Technical details.
- "Demo data" replays saved real answers (`scripts/replay_webhook.py`). They are labelled and saved with `mock: true`; never quote them as model results.
- Saved runs use the same record as `ui/history.py`. Examples, entries and run images are fetched by id, never by path.
- Written for a local demo (a run can last minutes), not for serverless hosting.
