# Regional bureau batch 1: detail-page QA

Date: 2026-10-04 (Asia/Shanghai). This is a bounded static-DOM review of one article detail page per bureau, selected only from HTTPS article links already observed in the saved Fujian, Beijing, and Shanghai list HTML. It adds detail-page evidence to the six-request home/list batch; it does not establish complete source coverage or validate a production parser.

## Requests and page evidence

| Bureau | List date / observed list title | Detail page result | Detail `PubDate` | Static body evidence |
|---|---|---|---|---|
| Fujian | 2026-09-22 — 财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量 | HTTP 200, 19,083 bytes; title matches list title. Raw HTML SHA-256: `8969348de9161cbcd7123220fe0b18ed5e6bc3dd79b93d65b9ba867a6957ffa0`. | 2026-09-22 08:21:00; calendar day matches list date. | `.TRS_Editor` and `.my_doccontent` resolve to the same visible text after excluding style/script/noscript: 1,641 characters, 8 paragraphs; SHA-256 `0b90156bceb896c2f57ff666fec65201008f6cbcb9b222b4ac7dc20ffa8034bd`. |
| Beijing | 2026-09-24 — 财政部北京监管局：坚持“四个进阶”提升属地中央预算单位预算编制审核质效 | HTTP 200, 19,093 bytes; detail title is “北京监管局：坚持‘四个进阶’提升属地中央预算单位预算编制审核质效” (the detail title omits the list title’s “财政部” prefix). Raw HTML SHA-256: `22c8b60dcb97604fd86807ef49a2cc3f2ea8324f56a9802e0561ba2cf4d32260`. | 2026-09-30 08:39:00; differs from the list date by six days. | `.TRS_Editor` and `.my_doccontent` resolve to the same visible text after excluding style/script/noscript: 1,672 characters, 9 paragraphs; SHA-256 `5ad1fbab500fe6086ad170570263de345d0c9d1ff07726d050692ef2b32a6342`. |
| Shanghai | 2026-09-23 — 财政部上海监管局四维靶向施策 扎实推进增值税留抵退税抽审提质增效 | HTTP 200, 21,796 bytes; title matches list title. Raw HTML SHA-256: `8b5ba1fe104efe4849c0c9719f08585d7954ed08b95f72d10106ea75b80b266e`. | 2026-09-23 15:09:00; calendar day matches list date. | `.TRS_Editor` and `.my_doccontent` resolve to the same visible text after excluding style/script/noscript: 1,950 characters, 9 paragraphs; SHA-256 `a0bd10cfe76bdd59f8cc7f2a0877459b2c2c2ff6397037d3f5a53e53517fc7a5`. |

The saved HTML exposes the same `.TRS_Editor` / `.my_doccontent` body structure on these three pages. A static scan found no PDF or attachment-style links within the pages and no explicit pagination links beyond a home link. This is limited to the fetched HTML and does not prove that the bureau sites have no attachments or pagination elsewhere.

## Budget and method

The one-shot manifest and public response HTML are saved under the ignored path `.data/fiscal-qa/regional-batch1-details-20261004/`. The backend Undici 8.11.2 dispatch budget recorded `attempted/dispatched/rejected=3/3/0`, with three each of request-create, sendHeaders, and response-headers events; there were no request errors. Each exact list-observed HTTPS URL was requested once, direct, with a 20-second timeout, a 6 MiB response limit, redirects disabled, and no retries. All three responses were HTTP 200 and their final URLs matched the requested URLs.

Cheerio inspection ran offline against the saved responses. Style, script, and noscript elements were removed before body text lengths and hashes were calculated; matching `.TRS_Editor` and `.my_doccontent` selectors describe the same body and must not be counted twice. No project extractor, database, collector, job, model, OCR, or attachment fetch was run for this detail review.

## Result and limits

This batch confirms that each selected list candidate resolves to a detail page with a visible body region and a `PubDate` value. Beijing’s displayed list date and detail publication timestamp disagree, so the list date must not be treated as the authoritative publication date without a documented reconciliation rule. The three-page sample does not establish cross-period completeness, pagination behavior, extraction quality at scale, or that all business attachments can be parsed. Gate 2 remains `NOT_PASSED`; this evidence does not approve a new source configuration or enable collection.
