# Gate 3 正式审查（2026-10-23）

## 2026-10-29 development整改复核增量

本轮复核10/26 e82e、Gold v2的development150既有结果：TP16/FP27/FN8/TN99，precision37.21%、recall66.67%；生成35条错例人工审阅包，独立重算各门槛计数。将T1由60提高至70时precision43.75%但recall29.17%，不足以据此确认校准完成。保持60/65/76，不改Gold和提示词、不读取fresh50调参。Gate 3继续CHANGES_REQUIRED。工具、证据和下一步见[Gate 3–5整改](GATES_3_5_REMEDIATION_2026-10-29.md)。下文为10/23原审查记录。

**RESULT=CHANGES_REQUIRED；Gate 3未通过。** 本次审查接受Gold200标签与分集证据、sealed新版holdout预测冻结链和只读native评测链；实际查准率与查全率不足以支持精选体系已校准可用。Root保留现有阈值60/65/76，不以holdout改阈值或提示。任务书§32未规定量化Gate3分数线，本审查不另造硬阈值。

## 按任务书退出条件审查

任务书§32要求从真实财政金融材料建立150–200条人工Gold，比较accuracy、precision、recall与不同threshold，再决定T1、T1.5、T2正式门槛；Gate 3的总条件是Gold Dataset校准完成后精选体系才进入可用状态。仓库[精选与校准合同](../../selection.md)还建议分开发集与留出集，并仅用开发集迭代以减少留出集泄漏。以下处置区分数据与评测链合格证据、效果不足和仍未完成的校准决定。

| 条件 | 审查结果 | 证据与限制 |
|---|---|---|
| 150–200条真实材料及人工标注 | **APPROVED** | Gold200为200/200 `user_confirmed`，共29 select、171 reject、0 either；其中150 development为26/124，fresh50 holdout为3/47。Gold200 manifest SHA `d47666e96cfae7b0a4c183874a9acbe6c6db8863ca3d061f51781f3b6a9420af`，fresh50 reviewed manifest SHA `1e13b03b3c56d1a62ae14c6a59278924a04a13fe4320bacebee591e5a7acdc79`，均由Gold validator报告`READY_FOR_EVALUATION`。本项只确认样本及标签真实、完整，不代表模型达到可用质量。 |
| 开发/留出分集与标签隔离 | **APPROVED（本次留出已消费）** | 150条development与50条事件隔离fresh holdout无case/event/body/source identity交集；新版预测冻结早于人工确认，freeze-QA记录`humanLabelsRead=false`。50条holdout仅覆盖T1来源，不能外推T1.5/T2。该fresh50已用于评测，今后不得称为未触碰holdout或重新作为未来独立测试。 |
| 冻结预测与评测输入链 | **APPROVED（新版主证据）** | 主文件 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/native-predictions-sealed-score11b6-20261022.json` SHA-256 `cc34bacb8ba729d52be305ba09cb92fed99cfecaa53c3d5635c71f09fcc07ede`，内digest `47ad42a840564659c5bbfce2ad009742111b9de8a4c02c20369c2a63859b6451`；freeze-QA SHA `f545e10f92459a58a47aaf9ead16b3259a41f7d94dab3fe9ec32bcd7786ecc40`。有效评分sessions是`/root/luna_sealed_scope_pass1`及`/root/luna_sealed_scope_pass2`，真实sealed raw结果SHA分别为`7ba3d2266f595eb9abef01ad4a413aff8e06c982e06d9a53e1d04c1af368b0a1`及`e448e28718247f8c66262adaf5ed0fbf7d6880291fa43300a8875093cfd131a1`；adapter输出文件SHA分别为`f0e65dcb3c2a8b9a2de68b4a2131b9450726ebb67fed160f432f65171defe8eb`及`b4bfef2ef999a021f14524415d428574ab8dcf6aea77bcd4919ad539f4e38400`，adapter proof SHA见评测交接。历史明确暴露threshold并作废的是`/root/luna_scope_score_pass1/2`，不是有效sealed会话，也不是旧832a17回合。 |
| Holdout离线评测 | **APPROVED（方法与复算链）** | 既有native evaluator仅读取冻结预测和人审Gold，无provider、数据库或worker调用。11b6覆盖50/50、0 errors，TP=1、FP=12、FN=2、TN=35；accuracy 72.0%、precision 7.69%、recall 33.33%、F1 12.50%。精确率与查全率Wilson 95%区间约1.4%–33.3%及6.1%–79.2%，且仅有3个人工正例，估计不稳定。结果文件SHA `aa600abba98ce9126bc597607fd716fdc4af794ad5a0cf18a742fce78c793f6f`。 |
| 评分一致性与threshold审查 | **CHANGES_REQUIRED** | 新版31个双轮评分条目中仅1项完全相同，绝对分差均值8.26、中位数6、P90 16、最大34；6/31条落在T1门槛60的两侧，blocked的19条无评分不计。holdout未做threshold sweep。开发集原结果为TP15/FP33/FN11/TN91，precision 31.25%、recall 57.69%、F1 40.54%；开发precision同样不足以支持“已校准可用”。不以同一holdout事后选门槛，也不以历史832a17结果弥补主证据。 |
| 错例审阅、正式门槛决定与可用性 | **CHANGES_REQUIRED** | 本轮仅将FP/FN作分层归因，未完成开发集修复后的独立复测与正式错例签收；任务书要求比较阈值并决定门槛，但现阶段依据不足以确认正式门槛或自动精选可用性。Root当前决定维持60/65/76。用户后来明确的业务偏好原文为：“国家级重大民生政策也纳入，即使没有明确财政金融安排；央行日常公告放全部动态，重要操作/政策变化才精选。”据此对prefilter与selection-score提示词作了最小更新，并有新增策略测试；这是响应用户明确偏好，不是基于fresh50选择规则或重新估计效果。开发150的prefilter-only验证正在准备；未完成开发集复测和正式错例签收。fresh50不可再用于调参。 |

## 旧版预测的边界

`score832a17`文件 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/native-predictions-fresh-holdout50-score832a17-20261022.json` SHA-256 `752bb2fcd8cad2194120b820030af627b73776ea9c724145f96e881cf7d0cae4`，内digest `26fd888da6e1e0acc37f807e6a45d1e936c5864b60d1fd13fc0dea34339791b0`，单独复算TP=1、FP=14、FN=2、TN=33，precision 6.67%、recall 33.33%、F1 11.11%。它对应`/root/luna_blind_score_holdout50_p1/p2`，作为历史冻结参考保留；旧packet含threshold字段，现有证据无法确认是否进入实际原生传输，盲性provenance有限，因此不进入主Gate判断，不与新版合并。

