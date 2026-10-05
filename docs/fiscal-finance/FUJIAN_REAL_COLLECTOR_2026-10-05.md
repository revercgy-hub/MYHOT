# 福建监管局来源真实 Collector / 正文验收记录（2026-10-05）

## TASK

在独立隔离测试库完成一次福建来源真实 collector、对已存在代表文章调用一次显式正文 helper、再执行一次仅抓列表页的重复 collector 检查。所有官网请求仅走固定 HTTPS host/path；队列 worker、模型、OCR、Jina fallback、embeddings 和外部推送均未启用。该次运行不是 90 日完整覆盖验收。

## MODEL

Luna High B；Node v24.16.0、npm v11.13.0、backend pinned Undici 8.11.2。复用仓库 P3 HTTP dispatch budget 与本地 one-shot runner。真实代码从福建官网读取栏目/详情；显式 helper 关闭 Jina，并因正文已在 collector 阶段确认为 ok 而安全返回 `skipped`，没有重复发起正文请求。

## FILES_CHANGED

新增本报告。ignored `.data` 目录保存 runner、loopback preflight、逐阶段 JSON/事件/log、样本正文只读摘要和脱敏 SQL 终检；未修改 backend、配置、schema/migrations、共享文档或 Git index。通用 ignored runner `.data/test-pg/regional-live-once.mjs` 最终 SHA-256：`4E26542DC6B8F8717F2937DB8D9FDA1C9A6E7CCB74C717F299A52A45854DD759`。首轮 collector 执行时 runner 版本 SHA 为 `947E86AE5F487C0527057D403EA4CB3D75A52E285CB7169ABAF012FF92EF2FF6`；后续 helper/repeat 使用更晚版本，完整文件哈希分别记录于执行记录/manifest。

证据目录：`.data/fiscal-qa/fujian-real-20261005/`。最终 SQL 摘要为 `post-run-review.log`，真实 collector 的 11 个响应体 hash 在 `collector-result.json` 中，不保存新闻长原文。

## TESTS_RUN

- Node 24 `node --check` 通过；福建 loopback preflight 4/4：非法 host/path 请求服务端 0 hit；redirect follow-up 被挡；20 字节已知 fixture 的 SHA-256 验证正确；cap=1 的第二个 dispatch 在发送前被拒。Canary SHA-256：`64f1131565e6306cc64a86b0d79ac56c9e2264c140fd7216fbaf28fa21a5bb78`。
- 新建 `fiscalhot_oct05_fujian_live_test`，应用 35 migrations，只插入 `mof-fujian-supervision-dynamics` 一条 disabled source，`site_fulltext=false`、`syndicate_fulltext=false`。未访问 preview DB。
- 首轮 collector 独立 cap=11：11 attempted / 11 dispatched / 0 rejected，1 个列表请求与 10 个详情请求，全为 HTTP 200；只访问 `https://fj.mof.gov.cn/gzdt/caizhengjiancha/` 下的资源，无 redirect/retry/其他 host。结果 `ok`, found 10、created 10、revised 0。
- 指定样本 `https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm` 已在真实 collector 处理后保存为 body `ok`, revision 1、正文 1,659 字符。根据已存 row 的标题和 2026-09-22 +08 日期做检查后，对其 article ID 调用一次 `extractArticleBody(id, false)`，结果 `skipped`，dispatch 0；没有再抓页面。
- 重复 collector 独立 cap=1：只读取栏目列表，1 attempted / 1 dispatched / 0 rejected，HTTP 200、4,399 bytes，SHA-256 `fe899365992feb4b51a9cbbbee6fd73b14411eb5b599296b42c81e22f9cbbdea`。结果 found 10、created 0、revised 0；十条 URL 唯一，代表样本 title/date/body/revision 保持。
- 最终只读 SQL：2 个 fetch runs 均反映请求成功；10 篇文章、9 篇 body ok、1 篇 pending，10 条 revision 1；9 个 `content.analyze` + 1 个 `content.extract-body` job 处于 created，未消费；全库 analyses、receipts、publications、selected ledger、job_runs 均为 0。

所有执行进程将 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、IndexNow/Feishu push、private-network、OCR、embeddings、Jina flags 明确设为 false；删除 provider key/base URL/token/secret 与代理变量，`.env` 和指定 credentials 目录均不存在。未启动 worker。

## RESULT

首轮新增 10 个无重复 URL，发布日期均在本次运行日（2026-10-05 23:56 左右 +08）的近 90 日范围内。代表样本的详情日期在保存的页面观察中为 2026-09-22 08:21 +08；来源配置没有将详情日期标为权威，collector 因列表已有可信日只持久化列表日期 **2026-09-22 00:00 +08**。这保留了日期日粒度，仍处于 90 日窗口。详情标题与已持久化 title 一致。

样本 body 在 collector 阶段已经使用配置的 `.my_doccontent` 选择器确认成功，因此抽取 helper 按现有实现跳过，无独立正文 GET、无新 revision。只读业务检查显示该正文讨论资源综合利用增值税即征即退政策复查、适用条件及违规退税风险防控，与财政/税收主题直接相关；所读片段没有表现为无关的机关内部活动报道。没有模型评分、精选或发布判断，也没有复制长原文。

一条不同文章出现 `source body selector declined` / `non_article_container` 运行 warning；warning 本身没有 article ID。最终 DB 对应仅能证实有一条 `body_status=pending`、revision 1 的材料，未写 attachment marker；不能仅凭无 ID 的 warning 把它归因到某篇文章。其余九篇正文为 ok。所有新增队列项保持 created，没有 worker 消费。

幂等复核重复读取了相同 10 个候选，created/revised 均为 0、URL 唯一数 10。目标样本仍为标题相同、列表发布日期 2026-09-22 00:00 +08、body ok/revision 1。全库没有模型/provider receipt、分析、publication、selected 结果。所有来源仍 disabled。

该记录证明福建 collector 与单篇正文处理在一个隔离 DB 和一个栏目时点的行为。分页、旧档案、跨周期稳定性和近 90 日历史完整性仍未验证，Gate 2 仍为 `NOT_PASSED`。

## RISKS

- 列表日而非详情精确时分是本来源当前非权威详情日期配置的结果；如业务需要更细时间，应另行审阅配置需求，不能把详情观察误报为入库精度。
- 一个 selector warning 不能通过当前日志定位到具体 article ID；一条材料仍 pending，正文抽取质量不能算全量通过。
- 一个列表页只代表一次样本，不证明历史覆盖、分页结构或长期持续运行稳定。

## BLOCKERS

Gate 2 仍未通过。仍需单独审核 pending 条目原因，并补充分页/历史范围与跨周期证据；本报告不授权启用来源。

## NEXT

保留测试库和 `.data/fiscal-qa/fujian-real-20261005/` 供 QA review，不重复请求、不启用 worker。后续来源须继续使用各自 fresh `_test` DB 和独立 cap；该批 runner 错误或异常均保留原始 partial 状态，不重试凑绿。
