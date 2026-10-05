# Strict Body Policy Operator Notes — 2026-10-06

## Purpose and status

This note records the operator boundary for the approved S4 strict body-ready policy on the Fujian supervision source. It is not a source acceptance result, a Gate 2 pass, or authorization to enable collection, model calls, or publication. The source remains disabled and both full-text flags remain off. The implementation is in progress; the exact admin field/update path, final key contract, and operational verification steps must be confirmed against B's codefreeze before anyone applies a database-side change.

The approved scope is source-specific: only `mof-fujian-supervision-dynamics` may opt in during this S4 change. Absent or false strict-policy configuration must retain legacy behavior for every other source, including legacy RSS summaries.

## Two independent controls

The body-ready policy is a processing and selection guard. For an opted-in source, automatic selection/publication must wait until `body_status` is exactly `ok` and `body_text.trim()` is nonempty. Excerpts, titles, prior analyses, overrides, and translations do not establish body readiness.

`site_fulltext` is a separate display/licensing permission. A ready body does not grant permission to expose its full text. Fujian's `site_fulltext` and `syndicate_fulltext` stay `false`; the existing summary and original-link behavior remains. The strict guard must not become a global RSS or summary-only restriction.

The S4 scope review proposed `_aihot.requireBodyReadyForAutomaticSelection` as the strict Boolean key. The current working tree contains this candidate key in the Fujian source JSON, config validation, and `body-readiness.ts`; B must confirm the final contract at codefreeze. Operators must not infer that a committed JSON value has updated an already-imported source row.

## Manual selection

The approved exception is an explicit editorial selection represented by the exact JSON Boolean `selected: true`, subject to existing eligibility, tier, visibility, and release rules. It is manual publication only: it must not invoke a model, create an analysis, or change the body's readiness. It also does not bypass an attachment marker, enable site full text, or authorize redistribution. A body hold remains visible as a safe summary/hold state even if an editor manually selects the item.

The exact current admin representation and supported edit surface remain pending B's frozen implementation review. Do not substitute a title, summary, score, relevance, string `"true"`, or another override for the explicit Boolean selection.

## Config files, existing databases, and republication

`industry/sources.json` is a seed input. `scripts/seed.ts` validates a source config and inserts sources with `ON CONFLICT (id) DO NOTHING`; it deliberately preserves an existing row and its admin edits. Therefore changing JSON alone does not change a source already present in a database. This note authorizes no automatic import, backfill, or edit to any historical or isolated database.

When an existing source's strict opt-in is changed, the effective database row must be changed through the actual trusted admin mechanism confirmed by B. That effective change must immediately affect current public reads and use the existing source republication pathway to append a real withdrawal (`remove`) for an item that was previously selected. A stale upsert hidden only in a new response is insufficient for clients that already advanced their sync cursor. Do not invent or use a CLI command, admin endpoint, or direct SQL procedure; record the supported path only after B confirms it.

The source's live config and current article body state must govern current public projections. Snapshot and change exports must preserve existing cursor, watermark, pagination, and default/minimal field behavior while preventing stale selected payloads from remaining visible. Historical ledger rows are not rewritten; a real new removal event is required when republication withdraws an item.

## Safe operator interpretation

- Missing/false strict flag means existing behavior. Preserve legacy RSS and summary-only flows.
- Only Fujian is approved for the strict opt-in in this S4 scope.
- Strict readiness and full-text permission are separate settings; keep both Fujian full-text flags false.
- Manual selection is editorial, exact-Boolean selection only. It does not call a model or repair the body.
- A JSON edit is not an existing-database update. A trusted admin change and completed republication are separate operational evidence.
- This policy does not establish that Fujian's observed article is valid, that extraction succeeds, or that Gate 2 has passed.

## Pending confirmation after B codefreeze

Before treating this note as an operational runbook, confirm and record:

1. The final config key and exact source-row representation/default behavior.
2. The actual trusted admin edit surface and field names; do not assume a public API route or CLI.
3. How the opt-in transition triggers the existing `republish-source` job and how completion is observed.
4. That current list/detail/RSS/MCP/API projections and both selected-sync export modes honor the current strict hold, with an old cursor receiving an actual `remove`.
5. That exact-Boolean manual selection stays model-free, retains safe body/reason behavior, and does not grant full text.
6. Focused verification results for missing/false/true configuration, legacy RSS/summary behavior, pending/unconfirmed/none/ok-empty/ok-nonempty bodies, config transition, current-public reads, and export cursor behavior.

Until those items are confirmed, this document is an operator scope note only. No configuration import, admin update, database write, model/API call, collection, network request, or worker run is authorized by it.
