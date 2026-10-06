# S1 Phase A implementation checkpoint — 2026-10-06

## Scope and status

This checkpoint records the approved, bounded S1 Phase A implementation on `feat/fiscal-finance-hot`. It is not a source-quality acceptance, production rollout, or Gate 2 approval. Stage A is exercised only by isolated tests and loopback preview services. The 19 configured production sources remain disabled with full-text fetching off; no production source was opted in. Pagination coverage remains `unproven`.

## Revision and workspace

- Project base: `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`.
- Round start: `9814ceb0dcdf3fc71ab647d04fd12a1997f73c5f`.
- Phase A feature commit: `3443f62` (`feat: add bounded web-list pagination phase A`).
- Publication test-fixture commit: `b2f479c4517d040f4b1c24b14e1407ad342bbb3a` (`test: stabilize publication release clock fixtures`).
- Combined code SHA was pushed to `origin/feat/fiscal-finance-hot`; Check workflow 369857246 run [37408474478](https://github.com/revercgy-hub/MYHOT/actions/runs/37408474478) succeeded for both Check and Docker jobs.
- The separate documentation checkpoint is the only expected uncommitted work before its docs-only commit; do not include it in a code test or claim its SHA as the CI-tested SHA.

## What changed

The opt-in `web_list` path now supports bounded `mof_index_v1` page identities, a shared request/deadline budget across page fetches and redirects, source-local list/index page filtering, page-by-page transaction/checkpoint progression, and an admin preview that fetches page zero only and marks coverage unproven. Legacy sources without pagination configuration retain their existing one-page behavior. Tests cover policy, loopback transport, fresh-DB collector progression, preview metadata/deadline/aliases, and the preserved legacy preview response.

The publication test fixture separately fixes an app-clock/database-clock race. Its previous SQL `grouped_at = now()` could be later than the time captured by `publishArticle` by about 15 ms, keeping an item behind the release watermark. The fixture now binds an application timestamp one second earlier in each of the two release tests. It changes no production ledger behavior and weakens no assertion.

The supported pager rule is deliberately limited to canonical same-directory `index_N.htm` identities plus redirect and previous-page identity checks. It does not parse arbitrary HTML/JavaScript pager metadata (`currentPage`, `countPage`, etc.), and must not be described as generic pager-change detection or 90-day completeness. See [scope review](../S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md), [Phase A integration review](../READONLY_PHASE_A_INTEGRATION_REVIEW_2026-10-06.md), and [Phase B detail-metadata scope review](../S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md). Phase B is a separately reviewed scope, not implemented by these commits. No schema, migration, app, S4 production logic, or production source config changed.

## Verification

- Final fresh Node 24 full suite: database `fiscalhot_oct06_final_npm_test2_test`, 35 migrations, actual `npm test` exit 0, **276/276 passed**. Native stdout/stderr/exit evidence is in ignored `.data/test-pg/oct06_final_npm_test2.stdout.log`, `.stderr.log`, and `.exit.txt`.
- The preceding full run returned 276/270/6. Its raw stdout/stderr were not saved; do not use the older 257-test logs as a substitute. A read-only query of its preserved database found the future ledger barrier at seq 21, article `rddlzdr0lsh83smux2qt1e3x9`, source `test-publication-muw3hjba9g3kl`. This was the early-release fixture race described above.
- After the fixture adjustment, a fresh 35-migration DB ran publication and strict-body tests sequentially: 19/19 passed, native exit 0. The database had zero future ledger events afterward. Evidence: ignored `.data/test-pg/oct06_pubwatermark_fix_subset.log` and `fiscalhot_oct06_pubwatermark_fix_test`.
- `npm run typecheck`: exit 0. `npm run build -w @aihot/web`: passed. `node --test --test-concurrency=1 "apps/web/tests/*.test.ts"`: 15/15 passed.
- Loopback preview smoke: `node scripts/smoke.ts --base http://127.0.0.1:3000`, **30/30 passed**, including API health and MCP initialize. Before and after read-only SQL on `fiscalhot_preview_test`: 35 migrations, 3 disabled preview sources, 3 articles, 3 publications, zero analyses, receipts, fetch runs, selected-ledger rows, or job runs. Each source is `enabled=false` with only `localPreviewSample` config.
- API `3001`, Web `3000`, and PostgreSQL `5432` listen only on `127.0.0.1`; no worker was started. Model, collection, Jina, embeddings, IndexNow, Feishu, and private-network flags were false for preview. The npm test run cleared real credentials and provider base URLs; its test-only model calls target local fake providers.
- One earlier full-run result is documented only from the tool summary and read-only DB evidence because its raw logs were not captured. This limitation is explicit and retained.

## Gate and next work

Gate 1 remains passed; Gate 2 remains `NOT_PASSED`. Missing bureau/column history, trust/date/body quality, noise, duplication/update and cross-period evidence remain unresolved. Existing timeout and date-conflict unknowns remain in the source matrix. Gold labels and P4/P6/P7/Gate 4 are not complete.

Next work may start only within the independently reviewed Stage B detail-metadata scope. Keep the current S1 Phase A contract frozen. Do not broaden it to arbitrary pager formats, change the 19 production configs, enable a source, claim coverage, call official providers, or deploy. The separately authorized Sichuan request to `index_2.htm` (the list's third page) is complete and recorded in [SICHUAN_HISTORY_PAGE3_PROBE_2026-10-06.md](../SICHUAN_HISTORY_PAGE3_PROBE_2026-10-06.md); it is one list observation with three displayed-date/path-token conflicts, not a detail sample or source acceptance.

## Owners and boundaries

- QA/docs owner: `packages/backend/src/admin/sources.ts`, `tests/web-list-pagination-preview.test.ts`, shared S1 docs, and the Git index for this checkpoint.
- Phase A collector owner: `packages/backend/src/sources/collect.ts`, `config-keys.ts`, `web-list-pagination.ts`, `tests/web-list-pagination.test.ts`.
- Phase A transport/policy owner: `packages/backend/src/lib/http-fetch.ts`, `web-list.ts`, `tests/web-list-pagination-transport.test.ts`, `tests/web-list-pagination-policy.test.ts`.
- Stage B work has a separate reviewed scope at `S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md`; it is not part of the Phase A acceptance or its CI SHA.

