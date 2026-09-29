# P3 本地受控入库与重复抓取验证

日期：2026-09-29。范围为 3 个来源、每源两次列表抓取；此验证用于检查真实 collector 入库、时区落库和 URL 幂等，不代表 Gate 2 或正文流水线验收。

## 安全边界与步骤

- 新建隔离 PostgreSQL 数据库 `fiscalhot_ingest_test`，仅运行仓库 35 项 migration。便携 PostgreSQL 监听 `127.0.0.1:5432`。
- 从 `industry/sources.json` 将下列 3 个 source 原样导入该测试库；导入时核对它们在仓库中的 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`，仅把测试库里的这 3 行临时设为 enabled。未改仓库配置文件或持久 `.env`。
- 使用仓库现有 `node scripts/collect.ts <source-id>` force 入口，按来源逐个运行两轮。每次只读官方 HTML 列表，不调用 `previewSource`、详情页、Jina、模型或 API；每页实际返回 10 项，因此首轮逐源写入最多 10 条，低于 first-import 默认 30 条限制。两轮总计 6 次列表 GET。
- 全程 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、`JINA_BODY_FALLBACK=false`、`INDEXNOW_SUBMIT_ENABLED=false`、`FEISHU_CONTENT_PUSH_ENABLED=false`、`FEISHU_INTERNAL_ENABLED=false`。没有启动 API 或 worker。collector 只将 body extraction job 写入测试库的 pg-boss 队列；没有进程消费队列。
- 运行后将测试库内 3 个 source 恢复为 `enabled=false`、`health='paused'`。没有对别的数据库执行 SQL。PostgreSQL 已正常停止；该测试库和运行日志均保留在 Git 忽略的数据目录供复查。

## 结果

| Source ID | 第 1 轮 found/created/revised | 第 2 轮 found/created/revised | 最终文章数 | 首尾发布时间（Asia/Shanghai） |
|---|---:|---:|---:|---|
| `mof-policy-release` | 10/10/0 | 10/0/0 | 10 | 2026-05-09 — 2026-08-26 |
| `mof-finance-notices` | 10/10/0 | 10/0/0 | 10 | 2025-12-12 — 2026-07-16 |
| `mof-treasury-debt-data` | 10/10/0 | 10/0/0 | 10 | 2025-12-30 — 2026-09-24 |

三源各自的 `fetch_runs` 两次均为 `ok`；每次 `found_count=10`，第二次 `new_count=0`。最终 30 篇均有不同 URL 和 identity key，无修订；每源 10 篇均标记 `backfill=true`。保存的日期按 `+08:00` 正确落入各自来源日历日，例如财政部金融司列表日 2026-07-16 保存为 `2026-07-16 00:00:00+08`。

所有文章仍为 `body_status=pending`、`processing_state=new`。pg-boss 中只有 30 个 `content.extract-body` created jobs，没有 `content.analyze` job；`receipts` 行数为 0，leaderboard 模型表无行。由此确认此测试没有执行正文抓取或模型请求。不能据此声称正文质量已通过。

## 可复跑命令

在本地已启动的 loopback 测试 PostgreSQL 上，先创建新 `_test` 数据库并迁移；仅将指定三个 disabled source config 导入测试库，然后逐次运行：

```powershell
$env:DATABASE_URL='postgres://postgres@127.0.0.1:5432/fiscalhot_ingest_test'
$env:COLLECT_ENABLED='false'
$env:MODEL_CALLS_ENABLED='false'
$env:JINA_BODY_FALLBACK='false'
$env:INDEXNOW_SUBMIT_ENABLED='false'
$env:FEISHU_CONTENT_PUSH_ENABLED='false'
$env:FEISHU_INTERNAL_ENABLED='false'
node scripts/collect.ts mof-policy-release
node scripts/collect.ts mof-finance-notices
node scripts/collect.ts mof-treasury-debt-data
```

再执行相同三条命令作为第二轮，并查询 `fetch_runs`、`articles`、`article_revisions`、`pgboss.job` 与 `receipts`。严禁在这次验证中启动 worker 或 Web/API；不要用生产数据库。

## 仍待解决

此轮只证明三源列表读取、日期落库、初次 backfill 和记载相同 URL 时的幂等行为。文章 body 没有被抽取；人民银行 OMO 公告正文 0 字符，会计司一条列表/详情日期相差 1 天，福建列表 2 个 PDF、厦门债务正文 205 字及预算司弱正文仍需人工/离线规则处理。来源分页覆盖、长时间新鲜度、详情抽取和全文门槛也未验证。12 个首批重点入口尚有 3 个未配置，Gate 2 仍未通过。
