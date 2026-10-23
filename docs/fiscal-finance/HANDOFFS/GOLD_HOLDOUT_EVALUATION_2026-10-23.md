# Gold fresh50 holdout评测（2026-10-23）

## 结论与范围

完成用户人工审阅后的fresh50只读评测。仅新版 `score11b6` 真正sealed预测作为主Gate3 holdout证据；旧版 `score832a17` 同批结果另外复算，作为历史冻结参考，盲性provenance有限，不用于主Gate判断。两份原始prediction、人工标签、阈值与正文均未改写。没有重新生成预测、改变prompt/权重/门槛、扫holdout阈值或按分数筛样。Gate裁决仍由Root作出。

Gate3主结果（T1门槛60）：50/50标签决定性、模型输出覆盖50/50，TP=1、FP=12、FN=2、TN=35；accuracy 72.0%，precision 7.69%，recall 33.33%，F1 12.50%。50条中人工select仅3条，所以precision/recall估计不稳定；Wilson 95%区间分别约1.4%–33.3%和6.1%–79.2%。在当前开发集precision 31.25%、recall 57.69%的背景下，该holdout结果不支持精选体系已校准可用，也不支持Gate3通过。该结果不能触发针对holdout的即时调参。

## 标签、样本与隔离核验

NAS导出依据为只读、单一 `REPEATABLE READ READ ONLY` snapshot中的 `gold_review_cases` 与 `gold_review.decision` audit_log。NAS导出审计时间为 `2026-10-23T11:28:32.464Z`，50条均匹配决定及确认审计。新manifest `.data/fiscal-qa/holdout-review-20261023/fresh50-reviewed-manifest.json` SHA-256 `1e13b03b3c56d1a62ae14c6a59278924a04a13fe4320bacebee591e5a7acdc79`；标签overlay SHA-256 `f2b600eca60744658e455ed2361c11e9dee7715ae635e9b76dbebe52a558ec35`；导出审计 SHA-256 `5f75795b49bf6f5e6df9e9f8a46becc80d4487394b8fd692292a5f366775a23a`。

独立逐项比较NAS导出的50条manifest与冻结的50条holdout manifest：唯一变化是 `humanAnnotation`。case ID和event group各50个唯一值；50/50仍标为holdout，均为正文状态`ok`，无seed交集。原有正文、body/content hash、source identity、事件组与split均保留。所有人审确认时间晚于新版预测冻结时间 `2026-10-22T14:22:34.907Z`；最早确认时间为 `2026-10-23T11:24:43.410Z`。新版freeze-QA显式记录 `humanLabelsRead=false`，故新版预测早于盲审标签。

Gold validator使用空seed清单SHA-256 `a5338d955b09046ec0b16f3a9625b7955c763aae07dc722e474e6078745f932f`，返回 `READY_FOR_EVALUATION`、50 candidates、50 confirmed、0 pending、0 issues。复核的Gold200 merged manifest SHA-256 `d47666e96cfae7b0a4c183874a9acbe6c6db8863ca3d061f51781f3b6a9420af`，同样READY；200/200 confirmed，原15 seed checked，合计29 select、171 reject、0 either。其中原150 development为26/124，fresh50 holdout为3/47。跨集QA比较development manifest `.data/fiscal-qa/review-batches-20261022/reviewed-manifest-agent-verified-20261022.json`（SHA-256 `a79839b1e27a368a3cdee65b36b38b9d075933cd39dc7d99c95839d3e74199dc`）与fresh50：case ID、eventGroupId、sourceArticleId、URL、contentHash及bodySha256交集均为0。

该holdout只有T1来源（50条、39个来源），因此仅直接提供T1/60门槛下的证据，不覆盖T1.5或T2。

## 冻结预测与回合来源

