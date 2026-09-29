# 财政金融行业适配架构裁决

日期：2026-09-29。审查模型：gpt-6-sol。以下是 P1 实施所需的 S1 裁决，不表示 Gate 1 已通过；实现和验证由 Luna High 执行。

## AD-001：机构主题保持现有 group key

保留 topics 的内部与接口值 `company | field | genre`，不新增 `institution`。

依据：`docs/customize.md` 已将 `company` 定义为“公司与机构”；`database/migrations/0002_events_reports.sql` 的 topics CHECK 限定三个既存值。主题匹配由 `packages/backend/src/publication/topics.ts` 的 `entity_id` 决定，并不依赖 company 的公司语义。

财政金融显示语义分别为“机构”“重点领域”“内容类型”。机构配置仍设置 `entityId`，topic slug 上线后保持稳定。无需修改 publication 主题类型、API 契约或数据库迁移。

现有 `apps/web/app/routes/topics.tsx` 的标题、SEO、介绍及 GROUPS 硬编码 AI 行业，无法仅修改 topics.json 消除。因此批准最小行业中性扩展：主题目录文案及分组显示配置放在 `industry/site.ts`，Web route 读取该配置并使用 `SITE.subject`。不把财政金融文案硬编码到 apps 中。

## AD-002：八类 ITEM_TYPES 不需要 schema 变更

批准财政金融八类：`policy_release`、`regulatory_rule`、`fiscal_data`、`financial_data`、`debt_event`、`regulatory_action`、`local_practice`、`research_analysis`。

现有消费链为 `industry/taxonomy.ts → editorial/vocabulary.ts → editorial/analyze.ts`；分析输出通过 `z.enum(ITEM_TYPES)` 动态校验，分类标签 fallback 来自 `CATEGORY_BY_ITEM_TYPE`。审查未发现数据库 item_type enum 或 CHECK 限定旧 AI 类型，故无需 schema 或 migration。

Gate 1 仍须核验八类与内容理解、结构提示词、评分权重表及 fixtures 一致；分类 key 与 ITEM_TYPES 是不同维度，不强行建立一一对应。

## AD-003：移除不符合当前公开契约的 tip/opinion 分支

批准 `packages/backend/src/publication/items.ts` 的 `categoryCondition` 删除旧 `v1 && category === "tip"` 特例；同时移除其第二个参数和 `publication/feeds.ts`、`publication/v1.ts` 两处 `true` 实参。

依据：`packages/contracts/src/taxonomy.ts` 明确 `PUBLIC_API_CATEGORY_KEYS = CATEGORY_KEYS`、`PublicApiCategoryKey = CategoryKey`，且 `toPublicApiCategory` 只返回当前分类。当前公开输出没有 opinion 到 tip 的转换，因此原 SQL 合并分支与真实契约不一致。改造后的财政金融分类不包含 tip，此分支还导致 TS2367。

采用所有公开出口一致的精确分类过滤，不扩大参数到任意 string、不用 cast 掩盖错误、不增加未使用的兼容映射抽象。此为现有行业抽象无法完成类型检查的必要最小 packages 修复；无需改契约或迁移。Luna 应验证 v1/RSS 当前分类精确过滤行为。

## AD-004：Windows Web 启动使用标准 file URL

批准 `apps/web/server.ts` 从 `node:url` 导入 `pathToFileURL`，并将构建入口的动态 import 参数改为 `pathToFileURL(path.resolve(import.meta.dirname, "build/server/index.js")).href`。

Luna 已在直接启动生产 Web server 时复现 `ERR_UNSUPPORTED_ESM_URL_SCHEME`，原始 Windows 绝对路径被 ESM 识别为 `d:` scheme。file URL 同时兼容 Windows 和 Linux，并正确处理路径中的空格及保留字符。这是用户要求的 Windows 本地验收必要修复，不改变 SSR、代理、安全或行业抽象。实现后由 Luna 重跑既有 Web tests 并验证直接启动。

## 审查边界

上述决策只解决实施中明确出现的架构冲突。未运行测试、未调用模型或抓取服务，未修改实现。Gate 1 需独立记录正式结论及 typecheck、隔离测试数据库测试、Web build 等证据；数据库不可用时不能宣称 Gate 通过。
