# 人民银行公开市场公告受控采集验证

日期：2026-09-29。本次只验证 `pboc-open-market` 的当前列表解析、一个短正文详情及二轮判重；不代表分页、连续更新、长期稳定性或 Gate 2 已通过。

## 隔离与请求边界

使用新建空隔离库 `fiscalhot_omo_test`，运行仓库 35 项 migration，只 seed `pboc-open-market` 一个来源。来源从未启用：`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。采集 CLI 显式调用现有 `collectSource("pboc-open-market", { force: true })`；`force` 仅绕过 disabled 检查，不修改来源开关。

为限制候选范围，仅在该测试库临时将 `allowUrlPrefixes` 缩到第191号已核验的精确 HTTPS 详情 URL，并设置 `_aihot.initialBackfillLimit=1`、`detail.maxFetches=1`。静态 `industry/sources.json` 未改。首轮只允许一条列表候选和一次详情调用；第二轮同一 URL 已存在，不会再次请求详情。两轮后将隔离库的来源配置恢复为仓库原配置，并保留文章和 `fetch_runs` 证据。未翻页、未尝试其他详情或 PDF。

所有运行开关均为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`。没有启动 API 或应用 worker，没有调用模型、Jina、OCR 或通知。选择器 `#zoom` 及 `allowShortBody=true` 使用既有显式配置；默认 Readability 200 字门槛未改变。

固定预算是**采集器 fetch 调用数**：两轮共调用列表读取 2 次，详情读取最多 1 次，最多创建 1 篇。底层 `guardedFetch` 默认会对每个调用跟随最多 5 次经过 SSRF 检查的重定向，因此该预算不是对网络重定向 hop 的硬限制；`collectSource` 不返回实际重定向计数。第191号详情此前保存的核验记录中请求 URL 与最终 URL 相同；本次只记录调用数，不将其扩张为 wire-level GET 精确计数。

## 两轮结果

| 轮次 | 列表候选 | `found` | `created` | `revised` | 详情调用 |
|---|---:|---:|---:|---:|---:|
| 第1轮 | 1 | 1 | 1 | 0 | 1 |
| 第2轮 | 1 | 1 | 0 | 0 | 0（已存 URL 跳过）|

唯一入库条目：第191号《公开市场业务交易公告 [2026]第191号》，详情 URL 为 <https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html>。列表日及详情 `PubDate` 均为上海日期 2026-09-29，数据库 UTC 时间为 `2026-09-28T16:00:00Z`；详情 `ArticleTitle` 与列表标题相符。落库正文 174 字、1 张表，`body_status=ok`、revision=1。表格保留 7 天期、1.40% 操作利率和 905 亿元操作量；另据本地保存的详情原文及落库正文，原文表述为“同时，开展了6985亿元隔夜逆回购操作。”这里记录的是来源原句，不对该操作作额外业务解释。短正文通过该来源已核实容器的显式配置，不降低全局阈值。

二轮对同一候选执行既有 upsert 判重，`created=0`、`revised=0`；文章仍为 1 篇、revision 和内容哈希不变。两条 `fetch_runs` 均成功。

## 队列与结果边界

因首轮完整正文已成功，现有 `queueProcessing` 创建了一个 `content.analyze` 状态为 `created` 的未消费 job；没有启动 worker，因此没有模型分析或消费。二轮没有新增 job。`content.extract-body` jobs=0、`receipts=0`、`lb_models=0`。该队列记录作为受控验证的既有副作用保留在隔离库中。

测试数据库里的来源配置已恢复为仓库配置，来源开关和全文许可仍为 false。数据库随被忽略的本地 PostgreSQL 集群保留，不属于仓库文件。执行日志、迁移日志及摘要均在忽略目录 `.data/fiscal-qa/`：`omo-postgres.log`、`omo-collect.log`、`seed-omo-test.ts`、`run-omo-collect.ts`、`restore-omo-config.ts`。本次只读写此验证文档，没有代码或来源配置改动，也未重跑代码测试。

此结果仅确认第191号当前可通过现有 collector 路径形成一条正确短正文记录，并在第二轮判重。它不验证其余首页条目、分页、第三方环境的抓取行为或长期来源新鲜度；source 保持 disabled，Gate 2 仍待后续证据。