主评测使用新版文件 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/native-predictions-sealed-score11b6-20261022.json`，文件SHA-256 `cc34bacb8ba729d52be305ba09cb92fed99cfecaa53c3d5635c71f09fcc07ede`，内digest `47ad42a840564659c5bbfce2ad009742111b9de8a4c02c20369c2a63859b6451`。冻结QA文件SHA-256 `f545e10f92459a58a47aaf9ead16b3259a41f7d94dab3fe9ec32bcd7786ecc40`；其中50个唯一case、13 select预测、37 reject预测、31项双轮有分、19项prefilter BLOCK无分。新版两轮native评分分别来自 `/root/luna_sealed_scope_pass1` 和 `/root/luna_sealed_scope_pass2`，两者都是fork-none隔离会话；真实模型请求标签 `Luna High`，每轮只接收sealed score-only文件（fresh50传输包SHA-256 `2b36b1268a77697f4e429cc82bdc2ae53931e3f95385a62920105cb664e25c98`；score system SHA-256 `0c7a98747104a7f682aa7b9118526d49727d3fdc9ae07c249ed92be13c02a975`；allowlist为全局system及随机opaque ID/逐字用户prompt），receipt为null。真正sealed raw结果SHA-256分别为 `7ba3d2266f595eb9abef01ad4a413aff8e06c982e06d9a53e1d04c1af368b0a1` 和 `e448e28718247f8c66262adaf5ed0fbf7d6880291fa43300a8875093cfd131a1`；lossless adapter结果文件SHA-256分别为 `f0e65dcb3c2a8b9a2de68b4a2131b9450726ebb67fed160f432f65171defe8eb` 和 `b4bfef2ef999a021f14524415d428574ab8dcf6aea77bcd4919ad539f4e38400`。pass1/2 adapter proof SHA分别 `4c01955f3b1e8bd43897b10ae63e8bff0a5d4bacd0f7642aafb088232ee4937d` / `50320deb5266bbee3f1001d865be33d963118208fbfe9c191002a50324626a59c`；[10月22日人审/校准交接](HUMAN_REVIEW_CALIBRATION_AND_NAS_CANDIDATES_2026-10-22.md)保留adapter文件SHA、packet/system SHA、opaque UUID到原case映射、scoreUser哈希及相关证据。prefilter是独立且早于人审的blind pass，结果31 PASS/19 BLOCK；它并非两次评分session之一。native离线回合没有runtime provider调用，也没有receipt；`Luna High`是实际请求的模型标签，不应描述成stateless provider调用。

此前报告threshold泄露并作废的是 `/root/luna_scope_score_pass1`、`/root/luna_scope_score_pass2`；它们不在本次有效预测的session provenance中。不要与旧832a17的 `/root/luna_blind_score_holdout50_p1/p2` 或新版最终sealed的 `/root/luna_sealed_scope_pass1/2` 混为一谈。

另按要求复算旧版历史冻结文件 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/native-predictions-fresh-holdout50-score832a17-20261022.json`，文件SHA-256 `752bb2fcd8cad2194120b820030af627b73776ea9c724145f96e881cf7d0cae4`，内digest `26fd888da6e1e0acc37f807e6a45d1e936c5864b60d1fd13fc0dea34339791b0`。它引用两轮 `/root/luna_blind_score_holdout50_p1/p2`，对应raw result SHA分别 `b9b279a946fa23bc4531ca6c43df8b24bfb21c7026795985f8c622e22269149e`、`024e3951ff8c36d70052f3f26ad514915541d5dc28500695fd691965cef739a4`，运行回执为空；留存文件能复算，但没有新版所具备的独立sealed-transport与opaque UUID映射/adapter proof链。旧score packet留档含归一化用的threshold字段；现有证据不能确认它们是否进入原生模型实际传输，因此盲性证明有限。该版指标仅供同样标签、同样样本上的历史参考，不作为主Gate成绩，也不与新sealed版混合汇总。

## 两个冻结版本的独立结果

| 预测快照 | 样本/决定数 | TP / FP / FN / TN | Accuracy | Precision | Recall | F1 | 解释 |
|---|---:|---:|---:|---:|---:|---:|---|
| score11b6 sealed（主Gate证据） | 50 / 50 | 1 / 12 / 2 / 35 | 72.0% | 7.69% | 33.33% | 12.50% | 可接受为此冻结holdout的主预测证据 |
| score832a17（历史冻结参考） | 50 / 50 | 1 / 14 / 2 / 33 | 68.0% | 6.67% | 33.33% | 11.11% | blind provenance有限，不进主Gate判断 |

两份预测覆盖同一50个case。旧版判select而新版判reject的只有2条，且人工标签均为reject；所以新版相对旧版少2个FP。这是同一组小样上的描述性对照，不能视作模型提升的独立验证。

按新版两轮原始评分计算：31个实际评分条目仅1条双轮分数完全相同；绝对分差均值8.26、中位数6、P90 16、最大34；6/31条分数分别落在T1门槛60两侧。旧版历史参考31条中2条完全相同，绝对分差均值8.81、中位数7、P90 15、最大26，亦有6/31跨越门槛。blocked的19例没有评分，不能计入分数差异统计。重复评分分歧说明阈值附近决策有明显不确定性；本轮保留实际聚合规则和60/65/76原门槛，没有尝试重新选择分数或阈值。

留出评测没有做threshold sweep（报告状态 `not-run-on-holdout`）。任务书§32要求比较accuracy、precision、recall、不同threshold并决定正式门槛，但没有写定量Gate3分数线；开发集已有precision 31.25%、recall 57.69%，当前留出precision更低。Root正式审查结论为`CHANGES_REQUIRED`，详见[Gate 3正式审查](../GATE_3_REVIEW.md)。该报告是对冻结输入的客观核对和一次留出估计，不构成校准完成。

## 新版错例分层（仅归因）

本批采样分层只有 `fresh-source-balanced`，所有50条都在该层，故统计上的单一层不代表已覆盖各种业务题材。对新版12个FP与2个FN只作审计性主题归纳，不据此编辑提示、权重或门槛：

