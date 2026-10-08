# GovCN / NFRA 最小实现下一步（2026-10-08）

本文最初记录基于已保存官方响应的GovCN/NFRA差异；下方原始草案保留其实现依据。2026-10-08在批准的[S1 GovCN detail identity scope](S1_GOVCN_DETAIL_IDENTITY_SCOPE_2026-10-08.md)下，GovCN regex identity兼容与一个disabled严格候选已在本地工作树实现并通过本文所述离线检查。该候选仍`UNADMITTED`；不得据一个5行页面和一篇详情计入source pass、历史覆盖或admission。NFRA保持未配置，nested-category/JSON-detail后端适配未实现。证据索引见[来源矩阵中的GovCN/NFRA响应记录](SOURCE_MATRIX.md#2026-10-08-govcn-nfra-bounded-endpoint-observations)、[GovCN单篇详情记录](SOURCE_MATRIX.md#2026-10-08-govcn-list-detail-sample)及[实现检查点](SOURCE_MATRIX.md#2026-10-08-govcn-regex-identity-implementation-local-not-admitted)。

## GovCN implementation checkpoint

Current working-tree config ID is `govcn-policy-library`: one fixed observed query (`p=1,n=5,type=gwyzcwjk`), `bumenfile.listVO`, summary excerpt only, max five details, strict body-ready flag true, source disabled, and both site/syndication full-text flags false. `industry/sources.json` currently has 47 entries and exactly 41 strict IDs. No source was seeded or run.

The approved selected-body regex identity fields now pass through list detail-prefetch, delayed extraction, and the existing envelope bridge. Explicit rule validation is nonempty/compilable/<=1,000 characters; direct helper use fails closed, requiring capture group 1 and a nonempty parseable result with no metadata fallback for an explicitly configured field. Original listing/stored expected title/date remain the comparison target. The list epoch-millisecond value and existing body/PDF guards are unchanged. Exact saved response entities were copied into `tests/fixtures/govcn-detail-identity/` for offline tests. Current verification: `npm run typecheck` PASS; Gov identity/config 6/6 and combined Gov + selected-body + PDF regression run 22/22 PASS. Independent QA is pending. No live HTTP, database, collector, worker, model, attachment request, or Git commit occurred. This does not establish source admission or 90-day coverage.

## GovCN：先用现有 `json_list` 字段解析一个固定类别

已保存查询响应 `.data/fiscal-qa/govcn-query-list-20261008/01-policy-search-response.body` 是严格UTF-8 JSON。对象路径 `searchVO.catMap.bumenfile.listVO` 返回5行；其中部门文件候选用到现有字段 `id`、`title`、`url`、`pubtimeStr`、`pubtime`、`summary`。首篇政务工作候选 `id=26731346` 的题名为“中国人民银行等八部门联合印发《关于金融支持服务业扩能提质的指导意见》”，详情链接为 `https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm`。`pubtime=1790603400000` 转为 `2026-09-28T13:50:00Z`，和列表显示 `2026.09.28`、详情 `firstpublishedtime/lastmodifiedtime` 的 `2026-09-28 21:50 +08` 同日；同一行的 `ptime` 不同，不用于发布日期。详情可见“成文日期”是9月25日，属于另一日期字段。

下面是批准实现所依据的字段映射；`json_list` 单页映射已写入disabled行业候选。该查询每个分组只有5行，不能满足已确认的近90日首次回填，也未验证跨页稳定性，故该候选仍不能启用或准入。

```json
{
  "kind": "json_list",
  "config": {
    "url": "https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk",
    "itemsPath": "searchVO.catMap.bumenfile.listVO",
    "titlePaths": ["title"],
    "urlTemplate": "{raw:url}",
    "externalIdPath": "id",
    "publishedAtPath": "pubtime",
    "publishedAtUnit": "epoch_ms",
    "publishedAtUtcOffset": "+08:00",
    "summaryPaths": ["summary"],
    "summaryIsBody": false,
    "allowUrlPrefixes": ["https://www.gov.cn/zhengce/zhengceku/"],
    "detail": {
      "maxFetches": 5,
      "titleRegex": "<title>(.*?)_国务院部门文件_中国政府网</title>",
      "publishedAtRegex": "name=\"firstpublishedtime\" content=\"(\\d{4}-\\d{2}-\\d{2})-\\d{2}:\\d{2}:\\d{2}\"",
      "publishedAtUtcOffset": "+08:00",
      "bodySelector": "#UCAP-CONTENT .trs_editor_view"
    },
    "_aihot": {
      "initialBackfillMonths": 3,
      "initialBackfillRequirePublishedAt": true,
      "requireBodyReadyForAutomaticSelection": true
    }
  }
}
```

现有字段覆盖单页路径、题名、原始URL、epoch毫秒发布日期和摘要。`summary`只应进入excerpt，绝不能设置为正文；正常结果应继续 `body_status=pending`，直到独立详情获取与严格正文验证成功。`{raw:url}`保留绝对URL；普通模板占位会编码冒号，不能误写成 `{url}`。

批准的最小兼容点是把 `detail.titleRegex` / `detail.publishedAtRegex` 用于所选正文的identity校验并透传到body extractor：改动前 `identityFromHtml()` 只读 `ArticleTitle`/OG title/`<title>`及 `PubDate`/article-published/`time[datetime]`，而保存详情没有 `ArticleTitle` 或 `PubDate`，`<title>`还附加 `_国务院部门文件_中国政府网`，发布日期在 `firstpublishedtime` meta。现在严格body选择器 `#UCAP-CONTENT .trs_editor_view` 有本地fixture正向验证；日期正则只捕获首发meta中的 `YYYY-MM-DD`，再以 `+08:00` 解释，身份仍按原列表 `pubtime` 的本地日比较。不要把签发日期当发布时间，也不要为了此样本放宽到“缺少identity即接受”。

列表页仍是直接阻断：保存JS显示浏览器对 `/search-gov/data` 发GET，参数含 `q`、`sort`、`sortType`、`searchfield`、`p`、`n`、`type`，并传 `p=queryParam1.p+1`；已保存请求使用 `p=1,n=5,type=gwyzcwjk`。当前 `fetchJsonList()`只读一页，`json_list`不支持现有 `web_list`分页计划器。需要单独设计一个带每源页数、总dispatch及全局deadline上限的JSON页参数模式，并用保存raw作fixture；不能把固定p=1的5条、分组累计量或排序假设说成90日覆盖。该一次查询证明的是单页映射可用和一个详情配对，不是完整列表或来源通过。

## NFRA：分类ID选择器加独立JSON详情传输

已保存列表 `.data/fiscal-qa/govcn-nfra-source-20261008/nfra/01-news-list.body` 的外层为 `{rptCode,msg,data}`；`data` 是7个分类对象数组。应按分类对象的 `itemId === 915` 选择“监管动态”，再读其 `docInfoVOList`（本次6条）。不能写死 `data.1.docInfoVOList`：当前 `getPath()`只能按属性/数字数组索引取值，不能按分类ID过滤，类别数组顺序不是可依赖身份键。最小列表映射增加显式 `arrayPath/categoryIdPath/categoryId/itemsPath`（示例：`data` / `itemId` / `915` / `docInfoVOList`），然后复用现有字段mapper：候选 `docId`为稳定外部ID，标题取 `docSubtitle`/`docTitle`并折叠空白，日期取 `publishDate`，摘要 `docSummary`本样本为空。

HTML新闻页面是客户端壳，不能直接提供可抽正文详情。另一个已保存endpoint是 `https://www.nfra.gov.cn/cbircweb/DocInfo/SelectByDocId?docId=1273452`；成功响应为 `{rptCode,data:{...}}`，详情字段含 `docId`、`docTitle`、`docSubtitle`、`publishDate`、`docClob`。必要最小适配是在JSON列表候选保留公开 `ItemDetail.html?docId=...&itemId=...`作为文章链接，同时给detail配置一个独立、字段限定的JSON详情URL模板（只对请求白名单主机/路径及候选docId构造），从响应的 `data.docClob`取嵌入HTML正文。不能把JSON API地址冒充读者可访问的文章canonical URL；详情URL模板要依据现有官方item-detail URL构造证据固化，不另行猜路径。

取正文前先强校验 `rptCode`成功、`data.docId`与列表ID相等、detail的 `docSubtitle`/`docTitle`经空白归一后等于列表题名、detail `publishDate`与列表发布日期为同一source-local日。当前HTML identity helper在 `docClob`上无法完成等价校验：样本没有 `ArticleTitle`/`PubDate`，`<title>`是正文段落句而非列表题名。最小后端桥接应只把**通过JSON结构化ID/标题/发布日期比较**所得identity交给现有正文选择器，再检查结构化正文/内容长度及body规则；不可用“有docClob就body ready”绕过identity。离线查看此一条 `docClob` 的候选内容节点为 `.Section0`、规范化文本约1,199字符；它只是一个fixture候选，尚未做多样本选择器/质量审查。

外层JSON raw经严格UTF-8解析有效；`docClob`内的 `gb2312` meta只属于嵌入HTML字符串，不是JSON实体字符集，不能再将JSON或字符串按GB18030重解码。这个样本detail还携带 `docFileUrl`、`pdfFileUrl`字段，虽然 `attachmentInfoVOList`为空；不得请求文件。附件语义应在适配器中保留为未核状态，直到独立确定安全的attachment mapping/body政策。outer decoder修复不等同NFRA适配完成或来源准入。

## 最短实施顺序与准入边界

1. GovCN 的单页regex identity scope已经批准并按上文本地实现；下一步先由独立QA核对实现、exact source ID与配置断言。其固定 `p=1,n=5` 仍不是分页方案，不视为90日覆盖。
2. NFRA 仍需独立范围裁定，最小 runtime 差异是按类别 `itemId`筛选及一条字段白名单JSON详情桥接，并且要保留canonical文章URL和对结构化ID/title/date进行严格身份比对；现有GovCN实现不提供NFRA能力，也不表示NFRA候选可用。
3. 在新的独立source预算下才开展P3真实分页/详情抽样与正文质量检查。GovCN当前只有一个部门候选pair；NFRA当前只有监管动态列表中的一个详情pair。两者都未验证多个布局、完整分页、更新/去重、噪声率、附件处理或跨时点稳定性，来源仍保持未准入。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：实现批准的GovCN 单页regex身份兼容并推进未付费官方信源主线。
**MODEL**：未调用模型、provider、key、worker或collector；仅离线读取saved raw与代码。
**FILES_CHANGED**：GovCN S1允许的五个backend文件、一个 disabled `industry/sources.json`候选、SOURCE_MATRIX增量、本文、exact saved raw fixtures、新窄测试、来源数/strict-set测试更新；NFRA/schema/apps未改。
**TESTS_RUN**：`npm run typecheck` PASS；Gov identity/config 6/6，连同既有selected-body/PDF回归22/22 PASS。无HTTP/DB操作；source-rules/strict DB-backed回归和独立QA尚待执行。
**RESULT**：本地目录47 source / 41 strict IDs；Gov候选 `govcn-policy-library`仍disabled、fulltext-off、summary-only和strict-body-ready。NFRA category/detail适配未实现；两者均未admitted。
**RISKS**：GovCN `summary`是摘要不是全文，单页仅5条；NFRA单详情样本未证明正文/附件契约或所有类别稳定。
**BLOCKERS**：尚待source-focused regressions及独立QA核验；没有paid/provider/新HTTP待办。
**NEXT**：完成适用既有selected-body/PDF/source-rules/strict回归与QA复核，再由Root/Lead决定后续source阶段；不提交Git。

## Independent QA result (2026-10-08)

The “Independent QA is pending” status above records the implementation handoff time and is superseded by this result. Independent QA on code SHA `99c3a9a3a1da91457eb2fdda81b1694d217b0511` confirmed the exact query/detail saved fixture bytes and passed the Gov identity test 6/6, focused Gov/selected-body/metadata/PDF/source-rule/strict set 46/46, `npm run typecheck`, backend suite 322/322, Web production build and tests 15/15. Both `fiscalhot_govcn_compat_focus_20261008_test` and `fiscalhot_govcn_compat_full_20261008_test` were fresh 35-migration databases. A post-code local loopback smoke passed 30/30; readonly preview counts before/after were unchanged except the standard API heartbeat setting. GitHub Check+Docker #37744820133 succeeded for this exact code SHA; no source admission, 90-day coverage, live HTTP, model call, or production behavior is inferred.

## 2026-10-08 NFRA adapter implementation checkpoint (uncommitted worktree)

The prior NFRA section above records the proposal before S1 review and is superseded by [the approved narrow scope](S1_NFRA_JSON_DETAIL_SCOPE_2026-10-08.md) and this implementation checkpoint. The exact local candidate is `nfra-regulatory-dynamics`: disabled, T1/editorial, 1,440-minute interval, three-month published-date backfill, strict body-readiness enabled, site/syndicate full-text disabled, summary excerpt-only. Parsed catalogue counts are 48 sources / 42 exact strict IDs; zero sources are enabled. It remains unadmitted and has not been seeded or collected.

Implementation changes are limited to `json-list.ts`, `config-keys.ts`, `collect.ts`, `web-list.ts`, `selected-body.ts`, `extract.ts`, new `nfra-json-detail.ts`, the one `industry/sources.json` candidate, exact response fixtures, NFRA contract tests and the source-count/strict-set assertions. The list mapper chooses category by exact numeric `itemId=915` rather than array position, filters unsafe IDs/external title links, normalizes original title/date and holds candidates with an attachment-pending diagnostic. The fixed detail driver validates the canonical article URL before constructing the official JSON endpoint, enforces the source-local 7-dispatch/120-second budget and detail response limits, and compares `rptCode`, `docId`, normalized title and local date to the original listing identity. Its validated JSON body enters the existing private selected-body core; the ordinary HTML identity path is unchanged. Both prefetch and delayed extraction use this driver and fail closed without HTML/Readability/Jina fallback.

For the observed pair, list `docFileUrl` and `pdfFileUrl` are nonempty but detail values are null with empty `attachmentInfoVOList`. The mapping captures a pipeline-owned pending marker before prefetch; neither empty detail fields nor a delayed re-fetch clears it. The selected `.Section0` body can be checked internally, but returned/stored body stays null and the marker remains `attachments_unprocessed`. This does not claim the category is attachment-free or that its text is publishable.

The raw fixture copies are exact: list 26,200 bytes / SHA-256 `a45ad64cf1313e75850616e77a2e1cf65036008e7b1e51e915c07c3d5c914600`; detail 54,623 bytes / SHA-256 `b6e46388f904c8c8fead84cc66997b0a11dc4eca79e02fd03de1556fa7fc2af7`. Before the source-count assertions are run, the current evidence is `npm run typecheck` PASS; `node --test tests/nfra-json-detail.test.ts` PASS 7/7; `git diff --check` PASS. Tests exercised exact hashes, category order/duplicates, mapping identity, strict UTF-8 and detail mismatch cases, empty/malformed attachment outcomes, shared prefetch/delayed driver, no generic fallback, body selector/sanitizer failures, and dispatch caps/rejections. No HTTP, DB, collector, worker, provider, or model call ran. Independent QA is pending; DB-backed collection/delayed-extraction integration and elapsed-time hard-expiry were not executed by the author.

### Eight-field implementation handoff

**TASK**: Implement only the S1-approved NFRA JSON category/detail compatibility and disabled candidate.

**MODEL**: Delegated implementation agent; no paid provider, credential, or model request.

**FILES_CHANGED**: NFRA source/config/runtime files and tests above, plus `SOURCE_MATRIX.md` and this checkpoint. Existing QA-owned `STATUS.md`, `P4_PILOT_READINESS.md` and continuous handoff changes are separate. Worktree is based on branch `feat/fiscal-finance-hot`, HEAD `4ff4b04ada90a72212b535dc4b741c723de9b98a`; no code commit has been created.

**TESTS_RUN**: `npm run typecheck` PASS; `node --test tests/nfra-json-detail.test.ts` 7/7 PASS; `git diff --check` PASS. Independent fresh-database QA is pending.

**RESULT**: 48 configured sources / 42 exact strict IDs, all disabled. Actual pair remains body-null and attachment-pending in both modeled paths.

**RISKS**: Attachment semantics are unresolved; one category snapshot and one article pair do not prove all category schemas, source quality, history coverage, or sustained stability.

**BLOCKERS**: Independent QA, especially fresh backend/config/source-rule regressions and delayed-path persistence integration; no source admission authorization is implied.

**NEXT**: Independent QA review this frozen code, report actual coverage gaps, and then update status without enabling or collecting the candidate.

## NFRA independent QA correction (2026-10-08)

The implementation checkpoint and its 7/7 author-focused result above are historical and superseded by final independent QA on code commit `e09d7cb5c2b3f4c3130e2bbe63721475b8f53cb1`. QA passed the NFRA/source focused set 98/98, `npm run typecheck`, backend suite 334/334, Web production build and tests 15/15. The fresh-database persistence case applied 35 migrations, collected the fixture pair with seven fake HTTP responses, then exercised one delayed extraction response; the stored article remained body-null, attachment-pending, revision 1, with zero analyses, receipts, selected items, or jobs. A fake-clock deadline case rejected before dispatch (0 requests). Redirect rejection, byte-preserving raw fixtures, and all existing HTML/default-source regressions passed. No live HTTP, paid provider, real key, production database, or source collection was used.

The exact candidate remains disabled and unadmitted; these checks establish implementation behavior only, not attachment absence, broader NFRA category/layout quality, history coverage, or 90-day completeness. The source-owned runtime/config/fixtures/focused tests and QA-owned persistence test are frozen for the source commit; shared readiness documents remain owned by QA.

### Eight-field NFRA QA handoff

**TASK**: Implement the approved fixed NFRA JSON category/detail adapter and verify its persisted pending behavior.
**MODEL**: No paid provider, key, model, real HTTP, worker, or source collection.
**FILES_CHANGED**: Approved NFRA runtime/config/candidate, exact raw fixtures, focused and source-count tests; QA added the independent persistence test. `SOURCE_MATRIX.md` and this document record the result.
**TESTS_RUN**: Independent focused 98/98, typecheck, backend 334/334, Web build plus tests 15/15, fresh 35-migration persistence integration (7 list/detail fixture responses plus one delayed extraction response), fake-clock deadline rejection with zero dispatch.
**RESULT**: Persisted row stayed body-null and `attachments_unprocessed`, revision 1; analyses/receipts/selected items/jobs all zero. Candidate stays disabled and unadmitted.
**RISKS**: One saved category/detail pair does not establish attachment semantics, other categories/layouts, history coverage, source quality, or admission.
**BLOCKERS**: None for this bounded implementation; no source admission or paid execution is authorized by these test results.
**NEXT**: Preserve disabled/unadmitted state; any source admission or live collection requires a separate decision and evidence.
