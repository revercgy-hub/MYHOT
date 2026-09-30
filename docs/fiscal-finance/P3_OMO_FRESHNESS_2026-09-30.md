# P3 人民银行公开市场跨日更新验证（2026-09-30）

## TASK

验证人民银行 `pboc-open-market` 于 2026-09-30 是否出现比 2026-09-29 留存首页更新的公告；用项目原列表 parser 离线比较；若有新公告，则在全新隔离库对一个精确 fixedURL 做两轮 collector，并按既有 `#zoom` + `allowShortBody=true` 路径核验正文。此记录只覆盖一次跨日样本。

## MODEL

执行代理实际分派路由：`gpt-6-luna / high`。运行时未调用真实模型，也没有启动模型 worker。

全程未调用模型、worker、Jina、OCR、付费服务或外发通知。运行开关均为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`。

## FILES_CHANGED

仓库中仅新增本文档。原始及运行证据保存在 Git ignored 的 `.data/omo-freshness-20260930/`，包括 9/30 列表 HTML、192 号详情 HTML、SHA/请求摘要、与 9/29 首页的离线 parser 对照、隔离 collector 与 extractor 记录、最终 SQL 审计、运行脚本和独立 PostgreSQL 日志/数据。本次新建的私有 PostgreSQL cluster 使用 `.data/omo-freshness-20260930/pgdata`，只监听 `127.0.0.1:55432`，任务结束后已停止。共享 `127.0.0.1:5432` 在本轮最初只读连接探测时返回 `ECONNREFUSED`；本轮没有对共享 5432 执行停止操作。

未修改 source 配置或任何 `apps/`、`packages/`、schema、状态清单、在线 preview 数据库、旧测试库或其他 Agent 文档。隔离库为 `fiscalhot_omo_freshness_test`，仅执行仓库现有 35 项 migrations，并仅 seed 一个禁用来源。

## TESTS_RUN

- 一次 guardedFetch 读取人民银行首页：20 秒超时、1 MiB 上限、最多 1 次重定向；HTTP 200、40,079 字节、0 次重定向。HTML 保存后只在本地运行 `packages/backend/src/sources/web-list.ts#fromHtml`。
- 对 9/29 保存的 `.data/fiscal-central-audit/html/pboc-omo-list.html` 运行同一 parser。两页都解析出 20 条。9/30 最新第192号、上海日 2026-09-30；9/29 最新第191号、上海日 2026-09-29。第192号 URL 新进入首页，原第172号从 20 条首页退出。9/30 首页 SHA-256：`fe16e2da27948d98b63dee28239f5d53895acacdd24a124e461b34864178aa4d`。
- 对第192号详情做一次原始证据读取：20 秒超时、6 MiB 上限、最多 1 次重定向；HTTP 200、29,878 字节、0 次重定向。`ArticleTitle` 为第192号，`PubDate=2026-09-30`；唯一 `#zoom` 容器 127 字、1 张表、0 链接。HTML 保存并核对。
- 新隔离库来源 `enabled=false`、两种全文标志均 false；临时 allowlist 收窄至第192号完整 URL，`initialBackfillLimit=1`、`detail.maxFetches=1`。执行同一固定URL两轮 `collectSource(..., { force: true })`：第一轮 `found=1/created=1/revised=0`，第二轮 `found=1/created=0/revised=0`。最终 SQL 显示两条 `fetch_runs` 均为 `ok`，新条目仅 1 篇，revision 1。
- 按要求只调用一次 `extractArticleBody(id, false)`，结果 `skipped`：collector 首轮已通过配置的 `#zoom` 显式短正文路径存入 `body_status=ok`，此函数按实现跳过已确认正文，没有再抓详情。最终 SQL 独立核实标题、URL、发布日期、正文、表格、单位、job 和模型账本。
- Guarded fetch 总计 5 次调用：首页静态读取 1、原始详情证据读取 1、两轮 collector 的列表读取 2 和首轮详情读取 1；extractArticleBody 因 `skipped` 未发起网络请求。显式证据读取共观察到 0 次重定向。collector 内部没有记录最终响应 URL，故其实际重定向次数不能从 `fetch_runs` 还原；这 3 次调用各自最多跟随 5 次重定向，20 秒超时（列表默认 8 MiB，正文详情 6 MiB）。总计划上限为 20 个 HTTP hop（两个有界原始读取各最多 2 hop，加三次 collector 读取各最多 6 hop），实际 wire-level 总 hop 数没有声称为精确值。
- 两轮脚本在输出结果后因末尾一项误断言退出非零。脚本变量 `ledgers.analyses` 实际统计 `pgboss.job WHERE name='content.analyze'`，值为 1；末尾错误地要求该队列数为 0，混淆了“排队任务”与“模型已执行”。没有重跑 collector。独立 SQL 分别核实：`content.analyze` 队列有 1 个 job（`created`、`retry_count=0`）；`analyses` 结果表行数为 0；`receipts=0`、`lb_models=0`，无 worker 或模型运行。该脚本退出不改变已完成的两轮数据；具体运行输出和独立 SQL 证据均保存在 ignored 目录。

## RESULT

**一次首页快照：** 9/30 人民银行官方公开市场页面实际最新为第192号，上海发布日期为 9 月 30 日；不是根据序号推测。9/29 留存首页最新为第191号。

**两轮幂等：** 一条固定 URL 首轮入库，第二轮未重复创建或修订。DB 条目为《公开市场业务交易公告 [2026]第192号》，`published_at=2026-09-30 00:00:00+08`，`body_status=ok`、135 字、1 个完整表格、revision 1。第二轮后哈希与 revision 保持不变。

**跨日更新：** 9/29 与 9/30 两个首页快照都各解析 20 条，首页最新候选由第191号变为第192号，项目 parser 识别出的发布日期与新条目日期一致。这构成两个日期间观察到更新的证据。

**正文事实核对：** 原始 `#zoom` 和数据库正文/HTML 均保留公告正文和完整三列表格（期限、投标量、中标量）、`7天`及两格`0亿元`；正文另保留“同时，开展了8335亿元隔夜逆回购操作。”原句。公告没有给出利率，正文和表格中也没有“利率”字段；不从前一日公告补入利率。

## RISKS

这只是一个 9/29→9/30 首页快照差异和一条新公告两轮判重。项目 parser、库内短正文 helper 与本公告样本结果已核验，但没有验证更深分页、后续多个日期的持续更新频率、长时间重复率或来源长期可用性。两个原始快照足以显示这次新条目替换首页尾条，不能证明所有未来公告均会按同一节奏发布或解析。

collector 的 `guardedFetch` 不把重定向计数写入抓取记录：本文给出代码允许的 hop 上限，但不会把未知的 collector 实际重定向次数报成 0。脚本末尾误断言失败见 `TESTS_RUN`，两轮结果由独立 SQL 核验。

## BLOCKERS

无本次样本级阻塞。Gate 2 仍未通过；来源仍 disabled。数据库保留一个未消费 `content.analyze` job（`created`, `retry_count=0`）；`analyses` 结果表仍为 0 行，没有 worker 或模型调用。

## NEXT

在后续不同日期按相同有界方式积累更多首页快照和固定 URL 样本，另行评估分页、正文样本与长期更新稳定性，再由正式 Gate 流程评估 Gate 2。本文结果不授权启用该来源或扩大采集。