- **重复的机构工作机制/流程宣传（主要FP模式）**：属地监管局的年度审核、预算常态监督、绩效评价、国有资本收益申报审核、产权登记调研与协同推进稿，多次描述组织机制、培训、台账、流程和持续履职，但缺少读者可见的新政策、发现、问责、定量结果或具体执行变化。模型容易将正式机构身份、任务复杂度和“闭环/实质/重点”措辞当成新闻价值。例：贵州/浙江国有资本收益审核、内蒙古绩效复核、山东专项资金绩效评价、吉林专项资金审核。
- **会议、内部学习被抬高（FP）**：黑龙江监管处学习高中补助资金管理办法、山西监管局学习注册会计师法并讨论监管举措；材料包含重要规则背景，但当篇新增事实是内部学习或计划性落实，而非规则新发、已发现问题或监管结果。
- **新闻发布会形式与数据含量混淆（FP）**：厦门人行新闻发布会含金融统计、政策解读和多家媒体，但人审拒选；模型很可能把较长的官方发布内容和数据密度当作精选信号。
- **预筛范围漏掉跨条线重大政策（FN 1）**：一项罕见病防治综合政策通知被prefilter BLOCK，用户判select。内容主体是卫健领域，没有显式财政金融触发，暴露出“其他条线优先重大政策”与宽进预筛的边界风险；这里只记录人机分歧。
- **常规操作数据分值过低（FN 1）**：人民银行公开市场逆回购操作量为零的官方公告通过prefilter，但平均分33，低于60；用户判select。可能是模型把单日常规操作公告当作低新增性，未充分识别零操作信息的金融政策含义。

这些是少数错例上的定性假设，不是经holdout调参验证的修复方案。fresh50已被查看标签并用于本次留出评估，今后不得再称为未触碰holdout；未来独立测试应另取事件不重叠样本。当前不改Gold、native预测、prompt、权重、聚合方法、门槛或业务样本；继续保留T1/T1.5/T2门槛60/65/76。

## 评测产物与复现核对

使用现有离线 `scripts/eval-selection-native.ts evaluate`，没有调用provider、数据库、worker，也没有使用原始 `eval-selection.ts` 的provider/SelectBench路径。两个版本分别独立按 `split=holdout` 评测：

- 主评测报告 `.data/fiscal-qa/holdout-review-20261023/eval-holdout-score11b6-20261023.json` SHA-256 `aa600abba98ce9126bc597607fd716fdc4af794ad5a0cf18a742fce78c793f6f`。
- 旧版历史对照报告 `.data/fiscal-qa/holdout-review-20261023/eval-holdout-score832a17-historical-20261023.json` SHA-256 `7ce019207b1b8dc0b8e39518a25a2afe0dc3cb1402e5d11a7fbff0e620953783`。
- 每份报告均写入预测原文件SHA、内部digest、gold manifest规范化digest `45ad565d8bd315a7dc70cacb7f1bf34d9fde8459e96094716ae49050aac761e8`、50/50 coverage、body hash与所用seed清单hash；主预测仍可由原始冻结文件独立复算。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立QA核验新完成人审的fresh50 holdout，按人审前冻结的两版预测做离线评测并整理Gate3证据。

**MODEL**：仅核验既有native离线预测。新版两个评分回合为fork-none sealed Luna High runs，session、adapter、UUID mapping和hash链可核；无provider receipt或runtime provider调用。旧版两回合保留作历史对照，其sealed传输证明有限。未生成任何新模型输出。

**FILES_CHANGED**：仅新增本handoff并更新P5 Gold readiness、STATUS、PROJECT_PLAN文档；评测JSON及NAS标签导出都留在ignored `.data/`。未改源码、提示词、阈值、评分、Gold样本或原始预测。

**TESTS_RUN**：运行Gold validator：fresh50 `READY_FOR_EVALUATION`/50确认/0 pending/0 issues；运行Gold200显式15 seed验证READY。运行现有native evaluator两次：主11b6 holdout 50/50覆盖、0 errors；832a17历史对照50/50覆盖、0 errors。复核标签导出前后manifest只变humanAnnotation，并核对样本唯一性、split、seed隔离、正文hash、标签时序及预测冻结QA。没有重跑全套代码测试（本轮无源码改动）。

**RESULT**：Gold200现为200/200真实人工确认，29 select/171 reject；其中holdout50为3 select/47 reject。sealed11b6 holdout TP/FP/FN/TN=1/12/2/35，P=7.69%、R=33.33%、F1=12.50%；旧832a17 1/14/2/33，仅历史参考。Gate3所需评测证据现存在，但结果不支持“精选体系已校准可用”；不作正式Gate裁决。

**RISKS**：样本仅50条、仅3个人工select；查准/查全区间很宽。50条全在一个采样分层、均为T1，不能外推T1.5/T2或各类业务。新评分重复性有限且阈值跨越6/31；holdout错例归因尚非修复验证。旧版盲性证明弱，不能混入主成绩。fresh50已不再是未触碰测试集。

**BLOCKERS**：Gate3的正式复核/裁决、错例审阅签收及正式阈值确认仍待Root；当前低precision不足以支持自动精选。Gate4来源覆盖与Gate5稳定运行/正式review不在本轮范围，状态未变。

**NEXT**：由Root审阅本证据包并作Gate裁决。若今后开展开发集prompt/门槛改进，限于开发集；不可依据本holdout立即调参。将来若要新的独立性能结论，应先另取事件不重叠样本并在人审前冻结预测。
