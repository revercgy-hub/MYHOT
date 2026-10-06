# Phase C 正文质量缺口与最小处置建议 — 2026-10-06

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：离线盘点财政部会计司与厦门财政地方债已验证的正文阻塞，区分可由行业配置/selector/fixture安全解决的情况与必须等待解析能力的情况。

**MODEL**：GPT-6 Luna High；未调用项目模型或外部服务。

**FILES_CHANGED**：仅新增本文。未修改代码、`industry/sources.json`、数据库、schema、正文状态或其他共享报告。

**TESTS_RUN**：未运行测试。依交接说明复用 Phase B 已完成的 296/296 本地测试与 CI 绿灯，不重跑。引用的会计司离线策略测试既有结果为 9/9（新策略）及 6/6（旧 selector 特性记录），来源见下文。

**RESULT**：会计司 180 字短表的现有 source-specific `bodyPolicies` 已通过缓存 fixture，但一次真实详情抽取仍 `unconfirmed`，其 HTML 和 helper 原因均未保存，不能提出有证据的配置修复。带 XLSX 的页面不能靠 selector 变成完整正文。厦门已保存的详情 HTML 显示业务 PDF 在正文容器之外；205 字 Readability `ok` 已证实是假阳性，严格 PDF 解析为 `pdf_page_no_text`。这两个源的失败都应维持正文未确认边界。

**RISKS**：会计司策略只核验了有限缓存结构，无法解释 10/3 实际失败；厦门一页 PDF 的人工可读性不能证明机器抽取成功。把未知失败覆盖为 `ok` 会放入标题/扫码提示、残缺 HTML 或漏掉业务附件。

**BLOCKERS**：会计司目标页的原始响应与拒绝原因未知；XLSX 没有已核验的解析路径。厦门业务正文需要 PDF 文本提取/OCR 或其他经审查的附件解析路径；当前严格解析不能确认它。

**NEXT**：保留当前行业配置、source disabled 与 `body_status` 事实；不重请求、不回填人工转录。若继续，先做离线诊断器 reason 持久化/fixture 覆盖；对新增 XLSX/PDF 解析能力另立范围与负例，不以 selector 放宽替代解析。

## 证据与处置判断

| 来源/形态 | 已保存证据 | 可以安全做的最小处置 | 必须等待解析/仍未知 |
|---|---|---|---|
| `mof-accounting-notices` 短表 | 当前 `industry/sources.json` 已配置 `bodyPolicies`：表格要求五个指定表头和至少一行完整数据；普通多段正文至少 200 字。`P3_ACCOUNTING_BODY_POLICY_2026-10-03.md` 记载离线 fixture 为注销名单 180 字表格通过、473 字段落通过，短多段、装饰表和题名加 XLSX 被拒；策略测试 9/9。 | 配置已经包含基于行业内容形态的最小规则，现阶段不再增 selector/降低门槛。保留已存正反 fixture 作为这两种形态的离线回归。 | 9/4 目标页 live extraction 返回 `unconfirmed`、revision 1、body/hash 空；真实 HTML 未保留，诊断 runner 未保存 helper warning 的结构化拒绝原因（`SOURCE_MATRIX.md` 253 行；同报告 10/3 段）。拒绝具体是哪一项为 **unknown**。fixture 正例不解释这个真实失败，禁止据此断言配置可修或重请求旧 URL。 |
| `mof-accounting-notices` XLSX | 会计司题名加 XLSX fixture 显示 `.TRS_Editor` 只有题名，下载项在容器外；附件没有被请求。此前的离线 selector union 会误收短通知与装饰表，见 `P3_ACCOUNTING_BODY_FIX_2026-10-02.md`。 | 继续让仅有题名/下载链接的 HTML 保持未确认；现有 fixture 已是有价值的负例，无需 source config 改动。未来可在隔离的解析器工作中继续用它断言“未解析附件不得 body ok”。 | XLSX 内容与完整性没有保存/解析证据。selector 或 `allowShortBody` 不会读取 XLSX；不得把题名或附件链接写成公告正文。需独立 XLSX 解析支持、内容完整性规则和负例测试后再评估。 |
| `xiamen-finance-debt` 专项债结果 | 忽略目录保存了 `.data/fiscal-source-audit/details/xiamen-finance-debt.html`。该页 `.Custom_UnionStyle` 实测仅 26 字；其外有第十六期官方 PDF 链接。历史 205 字 Readability 结果只有标题、日期、扫码提示及页尾，确认为假阳性。现有配置仅 `detail.bodySelector='.Custom_UnionStyle'`，全文开关关闭、source disabled。 | 保留现有正文边界与 fail-closed 结果。若以后增加专用离线 fixture，可由保存 HTML 验证该容器不会产出完整公告，并断言附件仍在容器外；这只能验证拒绝，不能验证成功。 | 该 HTML 缺少公告业务表格，PDF 是观察到的结果正文。PDF 受限解析返回 `pdf_page_no_text`；后来保存的 PDF 与单页 PNG 经人工复核字段可读且一致，但人工转录不改变机器解析状态（`P3_XIAMEN_DEBT_PDF_VALIDATION.md`、`P3_XIAMEN_MANUAL_REVIEW.md`）。不能通过扩大 HTML selector 或 `allowShortBody` 解决；须等待受审查的 PDF/OCR/附件解析能力和内容完整性核验。 |

