# P3 抽取拒绝原因的本机诊断（2026-10-03）

STATUS=本机诊断 wrapper、focused tests 与一条另行核销的新详情观察完成；未重试历史真实 URL。
STAGE=P3 正文质量诊断。
GATE=Gate 2 NOT_PASSED。

## TASK

先只观测 `extractArticleBody(articleId, false)` 已有的结构化 `console.warn`，用本机 fixture 验证成功、身份不匹配、短正文、异常恢复与无关日志过滤。随后 Root 单独核销了一次新文章详情诊断；目标不是 9/4 失败 URL，且不用于追认其原因。没有改 backend、source 配置、数据库 schema、preview 或 worker；没有调用模型或运行 OCR。

## IMPLEMENTATION

新增 [诊断 wrapper](../../scripts/fiscal/p3-extract-diagnostics.ts) 和 [focused tests](../../tests/fiscal-extract-diagnostics.test.ts)。wrapper 对自己的调用用 promise queue 串行化，临时包装全局 `console.warn`，并用 `AsyncLocalStorage` 限定当前异步调用上下文。只有首个参数是 JSON 字符串、`level=warn`、`msg=source body selector declined`、`article` 精确等于指定 article ID、且 `reason` 属于显式 allowlist 时，才记下 `sourceId` 与 helper reason。reason 未知或结构不符则拒绝记录。

每条原始日志仍原样传给原 `console.warn`。不记录其它参数、完整返回体、异常文本、文章标题、正文、HTML、URL、headers 或 credentials。输出 schema 只有 `articleId`、`state`、`sourceId`、`failureReason`。callback 抛错会变成固定 `state=threw`，不会带出异常信息；`finally` 恢复原 console property descriptor 并释放串行锁。

CLI 运行时将采集、模型、Jina、IndexNow、Feishu 与 `ALLOW_PRIVATE_NETWORK_FETCH` 环境开关设为 `false`，再直接调用一次 backend extractor。集成测试加载既有 backend config 后，仅在测试模块内暂时令其 private fetch 设置为 true；唯一文章 URL 与 `allowUrlPrefixes` 都限定到该测试创建的 `127.0.0.1` fixture server，测试结束恢复原设置并关闭 server。`process.env.ALLOW_PRIVATE_NETWORK_FETCH` 和 runner 的环境开关仍为 `false`，没有外部请求。

## TESTS_RUN

新空库 `fiscalhot_oct03_diagnostic_test` 使用显式连接 `postgres://postgres@127.0.0.1:5432/fiscalhot_oct03_diagnostic_test`，运行现有 **35 migrations**。

- `node --test --test-timeout=30000 tests/fiscal-extract-diagnostics.test.ts`：**2/2**。实际 `extractArticleBody()` fixture 调用分别得到 `ok / null`、`unconfirmed / identity_mismatch`、`unconfirmed / short_body_not_allowed`。还验证目标 article 的外部异步 warning、不相关普通 warning 和未知 reason 都不会污染记录，日志继续透传，抽取异常后 warning 函数恢复。
- `npm run typecheck`：通过。

无外网请求、collector、worker、模型/OCR调用或生产来源状态变化。没有运行全套 `npm test`；QA 独立全套回归另行负责。

## SEPARATELY AUTHORIZED SINGLE DETAIL OBSERVATION

Root 针对经过核对的财政部会计司列表新条目另行核销一次直接详情抽取：

- URL：`https://kjs.mof.gov.cn/gongzuotongzhi/202607/t20260714_3993483.htm`
- 标题：`关于征求《会计改革与发展“十五五”规划（征求意见稿）》意见的函`
- 列表日期：2026-07-15（+08:00）；测试库写入 `published_at=2026-07-14T16:00:00.000Z`。
- 新隔离库 `fiscalhot_oct03_diagnostic_live_test` 运行35项迁移，只插入一个 `enabled=false`、全文关闭的 web_list source 和一个 `body_status=pending/revision=1` article。无 publication、analysis 或 worker。

