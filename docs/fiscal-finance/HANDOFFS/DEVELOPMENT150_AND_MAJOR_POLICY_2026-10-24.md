# Development 150 与重大民生政策检查点（2026-10-24）

## 当前边界

本交接记录开发集复测与新业务偏好的恢复状态，不替代全局状态或正式Gate裁决。当前仓库为 `D:\AI-work\MYHOT\AIHOT`，分支 `feat/fiscal-finance-hot`，代码检查点 `d45f0d93f5374b7c72cdf0efb64ada6a03b84404`，基线 `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。截至本次文档更新，执行方报告 d45 已完成 NAS Staging app-only 部署和执行后检查；独立只读QA仍待完成，因此这是执行侧PASS、独立验收待核的状态，不代表任何正式Gate通过。执行日志由NAS部署执行方保管，本地此交接不声称独立复核其日志字节或SHA。

用户确认的两项范围为：“国家级重大民生政策也纳入，即使没有明确财政金融安排”；“央行日常公告放在全部动态，出现重要操作或政策变化时才精选”。站点栏目新增第九个类别 `major-livelihood-policy`（重大民生政策），`ITEM_TYPES` 仍固定为八种；现有栏目slug、评分权重、T1/T1.5/T2门槛60/65/76及 `understandFloor=50` 均保持。代码和提示词将类别约束为国家层级、具有实质重要性的民生政策，不仅凭发布机构认定，普通科普和仅地方活动不归入；这是实现规则，不是用户原话。实现位置见 [taxonomy](../../../industry/taxonomy.ts)、[selection thresholds](../../../industry/selection.ts)、[prefilter prompt](../../../industry/prompts/prefilter.md)、[content-understanding prompt](../../../industry/prompts/content-understanding.md) 和 [policy tests](../../../tests/industry-prompts-policy.test.ts)。

当前代码测试状态由Root报告为475项、473通过、0失败、2跳过，另有typecheck、Web build及Web tests 22/22通过。本交接目录没有对应的完整测试日志可供独立复算或SHA绑定；不要把旧Gate文档记录的474项结果当成本次运行结果。当前代码的测试源和策略文件SHA见下方证据表。

## Development 150 离线评估

本轮只用150条development样本，没有再次使用fresh50作调参。既有prefilter-only阶段得到87 PASS、63 BLOCK、0 UNKNOWN；后续评分只评87条PASS。有效评分链由verified byte-bound的score pass 1 rerun与原有效pass 2组成，按现有native evaluator规范适配、归一化并评估；原始失效pass 1因输入SHA绑定不匹配而保留为诊断材料并排除，没有事后挑选轮次。rerun的输入绑定与元数据由程序读取实际字节生成、验证，没有人工回填SHA。

150条上的二元结果为TP=11、FP=23、FN=15、TN=101，precision=32.35%、recall=42.31%、F1=36.67%、accuracy=74.67%。87条双轮评分的MAE约6.21，11条跨越T1门槛；这些数值表明开发集表现和评分稳定性仍不足以支持质量改善或自动精选可用的结论。旧development记录为precision 31.25%、recall 57.69%、F1 40.54%；新旧轮次的prefilter与评分输入不同，比较仅作非因果参考。

这是一条native offline评分链，不是完整provider pipeline：没有provider receipt、线上推理或理解质量评测，也没有用临时值代替understanding quality。一个开发集正文超过冻结user-prompt的60,000字符上限，按合同截断；provenance只声明完整冻结user prompt已读，不声称模型读过cap之外正文。评估数据、原始提示、应用和Gold均未因本轮结果改写。

独立文档/评测链QA结果为 `PASS_INDEPENDENT_DOCUMENT_AND_EVALUATION_QA`：17条handoff hash行、45项链路文件字节绑定均通过；prepared与预测ID覆盖development150且与holdout50无重叠；原始pass1错SHA会话已排除，替代run的input与prereceipt/contract及pass2 input/output均绑定。机器生成报告位于ignored文件 `.data/fiscal-qa/development150-native-offline-20261023-v1/stage5-error-diagnosis-20261024/independent-doc-qa.json`，SHA-256由本地读取实际字节计算为 `c5ee340be886f4d48a5097def61844517de9d35a5aa42bc0f73e195c22ea00c1`；该私有sidecar不在Git仓库中。

错误审阅仅限本轮development错例。已确认的用户业务范围是金融监管优先覆盖财政支持金融、金融企业财务和金融风险；其他财政监督条线优先重大政策。青岛零基预算地方综合改革与云南一般转移支付问题发现已按此范围解释，不再作为待确认问题；金额较大或细节丰富本身不构成精选理由。审阅建议的最小规则边界是：普通地方非金融条线的例行总结，即使有金额或方法，也不自动进入高优先级；要看是否有重大政策、可迁移改革、清晰监管措施或重要结果。该建议没有修改提示词、标签或阈值。

## 尚待用户确认的两条既有标签

以下两项仍是待确认问题。Gold200清单未重写，当前仍记录29 select、171 reject；不能将待确认问题描述成已改标或新评测结果。

| Case | 已记录标签与材料 | 待决原因 |
|---|---|---|
| `body-ae5isrwhicwsmuwh46ambcsdj` | `select`（人审确认时间 `2026-10-22T04:46:31.459Z`）；《财政部河北监管局：雄安监管处党支部下沉一线学习习近平总书记关于基层工作方法的重要论述》，[来源页](https://he.mof.gov.cn/caizhengjiancha/202609/t20260928_3998180.htm)。正文主要是学习、走访、听取意见和后续安排，没有明确政策、问题结论、监管措施或结果。 | 现有一般党建/学习类噪声范围通常会拦截；人审select与正文业务事实之间需用户定夺。 |
| `body-tgeiy876jupck9vsd9nq6d827` | `select`（人审确认时间 `2026-10-21T13:46:22Z`）；《关于第八次全国优秀财政理论研究成果拟推荐名单的公示》，[来源页](https://czt.fujian.gov.cn/zwgk/tzgg/202609/t20260921_7216502.htm)，公示期2026-09-21至09-28。正文是名单公示和附件提示，没有呈现研究结论。 | 需判断仅名单公示是否仍应保留select；目前标签未更改。 |

两个问题尚无用户答复。不要自行重标或根据fresh50个案外推。对应标题和来源URL以原始开发样本/本地只读诊断记录为准；本地 `.data` 文件是ignored工作区证据，不是GitHub可下载工件。

## Gate 与后续

[Gate 3 review](../GATE_3_REVIEW.md) 的正式裁决仍为 **CHANGES_REQUIRED / NOT_PASSED**；development150这轮结果没有改变裁决。Gate 4和Gate 5仍未通过。Gate 5备份/恢复审查中row hash 64/64、table inventory 64/64及sequence 16/16只是其中一个子项，不能表述为Gate 5通过。Gold200维持原清单与29/171计数，fresh50已消费，不得重新作为未触碰留出集或用于继续调参。

下一步依次为：完成 d45 Staging 部署的独立只读QA；等待河北纯党建和福建理论成果名单公示两项既有标签问题的用户答复；随后按有限批次处理剩余321条pending正文，沿已批准的安全与证据流程推进。不得覆盖Gold200原标签、将fresh50重新称为未见holdout，或把开发150结果用于立即调整prompt/阈值。

## 证据文件 SHA-256

下列SHA均由本地脚本读取对应文件的实际字节计算，并逐项校验长度为64位十六进制；该验证也逐项确认文档声明与实际文件SHA一致。`.data` 路径仅是本机ignored证据，不能作为仓库下载链接。

| Evidence | Path | SHA-256 |
|---|---|---|
| Taxonomy | `industry/taxonomy.ts` | `206da25c406433ad632d4bbebd811182d5beeba22e8d4e2dc260a0935ce3271b` |
| Selection thresholds | `industry/selection.ts` | `95e1cdf68df89d6aba6e769aeea4255a856dbe13bfe86293eac50181778916c7` |
| Prefilter prompt | `industry/prompts/prefilter.md` | `ae25e4ebdb0fe800d13db01b05e4143342a1d842d57c91b33ec9f0d2c11aff0d` |
| Content understanding prompt | `industry/prompts/content-understanding.md` | `b527944cc512abb0fd284dfb7a357c2ef4b8eac704f833d23001797ab9d1522d` |
| Selection score prompt | `industry/prompts/selection-score.md` | `3159b562c56d14cf9d5438ee20c6fa663b49904df39d6afa825c01ab8bf0d18c` |
| Policy tests | `tests/industry-prompts-policy.test.ts` | `aad71f4f92b74603a68f81b38d083ce79c31b85104859c412f87270ecbbb6c0d` |
| Gate 3 decision | `docs/fiscal-finance/GATE_3_REVIEW.md` | `52210f22259b92773658796e8cef7330168be51bf53c44f9f3d44e62c0eb7222` |
| Evaluation chain proof (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage4-evaluation/evaluation-chain-proof-development150.json` | `61d085a0e563d33196c8ad442c0046959525397a1a8f5c6d8a78bd861a0f0ccf` |
| Evaluation metrics (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage4-evaluation/evaluation-development150-rerun.json` | `f4ca3ad52ad65a04cd2d20d08837d324d21ab903ea9a9c1e0ac1fa43251bd3a1` |
| Evaluation QA (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage4-evaluation/evaluation-qa-summary-development150-v2.json` | `b30d1b40f0812c05d3da1a9605cfb43204ebb4c62d47b8809751ccca0e5d22af` |
| Prepared development set (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage1-prefilter-v2/prepared-development150.json` | `dffc45922708b39ead95f54b0e3024af39b806402e1328de7ac7d4522529e99a` |
| Normalized predictions (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage3-normalized/predictions-development150-rerun.json` | `0b2a49bb230d71f1c472f46505961d7c3cbb6f0975462fbcbdb97158e8053ed0` |
| Verified pass 1 adapted output (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage2-score-blind-v1/score-pass-1-rerun-results-adapted.json` | `2a61afe0bf634fc2ab7d7eef947411cc698ddc49eb32e35e1c42149933c0e0ac` |
| Pass 2 adapted output (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage2-score-blind-v1/score-pass-2-results-adapted-v2.json` | `d1333cc36211d049a9e317505a2888cf830afba6ae1a81b4dd0c3643c804dccd` |
| Gold200 manifest (local-only; unchanged) | `.data/fiscal-qa/holdout-review-20261023/gold200-reviewed-manifest.json` | `d47666e96cfae7b0a4c183874a9acbe6c6db8863ca3d061f51781f3b6a9420af` |
| Development error diagnosis (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage5-error-diagnosis-20261024/development150-error-diagnosis.md` | `ab5c2d240da53037ccde018bac457da37638ecd603957bd06f22bbcd0f236aee` |
| Error-report hash verification (local-only) | `.data/fiscal-qa/development150-native-offline-20261023-v1/stage5-error-diagnosis-20261024/evidence-hash-verification.json` | `7deea5c21b2008f2b4045c1de51ac07fc59590a097da6a8aa01717c3bf69312f` |

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：记录重大民生政策更新与development150离线评估恢复点。
**MODEL**：本次未发起模型调用；总结已完成的native offline结果。
**FILES_CHANGED**：本次恢复点涉及handoff、STATUS、PROJECT_PLAN和SELECTION_RULES四份文档；不改源码、Gold标签或NAS数据。
**TESTS_RUN**：本次独立文档/评测QA验证17项handoff hash行及45项链路字节绑定，均通过；未重跑模型或应用测试。代码475项/473通过/0失败/2跳过、typecheck、Web build及Web22/22为独立测试报告结果。
**RESULT**：development150有效评估P=32.35%、R=42.31%、F1=36.67%；Gate 3仍CHANGES_REQUIRED。Staging app-only部署执行侧报告PASS，独立只读QA待完成；Gate 4/5未通过。
**RISKS**：样本仅development；fresh50已消费；native offline结果不能代表provider pipeline；understanding quality未评；一个正文受60k冻结prompt上限截断。
**BLOCKERS**：河北纯党建和福建理论研究成果名单公示两项既有标签问题等待用户确认；Staging部署的独立只读QA待完成。
**NEXT**：完成Staging独立QA；根据用户对两项旧标签的答复决定后续处理；按有界批次继续处理321条pending正文。
