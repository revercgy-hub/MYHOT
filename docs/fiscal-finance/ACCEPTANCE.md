# 验收清单

## Gate 1：静态行业改造

- [x] taxonomy、ITEM_TYPES、category fallback、topics 与提示词白名单一致。
- [x] 主题 slug 稳定；主题组显示为机构、重点领域、内容类型。
- [x] 关于页、首页及用户可见行业语义已改为财政金融。
- [x] 专属扩展功能关闭；机构发布域名映射限于已核验的官方域名，当前条目见 `industry/taxonomy.ts`，来源证据见 `SOURCE_MATRIX.md`。
- [x] 对站点品牌、开发日志、示例 Gold 数据和用户可见表单占位文案完成 AI 行业残留检查与处理；条款模板保留待负责人确认。
- [x] Gate 1 测试与审查在其验收时通过。这里曾记录的 `npm test` 132/132、web tests 11/11 和 loopback smoke 30 项是当时的历史回归，不代表当前 HEAD 的测试结果；Gate 1 审查核销见 `GATE_1_REVIEW.md`。
- [x] Sol 完成一次架构 Review；三项最小修复由 Lead 核销，`GATE_1_REVIEW.md` 记录 `FINAL_GATE_STATUS=PASSED`。Review 本身不替代上述测试 Gate。

## Gate 2—5

- [x] Gate 2：正式状态为 `PASSED_FOR_BOUNDED_P4_PILOT`，只允许 `GATE_2_REVIEW.md` 列明的三个核心来源中逐篇身份、日期、正文及附件均核实通过的固定小样进入有界 P4 准备；不代表48项来源目录、35个地方局或无人值守采集全部通过。
- [ ] Gate 3：Gold Dataset 开发集与留出集完成，精选规则和门槛有评测依据。
- [ ] Gate 4：25—35 个高质量信源、本地完整页面与 smoke 验收通过。
- [ ] Gate 5：NAS Staging 连续运行、备份恢复、重启和故障恢复验证通过后，才允许 Production。

## 当前证据

本节以 2026-10-16 检查点为准，详细运行状态及其边界见 [STATUS.md](STATUS.md) 与[本轮验收 handoff](HANDOFFS/FISCAL_ACCEPTANCE_QA_2026-10-16.md)。行业目录目前有48项来源配置，JSON中全部disabled且站内/转发全文均关闭；目录规模和配置测试不等于来源准入或覆盖完成。预览库有104条摘要型预览记录；这些记录不含正文，首页精选目前仍为空，也不代表正式模型分析、receipt、评分、精选或Gold。预览库记录及安全字段以本次导入和独立核验材料为准。

现有P4/P5工具边界彼此独立：`scripts/fiscal/p4-pilot.ts`只对显式文章ID生成只读就绪/调用预算计划；它不调用provider、不写分析或发布结果，也不保留预算。`scripts/fiscal/p4-execute.ts`是单独的显式授权执行入口；没有执行报告时不能据pilot报告声称已完成评分或receipt。`gold/metadata-template.json`仍是待人工标注的草稿，`scripts/fiscal/gold-dataset.ts`只能核验其结构/完整性；proposal不等于人工Gold，validator就绪也不等于Gold评测或Gate 3通过。以上工具存在、测试通过或网页预览成功均不改变Gate。

PDF解析、附件诊断和固定样本人工正文resolution已有实现及逐项证据；结果只适用于各自冻结文章与附件。扫描页或仅页码文本不能冒充完整正文，解析能力和单篇人工resolution不构成全源附件覆盖。当前代码回归与preview smoke只证明其被测试的本地软件路径，不替代真实来源的栏目/90日分页/跨周期证据、P4内容质量结论、Gold人工标签、Gate 4完整页面与运行验收，或Gate 5 NAS备份恢复和稳定性验收。
