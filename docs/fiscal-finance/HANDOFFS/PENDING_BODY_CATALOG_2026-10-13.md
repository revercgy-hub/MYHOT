# 48-source sweep pending-body sample handoff — 2026-10-13

## Scope and exclusions

This was one extraction-only pass against the existing isolated `fiscalhot_catalog_sweep_20261013_test` database (35 migrations). The database contained 413 rows: 28 body `ok`, 378 pending and 7 unconfirmed. A historical identity audit compared the 378 pending rows against six earlier isolated bulk databases using source ID, exact URL, title and publication date. It classified 254 as prior body-ok, 14 as prior-held, 99 as prior-pending, and 11 as having no exact historical URL record. The prior body-ok and prior-held identities were excluded from new HTTP requests; no historical body was copied or imported.

The 11 no-history rows were all outside this pass's permitted driver scope: one `mof-finance-notices` row uses an attachment-configured detail source, two `mof-regional-supervision-dynamics` rows have no catalog detail driver, and eight `xiamen-finance-debt` rows use attachment-configured detail behavior. Of the 110 prior-pending/no-history candidates, the pass also excluded 26 rows in no-detail/unsupported sources, nine in attachment-configured sources, and one PDF URL. This left 74 frozen pending HTML article IDs in 13 sources. All 74 had historical pending identity, and none overlapped prior structured body attempts, prior body-ok or prior-held identities. No PDF or attachment URL was requested.

The frozen set is `.data/fiscal-qa/pending-body-catalog-20261013/frozen-candidates.json`, physical SHA-256 `e9a39eafc37002112ef0331f90e982631b4b764c47516186be329217d0c62880`; its canonical 74-ID list hash is `e8ca3d755a9b9be0fc35da26bc1b8a79190e9db5a4e6bafa218e444755b6a8ec`. The runner is `.data/fiscal-qa/pending-body-catalog-20261013/run-once.mjs`, SHA-256 `06c0401fb2207148cc2f998412798f767454889f899478477f96ac2c30c6eee5`. Static `node --check` and a saved `--preflight-only` run passed before execution; the preflight had no database, network or marker side effects.

## Execution and result

The runner called only `extractArticleBody(articleId, false)` against already-stored article IDs. It did not fetch lists. The single run allowed at most 200 actual HTTP dispatches including redirects, paced requests to the same source by at least 750 ms, stopped a source at its first non-ok outcome, and did not retry. All source/global collection, full-text, worker, model, paid provider, Jina, OCR and attachment/PDF paths stayed disabled. Thirteen source configurations and flags matched the catalog before and after.

The run attempted 33 articles and dispatched 33 HTTP GETs (all HTTP 200; no redirects, rejected dispatches or retries). It extracted 26 bodies successfully and left 7 records unconfirmed. The 41 other frozen IDs were not requested after source-stop rules or because they were outside attempted source prefixes. The per-source result was:

| Source | Frozen | Attempted | Body ok | Unconfirmed | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| `govcn-policy-library` | 2 | 2 | 2 | 0 | All frozen candidates ok |
| `mof-accounting-notices` | 9 | 1 | 0 | 1 | Stopped on `attachments_unprocessed` |
| `mof-guizhou-supervision-dynamics` | 1 | 1 | 1 | 0 | Candidate ok |
| `mof-hebei-supervision-dynamics` | 6 | 6 | 6 | 0 | All frozen candidates ok |
| `mof-jiangsu-supervision-dynamics` | 4 | 4 | 4 | 0 | All frozen candidates ok |
| `mof-liaoning-supervision-dynamics` | 10 | 1 | 0 | 1 | Stopped on `identity_mismatch` |
| `mof-ningxia-supervision-dynamics` | 8 | 1 | 0 | 1 | Stopped on `non_article_container` |
| `mof-qinghai-supervision-dynamics` | 5 | 5 | 5 | 0 | All frozen candidates ok |
| `mof-shaanxi-supervision-dynamics` | 7 | 1 | 0 | 1 | Stopped on `short_body_not_allowed` |
| `mof-shandong-supervision-dynamics` | 3 | 3 | 2 | 1 | Stopped on `short_body_not_allowed` after two ok |
| `mof-shenzhen-supervision-dynamics` | 10 | 1 | 0 | 1 | Stopped on `identity_mismatch` |
| `mof-tianjin-supervision-dynamics` | 3 | 1 | 0 | 1 | Stopped on `short_body_not_allowed` |
| `mof-xinjiang-supervision-dynamics` | 6 | 6 | 6 | 0 | All frozen candidates ok |

