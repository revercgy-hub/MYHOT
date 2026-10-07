# 财政金融热点站阶段计划

本计划依据仓库根目录的[《财政金融热点站完整开发与部署任务书.md》](../../财政金融热点站完整开发与部署任务书.md)及仓库 `AGENTS.md`、`docs/customize.md`、`docs/sources.md`、`docs/selection.md`、`docs/deploy.md` 整理。任务书原件位于仓库父目录，仓库内副本 SHA-256 完全一致。若任务书与 `AGENTS.md` 或当前代码能力冲突，按优先级记录并解决，不为符合计划而破坏通用架构。

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
