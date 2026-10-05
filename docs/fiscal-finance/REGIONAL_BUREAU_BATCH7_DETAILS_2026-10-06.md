# Batch 7 regional bureau first-detail observations (2026-10-06)

## TASK
From the QA-verified Batch 7 saved lists, inspect only the first current-page same-host HTML article URL for 大连、宁波、青岛、深圳. One direct GET per bureau; no replacement candidate, retry, or attachment request.

## MODEL
Luna High. No model, collector, worker, or database activity. Four exact detail GET attempts used P3 guarded fetch and the pinned Undici 8.11.2 dispatcher budget.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-detail-followup-20261006/batch7/` (request preflight, one-shot marker, manifest, and three HTML raws). Qingdao timed out before an HTML response, so there is no raw for that URL.
- No tracked source, test, fixture, shared matrix, or Git index changes.

## TESTS_RUN
- Batch runner preflight reparsed the saved QA-verified list raws and checked bytes/SHA-256 against the batch-7 manifest. Each requested URL was the first same-host `.htm` candidate and matched the listed title/date.
- Offline raw review verified all three saved detail raw byte lengths and SHA-256 values against the detail manifest.
- Undici 8.11.2 budget: attempted/dispatched/rejected = 4/4/0; `request:create`/`sendHeaders`/`headers`/`error` = 4/4/3/1. Dalian, Ningbo, and Shenzhen returned HTTP 200 at their exact URLs. Qingdao hit the single 20-second timeout; no retry or replacement was made.

## RESULT
The three saved pages show `h2.title_con` at `div.mainboxerji > div.box_content > h2.title_con` and `.my_doccontent` at `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`. The metadata `PubDate` day, visible `发布日期`, list date, and URL `tYYYYMMDD` day agree in each returned sample. Readable lengths remove nested `style`, `script`, and `noscript` before counting. No time semantics are inferred.

| Bureau | List date and title | Exact detail URL | `PubDate` / visible date / URL date | Body / paragraphs | Attachments | Brief content readout |
|---|---|---|---|---:|---:|---|
| 大连 | 2026-09-30 — 财政部大连监管局开展节前警示教育 筑牢廉洁过节防线 | https://dl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998449.htm | 2026-09-30 14:33:00 / 2026年09月30日 / 20260930 | 296 chars / 3 `<p>` | 0 linked files | Short internal holiday integrity education and case-based reminders for staff. |
| 宁波 | 2026-09-30 — 财政部宁波监管局：参加宁波市直机关工委理论宣讲活动 | https://nb.mof.gov.cn/caizhengjiancha/202609/t20260930_3998450.htm | 2026-09-30 14:31:00 / 2026年09月30日 / 20260930 | 386 chars / 3 `<p>` | 0 linked files | Internal civic-party learning and youth presentation, with a stated aim to connect party work and fiscal-supervision duties. |
| 青岛 | 2026-09-30 — 情暖中秋树新风 清风润家促文明 ——财政部青岛监管局开展“我们的节日·中秋”系列活动 | https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998487.htm | No detail response; list date 2026-09-30; URL day 20260930 | Not observed | Not observed | Detail GET timed out; no content judgment is possible. |
| 深圳 | 2026-09-29 — 深圳监管局：监管三处专题学习《中华人民共和国注册会计师法》 | https://sz.mof.gov.cn/caizhengjiancha/202609/t20260929_3998295.htm | 2026-09-29 10:42:00 / 2026年09月29日 / 20260929 | 301 chars / 2 `<p>` | 0 linked files | Short internal legal-study note about the revised CPA law and intended regulatory application; no enforcement result is reported. The `<title>` and `ArticleTitle` metadata contain a literal `<br>` string, while the heading text matches the list title after HTML parsing. |

Dalian, Ningbo, and Shenzhen pages show “返回主站” and “首页” links. No previous/next article or pagination link was observed in the captured link labels. Their page chrome also contains the unrelated static date “2017年11月21日 星期二” under `div.nav > p`, separate from the article publication date. No attachment links were present and no attachment URL was requested.

Raw evidence:

- 大连 — `dl-detail.html`, 14,465 bytes; SHA-256 `2df82ec54999061f52a0fde866f087006b01ea43ee28c68d43b5ebd7fec9b249`.
- 宁波 — `nb-detail.html`, 14,725 bytes; SHA-256 `d687469959007558dab2a3fbcb264ef5fb3f09247ff1a6402fe95a6c863cf15f`.
- 青岛 — no HTML raw; the exact request timed out after 20 seconds, recorded as `TimeoutError[23]`.
- 深圳 — `sz-detail.html`, 13,588 bytes; SHA-256 `6c7658e54c72722c485a8e4b9a1412034d9bdbe01699ef33b6df7c2f201ef016`.

## RISKS
This is one first-page item per bureau. It does not establish selector stability, body completeness, date authority, history/pagination coverage, or recurring behavior. Three returned examples are short internal activity or legal-study pieces; these observations do not imply a bureau-wide classifier or source downgrade. Qingdao remains unobserved at the detail level due to timeout.

## BLOCKERS
The Qingdao target did not respond within its single 20-second request allowance. The request budget is spent; this check does not retry it or switch candidates.

## NEXT
QA can verify the manifest and three raw hashes offline. Continue to the next separately capped group using only its saved, QA-verified list evidence. This group is not a source pass or Gate 2 approval.

Evidence directory: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-detail-followup-20261006\batch7\`.