Database totals moved from 28 ok / 378 pending / 7 unconfirmed to 54 ok / 345 pending / 14 unconfirmed. The records remain isolated test data, not admitted sources or published material; successful extraction does not indicate business relevance or source quality.

## Independent QA and safety evidence

Independent QA passed the bounded run. It verified the manifest and SQL-export hashes and binding, all 33 response bodies' bytes/SHA/EOF, the exact catalog parser replay against persisted status/body hashes, and 13/13 source-configuration restoration. The 406 existing queue jobs were unchanged (378 `content.extract-body` created and 28 `content.analyze` cancelled); there were zero analyses, receipts, `job_runs` or `pool_search` rows. The 33 publication projections remained summary mode with no summary, not selected, not eligible and not indexable. No safety violations were recorded.

Evidence is under `.data/fiscal-qa/pending-body-catalog-20261013/evidence/`:

- `manifest.json` SHA-256 `e0489d410b1b78c9df87c444aa4c1e7f06ed4d19b17ee29986b71cec93f299d4`
- `body-sql-export.json` SHA-256 `d1c74646dc38901cd0e38e56e1c69eae3cab7e0bc0b7b7a01297471fe70cb3a2`
- `responses/` contains 33 raw response bodies.
- `preflight.json` records the no-write static preflight.

This run does not establish any source admission, change Gate 2, or clear any pre-existing unconfirmed records; it adds seven unconfirmed outcomes from the attempted rows. A later pass requires its own frozen scope and authorization; no retry or cross-database body import is included here.

## Separate bounded PDF attachment diagnostics

Two independent evidence-only runs downloaded seven exact PDF URLs once each: the Accounting notice PDF and six official NFRA PDF references. All seven returned HTTP 200, `application/pdf`, `%PDF-` magic and complete content. Parsing was limited to 40 pages, 120,000 text characters and a 10-second parse timeout. Total extraction was 35 pages / 43,521 characters: the Accounting PDF contributed 19 pages / 35,791 characters, and the six NFRA PDFs contributed 16 pages / 7,730 characters. There were zero database connections, source config changes, OCR/model/provider calls or retries.

The Accounting PDF is an English IASB request for information about the post-implementation review of IFRS 9 and IFRS 7 hedge-accounting requirements. It materially extends its short Chinese cover notice, which says the English original prevails. The cover notice lists a 15 November 2026 submission date, while the PDF states 26 January 2027; this difference requires editorial/date review.

The six NFRA PDFs largely repeat their corresponding HTML text after whitespace/punctuation normalization. The sample does not establish distinct body coverage. PDF text was not imported into article bodies, and parsing did not change revisions, body status, queues or publications. A successful parse alone does not clear an `attachments_unprocessed` or identity hold and does not justify relaxing source or body guards.

Evidence and hashes:

- Accounting plus NFRA `1274220`: `.data/fiscal-qa/attachment-pdf-check-20261013/evidence/results.json`, SHA-256 `4ce9696fc747a6560436d4daa340879c1bb27ae851cb8aa2282921d817ae5a3b`.
- NFRA `1274219`, `1273762`, `1273663`, `1273452`, `1273347`: `.data/fiscal-qa/attachment-pdf-check-nfra-5-20261013/evidence/results.json`, SHA-256 `eac4fae9e9deab8f04ad530d2d24358213f638648c28899d86b6f2f29742ea44`.
- Offline content review: `.data/fiscal-qa/attachment-pdf-check-20261013/evidence/content-review.json`, SHA-256 `1954a6cf99c5c2260494869ea435e8ed4abf3e7146592096265595f638e7326`.

Independent bounded QA verified the seven response captures and parser outputs. This remains diagnostic evidence only: deciding how HTML and attachment text compose requires a separate identity/provenance rule and an explicitly tested integration path.
