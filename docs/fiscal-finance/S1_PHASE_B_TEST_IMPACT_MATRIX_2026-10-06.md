# S1 Phase B test-impact matrix — 2026-10-06

## Status

Phase B implementation is in progress under the independently approved [metadata-only scope](S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md). This matrix does not assert that owner changes are complete or fully tested. Keep the Phase A contract and its evidence unchanged. Gate 2 remains `NOT_PASSED`; all production sources remain disabled and coverage remains `unproven`.

## Contract to test

The schema owner confirmed that the existing `readWebListPagination(config)` will return the parsed pagination object with optional `detailMode: "direct_html_metadata_v1"`; `validateWebListPagination(kind, config)` validates the accepted mode combination and `validateWebListMetadataConfig(kind, config)` supplies config-key diagnostics. Preview should consume that parsed contract rather than reimplementing schema parsing.

The admin preview remains page-zero-only for both Phase A and Phase B sources. It can validate the opt-in and exercise the listing parser, but must not request an article detail, advance pagination, load or save `pendingPage`, alter `sources.cursor`, create a source, or write a `fetch_runs` row. Its Phase A response continues to say `previewMode=single_page`, `paginationExecuted=false`, and `coverage=unproven`. Legacy preview remains a one-page call with its existing response shape.

## Impact table

| Owner / area | Contract affected | Required focused evidence | Negative assertions / limits |
|---|---|---|---|
| B — `config-keys.ts`, pagination helper | Exact opt-in `detailMode`, strict metadata config, compatible parser result | Existing Phase A config tests plus valid direct-HTML metadata config and invalid/missing/unknown mode combinations | No implicit opt-in from `detail.maxFetches`; no change to legacy configs; reject disallowed adapter/Jina/PDF/body combinations per review |
| A — `web-list.ts` metadata transport | Direct HTML metadata-only detail under one shared source-local budget | Synthetic HTML MockAgent tests for title/date selectors, date authority, failed/empty/invalid results, final URL identity, remaining deadline/dispatch | No Jina/PDF/attachment/body helper, no retries, no generic HTML date fallback, no budget reset |
| B — collector and cursor DB tests | Bounded pending-page metadata snapshot, durable row resolution, final page commit | Fresh `*_test` database, 35 migrations, ordered focused tests for config bounds, cursor/pending validation, successful resolution, restart, deadline, conflict/blocking and transactional rollback | No production/preview DB; no migration/schema; no raw HTML/body/cookies/response or unbounded state in cursor; no `initializedAt`/coverage-complete claim |
| QA — `admin/sources.ts`, preview tests | Admin reads the same parsed Phase B config but stays page zero | A preview fixture supplies valid `detailMode` config and a page-0 candidate; MockAgent records the request set | Assert exactly one page-0 dispatch, zero detail dispatches; no source, `fetch_runs`, or cursor DB writes; response remains single-page/unproven |
| QA — preview validation/legacy | Config preflight and unchanged opt-out path | Invalid Phase B config rejected before MockAgent dispatch; legacy web-list preview characterized | Phase B fields do not silently invoke details or change legacy response keys/one-page behavior |
| Combined QA — after A/B freeze | Cross-module assembly | One fresh 35-migration `npm test`, typecheck, Web build/tests, safe loopback smoke | Do not rerun the Phase A full suite while A/B are still changing; run once after freeze. Keep test fake providers local-only and all side-effect flags false. |

## Current evidence and next verification

Phase A baseline on combined code SHA `b2f479c4517d040f4b1c24b14e1407ad342bbb3a` is 276/276 local tests, typecheck pass, Web build pass, Web tests 15/15, loopback smoke 30/30, and successful Check/Docker run 37408474478. The Phase A preview focused suite previously passed 7/7 on a fresh 35-migration test DB. These are baseline evidence; they do not verify Phase B.

Interim Phase B preview check: the valid `direct_html_metadata_v1` config preview fixture passed on fresh `fiscalhot_oct06_phaseb_preview_baseline_test` (35 migrations): `node --test --test-concurrency=1 tests/web-list-pagination-preview.test.ts`, **8/8**, exit 0. It observed exactly one listing dispatch, zero detail dispatches, unchanged `single_page`/`paginationExecuted=false`/`coverage=unproven` metadata, and no source/cursor row or `fetch_runs` write. Legacy preview and the seven Phase A controls still passed. This checks only the admin preview contract; it does not test the Phase B metadata transport or collector.

