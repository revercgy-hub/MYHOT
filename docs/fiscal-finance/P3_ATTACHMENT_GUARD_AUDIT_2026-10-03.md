# P3 正文附件 guard 离线 characterization（2026-10-03）

STATUS=现有 helper 的附件识别与拒绝顺序已由 offline fixtures characterization。
STAGE=P3 正文质量诊断。
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED。

## TASK

仅用固定 HTML fixture 描述 `extractSelectedBody()` 当前对 PDF 外观链接的识别范围、拒绝顺序及边界。没有修改 backend、apps、行业 source 配置或既有 guard；没有联网、数据库、模型、OCR 或附件请求。

## TESTS_RUN

`node --test tests/fiscal-attachment-guard.test.ts`：**5/5**。测试直接调用实际 `extractSelectedBody()` helper，并使用相同页面身份、+08:00 日期和 `minTextChars=200` 的 `bodyPolicies`。

Fixtures 位于 `tests/fixtures/fiscal-attachment-guard/`：business body 中的相对 PDF 链接、footer PDF、nav PDF、无 PDF 正文、query/fragment 中出现 `.pdf` 的普通链接、`type=application/pdf` 链接，以及带 footer PDF 的短正文。

## RESULT

当前 `pdfLinks()` 通过 `$("a[href]")` 扫描整张 HTML 文档，不限于已选正文容器。选中的正文非空后，只要任一 HTTP(S) anchor 的 URL `pathname` 以 `.pdf` 结尾，或 anchor 的 `type` 属性等于 `application/pdf`，`extractSelectedBody()` 即返回 `attachments_unprocessed`。测试确认：

- 正文内的相对 `.pdf` URL 会被识别，并按文章 URL 解析成绝对 URL；query/fragment 不改变 `.pdf` pathname 的识别结果。
- 正文外 footer 或 nav 中的 `.pdf` 链接也会导致同样拒绝，即使选中的业务正文没有附件链接。这证明整页扫描会让无关页面 chrome 拒绝正文。
- 完整正文无 PDF 链接时通过 helper。路径不是 `.pdf`、仅 query 值或 fragment 文本中含 `.pdf` 的链接不会触发；`type=application/pdf` 即使路径没有 `.pdf` 后缀也会触发。
- 附件 guard 先于页面身份和正文最小长度检查：身份错误且带 PDF 链接时结果为 `attachments_unprocessed`；将该链接改成仅 query 含 `.pdf` 的普通下载路径后，结果为 `identity_mismatch`。短正文加 footer PDF 先得到 `attachments_unprocessed`；同样将链接换为 query-only 后得到 `short_body_not_allowed`。

这里的“PDF”是 fixture 与 helper 对 URL pathname / `type` 属性的分类；测试没有下载文件，不能验证实际 MIME、文件内容、附件与业务正文的关系。

## REVIEW OPTIONS

本轮不改 guard。若要仅修正拒绝原因顺序，可由 Root 判断是否让身份校验先于全页附件检查；这保持 fail-closed，但不能避免无关 footer/nav 链接导致拒绝。若要消除该类误拒，需要决定附件候选应限于选中正文容器，还是通过显式文章附件区域来识别。直接只扫描正文会漏掉放在正文外的真实下载链接，故通用语义需 Root 在 S1 范围判断；当前不扩大实现，也不放宽保护规则。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：characterize 现有 attachment guard 在正文、页面 chrome、URL 后缀、query/fragment、content-type、相对 URL、identity 和长度边界上的行为。

**MODEL**：Luna High；未调用仓库模型服务。

**FILES_CHANGED**：新增 `tests/fiscal-attachment-guard.test.ts`、`tests/fixtures/fiscal-attachment-guard/` 下 7 个 HTML fixtures、本报告。

**TESTS_RUN**：focused test 5/5；测试纯本地、不连数据库或网络。

**RESULT**：确认不相关 footer/nav 的 PDF 外观链接会在身份/长度验证前拒绝页面；query/fragment 假后缀本身不触发，`application/pdf` type 属性会触发。

**RISKS**：实际附件 MIME 与业务关联无法由 HTML href/type 的离线 characterization 证明。

**BLOCKERS**：通用附件扫描范围及拒绝原因优先级是否调整，需 Root 决定 S1 范围；当前保持原 guard。

**NEXT**：QA 做独占文件 review 与 Git 提交；通用修改前由 Root 核定 S1 边界。

**GIT**：未 stage、未 commit。
