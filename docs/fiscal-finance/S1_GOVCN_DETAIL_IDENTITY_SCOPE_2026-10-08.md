# S1 GovCN 单页详情 regex identity 窄范围裁定

**RESULT=APPROVED_SCOPE。** 批准下述最小兼容实现及一个 disabled GovCN 单页候选；不是代码已通过、source admission、90日覆盖或新运行授权。本次不重审 Gate 2，不改变其现行有界 P4 裁定。

## 依据与现有能力

静态基线为 `feat/fiscal-finance-hot` / `2cb5b44a5dcf91d2c37f814373863f9bdbb84bce`。读取 `AGENTS.md`、README、`PROJECT_PLAN.md`、`STATUS.md`、`SOURCE_MATRIX.md`、`CORE_SOURCE_IMPLEMENTATION_NEXT_2026-10-08.md`，以及 json-list/date/config-keys、web-list detail metadata、selected-body、extract、pdf-body 实际源码和相关测试。并行 P4 test/doc 修改不属于本裁定。

`fetchJsonList()` 已支持 `itemsPath=searchVO.catMap.bumenfile.listVO`、`titlePaths=[title]`、`urlTemplate={raw:url}`、`externalIdPath=id`、`publishedAtPath=pubtime` / `publishedAtUnit=epoch_ms`、`summaryPaths=[summary]`。`summaryIsBody=false` 时摘要只成为 excerpt，正文 pending。无需新 JSON adapter。`config-keys.ts` 的 COLLECTED/detail 已允许 json_list 使用 detail 及 `titleRegex`、`publishedAtRegex`、`bodySelector`；但 json_list 不支持 bodyPolicies、attachmentScopeSelector 或 PDF body config，不得为本候选放宽这些限制。

当前严格正文 `identityFromHtml()` 只读 ArticleTitle / OG / article:title / title 和 PubDate / article:published_time / pubdate / time。`fetchDetail()` 与 `extractArticleBody()` 构造 body config 时均不传两个 regex，因此仅配置字段不能让 GovCN 正文通过。`fetchWebListMetadataDetail()` 已有 regex 元数据实现，但限 web_list 的分页 metadata mode，不能借此让 json_list 获取新分页能力，也无需修改该 helper。

已保存详情 `.data/fiscal-qa/govcn-detail-20261008/01-fiscal-policy-detail.body` 的 exact URL 是 `https://www.gov.cn/zhengce/zhengceku/202609/content_7082302.htm`；raw-based correction 记录 61,625 字节，SHA-256 `49a45d9fd5ea90f53978736363c005d9ee819ff613b1093424b29183e4a7c61d`。该 correction 和 raw 中 title 去除 `_国务院部门文件_中国政府网` 后匹配列表题名；没有 ArticleTitle/PubDate，`firstpublishedtime=2026-09-28-21:50:00`。列表 `pubtime=1790603400000` 是 `2026-09-28T13:50:00Z`；以 +08 日键比较一致。可见成文日期 9/25 是签发日期。正文候选 `#UCAP-CONTENT .trs_editor_view` 的已有独立观察为 5,635 归一化字符 / 35 段、无附件；本次只读核对，不把这些数字冒充运行时 helper 新测结果。

## 最小批准实现

1. `packages/backend/src/content/selected-body.ts`：给 `SelectedBodyConfig` 增加可选 `titleRegex` / `publishedAtRegex`。identity helper 从同一份已获取 HTML 读取显式规则的第1捕获组：title 按既有 collapseWhitespace；date 交给既有 parseLooseDate 和 configured UTC offset。没有规则的字段保留原默认链。不得全局去掉 title 站名后缀或新增默认 firstpublishedtime/date fallback。
2. 显式配置以字段存在（不是 truthy）判定。空字符串、错误类型、过长、语法无效、无匹配、无第1捕获、空捕获或不可解析日期均不得给出 body；不回退到默认 meta、期望题名/日期、签发日期、lastmodifiedtime 或正文中的时间。缺失可保持 `identity_missing`，已提取但与 expected 不一致保持 `identity_mismatch`。调用方不得把这些结果改为 ready。不得用本规则改写 expected identity。
3. `packages/backend/src/sources/web-list.ts` 的 `fetchDetail()` 和 `packages/backend/src/content/extract.ts` 的 `extractArticleBody()` 只把既有两个 detail 字段透传到 selected body config。body 校验继续使用原列表/持久化 expectedTitle 与 expectedPublishedAt，不借用本次新解析元数据替换 expected 后自证匹配。无需修改 collect.ts、json-list.ts、date.ts、metadata helper 或 pagination。
4. `packages/backend/src/sources/config-keys.ts`：在配置了所选 HTML 正文时验证显式 regex 是非空字符串、最多1000字符、可编译；沿用现有 metadata-mode 的长度标准。直接 helper 也须 fail-closed，不能只依赖 admin 配置入口。避免影响未配置所选正文的既有 metadata regex 行为；不扩大 supported key 集合。可在 selected-body 中放一个小型共享验证函数复用，不能新建通用规则引擎。
5. 两个字段属于共同 SelectedBodyConfig，若走现有 HTML envelope，`packages/backend/src/content/pdf-body.ts` 的 envelopeConfig 及 selected-body.ts 内 envelope → extractSelectedBody 的对象也须仅透传这两个字段，避免接受共同配置后静默丢失。该项仅允许字段透传，原 PDF 下载、预算、预验证、附件分类、allowShortBody、最小长度和直接 PDF 行为保持原契约；不得为 GovCN 配置任何 PDF/envelope driver。

