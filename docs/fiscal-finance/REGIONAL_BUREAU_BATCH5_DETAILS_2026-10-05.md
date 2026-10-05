# Batch 5 regional bureau: four first-detail static observations (2026-10-05)

## TASK
From the QA-verified Batch 5 list raws, inspect only each bureau’s first current-page same-host HTML article link. Fetch each exact URL once (hard cap 4 total, max 1 per bureau; direct GET, 20 seconds, 6 MiB, zero redirects/retries). Record actual detail title, metadata/visible date, body selector/length/structure, attachments, and a brief business-vs-internal-content readout.

## MODEL
Luna High; no model or worker calls. Four exact detail GETs used P3 guarded fetch and Undici 8.11.2.

## FILES_CHANGED
- Tracked: this report only.
- Ignored: `.data/fiscal-qa/regional-batch5-details-20261005/` (one-shot runner/marker, manifest, and four HTML raws). No source config, shared matrix, index, or DB changes.

## TESTS_RUN
- `node --check .data/fiscal-qa/regional-batch5-details-20261005/run.mjs` passed before GETs.
- Preflight reparsed the QA-verified saved list HTML, matched its manifest SHA-256, and confirmed each URL is the first same-host `.htm` candidate with the expected list title/date.
- Offline verification confirmed all four responses are HTTP 200 at the exact requested URLs; all four saved raw SHA-256 values match manifest.
- Undici 8.11.2: attempted/dispatched/rejected=4/4/0; create/sendHeaders/headers/error=4/4/4/0. No navigation/attachment URL was requested.

## RESULT
All four detail pages contain article title heading and static body content. Each page’s visible heading is an `h2.title_con` at `div.mainboxerji > div.box_content > h2.title_con`. Each observed main body container is `.my_doccontent` at `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent`; that consistency is observed across these four pages, not assumed in advance. The visible article date is under `div.mainboxerji > div.box_content > div.conbottom > div.docreltime > span`. Character counts below were recomputed offline after removing embedded `style`, `script`, and `noscript` text from the saved body container; paragraph counts refer to its remaining `<p>` nodes.

| Bureau | Exact URL | List date / title match | Meta `PubDate` / visible date | Body / paragraphs | Attachments | Content readout |
|---|---|---|---|---:|---:|---|
| 河南 | https://ha.mof.gov.cn/caizhengjiancha/202609/t20260930_3998389.htm | Exact; list 2026-09-30 | 2026-09-30 11:16:00; visible 2026年09月30日 | 1383 chars; 7 `<p>` | 0 linked | 较长、分节的业务正文，围绕预算绩效评价流程、资金用途核验、现场检查和整改闭环，含明确财政监管事实。 |
| 湖北 | https://hb.mof.gov.cn/gzdt2019/caizhengjiancha/202609/t20260929_3998269.htm | Exact; list 2026-09-29 | 2026-09-29 09:00:00; visible 2026年09月29日 | 235 chars; 2 `<p>` | 0 linked | 较短两段，报道青年调研获奖、组织表彰和青年队伍建设；以内部组织/宣传消息为主，未见具体财政监管结果。 |
| 湖南 | https://hn.mof.gov.cn/caizhengjiancha/202609/t20260930_3998467.htm | Exact; list 2026-09-30 | 2026-09-30 15:14:00; visible 2026年09月30日 | 313 chars; 3 `<p>` | 0 linked | 短篇三段，内容为公文规范、保密和内控专题培训；偏机关内部工作/培训动态。 |
| 广东 | https://gd.mof.gov.cn/caizhengjiancha/202609/t20260928_3998195.htm | Exact; list 2026-09-28 | 2026-09-28 10:49:00; visible 2026年09月28日 | 1790 chars; 10 `<p>` | 0 linked | 较长分节业务正文，具体说明中央转移支付的规范、重点领域、国债及资金全流程监管和一线调研。 |

For all four, the detail `<title>` and `ArticleTitle` meta exactly match the selected list title. `PubDate` calendar date, visible “发布日期”, list display date, and `tYYYYMMDD` URL date agree in these selected rows; this records equality only and does not assign time semantics. Hunan’s page has no `ContentSource` meta in the captured metadata; the other three expose the bureau as content source. Each page had zero detected document/PDF attachment links. No attachment was requested.

### Per-page evidence

