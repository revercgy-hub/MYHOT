# Web-list Phase B metadata transport — 2026-10-06

TASK=Implement the approved direct-HTML metadata-only transport entry point.
MODEL=GPT-6 Luna High.
SCOPE=Only `packages/backend/src/sources/web-list.ts` and its independent contract test; no legacy detail/body helper edits.

`fetchWebListMetadata(url, source, need, options)` is the explicit opt-in entry point. It requires `web_list` plus `pagination.detailMode="direct_html_metadata_v1"`, a required shared run budget, and deadline callbacks. It invokes the existing config validator at call time to avoid a static import cycle. Unknown need fields and invalid/unconfigured requested rules fail before dispatch. A request is useful only when at least one requested field has a configured source rule; a requested field without a rule is reported as fixed `missing/no_configured_rule` when another requested rule is configured.

The request path is one guarded direct `GET`, bounded to 6 MiB, at most five redirect hops, and a timeout no greater than 20 seconds or the floored remaining run deadline. The target must be HTTPS, within the exact configured article directory and URL allow-list, and cannot be the listing or a numbered listing alias. `guardedFetch` validates redirect admissions through the shared budget; the final URL is revalidated and must retain the original URL identity. Only HTTP 200 with `text/html` is parsed. The extractor reads only explicitly configured title/date selector or regex rules. Dates use the source/detail UTC offset and the existing loose-date parser, then return normalized ISO instants. There is no generic metadata fallback and no call to legacy `fetchDetail`, Jina, PDF, Readability, summary, or selected-body paths.

The metadata result contains only `finalUrl`, title, and date fields with fixed `not_requested`, `found/configured_rule`, and `missing/configured_rule|no_configured_rule` variants. It does not expose the HTML or a body field. Deadline activity is checked before the request, after transport, and after parsing.

## Verification

The independent transport contract test uses a synthetic guarded-fetch seam and exercises configured title/date parsing and ISO normalization, no generic metadata fallback, fixed missing/not-requested outcomes, no-rule and invalid-config pre-dispatch rejection, timeout clamping, non-200/non-HTML rejection, final-identity validation, exact-directory target admission, and deadline checks before dispatch and after parsing.

At the latest run recorded for this transport revision, `node --experimental-strip-types --test tests/web-list-detail-metadata.test.ts` passed 10/10 (exit 0), and `npm run typecheck` passed (exit 0). Tests use synthetic responses; no official endpoint, database, collector, worker, or model was invoked. Helper/collector integration tests are owned by the Phase B collector and are tracked separately.

FILES_CHANGED=`packages/backend/src/sources/web-list.ts`, `tests/web-list-detail-metadata.test.ts`, this report.
RESULT=Transport API and its isolated synthetic contract tests pass. The separate collector/helper focused suite also passed 10/10 according to its owner; this report does not claim source approval or Gate 2 acceptance.
RISKS=The strict configured-rule contract intentionally blocks when required metadata is absent or invalid. The API does not establish source date authority or pagination completeness.
BLOCKERS=No transport or integration blocker remains in the reviewed Phase B scope; no source has been opted in.
NEXT=QA owns the final overall repository checkpoint. Real source readiness, 90-day completeness, and Gate 2 decisions remain separate.
