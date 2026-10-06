# Web-list pagination Phase A integration review — 2026-10-06

## Decision

The latest local implementation is consistent with the approved S1 Phase A boundary reviewed here. The collector, guarded transport, policy tests, and opt-in admin preview agree on bounded page identities, dispatch/deadline admission, redirect handling, and explicit incomplete coverage. No remaining integration blocker was found in this read-only pass. This is an implementation review, not a source-quality approval or Gate 2 pass.

Stage B remains unapproved, Gate 2 remains `NOT_PASSED`, and no production source was opted into pagination by this work. Preview is one page only and reports `coverage: "unproven"`.

## Contract checks

- **Opt-in and frozen configuration:** Pagination is selected only for `web_list` sources that own a `pagination` config key or already carry a saved backfill cursor. The accepted config is the fixed `mof_index_v1` shape with bounded page, dispatch, and page-index caps. The hash covers the URL, pagination and relevant parsing/filter/backfill fields. Removal or change of that config freezes the generation for review rather than falling through to legacy collection.
- **Shared run budget and request identity:** Collector pages and preview use the same run-budget factory and guarded-fetch hooks. The budget applies one deadline and dispatch cap across requests and redirect hops, requires each initial dispatch to match the current page identity, admits only same-directory canonical page redirects, and rejects a URL already dispatched in the same run. Preview rechecks the deadline after parsing. Tests use loopback/MockAgent transport; no official endpoint is contacted.
- **Page content and progress:** The collector filters the listing itself and numbered sibling pages as non-article candidates. Empty admitted identity sets and pages that are subsets of the preceding committed page are blocked; partial overlap is permitted when at least one new identity exists. Up to 60 SHA-256 identity hashes are retained for the preceding page, not raw URLs. Undated/untrusted rows block progress, while trusted rows outside the fixed cutoff are counted and excluded. The anchor and cutoff are fixed in the cursor, successful bounded runs retain `initializedAt` unset, and run details remain explicitly partial/unproven.
- **Atomic persistence and concurrency:** The source-scoped advisory lock serializes runs. Page article upserts, processing-job enqueue for created/revised rows, fetch-run checkpoint, and cursor advance occur in one transaction. Transaction work and the commit boundary recheck the shared deadline and set the remaining statement timeout. A failed pre-commit page therefore rolls back and can be replayed without advancing its cursor.
- **Preview alias consistency:** Opt-in preview shares the collector's `isWebListPaginationUrl` predicate. Its fixture includes a dated `index_1.htm?x=1#anchor` candidate alongside a real article and confirms the page alias is removed; the legacy preview fixture still checks the existing response shape and one-page behavior.

## Evidence reviewed

The implementation and tests were originally reviewed from the shared working tree at `HEAD=9814ceb` with code baseline `b3546ab`. At that review point, the combined regression was still pending. The following focused verification results were reported by their respective owners:

- Collector focused test on a fresh 35-migration test database: 1/1 passed, native process exit 0 (`resume9`).
- Pagination policy and loopback transport tests: 11/11 passed, native process exit 0; this includes the repeated-dispatch redirect case.
- Preview focused tests on a fresh 35-migration test database: 7/7 passed, native process exit 0 (`preview_alias3_test`), including query/fragment aliases and the post-parse deadline check.
- `npm run typecheck`: exit 0 after the final pagination helper export/preview predicate unification.

This section records owner-reported focused evidence; it does not claim that this reviewer reran those focused suites.

## Subsequent QA checkpoint

After the original review, a fresh Node 24 `npm test` was run on `fiscalhot_oct06_final_npm_test2_test` after 35 migrations: **276/276 passed**, native npm exit 0. Separate stdout, stderr, and exit-code evidence is in ignored `.data/test-pg/oct06_final_npm_test2.{stdout.log,stderr.log,exit.txt}`. An earlier post-freeze full run returned 276/270/6; its raw stdout/stderr were not retained. Read-only inspection of its database identified one future ledger barrier (seq 21, article `rddlzdr0lsh83smux2qt1e3x9`, source `test-publication-muw3hjba9g3kl`) from a 15 ms app-clock/database-clock race in the publication test's early-release fixture. The test now binds `grouped_at` to the app clock minus one second in both release fixtures; the fresh publication + strict-body ordered subset passed 19/19 and the repaired full suite passed.

The preview API/Web loopback smoke passed 30/30 after startup with side-effect flags off and no worker. Read-only SQL before and after showed 35 migrations, 3 disabled sample sources, 3 articles and 3 publications, and zero analyses, receipts, fetch runs, selected-ledger rows, or job runs. Typecheck passed, the Web production build passed, and Web tests passed 15/15. Code is committed as `3443f62` and `b2f479c`, pushed on `feat/fiscal-finance-hot`, and Check workflow run [37408474478](https://github.com/revercgy-hub/MYHOT/actions/runs/37408474478) passed both Check and Docker jobs for combined code SHA `b2f479c4517d040f4b1c24b14e1407ad342bbb3a`.

## Limits and remaining risks

The supported `mof_index_v1` rule derives page identity from the configured directory and canonical `index_N.htm` URLs, with same-page redirect and repeated/subset identity checks. It does **not** parse arbitrary HTML or JavaScript pager metadata such as `currentPage` or `countPage`, so generic pager-change detection and source coverage remain unproven. The bounded Phase A behavior must not be read as a complete or strict 90-day backfill guarantee. No database migration, external network access, worker/model/index execution, source opt-in, or Gate transition is part of this review.

## Files changed by this review owner

- `tests/web-list-pagination-transport.test.ts` — loopback self-redirect/revisit assertion.
- `tests/web-list-pagination-policy.test.ts` — policy expectation for rejecting a redirect to an already-dispatched URL.
- `docs/fiscal-finance/READONLY_PHASE_A_INTEGRATION_REVIEW_2026-10-06.md` — this review.
