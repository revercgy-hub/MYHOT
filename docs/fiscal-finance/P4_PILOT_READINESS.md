# P4 精选试点只读准备器

DATE=2026-10-08（Asia/Shanghai；本节更新）
STAGE=P4 bounded pilot preparation / model execution not started
GATE_2=PASSED_FOR_BOUNDED_P4_PILOT（仅限Gate_2_REVIEW中的逐篇合格文章）
MODEL=DeepSeek V4.1 Flash（DeepSeek API model slug: deepseek-flash；用户已选择）
MODEL_EXECUTION=NOT_RUN；MODEL_CALLS_ENABLED=false；COLLECT_ENABLED=false；真实API key未配置
BUDGET=执行方案提议已发用户，等待选择；当前未获付费调用授权
LATEST_SAMPLE=隔离库 fiscalhot_p4_preparation_20261008_test；两篇合格候选：Treasury 1、PBOC OMO 1；厦门监管局候选尚未加入该快照
GOLD=人工标签仍为null/needs_review；未形成Gold Dataset或模型质量结论

## 2026-10-08 用户模型选择与协议兼容核对

本文后续的范围、验证和结论段落记录2026-10-03首次交付时状态；本节及页首字段是2026-10-08的最新P4准备状态，Gate 2结论以正式review为准。

用户已选择 DeepSeek V4.1 Flash。DeepSeek 官方将当前服务模型名列为 `deepseek-flash`；OpenAI格式文档给出的根地址为 `https://api.deepseek.com`。本仓库 [llm.ts](../../packages/backend/src/providers/llm.ts) 将配置根地址拼接 `/chat/completions`，因此准备配置示例使用该根地址。当前仓库客户端使用 DeepSeek 官方支持的 OpenAI-compatible Chat Completions。

以下是无密钥的配置示例，仅供Lead在已批准的执行准备中使用；本次没有写入 `.env`、凭证目录或环境变量：

```dotenv
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-flash
LLM_EXTRA_JSON={"thinking":{"type":"disabled"}}
# LLM_JSON_MODE 默认开启；如需显式记录可写 true
LLM_JSON_MODE=true
# LLM_API_KEY 由用户在获批执行时自行安全配置，不放入文档或仓库
```

