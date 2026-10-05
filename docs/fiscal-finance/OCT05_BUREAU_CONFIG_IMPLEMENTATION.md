# Regional bureau disabled configurations and parser fixtures (2026-10-05)

## TASK
Add disabled first-party `web_list` entries for the Fujian, Beijing, and Shanghai Ministry of Finance regional supervision bureaus' observed “工作动态” columns. Add compact saved-DOM fixtures and config/list-parser coverage, updating the existing industry-source count assertion from 12 to 15 without changing the prior sources' checks.

## MODEL
Luna High implementation. Configuration values are based on the saved 2026-10-04 public homepage/list/detail observations and the offline compatibility report. No network, collector, worker, database import, model call, or source enablement was used.

## FILES_CHANGED
- `industry/sources.json`: added `mof-fujian-supervision-dynamics`, `mof-beijing-supervision-dynamics`, and `mof-shanghai-supervision-dynamics`; each is T1, first-party, 1440-minute target, strict 90-day first import, disabled, and has both full-text flags off.
- `tests/source-rules.test.ts`: changed the expected industry source count to 15. Existing assertions for interval, exact first-import flags, disabled state, and both full-text flags remain in place for every source.
- `tests/regional-bureau-config.test.ts`: added fixture-backed source configuration, list parser, and fake-fetch detail metadata assertions.
- `tests/fixtures/regional-bureaus/`: added three compact observed list rows and three detail DOM shells with observed public titles/dates. Article body text is synthetic and visibly marked; the saved article prose is not included.

## TESTS_RUN
- `node --test tests/regional-bureau-config.test.ts`: **1/1 passed**. All listing parsing and detail metadata fetches used local fixtures/fake fetchers.
- `node --test tests/source-rules.test.ts`: **12/12 passed** on fresh local `fiscalhot_oct05_sources_test` after all 35 migrations; environment explicitly set `COLLECT_ENABLED=false` and `MODEL_CALLS_ENABLED=false`.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `tests/regional-bureau-integration.test.ts` is run by its owner against a fresh local `_test` database; result is pending that handoff.

## RESULT
Configuration only expresses the selectors and metadata observed in one saved page per bureau. The Beijing detail rules use authoritative title/date metadata because its detail title omits the list title's “财政部” prefix and its publication date differs from the list date by six days. The first detail body identity result remains `identity_missing`; the config does not convert that first attempt into body success. Configuring the three sources does not accept them as stable sources or complete Gate 2.

## RISKS
Single-time list/detail fixtures do not prove selector stability, pagination, historic window behavior, body business quality, noise level, or long-term freshness. The detail metadata regex assumes the observed double-quoted meta attribute order remains stable. Beijing's two-stage database/collector/extraction path is covered separately by the integration test owner and must pass before this is considered software-validated.

## BLOCKERS
Gate 2 remains `NOT_PASSED`; all three new sources remain disabled and no production/source database rows were imported.

## NEXT
Record the database-backed source-rules and regional integration test results after their fresh `_test` run. Keep source acceptance and Gate 2 as open review items.
