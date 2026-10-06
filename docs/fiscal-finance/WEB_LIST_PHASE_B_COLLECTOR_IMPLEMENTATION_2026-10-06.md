# Web-list Phase B collector implementation handoff

## TASK

Implement the approved `direct_html_metadata_v1` opt-in for web-list pagination, including bounded durable pending-page checkpoints, ordinary-run resume, fixed-window validation, guarded metadata-only fetch integration, and atomic article/queue/cursor commits. Scope and behavior follow `S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md`; no source was enabled and no official endpoint was contacted.

## MODEL

Codex sub-agent `oct06_phase_b_collector`; implementation and tests used local reasoning only. No model/provider call was made.

## FILES_CHANGED

- `packages/backend/src/sources/config-keys.ts`: admits the explicit `pagination.detailMode` configuration key.
- `packages/backend/src/sources/web-list-pagination.ts`: adds strict metadata config validation, bounded pending-page state/hash validation, fixed-generation window checks, source-local detail target admission and shared dispatch accounting, resumable per-row checkpoints, config freeze handling, and atomic final article/queue/cursor commit. Existing reserved-connection and advisory-lock collector lifecycle is reused.
- `tests/web-list-pagination.test.ts`: adds synthetic transport, durable resume, budget, malformed-state, cursor namespace/counter/window, and database-trigger fault coverage.
- `tests/web-list-pagination-metadata.test.ts`: verifies trusted-date classification against the generation's fixed anchor and cutoff.
- This report records the implementation handoff. Git index and commit were left to QA as assigned.

The metadata-only transport API is owned by the Phase A agent in `web-list.ts`. The collector calls `fetchWebListMetadata(url, source, need, { runBudget, remainingMs, assertActive, testFetcher? })`; it registers the current admitted target and identity before dispatch and clears it in `finally`. The injected test fetcher still must consume the same `runBudget.beforeDispatch` hook.

## TESTS_RUN

Focused command, run serially with `DATABASE_URL=postgres://postgres@127.0.0.1:5432/myhot_phaseb_collector_test`:

```text
node --test --test-concurrency=1 tests/web-list-pagination.test.ts tests/web-list-pagination-metadata.test.ts
```

Native exit: `0`; 10 tests passed, 0 failed. Captured output is in `D:\AI-work\MYHOT\phaseb_logs\collector-focused.stdout.log`; stderr is empty in `collector-focused.stderr.log`. The database is the isolated `*_test` database `myhot_phaseb_collector_test`, previously initialized with 35 migrations. The preview database was not used.

Type checks:

- `npx tsc -p packages/backend --noEmit` — native exit `0`; stdout/stderr in `backend-typecheck.stdout.log` and `backend-typecheck.stderr.log`.
- `npx tsc -p tests --noEmit` — native exit `0`; stdout/stderr in `tests-typecheck.stdout.log` and `tests-typecheck.stderr.log`.

Earlier attempts are retained here for a truthful run history: the first focused invocation had no `DATABASE_URL` and exited `1` in `tests/setup.ts` before tests loaded; the first invocation with the isolated database exposed a fixture assertion against a nonexistent result `reason` property (1 failing assertion, no implementation regression). The fixture was corrected to verify the persisted blocked cursor state, then the complete two-file focused command above passed. A prior database-create attempt also failed because the target test database did not yet exist; the isolated test database was created and migrated before the successful focused run. No failed exit was converted to success or hidden by a wrapper.

Fault-injection coverage uses database triggers, not production fault hooks:

| Boundary | Test | Injected failure and durable evidence |
| --- | --- | --- |
| Pending-page snapshot | `metadata snapshot and per-row checkpoints survive injected database failures` | A `BEFORE UPDATE OF cursor` trigger rejects the pending snapshot. The test asserts zero detail fetches, zero articles, and no persisted pending page. |
| Per-row resolution | `metadata snapshot and per-row checkpoints survive injected database failures` | A trigger rejects the second row checkpoint after the first row is durable. On resume, the list and first detail are not fetched again; the second row is fetched again and then checkpointed. |
| Final page/article/queue/cursor | `metadata final article, queue, and cursor commit rolls back together and replays only durable metadata` | A trigger rejects the `nextPageIndex=1` cursor update. The article and `events.group` queue write roll back in the same transaction; the resolved pending row remains durable. Replay commits without refetching listing or detail. |

Other focused cases cover ordinary-run ordered resume, no repeat dispatch for resolved rows, injected-fetch budget enforcement, duplicate and malformed pending state, mutation rejection, namespace preservation during generation initialization, committed-page counter integrity, and fixed cutoff tampering. The final-commit fault is injected at the cursor update and proves transaction rollback for article/queue/cursor; separate faults at each individual SQL statement were not tested.

## RESULT

Collector implementation and its owned focused tests are frozen at the passing run above. Metadata remains opt-in. Pages are capped at 60 candidates and pending JSON at 256 KiB; article URLs and titles are bounded at 2048 and 1000 characters. Detail requests use the shared dispatch/deadline budget, with no more than the configured `detail.maxFetches` targets per run. Pending snapshots and row resolutions are durable before the next operation, and final article/queue/cursor writes share one short transaction.

Resume revalidates saved rows against the generation's fixed `anchorAt` and `cutoffAt`: resolved dates must remain trusted and inside the window; `outside_window` dates must remain trusted and strictly before cutoff. At configured resume and final commit, cutoff is also recomputed from the fixed anchor and frozen `_aihot.initialBackfillMonths` using the existing 30-day month rule. Configuration changes stop continuation for review. The generation stays `coverage: "unproven"`; the collector does not set `initializedAt` or mark the source complete.

## RISKS

- This is bounded first-import metadata enrichment; it does not establish pagination completeness, freshness quality, or Gate 2 readiness.
- Database-trigger tests prove each documented transaction boundary and rollback behavior, but do not inject a separate failure after every SQL statement.
- End-to-end transport and preview contracts are owned and tested by the Phase A and QA agents; this report only records the collector-facing interface and owned tests.

## BLOCKERS

No blocker remains in the collector-owned focused scope. The combined full QA suite and final cross-owner review remain pending with QA.

## NEXT

QA should run the planned fresh 35-migration full test/typecheck/build/preview checks, review the frozen cross-owner diff and impact matrix, then own Git index/commit/push and CI evidence. Source configuration remains disabled pending later authorization and separate readiness review.
