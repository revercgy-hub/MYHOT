# P3 两个核心来源整页采集批次（2026-09-30）

DATE=2026-09-30（Asia/Shanghai）
STATUS=有限执行完成；HTTP hop 上限证据不成立；Gate 2 仍 NOT_PASSED。

## 范围和隔离

按 `industry/sources.json` 实际 ID 执行 `mof-accounting-notices` 和 `mof-budget-work`。任务提出的 `mof-budget-disclosure` 在当前配置中不存在；唯一预算司栏目是财政部预算司·工作动态 `mof-budget-work`，Lead确认不改用财政部政策发布 `mof-policy-release`。使用新建 `fiscalhot_corebatch_test`（本机 PostgreSQL `127.0.0.1:5432`），确认库名创建前不存在，运行了全部 35 项现有 migrations。数据库仅有这两个来源；配置内容复制自当前 `industry/sources.json`，没有缩窄 `allowUrlPrefixes`，没有修改源代码/配置文件。为让既有 `collectSource` 可执行，只有这个临时测试库中的两条 source 在运行期间临时设为 `enabled=true`；结束时 SQL 核实二者都已恢复 `enabled=false`，`site_fulltext=false`、`syndicate_fulltext=false`。preview 数据库及其他来源未写入。

`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH` 全为显式 `false`。无重试、无 worker、无模型调用、无付费 Reader。collector 建立了 20 个 `content.extract-body:created` 队列任务，全部仍为 created、未消费；`analyses=0`、`receipts=0`、`job_runs=0`。

## 两轮结果

下表的 `found` 取 `collectSource` 返回值及对应 `fetch_runs`；它是当轮首页解析数量。`accepted` 指通过原 allow 前缀、噪声过滤、首导入/普通轮次限制后交给存储的候选数：本轮两个源均无噪声过滤规则，预算司首轮沿用 collector 默认首导入 12 个月/最多 30 项，后续轮沿用最多 60 项。accepted 依据 `found`、DB 空起点、run 前后行数及源码限制核算；collector API 本身不返回此字段。

| Source | 轮次 | found | accepted | created | revised | 日期窗口（中国日历日） | collector状态 |
|---|---:|---:|---:|---:|---:|---|---|
| `mof-accounting-notices` | 1 | 10 | 10 | 10 | 0 | 2026-08-04—2026-09-29 | ok |
| `mof-accounting-notices` | 2 | 10 | 10 | 0 | 0 | 2026-08-04—2026-09-29 | ok |
| `mof-budget-work` | 1 | 10 | 1 | 1 | 0 | 首导入12个月内仅 2026-03-26 | ok |
| `mof-budget-work` | 2 | 10 | 10 | 9 | 0 | 2023-07-24—2026-03-26 | ok |

预算司第二轮增加的 9 篇旧文是实际观测，不是推算：collector 首轮写入唯一近 12 个月条目；首轮后 `cursor.initializedAt` 已存在，第二轮按普通同步窗口最多 60 项处理，因此 9 篇更早文章被接受。20 篇最终都标为 `backfill=true`，说明这是首页历史回填标记；这不代表第二轮仍受首导入 12 个月条件约束。

数据库最终共 20 篇，每源 10 篇。四次 collector 运行全部成功，`fetch_runs.found_count/new_count` 依次为 accounting `10/10 → 10/0`、budget `10/1 → 10/9`。没有配置 URL allowlist 收窄；请求页只有源配置首页，未分页。存储文章的日期使用列表页日期与源配置 `+08:00` 解析；其中会计司 URL 日期与列表发布时间不可互换，报表按数据库解析出的中国本地日记录。

## 快照比较、日期和噪声

9/29 预算司原始列表快照 `.data/fiscal-source-audit/lists/mof-budget-work.html`（mtime 2026-09-29T03:36:39Z）由同一 `fromHtml()` 选择器离线解析出 10 条。隔离库实际导入的 10 条 URL 与旧快照 10/10 完全重合，标题也一致；9/30 两次 collector 都各报告 found=10，第二轮无新增/修订。新运行没有成功保存列表响应正文，因此不能提供 9/30 原始列表 HTML/hash；“同一集合”由两轮 found、导入行和既有旧快照交叉支持，证据弱于可独立复跑的新旧原始快照对照。此结果是 9/29 与 9/30 两个日期上的有界首页快照观察，不证明长期稳定、更新速度或故障时滑窗覆盖；早先同一固定 URL 的两轮仅是幂等证据。

