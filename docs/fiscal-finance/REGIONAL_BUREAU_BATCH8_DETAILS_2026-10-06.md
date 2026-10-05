# Batch 8 regional bureau first-detail observations (2026-10-06)

## TASK
From the QA-verified Batch 8 saved lists, inspect only the first current-page same-host HTML article URL for 贵州、云南、陕西. The batch's successful three list sources were in scope; 甘肃's prior homepage timeout was expressly left stopped and was not retried.

## MODEL
Luna High. No model, collector, worker, or database activity. Three exact detail GETs used P3 guarded fetch and the pinned Undici 8.11.2 dispatcher budget.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-detail-followup-20261006/batch8/` (request preflight, one-shot marker, manifest, and three HTML raws), plus ignored offline review tooling under `.data/fiscal-qa/regional-detail-followup-20261006/`.
- No tracked source, test, fixture, shared matrix, or Git index changes.

## TESTS_RUN
- Runner preflight reparsed each QA-verified saved list raw and matched its byte length/SHA-256 to the list-batch manifest. Each exact URL was the first same-host `.htm` candidate and matched the saved title/date.
- Offline raw review verified all three detail response byte lengths and SHA-256 values against this detail manifest.
- Undici 8.11.2 budget: attempted/dispatched/rejected = 3/3/0; `request:create`/`sendHeaders`/`headers`/`error` = 3/3/3/0. All responses were HTTP 200 at the exact requested URLs.

## RESULT
All three saved pages expose `h2.title_con` at `div.mainboxerji > div.box_content > h2.title_con` and `.my_doccontent` at `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`. Character counts below remove nested `style`, `script`, and `noscript` text. Dates and title differences are recorded as observed; no date authority or time semantics are inferred.

| Bureau | List date and title | Exact detail URL | `PubDate` / visible date / URL date | Body / paragraphs | Attachments | Brief content readout |
|---|---|---|---|---:|---:|---|
| 贵州 | 2026-09-23 — 财政部贵州监管局：打造“1+5”模式 推动机关文化建设提质增效 | https://gz.mof.gov.cn/caizhengjiancha/202609/t20260923_3998000.htm | 2026-09-23 10:55:00 / 2026年09月23日 / 20260923 | 2,086 chars / 8 `<p>` | 0 linked files | Substantial account of bureau culture, staff learning, internal systems, and activities. It mentions supporting fiscal-supervision work but is mainly organizational/culture content. |
| 云南 | 2026-09-18 — 财政部云南监管局：下好“三步棋” 织密财政收入监管“一张网” | https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997724.htm | 2026-09-24 08:22:00 / 2026年09月24日 / 20260918 | 1,686 chars / 9 `<p>` | 0 linked files | Detailed fiscal-revenue oversight work, including procedures, data analysis, anomaly checks, and local tax-source research. The list title has a space after “三步棋”; the parsed page heading and `ArticleTitle` do not. |
| 陕西 | 2026-09-30 — 财政部陕西监管局开展中秋、国庆 “双节”廉洁、安全提醒 | https://sx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998367.htm | 2026-09-30 09:45:00 / 2026年09月30日 / 20260930 | 899 chars / 8 `<p>` | 0 linked files | Internal holiday integrity and safety notice describing leadership responsibility, reminders, and discipline controls. |

For Guizhou and Shaanxi, the list date, metadata publication day, visible date, and URL date day agree. For Yunnan, the list display date and URL path are 2026-09-18, while both `PubDate` and visible “发布日期” are 2026-09-24. This mismatch is left unresolved. The Yunnan page body opens with `2026年9月24日 来源：财政部云南监管局`; the exact selected list row is still the first item from the saved list and was not replaced.

Page `<title>`, `ArticleTitle` metadata, and `h2.title_con` agree for Guizhou and Shaanxi. For Yunnan, the page title, metadata, and heading omit the one space present in the saved list title. Each returned page also includes the unrelated static site-chrome date “2017年11月21日 星期二” at `div.nav > p`. The pages show “返回主站” and “首页” navigation; no previous/next article or pagination link was observed in the captured labels. No document/PDF links were present, and no attachment URL was requested.

Raw evidence:

- 贵州 — `gz-detail.html`, 22,093 bytes; SHA-256 `2aee1d74ab26443774ec86600c099121810a8ffb75c22a0b5a4be3f6672a81cc`.
- 云南 — `yn-detail.html`, 18,996 bytes; SHA-256 `92b01a08ff1851749221f454470d8959665be0631f49f99c5e6c4df28b211aaa`.
- 陕西 — `sx-detail.html`, 17,076 bytes; SHA-256 `af4361f446c22029dac40c47e1c98c378e9e19da082400efab817ae18f4940ba`.

## RISKS
One item per bureau cannot establish source-wide selector stability, complete body extraction, history/pagination, or recurring behavior. Yunnan has a concrete list/detail date-day mismatch, and its title differs by one space. Guizhou and Shaanxi examples are chiefly organizational notices; these sample observations do not set a source filter or acceptance result.

## BLOCKERS
No blocker to the bounded static-detail check. Yunnan date/title differences and broader source behavior remain unresolved.

## NEXT
QA can verify this group's list evidence, request budget, and raw hashes offline. Continue with the next separately capped group. These observations do not constitute a source pass or Gate 2 approval.

Evidence directory: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-detail-followup-20261006\batch8\`.
