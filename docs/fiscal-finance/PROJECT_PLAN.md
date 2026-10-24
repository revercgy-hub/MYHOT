# 财政金融热点站阶段计划

本计划依据仓库根目录的[《财政金融热点站完整开发与部署任务书.md》](../../财政金融热点站完整开发与部署任务书.md)及仓库 `AGENTS.md`、`docs/customize.md`、`docs/sources.md`、`docs/selection.md`、`docs/deploy.md` 整理。任务书原件位于仓库父目录，仓库内副本 SHA-256 完全一致。若任务书与 `AGENTS.md` 或当前代码能力冲突，按优先级记录并解决，不为符合计划而破坏通用架构。

## 2026-10-24 Development150 与 Staging 部署检查点（当前）

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=d45f0d93f5374b7c72cdf0efb64ada6a03b84404 (deployed/tested application code SHA; documentation commits do not change runtime code)
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS Staging; d45 app-only api/web deployment; image digest sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6; independent rollout QA PASS_WITH_DOCUMENTED_LIMITATIONS
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT; Gate 3 CHANGES_REQUIRED; Gate 4/5 not passed (64/64 row hashes, 64/64 inventory, 16/16 sequence state are Gate 5 restore subitems only)
REVIEW=Gold200 200/200 confirmed (29 select/171 reject), unchanged; fresh50 holdout evaluated and consumed; two old labels await user confirmation (Hebei pure party-building item, Fujian research-results list notice)
BLOCKERS=Gate 3 calibration/usefulness not accepted; Gate 4 source coverage/page and formal review remain open; Gate 5 continuous operation/restart/fault-recovery and formal review remain open; two historical-label questions await user
COMPLETED=Development150 evaluation QA: TP11/FP23/FN15/TN101, P32.35/R42.31/F1 36.67, MAE6.21, 11 threshold crossers; invalid original pass1 excluded and byte-bound rerun used; d45 code 475 tests/473 pass/0 fail/2 skipped plus typecheck, Web build and Web22/22; d45 Staging app-only deploy and independent QA (HTTP/auth, public/noindex/RSS, 30/30 smoke, historical source/settings evidence); b5 exact10 summary-only import committed after b6 body CAS and independent b6 postQA; latest verified pre-summary baseline 418 articles/576 revisions/418 discoveries, body 158/254/6, sources48 off, publications/overrides54, Gold200 unchanged
IN_PROGRESS=Prepare b6 exact47 native summaries and b7 bounded raw scope; Gate 4/5 formal review; two historical labels await user
NEXT=Complete b6 summaries through independent grounding before any import; continue approved body/summary batches with exact CAS and separate QA; use development data only for calibration; do not reuse fresh50 or change thresholds 60/65/76
```

站点现有分类为9类，`ITEM_TYPES`仍为8种。用户确认：“国家级重大民生政策也纳入，即使没有明确财政金融安排”；“央行日常公告放在全部动态，出现重要操作或政策变化时才精选”。d45于2026-10-24 02:15:43Z以app-only方式部署到NAS Staging；独立只读QA结果为`PASS_WITH_DOCUMENTED_LIMITATIONS`，范围仅为该次Staging部署保护与公开面检查，不代表Gate 3/4/5通过，也不是本地fresh-preview验收。部署镜像实际digest为`sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`；独立QA sidecar及历史source/settings对照见[Development150和重大民生政策交接](HANDOFFS/DEVELOPMENT150_AND_MAJOR_POLICY_2026-10-24.md)。development150 native-offline结果不是fresh holdout，不能代表provider流程或understanding质量，不据此即时调整Gold、prompt或门槛。

b5 exact20正文和b6 exact47正文均已提交并经独立后验；b5 exact10 PASS摘要已由canonical importer提交并通过独立DB/LAN后验。当前实测418/576/418 rows、body158/254/6、publications/overrides64/64、48来源flags全0、Gold200不变，摘要10/10精确哈希绑定且未精选。Gold标签、评分阈值与fresh50已消费状态均保持不变。阶段证据与执行限制见[2026-10-24 b5/b6正文与摘要交接](HANDOFFS/PENDING_BODY_BATCHES_B5_B6_SUMMARY_2026-10-24.md)。

## 2026-10-23 fresh50 Gold评测检查点（历史记录）

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=8a05b471eb45c0035440b112ab6bd212da190542 (body/tool commit eb55f12d7634cceec85dbd8695c8e62e6b1d170e immediately before prompt-policy commit)
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS Staging；exact14 summary apply已提交；运行应用SHA21ca4d4，与本地operator工具分开
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3 CHANGES_REQUIRED；Gate 4/5未通过（Gate 5 restore row-hash子项独立验证）
REVIEW=Gold200 200/200确认（29 select/171 reject）；fresh50 3/47 holdout已评测且已消费
BLOCKERS=Gate3 precision与评分一致性不足以确认校准可用；development-only改进验证和正式门槛决定待完成；Gate4/5整体审查未完成
COMPLETED=Gold200人审、fresh50评测、b4 19条body CAS和exact14 summary apply均经独立QA；91/321/6 body状态，418/509/418 rows，48 sources全关，publications/overrides54，Gold200未变；Gate5 restore快照哈希64/64
IN_PROGRESS=development-only prefilter评估与Gate4/5后续review
NEXT=只在development数据评估规则变化；不按fresh50调参，阈值60/65/76保持
```

