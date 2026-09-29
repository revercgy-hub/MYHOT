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

用户新增要求：资讯咨询覆盖全国财政部各地监管局发布的新闻动态。该要求纳入现有官方来源建设，不代表增加金融监管总局地方监管局等其他机构来源，也不扩展为 35 个地方机构主题页。分类沿用现有“财会监督”“地方实践”“政策发布”等标签；条目保留实际发布局名称。通过财政部汇总栏目纳入时按财政部汇总来源展示，不把汇总稿错误归属给某个地方局。

本轮仍处于 P3 有限验证：先核验一个可覆盖多地监管局动态的财政部官方汇总入口，并用少量代表性地方局站点确认覆盖关系或补充价值；只做有界的页面结构与候选预览验证。具体来源、页面结构和结果由 `SOURCE_MATRIX.md` 逐项记录。新增信源保持 `enabled=false`、全文开关关闭，不运行大规模 collector 或模型任务；该工作不改变 Gate 2 的通过条件，也不构成 Gate 2 通过。

## 不可越过的约束

- 开发期间 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、`INDEXNOW_SUBMIT_ENABLED=false`，全部 `FEISHU_*_ENABLED=false`；未通过 Gate 1 不开启真实模型，未通过 Gate 2 不做大规模采集，未通过 Gate 4 不进入 NAS Production。
- 行业信息优先放在 `industry/`；不改 `apps/`、`packages/` 或数据库迁移，除非代码证据证明现有抽象无法满足，且先经过架构审查。
- 不调整 `industry/selection.ts` 门槛；现有门槛只作新行业初始测试值，需 Gold Dataset 校准。
- `industry/pages/terms.md` 和 `industry/pages/privacy.md` 保留模板，不替用户定稿；上线前需用户本人确认。
- 来源正文默认不在站内或全文 RSS 展示；所有付费服务仍经过预算熔断和 receipt。
- 真实信源验证必须检查列表、文章链接、标题、日期、详情页、URL 规律、分页、导航噪声、历史文章及重复项；禁止仅凭 URL 或页面名猜 selector。

## Gate 1 已确认的架构决策

P1 期间完成一次 Sol Gate 1 Review；三项最小收尾已由 Lead 核销并记录 `FINAL_GATE_STATUS=PASSED`。主题存储 group 保持 `company | field | genre`，机构仅改展示语义，避免 schema migration；topics 页面标签从 `industry/site.ts` 读取。`ITEM_TYPES` 动态校验不需要数据库枚举迁移。Sol 批准的必要 API/RSS 分类兼容和 Windows SSR 路径修复已实现，详见 `ARCHITECTURE.md`、`ARCHITECTURE_DECISIONS.md` 与 `GATE_1_REVIEW.md`。Gate 2—5 仍未通过。
