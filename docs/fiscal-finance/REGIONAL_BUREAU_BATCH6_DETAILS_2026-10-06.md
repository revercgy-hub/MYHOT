# Batch 6 regional bureau first-detail observations (2026-10-06)

## TASK
From the QA-verified Batch 6 saved lists, inspect only the first current-page same-host HTML article URL for 广西、海南、重庆、四川. One direct GET per bureau; no follow-up pages or attachments.

## MODEL
Luna High. No model, collector, worker, or database activity. Four exact detail GETs used P3 guarded fetch and the pinned Undici 8.11.2 dispatcher budget.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-detail-followup-20261006/batch6/` (one-shot marker, request preflight, manifest, and four HTML raws), plus the ignored one-shot/review helpers under `.data/fiscal-qa/regional-detail-followup-20261006/`.
- No tracked source, test, fixture, shared matrix, or Git index changes.

## TESTS_RUN
- `node --check .data/fiscal-qa/regional-detail-followup-20261006/run-once.mjs` passed before the detail requests.
- Runner preflight reparsed each QA-verified saved list raw and checked its byte length/SHA-256 against that list batch manifest. For each bureau, the exact candidate below was the first same-host `.htm` link and matched the listed title/date.
- Offline raw review verified all four detail raw byte lengths and SHA-256 values against the detail manifest.
- Undici 8.11.2 budget: attempted/dispatched/rejected = 4/4/0; `request:create`/`sendHeaders`/`headers`/`error` = 4/4/4/0. Each response was HTTP 200 at the exact requested URL.

## RESULT
All four sampled details expose the list title in the page `<title>`, `ArticleTitle` metadata, and `h2.title_con` at `div.mainboxerji > div.box_content > h2.title_con`. Each exposes `PubDate`, visible `发布日期`, and a `tYYYYMMDD` URL date. The reviewed article body container is `.my_doccontent` at `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`; readable character counts below remove nested `style`, `script`, and `noscript` nodes before counting. Dates are reported as observations without inferring the site's timestamp semantics.

| Bureau | List date and title | Exact detail URL | `PubDate` / visible date / URL date | Body / paragraphs | Attachments | Brief content readout |
|---|---|---|---|---:|---:|---|
| 广西 | 2026-09-29 — 广西监管局：三维聚力推动会计监督检查提质增效 | https://gx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260929_3998321.htm | 2026-09-29 15:51:00 / 2026年09月29日 / 20260929 | 1,759 chars / 7 `<p>` | 0 linked files | Detailed account of accounting-supervision inspections, digital risk screening, field extensions, and correction follow-up. |
| 海南 | 2026-09-30 — 财政部海南监管局：传承红色家风 涵养清廉正气 | https://hq.mof.gov.cn/caizhengjiancha/202609/t20260930_3998477.htm | 2026-09-30 15:53:00 / 2026年09月30日 / 20260930 | 370 chars / 6 `<p>` | 0 linked files | Short account of staff visiting an archival exhibition on party members’ family traditions; primarily an internal organizational activity. |
| 重庆 | 2026-09-30 — 财政部重庆监管局：监管五处党支部开展 “护航网络安全 赋能财会监督”网络安全学习 | https://cq.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260930_3998376.htm | 2026-09-30 10:09:00 / 2026年09月30日 / 20260930 | 859 chars / 5 `<p>` | 0 linked files | Internal party-branch learning and security awareness tied to fiscal-supervision work; no external enforcement result is described. |
| 四川 | 2026-09-28 — 财政部四川监管局：加强沟通 密切协作用心用情做好服务代表委员工作 | https://sc.mof.gov.cn/caizhengjiancha/202609/t20260928_3998248.htm | 2026-09-28 16:37:00 / 2026年09月28日 / 20260928 | 330 chars / 3 `<p>` | 0 linked files | Describes a visit with representatives, briefing on national fiscal work, and discussion of projects and fiscal-support policy; a brief service/research item. |

Each article also shows the unrelated static site-chrome date “2017年11月21日 星期二” at `div.nav > p`; it is separate from the article's visible publication date. Detail pages have the normal “返回主站” and “首页” navigation links. No previous/next article or pagination link was observed in the captured link labels. The pages display an “附件下载” label in the body chrome, but no document/PDF links were present, and no attachment URL was requested.

Raw evidence (all HTTP 200; exact URL was also the final URL):

- 广西 — `gx-detail.html`, 19,110 bytes; SHA-256 `34cf753e730e4c092d7fce9312b9ee9c4aa64687e0aa6d58e3825b75c2d654fc`.
- 海南 — `hq-detail.html`, 17,086 bytes; SHA-256 `58ca549301e2675c4bce271ed1f5f888524e46d76f50793cf1ce2a77b0d7ae0c`.
- 重庆 — `cq-detail.html`, 17,653 bytes; SHA-256 `ecd375ae569154fa9dcc19e5166ad45c07679d4d60093897d7ecca41f696f413`.
- 四川 — `sc-detail.html`, 14,624 bytes; SHA-256 `9a6fee9e644a44c92d817006299e5a10de22ee4f79fc8e698a686f0bebaf7215`.

## RISKS
This is one article per bureau and does not establish list/detail selector stability, pagination, historical-window completeness, recurring behavior, or category-wide content quality. The content descriptions are sample-level observations only and do not set source filters or acceptance status.

## BLOCKERS
None for the bounded static-detail check. Broader source validation remains open.

## NEXT
QA can independently verify this group's manifest and raws offline. Continue only with the next separately capped group using its already saved and QA-verified list evidence. These four observations are not a source pass or Gate 2 approval.

Evidence directory: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-detail-followup-20261006\batch6\`.
