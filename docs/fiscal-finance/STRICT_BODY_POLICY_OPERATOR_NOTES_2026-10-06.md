# Strict Body Policy Operator Notes — 2026-10-06

## Purpose and status

This note records the operator boundary for the implemented S4 strict body-ready policy on the Fujian supervision source. It is not a source acceptance result, a Gate 2 pass, or authorization to enable collection, model calls, or publication. The source remains disabled and both full-text flags remain off. Focused and full local QA passed; the combined code SHA also passed CI.

The approved scope is source-specific: only `mof-fujian-supervision-dynamics` may opt in during this S4 change. Absent or false strict-policy configuration must retain legacy behavior for every other source, including legacy RSS summaries.

## Two independent controls

The body-ready policy is a processing and selected-release guard. For an opted-in source, automatic analysis and selected release wait until `body_status` is exactly `ok` and `body_text.trim()` is nonempty. Safe summary-pool and detail reads remain available with the hold state; excerpts, titles, prior analyses, overrides, and translations do not establish body readiness.

`site_fulltext` is a separate display/licensing permission. A ready body does not grant permission to expose its full text. Fujian's `site_fulltext` and `syndicate_fulltext` stay `false`; the existing summary and original-link behavior remains. The strict guard must not become a global RSS or summary-only restriction.

The strict Boolean key is `_aihot.requireBodyReadyForAutomaticSelection`. The runtime accepts only JSON boolean `true`; absent, false, and non-boolean values retain legacy behavior, and source config validation rejects non-boolean values. The body-ready condition is `body_status === "ok"` with a JavaScript-trimmed nonempty `body_text`. The SQL projection uses an exact JSONB boolean comparison and matching ECMAScript whitespace characters. Fujian is the only source opted in by the current industry JSON. Operators must not infer that a committed JSON value has updated an already-imported source row.

## Manual selection

The approved exception is an explicit editorial selection represented by the exact JSON Boolean `selected: true`, subject to existing eligibility, tier, visibility, and release rules. It is manual publication only: it must not invoke a model, create an analysis, or change the body's readiness. It also does not bypass an attachment marker, enable site full text, or authorize redistribution. A body hold remains visible as a safe summary/hold state even if an editor manually selects the item.

The override is stored as `editorial_overrides.fields.selected`. The source edit route is the trusted admin `PATCH /api/admin/sources/:id` route; its body carries a `patch` object and optimistic `version`, and the supported source patch field is `config`. Do not substitute a title, summary, score, relevance, string `"true"`, or another override for the explicit Boolean selection.

## Config files, existing databases, and republication

`industry/sources.json` is a seed input. `scripts/seed.ts` validates a source config and inserts sources with `ON CONFLICT (id) DO NOTHING`; it deliberately preserves an existing row and its admin edits. Therefore changing JSON alone does not change a source already present in a database. This note authorizes no automatic import, backfill, or edit to any historical or isolated database.

When an existing source's strict opt-in is changed, update the effective database row through the trusted admin route above, using its current version token. `updateSource` validates the config and, when the effective strict opt-in changes, queues the existing `publication.republish-source` job. Current public reads apply the source's live config immediately; the queued republication re-derives publications and appends a real withdrawal (`remove`) for an item that was previously selected. A stale upsert hidden only in a new response is insufficient for clients that already advanced their sync cursor. `sourceDetail` includes the `republish` readout backed by `republish.source:<sourceId>` settings; the publication worker reports queued/running/done progress there. Do not edit the source row by direct SQL or treat the industry JSON commit as an applied database change.

The source's live config and current article body state must govern current public projections. Snapshot and change exports must preserve existing cursor, watermark, pagination, and default/minimal field behavior while preventing stale selected payloads from remaining visible. Historical ledger rows are not rewritten; a real new removal event is required when republication withdraws an item.

## Safe operator interpretation

- Missing/false strict flag means existing behavior. Preserve legacy RSS and summary-only flows.
- Only Fujian is approved for the strict opt-in in this S4 scope.
- Strict readiness and full-text permission are separate settings; keep both Fujian full-text flags false.
- Manual selection is editorial, exact-Boolean selection only. It does not call a model or repair the body.
- A JSON edit is not an existing-database update. A trusted admin change and completed republication are separate operational evidence.
- This policy does not establish that Fujian's observed article is valid, that extraction succeeds, or that Gate 2 has passed.

## Operational checks still required

Before an operator applies a configuration change, confirm and record:

1. Verify the effective source row shows the exact boolean key, `enabled=false`, `site_fulltext=false`, and `syndicate_fulltext=false` through trusted admin readout.
2. After an authorized admin change, follow its `republish` status until done and verify a previously selected held item generated a new `remove` visible from a cursor saved before the transition.
3. Keep source collection and model-call switches off during this S4 verification. A passing focused regression does not authorize provider calls or production rollout.
4. Preserve ordinary false/absent-source RSS summary behavior and the existing selected-sync cursor, watermark, pagination, and default/minimal field contracts.

No source enablement, model/API call, collection, production database operation, or rollout is authorized by this note. Gate 2 and source acceptance remain separate decisions.
