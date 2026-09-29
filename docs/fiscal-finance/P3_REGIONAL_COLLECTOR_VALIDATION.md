# 财政部各地监管局来源 P3 有限 Collector 验证

验证日期：2026-09-30（Asia/Shanghai）

来源配置 SHA：`0ec0704c0e60a88d84bc99d558eb569c56731c79`

验证时仓库 HEAD：`48122c8d7f1454be0bc19522a6041f6cc935a7c9`

隔离数据库：`fiscalhot_regional_p3_test`，已应用 35 项迁移。

状态：仅为两个固定 URL 的 P3 样本；不代表来源长期稳定、分页覆盖或 Gate 2 通过。

## 范围与安全边界

本轮只把 `industry/sources.json` 中的 `mof-regional-supervision-dynamics` 与 `mof-xiamen-supervision-dynamics` 两条来源配置复制到新测试库。库内两条 source 都保持 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。为让 collector 只写入预选样本，测试库副本将 `allowUrlPrefixes` 临时缩为对应的一个确切文章 URL；selector、列表 URL 和解析规则与仓库配置一致。该测试专用限制未写回 `industry/sources.json`。

所有测试进程安全变量均为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`。网络请求使用项目现有 `guardedFetch` 的公网 URL 检查；私网访问开关关闭。未启动 worker；未调用模型、Jina、通知或发布接口。`collectSource(..., { force: true })` 仅用于在隔离库中直接执行两轮真实列表 collector，source 的 disabled 状态没有改变。

`result.json` 记录并可复核 8 次 guarded HTTP fetch 调用：两列表预检、两源各两轮 collector、两篇详情读取。另有 1 次中央列表预检是调试阶段人工过程计数，未保留独立原始响应、请求日志或 hash；总人工口径为 9 次，低于 12 次预算。该额外请求发生在 collector 和详情读取之前。无请求超时、无因超时重试、之后未追加网络请求。两列表预检均以零重定向限制返回 200；两篇详情最终 URL 均与请求 URL 相同。collector 内部使用项目既有 `guardedFetch` 和 25 秒列表超时，结果对象不暴露中间重定向链，机器可复核计数只按 `result.json` 中保存的结果计算。

## 列表与固定样本

实际列表响应和隔离快照保存在忽略目录 `.data/fiscal-regional-collector-validation/`。结果摘要与一日快照离线比较分别在 `result.json`、`offline-comparison.json`；当次列表 HTML 也保存在此目录。两篇详情页原始 HTML bytes 未保存；详情响应状态、元数据、Readability 字数及不超过 220 字的正文开头样本只在 `result.json` 摘要中留痕，不能据此独立重跑或完整审计正文解析。

| 来源 | 实际列表 | 选定的实质业务文章 | 列表日期（北京时间） | 固定原文 URL |
|---|---|---|---|---|
| 财政部官网选登汇总 | HTTP 200，HTTPS 列表 URL；25 个外层条目，配置 selector 命中 7 条，7 个候选 URL 唯一 | 财政部广西监管局：“四个聚焦”推进国有金融资本产权登记监管提质增效 | 2026-09-28 00:00 | `http://gx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260920_3997805.htm` |
| 财政部厦门监管局工作动态 | HTTP 200，HTTPS 列表 URL；10 个栏目条目，解析 10 条，10 个候选 URL 唯一 | 厦门监管局：强化财金协同 深化精准监管 助力普惠金融高质量发展 | 2026-09-24 00:00 | `https://xm.mof.gov.cn/caizhengjiancha/202609/t20260920_3997811.htm` |

中央列表的 25 个条目里，18 个未命中“标题含监管局”的配置 selector；这包括混合财政新闻，而非 18 条详情已人工认定的噪声。selector 限制和 35 个官方域名 URL allowlist 共同约束了入库候选。厦门列表页的 10 条均为栏目条目。两份列表各自的候选 URL 都没有重复，且本轮选择的是监管业务文章，没有用党支部学习或一般会议稿替代实质业务样本。

分页由页面脚本动态生成，保存 HTML 没有静态分页锚点；中央页脚脚本声明 `countPage=20`，厦门页声明 `countPage=10`。collector 实际只取配置首页，没有请求任何历史页。本轮页面快照与 `.data/fiscal-regional-audit/` 中前一日保存的中央、厦门列表快照通过同一 `fromHtml()` 逐项离线比较：中央 7/7 URL 相同、日期均相同；厦门 10/10 URL 相同、日期均相同；均无新增、移除或重复。这个约一天的静态相同观察不能证明历史分页已接入，也不能代表跨周期稳定性。

## Collector 两轮和数据库观察

| 来源 | 第一轮 `found/created/revised` | 第二轮 `found/created/revised` | 文章行与重复核验 |
|---|---:|---:|---|
| 财政部官网选登汇总 | `1 / 1 / 0` | `1 / 0 / 0` | 1 行；URL 为固定广西文章；重复 URL 分组 0 |
| 财政部厦门监管局工作动态 | `1 / 1 / 0` | `1 / 0 / 0` | 1 行；URL 为固定厦门文章；重复 URL 分组 0 |