以上为最小五个生产文件的兼容范围；无需 `apps/`、schema、migration、provider、worker 或 publication 修改。新增来源配置限 `industry/sources.json` 中一个明确固定 ID 的 GovCN 部门文件单页候选，继续 enabled=false、site_fulltext=false、syndicate_fulltext=false、strict body-ready=true、summaryIsBody=false；QA 必须锁定该 exact ID 和更新后的 exact strict 集合。不得改其它 source 的规则。单页 p=1/n=5、detail.maxFetches=5 为现有有界配置候选；不启用或 seed，不构成首次回填实现。

GovCN titleRegex 只捕获精确 title 元素的文章题名并消费已观察后缀，例如 `<title>(.*?)_国务院部门文件_中国政府网</title>`。publishedAtRegex 只捕获 `firstpublishedtime` meta 的 `YYYY-MM-DD` 第1组，同时匹配该 meta 已观察的 `-HH:mm:ss` 尾部，配置 +08:00；不能捕获完整 `YYYY-MM-DD-HH:mm:ss` 后假设 date parser 支持这种格式。只捕获日是现有 identity 日比较的证据输入，列表 epoch-ms 保持原样；不设置 publishedAtAuthoritative/upgradeDatePrecision 去改变本候选存储发布日期。

## Luna 的 fixture 与离线验证要求

- 用已保存查询 raw 建立 `tests/fixtures/govcn-detail-identity/` 的单页 JSON fixture，保留5行及字段结构；详情用已保存 raw 建立 HTML fixture，并记录来源 URL、raw hash、字节层与 correction 链。不得提交 `.data/`。如精简页面，明确 fixture 是衍生样本并保留 title/meta、真实正文结构、签发日期和外围 chrome；不得用合成正文冒充该 raw。
- 新增 `tests/govcn-detail-identity.test.ts` 或等价窄测试，验证 existing config accepted、5行映射及 exact 配对 title/URL/epoch-ms、摘要只到 excerpt/body pending。JSON list 可用 existing guardedFetch 的离线 MockAgent exact endpoint replay；不得 live HTTP，不需要为此改 mapper。
- 同一真实详情：无 regex 时仍无 body；exact regex 与列表 expected 配对时正文可用；title/date mismatch（包括 9/25）、null/invalid expected date、缺失/空/malformed/超长 regex、无捕获组、无匹配和空捕获均无 body。额外给页面放匹配 expected 的默认 meta，确认显式规则失败仍不能 fallback。
- 验证只有 titleRegex 或只有 dateRegex 时另一字段继续原默认链；两个字段都 absent 的 legacy fixture 结果不变。验证 empty/short/nonunique/navigation body、增加 PDF 链接仍按现有规则拒绝；不引入新短正文例外。
- 用 existing fetchDetail 的 injected fetcher 返回保存详情，证明 collect detail body config 确实透传；expected 与原 epoch-ms 保持不变。延迟 `extractArticleBody()` 路径也必须有透传证据，可在既有隔离库测试链用离线 fake response 验证；本次审查不执行 DB。共同 envelope 透传若实施，增加一个离线 fixture 验证规则失败不会触发附件 fetch，既有 PDF guard 回归保持通过。
- 实施后运行 typecheck、上述新测试及既有 selected-body / pdf-body / strict-body-readiness 相关离线回归；需要数据库的完整检查交独立 QA 的 fresh `_test`/`_ci` 库，禁止 preview/production。按仓库要求完成适用全套 QA，结果绑定实施后的 SHA，不沿用本审查或并行 P4 测试当作通过。

本裁定只允许读取保存响应、编辑上述源码/fixtures/tests/docs/disabled候选配置及离线软件验证。不授权任何 HTTP、collector/worker、模型/key、附件下载、preview/production DB、源启用、Git提交、分页90日实现或 NFRA category/JSON-detail adapter。默认 identity、严格就绪保护、附件、SSRF、守护 fetch 和发布时间语义不得放宽。一个 pair 不证明该类别所有详情布局或长期稳定；分页与90日要求仍留后续独立阶段，不永久延期。

## 交接八字段

**TASK**：GovCN 单页所需 regex identity 与 packages compatibility 窄审查。

**MODEL**：S1 source scope review；仅静态代码及保存 raw/correction 阅读，无外部模型/provider。

**FILES_CHANGED**：仅新增本文 `S1_GOVCN_DETAIL_IDENTITY_SCOPE_2026-10-08.md`。

**TESTS_RUN**：无软件测试；只读源码、文档、raw/correction、Git HEAD/status。没有 HTTP、模型、secrets 或 DB 操作。

**RESULT**：APPROVED_SCOPE；现有配置支持单页映射，批准最小后端 regex identity/透传兼容，无需 schema/apps；尚未实现或通过 QA。

**RISKS**：显式 regex 失败若 fallback 会伪造正文就绪；5行单页与一个详情 pair 不证明整源/90日覆盖；raw observation 字符数与 sanitizer 最终输出需实际离线验证区分。

**BLOCKERS**：实现及独立离线 QA 尚未完成；来源仍 NOT_ADMITTED。本范围没有新的用户选择待办。

**NEXT**：Luna 按五文件兼容范围及保存响应 fixture 实施，QA 锁定 exact disabled GovCN ID、运行失败用例和适用回归；分页90日与 NFRA 另立 scope。