Gate3逐项审查见[正式Gate 3 review](GATE_3_REVIEW.md)；holdout输入/输出hash、provenance、混淆矩阵、错例归因及局限见[2026-10-23评测交接](HANDOFFS/GOLD_HOLDOUT_EVALUATION_2026-10-23.md)。b4独立QA、exact14应用和LAN后验见[正文批b4 QA交接](HANDOFFS/PENDING_BODY_BATCH_B4_QA_2026-10-23.md)。Gate5 restore subitem独立证据见[QA sidecar](../../.data/fiscal-qa/gate5-restore-rehearsal-20261023/independent-qa.json)。主Gate证据为sealed 11b6，832a17只作盲性证明有限的历史参考。用户明确偏好为：“国家级重大民生政策也纳入，即使没有明确财政金融安排；央行日常公告放全部动态，重要操作/政策变化才精选。”按此偏好进行了最小提示词修改，未据holdout择规则，阈值保持不变；Gate 3仍为CHANGES_REQUIRED。

## 2026-10-23 受控正文与摘要批次收尾（业务数据检查点；fresh50人审与b4导入前历史快照）

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=正文工具与测试软件提交e3d2b9c924fc3396a6424dfed116c75794c72d6f；当前检查点为独立文档更新
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS Staging；运行应用SHA21ca4d4，与本地wrapper/tooling SHA分开
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3/4/5未通过
REVIEW=fresh50仍待用户标注；新版与旧版预测均预先冻结，未按标签调规则或重采样
BLOCKERS=开发150新版精确率31.25%、召回57.69%，不足以支持自动精选；fresh50标签及错例复核待完成；Gate 4来源覆盖与Gate 5稳定性/正式review待完成
COMPLETED=418 articles/490 revisions/418 discoveries（72 ok/340 pending/6 unconfirmed）；45/50历史捕获正文CAS独立后验PASS、5项保持hold；48 sources disabled/fulltext/syndicate关闭；22条native摘要独立QA后发布、23 BLOCK未写；publication/override各40；Gold200（150 confirmed、fresh50 pending）；最终软件470/469 pass/0 fail/1 skip，typecheck、Web build、Web22及LAN smoke通过
IN_PROGRESS=剩余340 pending正文与6 unconfirmed待后续有界批次；fresh50用户盲审未完成；5个已知hold等待新证据
NEXT=仅按新证据规划后续pending正文批次；5个hold无新证据不重复抓取或解析；fresh50标签完整后再做一次预先冻结的评测
```

具体证据、hash和真实限制见[10月23日pending正文批次交接](HANDOFFS/PENDING_BODY_BATCH_2026-10-23.md)。正文工具仅处理批准的50目标：45篇依据既有capture解析成功并CAS，5篇保持hold；无新HTTP GET、provider/worker调用或生产部署。历史response cadence保持`UNPROVEN`。22条摘要发布字段为`eligible=true`、`selected=false`、score/reason空、summary模式且indexable/syndicate关闭；eligible只表示进入动态pool。已独立直查数据库与LAN的`/all`、详情、API、RSS、robots。Gate状态不变，Gate 5旧的64/64恢复子项不等于整体通过。

## 2026-10-22 晚间恢复、NAS导入与新版盲评分评估（历史检查点）

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=67abdfb（代码/评分提示提交；本检查点文档另有独立提交）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS Staging；运行SHA21ca4d4（与本地工具HEAD不同）；27条正文CAS与18条native摘要首发已独立后验，Gold review共200条
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3/4/5未通过
REVIEW=150条原Gold确认26 select/124 reject，fresh50为pending；采集缺陷保留；新评分只使用sealed score-only包，不暴露阈值或Gold决策
BLOCKERS=Gate 3仍缺fresh50用户标签、独立留出评测和错例复核；Gate 4正式来源覆盖/评审未完成；Gate 5稳定性与正式review未完成（实际同步snapshot restore 64/64通过）
COMPLETED=NAS 418 articles/445 revisions/418 discoveries，27ok/385pending/6unconfirmed；source48 disabled及全文旗标关闭；27 body CAS独立PASS；18 native摘要逐条grounding QA后首发，9 BLOCK不发布；Gold200=150 confirmed+50 pending；新版development150评估TP15/FP33/FN11/TN91（accuracy70.67%、precision31.25%、recall57.69%、F1 40.54%）；fresh50新版预测已冻结且仍50/50 pending；typecheck、fullsuite 457/458 pass、Webbuild与22/22通过
IN_PROGRESS=NAS pending≤50正文wrapper待独立QA；fresh50用户盲审未完成，旧832a17预测与新版sealed预测均保留
NEXT=受控推进其余385篇pending正文并独立核验；fresh50标签完整后做一次holdout评估。新分数不触发prompt/阈值调整，也不重新抽样；60/65/76保持
```

当前恢复依据和证据hash见[人审校准与NAS候选恢复交接](HANDOFFS/HUMAN_REVIEW_CALIBRATION_AND_NAS_CANDIDATES_2026-10-22.md)。本状态不代表Gate 3/4/5通过。

## 2026-10-22 用户人审及技术分组完成，独立留出评测待续

固定代码SHA `21ca4d400bda9071f1e0b8761d404d1fc5b001e5` 已部署至`/vol2/1000/docker/fiscalhot-staging`，0039迁移完成。150项私有审核候选均已确认：原20项13 select/7 reject保持，新增130项13 select/117 reject/0 either；原15 seed仍confirmed/non-holdout。48个source仍disabled，文章、公开发布、provider、worker及任务运行副作用为0。管理员UI/LAN匿名保护、noindex和分页检查通过；只有用户显式勾选提交才保存标签，未选不等于reject，标签不会自动发布。此次功能审查为`APPROVED_FOR_PRIVATE_BATCH_REVIEW_ON_STAGING`，不等于Gate 3/4/5通过。独立overlay/body-hash/合并核验和validator状态详见[P5 readiness](P5_GOLD_DATASET_READINESS.md)。

