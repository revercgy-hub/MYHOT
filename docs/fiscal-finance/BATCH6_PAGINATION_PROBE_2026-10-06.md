# Batch 6 page-2 pagination probe — 2026-10-06

## TASK

Execute the four Lead-approved, JavaScript-derived page-2 URLs for 广西、海南、重庆、四川, one direct GET per bureau (hard cap 4 total). Requests were limited to 20 seconds and 6 MiB, with redirects and retries disabled. No page-1 refetch, details, attachments, collector, database, worker, or model call was made.

## MODEL

Luna High A. Network dispatch used the backend's pinned Undici 8.11.2 through `guardedFetch` and the `p3-http-budget` admission hook.

## FILES_CHANGED

Tracked: this owned report only.

Ignored evidence and runner: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch6-pagination-20261006\` (`run.mjs`, one-shot marker, `manifest.json`, and four response HTML files). Page-1 source evidence was read from `.data/fiscal-qa/regional-batch6-20261005/` and not modified. No source configuration, implementation, shared matrix, or Git index change.

## TESTS_RUN

- `node --check .data/fiscal-qa/regional-batch6-pagination-20261006/run.mjs`: passed before dispatch.
- Local Node 24 import check for `http-fetch.ts` and `p3-http-budget.ts`: passed. An initial launch using absent root-level `tsx` exited before installing the budget or dispatching; the repository-supported Node 24 TypeScript loader was then used. No dependency was installed.
- Preflight verified each Batch 6 page-1 manifest bureau, requested URL, saved filename, HTTP 200 status, and SHA-256 against the actual local bytes. All four hashes matched.
- Offline response audit verified each saved page-2 response hash, candidate counts, date ranges, URL overlap, date disagreements, pager state, and Undici events.

## RESULT

Preflight page-1 hashes matched: 广西 `4dd601d1…f045df`, 海南 `a9963e71…cf380`, 重庆 `b18f871d…357e7207`, 四川 `b45bcd90…ecb06f`. The manifest also matched each bureau's approved page-1 URL and source-column record.

All four authorized URLs returned HTTP 200 and the exact requested final URL. The Undici budget recorded `attempted/dispatched/rejected = 4/4/0`, 12 events (`request:create=4`, `client:sendHeaders=4`, `request:headers=4`, `request:error=0`), and zero diagnostic callback errors. There were no redirects or retries. Raw response hashes match the saved bytes.

| Bureau | Exact page-2 URL | Bytes / SHA-256 | Unique candidates | Page 1 displayed dates | Page 2 displayed dates | Same-page dupes / overlap with page 1 | Pager in page-2 HTML |
|---|---|---|---:|---|---|---|---|
| 广西 | `https://gx.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm` | 12,736 / `a3efea8e…bd623e9` | 10 | 2026-09-11–2026-09-29 | 2026-08-11–2026-09-07 | 0 / 0 | `currentPage=1`, `countPage=15` |
| 海南 | `https://hq.mof.gov.cn/caizhengjiancha/index_1.htm` | 13,146 / `cd978c9d…60329` | 10 | 2026-09-11–2026-09-30 | 2026-08-17–2026-09-08 | 0 / 0 | `currentPage=1`, `countPage=15` |
| 重庆 | `https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/index_1.htm` | 12,753 / `c2c532f7…57290` | 10 | 2026-09-21–2026-09-30 | 2026-09-02–2026-09-21 | 0 / 0 | `currentPage=1`, `countPage=45` |
| 四川 | `https://sc.mof.gov.cn/caizhengjiancha/index_1.htm` | 12,754 / `8af972a8…c41e8` | 10 | 2026-09-02–2026-09-28 | 2026-07-29–2026-09-01 | 0 / 0 | `currentPage=1`, `countPage=11` |

The page-2 HTML confirms the pager state. Its scripts set `nextPage=currentPage+1` and write the next link as `index_<nextPage>.htm` relative to the current page directory. The corresponding next-page targets would therefore be `index_2.htm`; none was requested. Static HTML parsing sees the non-script “首页” anchor, while the other pager links are emitted through `document.write`.

Page-1/page-2 URL intersections are empty for all four bureaus. Each page has 10 unique same-host `.htm` candidates, with no repeated candidate within page 2. 重庆 has a displayed-date boundary tie on 2026-09-21 across the two pages, but the candidate URLs differ.

The visible list date and URL date token disagree on six page-2 candidates: 广西 1, 海南 1, 重庆 0, 四川 4. The saved page-1 candidates also show disagreements: 广西 1, 海南 1, 重庆 0, 四川 2. Examples on page 2:

- 广西 “三项举措 扎实开展城镇保障性安居工程补助资金绩效评价审核工作”: visible 2026-08-28; URL token 2026-08-12.
- 海南 “三个强化”推动预算绩效管理提质增效: visible 2026-08-31; URL token 2026-08-21.
- 四川 “深耕调研赋能监管 多措并举提升调研工作质量”: visible 2026-09-01; URL token 2026-08-04.
- 四川 “强化闭环管理 着力推动重点绩效评价整改由‘纠错’向‘治理’提升”: visible 2026-08-13; URL token 2026-08-07.
- 四川 “创新监管举措 推动农业保险保费补贴审核工作提质增效”: visible 2026-08-06; URL token 2026-07-17.
- 四川 “政治铸魂 方法赋能 常态聚力推动财税政策落地见效”: visible 2026-08-03; URL token 2026-07-03.

By displayed dates, even the oldest candidates on these four page-2 samples are newer than 2026-07-08, the start of a 90-day lookback ending 2026-10-06. This probe therefore does not establish 90-day list coverage. Pagination totals (11–45 pages) indicate more pages exist, but were not traversed.

Manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch6-pagination-20261006\manifest.json`. Raw pages: `1-广西-page2.html`, `2-海南-page2.html`, `3-重庆-page2.html`, `4-四川-page2.html` in the same ignored directory. Full hashes, request timestamps/events, all candidate title/date/URL tuples, and pager metadata are in the manifest for QA's offline verification.

## RISKS

List dates and URL date tokens disagree for multiple candidates on both observed pages. The observed pages are a small current sample; they do not show ordering or historical boundaries across all pages. `countPage` values are site-reported pager metadata and do not establish that all pages are available, unique, or in scope. No article detail was fetched to resolve the date disagreements.

## BLOCKERS

No run blocker. Broader historical coverage, resolution of the date-field semantics, and any additional page probes remain unverified and require separate authorization.

## NEXT

QA can independently verify the ignored manifest/raw hashes and the page-1/page-2 comparisons offline. Treat this as pagination evidence only; do not mark any source passed or infer 90-day coverage from the probe.
