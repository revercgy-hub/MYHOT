# P3 日期口径与预算司首页覆盖审计（2026-09-30）

## 结论

复核官方快照和当前日期解析代码后，没有发现需要修改 `industry/sources.json` 的配置错误。会计司所谓“列表 9/21、详情 9/22”的一天差异来自把列表日期解析后的 UTC 日期切片当作中国日历日：原始列表 `<span>`、详情 `PubDate` 和可见“发布日期”实际都落在 2026-09-22。厦门证监局 API 的 `publishedTimeStr` 与官方正文可见日期同为 9 月 15 日；详情 `PubDate` 和页面生成元数据同为 9 月 23 日，但其具体时间语义无法由现有证据确定。配置继续使用 API 字符串字段，保留该语义限制。

这纠正了旧报告中两个“列表与详情日期冲突”的口径；不会把它们写成已证明的跨周期稳定性，也不改变 Gate 2 未通过的结论。

## 方法与范围

本次没有新增官方 HTTP 请求。复用了 2026-09-29 的八次单次只读官方 GET 记录及忽略目录中的原始响应，并用仓库当前 `industry/sources.json` 和 `packages/backend/src/sources/web-list.ts#fromHtml()` 对保存的预算司、会计司列表快照离线重算。CSRC 日期比较复用官方 API/详情快照及既有请求记录。没有重试、数据库写入、队列、worker、模型或付费请求。

当前 collector 日期映射如下：

- HTML 列表 `fromHtml()` 读取 `publishedAtSelector` 命中的元素文本，并通过 `parseLooseDate(..., publishedAtUtcOffset)` 解析；日期仅含年月日时，`+08:00` 使结果表示中国该日零点对应的 UTC 瞬间。
- JSON 列表 `fetchJsonList()` 从 `publishedAtPath` 取值；显式配置 `publishedAtUtcOffset` 且值为字符串时，同样按该时区解析。`publishedAtUnit` 若配置则优先；厦门证监局未配置单位，故代码使用字符串 `publishedTimeStr`。
- 当前来源的 collector 每轮只读取配置的首页 URL。它不自动翻页，因此首页样本窗口只说明当前 URL 的候选边界。

代码依据：[web-list.ts](../../packages/backend/src/sources/web-list.ts)、[date.ts](../../packages/backend/src/sources/date.ts)、[json-list.ts](../../packages/backend/src/sources/json-list.ts)、[collect.ts](../../packages/backend/src/sources/collect.ts)。来源配置见 [sources.json](../../industry/sources.json)。

## 会计司：9 月 21 日 UTC 与 9 月 22 日中国日历日

| 证据字段 | 官方快照中可复核的值 | 含义与解析结果 |
|---|---|---|
| 列表 `span` | `2026-09-22` | 官方列表展示的日历日。文章 URL 含 `t20260921_3997874.htm`，路径日期不是该列表 `span` 的替代值。 |
| 当前 `fromHtml()` 对该列表项的结果 | `2026-09-21T16:00:00.000Z` | 等于 `2026-09-22T00:00:00+08:00`；查看 UTC 日期会显示 9 月 21 日，换回 `+08:00` 后是 9 月 22 日。 |
| 详情 `PubDate` | `2026-09-22 14:39:00` | 详情元数据日期，与列表所示中国日历日一致。 |
| 正文页脚日期 | `发布日期：2026年09月22日` | 面向读者的明确发布日期，与列表及 `PubDate` 一致。 |
| 函件正文落款 | `2026年9月17日` | 文书落款，不是网页发布日期；可早于网页发布日。 |