独立事件QA已核验150条唯一材料、0精确重复、39个标题相似flag逐项核对无同一地方实际事件；新metadata-only版本为`.data/fiscal-qa/review-batches-20261022/reviewed-manifest-agent-verified-20261022.json`，SHA-256 `a79839b1e27a368a3cdee65b36b38b9d075933cd39dc7d99c95839d3e74199dc`。150条均是独立development事件组；holdout=0。已审阅的150条、旧15 seed及曾用于偏好归纳的旧20均不得充当盲测。下一步收集50条全新、事件不重叠、正文合格样本，先冻结两次隔离native预测，再请用户盲审；随后用既有Gold评测合同跑开发/留出评估、复核错例并确认阈值。`agent_verified`技术provenance不代替用户标签；validator READY仅表示数据完整，不意味Gate 3通过。不默认触发付费provider。Gate 4继续补计划来源/覆盖证据；Gate 5需稳定性观察和实际恢复演练。不能把有限PBOC 90日窗口观察、native建议或私有人工标签直接认作Gate通过。

详情见[Gold私有人审队列Staging交接](HANDOFFS/GOLD_REVIEW_QUEUE_STAGING_2026-10-22.md)。

## 2026-10-22 NAS Staging隔离运行验收（review migration前检查点）

用户指定`/vol2/1000/docker/fiscalhot-staging`；固定SHA `ac14beaf1b67ef709578624b388b14767998a80c`已部署，旧`/home/codex`准备目录保留。普通Docker bridge build首次因官方Debian源超时失败；随后Root批准build-only `--network=host`后固定源码build成功，Compose runtime仍为bridge。限定`db setup api web`启动成功，35 migrations、48 disabled sources、articles/revisions/publications/analyses/receipts/job_runs/fetch_runs均为0；api internal health 200，container smoke 30/30，LAN页面/404/robots noindex通过。唯一published port是Web 3221，DB/API无host port；worker/caddy未运行。详细见[NAS Staging部署与验收交接](HANDOFFS/NAS_STAGING_BUILD_ATTEMPT_2026-10-22.md)。

隔离Staging runtime review通过，不自动满足Gate 3/4/5或授权Production。之后本项目runtime bridge对官方Debian HTTP/HTTPS、MOF预算与PBOC公开市场指定端点有有限200探测，但不能外推到全部源；所有采集/provider flags仍关闭。下一步为由用户人工审核130项、后续受控导入展示数据、验证备份恢复/稳定性，并针对计划使用的外部端点补实际可达证据；Gold确认、split和各Gate正式证据仍独立推进。不能将空内容数据库或有限网络探测视为内容上线或coverage通过。

## 2026-10-21 NAS Staging 本地准备（远端未部署）

用户明确要求先部署隔离 NAS Staging，Web 映射端口为 `3221:3221`，因此当前执行顺序提前准备受限 Staging。代码准备 SHA 为 `ac14beaf1b67ef709578624b388b14767998a80c`，本机 fresh 软件检查通过；本地没有 Docker CLI，未完成实际 Compose render 或容器验收。详细边界见[NAS Staging准备交接](HANDOFFS/NAS_STAGING_PREPARATION_2026-10-21.md)和[NAS部署路线](NAS_DEPLOYMENT.md)。

目前没有有效 NAS SSH 认证结果：专用私钥需要非空 passphrase，agent stopped/disabled 且没有身份；一次严格只读连接没有返回可捕获结果，认证及远端命令状态未知。没有确认 NAS 读取或写入，也没有构建、启动服务或创建卷。Root 只批准本地准备，不代表 Gate 3/4/5 或实际 NAS 部署通过。**下一步**是用户/管理员按其权限解锁本地 identity；之后先只读核验 NAS 版本、现存项目/卷及端口占用，再由 Root 审查后执行 Staging。Production 仍不在本轮范围。

## 2026-10-21 P5/coverage QA补充

本轮详细证据见[P5 seed guard 与分页来源观察交接](HANDOFFS/P5_SEED_GUARD_AND_COVERAGE_2026-10-21.md)。Gold manifest目前100项，其中20项用户确认、80项pending；另有50项只在ignored目录作为DRAFT proposal，不能计作Gold达标。固定15 seed不变。PBOC有限page1–5观察100个唯一列表项、63个日期在90日窗口；Xiamen page-set只有1次超时请求。两种结果都未满足Gate 3标注/评测或Gate 4完整来源覆盖条件。Gate 2边界不变，Gate 3–5仍未通过。

**下一步：**保持DRAFT与Gold人标/seed隔离，按Gate验收项补充人工确认及真实评测/覆盖证据；待用户手动启动API/Web并报告后再做只读live smoke。不可把有限列表观察、正文native摘要或proposal提升为Gate证据。

## 2026-10-21 大批量采集与正文批次结果