## Gate结论与后续边界

Gate 3当前为 **CHANGES_REQUIRED / NOT_PASSED**。接受数据、标签、冻结时序、隔离和离线评测链，不接受“已校准/可用”的结论。低precision、开发集表现和评分波动都需在开发集上继续解决；任务书和仓库文档没有具体通过分数线，因此不设新的数值门槛。阈值仍为60/65/76；Gold标签、权重、聚合逻辑和既有预测均未修改。提示词按用户上述明确偏好作了有限更新，之后的性能验证只使用development材料；这不改变本次Gate裁决。

本次holdout已经消费，只能用于本次一次性性能估计和错例归因。任何下一轮修改、规则选择或threshold比较必须先限制在development集；如需独立验证修复效果，应另取事件不重叠样本并在人审前冻结新预测。Gate 4的本地验收/来源覆盖和Gate 5的稳定运行/正式审查另行处理；本文不改变NAS数据、正文状态或业务运行状态。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：对fresh50 Gold评测作Gate 3正式审查，并按任务书要求形成证据判定。

**MODEL**：只审阅既有预测、评测与人审审计；未发起模型调用。

**FILES_CHANGED**：新增本Gate review；修订fresh50评测交接中的raw/adapter哈希标注；补充b4正文/摘要独立QA交接，更新STATUS与PROJECT_PLAN；用户明确偏好后，仅更新两份selection提示词和对应策略测试。未改Gold、预测、权重、阈值、数据库或NAS数据。

**TESTS_RUN**：核对Gold validator与两份native evaluator既有产物；独立复核冻结预测metrics、score disagreement、provenance及时间隔离。b4 `offline-parse` 19/1与冻结proposals一致。用户明确偏好后的最终软件树通过正确隔离的focused DB tests 3/3、full suite 474/472 pass/0 fail/2 skip、typecheck、Web build及Web tests 22/22；详细两DB preflight及日志hash见b4 handoff。两个skip分别为专库未配置的native-summary测试及测试自身显式skip的execute-captures用例。

**RESULT**：`CHANGES_REQUIRED`，Gate 3未通过；原因是holdout precision 7.69%、开发precision 31.25%、错例/正式门槛与开发集校准决策尚未完成。保持当前阈值。

**RISKS**：fresh50只有3个人工select且已消费；指标区间宽。样本仅T1，且评分轮间分歧明显。旧版832a17盲性证明有限。

**BLOCKERS**：用户已给出两项明确业务偏好；还需在development数据上验证更新后的prefilter与评分规则，并完成错例签收和正式门槛决定。不能把holdout作为未来未见测试。

**NEXT**：在development数据完成prefilter-only与后续评分评估，再由Root审查Gate裁决。需要独立修复效果结论时另取事件不重叠样本，并在人审前冻结预测。
