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

## AD-005：HTML 列表可显式使用完整标题属性

批准 `web_list` 新增可选 `titleAttribute` 配置及 `sources/config-keys.ts` 对应 whitelist。`sources/web-list.ts` 从既有 `titleSelector` 选中的 titleEl 读取该属性，归一化后若有内容则优先作为标题；属性缺失或只有空白时保持原来的 text → link title 回退，未配置此项时保持旧行为。

依据：Luna 的实际页面证据表明人民银行厦门列表可见文本截断，链接 title 属性含完整标题；当前提取器只有 text 为空才使用链接 title，无法通过现有配置修正。此为通用 HTML 属性提取能力，不加入站点判断、不改数据库。Luna 需同步 `docs/sources.md`，并以截断显示/完整属性、缺失属性和未配置三个 fixture 验证行为。

## AD-006：无时区日历日期使用来源 offset

批准 `parseLooseDate` 在 Date.parse 回退前识别明确没有时区的日历日期/时间，包括 ISO date-only 及 T/空格分隔的 naive datetime，并按既存 `publishedAtUtcOffset` 或默认 `+08:00` 构造时刻。

依据：当前函数先 Date.parse，导致 ISO date-only 固定按 UTC、无时区 datetime 依赖 host TZ，现有 offset 配置对这些合法格式不生效。该行为影响源日期、freshness 与跨 Windows/NAS 展示一致性。

最小实现边界：显式 Z 或 ±offset 的输入保持 Date.parse 语义；不得由宽松正则截去时区、尾部内容或未经确认地解释其他格式。严格检查日历组件、闰年和时间，非法日期返回 null，不能自动滚入次月。其他格式保留既有解析回退，不引入日期库或数据库迁移。Luna 用多 TZ 子进程、非默认 offset、显式时区不变及非法日期 case 验证，并复核现有相关测试。

## AD-007：本轮不扩大正文解析能力

批准本轮不新增 PDF 解析器、不降低既有 200 字符正文下限、不新增来源专用最短正文配置。部分已核来源包含 PDF 链接或过短公告，现有 HTML 抽取器不能据此确认完整政策内容；为凑信源数量绕过下限会让空壳材料进入后续链。

仅对实际核验的附件 URL 前缀设置现有 `denyUrlPrefixes`，本地安全环境明确 `JINA_BODY_FALLBACK=false`，避免真实验证意外进入付费补正文路径。不能可靠覆盖正文的源继续 disabled，并将缺口记录在 SOURCE_MATRIX。后续可在有明确内容和许可证据后单独设计 PDF 路径，不把本轮 S1 裁决当作 Gate 2 稳定性通过。

## AD-008：JSON 日期字符串可显式使用来源 offset

批准 `json_list` 新增可选 `publishedAtUtcOffset` whitelist；当明确配置该字段且没有 `publishedAtUnit` 时，日期字符串使用已实现的严格 `parseLooseDate`。未配置 offset 时维持既有 Date.parse 行为；`epoch_ms`、`epoch_s` 和 `yyyymmdd` 继续走原 unit 分支并优先于 offset，不改已有 epoch 时刻或 yyyymmdd 的 UTC 语义。上述优先级应写入 `docs/sources.md`。

批准把已有 `parseLooseDate` 实现提取到无 HTML/provider 依赖的 `sources/date.ts`，`web-list.ts` 导入并保留原有 export，维持既有调用和测试接口；`json-list.ts` 直接依赖纯日期模块，避免为解析 JSON 引入 Cheerio、Readability 或 Jina。只提取现有实现，不扩大日期解析语义，无 schema、migration 或 apps 修改。

依据：Luna 已验证厦门证监局官方 JSON 列表及可提取详情，发现 `publishedTime` epoch 与页面 `publishedTimeStr` 表示的墙上时间不一致；无时区字符串直接 Date.parse 则又依赖 host TZ。应使用核验过的字符串字段和明确 `+08:00`，以详情页日期作交叉证据，不增加针对该来源错误 epoch 的时间修补特例。

Luna 已用 `fetchJsonList()` 对厦门证监局实际配置验证 20 条候选，并通过不同 host TZ、显式 Z/offset、epoch 与 `yyyymmdd` unit、非法日期及 legacy 行为测试。未知显式 unit 也保留原 Date.parse 语义。厦门证监局源已在矩阵记录 preview，但继续 disabled，直到完成 P3/Gate 2 的分页、正文和稳定性验收；此裁决不表示 Gate 2 通过。

## 审查边界

AD-005 至 AD-008 是针对实现中明确出现的解析器兼容问题作出的 S1 决策；获批的 parser 修复已落地，完整测试、typecheck 和离线兼容测试证据见 `COLLECTOR_AUDIT.md`。P3 受控 collector 验证只覆盖隔离测试库上的少量官方列表请求，不启动 worker 或模型，细节见 `P3_INGEST_VALIDATION.md`。这些 S1 批准和局部验证均不替代 Gate 2 Review，也不表示真实正文链路或信源长期稳定性通过。