本轮有界执行已结束，证据与下一步见[独立交接](HANDOFFS/BULK_COLLECTION_AND_BODY_2026-10-21.md)。48个已配置官方源各1次列表/base GET均成功，新增198条metadata。随后两个隔离测试库合计134次详情GET，127篇正文成功、7篇`unconfirmed`、16个批准目标因来源停止而未请求。MAIN与PAGINATION分别为640篇（407/211/22）和153篇（102/47/4）；两库不相加，native摘要不是Gold/provider receipt，也未自动公开。MAIN列表运行另有33条PgBoss过期cancelled-job retention清理finding，原行证据已保存且未恢复。来源仍disabled，Gate 2边界不变，Gate 3–5仍未通过；成功列表请求不代表90日覆盖。

**下一步：**在新的明确scope和fresh CAS下复核7条正文hold及两库剩余pending；针对来源错误决定是否需要具体诊断；继续收集来源质量和近90日覆盖证据。不可自动重试、处理附件/付费provider或把native建议提升为Gold。

## 2026-10-21 P3 latest增量与正文候选QA结果

本轮代码head `6159de76f55601dcdcfd640d00d74e2a085afc08` 已推送；最终Check run [39530549243](https://github.com/revercgy-hub/MYHOT/actions/runs/39530549243) 成功（backend 416/414 pass/0 fail/2 skipped，typecheck、Web build/17 tests、migrate/seed、built-site smoke与Docker均通过），状态页与[10/21交接](HANDOFFS/P3_LATEST_INCREMENTAL_AND_BODY_REVIEW_2026-10-21.md)记录具体边界。主库当前48 sources/442 articles（378/51/13）/793 revisions/318 publications/427 jobs；4篇inline body_text投影只基于既存HTML作人工CAS修复，所有旧revision、source/raw/title/date/body_html、publication资格和其它行保持。分页库独立为4 sources/153 articles/157 revisions/6 publications/153 jobs/18 fetch runs；四源cursor仍active、coverage `unproven`。10/20四条captured metadata replay已入库，10/21旧版CLI另对GX/四川base list各发1次GET，GX新增0、四川新增3，均为pending metadata、未精选。其raw response未捕获，且旧CLI因PgBoss句柄需对自身进程Ctrl-C；新finally cleanup与child regression已实现并focused/typecheck通过，不能追认旧运行用过新代码。两库计数分开，来源仍disabled、无worker消费或provider请求。11篇历史数字边界候选已逐项审查：4篇已修正body_text投影，7篇为低影响暂不提案，除非新证据不重扫。Gate 2仍仅`PASSED_FOR_BOUNDED_P4_PILOT`，Gate 3–5未通过；下一步核验7条list-only候选的详情/正文，执行受控周期latest运行并补coverage证据，不机械抓page8/9或批量回写。

本机fresh 35-migration backend suite为414/413 pass/0 fail/1 skip（在cleanup/suffix变更前）；Web build、Web17/17、typecheck通过；最后CLI targeted suite 10/10。CI run 39530121854针对旧cleanup SHA失败在`aihot_ci`不符合`*_test`守卫的测试设置（外部请求/业务写为0），仅此守卫已对齐`*_test|*_ci`。最终精确SHA的run [39530549243](https://github.com/revercgy-hub/MYHOT/actions/runs/39530549243)成功：backend 416 tests / 414 pass / 0 fail / 2 skipped，Docker及其它检查通过。无本机live API/Web smoke。
## 2026-10-20 P3 有界分页与正文核验

本轮在专用分页测试库按冻结scope v2续跑四源page6/7（8个精确GET），cursor到8、coverage仍`unproven`；重庆新增列表候选的列表日与URL日期token冲突，正文保持pending。主库两篇正文详情的自动parser decline及原始`completed_with_violations`均保留；独立核验后仅按Root批准的captured HTML做两条人工CAS，未调整来源阈值、publication资格或下游状态。selected-body修复保留inline金额、不改全局sanitizer/门槛或历史正文。详细raw/hash、行级基线和独立报告见[10月20日检查点](HANDOFFS/P3_PAGE67_AND_BODY_2026-10-20.md)。GitHub Check run39356710341对精确SHA `80e7458c805bae057a3d898d3d32ae2f69e7b163`通过（backend403通过/0失败/2跳过；typecheck、Web、迁移、built-site与Docker检查均通过）。本机full-suite最近一次为401/405通过、3失败、1跳过，三失败为随后经focused15/15解决的旧raw-length断言，不写成本机full-suite通过。四源分页观察和数据库inline影响分析继续进行。Gate 2仍为`PASSED_FOR_BOUNDED_P4_PILOT`，Gate 3–5未通过。

Root批准的最新base-page一次观察已完成并独立复核：四个固定URL各1个GET，间隔超过1秒，无redirect/retry/DB写；与分页测试库146篇只读身份对照发现广西3条、四川1条未见metadata候选，重庆/海南首页0新增不证明完整。四川两条既有列表项日历日与URL token不一致，保持hold。历史正文offline影响审计的376条保存HTML有374条raw text差异，其中171仅格式、203归一化后仍不同；11篇包含57个严格DOM数字边界候选，不能据这些数字批量回填。后续按source evidence核4条候选身份和11篇历史正文候选，另明确兼容active backfill cursor的latest增量检查/覆盖完成证据；不可把它替代90日覆盖验收，不机械增加续页。来源仍disabled，Gate状态不变。

## 2026-10-19 P5 Gold 审阅状态

batch-02编号6–10为五项`select`；batch-03编号11–15按用户原文“11精选 12不 13精选 14精选 15精选”映射为四项select、一项reject，均未提供理由。metadata仍只记录15条人工confirmed（9 select、6 reject）/85 pending；全部事件组与split仍待确认，validator为`DRAFT_INCOMPLETE`、0 issues，Gate 3未通过。85条经验辅助建议经身份/hash/日期QA；三篇地方金融服务稿适用用户已确认的“全部动态、精选优先政策/资金/监管”偏好，另外6个null候选按正文和既有规则复核，其中5项形成推断建议、北京调研报道保留null。最新v3为30 select、54 reject、1未分类，建议仍不构成人工标签；15条seed已参与偏好归纳，不能作为独立holdout。未来holdout须盲审并按事件组隔离，本轮不自动分配split。供用户抽查的材料隐藏机器建议/置信度/理由，机器建议另存。详见[10月19日Gold检查点](HANDOFFS/P5_GOLD_BATCH02_REVIEW_2026-10-19.md)。

## 2026-10-18 当前Gate证据更新

本段以[10月18日Gate 3–5 QA交接](HANDOFFS/GATES_3_5_QA_2026-10-18.md)为当前结果索引；下方10月17日任务顺序及更早检查点保留历史，不覆盖本轮实际结果。Root批准的分页CLI page4/5批次已在专用`_test`库完成8个精确GET并经独立QA；旧数据投影保持不变、仅重庆新增16条metadata、coverage仍`unproven`。100条候选全部sourceTier=T1；首批5条decision由用户确认均为reject，并补充共同理由“不是需要关注的重点工作”（只记入ignored理由审计，候选schema不含reason字段）；其余95条decision待审。validator为`DRAFT_INCOMPLETE`、5 confirmed/95 pending；全部eventGroup/split未确认，完整可评测数据集和校准均未就绪。用户本人为标注人。batch-01用户决定/理由审计和batch-02独立资料QA详见STATUS及本轮handoff。软件QA最新GitHub Check run [39058082747](https://github.com/revercgy-hub/MYHOT/actions/runs/39058082747)在精确head `ba395eac9d978e986bc217b30a42a518b2ae4624`全绿：backend 400 pass/2 skipped/0 fail，Check与Docker通过。用户提供NAS信息铭凡N5/64GB/飞牛NAS支持Docker/IP `192.168.3.100`，但系统版本、实际Staging/volume目录和管理/SSH方式待确认；未连接或部署。只读runtime：PG loopback ready，API/Web无listener，health/noindex/smoke `NOT_RUN`；用户会手动启动是未来承诺而非已运行事实。Gate 2维持`PASSED_FOR_BOUNDED_P4_PILOT`，Gate 3–5未通过；付费route/OCR延期。

## 2026-10-17 任务安排（历史）

本轮任务排序与依赖见[10月17日任务安排审查](HANDOFFS/NEXT_TASKS_REVIEW_2026-10-17.md)。本段是当时的任务安排；当前状态以上方10月18日证据更新为准，下方10月08日及更早检查点保留为历史证据。

| 顺序/槽位 | 工作与依赖 | 退出条件 |
|---|---|---|
| 第一批 A：Luna High | 在 loopback `_test` 隔离库，用现有 collector 与固定 fixture 验证 `scripts/fiscal/p3-page-continuation.ts` execute 正向路径；不请求官方来源。A 独占该CLI、`tests/fiscal-page-continuation.test.ts` focused test 与隔离运行证据。 | 冻结正向 scope；验证 capture 解码、collector写入、cursor与manifest一致、queue保持unstarted，以及cap/锁/失败时非零退出。独立 QA 通过后才安排历史回填。 |
| 第一批 B：Luna High | 与 A 并行，分别审计主库54条 `pending` 与分页隔离库129条 `pending`，逐项配对完整已存 raw；13条 `unconfirmed`保留hold，不盲目重试。B仅拥有自己的证据矩阵与grounded正文处理scope。 | 两库分列；每项记录证据路径、URL、title、date、hash、身份判断和明确下一动作；无缓存证据就说明缺口，不造新框架。独立 QA 通过后才安排grounded正文批。 |
| 第一批 C：Luna High | 独立 QA A/B 产物并整理文档；独占所有计划/交接文档和Git提交操作权。Lead只处理S1、Gate与冲突裁定。 | 关键断言独立复核、文档索引一致；按实际改动做必要检查，不重复已有全套QA。第一批通过后，A按原cursor范围做历史回填，B做有证据支撑的正文批；不先扩来源数量。 |

同一隔离数据库的写入串行执行：一批写入完成并经独立 QA 后才开始下一批。A向分页隔离库做历史回填时，B可处理主库或做离线工作；若B要处理分页库129篇正文，必须与A错开，并遵循“同库一批写入→独立QA→下一批”，避免写入和验收基线相互漂移。

P4故障用例已有10月09日记录；不得按10月08日旧表重复补做。`scripts/eval-selection.ts`通用评测工具已存在，P4/P5当前仅准备已有工具与候选DRAFT。真实provider调用仍按用户决定deferred，Human Gold需人工确认；这些不阻挡上述离线验证与证据整理。项目计数以10月16日已核快照分库记录，非10月17日live核验。Gate 2维持`PASSED_FOR_BOUNDED_P4_PILOT`，Gate 3–5未通过，来源开关状态未由本计划审查改变。

## 2026-10-08 连续 P3 当前检查点

**历史检查点；不作为2026-10-17当前状态。**

代码SHA `edd0644ddcdee42de03eb21ad4704108f08000a5`的46项来源（45 HTML、1 JSON）中，exact strict body-ready opt-in共40项：35个地方局ID与5个中央/核心ID。全部source保持disabled且站内/转发全文关闭，没有seed到preview或production。fresh 35-migration本机QA：typecheck、backend 310/310、Web build、Web tests15/15、loopback smoke通过；同SHA GitHub Check+Docker run [37709884742](https://github.com/revercgy-hub/MYHOT/actions/runs/37709884742)成功。Xiamen finance debt实际配置helper返回`identity_missing`且无body，strict hold为true；既有205字符历史假正文未改。新保存的两份current-list snapshot只作为有限页面观察，不证明历史覆盖或source pass。详细软件QA、失败历史和边界见[连续P3交接](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)。正式审查裁定Gate 2=`PASSED_FOR_BOUNDED_P4_PILOT`：仅允许三个指定核心来源中逐篇核验合格文章的小样验证，详见[Gate 2正式审查](GATE_2_REVIEW.md)。这不构成全量source admission或无人值守采集授权。用户明确浙江首期主栏目为“监管工作”，图片新闻后续补充。

2026-10-08正式review将Gate 2裁定为`PASSED_FOR_BOUNDED_P4_PILOT`，只限review规定的三个核心source逐篇合格文章；未把全35局或46源目录判为通过。地方局与其它来源的逐项覆盖/质量证据仍是来源主线及后续扩展工作，不阻断该固定小样进入P4。有限样本和P2旧页不得当作历史完整。按[S1连续Gate依赖与历史阶段裁定](S1_CONTINUOUS_GATE_DEPENDENCIES_2026-10-07.md)，首次上线所需完整近90日回填仍是用户要求，完整能力及覆盖/partial解释属于P7/Gate 4上线准备和P8/P9实际Staging、首次上线验收；不要求Gate 2之前对35局机械遍历所有历史页。P3须核验真实相同normalized URL/material identity的重复发现和内容修订；无实际相同样本时写`not observed / runtime dedupe unknown`。跨来源同一事件的语义聚类准确性保持`P4_REQUIRED_NOT_RUN`，留在P4独立验证；不增加为Gate 2前置。现有样本的题名、日期、正文与已知日期冲突按[来源矩阵](SOURCE_MATRIX.md)和[区域覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)逐项保留，有限样本不能外推为整源质量。

完整测试、SHA、CI和运行边界见[连续P3交接](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)。

该有界裁定不关闭全项目来源工作：35个地方局仍按用户确认的逐局新闻动态范围继续核验；中国政府网、NFRA和其它未完成来源均保留在来源主线及其后续阶段，不能标作已覆盖或永久延期，也无需全部完成才进入本次三个source的小样P4 pilot。另一个核心源`xiamen-finance-debt`保持`NOT_ADMITTED`，严格flag的配置不修复其身份缺失或旧205字符假正文。无剩余Gate 2技术前置阻断这个已核核心小样；具体provider/receipt预算、Gold与冻结文章清单属于P4准备。详见[Gate 2正式审查](GATE_2_REVIEW.md)。

## 阶段顺序与 Gate

| 阶段 | 工作 | 退出条件 |
|---|---|---|
| P0 仓库接管 | 核对规约、架构、Git 基线和安全环境 | 有可追溯审计与状态；采集、模型、外部推送开关保持关闭 |
| P1 静态行业改造 | 以 `industry/` 为主改造站点、taxonomy、topics、features、prompts、页面文案和相关 fixtures；仅在 Sol Review 批准时修改必要的通用兼容点 | 财政金融语义闭环；普通 AI 行业残留已扫描 |
| Gate 1 | Sol 对行业抽象、taxonomy、ITEM_TYPES、topics、prompts 和修改范围做一次架构审查 | Sol 输出 `APPROVED`，或 Luna 修复其最小要求；typecheck、指定测试库测试、web build 通过 |
| P2 官方信源配置 | 优先调查并配置首批约 10–12 个中央、福建厦门官方源 | 每个源有页面结构和抓取结果证据，记入 `SOURCE_MATRIX.md` |
| P3 本地抓取 | 逐源小规模真实抓取，模型调用关闭 | 标题、日期、详情页、URL、分页、导航过滤、重复项均有结果记录 |
| Gate 2 | 审核核心信源抓取稳定性 | 核心源稳定后才允许在本地小规模开启模型调用 |
| P4 模型精选验证 | 用少量数据检查预筛、双评分、标题摘要、标签分类及聚类 | 记录质量问题和处理结果 |
| P5 Gold Dataset | 建立并校准人工标注样本 | Gate 3：开发集和留出集评估完成，门槛由样本校准后确认 |
| P6 信源扩容 | 扩展到约 25–35 个高质量源 | 逐源验证，不以数量代替稳定性 |
| P7 本地验收 | 完整 typecheck、隔离测试库测试、web build、页面和 smoke 检查 | Gate 4：本地验收通过 |
| P8 NAS Staging | 通过 Git 部署隔离的 Staging，先不开采集与模型 | 网络、数据库、迁移、备份、日志、恢复等基础项通过 |
| P9 Staging 稳定性 | 逐步启用采集和小规模模型处理并观察 | Gate 5：连续运行、成本、故障恢复和 smoke 验收通过 |
| P10 Production | 仅部署 Staging 验证过的固定 SHA | Production 数据、配置和卷独立，具备备份和回滚 |

## 2026-10-06 Phase C evidence preparation status

Phase C source evidence preparation仍`IN_PROGRESS`，Gate 2为`NOT_PASSED`。Phase A/B批准仅覆盖各自受限实现，不代表source admission或90日覆盖。Lead指定上海为source evidence候选。page 1列表GET和一条详情GET分别有独立one-shot manifest/raw；QA已独立核验hash、URL绑定和日期对照。列表显示日/可见“发布日期”为7/31，路径token为7/28，详情PubDate为7/31 08:17 +08；候选仍disabled且`NOT_ADMITTED`，没有附件请求或DB/model写入。S1单页OCR固定工具代码`290619355c9d60b6da155c9215381c82b6acf9b2`、test-only budget fixture修复`c7a027491b809f91edec42c3abeaee017e901ba9`已通过本机fresh backend303/303、typecheck和CI Check+Docker run37438292607；同一runtime源码的Web build/tests15/15与loopback smoke30/30沿用本轮前序实测。独立只读合同复核未发现实现阻塞，但formal native monitor preflight case1失败：sample gap281.6508ms大于250ms且fake child被overdue停止；case2未运行、actual OCR未运行。这些保留为历史实证；根据用户2026-10-06决定，本地OCR与monitor工作状态为`OCR_DEFERRED_NOT_GATE2_BLOCKER`，不在当前主线继续修复、重跑probe或运行OCR。详细记录见[Phase C S1 OCR软件QA和preflight检查点](HANDOFFS/PHASE_C_S1_OFFLINE_OCR_SOFTWARE_QA_AND_PREFLIGHT_CHECKPOINT_2026-10-06.md)、[失败诊断](OFFLINE_OCR_MONITOR_FAILURE_ANALYSIS_2026-10-06.md)及[OCR延后决策交接](HANDOFFS/OCR_DEFERRED_USER_DECISION_2026-10-06.md)。附件无法可靠解析时仍保留原始链接、标注正文待解析并排除自动精选；未来若有实际需求，再按既有provider预算和receipt机制评估API OCR，本次没有启用API/模型或实现该能力。当前恢复环境、preview只读核验与服务健康证据见[Phase C恢复安全检查点](RECOVERY_SAFETY_CHECKPOINT_2026-10-06_PHASE_C.md)及[S1 Phase C来源证据检查点](HANDOFFS/S1_PHASE_C_SOURCE_EVIDENCE_CHECKPOINT_2026-10-06.md)。

## 2026-10-07 已保存响应离线审计增量

福建 2026-10-06 已保存的列表和两条详情已作离线来源质量审计；未发新 HTTP、未运行 collector、未写 preview DB、未请求 PDF/附件。首屏10条 URL 唯一但日期行序乱序（第7行9/22位于多条更新较旧日期之后），4条路径日期与列表日不同；首屏最旧为8/10，目标约90日边界在7/8附近。保存脚本明确给出 `index_1.htm` 候选，但没有实时验证；后续不能依据列表行单调递减或首个旧日期判断分页完成。新分页请求必须另立预算和范围，10/6的一次性collector核准不能复用。两条详情一篇正文样本可用，另一篇仅有标题容器并保持pending，邻近PDF未请求；不将后者计为正文通过。完整字节、hash、解析和边界见[福建保存响应来源质量审计](P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)。

代码仅增加离线 bounded content decoder/helper 与测试，不改变collector/fetch、来源配置、数据库或应用运行时；提交 `cdbb329529f407f25db122510dc042ceca5fd975` 的 fresh Node24本地QA和成功 CI run 37556665439 见[10/7 P3交接检查点](HANDOFFS/P3_CONTENT_ENCODING_CHECKPOINT_2026-10-07.md)。Source admission仍NOT_ADMITTED、coverage仍unproven、Gate 2仍NOT_PASSED；正式逐局覆盖、90日历史、日期可信度、正文业务质量、附件降级及跨周期重复等退出条件未闭环。

## 新增来源覆盖要求：财政部各地监管局动态

用户新增要求：资讯咨询覆盖全国财政部各地监管局发布的新闻动态。该要求纳入现有官方来源建设，不代表增加其他机构来源或扩展为各局全部主题栏目。用户确认首阶段须逐一覆盖各财政部地方监管局新闻动态栏目，中央选登只作补充。内容边界已确认：无实质业务事实的内部活动排除；新政策、问题发现、监管措施、调研成果纳入；地方一手内容不因传播范围低而降优先。`prefilter`与`selection-score`提示词已作最小文字更新，但无人工Gold模型评估或硬过滤器。用户确认附件无法可靠解析时保留原始URL、标注正文待解析、不进入自动精选，后续补解析；不支持附件不等于正文ok或来源通过。2026-10-04 Sol给严格首次90天日期范围及附件诊断/自动精选防护`APPROVED_SCOPE`，仅批准实现范围，不是Gate 2通过。S1实现已集成到代码SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0`；最终fresh本地QA的250/250测试、typecheck、Web build/tests、重启到当前构建的loopback smoke以及CI run 37163791233均已通过。没有新增DB migration；未启用source或worker。用户确认daily check与首次近90日目标已写入disabled行业source JSON（12源），但未导入正式source行或验证定时运行；通用collector 12个月默认仍保留。以上配置/prompt不表示生产运行或Gate通过。分类沿用现有“财会监督”“地方实践”“政策发布”等标签；条目保留真实发布局名称，汇总稿按汇总来源展示。

此前P3有限验证与中央选登及少量代表性地方局站点不能视为逐局覆盖。35个官方目录/域名是映射候选，不等于来源/feed。2026-10-04首批、2026-10-05批次2–9、浙江监管工作栏目及后续单篇详情/分页探测，逐局证据见[覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)：批次5–9尝试19局，其中18局有目标栏目首屏，甘肃主页超时；浙江监管工作页9条列表候选、首篇详情有限通过，仍未验证栏目的完整历史。四局详情样本内容边界不同；单篇不能推断全栏噪声。北京、福建、上海在fresh隔离库内各有受限collector结果；上海重复列表超时后停止并标partial。Batch6四局page2探测各取得10条候选、无与首页重叠，但最老显示日2026-07-29，仍未覆盖截至10月6日的90日窗口。上述样本不证明栏目完整、90日历史窗口、selector稳定性、周期稳定性或来源通过。当前19个来源仍disabled、全文关闭；FJ额外启用严格正文就绪策略但来源本身disabled。Gate 2仍NOT_PASSED。

2026-10-05工程增量：行业配置总数由12增至15，新增福建、北京、上海三条来源，均为disabled且站内/RSS全文关闭；saved fixture配置测试与新隔离数据库两阶段集成测试通过。新集成测试使用loopback fixtures及合成正文，证明测试数据库中collector、元数据持久化、队列和显式抽取的衔接，不代表真实来源运行或验收。第四批江苏、浙江、安徽、江西观察由独立QA核验预算/raw hash：江苏、安徽、江西各有一次10项列表样本，浙江页面只得到无列表的JS跳转包装；这些单时点页面仍不构成source pass。福建、北京、上海三页在相隔32小时22分的两次手工观测间无候选变化；此证据不是scheduler运行、稳定性或Gate通过。三局配置/测试和signals本地provider fixture隔离测试在fresh数据库完整回归252/252、typecheck通过；Web build、Web tests 15/15及loopback smoke 28/28通过。所有来源继续disabled，未导入正式数据库，无worker、模型或采集任务；Gate 2仍`NOT_PASSED`。测试代码SHA、docs HEAD与本轮分支状态见[阶段检查点](HANDOFFS/BUREAU_CONFIG_INTEGRATION_2026-10-05.md)及[状态页](STATUS.md)。

早期10/06恢复文档检查点（状态由下段的阶段检查点继续更新）：已提交代码15源，A新增四局配置/测试仍在做；同时记录了FJ/SH collector与四局首篇详情事实。该段是当时状态快照，不能代表工作树当前状态。

2026-10-06最终检查点：代码已分两项提交。`aaeab85`新增河南/湖北/湖南/广东4个disabled source及纯配置/parser fixtures；`b3546ab9c803b6872eb6b82d68fab8ca87da8520`实现S4来源专属正文就绪保护与测试。配置合计19项（18 HTML、1 JSON），全部disabled、全文关闭，未导入正式source行。fresh 35-migration Node24本机full test 257/257，typecheck、Web build、Web tests15/15、preview loopback smoke29/29通过；最终combined SHA的CI run [37346160222](https://github.com/revercgy-hub/MYHOT/actions/runs/37346160222) success，Linux backend 257 tests/256 pass/0 fail/1 Windows-only skip。S4限制FJ来源的自动分析和精选发布必须等body `ok`且trimmed非空；安全摘要池/detail仍可见，strict源可由编辑者精确布尔manual selection发布安全摘要。功能回归不等于来源验收或Gate 2通过。新增详情15请求为14份raw/hash核实成功及青岛1次timeout；Batch6四局第二页各10唯一候选、无首页重叠，但未覆盖90天。FJ失败样本诊断、日期冲突与其它来源边界保留。新S1分页裁定只批准阶段A离线/loopback能力实现；未授权现有来源接入或真实回填。所有请求的实际时间取自manifest，恢复日不扩大观察跨度。

此次的软件运行主体为Luna High；本轮项目provider调用为0。完整测试的模型相关路径只连接localhost fake providers。详细软件/代码状态见[STATUS](STATUS.md)和[阶段交接](HANDOFFS/BEIJING_REAL_VALIDATION_2026-10-06.md)。

## 不可越过的约束

- 开发期间 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、`INDEXNOW_SUBMIT_ENABLED=false`，全部 `FEISHU_*_ENABLED=false`；未通过 Gate 1 不开启真实模型，未通过 Gate 2 不做大规模采集，未通过 Gate 4 不进入 NAS Production。
- 行业信息优先放在 `industry/`；不改 `apps/`、`packages/` 或数据库迁移，除非代码证据证明现有抽象无法满足，且先经过架构审查。
- 不调整 `industry/selection.ts` 门槛；现有门槛只作新行业初始测试值，需 Gold Dataset 校准。
- `industry/pages/terms.md` 和 `industry/pages/privacy.md` 保留模板，不替用户定稿；上线前需用户本人确认。
- 来源正文默认不在站内或全文 RSS 展示；所有付费服务仍经过预算熔断和 receipt。
- 真实信源验证必须检查列表、文章链接、标题、日期、详情页、URL 规律、分页、导航噪声、历史文章及重复项；禁止仅凭 URL 或页面名猜 selector。

## Gate 1 已确认的架构决策

P1 期间完成一次 Sol Gate 1 Review；三项最小收尾已由 Lead 核销并记录 `FINAL_GATE_STATUS=PASSED`。主题存储 group 保持 `company | field | genre`，机构仅改展示语义，避免 schema migration；topics 页面标签从 `industry/site.ts` 读取。`ITEM_TYPES` 动态校验不需要数据库枚举迁移。Sol 批准的必要 API/RSS 分类兼容和 Windows SSR 路径修复已实现，详见 `ARCHITECTURE.md`、`ARCHITECTURE_DECISIONS.md` 与 `GATE_1_REVIEW.md`。Gate 2—5 仍未通过。
