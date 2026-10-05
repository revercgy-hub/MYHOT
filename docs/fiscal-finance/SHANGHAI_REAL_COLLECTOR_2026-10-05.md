# 上海监管局来源真实 Collector / 正文验收记录（2026-10-05）

## TASK

在独立隔离测试库完成一次上海来源真实 collector、对已存在代表文章调用一次显式正文 helper，并尝试一次只读取列表页的重复 collector 检查。collector 与 helper 阶段成功；重复列表阶段因请求超时失败，按预算规则停止且未重试，整体结果保留为 partial。所有官网请求仅使用固定 HTTPS host/path；未启动模型或 worker。

## MODEL

Luna High B；Node v24.16.0、npm v11.13.0、backend pinned Undici 8.11.2。运行使用仓库 P3 dispatch budget 与 loopback hash canary 验证的 ignored runner。正文已由 collector 阶段提取成功，因此显式 helper 返回 `skipped` 且没有重复网络请求。没有调用真实模型。

## FILES_CHANGED

新增本报告。ignored `.data` 下保留 runner、loopback preflight、三阶段 JSON/log/事件和最终 SQL 复核；未修改 backend、配置、schema/migrations、共享文档或 Git index。通用 runner `.data/test-pg/regional-live-once.mjs` SHA-256：`4E26542DC6B8F8717F2937DB8D9FDA1C9A6E7CCB74C717F299A52A45854DD759`。

证据目录：`.data/fiscal-qa/shanghai-real-20261005/`。stage1 成功响应体 hash 在 `collector-result.json`；helper 结果在 `extract-result.json`；超时阶段在 `repeat-result.json`；最终 SQL 输出为 `post-run-review.log`。超时没有收到 response headers/body，因此没有可用的页面 hash；未重发请求。未将真实网页长正文写入报告。

## TESTS_RUN

- Node 24 `node --check` 通过；上海 loopback preflight 4/4：host/path 阻断、redirect follow-up 阻断、已知 20 字节响应 SHA-256、N+1 cap 拦截均通过。Canary SHA-256：`64f1131565e6306cc64a86b0d79ac56c9e2264c140fd7216fbaf28fa21a5bb78`。
- 新建 `fiscalhot_oct05_shanghai_live_test`，35 migrations，仅插入 `mof-shanghai-supervision-dynamics` 一条 disabled source，site/syndicate fulltext 均 false。没有触碰其他测试库或 preview DB。
- 首轮 collector cap=11：11 attempted / 11 dispatched / 0 rejected；一个栏目页和十个详情页全部 HTTP 200，全部在 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/` 下，无 redirect、重试或其他 host。结果 `ok`, found 10、created 10、revised 0；首轮响应体 hash/字节数已记录。
- 已核对目标详情 URL 的 row、标题和 2026-09-23 列表日期在 90 日内。target body 已在 collector 阶段为 `ok`、revision 1、2,078 字符。调用一次 `extractArticleBody(id, false)` 得到 `skipped`、dispatch 0；没有重复下载或增加 revision。
- 重复列表阶段 cap=1：仅 1 次固定栏目 GET dispatch，无 redirect/retry；请求约 25 秒后超时，没有收到 headers/body，Undici 记录 1 个 request error，budget attempted/dispatched/rejected 为 1/1/0。Collector 将第二个 fetch run 记为 failed、found/new=0。按要求未再请求，整体标记 partial。
- 最终只读 SQL：35 migrations、1 disabled source、10 unique articles、全为 body ok/revision 1、10 条 revision row。队列有 10 个 `content.analyze` job 均为 created、未消费；analyses、receipts、publications、selected ledger、job_runs 全为 0。

安全开关在每次进程中显式关闭，包括 collector/model、push、private-network、OCR、embeddings、Jina；清除了 provider/代理 key 与 endpoint 环境变量，`.env` 和 credentials 目录不存在。未启动 worker。

## RESULT

首轮 collector 成功新增 10 条无重复 URL。页面可见发布日期覆盖 2026-08-19 至 2026-09-28，详情入库日期落在 2026-08-20 至 2026-09-28 +08，均在本次 collector 运行时的近 90 日范围内。指定代表文章为 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm`，title 与保存页面观察一致。历史详情 `PubDate` 是 2026-09-23 15:09 +08；来源配置未把详情日期设为 authoritative，collector 保留了列表日期 **2026-09-23 00:00 +08**。该样本正文通过 `.my_doccontent` 身份校验并在首轮进入 body `ok`/revision 1。

只读正文业务检查显示样本围绕增值税留抵退税政策执行抽审，涉及监管组织、审核口径和风险防控，直接属于财政税收监管主题；未表现为主题无关的内部活动报道。正文以主题摘要记录，没有长原文、模型评分、精选或发布结论。

抽取 helper 对已 `ok` 的持久正文返回 `skipped`，没有新的 response 或 revision。队列由 collector 保留为 10 个 created 的分析待处理项，但没有 worker/消费者处理。所有 source 仍 disabled。

重复检查阶段请求超时，说明本轮没有证明重复抓取幂等性。DB 中十篇数据和 target metadata/body/revision 保持不变，unique URL 仍为 10；这只证明超时期间没有破坏已有内容，不能替代成功的重复 collector 验收。第二条 fetch_run 留存为 failed，整体应视作 `PARTIAL / NOT_PASSED`。Gate 2 仍为 `NOT_PASSED`。

## RISKS

- 第二次列表 GET 在 dispatch 后超时，页面没有返回，幂等复核未完成。没有重试或补发，因此不能断言该来源第二轮运行稳定。
- 日期以列表日午夜持久化，历史 detail `PubDate` 的时分没有成为持久值；需要时另行确认是否要求提高时间精度。
- 单页一次观察不能证明分页、近 90 日历史覆盖或跨周期稳定性。body ok 与单个业务相关样本不能替代全来源质量审核。

## BLOCKERS

本轮 repeat 阶段是 `partial`，不能列作幂等验收通过；不得使用该测试库重新尝试本阶段请求。Gate 2 仍未通过，也不能据此启用来源。

## NEXT

保留数据库及 `.data/fiscal-qa/shanghai-real-20261005/`，让 QA/Lead 基于已捕获证据复核。严格遵守此次单请求 no-retry 边界；如需再验证第二轮，须由 Lead 之后另行审批新预算/阶段。继续补分页、历史窗口和跨周期证据。
