# Web-list pagination Phase A transport — 2026-10-06

## TASK

Add opt-in transport hooks required by the S1 bounded web-list pagination scope. Preserve the existing no-options collector path. No pagination policy, schema, collector checkpoint, source configuration, database, or shared documentation changes are part of this implementation.

## MODEL

Luna High A. Code work began from the QA docs checkpoint `9814ceb0dcdf3fc71ab647d04fd12a1997f73c5f` (S4 code baseline `b3546ab9c803b6872eb6b82d68fab8ca87da8520`). No project model/provider calls.

## FILES_CHANGED

- `packages/backend/src/lib/http-fetch.ts`: exported `GuardedFetchRunBudget` and optional `GuardedFetchOptions.runBudget`.
- `packages/backend/src/sources/web-list.ts`: optional `fetchWebList(source, { listUrl, runBudget })`; optional fourth `fromHtml(..., listingUrl)` argument.
- `tests/web-list-pagination-transport.test.ts`: loopback-only contract tests.
- `tests/web-list-pagination-policy.test.ts`: pure helper/schema and fake-clock budget policy tests.
- This implementation report.

## TESTS_RUN

- `node --check tests/web-list-pagination-transport.test.ts`: passed.
- `node --test --test-concurrency=1 tests/web-list-pagination-transport.test.ts`: 5 passed.
- `node --check tests/web-list-pagination-policy.test.ts`: passed.
- `node --test --test-concurrency=1 tests/web-list-pagination-policy.test.ts`: 5 passed.
- Combined serial focused run of both owned tests: 10 passed.
- `npx tsc -p packages/backend --noEmit`: passed.
- `npx tsc -p tests --noEmit`: passed.
- No DB, production source, external HTTP, collector, worker, or model was used. One initial focused test invocation was blocked by the repository test setup's requirement for `DATABASE_URL`; the owned transport test does not need DB and was kept free of that shared setup, then passed without a database.

## RESULT

The exported run budget has a shared optional `AbortSignal`, a synchronous `beforeDispatch({ url, method, redirectHop })` hook, and an optional `allowRedirect({ from, to, redirectHop })` predicate. `guardedFetch` validates each initial/redirect URL through the existing SSRF/DNS guard, checks a redirect predicate after that validation, and calls the admission hook immediately before each actual Undici `fetch`. A redirect's next hop is admitted separately against the same object. The run signal is combined with the existing per-request timeout, so cancellation reaches DNS wait, fetch, and body consumption. Without `runBudget`, existing fetch behavior is unchanged.

`fetchWebList(source, options?)` accepts an exact `listUrl` and the shared run budget. If no options are supplied, it still reads only `source.config.url`. When `listUrl` is supplied it becomes both the relative-link base and the current listing-page identity used to discard a link back to that page. The configured source object is not mutated. `listUrl`/budget overrides are rejected for Jina, adapters, and non-HTML parse modes; pagination helpers must call this only for their direct HTML opt-in path. This transport adds no detail/PDF/Jina request path and performs no page selection itself.

The focused loopback tests verify: one dispatch is admitted while a 302 target is denied before the second server hit; redirect policy receives the checked absolute target; a pre-aborted shared run signal prevents any dispatch; injected page URL controls relative article resolution and self-link filtering; and a legacy call still reads the configured page once. Pure policy tests verify exact pagination config bounds and incompatible combinations, canonical page numbering/identity, cross-page shared dispatch cap, committed-page redirect rejection, and a single 120-second deadline using Node's fake clock. These tests verify the helper timer/signal contract; they do not establish that a complete DB transaction pipeline fits inside or atomically observes the deadline.

## RISKS

The helper/collector must create one run budget per run and reuse it for every page. Its `beforeDispatch` callback owns the hard cap/deadline accounting; its redirect predicate must enforce that a redirect remains within the current page's permitted directory and identity. This Phase A transport does not itself establish page traversal, checkpointing, or coverage. Preview callers must pass page 0 explicitly with their own budget if they need the S1 preview cap; the unchanged no-options API remains a single configured-page read.

## BLOCKERS

None for the owned transport scope. Helper/collector and admin preview behavior remain owned and tested by their respective agents.

## NEXT

B may consume this API from the source-local pagination helper and collector. QA may pass page 0 plus an independent run budget from preview and verify its redirect constraints. Keep the 19 existing real-source configs unchanged and do not describe the transport as pagination completion or 90-day coverage.
