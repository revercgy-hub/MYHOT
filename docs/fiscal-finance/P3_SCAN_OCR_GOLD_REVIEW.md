# P3 固定样本 OCR Gold 独立复核（2026-09-30）

DATE=2026-09-30（Asia/Shanghai）
REVIEWER=Luna High
GOLD_REVIEW=NOT_RUN
OCR_RUN=NOT_RUN
GATE_2=NOT_PASSED

## 结论

本轮没有可供逐页、逐行、逐字段核对的 OCR 输出。官方 `chi_sim.traineddata` 请求的响应流在 30 秒 deadline 到达时被中止；没有完整语言文件或 SHA-256，PoC 的 OCR 阶段未启动。`.data/fiscal-qa/scan-ocr-poc/` 目前只有 `prepare-failure.json` 与不完整 `manifest.json`；未找到训练数据、`upstream.json`、任何逐页 `.txt`/`.tsv`、`run.json` 或机器候选字段。

因此，福建 23 行机构/存款额/利率/预计利息、合计、期限和日期，以及厦门债券公告 14 个字段的 OCR 对照均为 **NOT_RUN / 无法判定**。本报告不为不存在的 OCR 输出编造 `match`、`mismatch` 或 `missing` 数量。已有人工 gold 仍分别由[福建人工独立复核](P3_FUJIAN_TRANSCRIPTION_REVIEW.md)和[厦门人工独立复核](P3_XIAMEN_MANUAL_REVIEW.md)支持；它们不是 OCR 命中证据，也不改变机器正文状态、来源验收或 Gate 2。

OCR 执行记录见 [P3_SCAN_OCR_POC_RESULT.md](P3_SCAN_OCR_POC_RESULT.md)。这里的独立工作只核对其 ignored 失败记录、产物是否存在和固定输入图像身份，不重跑 OCR、语言文件准备或官网请求。

## 准备失败证据

只读检查 `.data/fiscal-qa/scan-ocr-poc/prepare-failure.json` 得到以下记录：

| 记录序号 | URL | 状态 | 已记录内容 | 结果 |
|---:|---|---:|---|---|
| 1 | `https://api.github.com/repos/tesseract-ocr/tessdata_fast/commits/main` | 200 | 4,358 bytes；SHA-256 `8B63053AD3BDD7B131B45C8364D6C289ECE15972678DAB4392EE11C76DD42706`；记录完成时间 | 用此返回值拼出的固定 commit 为 `87416418657359cb625c412a48b6e1d6d41c29bd`，但 API 响应正文没有作为独立文件留存。 |
| 2 | `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/chi_sim.traineddata` | 200 | 记录开始时间与 `AbortError: This operation was aborted`；没有字节数、hash 或完成时间 | 流未完成，不能确认完整文件、身份或可用性；未继续 OCR，也未重试。 |

准备脚本对请求使用 `redirect: "manual"`，第二项是一次记录的 fetch 调用。失败记录没有 Undici hop/redirect 计数，因此本报告只引用两条请求记录及其返回字段，不把它们改写成经独立工具证明的总 HTTP hop 预算。失败目录没有保存 API 响应原文、完整语言数据或 `upstream.json`；训练文件 SHA-256 为 **不存在/未知**。此状态不满足 PoC 批准的语言文件身份前置。

失败目录中的 `manifest.json` 进一步记录 `status=incomplete`、`trainedDataComplete=false`、`runnable=false`、`modelSha256=null`、`modelBytes=null`、`licenseFetched=false`、`OCRStarted=false`，并将 commit 与 `prepare-failure.json` 关联。它是失败状态清单，不是成功下载的 upstream manifest。

我对这两份现存 ignored 证据文件只读计算的 SHA-256 为：`prepare-failure.json` = `EAB8F1B69A2953E705474AD2A3833845BD91E6CFB11AE04652CC34D67D83BC70`；`manifest.json` = `453258FDE1FC964A51D9CB70B08C392668DA831DD8C825B28222B96FCE8628D6`。API 内容 hash 是失败日志记录的值；因为响应正文没有单独留档，本次无法从原文重算它。

## 固定输入身份与 Gold 范围

我只对现存输入图做 SHA-256 只读核验；五张图的值与既有人工复核记录一致：

| 固定页 | 本地既有图像 | 本次只读 SHA-256 | 对应人工 gold |
|---|---|---|---|
| 福建 1 | `.data/fiscal-central-audit/rendered/fujian-1.png` | `0D40BD4CCCBE928AC564185F089D177991C6DFD758CF732296E542872C7A016A` | 第 1–3 行及机构、文号、标题、表头 |
| 福建 2 | `.data/fiscal-central-audit/rendered/fujian-2.png` | `F577BAC70BAAF3E9BABB855FBBB6284DFBAA47B38A4F5A744F2C13D8A9CCE97E` | 第 4–23 行、两项合计、100 亿元、一个月及起止日期 |
| 福建 3 | `.data/fiscal-central-audit/rendered/fujian-3.png` | `06AD562A74E89003122DBB1197698420B93E8DF37AAB49493DB118D1DDD9253A` | 定价说明、机关落款和签发日期 |
| 福建 4 | `.data/fiscal-central-audit/rendered/fujian-4.png` | `F8856773CC55744FF6246724CDC464C309F51EE45028254901320B98F89D00F8` | 主动公开标记、办公室印发日期；印章小字/二维码未知 |
| 厦门 1 | `.data/fiscal-qa/xiamen-debt-round16-page.png` | `B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D` | 标题/期次、日期、债券编码、计划/实际规模、期限/含权、利率、价格、付息及到期日 |

