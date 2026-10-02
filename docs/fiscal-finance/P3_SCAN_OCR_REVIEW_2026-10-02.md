# P3 固定扫描 OCR 准备批次独立复核（2026-10-02）

STATUS=固定样本 OCR 未运行；训练文件准备未完成。
GOLD_REVIEW=NOT_RUN。
OCR_RUN=NOT_RUN。
GATE_2=NOT_PASSED。

## TASK

独立只读复核 10/2 正式 S1 批准的新语言文件准备记录及 OCR 输出。核对固定 commit 和 URL、单次请求、EOF/实际字节、hash/license manifest、旧失败记录是否保留。只有存在五页 raw TXT/TSV 时才按位置/行列映射与人工 gold 比较。本复核没有发请求、没有重跑准备或 OCR，也未写数据库。

## MODEL

Luna High；未调用仓库运行时模型。

## FILES_CHANGED

只新增本文。只读 `.data/fiscal-qa/scan-ocr-poc-20261002/` 新批次记录和 9/30 原失败记录；未修改 prepare manifest、旧失败目录、训练文件、输入图、OCR输出、执行器、数据库或正文状态。

## TESTS_RUN

未运行测试、OCR、Tesseract、worker 或模型。对新旧 attempt/failure/manifest 做只读字段与 SHA-256 核对，并检查新批次目录文件清单。新目录仅含 `prepare-attempt.json`、`prepare-failure.json`、`manifest.json` 和空 `tessdata/`；没有模型、许可证、逐页 `.txt`/`.tsv`、candidate 记录或 `run.json`。

## RESULT

### 新准备批次

正式 S1 批准的固定 commit 是 `87416418657359cb625c412a48b6e1d6d41c29bd`。`prepare-attempt.json` 记录该 commit 与两条批准的精确 URL；实际请求记录只有一次：

`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/chi_sim.traineddata`

该次返回 HTTP 200，状态为手动重定向模式；响应 `Content-Length=2,469,156` bytes，实际收到 `16,384` bytes，`eofComplete=false`，失败为 `TypeError: terminated`。开始于 `2026-10-02T05:03:02.058Z`、结束于 `05:04:12.780Z`，记录耗时 `70,722 ms`。这是流提前终止，**不是120秒期限耗尽**。日志不记最终完整文件，也没有可供复算的模型 SHA-256。

记录中没有第二次调用、重试或许可证 GET；批准的 LICENSE URL 虽保存在尝试意图里，但许可证内容、名称和 SHA-256 均未取得。当前批次实际记载 1 个请求。`redirect="manual"` 是请求方式记录；没有独立 wire-level redirect trace，不额外声称经另一计数器证明了全局网络路径。该中断发生在总 240 秒期限内，收到错误后停止，没有用剩余额度继续许可证请求。

`manifest.json` 明确为 `status=incomplete`、`trainedDataComplete=false`、`runnable=false`、`modelSha256=null`。新目录没有语言模型、许可证文件或 hash 摘要。Content-Length 小于32 MiB并不代表响应正文完整。

新批次文件 SHA-256：

| 文件 | SHA-256 |
|---|---|
| `.data/fiscal-qa/scan-ocr-poc-20261002/prepare-attempt.json` | `1e7f817591d01221afa874fa912146fc85b034c196fb983e50ffadc71e206de9` |
| `.data/fiscal-qa/scan-ocr-poc-20261002/prepare-failure.json` | `36134f6fc0b1e1c255a551a5e17baa79efc2e3825f5a3f3ad98fdfb4274cdc0d` |
| `.data/fiscal-qa/scan-ocr-poc-20261002/manifest.json` | `8f1efce277582f193a47173f2e333fe9e9b345dc5aafda0a1be8cc83d381992e` |

### 旧失败状态和人工 gold 对照

