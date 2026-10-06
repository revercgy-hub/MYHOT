# S1 Phase B checkpoint — 2026-10-06

## TASK

Complete the approved, opt-in `direct_html_metadata_v1` continuation for paginated `web_list` sources, keep the admin preview page-zero-only, run the final fresh local QA, commit and push the combined code, and record the phase boundary. This checkpoint does not approve a production source or a coverage claim.

## MODEL

GPT-6 Luna High. Project provider/model calls: 0. Test-only model paths used local stubs; credentials and provider base URLs were cleared for test execution.

## REPOSITORY

- `CURRENT_BRANCH=feat/fiscal-finance-hot`
- `CODE_SHA=b85f4e21f049571c4fc67ccb8553b8ea2f0a0b88`
- `BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`
- `ROUND_BASE_SHA=9814ceb0dcdf3fc71ab647d04fd12a1997f73c5f`
- `CODE_COMMIT` is pushed to `origin/feat/fiscal-finance-hot`; no `main` or force push.
- The final handoff is a separate documentation-only commit. Read current `HEAD` with `git rev-parse HEAD` after that commit; the status file avoids self-referential SHA claims.

## FILES_CHANGED

Code commit `b85f4e2` contains:

- `packages/backend/src/sources/config-keys.ts`
- `packages/backend/src/sources/web-list-pagination.ts`
- `packages/backend/src/sources/web-list.ts`
- `tests/web-list-pagination-preview.test.ts`
- `tests/web-list-pagination.test.ts`
- `tests/web-list-detail-metadata.test.ts`
- `tests/web-list-pagination-metadata.test.ts`

The documentation checkpoint contains `docs/sources.md`, the Phase B test-impact matrix, Phase B transport/collector/readonly reports, the 19-entry [source admission matrix](../WEB_LIST_SOURCE_ADMISSION_MATRIX_2026-10-06.md), the `PROPOSED_NOT_APPROVED` Phase C readiness proposal, `STATUS.md`, and this handoff. A's limited read-only audit verified the 19 manifest IDs and kinds, confirmed all are disabled/no-full-text/no-pagination, checked the seven config-shape candidates and the 22 cited artifact/report references. It did not recalculate raw hashes or make a source eligible. No source is admitted; the matrix is offline evidence inventory only.

No diff in `industry/sources.json`, other source manifests, apps, schema/migrations, publication/materials/jobs/providers, or S4 code. All 19 configured production sources remain disabled, both full-text outputs remain false, and no source has this pagination opt-in.

## TESTS_RUN

All local full-suite checks ran on Node `v24.16.0` / npm `11.13.0`. Fresh database `myhot_oct06_phaseb_final_test` was absent before creation, then received 35 migrations (native exit 0). The successful test environment pointed `DATABASE_URL` to that `_test` database, set `MODEL_CALLS_ENABLED=true` only for local test stubs, disabled embeddings/collection/Jina/Feishu/IndexNow/private-network/OCR side effects, removed provider credentials and base URLs, and used a nonexistent credentials directory. `.env` was absent.

- `npm test`: **296/296 passed**, 0 failed, native exit 0. Full stdout, stderr, and exit code are preserved in `.data/test-pg/oct06_phaseb_final_npm_test.{stdout.log,stderr.log,exit.txt}`.
- `npm run typecheck`: native exit 0; stdout/stderr/exit preserved in `.data/test-pg/oct06_phaseb_final_typecheck.*`.
- `npm run build -w @aihot/web`: native exit 0; stdout/stderr/exit preserved in `.data/test-pg/oct06_phaseb_final_web_build.*`.
- `node --test` over the `apps/web/tests/*.test.ts` files: **15/15 passed**, native exit 0; stdout/stderr/exit preserved in `.data/test-pg/oct06_phaseb_final_web_tests.*`.
- Loopback `node scripts/smoke.ts --base http://127.0.0.1:3000`: **30 checks passed**, native exit 0. The command returned its output directly to the tool; it was not separately redirected, so no raw smoke log is claimed.
- Fresh Phase B collector/helper focused run: **10/10**, native exit 0, 35-migration `myhot_phaseb_collector_test`. Captured stdout is outside the repository at `D:\AI-work\MYHOT\phaseb_logs\collector-focused.stdout.log`, stderr is empty. Backend and tests typechecks were reported exit 0; their captured stdout/stderr files are empty and no separate exit files exist.
- Metadata transport contract focused run: **10/10**, native exit 0, synthetic responses only; see `WEB_LIST_PHASE_B_METADATA_TRANSPORT_2026-10-06.md`.
- Preview focused run: **8/8**, native exit 0 on a fresh 35-migration test DB; final full `npm test` also includes the preview suite.