ignored 目录 `.data/fiscal-qa/diagnostic-live-20261003/` 保存一次性 runner 和 `result.json`。初次本机 runner 启动在 Windows 动态模块导入处失败，发生在数据库导入、预算安装和网络 dispatch 之前；修正为 `pathToFileURL` 后检查结果文件不存在，再按同一授权执行一次抽取。此前失败没有发出 HTTP 请求。

这次调用使用 `runExtractArticleBodyDiagnostic(articleId)`，Jina fallback 显式 false；`installP3HttpBudget(1)` 对 backend 固定 Undici Agent/ProxyAgent dispatch 做硬上限。观测为 `attempted=1 / dispatched=1 / rejected=0`，HTTP 200，create/sendHeaders/headers各1，request:error=0、diagnostic callback errors=0；没有 redirect 或第二 dispatch。helper 结构化 reason 是 **`attachments_unprocessed`**，最终状态 `unconfirmed`。DB 中 `body_status=unconfirmed/revision=1`，body_text/body_html/content_hash均为空；正文长度0、正文SHA-256为null。source 仍disabled、全文仍关闭。运行结束后没有再请求，也没有保存原始响应、正文或 credentials。

静态检查 `selected-body.ts` 显示：body policy helper 在选中正文容器且确认它非空后，会扫描整份 HTML 的 `<a href>`；只要链接 URL path 以 `.pdf` 结尾，或链接 `type` 属性为 `application/pdf`，`pdfLinks()` 就会计为附件。普通 `bodyPolicies` 路径没有预验证附件的标记，因此发现至少一个此类链接时立即返回 `attachments_unprocessed`，不会继续做正文身份、表格完整度和最小长度验收，也不会请求/解析附件。该 reason 证明 helper 看到了“PDF 外观”的链接，不能证明附件实际类型、内容或与正文关系。因为本次不保存 HTML/附件 URL、不抓附件，具体附件身份为 **UNKNOWN**。

此路径与 `extractSelectedArticleEnvelope()` 现有分类（如 `attachment_required`、`attachment_unsupported`、`attachment_unclassified`）不同；本次没有调用该 envelope，也没有改变 policy 或扩大附件处理范围。若之后需要细分，只需先用本地 fixture 覆盖这些既有拒绝分类，继续 fail-closed；无需放宽附件 guard，也不需要 Sol 架构复核。

该结果只描述这条新 URL 的单次观察；它不能解释、替代或追认先前 9/4 详情 URL 的 `unconfirmed`，其 helper reason 仍未知。新 URL 曾否在更早的其他操作访问，本记录不作“此前从未访问”的声明。

## RESULT / RISKS / BLOCKERS / NEXT

**RESULT**：本机 observer 的 fixture 结果为 success 无 reason、身份失败 `identity_mismatch`、短正文 `short_body_not_allowed`；另一次被核销的新详情观察返回 `attachments_unprocessed` / `unconfirmed`。新观察不解释先前 9/4 URL 的原因。

**RISKS**：`console.warn` 是进程级方法。wrapper 只允许自有调用串行，使用异步上下文隔开并发任务，并保持所有日志透传；若未来把 wrapper 嵌入共享进程，请继续确保诊断期间不存在从该上下文派生的其它 extractor 任务。

**BLOCKERS**：先前 9/4 详情拒绝原因仍未知；不重放该 URL。新 URL 单次结果仍为 `unconfirmed`。Gate 2 仍未通过。

**NEXT**：QA 对本报告做只读审查并负责 Git 文档提交。若后续需要细分附件原因，先以 localhost fixtures 验证既有 `attachment_required` / `attachment_unsupported` 等拒绝分类；不放宽 guard。若要访问真实页面，再另行核销单次请求范围。

**TASK**：实现最小 P3 structured-warning observer，以本机 fixtures/隔离 `_test` 数据库验证；并执行另行核销的一次新详情观察。

**MODEL**：Luna High；未调用仓库模型服务。

**FILES_CHANGED**：`scripts/fiscal/p3-extract-diagnostics.ts`、`tests/fiscal-extract-diagnostics.test.ts`、本报告。live runner 与结果仅在 ignored `.data/fiscal-qa/diagnostic-live-20261003/`。

**GIT**：未 stage、未 commit。
