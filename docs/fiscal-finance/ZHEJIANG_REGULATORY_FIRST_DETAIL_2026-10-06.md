# Zhejiang regulatory-work first detail observation (2026-10-06)

## TASK
From the saved and QA-verified Zhejiang `监管工作` list, inspect only its first current-page same-host HTML article URL. One exact direct GET, capped at 20 seconds and 6 MiB with zero redirects/retries; no attachment or other-page requests.

## MODEL
Luna High. No model, collector, worker, or database activity. One detail GET used P3 guarded fetch and the pinned Undici 8.11.2 dispatcher budget.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-detail-followup-20261006/zhejiang/` (request preflight, one-shot marker, manifest, and saved detail HTML), plus ignored offline review tooling under `.data/fiscal-qa/regional-detail-followup-20261006/`.
- No tracked source, test, fixture, shared matrix, or Git index changes.

## TESTS_RUN
- Offline preflight verified the saved `监管工作` list raw byte count/SHA-256 against its existing manifest, then reparsed the first `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li > a[href]` entry. Its href, title, and adjacent date matched the exact requested URL/title/date below.
- Offline detail-raw review verified its byte length and SHA-256 against the new manifest.
- Undici 8.11.2 budget: attempted/dispatched/rejected = 1/1/0; `request:create`/`sendHeaders`/`headers`/`error` = 1/1/1/0. Response was HTTP 200 at the exact requested URL.

## RESULT
The selected first list row was “浙江监管局：协同推进 建立预算执行常态化监督联合工作机制”, list date 2026-09-30, href `./202609/t20260930_3998386.htm`, resolved against the saved list URL to `https://zj.mof.gov.cn/caizhengjiancha/202609/t20260930_3998386.htm`.

The detail page `<title>`, `ArticleTitle` metadata, and `h2.title_con` at `div.mainboxerji > div.box_content > h2.title_con` all match the list title. `PubDate` is `2026-09-30 11:13:00`; visible publication date is `发布日期：2026年09月30日`; URL date is `20260930`. These day values agree, without inferring timestamp semantics.

The body is `.my_doccontent` at `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`; after removing nested `style`, `script`, and `noscript`, it contains 666 readable characters in four paragraphs. The short, substantive item describes a Zhejiang Finance Department / regulatory bureau joint budget-execution supervision mechanism, a personnel pool for field verification, data-sharing and risk-line monitoring, and ongoing case discussion and rectification coordination. No document/PDF links were present. The page exposes “返回主站” and “首页”; no previous/next article or pagination link was observed among its captured labels. The unrelated static chrome date “2017年11月21日 星期二” at `div.nav > p` is distinct from the article publication date.

Raw response: `zj-detail.html`, 16,103 bytes; SHA-256 `f5d4451b3b9863e0c484701fccfaa259d4dd078a835d75de06f3b57d986a60da`.

## RISKS
This is one article from the first page of a 9-item observed list. It is evidence for a plausible fiscal-regulatory business-news candidate, not proof of the full category scope, historical window, pagination, recurring behavior, selector stability, or source acceptance. Other saved rows show list-date/URL-date discrepancies that this selected item does not resolve.

## BLOCKERS
None for this one-request static check. Broader section coverage, time-window behavior, and recurring stability remain unknown.

## NEXT
QA can verify the prior saved homepage/list chain and this detail's manifest/raw hash offline. Keep the source disabled and Gate 2 open until the broader acceptance criteria are satisfied.

Evidence directory: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-detail-followup-20261006\zhejiang\`.
