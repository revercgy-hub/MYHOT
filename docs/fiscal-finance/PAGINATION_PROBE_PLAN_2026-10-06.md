# Pagination Probe Plan — 2026-10-06

## TASK

Offline plan for a smallest possible second-list-page observation. No website was requested, no database was opened, and no collector, worker, model, or source configuration was changed. The plan is evidence-bounded and awaits a separate Lead request authorization before any GET.

## MODEL

Luna High A; local evidence review only.

## FILES_CHANGED

New report: `docs/fiscal-finance/PAGINATION_PROBE_PLAN_2026-10-06.md`.

## TESTS_RUN

No software tests or network requests. Read saved collector reports/manifests and the four Batch 6 homepage/list HTML files; inspected `docs/sources.md`, `packages/backend/src/sources/web-list.ts`, and `packages/backend/src/sources/collect.ts`.

## RESULT

### Exact second-page candidates supported by saved Batch 6 JavaScript

Each saved list HTML contains inline pagination code with `currentPage = 0`, a per-page `countPage`, and `nextPage = currentPage + 1`. The `>` link is emitted as `href="index" + "_" + nextPage + "." + "htm"`; the page-number controls use the same zero-based filename formula. The `toPage()` function derives its directory from the current page URL through the last slash and appends `index_<one-based-input-minus-one>.htm`. Since each saved list URL ends in `/`, the evidence supports these exact direct-GET candidates for the next page:

| Bureau | Saved page-1 URL | Observed countPage | JS-derived page-2 target |
|---|---|---:|---|
| Guangxi | `https://gx.mof.gov.cn/gzdt/caizhengjiancha/` | 15 | `https://gx.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm` |
| Hainan | `https://hq.mof.gov.cn/caizhengjiancha/` | 15 | `https://hq.mof.gov.cn/caizhengjiancha/index_1.htm` |
| Chongqing | `https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/` | 45 | `https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/index_1.htm` |
| Sichuan | `https://sc.mof.gov.cn/caizhengjiancha/` | 11 | `https://sc.mof.gov.cn/caizhengjiancha/index_1.htm` |

These are derived targets, not fetched pages. The raw HTML creates pager anchors with `document.write`; the reported file name comes from the saved inline JavaScript, not from a pre-rendered anchor captured by the static parser. Page 1 had 10 candidates per bureau. Its observed date/path disagreements are already recorded in the Batch 6 report; page 2 must be checked for the same class of mismatch without treating URL date tokens as authoritative.

### Beijing, Fujian, and Shanghai evidence gap

The real collector reports preserve each exact page-1 path and request events, but their ignored evidence directories do not contain the page-1 source HTML. Beijing also records first-run response hashes as unknown; Fujian and Shanghai record hashes but not the HTML bytes or pager script. Therefore no exact page-2 target or paging formula is established for those three sources. Do not infer `index_1.htm`, apply the Batch 6 formula to them, or spend a page-2 request against a guessed URL. Recovering their actual pager evidence would first require a separately authorized one-page GET; a later page-2 GET would need its own separately authorized budget.

### Current collector behavior

`fetchWebList()` reads only `source.config.url`, then parses that one response. `collectSource()` calls it once for a `web_list` source; configured `detail.maxFetches` separately bounds article-detail reads and does not paginate the list. No generic `web_list` next-page URL or cursor mechanism was found. Thus this proposed probe should be a single guarded direct GET per authorized source, not described as collector pagination support or 90-day coverage.

### Smallest future probe envelope, if separately authorized

- Eligible targets: only the four JS-derived Batch 6 URLs above, after local QA rechecks the saved raw HTML and corresponding manifest hashes. No Beijing/Fujian/Shanghai target is eligible until its page-1 pager source is recovered.
- One request per eligible bureau, hard total cap 4; no page-1 refetch in this plan, no details, attachments, redirects, retries, browser, or fallback.
- Before dispatch, enforce an exact fixed HTTPS host/path allowlist for the approved target and an Undici event hard-cap. Each direct GET has a 20-second timeout and 6 MiB response ceiling; any request error, redirect, over-limit response, or parser failure stops that bureau without retry or budget reassignment.
- Save the exact response bytes, SHA-256, byte count, UTC request/response times, HTTP status, redirect/retry/event counts, and a manifest entry per attempt. Keep raw HTML in ignored `.data/fiscal-qa/`; do not copy article bodies into the report.
- Offline-compare page 2 against its saved page 1: candidate count; normalized absolute article URLs and duplicates/overlap; visible title/date pairs; min/max displayed dates; any displayed-date versus URL-date disagreement; pager variables/links in the new page. Never infer missing list dates from URL paths.
- Interpret one page conservatively. A page with newer, duplicate, undated, or older-than-90-day items is an observed sample only. If page 2 still contains dates inside the intended window, additional pages are needed for a coverage claim and require new authorization; a `countPage` value alone proves neither request success nor historical completeness.

## RISKS

The Batch 6 script is consistent across four saved pages, but the generated target is unverified until fetched. Each source declares a different total page count, and only the first page has been observed. List ordering, overlap, date conflicts, historical retention, and site changes can make page 2 insufficient or stale. Prior Beijing/Fujian/Shanghai collector evidence cannot fill the missing pager-script evidence.

## BLOCKERS

A separately authorized GET budget is required before execution. Beijing/Fujian/Shanghai also lack saved page-1 HTML needed to derive their second-page targets without guessing.

## NEXT

Have Lead review this offline plan and, if desired, authorize a bounded probe for exact Batch 6 targets or separately authorize recovery of a prior source's page-1 pager evidence. No network activity is implied by this plan; Gate 2 and source acceptance remain open.
