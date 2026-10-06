# 用户决定：本地OCR延后（2026-10-06）

STATUS=`OCR_DEFERRED_NOT_GATE2_BLOCKER`
STAGE=P3 / Gate 2 remediation；source evidence preparation仍进行中
BRANCH=`feat/fiscal-finance-hot`
DECISION_DATE=2026-10-06

## 决定与当前状态

用户认为本地OCR监控投入没有必要：现有信源中扫描附件较少，确有需要时可以再评估API识别。因此本地OCR及monitor工作退出当前主线；不继续修monitor、不运行probe或OCR，也不删除既有工具或失败证据。旧的软件检查点与native preflight结果保留原样，作为历史记录：[Phase C S1 OCR软件QA与preflight检查点](PHASE_C_S1_OFFLINE_OCR_SOFTWARE_QA_AND_PREFLIGHT_CHECKPOINT_2026-10-06.md)及[monitor失败诊断](../OFFLINE_OCR_MONITOR_FAILURE_ANALYSIS_2026-10-06.md)。

附件处理业务规则继续有效：扫描附件原始URL保留，正文标为待解析，附件无法可靠解析时不进入自动精选。此降级规则不代表该来源已通过验收，也不代表正文可用。

未来只有在实际需要时才评估API OCR，并沿用现有provider预算熔断与receipt流程。本决定没有启用外部API或模型、没有授权真实调用，也没有实现API OCR。

## Gate 2与恢复任务

Gate 2仍为`NOT_PASSED`。逐源栏目覆盖、分页与历史窗口、日期语义、正文业务质量、附件降级及跨周期重复证据尚未闭环。OCR延后不构成Gate 2 blocker，也不把这些未完成项视为通过。

下一项工作恢复为HTML、JSON和可读text-PDF来源的准入与小规模验证，按具体来源核验列表/分页、日期、正文内容、失败降级及跨周期重复；继续保持来源关闭，按各自已核准的范围开展工作。扫描图像识别不属于当前主线。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：记录用户将本地OCR投入延后的决定，同步项目计划、状态和Gate 2行动清单；不改代码或删除历史证据。

**MODEL**：GPT-6 Luna High。

**FILES_CHANGED**：新增本决策交接；更新`PROJECT_PLAN.md`、`STATUS.md`、`GATE2_ACTION_CHECKLIST.md`与`HANDOFFS/README.md`。旧OCR失败报告未改。

**TESTS_RUN**：仅检查文档与当前Git基线；没有运行脚本、软件测试、数据库操作、网络请求、OCR或provider/model调用。

**RESULT**：本地OCR状态为`OCR_DEFERRED_NOT_GATE2_BLOCKER`；保留现有实现、关闭开关和真实失败证据。附件URL/待解析/不自动精选规则保留。下一项为HTML/JSON/text-PDF来源准入与小规模验证。Gate 2继续`NOT_PASSED`。

**RISKS**：附件依赖的来源可能继续处于正文待解析状态；按现行规则不应据附件不可读的样本标记正文`ok`或自动精选。

**BLOCKERS**：Gate 2仍受逐源覆盖、分页/历史、日期、正文业务质量、附件失败降级和跨周期重复等未完成证据约束。API OCR不是当前已实现能力或获准操作。

**NEXT**：由后续负责人从HTML/JSON/text-PDF来源准入与有限验证继续。仅在未来有实际需求时，经既有provider预算与receipt流程评估API OCR；不得将此记录解释为当前API调用许可。