As Phase B files arrive, review the parsed schema/API with B and A. Update only the owned admin preview and preview test file. The first focused check is complete; rerun the focused preview suite only if later integration changes affect its contract, then wait for A/B freeze before the single combined final QA. Do not change `web-list.ts`, pagination helper/config/collector, their owned tests, the 19 source configs, schema/migrations, S4, or production behavior from this QA lane.

## Fault coverage cross-check (frozen Phase B, 2026-10-06)

This cross-check is based on B's merged focused run and the frozen working tree. Test totals alone do not establish coverage of these separate transaction boundaries.

| Boundary | Current direct evidence | Fault evidence / gap |
|---|---|---|
| Pending-page snapshot write | `metadata pending page resumes in order without refetching its listing or completed detail rows` proves a first run durably leaves page 0 pending and later resumes without rereading the listing. `metadata mode is explicit, strictly bounded, and pending snapshots reject mutation` checks malformed hash, unknown key and wrong page index rejection. `metadata snapshot and per-row checkpoints survive injected database failures` uses a `sources.cursor` trigger to reject initial pendingPage persistence; assertions cover failed status, zero detail calls, no pending row and no article writes. | Passed as part of B's 10/10 combined collector/helper focused run on fresh `myhot_phaseb_collector_test` (35 migrations, native exit 0). Captured stdout: `D:\AI-work\MYHOT\phaseb_logs\collector-focused.stdout.log`; stderr file is empty. |
| Per-row resolution write | The resume test proves one detail row persists as resolved, later runs continue in order, and a resolved target is not fetched twice. The checkpoint-failure test rejects the second row's resolved-state cursor update, asserts the first row remains durable while rows two/three stay pending, then resumes without rereading the listing and fetches only the failed and later rows. | Passed in the same 10/10 focused run and captured log above. |
| Final page/article + queue + cursor commit | `metadata final article, queue, and cursor commit rolls back together and replays only durable metadata` injects a final `nextPageIndex=1` cursor-write failure. It asserts articles and `events.group` queue writes roll back, resolved pending metadata remains durable, and replay commits without refetching listing or details. The existing Phase A/default-route trigger test separately covers its own rollback/replay path. | Passed in the same 10/10 focused run and captured log above. The injection is a cursor-trigger failure at final commit, not separate failures at each queue/cursor/commit instruction. |

The merged B run contains 10 tests, 10 passed, 0 failed, on fresh `myhot_phaseb_collector_test` with 35 migrations. Its stdout is captured at `D:\AI-work\MYHOT\phaseb_logs\collector-focused.stdout.log`; stderr is empty. Backend and tests typecheck commands were reported exit 0; their stdout/stderr log files are empty and no separate exit-code files exist, so their exit status is command-record evidence rather than recoverable from log contents. The final-page failure is injected by a database cursor trigger; it establishes transaction rollback/replay behavior at that failure point, not every internal queue/cursor/commit instruction.

## Final combined QA

After A/B froze, the final feature tree passed on fresh database `myhot_oct06_phaseb_final_test` after all 35 migrations: `npm test` 296/296, native exit 0. `npm run typecheck`, `npm run build -w @aihot/web`, and Web tests 15/15 also passed. Full backend-test stdout/stderr/exit, migration, typecheck, Web build/tests, and after-smoke read-only SQL are preserved under ignored `.data/test-pg/oct06_phaseb_final_*` logs; the smoke command itself returned 30 checks passed and exit 0 directly in the tool output, but was not separately redirected to a raw log file.

API/Web were restarted with side-effect flags disabled and no worker; only `127.0.0.1:3001`, `127.0.0.1:3000`, and the existing `127.0.0.1:5432` PostgreSQL listener were open. Before and after smoke, read-only `fiscalhot_preview_test` counts matched: 35 migrations; 3 disabled sources and no source full-text flags; 3 articles at `body_status=none`, revision 1, empty body; 3 publications; 0 analyses, receipts, fetch runs, selected-ledger rows, and job runs. This is local software QA only. No real source, worker, model/provider, OCR, or production database was used. The full combined SHA has not yet been committed or CI-tested.

