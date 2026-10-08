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

Gate 2只放行 `pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`中逐篇核验身份、日期、附件无未决问题且正文 `body_status=ok`、trim后非空的文章。10月8日隔离准备快照只包含前两项各一篇；planner给出的 `ready` 和receipt容量只用于静态准备，不执行分析、不预留预算，也不表示全部三项来源或全目录通过。Lead已向用户提出首次冒烟方案待选择：两篇 Treasury+OMO 串行、最多20次物理模型请求且不自动重试，或最多10次/暂不付费。用户尚未选择，故当前没有实际调用授权；每篇具体额度还需在执行前清点调用链。首次两篇冒烟不以内部活动负例为前置条件，负例仍需纳入后续P4质量评估。详细阶段范围以[Gate 2正式审查](GATE_2_REVIEW.md)为准。

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
