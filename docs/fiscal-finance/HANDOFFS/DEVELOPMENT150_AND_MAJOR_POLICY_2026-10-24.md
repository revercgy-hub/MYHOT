# Development 150 与重大民生政策检查点（2026-10-24）

## 当前边界

本交接记录开发集复测、新业务偏好与d45 Staging部署QA，不替代全局状态或正式Gate裁决。当前仓库为 `D:\AI-work\MYHOT\AIHOT`，分支 `feat/fiscal-finance-hot`，应用代码检查点 `d45f0d93f5374b7c72cdf0efb64ada6a03b84404`，基线 `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。d45于2026-10-24 02:15:43Z仅更新api/web app服务；实际镜像ID为`sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`。A独立只读QA结论为`PASS_WITH_DOCUMENTED_LIMITATIONS`，仅适用于本次Staging部署保护和公开面检查，不代表Gate 3/4/5通过，也不是本地fresh-preview验收。

独立QA结论sidecar `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/conclusion-v3.json` SHA-256 `66be92b12b5e771ff22a88a38c7160f58e6b5121fbc25f3fbcbabcda604dfa4a`；30/30只读Staging smoke sidecar `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/smoke-staging-v1.json` SHA-256 `9b3a282d52179df572dbc346bf7020dd96f737c3d92d2e86a3389a72e609d79a`。历史source/settings补证 `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/historical-source-settings-supplement.json` SHA-256 `00663d6f80b251fc1fe170ad6907405cf50fca455b7a93f8d0d3a5f397db7049`；可得历史source rowset hash与当前只读查询相同，但快照不是部署前即时MVCC，因此不声称全表在整个部署区间无变化。结论sidecar列出输入字节hash与限制；NAS执行审计日志由部署执行方的原始审计目录保管。

用户确认的两项范围为：“国家级重大民生政策也纳入，即使没有明确财政金融安排”；“央行日常公告放在全部动态，出现重要操作或政策变化时才精选”。站点栏目新增第九个类别 `major-livelihood-policy`（重大民生政策），`ITEM_TYPES` 仍固定为八种；现有栏目slug、评分权重、T1/T1.5/T2门槛60/65/76及 `understandFloor=50` 均保持。代码和提示词将类别约束为国家层级、具有实质重要性的民生政策，不仅凭发布机构认定，普通科普和仅地方活动不归入；这是实现规则，不是用户原话。实现位置见 [taxonomy](../../../industry/taxonomy.ts)、[selection thresholds](../../../industry/selection.ts)、[prefilter prompt](../../../industry/prompts/prefilter.md)、[content-understanding prompt](../../../industry/prompts/content-understanding.md) 和 [policy tests](../../../tests/industry-prompts-policy.test.ts)。

当前代码测试状态由Root报告为475项、473通过、0失败、2跳过，另有typecheck、Web build及Web tests 22/22通过。本交接目录没有对应的完整测试日志可供独立复算或SHA绑定；不要把旧Gate文档记录的474项结果当成本次运行结果。当前代码的测试源和策略文件SHA见下方证据表。

## Development 150 离线评估

本轮只用150条development样本，没有再次使用fresh50作调参。既有prefilter-only阶段得到87 PASS、63 BLOCK、0 UNKNOWN；后续评分只评87条PASS。有效评分链由verified byte-bound的score pass 1 rerun与原有效pass 2组成，按现有native evaluator规范适配、归一化并评估；原始失效pass 1因输入SHA绑定不匹配而保留为诊断材料并排除，没有事后挑选轮次。rerun的输入绑定与元数据由程序读取实际字节生成、验证，没有人工回填SHA。

150条上的二元结果为TP=11、FP=23、FN=15、TN=101，precision=32.35%、recall=42.31%、F1=36.67%、accuracy=74.67%。87条双轮评分的MAE约6.21，11条跨越T1门槛；这些数值表明开发集表现和评分稳定性仍不足以支持质量改善或自动精选可用的结论。旧development记录为precision 31.25%、recall 57.69%、F1 40.54%；新旧轮次的prefilter与评分输入不同，比较仅作非因果参考。

这是一条native offline评分链，不是完整provider pipeline：没有provider receipt、线上推理或理解质量评测，也没有用临时值代替understanding quality。一个开发集正文超过冻结user-prompt的60,000字符上限，按合同截断；provenance只声明完整冻结user prompt已读，不声称模型读过cap之外正文。评估数据、原始提示、应用和Gold均未因本轮结果改写。

独立文档/评测链QA结果为 `PASS_INDEPENDENT_DOCUMENT_AND_EVALUATION_QA`：17条handoff hash行、45项链路文件字节绑定均通过；prepared与预测ID覆盖development150且与holdout50无重叠；原始pass1错SHA会话已排除，替代run的input与prereceipt/contract及pass2 input/output均绑定。机器生成报告位于ignored文件 `.data/fiscal-qa/development150-native-offline-20261023-v1/stage5-error-diagnosis-20261024/independent-doc-qa.json`，SHA-256由本地读取实际字节计算为 `c5ee340be886f4d48a5097def61844517de9d35a5aa42bc0f73e195c22ea00c1`；该私有sidecar不在Git仓库中。

错误审阅仅限本轮development错例。已确认的用户业务范围是金融监管优先覆盖财政支持金融、金融企业财务和金融风险；其他财政监督条线优先重大政策。青岛零基预算地方综合改革与云南一般转移支付问题发现已按此范围解释，不再作为待确认问题；金额较大或细节丰富本身不构成精选理由。审阅建议的最小规则边界是：普通地方非金融条线的例行总结，即使有金额或方法，也不自动进入高优先级；要看是否有重大政策、可迁移改革、清晰监管措施或重要结果。该建议没有修改提示词、标签或阈值。

## 截至2026-10-24曾待确认的两条既有标签（10-25已修订v2）

以下内容记录10-24检查点当时的待确认状态。2026-10-25用户确认两项均为reject，结果只进入Gold v2 overlay；Gold200原始清单及数据库未覆盖。不要把本节的历史“待决”描述当成当前标签。

| Case | 已记录标签与材料 | 待决原因 |
|---|---|---|
| `body-ae5isrwhicwsmuwh46ambcsdj` | `select`（人审确认时间 `2026-10-22T04:46:31.459Z`）；《财政部河北监管局：雄安监管处党支部下沉一线学习习近平总书记关于基层工作方法的重要论述》，[来源页](https://he.mof.gov.cn/caizhengjiancha/202609/t20260928_3998180.htm)。正文主要是学习、走访、听取意见和后续安排，没有明确政策、问题结论、监管措施或结果。 | 现有一般党建/学习类噪声范围通常会拦截；人审select与正文业务事实之间需用户定夺。 |
| `body-tgeiy876jupck9vsd9nq6d827` | `select`（人审确认时间 `2026-10-21T13:46:22Z`）；《关于第八次全国优秀财政理论研究成果拟推荐名单的公示》，[来源页](https://czt.fujian.gov.cn/zwgk/tzgg/202609/t20260921_7216502.htm)，公示期2026-09-21至09-28。正文是名单公示和附件提示，没有呈现研究结论。 | 需判断仅名单公示是否仍应保留select；目前标签未更改。 |

截至2026-10-24两项尚无用户答复；其后用户已明确将两项都改为reject。Gold v2版本化记录，不覆盖原Gold200，也不使用fresh50作推断。对应标题和来源URL以原始开发样本/本地只读诊断记录为准；本地 `.data` 文件是ignored工作区证据，不是GitHub可下载工件。

## Gate 与后续

[Gate 3 review](../GATE_3_REVIEW.md) 的正式裁决仍为 **CHANGES_REQUIRED / NOT_PASSED**；development150这轮结果没有改变裁决。Gate 4和Gate 5仍未通过。Gate 5备份/恢复审查中row hash 64/64、table inventory 64/64及sequence 16/16只是其中一个子项，不能表述为Gate 5通过。Gold200维持原清单与29/171计数，fresh50已消费，不得重新作为未触碰留出集或用于继续调参。

下一步为：等待河北纯党建和福建理论成果名单公示两项既有标签问题的用户答复；b5最多20条历史capture复用scope正在独立QA，尚无CAS或新GET，不能据proposal称正文已导入；之后按获批的有限批次流程处理剩余321条pending正文。不得覆盖Gold200原标签、将fresh50重新称为未见holdout，或把开发150结果用于立即调整prompt/阈值。

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
| d45 independent staging QA (local-only) | `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/conclusion-v3.json` | `66be92b12b5e771ff22a88a38c7160f58e6b5121fbc25f3fbcbabcda604dfa4a` |
| Staging smoke 30/30 (local-only) | `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/smoke-staging-v1.json` | `9b3a282d52179df572dbc346bf7020dd96f737c3d92d2e86a3389a72e609d79a` |
| Historical source/settings comparison (local-only) | `.data/fiscal-qa/major-policy-category-staging-postqa-20261024/historical-source-settings-supplement.json` | `00663d6f80b251fc1fe170ad6907405cf50fca455b7a93f8d0d3a5f397db7049` |

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：记录重大民生政策更新与development150离线评估恢复点。
**MODEL**：本次未发起模型调用；总结已完成的native offline结果。
**FILES_CHANGED**：本次恢复点涉及handoff、STATUS、PROJECT_PLAN和SELECTION_RULES四份文档；不改源码、Gold标签或NAS数据。
**TESTS_RUN**：本次独立文档/评测QA验证17项handoff hash行及45项链路字节绑定，均通过；A独立Staging QA读取结论与source/settings补证，匿名审核API为401、后台审核页为302登录，公开页面/新类别/RSS/noindex检查及30/30只读smoke通过；未重跑模型或应用测试。代码475项/473通过/0失败/2跳过、typecheck、Web build及Web22/22为此前独立测试报告结果。
**RESULT**：development150有效评估P=32.35%、R=42.31%、F1=36.67%；Gate 3仍CHANGES_REQUIRED。d45 app-only部署QA为`PASS_WITH_DOCUMENTED_LIMITATIONS`；Gate 4/5未通过。恢复演练64/64行哈希、64/64表inventory及16/16 sequence state仅为Gate 5子项。
**RISKS**：样本仅development；fresh50已消费；native offline结果不能代表provider pipeline；understanding quality未评；一个正文受60k冻结prompt上限截断。source/settings历史对照只支持可得快照之间的行集比较，不是部署前即时MVCC，且不覆盖全部应用表。
**BLOCKERS（2026-10-24检查点）**：当时两项标签待用户确认；Gate 3校准决策与Gate 4/5正式验收仍未完成。10-25已在Gold v2 overlay中按用户确认修订两项标签，见下方新增检查点。
**NEXT（2026-10-24检查点）**：当时计划等待两项旧标签答复并继续b5流程；后续实际结果及当前工作见下方2026-10-25检查点。


## 2026-10-25 Gold v2复算与cd0双轮开发复测（后续检查点）

### Gold v2 fixed-prediction post-hoc

2026-10-25，用户确认河北纯党建学习、福建理论成果拟推荐名单公示两条development标签均由select修订为reject。此版本只进入版本化Gold v2 overlay/manifest，不覆盖原始Gold200或Staging数据库；Gold200 base仍200 confirmed/29 select/171 reject，v2为27 select/173 reject总计、development 24/126、holdout 3/47。所有预测均为既有冻结预测，重算只用development150，fresh50未读取且仍已消费。原始v1成绩未覆盖。

| Frozen prediction vintage | Original label vintage TP/FP/FN/TN; P/R/F1 | Gold v2 TP/FP/FN/TN; P/R/F1 |
|---|---|---|
| 832a17 historical reference | 11/26/15/98; 29.73/42.31/34.92% | 11/26/13/100; 29.73/45.83/36.07% |
| pre-e559 3159 baseline | 11/23/15/101; 32.35/42.31/36.67% | 11/23/13/103; 32.35/45.83/37.93% |
| actual e559 a003 candidate | 14/28/12/96; 33.33/53.85/41.18% | 14/28/10/98; 33.33/58.33/42.42% |
| cd0 22b candidate | 16/30/10/94; 34.78/61.54/44.44% | 16/30/8/96; 34.78/66.67/45.71% |

Both changed labels were predicted reject by every compared version; all v1→v2 confusion changes are label-vintage effects (FN−2, TN+2), not prediction changes or model gains. The earlier diagnostic `.data/fiscal-qa/gold-v2-posthoc-20261025/gold-vintage-posthoc-diagnostic.json` SHA `19e86d2592e8d61e98c9e852afb7a18c3b7aca9603cb0cf194c3b24a282fcd6e` mislabeled the pre-e559 baseline as e559. That file remains unchanged for audit. The corrected canonical comparison is `.data/fiscal-qa/gold-v2-posthoc-20261025/gold-vintage-posthoc-diagnostic-final-v3.json`, SHA `7595b2602696e7fea2e081da52c5933b5ec2ac56c18241e095388fa19acabd98`; it binds actual prediction/evaluation files, final pass provenance QA, and superseded report hashes.

### cd0 candidate pass provenance and development result

The candidate score prompt source SHA is `22b16f132542ebe47577855eeb21f37a4d24e28b30ddf4d758da717bdc601972` at code checkpoint `cd0c94e139010cd9ebd9dacc7d87e8d03e214e84`. The pass inputs were separately prepared score-only packets over the same 87 unchanged prefilter PASS cases, in the same canonical order and with byte-identical scoreUser prompts; each pass used its own opaque IDs/map and eight raw-score shards. Both used native Luna High, `receiptId=null`, no provider/network call, and fork-none native sessions. P1 session `/root/luna_candidate_cd0_pass1`, raw SHA `7547b5bbec70543ea8bcf9eacf4e121f51dcebd6cdda347b6fa54ed10760ffb0`, input SHA `864fc419173f913bdd4be7f248ba51b07eb9078f6c18b16e31badf8a0b4eb39e`, independent QA PASS at `native-score-pass-1/independent-provenance-qa.json` SHA `e83fc650410a0e979fdeada728bce31ce591cdc0310f525482ae6dc6d9f9ee9b`. P2 session `/root/luna_candidate_cd0_pass2`, raw SHA `210c7c6132817b26387ad62320154ff410054c8d161429b42a6db21473d8d81e`, input SHA `a3bdca3bbc40f56e279ea454c2770b5577db597e05e386825e2274880823c42f`, audit SHA `b7f48b42bee8d30ddf4775be8338d799e741b9bbb8cdd6e3b349a21985b7088c`.

The only raw metadata irregularity is P2 shard 7/8 header `passId=cd0-pass-2` rather than `score-pass-2`. A one-off adapter QA verified the exact shard raw hashes (`12c52b29494768c6eccb6da808a16330ff0dfe4aa56a89902bf130a7ac1496f4` and `f8e158bd1653d19a402fd65589ccb2859b7029abd2ef33fffbf4f8af3b4ae8cd`), their input hashes/session, all 23 ordered item IDs and raw outputs, and equality to the aggregate raw SHA above. Its result is `PASS_WITH_HEADER_METADATA_LIMITATION`, sidecar `.data/fiscal-qa/development150-score-candidate-cd0-20261025/native-score-pass-2/score-pass-2-header-alias-qa-sidecar.json`, SHA `130c5c5ae8cc45fbf11e7368ca67bbc0c4b164d11632c51f150143652734487a`. Original P2 raw and shard files were not modified. The full two-pass provenance QA is `.data/fiscal-qa/development150-score-candidate-cd0-20261025/independent-two-pass-provenance-qa-v3.json`, SHA `0131a02e64a3f64910922018dec7075d9e227892be9f78ad7ffcdc0dbf3284e8`; P1/P2 adapted outputs and normalized prediction/evaluation outputs are in the same ignored directory, with hashes recorded in the machine reports.

On the original label vintage, cd0 is TP16/FP30/FN10/TN94, P34.78/R61.54/F1 44.44. Under v2 it is TP16/FP30/FN8/TN96, P34.78/R66.67/F1 45.71. This is development-only, descriptive and post-hoc; it is neither holdout nor provider/runtime performance, and is not a causal comparison. P2’s audit discloses that broad PROJECT_PLAN general-stage history summaries were visible during task framing; it reports no case mapping or case-specific decisions observed or used. Therefore the passes must not be described as blind. Across 87 scored cases, exact score agreement was 9/87 (10.34%), mean absolute difference 6.07, maximum difference 22, and 19/87 crossed the raw T1=60 boundary between passes; 46 two-pass mean scores were at least 60 and 41 below. These variability numbers do not warrant raising/lowering thresholds or selecting a threshold on this data.

The final fixed-prediction comparison artifact is the Gold-vintage diagnostic SHA above. The earlier corrected-v2 draft diagnostic SHA `aa921b4a3546ea031ed1bee52cafda7b2d786a25d16fa34e91ea4e17c393d4c6` is superseded because it predates final contract/map checks. Candidate evaluation has not changed thresholds (60/65/76), Gold labels, prompts, selected predictions, or the consumed fresh50. Gate 3 remains `CHANGES_REQUIRED`; this development result does not qualify the candidate for automatic selection. Gate 4/5 remain open; restore hash/inventory/sequence checks remain subitems only.
