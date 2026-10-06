# 上海列表日与 URL 日期 token 不一致样本：单页详情核验（2026-10-06）

## 范围与响应

Lead 核销一项独立的单详情 GET；它不是 page 1 列表请求的预算续用或重试。请求前脚本从已保存的上海 page 1 raw 重新运行现有 `fromHtml`，确认目标仍是第 8 行，并验证 source ID、HTTPS list URL、唯一 `allowUrlPrefixes` 和 URL identity。脚本在新 ignored 目录写入 one-shot marker 后，使用仓库 `guardedFetch`、pinned Undici 8.11.2 和 P3 dispatch budget 请求唯一 URL：

`https://sh.mof.gov.cn/gzdt/caizhengjiancha/202607/t20260728_3994403.htm`

HTTP 200、`text/html`，final URL 与请求 URL 完全一致；响应 18,945 bytes，SHA-256 `b5b98612935674920813e045fb707d8cd55719008110d60aaa0e518d8f1037d3`。Undici 实际 budget 是 attempted/dispatched/rejected `1/1/0`，request-create、sendHeaders、response-headers 各一次；没有 redirect、retry、附件、第二 URL、Jina、数据库、collector、worker 或模型。one-shot marker、原始详情响应、runner 和完整 manifest 均在 ignored `.data/fiscal-qa/shanghai-date-conflict-detail-20261006/`。

## 列表行与详情身份

保存的 page 1 raw 为 `shanghai-page1.html`，12,816 bytes，SHA-256 `b8c5ec2033bbadd10d48b43a29c3e2b9d32a3e9648fe342e2eb9d3bd473adcdc`。raw HTML 第 214 行 / 列表第 8 行提供：

- 标题：`上海监管局：强化监管主责 严守征管底线 因地制宜做好中央财政收入监管工作`
- 列表显示日：`2026-07-31`
- href：`./202607/t20260728_3994403.htm`
- URL 日期 token：`2026-07-28`（诊断信息，不作为发布日期）

用当前 source 配置在保存的 page 1 raw 上调用项目 `fromHtml`，共解析 10 个候选，目标 candidate 的 title、date 和 URL 与该 raw 行相同；列表日解析为 `2026-07-30T16:00:00.000Z`，即 +08 的 2026-07-31 00:00。现有 `identityKeyForUrl` 得到 `url:https://sh.mof.gov.cn/gzdt/caizhengjiancha/202607/t20260728_3994403.htm`。URL 是 HTTPS、同 origin、无 credentials/query/fragment，位于唯一 source prefix 内，路径是 `.htm` 文章页；详情请求没有靠 URL token 改写发布日期。

## 日期、标题和页面字段语义

当前 source 配置中的日期规则是 `<meta name="PubDate" content="…">`，offset `+08:00`；没有 `publishedAtAuthoritative`、`titleSelector/titleRegex` 或 `upgradeDatePrecision`。详情实际给出的配置 regex 值为 `2026-07-31 08:17:00`，按配置 offset 解析为 `2026-07-31T00:17:00.000Z`（+08 的 2026-07-31 08:17）。它比列表日午夜晚 8 小时 17 分。三方可见事实如下：

| 证据 | 页面值 | 含义与限制 |
|---|---|---|
| page 1 list row | 2026-07-31 | 显示日；并非精确时刻 |
| URL path token | 2026-07-28 | 路径日期早三天；不可作为发布日期 |
| 配置 `PubDate` regex | 2026-07-31 08:17:00 +08 | 转换后精确 instant 不等于列表 midnight |
| 页面可见时间栏 | `发布日期：2026年07月31日` | 该页面明确将可见日期标成“发布日期”，日期与列表同日 |

页面 `<title>`、`h2.title_con` 均与列表标题相同；未发现配置的详情标题规则，也未发现可见“更新时间”等日期标签。页面公开字段在这篇文章上支持“发布日期为 2026-07-31、URL token 较早”的观察；但单篇页面无法证明网站 `PubDate` 对所有文章都表示原始首次发布，也不能排除修订/转载时间沿用相同字段。其原始发布日期语义保持 **UNKNOWN / source-wide unproven**。同日不等于 Phase B 的 exact instant equality；若同时把列表 midnight 和 `PubDate` 视为可信日期，二者仍相差 8 小时 17 分，需要 S1 对 date-only 精度和来源语义另作裁定。

