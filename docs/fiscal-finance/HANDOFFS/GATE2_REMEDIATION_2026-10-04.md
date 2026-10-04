# Gate 2 remediation checkpoint: local implementation validated; Gate 2 remains open (2026-10-04)

STATUS=IN_PROGRESS
STAGE=P3 / Gate 2 remediation
GATE_1=PASSED
GATE_2=NOT_PASSED; no formal Gate 2 review has passed.
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=dd3835460d4f6d180209acbe0a48e4b142ea7ac0 (code commit and tested code SHA at checkpoint authoring; documentation commit remains separate)
STAGE_CODE_SHA=dd3835460d4f6d180209acbe0a48e4b142ea7ac0
PROJECT_BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
ROUND_BASE_SHA=ea5d3af0d8241772ea6fac0abcc26386d81c6d36 (this round's recovered worktree base; not the project base)
SOURCE_CONFIG_SHA=dd3835460d4f6d180209acbe0a48e4b142ea7ac0 (12 disabled industry source objects changed in this code commit)
CI_TESTED_SHA=dd3835460d4f6d180209acbe0a48e4b142ea7ac0; run [37163791233](https://github.com/revercgy-hub/MYHOT/actions/runs/37163791233) completed with success.
DOC_HEAD=separate docs-only checkpoint commit; exact current HEAD is reported in the final handoff, distinct from the tested code SHA.  
WORKTREE=code/tests and documentation checkpoint committed and pushed; no code changes after the tested code commit.

## Approved scope and implementation result

Sol approved a limited implementation scope for strict first-import publication dates and persistent attachment diagnostics with automatic-selection protection. `APPROVED_SCOPE` authorizes that implementation only; it does not pass Gate 2, approve the three proposed bureau sources, or enable collection/model workers. The coherent S1 code/test commit adds the diagnostic helper and provenance companion, preserves escaped upstream raw data, blocks direct and queued automatic analysis while a diagnostic is pending, clears it only after trusted complete extraction with a new revision, and masks selected publication projections without rewriting their ledger. Strict first-import date checks run after bounded authoritative detail dates where configured. No database migration, application/API schema, attachment download/parser, OCR, or source enablement was added.

Code changed in commit `dd3835460d4f6d180209acbe0a48e4b142ea7ac0`: `industry/sources.json`; backend `content/attachment-diagnostics.ts`, `content/extract.ts`, `content/materials.ts`, `content/pdf-body.ts`, `content/selected-body.ts`, `editorial/analyze.ts`, `editorial/input.ts`, `events/group.ts`, `jobs/content.ts`, `publication/detail.ts`, `publication/items.ts`, `publication/publish.ts`, `publication/v1.ts`, `sources/collect.ts`, `sources/config-keys.ts`, `sources/web-list.ts`; tests `analyze.test.ts`, `attachment-diagnostics.test.ts`, `content-jobs-attachment-gate.test.ts`, `events.test.ts`, `materials.test.ts`, `pdf-body.test.ts`, `publication.test.ts`, `source-rules.test.ts`.

All 12 industry source entries remain `enabled=false`, site/RSS full text remains off, and their daily/90-day target values are JSON configuration only; they have not been imported into production rows or exercised by a running scheduler. Existing general collector defaults remain unchanged. P4 real provider configuration is still absent. P5's eight-row metadata template still has no human-confirmed labels and is not evaluation-ready.

## Regional evidence

The 35-row matrix is based on the saved Ministry of Finance directory, not 35 verified feeds. Existing Xiamen evidence is limited and its source remains disabled. Three new bureau observations (Fujian, Beijing, Shanghai) each include one homepage/list and one bounded detail response. Beijing's list date is 2026-09-24, while detail `PubDate` is 2026-09-30; its detail title also omits the list title's “财政部” prefix. These facts stay separate and do not establish source readiness.

Batch 2 observed homepage and one visible “工作动态” list page for Tianjin, Hebei, Shanxi and Inner Mongolia; batch 3 did the same for Liaoning, Jilin, Heilongjiang and Shandong. Each batch recorded 8/8/0 attempted/dispatched/rejected, eight HTTP 200s, and ten current same-host `.htm` candidates per list page. QA recomputed all 16 raw HTML byte counts and SHA-256 values, confirmed eight same-host home anchors and 80 candidate links. No detail pages were requested in batches 2/3. Across the 35 bureau list, 11 have these limited observations; 23 have no independent-column observation in these batches. None of these observations proves pagination, cross-period freshness, body quality, stable selectors, or source acceptance. Reports: [batch 1](../REGIONAL_BUREAU_BATCH1_2026-10-04.md), [batch 1 detail QA](../REGIONAL_BUREAU_BATCH1_DETAIL_QA_2026-10-04.md), [batch 1 config readiness](../REGIONAL_BUREAU_BATCH1_CONFIG_READINESS_2026-10-04.md), [batch 2](../REGIONAL_BUREAU_BATCH2_2026-10-04.md), [batch 3](../REGIONAL_BUREAU_BATCH3_2026-10-04.md), [coverage matrix](../REGIONAL_BUREAU_COVERAGE_MATRIX.md).

The config-readiness report is an offline compatibility review only: current `fromHtml`, fake-fetcher `fetchDetail`, and `extractSelectedBody` parsed the three saved fixtures. For Beijing the first detail body check yields `identity_missing` after authoritative metadata is applied; details can still update, and a subsequent pure-helper extraction with persisted identity succeeds. The real collector/database/queued-extraction two-stage sequence has not been integration-tested. The next engineering task is to add the three sources as disabled configuration with saved-fixture tests and specifically verify Beijing's metadata update plus second-stage extraction. Until that test and separate source review pass, these sources are not ready and not enabled.

## TESTS_RUN

Final fresh local regression used database `fiscalhot_oct04_final_full_test` at `postgres://postgres@127.0.0.1:5432/`, freshly created and migrated with all 35 migrations:

- `npm test`: **250/250 passed**, exit 0; log `.data/test-pg/oct04_attachment_final_npmtest.log`.
- `npm run typecheck`: passed, exit 0; log `.data/test-pg/oct04_attachment_final_typecheck.log`.
- `npm run build -w @aihot/web`: passed, exit 0; log `.data/test-pg/oct04_attachment_full_webbuild.log`.
- `node --test apps/web/tests/*.test.ts`: **15/15 passed**, exit 0; log `.data/test-pg/oct04_attachment_full_webtests.log`.
- Restarted the loopback API from the tested worktree with `DATABASE_URL=postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test`, `MODEL_CALLS_ENABLED=false`, collection/integration/OCR/network flags false, and a nonexistent credentials directory; restarted the built Web server from the current worktree. No worker was started. `node scripts/smoke.ts --base http://127.0.0.1:3000`: **28/28 passed**, exit 0; fresh log `.data/test-pg/oct04_attachment_final_smoke_after_restart.log`.

For the full test process only, `MODEL_CALLS_ENABLED=true` so existing tests could use their local HTTP fake providers. All real provider keys and base URLs were removed; `AIHOT_CREDENTIALS_DIR` pointed to a nonexistent path. `COLLECT_ENABLED`, JINA fallback, Feishu, IndexNow, private-network fetch and OCR were false. Tests that intentionally use private/loopback fixtures control their module-local configuration; no live provider or official-source request occurred in the test run. The separately running preview services remain API/Web/PostgreSQL on loopback only; no worker was started.

Earlier attempts are not counted as final verification: an initial full run set `MODEL_CALLS_ENABLED=false` and was invalid because existing fake-provider tests failed at the gate. A second correctly enabled fake-provider run passed 249/250; its only failure exposed an unordered X-shard members query. A added the minimal `ORDER BY id` fix, passed the focused shard test 6/6 and typecheck, and the final fresh suite passed 250/250. Logs are `.data/test-pg/oct04_attachment_full_npmtest.log` (invalid environment) and `.data/test-pg/oct04_attachment_full2_npmtest.log` (pre-fix 249/250).

GitHub Check run 37163791233 tests code SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0` and completed successfully. It was dispatched once after push; an initial wrong filename request returned 404 and did not create a run. No duplicate run was dispatched.

## Environment, preview and data boundary

A read-only transaction against `fiscalhot_preview_test` returned exactly the three fixed preview sources and articles. Source rows are `local-preview-mof-budget`, `local-preview-pboc`, and `local-preview-pboc-xiamen`, each marked `localPreviewSample` in config with `site_fulltext=false` and `syndicate_fulltext=false`; article rows `local-preview-mof-budget-qa`, `local-preview-pboc-omo-191`, and `local-preview-pboc-xiamen-payment` remain `body_status=none`, `revision=1`, and empty body. Analyses, receipts, and job_runs are all zero. The preview API and built Web service were restarted after code commit `dd383...` and served the fresh 28/28 GET-only smoke at `127.0.0.1:3001/3000`; API runtime flags were explicitly set false and credentials directory was nonexistent. The current post-smoke database transaction was read-only. No worker was started. No new source GET, model/provider request, attachment download, OCR, scheduler run, or production DB operation was made by QA. This does not claim that every environment variable in unrelated processes was globally false; runtime flags for the fresh test and preview invocation were set/verified separately.

## RISKS

- Gate 2 still lacks complete per-bureau mapping and source-level evidence for details, authoritative dates, body facts, history/window, pagination and cross-period stability. Prior dispatch/hop-unknown batches remain unknown; new static observations do not retroactively prove them.
- Beijing's date/title discrepancy remains a concrete source risk. The configuration proposal is disabled and its two-stage collector/database path remains untested.
- S1 protects attachment-pending articles but does not parse attachments or establish OCR. It must not turn pending body content into `ok`, automatic selection, or publication; manual exact boolean selection remains a separate explicit override.
- The daily check and 90-day first-import values have not been applied to production source rows or observed running. No provider configuration exists for P4.
- Local green and CI green certify software checks only. Gate 2, P4, P5 calibration, P6 general 25–35 source expansion, P7/Gate 4 and deployment are not complete.

## BLOCKERS

Gate 2 remains `NOT_PASSED`; source details and cross-period evidence remain incomplete. The next code task is disabled configuration and saved-fixture/integration coverage for Fujian/Beijing/Shanghai, especially Beijing's two-stage identity path. P4 provider config/credentials are still absent; the P5 draft has zero human-confirmed labels.

## NEXT

With run 37163791233 confirmed successful, commit/push this docs-only checkpoint separately. Continue with the authorized three-source disabled configuration and saved-fixture integration tests, including Beijing's detail-metadata/queued-extraction sequence. Any new page fetch still requires a separately approved bounded budget. Do not enable sources, run a collector/worker, send data to a model, or declare Gate 2 passed without the required evidence and review.

**TASK**: QA and document the S1 Gate 2 remediation plus three batches of bounded regional evidence, preserving the unpassed Gate 2 boundary.

**MODEL**: Luna High QA; no project model calls. Full-suite model gates used only per-test localhost fakes with real credentials/config cleared.

**FILES_CHANGED**: Code/test commit `dd3835460d4f6d180209acbe0a48e4b142ea7ac0` as listed above. Documentation-only commit contains `STATUS.md`, `SOURCE_MATRIX.md`, `REGIONAL_BUREAU_COVERAGE_MATRIX.md`, `PROJECT_PLAN.md`, `P4_P7_EXECUTION_PLAN.md`, `GATE2_ACTION_CHECKLIST.md`, `HANDOFFS/README.md`, this checkpoint, and owned regional/S1 reports. The exact latest docs HEAD is reported separately from the CI-tested code SHA.

**RESULT**: S1 implementation passed final local fresh software regression and CI run 37163791233. Gate 2 remains not passed. Preview sample content/revision remained unchanged through read-only checks and GET smoke; production source rows were not changed by QA.

**RISKS**: See the risks above; do not interpret a successful CI run, disabled-source config, list candidate, pure helper or local test as source acceptance or Gate completion.

**BLOCKERS**: Regional per-source evidence and disabled-config integration remain incomplete; P4 provider config and P5 human Gold labels are missing.

**NEXT**: Commit docs separately, then implement the three disabled regional source fixtures and Beijing two-stage integration tests. Keep source enablement, model calls, workers, and Gate 2 completion outside this handoff.
