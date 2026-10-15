# Corpus sources

One row per document in rag/corpus/. Fill this in when you add a file. The report cites from here.

File naming: <topic>_<short_name>.<ext> with topic one of fire, flood, structural, general. Put English files in en/ and French files in fr/. Example: en/fire_fema_p2143.pdf.

| File | Language | Topic | Title | Publisher | Date | URL | Licence or reuse note | Verified by and date |
|------|----------|-------|-------|-----------|------|-----|-----------------------|----------------------|
| en/flood_kb.md | en | flood | Floods knowledge base, entries FL-01 to FL-26 except FL-05 to FL-11 (19 entries) | Project team, from RC and P2055 below | 2026-10-15 | not applicable | Derived from sources with no stated licence. Course use only, cite, do not republish | Built with the KB tools, QA passed 2026-10-15 (docs/knowledge_base/QA_REPORT.md) |
| fr/flood_kb.md | fr | flood | Floods knowledge base, French entries FL-05 to FL-11 (7 entries) | Project team, from FALC below | 2026-10-15 | not applicable | Same as above | Same as above |
| en/structural_kb.md | en | structural | Structural and urban emergencies knowledge base, ST-01 to ST-26 (26 entries) | Project team, from P2055 and P2055-2 below | 2026-10-15 | not applicable | Same as above | Same as above |
| en/fire_kb.md | en | fire | Fires knowledge base, FI-01 to FI-08 (8 entries). LIMITED: no wildfire prevention or evacuation guidance | Project team, from P2055 below | 2026-10-15 | not applicable | Same as above | Same as above |

The corpus files are a curated knowledge base, not the original PDFs. Each entry is one self-contained piece of guidance whose heading carries its id (for example FL-04) and which ends with its source and PDF page. The full provenance record (verbatim anchor phrases per entry, team notes, QA tests) is in docs/knowledge_base/. The "page" stored in the index is the page of the .md file (always 1), so cite the entry id and the PDF page written in the entry, not the index page.

Original documents behind the entries (checked by the team, reported by Kay on 2026-10-15; PDF page numbers are positions in the PDF file):

| Key | Original file | Title | Publisher | Date | Language | Origin |
|-----|---------------|-------|-----------|------|----------|--------|
| RC | EN_Flood-Preparedness-Checklist.pdf | Flood Preparedness Checklist | American Red Cross | 2022-09-01 (Version 1) | en | US |
| FALC | Pluie_et_inondation_FALC_1.pdf | Pluie et inondation (version FALC) | French Ministry of Ecological Transition, adapted by Com'access | not stated, refers to the 2023 floods | fr | FR |
| P2055 | fema_p-2055_post-disaster_buildingsafety_evaluation_2019.pdf | Post-disaster Building Safety Evaluation Guidance (FEMA P-2055) | FEMA, prepared by the Applied Technology Council | 2019-11 | en | US |
| P2055-2 | fema_rsl_cordoning-earthquake-damaged-buildings_042025.pdf | Recommendations for Cordoning Earthquake-Damaged Buildings (FEMA P-2055-2) | FEMA, prepared by the Applied Technology Council | 2023-09 (second issuance 2025-04) | en | US |

Source URLs were not recorded in the knowledge base. Add them here.
