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

## AD-009：官方短公告与 PDF 的受限正文能力

本次为 P3 新证据触发的一次 S1 裁决，不是 Gate 2 Review。它以明确阶段替代 AD-007 的本轮暂缓结论；AD-007 对全局门槛、付费服务和未知正文不伪造成功的约束继续有效。

### 证据与需要改变的能力

- 隔离库三源 30 篇 HTML 经既有入口验证后，28 篇 ok、2 篇 unconfirmed。其余 24 篇增量为 23 ok、1 unconfirmed；新增的金融企业财务快报失败原因仍 unknown，不能据此推断为 PDF 或短文。
- 人民银行 OMO 第191号完整正文约 162 字，被默认 200 字 Readability 门槛拒绝；相邻第190号约 204 字。完整短公告不能仅因长度波动而丢失。
- 金融司公示页面约 158 字是附有结果 PDF 的说明；Luna 有界验证[附件](https://jrs.mof.gov.cn/gongzuotongzhi/202606/P020260608599408762517.pdf)为 PDF 1.7、66,740 字节、1 页，本地文本层约 281 字，且 pdfplumber 得到 6×4 表格、公示名称命中。首行四列为“档次/地区、第一档、第二档、第三档”。它支持本地文本层解析可行性，但不代表 Node 生产解析器已验证。
- 福建厅[代表 PDF](https://czt.fujian.gov.cn/zwgk/tzgg/202609/P020260915683599278277.pdf)为 PDF 1.4、178,333 字节、4 页；两种现有本地解析器逐页均无文字，每页存在图像对象，是扫描图像，不能凭“PDF 下载成功”宣称正文提取成功。
- 现有 pageFetchable 允许 PDF URL，但 extractFromUrl 只接受 HTML；现有 detail.summarySelector 只提供 excerpt，不能解决完整正文。通用正文能力扩展有代码与来源证据依据，无需修改 schema。

### 当前批准实施：共享显式正文提取与离线 PDF PoC

1. **已核完整短公告的 opt-in 结构提取。** 批准一个共享 HTML 正文 helper，显式配置精确的主正文 selector 和短正文 opt-in，供 fetchDetail 与 extractArticleBody 使用；source 配置新增字段须进入 whitelist 并在 docs/sources.md 说明。未配置时继续原 Readability 路径和 200 字门槛，不增加 source.minBodyChars。

   selector 必须匹配唯一正文容器；空白、仅导航/链接、模板残留或标题/日期不符不能确认成功。被授权的短正文容器须有完整可见正文证据及正反 fixtures，先用于已核 OMO 公告，并保留表格、金额、单位、日期，统一 sanitize。配置的人工核验承担“该容器确为完整正文”的依据，机构名或官方域名本身不能替代证据。金融司附件公示的 158 字 intro 不属于完整结果，不能走此路径标为完整 ok，更不能由 detail 预取先标 ok 而跳过 PDF。

2. **本地 PDF 文本层 helper 与有界离线 PoC。** 批准纯文本层解析 helper、隔离执行边界及离线 fixtures；Luna 实施前验证选用依赖的许可、固定版本、Node 24 和 Windows/Linux 兼容性，并记录 lockfile 变化。Sol 不安装或实现依赖。parser 输入只为有界 bytes，不接收 URL，不自行联网、执行 PDF JavaScript、打开嵌入文件、渲染或 OCR。对金融司样本核对标题及表格行列和关键数字，而不是仅判断输出超过 200 字。

   福建扫描样本作为明确不支持的负例：空文本/扫描、加密、损坏或超限 PDF 返回 unconfirmed 和可检查原因，不补造、不以文件标题冒充正文。当前可实施 helper 和离线验证；在下一段条件满足前不接入自动网络附件获取。

### 下一子阶段：通过安全与完整性证据后接入

批准以下实现方向，启用前由 Lead 按本裁决核验 Luna 证据，无需重做本次 S1；它不允许越过 Gate 2。

- 先接入来源显式 opt-in 的直接 PDF，再接入精确定位在主正文附件区、恰好一个匹配项的 PDF。零个、多个或附件用途不明保持 unconfirmed，禁止扫描整页所有链接、递归跟随附件或根据扩展名猜任意 URL。当前金融司已核单附件为后者的首个验证场景。
- 每次请求复用 guardedFetch，保留 DNS/连接时 SSRF 与私人地址防护；只接受配置允许的官方 HTTPS 来源范围。最小首版不跟 PDF 重定向（maxRedirects=0）；将来确需重定向时必须逐跳同时核验来源范围与 SSRF，不能只在最终响应检查。拒绝非 PDF MIME/魔数、异常状态、登录页、错误页和未允许主机。
- 下载上限沿用正文的 6 MiB；解析首版上限 40 页、120,000 个输出字符、10 秒独立解析 deadline、每进程一次解析。这些是拒绝边界，不能截前 N 页/字符就标完整 ok。所有页完成才成功；下载有既有 20 秒总预算。具体数值可收紧，放宽须另有资源证据。
- 解析运行于可终止的隔离子进程，设置明确内存预算和输出上限，超时由父进程实际终止，不能只 Promise.race 后让解析继续。证据须覆盖损坏文件、资源超限、解析 hang、并发和清理；生产硬内存约束在 NAS/container 验收落实前不宣称已解决。parser 不允许外部字体/图像或文件资源自动加载。
- HTML 通知和 PDF 附件按原来源分段组合，保留附件 URL 与标题；不把附件内容冒称为 HTML 原句。全文仍只作后端分析材料，site_fulltext/syndicate_fulltext 保持 false，公开默认摘要和原文链接。沿用现有 article body/revision/content hash 和 publication 路径，不新增附件数据库或公开文件服务。
- 同一共享正文路径处理元信息预取和 extraction job，防止预取把部分正文先写为 ok。选择器或 PDF 失败保持 unconfirmed，并有有界诊断原因；不自动进入 Jina、模型或 OCR。

### 保持不变与 Gate 2 判据

默认 Readability 200 字门槛、精选门槛、真实模型关闭、JINA_BODY_FALLBACK=false、receipt/预算与版权展示边界保持不变。无 schema/migration、API 或 apps 扩展；必要代码限后端通用正文 helper、配置入口、测试及文档。

福建和厦门官方一手源仍为核心 T1，不因格式困难降优先级或永久排除。扫描材料保留来源记录、原文链接与明确格式缺口；若内容由题名和原文证据明确是招聘/考试等噪声，可按原有领域规则排除，不能仅因 PDF/扫描格式排除。重要扫描材料的可靠正文仍需后续受控人工文本获取或另立 OCR 实施阶段，当前不授权 OCR。

正式 Gate 2 前，每个拟用于 P4 的核心来源须有真实有界抓取、第二轮去重、发布日期口径、详情和代表性重要内容完整性证据。已知 PDF/短文格式不能从验收样本中隐去；至少验证 OMO 完整短文、金融司公示与其表格附件、福建扫描材料的明确处置边界。未知失败原因仍列 unknown；重要内容无法可靠得到正文或明确处置时，该覆盖缺口继续阻塞相应来源验收，不以配置/PoC代替稳定性。

当前批准能力分阶段推进，不代表 Gate 2 已通过，不开启 worker、大规模采集、真实模型或部署。

## 审查边界

AD-005 至 AD-008 是针对实现中明确出现的解析器兼容问题作出的 S1 决策；获批的 parser 修复已落地，完整测试、typecheck 和离线兼容测试证据见 `COLLECTOR_AUDIT.md`。P3 受控 collector 验证只覆盖隔离测试库上的少量官方列表请求，不启动 worker 或模型，细节见 `P3_INGEST_VALIDATION.md`。这些 S1 批准和局部验证均不替代 Gate 2 Review，也不表示真实正文链路或信源长期稳定性通过。
