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

## 新增来源覆盖要求：财政部各地监管局动态

用户新增要求：资讯咨询覆盖全国财政部各地监管局发布的新闻动态。该要求纳入现有官方来源建设，不代表增加其他机构来源或扩展为各局全部主题栏目。用户确认首阶段须逐一覆盖各财政部地方监管局新闻动态栏目，中央选登只作补充。内容边界已确认：无实质业务事实的内部活动排除；新政策、问题发现、监管措施、调研成果纳入；地方一手内容不因传播范围低而降优先。`prefilter`与`selection-score`提示词已作最小文字更新，但无人工Gold模型评估或硬过滤器。用户确认附件无法可靠解析时保留原始URL、标注正文待解析、不进入自动精选，后续补解析；不支持附件不等于正文ok或来源通过。2026-10-04 Sol给严格首次90天日期范围及附件诊断/自动精选防护`APPROVED_SCOPE`，仅批准实现范围，不是Gate 2通过。S1实现已集成到代码SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0`；最终fresh本地QA的250/250测试、typecheck、Web build/tests、重启到当前构建的loopback smoke以及CI run 37163791233均已通过。没有新增DB migration；未启用source或worker。用户确认daily check与首次近90日目标已写入disabled行业source JSON（12源），但未导入正式source行或验证定时运行；通用collector 12个月默认仍保留。以上配置/prompt不表示生产运行或Gate通过。分类沿用现有“财会监督”“地方实践”“政策发布”等标签；条目保留真实发布局名称，汇总稿按汇总来源展示。

此前P3有限验证与中央选登及少量代表性地方局站点不能视为逐局覆盖。35个官方目录/域名是映射候选，不等于来源/feed。2026-10-04首批、2026-10-05批次2–9与浙江监管工作栏目有限观察，逐局证据见[覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)：批次5–9尝试19局，其中18局有目标栏目首屏、甘肃主页超时；浙江监管工作页9条候选仍未验证详情/分页。批次5河南/湖北/湖南/广东各有一篇详情样本，标题和日期匹配，但内容差异明显（河南/广东为财政监管业务，湖北/湖南为内部宣传/培训），不能由单篇推断source总体噪声。北京、福建、上海在fresh隔离库内各有受限真实collector结果；上海重复列表超时后停止并标partial。上述样本不证明栏目完整、90天历史窗口、分页、selector稳定性、周期稳定性或来源通过。当前15个来源仍disabled、全文关闭；新增河南/湖北/湖南/广东4条来源只处于批准实现阶段，须待代码冻结后完成回归与最终CI。Gate 2仍NOT_PASSED。

2026-10-05工程增量：行业配置总数由12增至15，新增福建、北京、上海三条来源，均为disabled且站内/RSS全文关闭；saved fixture配置测试与新隔离数据库两阶段集成测试通过。新集成测试使用loopback fixtures及合成正文，证明测试数据库中collector、元数据持久化、队列和显式抽取的衔接，不代表真实来源运行或验收。第四批江苏、浙江、安徽、江西观察由独立QA核验预算/raw hash：江苏、安徽、江西各有一次10项列表样本，浙江页面只得到无列表的JS跳转包装；这些单时点页面仍不构成source pass。福建、北京、上海三页在相隔32小时22分的两次手工观测间无候选变化；此证据不是scheduler运行、稳定性或Gate通过。三局配置/测试和signals本地provider fixture隔离测试在fresh数据库完整回归252/252、typecheck通过；Web build、Web tests 15/15及loopback smoke 28/28通过。所有来源继续disabled，未导入正式数据库，无worker、模型或采集任务；Gate 2仍`NOT_PASSED`。测试代码SHA、docs HEAD与本轮分支状态见[阶段检查点](HANDOFFS/BUREAU_CONFIG_INTEGRATION_2026-10-05.md)及[状态页](STATUS.md)。

早期10/06恢复文档检查点（状态由下段的阶段检查点继续更新）：已提交代码15源，A新增四局配置/测试仍在做；同时记录了FJ/SH collector与四局首篇详情事实。该段是当时状态快照，不能代表工作树当前状态。

2026-10-06阶段检查点：A完成四个新增disabled来源配置，当前未提交industry source工作树为19项（相对已提交15项；均未导入正式source表）。四局配置修复前fresh完整软件检查为Windows 252/252、typecheck、Web build/tests15/15、smoke28/28；最终combined修复检查仍待S4。新增批次详情15条获批GET中14次HTTP200，raw/hash独立核对通过；唯一青岛请求20秒timeout后停止。浙江“监管工作”首篇详情日期/题名对应，正文为666字符/4段财政监管机制内容。FJ隔离库唯一pending文章cap1抽取诊断为`unconfirmed/non_article_container`，正文只有重复标题，附近PDF未请求；Sol审查确认无marker unconfirmed有自动分析/精选可达路径，并批准最小source-specific正文就绪保护，现由Root分派实施。19源full green是修复前基线，不能当最终代码验收；Gate 2仍`NOT_PASSED`，source继续disabled且无worker/model。各实际请求UTC时间见manifest，10/06恢复日期不扩大观测跨度。

## 不可越过的约束

- 开发期间 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、`INDEXNOW_SUBMIT_ENABLED=false`，全部 `FEISHU_*_ENABLED=false`；未通过 Gate 1 不开启真实模型，未通过 Gate 2 不做大规模采集，未通过 Gate 4 不进入 NAS Production。
- 行业信息优先放在 `industry/`；不改 `apps/`、`packages/` 或数据库迁移，除非代码证据证明现有抽象无法满足，且先经过架构审查。
- 不调整 `industry/selection.ts` 门槛；现有门槛只作新行业初始测试值，需 Gold Dataset 校准。
- `industry/pages/terms.md` 和 `industry/pages/privacy.md` 保留模板，不替用户定稿；上线前需用户本人确认。
- 来源正文默认不在站内或全文 RSS 展示；所有付费服务仍经过预算熔断和 receipt。
- 真实信源验证必须检查列表、文章链接、标题、日期、详情页、URL 规律、分页、导航噪声、历史文章及重复项；禁止仅凭 URL 或页面名猜 selector。

## Gate 1 已确认的架构决策

P1 期间完成一次 Sol Gate 1 Review；三项最小收尾已由 Lead 核销并记录 `FINAL_GATE_STATUS=PASSED`。主题存储 group 保持 `company | field | genre`，机构仅改展示语义，避免 schema migration；topics 页面标签从 `industry/site.ts` 读取。`ITEM_TYPES` 动态校验不需要数据库枚举迁移。Sol 批准的必要 API/RSS 分类兼容和 Windows SSR 路径修复已实现，详见 `ARCHITECTURE.md`、`ARCHITECTURE_DECISIONS.md` 与 `GATE_1_REVIEW.md`。Gate 2—5 仍未通过。
