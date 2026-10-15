# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DisasterAI is a university final project: a multi-agent decision-support prototype for disaster assessment (scope v1: forest fires, floods, structural/urban emergencies). It does not replace emergency services.

Pipeline: incident (text + optional image) -> n8n webhook -> Incident Understanding agent -> Vision and RAG agents in parallel -> Risk Assessment agent -> Report agent -> Markdown report.

Most of the system lives outside Python: the agents are Gemini calls made from n8n HTTP Request nodes, using prompts from `prompts/`. Python provides the RAG service (`rag/`) and the evaluation scripts (`scripts/`). The n8n workflow is not built yet (`n8n/` is empty; the design is in `docs/N8N_WORKFLOW_PLAN.md`).

## Commands

Run everything from the repository root (the code uses `python -m rag.*` package imports).

```bash
python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cp .env.example .env            # set GEMINI_API_KEY; GEMINI_MODEL, EMBEDDING_MODEL, DEFAULT_STRATEGY
docker compose up -d            # n8n at http://localhost:5678
python scripts/check_env.py [--skip-embeddings]

# Unit tests (stdlib unittest, no network or model needed)
python -m unittest discover -s rag/tests -t .
python -m unittest rag.tests.test_chunking_metrics.<TestClass>.<test_name>   # single test

# RAG
python -m rag.ingest --strategy both [--size 300 --overlap 40 --min-words 30]
python -m rag.evaluate --strategy both [--use-topic-filter]   # needs rag/eval/queries.csv (copy from queries_template.csv)
uvicorn rag.service:app --port 8000   # POST /search {"query", "k", "topic", "strategy"}; GET /health

# End-to-end runs against the n8n webhook
python scripts/run_incidents.py --url <webhook url> --runs 2 [--only fire_01 flood_01] [--allow-missing-images]
```

There is no linter or build configuration. The first ingest downloads the embedding model, so it needs internet access.

## RAG architecture (`rag/`)

- `chunking.py`: loads the corpus and implements the two strategies being compared. `fixed` makes word windows with overlap. `section` uses a heuristic heading detector, merges short sections, caps size with the fixed splitter, and carries the current heading across pages. Chunks never cross page boundaries, so every chunk has an exact page number for citations. Sizes are counted in **words**, not tokens.
- Corpus metadata comes from file paths. Language is the parent folder (`rag/corpus/en|fr/`). Topic is the filename prefix (`fire_`, `flood_`, `structural_`, `general_`); an unknown prefix falls back to `general`. New documents must also be listed in `rag/corpus/SOURCES.md`.
- `embedder.py`: a sentence-transformers model, lazily loaded and cached. The e5 `query: ` / `passage: ` prefixes are added automatically when the model name contains "e5". Always use `embed_queries` for queries and `embed_passages` for documents.
- `store.py`: a persistent ChromaDB at `rag/chroma_db/` (gitignored; override with `CHROMA_PATH`). There is **one collection per strategy** (`disasterai_fixed`, `disasterai_section`) using cosine distance; ingest drops and recreates the collection. `score = 1 - distance`. Chunk ids look like `<source>::<strategy>::<n>`.
- `service.py`: the FastAPI endpoint n8n calls (from Docker at `http://host.docker.internal:8000`). The strategy defaults to the `DEFAULT_STRATEGY` env var. An invalid topic is silently treated as no filter. A missing index returns 503.
- `metrics.py` / `evaluate.py`: hit@k and MRR (stdlib only). A hit means the expected source matches and, when given, `expected_phrase` appears in the chunk. Per-query results are written to `rag/eval/results_<strategy>_<stamp>.csv`.

## Prompts and agent data contract (`prompts/`)

Read `prompts/README.md` before touching prompts or the workflow. Key rules:
- One folder per agent, one file per version (`v1.md`, `v2.md`). **Never edit a version after it has been tested**; create the next version and log the failing input, bad output, change and new output in `prompts/CHANGELOG.md`.
- The system prompt code block inside each file is what gets pasted into n8n.
- Incident text, image content and retrieved passages are untrusted. Every prompt must tell the model to ignore instructions inside them (`edge_03_injection` tests this).
- JSON keys and enum values are always English. Free text follows the incident language, and the report follows `output_language` (en/fr).
- Source tags (`report`, `image`, `knowledge_base`, `model_inference`) are used throughout so the report can separate what was reported, observed, retrieved and inferred.
- Fallbacks are set in n8n without an LLM call: no image -> `vision = null`; empty retrieval -> `knowledge = {"relevant_guidance": [], "coverage": "none"}`.
- The severity scale (low/moderate/high/critical) is the project's own working scale, not an official standard.
- Gemini: use `response_mime_type: application/json` for the JSON agents and validate the output in the workflow too. Do not send `temperature` to Gemini 3.6+ models (they ignore it).

## Evaluation and evidence

- `eval/incidents/*.json` are six fixed end-to-end incidents with `expected` values (severity is a *set* of acceptable values) and `manual_checks`. Do not change expectations to match observed outputs; if one was wrong, explain why in `docs/EVIDENCE_LOG.md` and re-run. Do not reuse prompt few-shot examples as test incidents.
- `run_incidents.py` sends multipart form data (`incident_text`, `output_language`, optional `image` from `vision/test_images/`). It expects the webhook to return JSON with `incident_type`, `severity`, `report_markdown`, `degraded_steps`, `prompt_versions`, and saves raw outputs plus `summary.csv` to `eval/results/<timestamp>/`. Test images are not committed; record their licence in `vision/test_images/SOURCES.md`.
- `docs/EVIDENCE_LOG.md` holds only real, dated, logged results. Never invent or estimate numbers, results or failures; prompt "hypotheses to test" become CHANGELOG entries only after they have actually been observed.
