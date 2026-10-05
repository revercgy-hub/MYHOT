# Batch 9 regional bureau first-detail observations (2026-10-06)

## TASK
From the QA-verified Batch 9 saved lists, inspect only the first current-page same-host HTML article URL for 青海、宁夏、新疆. One direct GET per bureau; no other pages or attachments.

## MODEL
Luna High. No model, collector, worker, or database activity. Three exact detail GETs used P3 guarded fetch and the pinned Undici 8.11.2 dispatcher budget.

## FILES_CHANGED
- Tracked: this report only.
- Ignored evidence: `.data/fiscal-qa/regional-detail-followup-20261006/batch9/` (request preflight, one-shot marker, manifest, and three HTML raws), plus ignored offline review tooling under `.data/fiscal-qa/regional-detail-followup-20261006/`.
- No tracked source, test, fixture, shared matrix, or Git index changes.

## TESTS_RUN
- Runner preflight reparsed each QA-verified saved list raw and matched its bytes/SHA-256 to the list-batch manifest. Each exact URL was the first same-host `.htm` candidate and matched the saved list title/date.
- Offline raw review verified all three detail response byte lengths and SHA-256 values against the detail manifest.
- Undici 8.11.2 budget: attempted/dispatched/rejected = 3/3/0; `request:create`/`sendHeaders`/`headers`/`error` = 3/3/3/0. All responses were HTTP 200 at the exact requested URLs.

## RESULT
All three details expose `h2.title_con` at `div.mainboxerji > div.box_content > h2.title_con` and `.my_doccontent` at `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`. Character counts remove nested `style`, `script`, and `noscript` text. Publication dates are recorded as observed without assigning timestamp semantics.

| Bureau | List date and title | Exact detail URL | `PubDate` / visible date / URL date | Body / paragraphs | Attachments | Brief content readout |
|---|---|---|---|---:|---:|---|
| 青海 | 2026-09-30 — 财政部青海监管局：深学细悟民族法规 筑牢高原民族团结法治根基 | https://qh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998464.htm | 2026-09-30 15:12:00 / 2026年09月30日 / 20260930 | 837 chars / 6 `<p>` | 0 linked files | Law and policy learning about ethnic-unity work, internal study sessions, and how staff intend to incorporate the subject into fiscal-supervision duties; primarily an internal learning item. |
| 宁夏 | 2026-09-30 — 财政部宁夏监管局召开2026年中央转移支付监管工作座谈会 | https://nx.mof.gov.cn/caizhengjiancha/202609/t20260930_3998460.htm | 2026-09-30 15:06:00 / 2026年09月30日 / 20260930 | 847 chars / 5 `<p>` | 0 linked files | Substantive meeting report on interagency transfer-payment oversight, common management gaps, risk prevention, and next-step coordination. |
| 新疆 | 2026-09-24 — 新疆监管局：创新四维监管模式 筑牢兵团转移支付资金安全防线 | https://xj.mof.gov.cn/caizhengjiancha/202607/t20260717_3993738.htm | 2026-09-24 08:32:00 / 2026年09月24日 / 20260717 | 1,881 chars / 5 `<p>` | 0 linked files | Detailed transfer-payment supervision model with coordination and closed-loop rectification; describes a subsidy-fraud case, joint checks, and reported case-management figures. |

Page `<title>`, `ArticleTitle` metadata, and the parsed heading match the saved list titles for all three pages. Qinghai and Ningxia list display dates, `PubDate` calendar dates, visible dates, and URL date components agree. Xinjiang list display, `PubDate`, and visible dates agree on 2026-09-24, while the URL path date is 2026-07-17; this difference is unresolved and no timestamp meaning is inferred. All three pages also show the unrelated static chrome date “2017年11月21日 星期二” under `div.nav > p`. “返回主站” and “首页” links were visible; no previous/next article or pagination link was observed in the captured labels. No attachment links were present, and no attachment URL was requested.

Raw evidence:

- 青海 — `qh-detail.html`, 16,753 bytes; SHA-256 `e3efc5131c84cf3b833f88fdbae2a9835eebf92b764250bed4b6cddb7eb2d306`.
- 宁夏 — `nx-detail.html`, 20,057 bytes; SHA-256 `57f42cab8e8a3df89b08aa6fa59cb7ea54cdcd2de1f5cb67e13532e3b3d6bc3a`.
- 新疆 — `xj-detail.html`, 19,418 bytes; SHA-256 `1148e9b31c8580b426363c67dd2289d89f34c197c74578f671905c9e190e084c`.

## RISKS
One selected detail per bureau cannot establish source-wide selector stability, completeness, historical-window coverage, pagination, or recurring behavior. Xinjiang has a concrete displayed-date/URL-date mismatch. Qinghai's sample is chiefly internal learning; these sample observations do not determine overall source quality.

## BLOCKERS
No blocker to this bounded check. Xinjiang's URL-date discrepancy and broader source behavior remain open.

## NEXT
QA can verify this group's list evidence, request budget, and detail hashes offline. The remaining approved Zhejiang check is one first HTML article from the saved “监管工作” list. These observations are not source pass or Gate 2 approval.

Evidence directory: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-detail-followup-20261006\batch9\`.