The collector fault cases distinguish three durable boundaries. A cursor trigger rejects the initial pending snapshot and assertions require zero details/articles and no pending cursor state. Another trigger rejects the second row checkpoint; the first row remains durable, and resume refetches only the failed and later rows. A final-page cursor trigger rolls back article and `events.group` queue writes together while retaining resolved pending metadata, then replay commits without rereading the listing/details. These are database-trigger tests, not production fault hooks; the final case does not inject a separate failure at every SQL instruction.

On existing `fiscalhot_preview_test`, read-only SQL before and after smoke matched: 35 migrations; 3 sources, all disabled and without full-text; 3 articles with `body_status=none`, revision 1, empty body; 3 publications; and 0 analyses, receipts, fetch runs, selected-ledger rows, or job runs. The post-smoke SQL stdout/stderr/exit is saved in `.data/test-pg/oct06_phaseb_final_preview_after.*`; the pre-smoke SQL result was captured directly in tool output. API/Web/PostgreSQL listeners were only `127.0.0.1:3001/3000/5432`; there was no `55432` listener or application worker. No official source request, OCR, production database access, or provider call occurred.

## CI

Workflow `Check` ID `369857246` was dispatched exactly once for code SHA `b85f4e21f049571c4fc67ccb8553b8ea2f0a0b88`. Run [37412301808](https://github.com/revercgy-hub/MYHOT/actions/runs/37412301808) completed successfully: Check and Docker jobs both passed. Linux backend tests reported 296 tests, 295 passed, 0 failed, 1 platform skip; typecheck, Web build/tests, migrations, built-site smoke, and Docker smoke passed. PostgreSQL logged the deliberately raised trigger exceptions from fault-injection tests; the suite result remained green.

## HISTORY AND RESULT

Phase A's earlier fresh full run returned 276/270/6. Its raw stdout/stderr were not retained. Read-only database evidence traced the failures to a roughly 15 ms test app-clock/database-clock race in a publication fixture. The fixture was corrected to bind its timestamp to the app clock minus one second; the publication + strict-body ordered subset then passed 19/19 and a fresh full run passed 276/276. The old failure remains documented and was not replaced with older logs.

During Phase B focused diagnosis, one attempt exited before tests loaded because `DATABASE_URL` was absent. A later test attempt exposed an assertion against a nonexistent result `reason`; the test was corrected to assert the persisted blocked cursor state. The final fresh collector/helper focused run passed 10/10. The fixture failures did not weaken production assertions.

Phase A and Phase B owner code/tests are frozen, and the Phase B read-only integration review found no remaining blocking finding. Phase B remains strictly opt-in, direct-HTML metadata-only, bounded and fail-closed. It does not set `initializedAt`, mark a generation complete, change S4/body readiness, or prove 90-day completeness. Preview stays on page zero, dispatches zero details, writes no cursor/source/fetch-run state, and reports `single_page`, `paginationExecuted=false`, and `coverage=unproven`.

**Gate 2 remains `NOT_PASSED`.** Source-specific date authority, list stability, historical coverage, true-end proof, source admission, and Gold labeling remain unresolved. The new Phase C readiness proposal is design-only (`PROPOSED_NOT_APPROVED`); it does not select a source or authorize more requests, code, database state, or worker activity. A later offline evidence-admission matrix is a separate documentation task and must not delay or retroactively change this Phase B checkpoint.

## NEXT

The verified `WEB_LIST_SOURCE_ADMISSION_MATRIX_2026-10-06.md` is included as an offline follow-on evidence document; it does not block or revise Phase B and no row is admitted. Any new source request, source opt-in, completion state, reset protocol, incremental mode, or Gate change requires its own scope decision and evidence. Keep all current sources disabled until then.