原始详情和列表快照分别为 `.data/fiscal-central-audit/html/mof-accounting-detail.html`、`.data/fiscal-central-audit/html/mof-accounting-1.html`。详情链接为[官方文章](https://kjs.mof.gov.cn/gongzuotongzhi/202609/t20260921_3997874.htm)，列表入口为[会计司工作通知](https://kjs.mof.gov.cn/gongzuotongzhi/)。

因此当前 `publishedAtSelector: "span"` 加 `publishedAtUtcOffset: "+08:00"` 读取的是列表显示的 9 月 22 日，并未错映射成 9 月 21 日。UTC 序列化会改变日期字符串的日部分，但不改变中国日历日或按日判断的新鲜度；无需以详情时间替换列表时间。旧材料将 `2026-09-21T16:00Z` 或 URL 路径中的 9/21 写作“列表日”时，应按上述口径更正。正文中的 9/17 是文书落款，不能拿来作页面发布时间比较。

## 厦门证监局：可见日期与生成元数据不一致

冲突样本是[官方文章](https://www.csrc.gov.cn/xiamen/c101757/c7658572/content.shtml)：

| 证据字段 | 值 | 可支持的结论 |
|---|---|---|
| API `publishedTimeStr` | `2026-09-15 12:43:00` | API 列表向 collector 提供的本地时间字符串。 |
| API `publishedTime` | `1789418580000` 毫秒 | 同一列表记录的 epoch；换算后是 `2026-09-15 12:43:00 +08:00`。此样本两者一致。 |
| 监管工作首页/详情正文可见日期 | `2026-09-15`；详情写作“日期：2026-09-15” | 列表提供日与读者可见日期一致。 |
| 详情 `PubDate` | `2026-09-23 17:33:09` | HTML 元数据中的值，比正文日期晚八天。 |
| 页面生成元数据 | `页面生成时间 2026-09-23 17:33:09` | 与该页 `PubDate` 完全相同，说明两字段在此页同值；不能据此推断其业务语义或断言文章更新日。 |

机器记录见 `.data/fiscal-central-audit/p3-date-freshness-20260929.json` 和 `.data/fiscal-central-audit/csrc-fetchJsonList-offset.json`；详情快照见 `.data/fiscal-central-audit/html/csrc-date-conflict.html`。`SOURCE_MATRIX.md` 还记录了此前首页上同一文章显示 9 月 15 日。

当前 `industry/sources.json` 配置 `publishedAtPath: "publishedTimeStr"`、`publishedAtUtcOffset: "+08:00"`。这会把列表发布时间解析为 `2026-09-15T04:43:00Z`，保留中国日历日 9 月 15 日；它不会从详情页抓取或采用 `PubDate`。API 对该属性没有附带更完整的语义说明，所以“API 字符串字段”是当前最有证据支持的发布时间映射，不等于证明详情 `PubDate` 的含义。不要把 9 月 23 日静默重解释成“更新时间”，也不要把它覆盖成 `publishedAt`。该条的发布日期仍按 API 和正文可见日期记录；详情元数据的八天差异留作来源元数据限制。

## 预算司首页窗口

对保存的官方首页快照 `.data/fiscal-source-audit/lists/mof-budget-work.html` 使用当前源 selector 离线运行 `fromHtml()`，解析 10 条候选、10 个不同 URL；按 `+08:00` 还原列表展示的中国日历日如下。日期非递增，快照中的行顺序为新到旧：

| 顺序 | 列表日期 | 标题（简写） |
|---:|---|---|
| 1 | 2026-03-26 | 财政部有关负责人就2026年中央预算公开答记者问 |
| 2 | 2025-06-25 | 2026年中央部门预算编制工作动员会 |
| 3 | 2025-03-26 | 财政部有关负责人就2025年中央预算公开答记者问 |
| 4 | 2025-01-03 | 县级基本财力保障机制奖补资金管理办法 |
| 5 | 2024-09-03 | 修订2024年政府收支分类科目的通知 |
| 6 | 2024-03-27 | 落实党政机关习惯过紧日子有关要求 |
| 7 | 2024-03-26 | 财政部有关负责人就2024年中央预算公开答记者问 |
| 8 | 2023-11-23 | 下达2023年县级基本财力保障机制奖补资金预算 |
| 9 | 2023-11-23 | 县级基本财力保障机制奖补资金管理办法 |
| 10 | 2023-07-24 | 2024年中央部门预算编制工作动员会 |

这证明该份首页快照实际返回 10 项，最旧一项为 2023-07-24，日期按显示顺序从新到旧；第二页历史候选已在 `SOURCE_MATRIX.md` 记录为 2023/2022 年文章。它**不**证明官网永久固定只显示 10 项，也不支持推导通常或突发发布率、更新周期或长期稳定性。首页最新候选日是 2026-03-26，距 2026-09-29 快照核验约六个月，表示当次观察到的窗口偏旧；单次静态观察不能区分来源长期停更、栏目慢更新或其他情况。

现有 `fetchWebList()` 每轮只抓来源配置的首页，不跟进页。`collectSource()` 首次导入默认仅接收近 12 个月、最多 30 项；非首次非 X 来源每轮最多收 60 项。以 2026-09-30 的代码默认值和上述快照作条件推算，10 项中只有 2026-03-26 这条在 12 个月窗口内；这是当前首次导入边界的代码推算，不是已执行一次新的 collector 结果。已有固定 URL 两轮 collector 仅验证 2026-03-26 单篇幂等和 2,272 字正文，不能证明首页另外 9 条的入库、正文质量、未来首页滑窗覆盖或跨周期稳定性。

预算司证据来源：[SOURCE_MATRIX.md](SOURCE_MATRIX.md)、[P3_LOCAL_SOURCE_VALIDATION.md](P3_LOCAL_SOURCE_VALIDATION.md) 与 [P3_GATE2_READINESS.md](P3_GATE2_READINESS.md)。首页存在会议/培训等非纯政策内容，领域噪声也仍需逐条评估。

## 阶段结论

- 两项日期都保留可核对的源字段和代码映射；不改 `sources.json`，不新增 source 专属日期转换。
- 会计司的“9/21 对 9/22”是 UTC 日与中国列表日期混读；当前 parser 映射是正确的。文书落款与网页发布日期属于不同字段。
- 厦门证监局按 API `publishedTimeStr` 记录 9/15，与官方可见日期一致；详情 `PubDate`/生成元数据的业务含义仍未知。
- 预算司观察到的首页候选窗为 10 项、2023-07-24 至 2026-03-26，列表内日期降序。它只描述保存的单次快照；未知事项包括栏目下一次更新时间、周期更新量、故障期间是否滑出首页及长期噪声和正文质量。
- 来源保持 disabled，全文开关关闭，Gate 2 仍未通过。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：审计会计司与厦门证监局日期字段语义/代码映射，并描述财政部预算司首页覆盖边界。

**MODEL**：Luna High；未调用仓库运行时模型服务。

**FILES_CHANGED**：仅新增本文。未修改 `industry/sources.json`、其他文档、代码、数据库或运行开关。

**TESTS_RUN**：没有运行测试套件。使用当前 `fromHtml()` 与源配置对保存的两个 HTML 首页快照进行离线解析；读取并比对本地保存的官方列表/详情/API 原始字段和 2026-09-29 八次官方 GET 的机器摘要。本轮新增官方请求 0 次、重试 0 次。

**RESULT**：未发现需要 source 配置修复的真实日期映射错误；厘清会计司列表 `span` 与详情发布日期同为 9 月 22 日，厘清 CSRC API 可见日期映射与 9 月 23 日详情元数据的证据边界，并列明预算司单快照窗口。

**RISKS**：历史报告将会计司 parser UTC 日期或 URL 路径日记作列表日，需按本审计更正；CSRC `PubDate` 语义仍未知；预算司首页最新可见条目较旧且只检查了一个快照，不能支持发布率或稳定性结论。

**BLOCKERS**：Gate 2 仍有来源级首页/历史覆盖、跨周期变化、噪声和正文质量缺口；本次日期澄清不解除这些缺口。

**NEXT**：维护 `STATUS.md`、`SOURCE_MATRIX.md`、`P3_GATE2_READINESS.md` 和交接的负责人可引用本文改正旧日期描述；后续按现有 P3 要求用额外有界快照补预算司及其他来源覆盖证据，再提交正式 Gate 2 审查。
