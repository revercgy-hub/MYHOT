# Batch 5 regional bureau source config implementation (2026-10-06)

## TASK
Add four disabled first-party Ministry of Finance regional-bureau `web_list` configs for Henan, Hubei, Hunan, and Guangdong, based on the saved batch-5 list observations and one static detail sample per bureau. Keep the prior fifteen source definitions intact.

## MODEL
Luna High. No network, collector, worker, database import, or model calls were used in this implementation.

## FILES_CHANGED
- `industry/sources.json`: added `mof-henan-supervision-dynamics`, `mof-hubei-supervision-dynamics`, `mof-hunan-supervision-dynamics`, and `mof-guangdong-supervision-dynamics`. All are T1, first-party, owned by `mof`, editorial, 1440-minute interval, disabled, and have both full-text flags off. Each uses a three-month initial window with strict publication-date requirement.
- `tests/source-rules.test.ts`: updated the existing total-source assertion from 15 to 19; its disabled/full-text/default flag assertions remain unchanged.
- `tests/regional-bureau-config.test.ts`: extended the real `fromHtml`/`fetchDetail` parser contract checks to the four new configs, exact list URLs, metadata selectors, dates, and safe flags.
- `tests/fixtures/regional-bureaus/{henan,hubei,hunan,guangdong}-{list,detail}.html`: added compact observed DOM shapes with one identified list row and a short explicitly synthetic body. No official article body was copied.
- `docs/fiscal-finance/REGIONAL_BUREAU_BATCH5_CONFIG_IMPLEMENTATION_2026-10-06.md`: this implementation record.

## TESTS_RUN
- `node --test tests/regional-bureau-config.test.ts` — passed (1 test).
- `npm run typecheck` — passed after adding the optional `owner_entity_id` field to the test’s parsed source shape.
- `tests/source-rules.test.ts` was not run separately because it is database-backed; QA owns the fresh full-suite run.

## RESULT
The four list parsers return the saved article URL, title, and publication day through the configured list selectors, while the saved fixture’s listing-self and out-of-prefix navigation links are rejected. The four detail fixtures exercise the observed `h2.title_con` title selector and `PubDate` regex; the config records `.my_doccontent` as the observed body selector. The configs pass `unsupportedConfig("web_list", config)` and retain disabled, no-full-text defaults.

The list dates, `PubDate` calendar dates, visible publication dates, and URL date components agreed for the four selected samples. The existing collector treats `publishedAtAuthoritative: true` as an instruction to clear the list date, fetch a detail date, and use only that rule's value. Since the samples show no list/detail conflict, the new configs retain the metadata regex but omit that override flag; they also record the observed detail heading selector without marking it authoritative. Beijing's existing authoritative flags and discrepancy handling are unchanged.

## RISKS
These are configuration proposals supported by one selected list row and one static detail page per bureau. The fixtures verify parser behavior and shape, not selector stability, content completeness, list coverage, content quality over time, or source acceptance. In particular, the Hubei and Hunan details were short internal-news examples; those observations do not imply a bureau-wide noise rule or lower body threshold.

## BLOCKERS
None for this configuration/test change. Full database-backed QA and broader source acceptance remain pending.

## NEXT
QA can run the fresh full suite, build, web tests, and smoke checks, then commit the reviewed code change. These disabled configs do not constitute a source pass or Gate 2 approval.