collector 的 `found=1` 是测试库确切 URL 前缀限制生效后的候选数；完整首页原规则的实际 parser 结果为中央 7 条、厦门 10 条。数据库四条 `fetch_runs` 都是 `ok`，对应 `found_count/new_count` 为 `1/1`、`1/0`。

详情只做独立的一次 HTML 读取与项目 `readable()` 临时解析，未调用会写文章正文的 `extractArticleBody()`。响应摘要记载两页均为 HTTP 200、`text/html`，详情 `ArticleTitle` 与列表标题完全一致；中央 `PubDate=2026-09-28 08:23:00`，厦门 `PubDate=2026-09-24 08:27:00`，分别与列表日同日。摘要中的 Readability 字数为中央 1,720 字、厦门 1,935 字，样本开头与监管业务主题相符。由于未保留详情 HTML，这些只能视为本轮临时解析观察，后续需复核原页正文并在隔离库真实写入/检查 `body_text` 后，才能确认入库正文质量。

**详情可读不等于正文已入库。** 两条数据库文章仍均为 `body_status=pending`、`body_text` 长度 0、`revision=1`；未将临时 Readability 结果写入文章。每源因真实 collector 的入库各创建一个 `content.extract-body:created` job；共 2 个未消费任务，没有 worker。数据库 source 仍 disabled 且全文许可关闭。receipts 数为 0；本轮没有精选或模型结果。

## 日期、URL 与事实风险

- 中央候选列表日及数据库 `published_at` 是北京时间 2026-09-28 00:00；详情 `PubDate` 为 2026-09-28 08:23，日级一致。中央文章原 URL 为 HTTP，实际直接返回 HTTP 200、`text/html`，没有跳转；因此该固定旧 HTTP 链接本轮通过可达性检查，没有因协议猜测改写数据库 URL。
- 厦门候选列表日及数据库 `published_at` 是北京时间 2026-09-24 00:00；详情 `PubDate` 为 2026-09-24 08:27，日级一致。文章 URL 使用 HTTPS。
- 两篇 URL 路径中的 `t20260920` 与详情日期不同；列表日和详情 `PubDate` 在日级相符。路径日期不作为发布日期，本轮保留来源列表日期入库。
- 中央项是财政部官网选登汇总中的广西监管局稿件，来源归属仍是财政部汇总源；本结果不代表全国 35 局各自栏目均已验证或覆盖。
- 本轮没有抓取历史分页，也没有对未选中的文章验证正文；一日快照一致不能外推为长期 freshness、完整性或重复率结论。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：在隔离库对两个新增 disabled 来源各做一条固定业务 URL 的两轮真实 collector 验证，并核对详情 HTML、列表日期、分页、导航和重复边界。

**MODEL**：本阶段由子 Agent `gpt-6-luna/high` 执行；运行时 `MODEL_CALLS_ENABLED=false`，没有真实模型调用，也没有 worker。

**FILES_CHANGED**：新增本文。忽略目录 `.data/fiscal-regional-collector-validation/` 保存脚本、两份当次列表 HTML、JSON 结果及离线对比；未保存详情原始 HTML。未改 `sources.json`、状态/计划/矩阵、应用包或在线 preview。

**TESTS_RUN**：隔离库 35 项 migration；两个官方列表预检与各两轮 `collectSource`；每篇一个有界详情读取与 Readability 解析；数据库 SQL 复核；昨日快照与当前列表离线 URL/日期比较。未运行应用测试套件。

**RESULT**：两源列表及详情摘要均记载 HTTP 200；8 次请求有机器记录，另 1 次中央预检只有人工过程计数。正文只在临时 Readability 摘要中有字数和开头样本，详情原始 HTML 未保存，数据库正文仍 pending/0 字。两轮 collector 分别为 `1/1/0`、`1/0/0`。两源仍停用、全文关闭；没有上线内容，也没有 Gate 2 结论。

**RISKS**：测试库对每源只允许精确固定 URL，因此 collector found 值只表示单条样本；没有证明完整列表批量入库。额外调试预检没有独立原始证据，详情原始 HTML 未保存，Readability 正文只能从结果摘要查看；详情正文与数据库写入质量仍待复核。当前没有验证分页历史文章正文和长期周期稳定性。中央汇总仍是选登，不是 35 局全量来源。

**BLOCKERS**：无环境阻塞；尚缺历史页、更多文章正文、重复率与跨周期 freshness 证据。隔离库留下两个未消费正文提取任务，未运行 worker。

**NEXT**：后续在不扩大本轮请求预算的情况下，保存详情页的可审计原始证据，在隔离库复核正文及数据库 `body_text`，再单独安排分页和跨周期验证；来源继续 disabled，Gate 2 保持未通过。