9/30 的旧失败目录仍存在且 SHA-256 与 9/30 独立复核记录相同：旧 `prepare-failure.json` `eab8f1b69a2953e705474ad2a3833845bd91e6cfb11ae04652cc34d67d83bc70`，旧 `manifest.json` `453258fde1fc964a51d9cb70b08c392668da831dd8c825b28222b96fce8628d6`。新批次没有覆盖或清理旧证据。

本次没有可读取的机器候选，以下项目全部为 **NOT_RUN / 无法判定**：

- 福建：23 行各自的中标机构、存款额、利率、预计利息，以及23/23行的行列关联；两项合计、100亿元规模、一个月期限、2026-09-16起息日、2026-10-16到期日；文号、公告标题/日期、页3定价说明与机关落款、页4主动公开及印发信息。第21与23行同名银行必须在机器输出中保持独立行，现无TSV坐标/行记录可检查。
- 厦门：人工复核表所列全部14个字段：发布机构、标题/期次、招标日期、债券编码、计划发行规模及单位、实际发行规模及单位、期限“7年（5+2年，含权）”、1.55%票面利率、100元发行价、12月/次付息频率、付息日、选择/未选择赎回时两种到期日、签章日期。没有 OCR raw TSV/TXT，无法核实任何字段来自标题、表格指定单元格或日期/签章位置。

没有把 machine matches/mismatches/missing 记成0，没有计算准确率。既有人审金标准与原始五图仍是独立证据，不能补作 OCR 输出。印章细字与二维码继续 `unknown`。

## RISKS

- HTTP 200 只说明响应头状态；实际流 16,384 bytes 后以 `TypeError: terminated` 结束，EOF 不完整。不得把 Content-Length 当已收全长度，或把该次写成120秒超时。
- 不完整 manifest 不具备可运行身份；模型/许可证的本地 SHA-256、LICENSE 名称与原文缺失。没有 raw OCR 输出就不能核算字段、错行、置信度、耗时或本次 OCR RSS。
- 人工 gold 的正确性不代表机器命中；本复核未启动 OCR，也没有把人工转录投喂成 candidate。
- 新批次遵循失败即停止边界，但未有独立实际重定向事件计数。此审计只陈述目录中记录的单次请求，不推断整个主机的其他网络活动。

## BLOCKERS

训练文件流提前终止，无模型 SHA-256、许可证或 runnable manifest；新准备失败后没有五页 OCR 输出。`GOLD_REVIEW=NOT_RUN`，不能评为 partial、matched 或 failed field rate。Gate 2 继续 `NOT_PASSED`。

## NEXT

保留本轮 incomplete manifest 与旧失败记录；本报告不请求重试或用剩余预算补许可证。若后续需要新准备批次，须由 Lead 另行授权并执行新的固定范围审查。只有取得完整、可核验的模型和许可证并留下逐页 raw TXT/TSV 后，独立 reviewer 才能按页内位置逐行检查上述 gold 字段。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立只读审计新一次固定 commit 两文件准备批次，存在 OCR raw 输出时逐项对照福建及厦门人工 gold；本次确认产物状态。

**MODEL**：Luna High；未调用 OCR 或仓库运行时模型。

**FILES_CHANGED**：新增本报告；其他均只读。

**TESTS_RUN**：无。只读核对固定 commit/URL/请求记录/EOF/manifest、新旧失败文件 hash 与 OCR 输出存在性。

**RESULT**：模型一次请求 200 但只读到16,384/2,469,156字节，约70.7秒后 `TypeError: terminated`，EOF不完整；无LICENSE请求、hash、可运行manifest或OCR输出；金标准比较 `NOT_RUN`。

**RISKS**：不完整响应不能以 HTTP 200 或 Content-Length视作模型文件；无TXT/TSV不能评价字段识别或位置关联。

**BLOCKERS**：模型和许可证身份未完成，无固定五页 OCR候选。

**NEXT**：保留失败记录；不重试、不运行OCR。后续如重新授权，须另有通过前置条件的新准备批次。
