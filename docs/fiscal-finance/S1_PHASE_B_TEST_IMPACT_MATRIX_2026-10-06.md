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

