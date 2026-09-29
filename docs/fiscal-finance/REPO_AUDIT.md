# P0 仓库接管审计

审计日期：2026-09-29（Asia/Shanghai）

本文记录 P0 初次接管时的仓库基线和环境快照；后续工作树与 Gate 结果以 `STATUS.md`、`ACCEPTANCE.md` 和 `GATE_1_REVIEW.md` 为准。下文标记“基线”或“审计时”的未完成项不代表当前仍未完成。

## 仓库与 Git 基线

- 上游：`https://github.com/KKKKhazix/AIHOT.git`（只使用其代码框架；项目品牌不得继续使用 AIHOT 名称或 Logo）。
- 工作区：`D:\AI-work\MYHOT\AIHOT`。任务书原目录 `D:\AI-work\MYHOT` 只包含任务书；为保留原件，将仓库克隆在其子目录，目标克隆前不存在。
- 分支：`feat/fiscal-finance-hot`，由上游 `main` 创建。
- BASE_SHA / 初始 HEAD：`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。后续代码提交 SHA 见 `STATUS.md`；文档提交后仓库当前 HEAD 以 `git rev-parse HEAD` 为准。
- 克隆时 `main` 与 `origin/main` 相同，工作树初始干净；最近提交为 `589f79e Security: the visitor's address is decided by the web server; a random database password`，上一条为 `877d6d5 AIHOT: the open-source framework`。
- 基线无 `docs/fiscal-finance/PROJECT_PLAN.md` 或 `STATUS.md`；本轮新增二者。原任务书在父目录的副本已按原字节复制至仓库根，并通过 SHA-256 校验一致。

## 必须遵循的仓库规约

`AGENTS.md` 要求先按 `docs/customize.md` 顺序改行业内容，通常只改 `industry/`；不要擅自决定站名、重要性与噪声标准、分类、信源以及条款隐私最终文本。保留双评分、内容类型加权、五维度、噪声抑制和安全边界；门槛必须通过用户标注样本校准。前端只通过 HTTP 访问 API；模型调用限 worker；付费请求必须经 receipts 和预算熔断；公开出口统一走 publication 层；迁移只做向后兼容增量。测试不得访问外部服务；不能提交 `.env`、密钥或 `.data/`；不得沿用 AIHOT 名称或 Logo。

本任务书已授权站点临时名 `MyHOT`、财政金融分类语义与官方源列表；正式品牌仍未确定，条款和隐私模板仍待上线前用户本人确认。Gate 1 已确认机构主题保留 `company | field | genre` 内部 group 值，展示语义改为机构，不改数据库 schema。

## 当前真实架构与行业残留

- Monorepo 使用 npm workspaces：`apps/web`、`apps/api`、`apps/worker`、`packages/backend`、`packages/contracts`、`industry`；数据库迁移集中在 `database/migrations/`，脚本在 `scripts/`，编排文件是 `docker-compose.yml`。
- 通用分类、标签和实体词表位于 `industry/taxonomy.ts`，其 `ITEM_TYPES` 被 backend 编辑器分析时以 `z.enum(ITEM_TYPES)` 校验，并通过 `CATEGORY_BY_ITEM_TYPE` 补分类标签；无需据此推断要做数据库迁移。类别 key 是公开 URL/RSS/API 身份，上线后应保持稳定。
- `industry/topics.json` 当前 group 是 `company`、`field`、`genre`。`packages/backend/src/publication/topics.ts` 和 `apps/web/app/routes/topics.tsx` 同样把 group 类型写死为上述三值；具体处理应交给 Sol Gate 1 判断，先尝试保持行业适配在 `industry/`。
- 基线 `industry/taxonomy.ts`、`topics.json`、`sources.json`、`site.ts`、`features.ts` 和 prompts 仍为 AI 行业样例。`content-understanding.md`、`structure.md`、`prefilter.md` 包含 AI 标签和领域语义。行业静态改造 Agent 正在处理这些文件；审计时不覆盖其改动。
- 基线 `industry/features.ts` 将 `leaderboard` 与 `codexResetMonitor` 置为 true；worker 对 leaderboard 会排任务。目标行业改造应关闭这两个功能，不需删除底层通用实现。
- 后端源配置严格按信源 kind 校验，不支持字段会被拒绝。已有采集种类：`rss`、`web_list`、`json_list`、`x_search`、`mp_account`、`external`。`web_list` 支持普通 HTML CSS selector、markdown/Jina 回退以及 Docusaurus changelog；detail 可补齐详情页信息，并有 URL allow/deny prefix。HTML 列表解析带去重、页面自身/部分导航链接排除逻辑；selector 仍须逐源实际验证，日期字段可配置 CSS selector、正则和 UTC offset。RSS 与 JSON 为可用原生路径；付费 Jina/X/公众号必须服从 receipt 与预算系统。
- 迁移目录最高编号为 `0038_quote_translations.sql`，目前没有要求变更 schema；`itemType` 在分析响应使用 taxonomy 提供的 enum，并未在本轮发现迁移需要。进一步改 packages/database 前应先验证代码链和 Sol 评审。
- 基线门槛 T1=60、T1_5=65、T2=76。按 `AGENTS.md` 和 `docs/selection.md` 保持原值直到 Gold Dataset 校准。

## 安全环境

- P0 接管时本机未发现 `.env`，未启动服务、Docker、数据库、抓取器或模型。后续 Gate 1 验证使用的隔离临时 PostgreSQL 实例已停止；当前详细环境状态见 `STATUS.md`。
- `.env.example` 原先把 `COLLECT_ENABLED=true` 与 `MODEL_CALLS_ENABLED=true` 作为示例；为满足项目当前安全阶段，仅将这两项示例值改为 `false`。示例中 `FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED` 和 `INDEXNOW_SUBMIT_ENABLED` 已为 `false`。
- 需要谨慎：worker 以 `process.env.COLLECT_ENABLED !== "false"` 判断是否收集，backend 的 `MODEL_CALLS_ENABLED` 缺省值为 true；若启动时变量缺失，仅改示例文件不能自动向进程注入值。后续只可使用显式加载安全配置的命令/环境。
- `.env.example` 中无真实密钥检查被记录；审计输出不包含秘密值。

## 工具、依赖和测试准备

- Node.js `v24.16.0`；npm `11.13.0`；项目要求 Node 24，版本满足。
- `npm ci` 已完成：新增 293 个包；npm 报告 2 个 moderate vulnerabilities。未运行 `npm audit fix`。
- P0 审计时未安装 Docker CLI/Compose、PostgreSQL 客户端 `psql`、`pg_isready`，也未发现 PostgreSQL 服务，隔离测试数据库尚未准备。后续曾以 `.data/` 内官方便携 PostgreSQL 创建隔离测试实例，迁移 35 项、`npm test` 129/129；详情见 `STATUS.md`，临时实例已关闭。
- `git diff --check` 在审计时通过；不是 Gate 测试。

## 下一步

1. 完成 P1 静态行业改造并记录所有工作树更改。
2. 准备隔离的 `*_test` 数据库；运行 typecheck、指定隔离库测试和 web build。
3. 只安排一次 Sol Gate 1 审查，重点处理 topics group 硬编码与建议的 `institution` 语义。
4. P2 每个官方源验证列表、文章链接、标题、日期、详情、URL pattern、分页、导航噪声、历史文章、重复项后再写入 `SOURCE_MATRIX.md`。
5. 未过 Gate 1 前不做真实模型验证；未过 Gate 2 前不大规模采集；未过 Gate 4 前不部署 NAS Production。