静态字段核对：当前client发送 `messages`、`temperature`、`max_tokens`，默认附加 `response_format: {type: "json_object"}`，通过 `LLM_EXTRA_JSON`附加DeepSeek的 `thinking` 开关，并从 `choices[0].message.content`读取输出。公开DeepSeek Chat Completions、JSON Output和Thinking Mode文档列有对应接口字段；在 `thinking.type=disabled` 下准备配置不额外指定reasoning effort。没有真实API请求或端到端响应验证，故当前只是一份待实测配置提案。供应商JSON Output文档还建议在提示中包含json指令并合理设置max_tokens；现有prompt与token上限需在首次获批小样中观察，不能由静态字段匹配替代验证。官方依据：[First API Call](https://api-docs.deepseek.com/en/)、[JSON Output](https://api-docs.deepseek.com/guides/json_mode/)、[Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)。

Gate 2只放行 `pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`中逐篇核验身份、日期、附件无未决问题且正文 `body_status=ok`、trim后非空的文章。10月8日隔离准备快照只包含前两项各一篇；planner给出的 `ready` 和receipt容量只用于静态准备，不执行分析、不预留预算，也不表示全部三项来源或全目录通过。Lead已向用户提出首次冒烟方案待选择：两篇 Treasury+OMO 串行、最多20次物理模型请求且不自动重试，或最多10次/暂不付费。用户尚未选择，故当前没有实际调用授权；每篇具体额度还需在执行前清点调用链。此前“首次两篇不以前置负例为条件”的措辞已由[S1有界执行器范围审查](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md)纠正：首次付费前必须冻结合格的厦门监管业务活动负例及后续独立执行边界；负例不必与前两篇同一进程执行，也不加入首批两篇executor的固定ID或共享额度。详细阶段范围以[Gate 2正式审查](GATE_2_REVIEW.md)为准。

## 范围和架构

`scripts/fiscal/p4-pilot.ts` 是只读的候选清单与调用边界审查器。必须显式传入最多50个 article ID；不做自动选样。只接受协议为 `postgres:`/`postgresql:`、host严格为 `localhost`、`127.0.0.1` 或 `[::1]`，且数据库名以 `_test` 结尾的 `DATABASE_URL`。远程、hostless、非PostgreSQL协议与 `_ci` 库拒绝。每次检查以一个 `REPEATABLE READ READ ONLY` 事务固定快照，读取指定 article/source、当前 revision 与相同revision的 `article_revisions.content_hash`、指定 article/revision 最新 analysis 摘要、相关 analysis/extract-body 的 created/retry/active jobs、当前revision的 pending/unknown receipts、五项实际精选能力的 model settings、budget与过去一分钟/一小时/一天的真实 live attempt计数。仅当 `pgboss.job` 存在时检查必要的 `name/state/data.articleId` 字段，不输出任意job payload。

清单拒绝未找到的ID、非公开HTTPS URL、非editorial source、`body_status`非`ok`、正文长度为零、缺失/无效hash、article与revision hash不一致、processing marker/retry/失败状态、候选关联的活动或重试job及当前revision的pending/unknown receipt。活动worker heartbeat存在时，`processing_state=new`也被拒绝，以免被安全扫描接手。disabled source仍可按显式ID只读核查，并在清单显示disabled；这不是运行安全开关，也不允许后续分析。

provider计划依据当前 `analyze.ts` 的实际阶段及互斥条件生成，不会调用 `runAnalysis`、`analyzeArticle`、`eval-selection`、`modelFor`、provider、worker或queue。每条有评分门槛的记录按最坏分支计 prefilter 1、score 2、structure 1、understand 1，另计 understand 内容过滤后的 summarize fallback 1，共6个上界调用；无评分门槛时为 prefilter、structure、summarize，上界3。BLOCK/分数和短文本可使实际调用更少。模型service、model slug、stage条件、prompt内容hash都进入准备清单，不读取或写出凭证。归组、digest、publication不属于这条 per-article analysis链，不计入计划。

预算结果是同一快照的数量容量比较，不预留budget、不证明真正调用可用，也不能计算费用；费用金额明确为unknown。manifest记录输入ID、public article URL/title、source、revision/hash/body状态、历史analysis摘要、provider/prompt计划、预算快照、拒绝理由与整体SHA-256。它不保存正文、headers、provider key或receipt response。输出只写 `.data/fiscal-p4-pilot/` 下新JSON文件，采用 `wx` 禁止覆盖；不写数据库，不导入SelectBench。manifest哈希冻结的是这次快照内容，不能保证DB以后不变；之后任何真实执行都须重新核对revision/hash与授权。

## 验证

Focused纯函数测试验证显式ID限制、loopback PostgreSQL + `*_test` DB限制、远程/hostless/非PostgreSQL URL拒绝、unconfirmed/hash/revision/job/receipt/retry非editorial负例、disabled source仍能只读审核、活跃worker对待扫new文章的拒绝、准确阶段/上界调用数、预算容量与manifest hash无正文字段。

另用新测试数据库 `fiscalhot_p4_pilot_20261003_test` 完成35 migrations，仅插入两个固定本地fixture记录。对一个 `ok` 正文的disabled source记录，CLI写出 `ready=true` 的冻结manifest；对同库一个`unconfirmed`/无hash记录，manifest为`ready=false`并列出拒绝理由。随后只读SQL核对：2 articles、0 analyses、0 receipts、0 receipt_attempts、0 job_runs。测试正文未出现在terminal或manifest；fixture无外网URL请求，无worker、采集或模型调用。

实际focused命令及结果：

```powershell
node --test tests/fiscal-p4-pilot.test.ts
# 6/6 pass

npm run typecheck
# exit 0
```

本地DB smoke命令：

```powershell
node scripts/fiscal/p4-pilot.ts --article-ids p4pilot01 --out .data/fiscal-p4-pilot/integration-accepted.json
node scripts/fiscal/p4-pilot.ts --article-ids p4pilot02 --out .data/fiscal-p4-pilot/integration-rejected.json
```

## 结论与后续

本轮交付的是**准备工具**，不是模型调用或精选质量验证。P4 Gate 2前提未满足，且未授权模型执行；此工具没有任何转入分析、写作、发布、采集或worker的选项。manifest预算并非reserve，active worker检查也只代表快照时的数据库心跳与目标job状态；本工具不会自行阻止其他进程稍后启动。生产source保持disabled，未改 `industry/selection.ts`、行业配置、backend、schema或apps。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：交付P4显式候选样本的只读准备/冻结清单及provider/receipt预算边界快照。
**MODEL**：Luna High；未调用模型服务。
**FILES_CHANGED**：新增 `scripts/fiscal/p4-pilot.ts`、`tests/fiscal-p4-pilot.test.ts` 和本文。未改backend/apps/migration/industry selection，未改Git index。
**TESTS_RUN**：focused 6/6（含loopback host allowlist与remote/hostless拒绝）；typecheck通过；fresh `fiscalhot_p4_pilot_20261003_test` 执行35 migrations并完成两条本地fixture的read-only CLI smoke；前后业务计数为0 analyses/receipts/attempts/job_runs。
**RESULT**：`ok`且revision/hash一致的显式article可生成快照manifest；不合格记录保留具体拒绝理由且不进入accepted provider plan。运行时模型调用、写库、队列、worker、publisher、collect、HTTP均为0。
**RISKS**：receipt预算仅数量容量快照，不保留并发容量、无法计价；manifest只冻结已读取值；无heartbeat不构成外部worker绝不存在的证明；disabled source不代表后续执行安全。
**BLOCKERS**：Gate 2未过；P4模型执行不在当前授权范围；未形成任何实际精选、预筛或质量结论。
**NEXT**：QA审查脚本的DB隔离与输出字段；未来真实模型试点需单独核销，并重新固定候选、输入hash、prompt/model配置与receipt预算边界。

## 2026-10-08 bounded-call and retry audit

Static review of the two frozen T1 candidates found a normal planner ceiling of 6 receipt attempts per article: prefilter 1, independent scores 2, structure 1, and one writer call, with a possible summarize fallback after an understand content-filter refusal. Thus two articles have a 12-attempt planned ceiling when their inputs contain no image-triggered understand retry. In `runAnalysis`, structure starts alongside the two scores; the articles can be handled one after another, but the current stages within an article are not fully serialized. If an image is present and the selected model rejects it with a non-retryable provider response, `runUnderstand` makes one text-only call; if that also content-filters, summarize can follow. The planner does not include this extra image fallback, and the current two-row planner manifest does not establish whether either row has image media. Keep 12 as the ordinary no-media planning bound, not an unconditional physical-request guarantee. BLOCK, a low score, or refusal can reduce calls.

The standard content worker does not implement a no-retry run. `llm.ts` performs one `fetch` POST per receipt attempt and has no SDK retry loop, while `paidRequest` inserts/counts the attempt before that POST and reuses a received/completed receipt. Ambiguous timeouts/resets become `unknown` and are not resent automatically; admin recovery may release an unknown once after 30 minutes. Definite 429/5xx/connect rejections follow the content worker's 5-to-360-minute retry schedule (up to eight scheduled retries after the first failure); unusable output can be retried up to three times. Busy receipts and exhausted budgets reschedule without consuming the article failure counter. The content worker also publishes and may enqueue grouping after analysis, outside the planner's per-article call plan.

The existing receipt budget can enforce a conservative count ceiling in a dedicated fresh `_test` database if all five analysis capabilities resolve to one provider service and that service's `per_day` is set to 20 (or 10). Each attempt is counted under a per-service advisory lock before its single provider POST, so retries consume the same cap. This is a rolling 24-hour request-count circuit breaker, not a per-run reservation or currency/token cap; the current planner only snapshots capacity. The frozen planner still reports `default`/`UNCONFIGURED`; the documented default-model route uses service `llm` (default daily limit 40,000), while the named `deepseek-flash` preset uses service `deepseek` (default daily limit 20,000). A run must verify one effective service across prefilter, score, understand, summarize and structure, and set the cap on that service. Amount/cost remains unknown.

At the time of this static audit, there was no dedicated bounded P4 executor. The subsequent [S1 scope review](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md) approved a narrow implementation contract and delegated implementation to Luna High; implementation is now in progress, not accepted or tested. It does not reopen Gate 2 or authorize a paid call. The minimum contract is a one-shot worker restricted to the two frozen article IDs, revisions and hashes, invoking guarded analysis only in article order, stopping on the first error, and avoiding queue retry, sweeper, publish, grouping, collector and admin-recovery paths. Keep receipts and configure the isolated database's single-service daily attempt cap to the selected 20/10 ceiling as a second guard. The user's request limit remains pending; no budget row, model setting or runtime flag has been changed and no provider call was made.

## 后续配置清单（尚未应用）

用户继续开发不代表已经选定首次请求上限。真实调用前，仍需先确定是20次、10次还是暂不付费；本清单不构成授权，也不要求现在提供API key。

- **五项分析能力统一路由**：`prefilter`、`score`、`structure`、`understand`、`summarize`都必须解析到同一DeepSeek路由/服务，避免服务级预算被拆开。`modelFor()`优先级是数据库`settings.models.<capability>`覆盖，其次是对应环境变量（`PREFILTER_MODEL`、`SCORE_MODEL`、`STRUCTURE_MODEL`、`UNDERSTAND_MODEL`、`SUMMARIZE_MODEL`），最后才是代码默认`default`。执行前须复核五项的有效值，不读取或输出secret。
- **选定一条配置路径**：最贴近当前planner快照（五项均为`default`）的是保持五项为`default`，设置`LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-flash`及`LLM_API_KEY`；这条注册项的budget service ID是`llm`。若将五项都显式路由到命名preset `deepseek-flash`，则配置`DEEPSEEK_BASE_URL`、`DEEPSEEK_API_KEY`；此preset的service ID是`deepseek`。`LLM_*`只配置`default`注册项，不会覆盖数据库已有的每项model设置。DeepSeek可选的`LLM_EXTRA_JSON`仅适用于default路由；named preset自身已关闭thinking。
- **预算**：仅在新鲜、专用于这次pilot的`_test`数据库，为实际共用的service ID配置receipt budget；`per_day`按待定选择设为20或10，并保留合理的minute/hour限制。检查由现有receipt逻辑在每次请求前执行，计的是request attempts，不是token、人民币或美元金额；planner快照不预留预算，金额仍unknown。不得只设`llm`而实际请求走`deepseek`，反之亦然。
- **密钥保管**：由负责人将key安全注入仅供一次性后端worker读取的进程环境，或放在仓库外受访问控制的`AIHOT_CREDENTIALS_DIR/models.env`；进程环境优先于凭据文件。不要发到聊天、写入Git或运行日志，不读取/回显key值。
- **运行开关**：`MODEL_CALLS_ENABLED`在后端代码中的默认值是true，变量缺失不能当作关闭；普通API/runtime显式保持false。将来只在获批的一次性P4 worker进程开启true，并继续显式关闭`COLLECT_ENABLED`、Jina fallback、Feishu、IndexNow、embeddings及私网抓取。`MODEL_CALLS_ENABLED=false`会让`chatJson()`抛出disabled错误；普通content worker会把它当作失败并排期重试，所以不要以“开worker但模型阀关闭”代替有界dry-run。
- **执行器缺口**：`scripts/fiscal/p4-pilot.ts`只读规划，不运行分析；普通worker会重试并可继续发布/归组。符合固定ID/revision/hash、逐篇顺序、首次错误停止、无自动重试且不运行collection/publication/group/sweeper的专用worker正在按S1范围实现；尚无已验收/测试通过的runner。当前模型调用开关仍关闭、未启worker；预算和model settings也未配置。

## 2026-10-08 S1范围批准与负例要求纠正

[S1一次性有界执行器审查](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md)的结论为`APPROVED_SCOPE`：仅批准最小实现和loopback软件验证范围，不是Gate 2结论、实现验收、真实模型授权或P4质量通过。Luna High当前实现状态为`IN_PROGRESS`；待代码完成并独立QA。前述“首次两篇无需负例前置”的历史说法与正式Gate要求冲突，现按S1裁定更正：在首次付费调用前必须核验并冻结一篇合格的`mof-xiamen-supervision-dynamics`真实内部活动负例及其后续独立执行边界。Treasury+OMO仍可作为第一批、executor只接受这两个固定ID；负例无需和它们同进程付费执行，不加入这批ID或共用这批预算。若负例尚未合格并冻结，只继续实现与loopback QA，不进行首轮付费调用。配置清单已在上一节记录；DeepSeek V4.1 Flash已选，20/10/暂不付费仍待用户选择，运行开关保持关闭。
