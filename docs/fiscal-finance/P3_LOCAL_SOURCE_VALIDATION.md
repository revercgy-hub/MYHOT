# P3 三个地方/预算来源单条采集与正文核验

日期：2026-09-29。范围是财政部预算司、人民银行厦门市分行、厦门市财政局各一个已核实详情 URL；每个源在隔离数据库执行两轮首页列表读取，再对首轮各新建的唯一条目直接调用一次 `extractArticleBody(id, false)`。这不是分页、持续新鲜度或 Gate 2 验收。

## 安全边界和固定预算

- 新建空隔离库 `fiscalhot_local_sources_test`，完成 35 项 migration，只 seed 这 3 个来源。运行时数据库中的 `enabled`、`site_fulltext`、`syndicate_fulltext` 均保持 false；用现有 `collectSource(id, { force: true })` 受限执行，没有改动仓库里的来源启用开关。
- 每个临时数据库 source config 只允许一个已核实详情 URL，`initialBackfillLimit=1`、`initialBackfillMonths=12`。来源自身没有 `detail` 预取配置，因此 collector 每轮仅读取列表；正文提取另对每条新文章调用一次 `extractArticleBody(id, false)`。固定预算为 6 次列表函数调用、最多 3 次详情正文函数调用、最多 3 条新入库。没有自动重试或翻页；底层 `guardedFetch` 的重定向 hop 不在函数调用计数中。
- `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、两个 `FEISHU_*_ENABLED` 和 `ALLOW_PRIVATE_NETWORK_FETCH` 全程 false；没有启动应用 worker/API，没有 Jina、模型、OCR、通知或付费请求。三条创建时留下的 `content.extract-body` 队列任务未消费。
- 第二轮只重读同一首页候选；随后将测试库临时精确 URL 白名单与 backfill limit/months 配置恢复为运行前仓库配置。来源仍 disabled、全文开关关闭；临时测试过滤没有写入 `industry/sources.json`。数据库只包含该验证的 3 个条目。

## 固定条目和正文结果

| Source ID | 固定详情 URL | 标题 / 上海日期 | 结果与边界 |
|---|---|---|---|
| `mof-budget-work` | <https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm> | 财政部有关负责人就2026年中央预算公开答记者问；2026-03-26 | 列表题名与已保存的同日详情 preview 相符；正文 `ok`，2,272 字。该栏目首页最新可见日较旧，本条不证明当前新鲜度。 |
| `pboc-xiamen-work` | <https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html> | 人民银行厦门市分行：支付护航投洽会 便利服务迎嘉宾；2026-09-14 | 列表题名与已保存的同日详情 preview 相符；正文 `ok`，1,745 字。本次选中的标题没有省略号；同一旧列表快照中另一个未选条目的可见标题被截短，配置已有 `titleAttribute=title`，该条不在本次采集范围。 |
| `xiamen-finance-debt` | <https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/t20260911_3016829.htm> | 2026年厦门市政府专项债券（十六期）招标结果公告；2026-09-11 | 列表与已保存的同日详情 preview 题名/日期相符。普通 Readability 结果为 `ok`、205 字，只比 200 字门槛高 5 字；**这是正文质量假阳性**：落库文本有公告标题和日期，余下主要是“扫一扫在手机上查看当前页面”及网站/浏览器页尾，没有招标结果内容。快照显示唯一实质附件是 PDF `P020260911578215495483.pdf`；本轮没有下载或读取它，因此不能称该条正文完整。 |

三条文章均首轮以 revision 1 入库；一次显式正文提取后成为 revision 2，正文哈希更新。上海日期分别按 `+08:00` 保存为 UTC 前一日 16:00。详情题名与日期的说明来自同日已保存 preview；本轮 `collectSource` 只存储列表标题/日期，`extractArticleBody` 只抽正文，不从当前详情响应重新校验 `ArticleTitle`/`PubDate`。

## 两轮 SQL 结果和正文 selector 诊断

六条 `fetch_runs` 均为 `ok`，每次 `found_count=1`。首轮每源 `new_count=1`，第二轮每源 `new_count=0`，`revised=0`。最终 SQL 为 3 条文章、每条 2 个 `article_revisions`（共 6 条），正文状态均为 `ok`，字符数依次为 2,272、1,745、205。pg-boss 有 3 条未消费 `content.extract-body:created` job，没有 `content.analyze` job；`receipts=0`、`lb_models=0`。没有启动 worker，所以这些队列记录保留为 created。

为定位厦门债务页 205 字假阳性，离线检查保存快照 `.data/fiscal-source-audit/details/xiamen-finance-debt.html`，无新 HTTP 请求。`.TRS_Editor` / `.Custom_UnionStyle` 唯一命中、文本 26 字，只是公告标题；页面脚本 `DOCTITLE` 为公告标题，`DOCCRTIME` 为 `2026-09-11`。`.content` 还含标题、时间、附件入口、扫码/打印/关闭导航。唯一附件为 PDF，绝对 URL `https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/P020260911578215495483.pdf`，原文件未读取。

以保存 HTML 对现有 `extractSelectedBody()` 纯本地测试 `bodySelector='.Custom_UnionStyle'` 时，返回 `body=null`、固定原因 `attachments_unprocessed`，并识别出上述唯一 PDF 附件；它不会回退到 Readability 页面尾部，也不会调用 Jina。helper 在身份和长度判定前就拒绝未处理 PDF。来源 Agent 随后仅为 disabled 的 `xiamen-finance-debt` 加入 `detail.bodySelector='.Custom_UnionStyle'`，未设置 `allowShortBody`，也未配置附件跟随；`assertSupportedConfig()` 和当前 sources.json 配置检查均通过。该配置能阻止此页的页尾假阳性，但仍无法提供 PDF 内的招标结果。此报告保留旧隔离库中 Readability `ok` 的历史事实，不手工改写其状态；隔离采集时的 DB 配置也仍保留为运行前快照。

## 验收边界和证据

本轮证明三个固定 URL 可经现有列表与正文入口入库，并在第二轮无重复新建/修订；不证明栏目分页、长期 freshness、其他文章正文质量或来源全量 coverage。特别是厦门债务的 `ok` 只表示通用 200 字 Readability 门槛通过，暴露了正文抽取把页面尾部噪声当文章的风险。厦门债务源保持 disabled；`.Custom_UnionStyle` 的 source-only 修正应 fail closed，真正的结果内容需另行审核附件路径后验证。

可复查的忽略目录材料在 `.data/fiscal-qa/`：`seed-local-sources-test.ts`、`run-local-sources-first.ts`、`extract-local-sources.ts`、`run-local-sources-second.ts`、`summarize-local-sources.ts`、`local-sources-final.json`、`inspect-debt-snapshot.ts`、`inspect-local-debt-body.ts` 和 `verify-local-debt-selector.ts`。数据库 `fiscalhot_local_sources_test` 与共享便携 PostgreSQL 保留供并行 preview 使用；本任务结束时未停止 PostgreSQL。

## 回归验证

来源配置更新后，在全新 `fiscalhot_pagecopy_test` 运行 35 项 migration。`npm test` 156/156 通过，日志为 `.data/fiscal-qa/pagecopy-npm-test.log`；测试进程的 `MODEL_CALLS_ENABLED=true` 只为现有 provider stub 测试服务，provider keys 被清空、凭据目录指向不存在路径，stub 只绑定 loopback；采集、Jina、通知及 IndexNow 等其他安全开关为 false。`npm run typecheck` 通过。对当前 sources.json 的 disabled 状态、唯一 `detail.bodySelector` whitelist 和保存 HTML 运行的 focused helper 检查也通过。此次没有更改采集器代码、taxonomy、数据库 schema 或任何 source 启用/全文开关；没有重跑 Web build、Web tests 或 smoke。测试结果不扩大以上真实来源样本范围。
