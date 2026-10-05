# 北京监管局来源真实 Collector / 正文验收记录（2026-10-05）

## TASK

在隔离测试库内对北京来源执行一次真实 collector、一次指定文章显式正文抽取，以及一次仅抓列表页的幂等性复核。真实网页请求仅发往固定 HTTPS host/path；全程不运行 worker、模型、OCR、Jina fallback、embeddings 或外部推送。此记录与之前的 loopback fixture 软件测试分开，不能据此宣称福建、上海通过，也不代表近 90 日完整覆盖。

## MODEL

Luna High B。Node v24.16.0、npm v11.13.0；使用 pinned Undici 8.11.2 和仓库现有 P3 dispatch budget 实现。所有网络请求均为本次获批的北京官网 GET。抽取阶段关闭 Jina (`extractArticleBody(articleId, false)`)。未调用真实模型或启动队列 worker。

## FILES_CHANGED

新增本报告。ignored `.data` 留存一次性 runner、localhost preflight、阶段结果 JSON、事件、日志与 SQL 查询/输出；未改 backend、packages、schema/migrations、sources 配置、共享文档或 Git index。runner SHA-256（最终版本）为 `70BD36FF664FC8A1AFCD9C7BACF0B8E93843B97FCB1E5243F04589996CB34B5D`。

证据目录：`.data/fiscal-qa/beijing-real-20261005/`。关键文件为 `preflight.json`、`collector-result.json`、`extract-result.json`、`repeat-result.json`、`post-run-review.sql`、`post-run-review.log` 及各阶段 runner log。`collector-result.json` 是早期阶段输出，保留了当时完整 dispatch 事件；其 11 条响应体 SHA-256 未采集，记为 **UNKNOWN**，没有为补 hash 重抓官网页面。stage2 和重复列表各自采到响应体 SHA-256。

## TESTS_RUN

- Node 24 `node --check .data/test-pg/beijing-live-once.mjs`：通过。localhost-only preflight 4/4：未允许的 host/path 在服务端 0 hit；redirect follow-up 被拦截；已知 20 字节响应的 SHA-256 与预期一致；cap=1 时第 2 个 dispatch 被拒绝。Canary SHA-256 为 `64f1131565e6306cc64a86b0d79ac56c9e2264c140fd7216fbaf28fa21a5bb78`。
- fresh `fiscalhot_oct05_beijing_live_test`：35 migrations，只有 `mof-beijing-supervision-dynamics` 一条来源；来源保持 disabled，site/syndicate fulltext 均 false。数据库地址为 `postgres://postgres@127.0.0.1:5432/fiscalhot_oct05_beijing_live_test`。预览库未连接或修改。
- Collector 阶段单独 cap=11：11 attempted / 11 dispatched / 0 rejected，1 个栏目页 + 10 个详情页，全为 HTTP 200；固定 origin `https://bj.mof.gov.cn` 和 `/caizhengjiancha/` path 内，无 redirect、retry 或其他 host。Collector 返回 `ok`, `found=10, created=10, revised=0`。
- 显式抽取阶段单独 cap=1：1 attempted / 1 dispatched / 0 rejected；exact target URL 单 GET、HTTP 200，无 redirect；响应体 7,108 bytes，SHA-256 `5e19afbd081d2ce5bd6e22fda93415c94dc60c97327d474c384dab99ce47592e`。`extractArticleBody("i5h0w7u2r6bzkswoco6f520r1", false)` 返回 `ok`。
- 幂等性阶段单独 cap=1：1 attempted / 1 dispatched / 0 rejected；只 GET 列表 `https://bj.mof.gov.cn/caizhengjiancha/`，HTTP 200，无第二次 dispatch、详情请求或 redirect；响应 4,587 bytes，SHA-256 `3dd4730a376ce1dbd2446eb947ddae43c4ce188488d5de0e0c362f0d51444af4`。Collector 返回 `ok`, `found=10, created=0, revised=0`。
- 阶段前后均只读检查同一测试库，最终 SQL 摘要在 `post-run-review.log`。没有运行全量测试或应用其他 migrations。

