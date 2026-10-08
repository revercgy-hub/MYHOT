# Gate 2 正式审查（2026-10-08）

**RESULT=APPROVED；Gate 2=PASSED_FOR_BOUNDED_P4_PILOT。** 固定代码 `edd0644ddcdee42de03eb21ad4704108f08000a5` 允许下述明确核心范围进入本地少量真实正文模型验证。不是46源全量准入、35局持续运行通过、生产启用或实际provider调用授权。未列入pilot的来源保持各自未准入/待补证状态；来源长期运行及上线要求保留。

## 依据、前次记录与固定检查点

按最高《财政金融热点站完整开发与部署任务书》第二十九、三十节、AGENTS/README、实际collector/materials/extract/jobs/editorial/group/publication代码、PROJECT_PLAN、GATE2_ACTION_CHECKLIST及S1阶段/精确例外裁定审查。此前没有 `GATE_2_REVIEW.md`；`S1_GATE2_BLOCKERS_REVIEW_2026-10-04.md`及连续S1明确属于最小实现/阶段范围审查，不是历史正式Gate通过。本次核销其严格首次日期、未就绪正文及旧精选出口保护要求，不重复设一套Gate条件。

任务书原文为“核心官方源稳定以后才能打开模型调用”，下一阶段“仍然只运行小规模核心信源”。首批约10–12源已经有逐源记录；这不要求本次同时准入所有目标机构或46项配置。35局真实入口、栏目与配对证据要求仍保留，中央选登不能替代逐局来源。完整近90日回填按既有S1归属P7/Gate 4和P8/P9首次上线验收；daily scheduler实际运行在相应运行阶段验证；P4语义聚类、真实provider及Gold不是开启P4前必须已完成的循环条件。

