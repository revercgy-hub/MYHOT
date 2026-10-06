# Sichuan list page 3 probe — 2026-10-06

## TASK

Use the one separately authorized GET to observe only `https://sc.mof.gov.cn/caizhengjiancha/index_2.htm`. This is a list-page evidence sample; it is not a collector run or a source acceptance decision.

## MODEL

Luna High. No model/provider calls.

## FILES_CHANGED

Tracked: this report only. Ignored evidence and one-shot runner: `.data/fiscal-qa/sichuan-history-page3-20261006/` (`run-once.mjs`, `dispatch-once.marker`, `manifest.json`, `sichuan-page3.html`). Existing Batch 6 page-1/page-2 evidence was read but not modified. Shared status/matrices, source config, code, database, and Git index were not changed by this task.

## TESTS_RUN

- `node --check .data/fiscal-qa/sichuan-history-page3-20261006/run-once.mjs`: passed before any dispatch.
- Offline preflight matched the saved Sichuan page-1 and page-2 manifest entries to their local raw-file SHA-256 hashes and confirmed the exact page-2 URL, pager variables, one-shot evidence path, and zero page-1/page-2 candidate URL overlap.
- Exactly one guarded direct HTTPS GET was made through backend-pinned Undici 8.11.2. Per-request timeout was 20 seconds, response limit 6 MiB, redirects 0, retries 0. Instrumentation recorded `attempted=1`, `dispatched=1`, `rejected=0`, one request-create, one sendHeaders, one response-headers event, no request errors, and no diagnostic callback errors.
- Offline candidate/date/URL/pager comparison was performed from the saved raw pages. No detail page, attachment, next page, collector, database, worker, or model was accessed.

## RESULT

The saved page-2 raw bytes hash to `8af972a808c7b1c3d67088d2247aae7cfac13969799d942916408ead670c41e8` (12,754 bytes), matching the Batch 6 manifest. Its inline JavaScript has `currentPage=1`, `countPage=11`, `nextPage=currentPage+1`, and emits `index_<nextPage>.htm`; this is consistent with the single authorized target `index_2.htm`.

The request returned HTTP 200, `text/html`, and the exact requested final URL. The page-3 raw response is 12,845 bytes with SHA-256 `f1d9605af9395570e789d2df775f9b660801201f5eaee7d601c247ae7af69d3a`. The ignored manifest records the request timestamps, constraints, preflight evidence, response, raw hash, parsed list candidates, pager metadata, and dispatch events.

Offline parsing found 10 unique same-host article-list URLs. There were zero URL overlaps with either the saved page 1 or page 2 candidate sets. The visible list dates span 2026-07-01 through 2026-07-27; three rows have visible-date/path-date-token disagreements. Page-3 pager metadata reads `currentPage=2`, `countPage=11`; the script formula identifies `index_3.htm` as the next link, which was not requested.

| Displayed title | Article URL | List date shown | URL path date | Difference |
|---|---|---|---|---|
| 财政部四川监管局：“三个聚焦”推进属地“一行一局一会”内控建设 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260727_3994350.htm | 2026-07-27 | 2026-07-27 | — |
| 财政部四川监管局：监管三处专题学习 《国家公园法》 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260722_3993940.htm | 2026-07-22 | 2026-07-22 | — |
| 财政部四川监管局：“涵养孝廉正气 筑牢监管防线”——监管一处赴德阳市孝泉镇开展支部党… | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260716_3993668.htm | 2026-07-16 | 2026-07-16 | — |
| 四川监管局：紧扣三个维度 做实林业草原生态保护恢复资金重点绩效评价 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260713_3993394.htm | 2026-07-16 | 2026-07-13 | visible date is 3 days later |
| 财政部四川监管局：办公室组织开展“十五五”规划纲要精神专题研讨 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260714_3993443.htm | 2026-07-14 | 2026-07-14 | — |
| 财政部四川监管局：召开川藏备案从事证券服务业务会计师事务所监管工作会议 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260710_3993298.htm | 2026-07-10 | 2026-07-10 | — |
| 财政部四川监管局：“三维发力”推动财政金融协同促内需一揽子政策走深走实 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260708_3993137.htm | 2026-07-08 | 2026-07-08 | — |
| 四川监管局：“三位一体”推进内控建设固本强基 | https://sc.mof.gov.cn/caizhengjiancha/202606/t20260630_3992547.htm | 2026-07-07 | 2026-06-30 | visible date is 7 days later |
| 财政部四川监管局：“四个坚持”扛牢监管责任 护航增值税退税政策红利精准直达 | https://sc.mof.gov.cn/caizhengjiancha/202606/t20260603_3991073.htm | 2026-07-02 | 2026-06-03 | visible date is 29 days later |
| 财政部四川监管局：四个坚持 全方位提升驻藏单位预算执行常态化监督工作质效 | https://sc.mof.gov.cn/caizhengjiancha/202607/t20260701_3992616.htm | 2026-07-01 | 2026-07-01 | — |

At the fixed 2026-10-06 anchor, a nominal 90-day window starts 2026-07-08. Some displayed dates on this sampled page precede that boundary, while other list entries disagree with the date token in their URL. This observation does not resolve which field represents original publication time and does not prove 90-day completeness. A path date must not be treated as the original publication date in place of the visible list date.

## RISKS

This is a single list-page snapshot. Displayed dates and URL path tokens disagree for three of ten candidates, so the original publication date remains unverified for those rows. No article body or metadata page was fetched. `countPage=11` and the JavaScript formula are site-provided pager signals, not proof that all pages are retrievable, stable, unique, or historically complete. No evidence here establishes cross-cycle scheduler stability.

## BLOCKERS

Historical coverage, date-field authority, article-body suitability, and scheduler stability remain unverified. This probe does not mark the source passed and does not change Gate 2; Gate 2 remains NOT_PASSED.

## NEXT

Use the saved raw HTML and manifest for offline review. Any next network request—including `index_3.htm` or article details—requires the Lead to verify and authorize the exact URL and request budget separately.

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**: One authorized Sichuan page-3 list GET and offline comparison with saved page 1/page 2.

**MODEL**: Luna High; model/provider requests: 0.

**FILES_CHANGED**: This owned report; ignored raw HTML, manifest/hash, one-shot marker, and runner under `.data/fiscal-qa/sichuan-history-page3-20261006/`. No shared matrix/status or product files.

**TESTS_RUN**: Runner syntax and offline evidence preflight passed. One request only; pinned Undici budget confirms 1/1 dispatch and HTTP 200. No retry, redirect, DB, collector, worker, detail, attachment, or model operation.

**RESULT**: 10 unique list candidates, no overlap with saved page 1/page 2, three displayed-date/path-date differences, pager `currentPage=2`, `countPage=11`, next-link formula points to `index_3.htm` (not fetched). No source pass, 90-day coverage, or Gate 2 claim.

**RISKS**: List-date authority and history/scheduler completeness remain unknown.

**BLOCKERS**: No blocker to this bounded probe; source-level acceptance remains open and Gate 2 is NOT_PASSED.

**NEXT**: Offline review only unless Lead authorizes a new exact request.