## 最小改动与测试影响

本轮没有证据支持对两条 source 做配置/selector 调整。会计司 10/3 生产详情失败不等于既有短表策略错误，因为实际响应未保存，且失败不是 fixture 正例；不得删减 `bodyPolicies` 或重写历史状态。XLSX 和厦门 PDF 均需要正文解析能力，不属于 CSS 配置修复。

可以在不触碰生产抽取逻辑的前提下，单独改进未来诊断 runner：仅筛选固定文章 ID 的 `source body selector declined` JSON warning，持久化安全的 `reason/source` 字段并确保原 warning 透传，使用 localhost 固定响应测试成功、身份不匹配、短正文拒绝与异常恢复。原 `P3_ACCOUNTING_BODY_POLICY_2026-10-03.md` 已提出此路径；该改动不能补出旧请求缺失的 HTML/reason，也不授权新官方请求。

若将来推进内容解析，新增测试应分别覆盖：会计司 XLSX 缺少解析结果时保持 unconfirmed；厦门详情含正文外 PDF 时不得由 205 字外壳文本 body-ok；解析器完整读取允许的内容和页后才可通过；页空/失败、损坏或缺字段都保持未确认。测试使用本地 fixture/保存材料，不发外网请求。任何解析能力都需单独范围审查与有针对性的 focused tests；本轮不重跑已绿的 296-test 全套。

## 资料索引与证据边界

- [会计司正文策略报告](P3_ACCOUNTING_BODY_POLICY_2026-10-03.md)：已核准的精确策略值、离线正负例、10/3 单篇 `unconfirmed` 与 reason/raw HTML 缺口。
- [会计司 selector 离线核验](P3_ACCOUNTING_BODY_FIX_2026-10-02.md)：union selector 错收短段落和装饰表的证据。
- [厦门 PDF 机器解析报告](P3_XIAMEN_DEBT_PDF_VALIDATION.md)：原次受限 PDF 解析返回 `pdf_page_no_text`，不代表全部页或字段结论。
- [厦门单页人工复核](P3_XIAMEN_MANUAL_REVIEW.md)：保存的 PDF/PNG 哈希及可见字段人工比对；明确不把人工复核当作机器正文成功。
- [来源矩阵](SOURCE_MATRIX.md)：现存源状态和固定样本结果。会计司/厦门均未因此获得启用、发布或正文覆盖验收。

所有 source 保持 disabled、`site_fulltext=false` 与 `syndicate_fulltext=false`。本文不更改既有正文状态，不扩大 Gate 结论；Gate 2 仍 `NOT_PASSED`。