这与当前请求条件也一致：`upgradeDatePrecision` 缺省 false，普通 collector 的 `need.date` 为 `!candidate.publishedAt || upgradeDatePrecision === true`；分页 metadata 在列表日期可信且非 authority/未显式升级时也不会为该值请求日期详情。本次人工核验不改变默认抓取路径或来源 authority。

## 正文区域观察

页面有唯一 `.my_doccontent`。去除其中嵌套的 `style`、`script` 和 `noscript` 后，静态正文包含 1,641 个字符、9 个段落、0 个表格、0 个列表项；本次 DOM 未观察到附件链接。内容概要是上海监管局围绕中央财政收入监管，介绍监管内控、属地财税风险识别和跨部门协作机制。该观察只概括页面主题和结构，不保存正文原文，也不触发 extractor；它不等于 collector 的正文确认、body-ready 或 Gate 2 内容验收。

探测 manifest 中初次结构计数 `textCharacters=3089` 包含正文容器里的 CSS 样式文本。QA 离线去除 style/script/noscript 后复算为上列 1,641 字符；manifest/raw 保留原样，没有改写请求证据。

## 裁定边界

这篇样本补充了一个明确的 page 1 list row → project URL identity → exact detail URL 绑定，并观察到页面可见“发布日期”日期与 list day 一致、`PubDate` 时刻落在同一日、URL token 比二者早三天。它没有证明 `PubDate` 在 source 范围内的通用原始日期语义，也没有解除 exact instant mismatch、PDF 行的正文边界、真实历史末页/覆盖、重复列表超时或跨周期稳定性缺口。

当前候选仍为 `NOT_ADMITTED`。这次请求没有修改 source config，也没有批准 source opt-in、分页 complete、reset、incremental 或 90-day coverage。见 [Phase C 首源证据包](PHASE_C_FIRST_SOURCE_EVIDENCE_PACKET_2026-10-06.md)。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按 Lead 核销，对一条列表日与 URL path-date 不同且靠近 backfill 边界的上海 HTML article 进行单次详情核验。

**MODEL**：GPT-6 Luna High；未调用项目 provider/model。

**FILES_CHANGED**：新增本文。runner、独立 marker、manifest 和 raw HTML 只在 ignored `.data/fiscal-qa/shanghai-date-conflict-detail-20261006/`；未改配置、collector、DB 或 Git index。

**TESTS_RUN**：`node --check` runner 通过；离线验证 page 1 list raw 的 hash、当前配置的 `fromHtml` 行绑定及 `identityKeyForUrl`；通过 guarded transport 和实际 Undici budget 完成独立 single GET `1/1`。离线解析详情 selector/regex、可见日期标签、标题、正文容器/段落与附件链接；未运行软件测试。

**RESULT**：page 1 row display day 2026-07-31、path token 2026-07-28；详情 `PubDate` 为 2026-07-31 08:17 +08，页面明示“发布日期：2026年07月31日”，标题与列表一致。单条页面不能证明源级 original-date semantics；候选保持 `NOT_ADMITTED`。

**RISKS**：列表 midnight 与详情时刻相差 8 小时 17 分，不能因同一日而通过 exact-instant equality；`PubDate` 原始首次发布日期语义仍未知。body 结构观察不能代替 extractor/S4 readiness。

**BLOCKERS**：source 级日期 authority/精度策略、PDF 行正文路径、末页与历史覆盖、跨周期稳定性仍未解决；Gate 2 仍 `NOT_PASSED`。

**NEXT**：QA 核对该独立 manifest/raw hash、request budget 与 DOM 日期/正文计数后再更新 admission matrix。保持来源 disabled；不以这一篇推导全源通过或 90-day complete。