9/29 会计司已保存的首页 HTML `.data/fiscal-central-audit/html/mof-accounting-1.html`（mtime 2026-09-29T03:59:55Z）按当前 selector 离线解析出 5 项，这 5 个 URL 全都在新 DB 的 10 篇内；新 DB 另有 5 条此前快照未包含的 URL：9/29、9/3、8/21、8/14、8/3 各一条。既有 `collector-preview-once.json` 对同日首页记 `rawCount=10`，但只留代表样本而非10条完整 URL，无法用它还原那十项并作完整精确差分。`.data/fiscal-central-audit/html/mof-accounting-index-1.html` 是 9/29 的 `index_1.htm` 历史页，不作为首页基线。

| 来源 | DB 发布时间范围（上海日） | 当前首页噪声记录 |
|---|---|---|
| 会计司 | 2026-08-04—2026-09-29 | collector 配置无 `ingestNoiseFilter`，实际过滤 0 篇。会计师事务所备案/注销名单、证券服务信息、村民/居民会计应用问答等边缘内容已保留；相关性与既有 Gate 2 噪声裁定仍待人工核查。 |
| 预算司 | 2023-07-24—2026-03-26 | collector 配置无 `ingestNoiseFilter`，实际过滤 0 篇。两条部门预算编制动员会是会议类内容，行业相关性仍待裁定；没有静默丢弃。 |

因此本批 `noise filtered=0` 只说明配置没有按噪声规则删项；不代表零噪声或内容适配通过。

## 逐篇正文核验

对每个来源两轮内新建的文章按来源内发布日期新到旧顺序做单次有界正文调用，最多 12 篇；本批实际调用 12 篇。结果以调用返回值及结束后的只读 SQL 状态为准：6 篇 `ok`、6 篇 `unconfirmed`、另有 8 篇 `pending`（未轮到正文预算）。`ok` 仅是现有 Readability helper 的机器状态，不代表 Gate 2 来源验收；已有正文误判风险仍适用。未确认文章原文和数据库状态如下：

| Source | 文章（标题） | 日期 | 正文状态 | 字符数 | 未确认原因 |
|---|---|---|---|---:|---|
| `mof-accounting-notices` | 2025年度会计师事务所从事证券服务业务有关信息 | 2026-09-20 | unconfirmed | 0 | helper 只返回通用 unconfirmed；失败原因未被现有接口/日志记录 |
| `mof-accounting-notices` | 从事证券服务业务会计师事务所注销备案名单 | 2026-09-04 | unconfirmed | 0 | 同上 |
| `mof-accounting-notices` | 财政部会计司发布村民（居民）委员会会计核算相关实施问答和应用案例 | 2026-09-03 | unconfirmed | 0 | 同上 |
| `mof-accounting-notices` | 从事证券服务业务会计师事务所备案异常名单 | 2026-08-21 | unconfirmed | 0 | 同上 |
| `mof-accounting-notices` | 从事证券服务业务会计师事务所注销备案名单 | 2026-08-14 | unconfirmed | 0 | 同上 |
| `mof-budget-work` | 财政部召开2026年中央部门预算编制工作动员会 | 2025-06-25 | unconfirmed | 0 | 同上 |

8 篇保持 pending，未请求详情：预算司 `2025-03-26`（2025年中央预算公开答记者问）、`2025-01-03`（县级基本财力保障机制奖补资金管理办法）、`2024-09-03`（修订政府收支分类科目的通知）、`2024-03-27`（落实习惯过紧日子）、`2024-03-26`（2024年中央预算公开答记者问）、`2023-11-24`（下达县级奖补资金预算）、`2023-11-23`（县级奖补资金管理办法）、`2023-07-24`（2024年部门预算编制动员会）。

本次 SQL 与 helper 汇总曾在口头进度里被误数成 7 ok/5 unconfirmed；这是手工统计口误。逐篇 helper 结果和 SQL 汇总一致，正确总数为 6 ok/6 unconfirmed。普通 Readability 路径在异常时 catch 后返回 null，再把 null 写为 unconfirmed；接口不返回失败原因，常规路径没有把 HTTP 状态或 Readability 失败原因写入可查询日志（见 [extract.ts](../../packages/backend/src/content/extract.ts:48)）。当前证据只能说明上述六篇未确认，不能将它们断言为 HTTP 故障或正文长度不足。未重试或重抓。

## HTTP 预算计数故障和限制

执行器按四次 `collectSource` 调用和十二次 `extractArticleBody` 调用运行，共 16 个顶层源/文章函数调用，无显式重试。但本地 ignored helper 的 Undici `Agent.prototype.dispatch` 计数钩子在实际路径上得到 0 次 dispatch，`http.jsonl` 因此为空；它没有观察到真实 HTTP hop 或重定向。页面请求实际发生且四个 fetch run 成功，但本批无法证明“总真实 HTTP ≤20”。脚本设计的硬阻断器因此没有生效，不能把 16 个顶层函数调用误称为实际 HTTP 次数或宣称预算通过。