- **河南** — HTTP 200; final URL equals request. Raw `henan-detail.html`: 18913 bytes, SHA-256 `77745ed18658383ea9b7a35b346e9c2e9029b52b6ddd8333d5336adf22e57ebb`. `<title>`: “财政部河南监管局：多措并举 推动绩效评价工作高质量开展”; `ArticleTitle`: “财政部河南监管局：多措并举 推动绩效评价工作高质量开展”; `PubDate`: `2026-09-30 11:16:00`; visible date: `发布日期：2026年09月30日`; `ContentSource`: 财政部河南监管局. Body container `.my_doccontent` (1383 visible characters; 7 paragraphs). 较长、分节的业务正文，围绕预算绩效评价流程、资金用途核验、现场检查和整改闭环，含明确财政监管事实。
- **湖北** — HTTP 200; final URL equals request. Raw `hubei-detail.html`: 16705 bytes, SHA-256 `db9f52b6502c22bb945bfa32fd5e9b79fe3669b6d84cc208feae00203ba1b9f7`. `<title>`: “财政部湖北监管局：湖北监管局在第八届“财青8+” 青年调研中再创佳绩”; `ArticleTitle`: “财政部湖北监管局：湖北监管局在第八届“财青8+” 青年调研中再创佳绩”; `PubDate`: `2026-09-29 09:00:00`; visible date: `发布日期：2026年09月29日`; `ContentSource`: 财政部湖北监管局. Body container `.my_doccontent` (235 visible characters; 2 paragraphs). 较短两段，报道青年调研获奖、组织表彰和青年队伍建设；以内部组织/宣传消息为主，未见具体财政监管结果。
- **湖南** — HTTP 200; final URL equals request. Raw `hunan-detail.html`: 13185 bytes, SHA-256 `182a1f9f7eca93e1a1caefa7a9f8fd481aa674be9e6d57861b388aa73a9739e0`. `<title>`: “财政部湖南监管局组织开展公文、保密和内控工作培训”; `ArticleTitle`: “财政部湖南监管局组织开展公文、保密和内控工作培训”; `PubDate`: `2026-09-30 15:14:00`; visible date: `发布日期：2026年09月30日`; `ContentSource`: no ContentSource meta. Body container `.my_doccontent` (313 visible characters; 3 paragraphs). 短篇三段，内容为公文规范、保密和内控专题培训；偏机关内部工作/培训动态。
- **广东** — HTTP 200; final URL equals request. Raw `guangdong-detail.html`: 40330 bytes, SHA-256 `012349bc441321bb563ea1a1c261b10dc2c8b28b4f537c1464518cf4d536ffdd`. `<title>`: “广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效”; `ArticleTitle`: “广东监管局：健全“四个突出”监管体系，持续提升中央转移支付资金监管质效”; `PubDate`: `2026-09-28 10:49:00`; visible date: `发布日期：2026年09月28日`; `ContentSource`: 广东监管局. Body container `.my_doccontent` (1790 visible characters; 10 paragraphs). 较长分节业务正文，具体说明中央转移支付的规范、重点领域、国债及资金全流程监管和一线调研。

The shared site chrome also contains the unrelated static date “2017年11月21日 星期二” under `div.nav > p`; it is distinct from the article’s visible publication-date element above and was not treated as the article date.

## RISKS
This is one article per bureau. It does not establish selector stability, completeness, rolling-window behavior, or source acceptance. A matching title/date across list and detail for these four examples does not explain other observed list/path discrepancies or define general timestamp semantics. “业务” versus “内务” labels are content observations for these samples, not a production classifier.

## BLOCKERS
No blocker to this four-page static check. Broader coverage and recurring validation remain outside this one-article-per-bureau evidence.

## NEXT
QA can independently verify the four exact URLs, saved HTML/hash, metadata/body selectors, and P3 event count offline. Preserve that 湖北 is a short internal youth-award item and 湖南 is internal training, while 河南 and 广东 contain substantive fiscal oversight; do not treat four samples as source pass or Gate 2 completion.

Evidence:
- Source QA-verified list manifest/raws: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch5-20261005\`
- Detail manifest/raws/one-shot marker: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch5-details-20261005\`
- Manifest: `D:\AI-work\MYHOT\AIHOT\.data\fiscal-qa\regional-batch5-details-20261005\manifest.json`