独立QA确认本机HEAD与CI headSha均为上述完整SHA。[GitHub run 37709884742](https://github.com/revercgy-hub/MYHOT/actions/runs/37709884742)已completed/success，Check与Docker均success。fresh absent `fiscalhot_xmdebt40_fullqa_test`创建后执行35 migrations；typecheck、backend310/310、Web build、Web tests15/15及loopback smoke全部通过。当前实际JSON静态核算46源/40 strict IDs＝35地方局＋5核心精确例外，enabled及两种全文许可均为0；未seed/更新现有DB。历史共享文档中的31/39等数字按原时点保留，不代表本SHA。本文引用独立QA的执行事实，本审查未重跑测试或CI。

## 三项正式处置

### 1. 当前有限核心采集证据足够支持明确的小样P4

批准的核心pilot范围仅为 `pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`的已核真实、非空ok正文样本，不能按三个source ID放开其全部未来候选。

| 现有Gate维度 | 核销事实及本次判定 |
|---|---|
| 身份、标题、真实入口及栏目 | 原12核心均有逐源记录；35地方局已有官方映射、真实目标入口、配对详情与独立QA，浙江按用户选定“监管工作”。实际46项JSON/精确allow规则支持调查范围，不等于整栏质量或全量准入。 |
| 有限窗口及可信日期 | 国库统计10篇列表/真实正文，代表例为8月地方债统计9/24与7月统计9/9；OMO191/192的列表、题名、PubDate一致；厦门监管业务稿列表/详情9/24一致，路径9/20仅诊断。云南已知冲突URL继续精确deny/原日期hold，其余未决不得进入pilot。当前首次require-date及窗内/边界/窗外/无日期/详情失败路径已由软件QA核销，不宣称完整历史。 |
| 重复及修订 | 国库10URL两次真实collector，第二次new/revised为0；OMO191/192各固定URL两轮幂等，真实跨日窗口出现192及尾项退出，另有保存快照runtime回放；厦门固定业务URL两轮幂等及真实正文revision推进，后续10body ok/rev2或3记录按P3资料保留。正文提取导致revision不是官方内容改版；未观测跨来源同material或官方修订的场景仍not observed，不强造样本。当前materials代码按normalized URL identity增加discovery、同源变化才revision，不新增标题相似去重。 |
| 有限跨时点与更新 | OMO9/29→9/30有实际窗口变化，10/7保存复查可解析；厦门9/29、9/30→10/8列表一致，支持这段间隔的可达/解析稳定。10/8国库、厦门新列表manifest由独立QA核2 actual HTTP/0 extras、200/EOF与保存raw。国库旧raw采集时间unknown，同hash只证明内容一致，不能编造该源跨时点稳定周期。结合真实两轮入库和10body ok，足够支持其现成已核文章小样，仍不批准无人值守持续采集。 |
| 正文与噪声边界 | 国库10body ok；OMO两篇完整短正文/表格及单位字段；厦门业务正文可审，栏目也含党支部学习、网络安全宣传等内部稿。可读不等重要；已知普通活动作为P4负例，预筛效果留给P4核。金融司/政策等原30篇29ok/1unconfirmed不整体扩入此次pilot；彩票等混合内容保持记录，不把低相关题材当parser失败。 |
| 失败安全及有界账目 | 当前strict guard对无marker unconfirmed同样hold；pending仅extract，none/空白ok hold；直接analyze、旧jobs/analysis、自动group及public selected读/ledger同步有回归证据，manual exact布尔例外沿既有规则。真实timeout/partial与旧hop/hash unknown保留；新budget/MockAgent QA证明当前failclosed边界，不能追认旧HTTP账目。未来每次执行仍须真实预算/失败停止，不能用本审查继续旧run。 |

所据主要材料：[OMO验证](P3_OMO_VALIDATION.md)、[OMO跨日](P3_OMO_FRESHNESS_2026-09-30.md)、[入库](P3_INGEST_VALIDATION.md)、[正文](P3_BODY_VALIDATION.md)、[厦门等区域正文](P3_REGIONAL_BODY_VALIDATION.md)、[核心证据复核](P3_CORE_SOURCE_ACCEPTANCE_2026-10-07.md)、[逐局矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[连续S1](S1_CONTINUOUS_GATE_DEPENDENCIES_2026-10-07.md)，及ignored `.data/fiscal-qa/core-list-snapshots-20261008-attempt2/manifest.json`。前期报告的NOT_ADMITTED/Gate未通过是当时结论，本次仅对明确pilot作正式处分，不把有限事实改写成长期通过。

### 2. 厦门财政地方债不准入；安全排除允许其他ready核心进入pilot

`xiamen-finance-debt`保持NOT_ADMITTED/MACHINE_BODY_UNPROVEN及disabled，不是厦门监管局。独立QA保存probe并以当前source/真实保存HTML复核 `identity_missing`、无正文/附件返回、无fetch，strict unconfirmed/null hold。历史205字generic Readability非空ok假正文原样隔离保留；flag不能识别该假ok，本文不允许修、删或复制它到新pilot库，也不允许消费旧P3 jobs。会计XLSX、福建扫描PDF等未可靠正文稿同样保留原文章链接、待解析、不自动精选；OCR已由用户延期，不重新作为Gate前置。

不能因一个安全排除源的正文能力尚缺，就让已验证业务正文永远无法进入模型验证；也不能把安全排除说成该源通过。若未来恢复该源，须真实可靠业务正文、身份/附件路径和独立QA，当前hold不自动解除。

P4执行前由Lead明确一次小样文章清单及provider/receipt预算，采用新隔离 `_test`库和当前有效source配置，仅处理上述三个ID中逐篇核实title/date/URL/body、ok且trim非空、无未决身份/日期/附件问题的真实文章；小样包括业务正例及已知内部活动负例。source allowlist不是正文质量保证：OMO/国库尚无strict flag，尤其不得把其unconfirmed/none/缺正文稿排进pilot。准备完成后冻结样本集合，只消费本次集合的既有内容处理路径，不并行collector、全局sweeper或无界worker，不新建runtime绕过guard。未来增入其他source另按其证据核销，不以本结论批量启46源。保留真实原发布日期/backfill语义，不把历史稿伪装当日新稿来触发语义事件；真实语义聚类测试仍为P4_REQUIRED_NOT_RUN，需适用样本独立验证。

本文解除阶段门槛，不提供provider key、不代用户选择付费服务/Gold标注、不授权未定费用或对外发布；这些是P4具体执行准备，不反向恢复Gate 2阻塞。模型调用继续经过worker、receipt与预算熔断，全文许可保持false。

### 3. 中国政府网、NFRA仍是必做来源工作；不阻断本次已核核心小样

任务书十四节列明中国政府网和国家金融监督管理总局，十五节还有厦门金融监管局；当前矩阵JS壳/嵌套JSON/独立详情链说明技术缺口，不能称这些要求已完成或已获用户永久延期。现Phase2“首批约10–12”及Phase3“小规模核心”没有规定十四/十五节所有目标必须同时可抓，故本次小样不要求先为这两源实现新能力；它们仍是来源主线/P6扩容及后续上线范围核销待办，不能以此Gate结论从最终任务删掉。继续这两源的最小工程补证可与P4准备并行，无需重开本Gate。

中国政府网最小下一步：先从已有官方HTML/JS和保存响应定位真正官方列表数据入口或可持续静态栏目，核列表当前性、原始发布时间及一篇财政金融详情；若能表达为现有HTML/单数组JSON，则只需industry配置/fixture。不能把陈旧部门页或974字节JS壳当当前完整政策源，也不先引浏览器render框架。

NFRA最小下一步：复核已知官方列表 `/cbircweb/DocInfo/SelectItemAndDocByItemPId`的目标分类 `docInfoVOList`、docId/外链区别及 `/cbircweb/DocInfo/SelectByDocId`详情正文/日期字段。实际 `json-list.ts`已有固定dot-path/模板映射，但不会任意flatten多个分类或调用独立JSON详情。优先选择单个稳定分类数组＋现有可读官方详情；若仍必须JSON详情，才提出exact官方源的最小backend JSON详情/候选映射适配范围，守住HTTPS/allow、身份/日期、正文/附件hold、预算及失败安全。该能力确实可能需要packages/backend兼容点，当前证据不支持声称config-only必定完成；无证据需要apps UI、schema或通用浏览器执行框架。本审查只裁定动作顺序，没有授权该新runtime实现或HTTP。地方债公开平台及其余任务书目标同样保留各自未完成事实，不能冒称被国库统计替代。

## 最小后续闭环与最终边界

本次APPROVED没有待补代码/新增HTTP的Gate 2前置。Lead/QA把STATUS/PLAN/checklist的当前结论同步为 `PASSED_FOR_BOUNDED_P4_PILOT`，列明三个ID及逐篇ready限制；保留其他源NOT_ADMITTED、35局持续质量/已知异常、完整回填、daily运行和最终来源覆盖待办。同步operator notes的真实46/40集合，旧时点数字不当当前状态。之后一次P4具体样本/provider/预算准备即可继续，不重复询问已确认的附件、35局、daily、90日或浙江栏目决定。NAS/production、全量自动采集及上线来源验收仍无授权。

**TASK**：固定40-ID代码检查点的唯一正式Gate 2审查。**MODEL**：派发 `gpt-6.1-sol / medium`；项目模型调用0。**FILES_CHANGED**：仅新增本文，唯一owner；未改source或QA共享文档。**TESTS_RUN**：审查仅静态读取与只读HEAD核对；独立QA/同SHA已完成CI如上，无审查新增测试、HTTP、DB、provider或OCR。**RESULT**：APPROVED / PASSED_FOR_BOUNDED_P4_PILOT，精确三核心ready文章范围。**RISKS**：有限样本不证明全源长期质量；旧假ok及旧HTTPunknown保留，未配置Gov/NFRA等任务缺口继续。**BLOCKERS**：本范围Gate 2无剩余前置；实际provider/Gold/费用及小样清单由P4准备处理，其他来源与上线待办未通过。**NEXT**：Luna/Lead同步owned状态，准备隔离有界P4小样，同时继续所需官方源最小技术补证。
