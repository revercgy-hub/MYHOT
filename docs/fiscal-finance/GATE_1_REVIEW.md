# Gate 1 架构审查

REVIEW_DATE=2026-09-29
REVIEW_MODEL=gpt-6-sol
REVIEW_COUNT=1
CURRENT_BRANCH=feat/fiscal-finance-hot
REVIEWED_HEAD=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
REVIEW_SCOPE=本次 HEAD 上的 P1 工作树改动；P2 信源配置只核验安全边界，不作为 Gate 2 验收
RESULT=CHANGES_REQUIRED

核心架构和已提交审查的测试证据满足 Gate 1 要求。结论要求完成下列静态收尾后，由 Lead 核销；不重复安排第二次 Sol Gate 1 审查。

## 最小必要修复项

1. **替换上游品牌资产。** 审查快照中 `industry/brand/logo.svg`、图标及日报/周报/月报/归档 nameplates 尚未产生工作树改动，仍沿用上游资产。`AGENTS.md` 明确禁止使用 AIHOT 的 Logo。Luna 应使用临时 MyHOT 品牌生成或替换行业层资产，并确认现有引用路径和 nameplate viewBox 配置有效。无需调整通用页面布局或正式站名。
2. **清理用户可见示例。** `industry/changelog.json` 仍是未来日期的“网站上线”示例，不得让它冒充本项目已经上线；改为真实的开发阶段记录或清空示例。`apps/web/app/routes/feedback.tsx` 的 OpenAI 搜索例和 admin/source-new.tsx 的 OpenAI 博客占位改为行业中性或使用 SITE 配置。上游框架归因、包名和实现注释可以保留，不强行重命名内部标识。
3. **同步真实状态及安全命令。** `STATUS.md`、`ACCEPTANCE.md` 在审查时仍写“数据库不可用、检查未运行”；须更新实际数据库和测试结果、Gate 修复状态、P2 尚未完成事实。`LOCAL_DEVELOPMENT.md` 的 `FEISHU_EXTERNAL_ENABLED` 不是实际安全阀，应改为 `FEISHU_CONTENT_PUSH_ENABLED=false`；保留 `FEISHU_INTERNAL_ENABLED=false`，说明测试进程只连接 loopback mock、开发运行真实模型保持关闭。

上述项由 Luna 完成，Lead 记录核销文件、验证结果及最终 SHA；未核销前不标记 Gate 1 通过。品牌或 Web 占位修改后完成受影响的构建/静态检查，不必由 Sol 重做测试。

## 已通过的架构检查

- 财政金融八个分类 key、八个 ITEM_TYPES、十四个分类标签与内容理解白名单、fallback、评分类型表一致。分类与内容类型是不同维度，不要求一一对应。新类型由行业配置动态消费，无 schema/migration 需要。
- topics 继续使用 `company | field | genre` 存储/API 契约，company 在财政金融页面显示“机构”。主题使用稳定 slug、entityId 或白名单标签，匹配仍由 publication 层负责；未破坏数据库 CHECK 或公开读取层。
- 主题目录的行业文案移到 SITE 配置；其通用 Web route 修改有必要且范围小。topics.json 中的 groups 与 SITE.topicsPage.groups 当前一致；后续更新应以实际消费的 SITE 配置为准，避免双份文案漂移。
- 二十份修改后的提示词保留原有结构化输出字段和 include 能力。五轴、类型权重、噪声压制、独立双评分及系统决策分工保持；八行权重和均为十。福建厦门事项按直接工作影响评价，不因全国传播度低机械降权。政策阶段、数字单位、证据强度和不补造要求明确。
- selection.ts 门槛保持不变，现阶段只作为上游初始值；真实模型质量与门槛校准属于后续 Gold Dataset，不由本次 Gate 1 推定完成。
- `publication/items.ts` 移除不符合现行类别契约的 tip/opinion 合并，feeds/v1 两处调用同步；类别公开出口均精确过滤。API v1 的默认类别由当前 CATEGORY_KEYS 的首项提供，不再硬编码旧 tip。相关双分类 v1/RSS 测试覆盖此行为。
- Web 生产入口通过 pathToFileURL 导入构建产物，解决 Windows 盘符 ESM 错误，保留跨平台启动能力；未改变代理与 TRUST_PROXY 边界。
- 无通用架构重构，无数据库迁移修改。前端仍通过 HTTP 读取 API；模型、数据库与密钥仍在后端；公开出口、receipt、预算熔断、匿名展示与授权全文机制保持原链。
- leaderboard 与 codexResetMonitor 关闭；真实采集、模型、IndexNow 与飞书推送关闭。四个已核 HTML/详情的官方来源全部 disabled、全文开关为 false；其他来源不猜 selector。P2 的阻塞、分页覆盖和日期偏差留待 SOURCE_MATRIX/P3 验收。
- 使用条款与隐私模板没有由 Agent 擅自定稿，生产前仍需使用者本人确认。

## 测试证据及边界

本审查不重跑测试，依据 Luna 的实际执行报告、修改后的行为测试与日志审查：

- `npm run typecheck`：通过（Luna 报告）。
- 空的隔离 `fiscalhot_test`：全部 35 个现有 migration 成功（Luna 报告）。
- `npm test`：129/129 通过，无 skip/fail；`.data/npm-test-clean.log` 末尾结果为 duration_ms 33291.6945，审查已读取。
- `npm run build -w @aihot/web`：通过（Luna 报告）。
- Web tests：11/11 通过；Windows 入口直接启动通过（Luna 报告）。
- 测试使用 loopback mock 处理模型请求，测试专用 MODEL_CALLS_ENABLED=true 不表示打开真实 provider；开发/worker 运行安全阀保持关闭。Windows shutdown fixtures 用 IPC 进入同一 shutdown path，Unix 仍使用 SIGTERM；未修改生产 shutdown 实现。

本结论不授权大规模采集、真实模型精选、NAS Staging 或 Production。不将 HTML 结构验证当作 collector 稳定性，不将 mock 测试当作模型质量验收。Gate 2—5 均未通过。

## Lead 核销记录

待 Luna 完成最小修复后由 Lead 填写，保留本次原始审查结论和修复追溯。

FIXES_VERIFIED=Lead 已核销三项最小修复：MyHOT 临时 M 图标与财政金融轮廓报头；真实 2026-09-29 开发日志及公开/后台行业示例；STATUS、ACCEPTANCE 与实际飞书安全阀说明。保留 Sol 原始 CHANGES_REQUIRED 结论。
FINAL_GATE_STATUS=PASSED
VERIFIED_SHA=fe387306fe51dd50faea8e22a38aec8b2444e7bd

Lead 核销证据：检查上述文件实际内容和 Git diff，目视核验 icon.png 为临时 M 标记；git diff --check 无错误。Luna 完成收尾后再次通过 typecheck、web build 与 11/11 Web tests；干净隔离数据库完整测试 129/129、35 项迁移通过。此次只核销唯一正式审查的最小项，没有第二次 Sol Gate 1 Review。Gate 2—5 仍未通过。
