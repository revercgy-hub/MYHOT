# 三局来源集成测试 QA（2026-10-05）

## TASK
使用 saved HTML fixture 与独立 PostgreSQL 测试库，验证福建、北京、上海三条 disabled `web_list` 来源经过真实 collector、持久化、队列路由与显式正文抽取时的行为。

## MODEL
Luna High B；没有调用模型、外部服务或官方来源。HTTP server 只监听 `127.0.0.1`，通过 fixture 返回本地 HTML；原始栏目域名在内存 fixture 中改写为 loopback。未启动 worker。

## FILES_CHANGED
新增 `tests/regional-bureau-integration.test.ts` 与本报告，并在 `tests/signals.test.ts` 补齐该文件自己的 loopback provider profile。没有修改 backend、schema、migration、Git index，也没有提交。

## TESTS_RUN
- PostgreSQL 17.11 loopback 新数据库 `fiscalhot_oct05_bureau_integration_test`，显式 URL `postgres://postgres@127.0.0.1:5432/fiscalhot_oct05_bureau_integration_test`；应用现有 35 个 migration。
- Node 24.16 集成测试：1/1 通过。
- `tests/source-rules.test.ts`：12/12 通过。
- `npm run typecheck`：通过。
- 集成测试在测试回调内只冻结 `Date` 到 `2026-10-05T12:00:00.000Z`，并在 `finally` 恢复；网络与 PostgreSQL timers 未冻结。
- 2026-10-05 QA fresh suite 后续诊断：252 项中 249 通过；3 个失败都在 `tests/signals.test.ts`。
- 修复后 fresh PostgreSQL 17.11 数据库 `fiscalhot_oct05_signals_final_test` 应用 35 个 migration；Node 24.16 focused `tests/signals.test.ts` 3/3 通过；`npm run typecheck` 通过。

## RESULT
福建、上海测试在 saved list DOM 上添加了 11 条内存合成列表项，令 12 个候选超过 `maxFetches:10`。两源首轮 detail 请求均恰好止于 10；重复 collector 无新建、修订或额外详情请求。

北京测试验证首轮详情权威标题与 `PubDate` 存入数据库；正文身份因首轮预详情 identity 缺少权威发布日期而被拒，文章仍为 `pending`、revision 1，并进入 `content.extract-body` 的 created job。测试随后让本地 fixture 临时返回矛盾的身份 metadata，显式抽取安全失败且不改标题、日期、正文或 revision；恢复原 fixture 后显式调用 `extractArticleBody` 成功，body 为 `ok`、revision 2。相关分析、receipt 与 selected publication 均为零。

saved HTML 的栏目/详情结构及 metadata 来自离线观察 fixture；三个 fixture 的 `.my_doccontent` 正文明确标注为合成内容，不复制新闻全文。预算压力行和矛盾身份响应也只在测试内合成。本测试运行了真实本地 collector/数据库/队列/抽取代码，但没有运行真实来源抓取、worker 或生产流程。

### Signals 本地 provider stub 后续诊断

原 249/252 full suite 的三个失败来自 `tests/signals.test.ts` 的两项测试隔离缺口。两项需调用 `confirmMerge` 的测试走到 `mimo-v2.6-flash`，这是 `tests/setup.ts` 默认的 `GROUP_REVIEW_MODEL`；该文件只配置本地 DeepSeek 与 DashScope stub，QA 又清理了 Mimo 凭据与 URL，因此调用报 Mimo 未配置。另一项由 QA 全局 `EMBEDDINGS_ENABLED=false` 导致：`embeddingsAvailable()` 短路后 signal 路由返回 `signal-unmatched`，但不记录 `grouping_decisions`。没有证据表明是 backend 变化或 QA 残留模型路由变量。

最小修复仅在 `tests/signals.test.ts` 的测试进程内生效：在动态导入 backend 前，将 `GROUP_REVIEW_MODEL` 指向同文件的 loopback DeepSeek stub，并将 `EMBEDDINGS_ENABLED` 仅对该文件已有的本地 DashScope embedding stub 开启。QA runner 的全局 embedding 门控仍为 false，所有真实 provider key/base URL 已清空，没有调用真实 Mimo。修复后 fresh 35-migration 数据库上的 focused 测试 3/3 通过；这补齐了原测试已有的本地 provider fixture，不改变生产默认路由或门控。

## RISKS
结果证明已观察 fixture 下的软件衔接行为，不证明真实站点此后的结构稳定性、跨周期采集质量或 Gate 2 通过。

## BLOCKERS
无软件测试阻塞。Gate 2 的真实来源证据与独立来源审查仍按项目计划处理。

## NEXT
由 Lead 审阅测试及配置改动；保持三条来源 disabled，后续真实采集仍需遵守 Gate 2 和另行批准的请求预算。