执行进程显式设置 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`、所有 `FEISHU_*_ENABLED`、private-network、OCR、embeddings、Jina fallback/skip flags 为 false；清除了 provider key/base URL/token/secret、代理相关变量；不存在仓库 `.env`，凭据目录不存在。数据库密码未使用或打印。

## RESULT

首轮真实 collector 在近 90 日窗口内保存了 10 条不重复文章，每条都生成 revision 1。详情权威样本 `https://bj.mof.gov.cn/caizhengjiancha/202609/t20260924_3998098.htm` 的列表日期为 2026-09-24，而已持久化详情发布日期为 **2026-09-30 08:39 +08**，标题为“北京监管局：坚持‘四个进阶’提升属地中央预算单位预算编制审核质效”。详情日期覆盖列表日期，标题不被列表值覆盖。首次持久化时 10 篇均为 `body_status=pending`, revision 1；数据库没有正文、附件诊断 marker 或可审计的 `identity_missing` 诊断字段。执行期间的操作记录曾将首轮正文判定描述为 identity 缺失，但该 warning 没有写入 fetch-run detail/文章 raw，也没有留在 collector-result JSON，因此不能将它当成持久化、可复核的事实。本次结果可确证的是 metadata 持久化而正文仍 pending。

之后只对上述单篇的既有 article ID 显式调用抽取，不处理既有队列。目标 title、发布日期保持不变；body 由 pending 转为 `ok`，revision 从 1 增至 2，正文 1,696 字符、HTML 1,905 字符，并新增唯一 revision 2 行。正文审核仅作业务相关性检查：页面内容围绕属地中央预算单位预算编制审核和预算监管工作方法，属于财政预算主题；已读正文没有显示它是与主题无关的内部活动报道。正文以摘要描述，未复制长原文，也没有模型评分、精选或发布判断。

第三次只重抓一页列表。仓库 collector 对已有候选会按 URL 查询已存 title，命中后跳过 detail fetch；观察结果与这一路径一致：10 个候选仍是 10 条，`created=0, revised=0`，目标权威 title/date、body `ok`、revision 2 保持，其他 9 篇仍 pending/revision 1。无重复 URL。可见的列表候选日期在 2026-09-10 至 2026-09-28；入库日期按详情 `PubDate` 解析，均在 2026-09-15 至 2026-09-30 +08 区间，处于 2026-10-05 的近 90 日窗口。

Collector 通过 `queueProcessing` 写入 10 个 `content.extract-body` / `created` job。前后两次 collector 及显式抽取之间 queue 都维持 10 个 created job；没有 worker 或消费者运行、没有 job_runs。全库 `analyses=0, receipts=0, publications=0, selected_ledger=0`，没有分析、provider receipt、发布或精选记录。所有文章附件诊断 marker 均缺省。来源依旧 disabled，所有 provider 与外部推送仍关闭。

这些是真实代码在一次北京来源 run 的真实网页/隔离 DB 行为，不是 loopback fixture 测试；也不是全量覆盖验收。首轮 11 个 HTML 响应原始字节 SHA 未留存；抽取和幂等列表阶段的响应体 hash 已留存且未保存长正文原文。**Gate 2 尚未通过**：只验证了单个列表时点、10 个候选和单篇正文，不足以证明栏目分页、90 日历史完整度或跨周期稳定性。福建设/上海未执行。

## RISKS

- 首轮 11 个响应体 hash UNKNOWN，且首次 identity warning 无耐久日志/DB 证据。两个限制都如实保留，没有补发请求、重写证据或从后续 body ok 倒推首次拒绝的原因。
- 页面只观察到一个栏目页和本批 10 条候选；未验证站点分页、归档、更旧历史页、90 日覆盖、页面延迟、超大响应或后续跨周期一致性。
- 正文身份和语义检查仅针对一个文章样本；未调用模型，不能代替人工完整内容质检。正文长度存在不代表整个来源正文质量通过。
- Collector queue job 是待处理记录，不是运行结果。该库必须保持无 worker；显式抽取是单篇直接调用，不是消费队列。

## BLOCKERS

Gate 2 仍为 `NOT_PASSED`。福建与上海各自真实 collector、各自正文样本、多个周期/分页与 90 日历史覆盖仍待单独验收。不要将本轮只读结果解释为启用来源的批准。

## NEXT

保留 `fiscalhot_oct05_beijing_live_test` 和 `.data/fiscal-qa/beijing-real-20261005/` 供独立 QA/Lead 复核；不重跑北京、不再发请求、不启动 worker。之后由 Lead 对福建、上海分别核销 fresh 隔离库与单轮预算；跨周期和分页证据需另行规划。北京来源继续 disabled，直到 Gate 2 所需证据完整审阅。
