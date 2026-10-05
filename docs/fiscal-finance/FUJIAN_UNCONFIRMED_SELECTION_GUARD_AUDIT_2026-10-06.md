# 福建无 marker 正文失败后的分析与精选门槛审计（2026-10-06）

## 范围与证据

离线只读检查内容队列、分析和发布实现及 S1 tests；没有运行 worker、模型、SQL 写入或外部请求。对象是 `fiscalhot_oct05_fujian_live_test` 中的真实文章 `iz0ywgmbpj535zy60telkvyac`：正文状态 `unconfirmed`、正文为空、附件 marker 缺失；页面正文区域之外观察到一个 PDF 链接。

## 结论：无 marker 时存在自动分析与精选可达路径

抽取 job 无论抽取返回 `ok` 还是 `unconfirmed`，都会随后调用 `queueProcessing(articleId, { step: "analyze" })`（`packages/backend/src/jobs/content.ts` 的 `registerExtractionJobs`）。常规路由也只在正文仍是 `pending` 且页面可抓时先取正文；`unconfirmed` 会路由到分析。`processArticle` 和 `analyzeArticle` 的早退条件检查有效 attachment marker，但不检查单独的 `body_status='unconfirmed'`；分析入口的“等正文”条件也只针对 `pending`。

因此此行若由分析队列处理，不会仅因 `unconfirmed` 停住。评分输入在正文和 excerpt 均为空时会退回标题；模型输出达到评分门槛并生成可用标题/摘要时，分析可写出 `selected=true`。发布侧仅用 participation/relevance/title/summary 判断 pool eligibility，再按当前 analysis 的 selected 判断精选；没有 marker 时不会启用附件 hold。发布会把此类正文呈现为 summary 模式，但 summary 模式本身不阻止精选和 selected ledger 发布。实际是否被模型选中取决于模型结果，本审计证明的是安全门槛允许这条路径，而不是预测结果。

S1 证据说明 marker 有效时 `analyzeArticle`、`processArticle`、`queueProcessing` 会挡住自动处理，sweeper/requeue 也会跳过 marker 行（`tests/analyze.test.ts` 的 pending attachment 测试、`tests/content-jobs-attachment-gate.test.ts`）。这些测试不证明无 marker 的 unconfirmed 行安全；该测试里 raw-null 对照行仍可进入队列。`tests/analyze.test.ts` 的裸标题样例只证明特定 stub 输出下未精选，不能作为生产模型或正文状态的通用阻断保证。

## 邻接 PDF 配置能力

配置层支持 `articleSelector + bodySelector + attachmentSelector` 的 HTML-envelope PDF 路径。`articleSelector` 可圈定同时包含正文和附件链接的共同 article 容器，`attachmentSelector` 可定位其中的邻接链接；只选择链接元素本身不够，因为实现会在其区域内查找 `a[href]`。成功路径先验证唯一 envelope、附件链接、页面 title/date 身份和 HTML body 容器，再按 HTTPS allow-prefix、MIME、PDF magic 与字节上限取 PDF；配置不会因为链接存在而自动下载。

本页已知 `.my_doccontent` 不含 `STRUCTURED_CONTENT`（`p/table/ul/ol/pre/blockquote/figure`），只有 `.TRS_Editor` 标题文本。当前 extractor 因无结构化正文在 PDF 解析前返回 `non_article_container`。所以只新增附件选择器不能解决现有页面；更宽的 body selector 只有在离线 DOM 检查确认唯一、身份一致且正文/附件组合满足 envelope 规则后才可能可用。当前 config 尚未验证或启用这种选择器；没有验证 PDF 内容是否为完整、适合发布的正文。

## 风险与建议交接

这条无 marker 的 `unconfirmed` 行不能依赖 marker gate 获得自动精选保护。建议由 Root 单独安排 S4 范围审查，评估是否应让 editorial 的 `unconfirmed` 正文在自动分析/精选前等待明确处理；本报告不改实现，也不预设具体修复。PDF selector 的可配置性不等于该文章可安全自动下载或可发布。