发现计数钩子失败后没有追加任何网络访问，也没有重跑。该运行结果保留为来源候选/数据库观察及正文状态记录；真实 hop 总数为 unknown，因而不满足要求的可证预算封顶。后续如需再做来源试验，应先在不发出网络请求的情况下修复并验证计数/硬停止机制，再由 Lead 单独安排新预算；本报告不请求追加请求，也不把本次记作 P3 source pass。

## 留存证据和状态

可复核产物均位于 Git 忽略的 `.data/fiscal-qa/`：

- 执行器 `.data/fiscal-qa/p3-source-batch.ts`；数据库结果 `.data/fiscal-qa/core-batch-20260930/result.json`；HTTP 计数日志 `.data/fiscal-qa/core-batch-20260930/http.jsonl`（为空，正是计数器失效证据）。
- 两轮数据库行、正文 hash/preview 与采集结果见 result JSON；列表响应正文没有保存在本轮产物中。旧 9/29 HTML 原始快照仍在上节所列 ignored 路径。执行时使用 `node .data/fiscal-qa/p3-source-batch.ts`，并显式设置 `DATABASE_URL=postgres://postgres@127.0.0.1:5432/fiscalhot_corebatch_test`、`EGRESS_PROXY_URL` 为空及上列七个安全变量全为 `false`。helper 对空库及精确 DB URL 有严格前置检查，不可在现有非空库重放；因 dispatch hook 未生效，也不能把它作为新的有界联网运行器。
- 数据库源已 `enabled=false`；数据库仍隔离存在，保留 20 篇文章、4 次 fetch run、20 个未消费 body extraction jobs。它不接入公开 preview。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：在独立库对财政部会计司工作通知、财政部预算司工作动态用原始全页配置各运行两轮 collector，并对最多 12 篇新增文章做单次正文核验。

**MODEL**：Luna High；没有调用仓库模型服务。

**FILES_CHANGED**：唯一 tracked 新增文件为本文。ignored 新增 `.data/fiscal-qa/p3-source-batch.ts`、`.data/fiscal-qa/p3-core-batch-offline-compare.ts`、`.data/fiscal-qa/inspect-accounting-snapshots.ts`、`.data/fiscal-qa/core-batch-20260930/result.json` 与空 dispatch 记录 `http.jsonl`。未修改 `industry/sources.json`、apps/packages/schema、preview 库或其他来源。

**TESTS_RUN**：按要求未运行测试套件。新库 35 项 migrations 成功；两源 collector 4/4 成功；12 篇 extractor helper 调用；执行后 SQL 核验 20 articles、4 successful fetch runs、6 ok/6 unconfirmed/8 pending、source flag 全 false、20 个 created jobs 未消费、analyses/receipts/job_runs=0。保存的 9/29 HTML 用当前 `fromHtml()` 离线比较；没有额外网络调用。执行器 HTTP hook 失败，实际 hop 上限无法核证。

**RESULT**：验证了全页候选落库与首导入限制实际行为；预算司首轮仅入 1 篇近 12 个月文章，第二轮增加 9 篇旧文。accounting 两轮 10/0；budget 两轮 1/9。正文有限抽取 6 ok、6 unconfirmed，8 pending。来源保持 disabled，Gate 2 不变。ignored 执行器 SHA-256=`44FD9650B17BD6386A6690B364CAC1B13C20CA928E356502110FC51BE7B0780D`；结果 SHA-256=`D2DADF5C11364F657C42107699AA80E5A528B20AA79C1FA338BC4069AAE6D3EF`；空 hop 日志 SHA-256=`01BA4719C80B6FE911B091A7C05124B64EEECE964E09C058EF8F9805DACA546B`。

**RISKS**：HTTP dispatch 计数 hook 无效，真实 HTTP hop 总数未知，不满足 ≤20 预算证据要求；当前列表响应未留本轮原始 HTML/hash；Readability `ok` 不是逐字段完整性验收。六篇 unconfirmed 的失败原因未知，8 篇尚无正文。单日/跨日快照不能支持长期栏目稳定、持续覆盖或噪声门槛通过。

**BLOCKERS**：本批不能证明真实 HTTP 请求不超过 20；两源完整性、噪声、栏目稳定性和核心正文覆盖均未验收。

**NEXT**：将这批 SQL/计数失效/正文负例纳入质量交接；必要时另行先离线审计 extraction failure logging 和 hop-budget hook，再经 Lead 安排新的有界运行。正式 Gate 2 Review 仍须保持 `NOT_PASSED`。