这些 hash 只确认固定输入与既有人工 gold 报告所列图像一致，不证明 OCR 的文本、字段框或表格行列。根据两份 gold 报告，本次原计划的字段比较范围是福建 23×4 个表格单元格及合计/期限/日期等公告字段，以及厦门人工复核表的全部 14 项；实际 OCR candidate 数量为零，故未产生可按页坐标或表格单元格关联的 candidate。

| 样本 | 计划字段范围 | candidate / 页内位置证据 | 结果 |
|---|---|---|---|
| 福建 4 页 | 23 行各自的机构、存款额、利率、预计利息；合计、规模、期限、日期及其他已列公告字段 | 没有 `.txt`/`.tsv`/候选行记录，无法建立行号与同页坐标对应关系 | `NOT_RUN`；差异无法判定，不计 match/mismatch/missing |
| 厦门 1 页 | 已双核 gold 报告列出的全部 14 个业务字段 | 没有 OCR `.txt`/`.tsv`/candidate，无法证明字段来自标题段、指定表格单元格或签章位置 | `NOT_RUN`；差异无法判定，不计 match/mismatch/missing |

现存人工 gold 对相应图像的既有结论仍为：福建 23 行机构和三类数值、总额、期限/日期与图像一致；厦门人工表所列 14 字段与单页图像一致。该结论引用其独立人工复核，不在此重新声称完成 OCR 比较，也没有用视觉 gold 补齐机器输出。

## 状态及限制

- `chi_sim` 训练数据未完整下载，没有可核验的训练文件 SHA-256 或许可证副本；未执行 Tesseract OCR CLI。
- 没有逐页 OCR 原始文本、TSV、字段候选、识别置信度、页面完整性输出、Tesseract 本次运行耗时或本次运行内存采样；这些项均为 `NOT_RUN`，不能解释为 0、成功或失败字段数。
- 静态只读检查执行器可见 `OCR_RUN_ENABLED=false`，且 `run()` 首行会拒绝执行；本次未调用 `run`，也没有验证任何原生子进程资源监控行为。
- 预设的福建固定单元格脚本和测试只说明候选提取/比较代码的设计，不构成本轮候选数据。厦门自动字段映射在脚本中原本也未实现；由于没有 OCR 输出，本轮不据此单独推断任一厦门字段的识别质量。
- 已接受的福建、厦门人工 gold、机器正文 `unconfirmed` / `pdf_page_no_text`、来源禁用状态及 Gate 2 状态互不替代。OCR 准确率、表格错行风险及运行资源仍未测得。
- 本次独立复核没有发出网络请求、重跑 OCR、运行 Tesseract、调用模型、数据库、worker 或 publication；没有更改 `.data` 失败产物或业务状态。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立核验固定五页 OCR PoC 是否有可用输出，并在有输出时按同页位置与已双核人工 gold 逐字段比对；无输出时如实记载无法判定。

**MODEL**：Luna High；未调用仓库运行时模型或 OCR。

**FILES_CHANGED**：仅新增本文；只读 `.data/fiscal-qa/scan-ocr-poc/prepare-failure.json`、五张既有 PNG 与两个既有人工 gold 报告。未修改 PoC 执行器、OCR 原始输出、语言文件、来源配置、数据库或其他业务状态。

**TESTS_RUN**：未运行 OCR 或测试套件。只读盘点 ignored 目录内两份失败状态文件、读取请求记录和源代码的 fail-closed flag，并对固定五张 PNG 计算 SHA-256，与人工 gold 报告中的记录比对；五项均相符。只读核对[PoC 执行结果](P3_SCAN_OCR_POC_RESULT.md)也记录为 `BLOCKED_BEFORE_OCR` / gold comparison `NOT_RUN`；未重跑其命令或测试。无官网请求或重试。

**RESULT**：`GOLD_REVIEW=NOT_RUN`。第二个固定语言文件 fetch 记录 status=200 但在 deadline 时 `AbortError`，流未完成且无字节数/hash；OCR 未启动，逐页 candidate 不存在。机器字段差异无法判定；人工 gold 仍仅作为先前被接受的独立样本证据。Gate 2 维持 `NOT_PASSED`。

**RISKS**：不能从 HTTP status 200 推断训练数据下载完整；没有 SHA-256、原始 OCR 输出或资源数据就无法评价识别准确率、字段/行关联、性能和资源边界。失败准备记录没有实际 hop trace，不能由此宣称网络预算审计通过。

**BLOCKERS**：本轮固定样本 OCR 缺完整且身份可核验的中文训练数据；Gold 独立机器对照没有可读 candidate。本文没有重试或提议超出授权的网络动作。

**NEXT**：按 [P3_SCAN_OCR_POC_RESULT.md](P3_SCAN_OCR_POC_RESULT.md) 保留准备失败事实；若以后要重做训练数据准备，须由 Lead 重新明确授权并满足离线可审计预算/文件身份前置。只有生成固定 5 页 raw `.txt`/`.tsv` 和 manifest 后，另一位 reviewer 才能按同页坐标复核全部目标字段。不得把本次 `NOT_RUN` 写成 OCR partial/pass、机器正文 `ok`、来源通过或 Gate 2 通过。
