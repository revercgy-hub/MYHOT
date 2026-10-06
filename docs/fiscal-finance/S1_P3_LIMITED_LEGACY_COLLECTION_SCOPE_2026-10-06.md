# S1 福建有限 legacy collector 范围裁定 — 2026-10-06

TASK=S1 narrow scope review：下一次福建受限 HTML collector；不是 Gate 2 复审。
MODEL=GPT-6.1 Sol；未调用项目 provider。
RESULT=APPROVED_SCOPE（下述一次性隔离测试及 executor 前置证明；不是立即执行核销）。
GATE2=NOT_PASSED；source admission=NOT_ADMITTED；coverage=unproven。

只读审阅 AGENTS、README、PROJECT_PLAN、STATUS、P3_NEXT_SMALL_COLLECTION_PACKET、S1 Phase A/B 范围裁定，以及实际 collect.ts、web-list.ts、http-fetch.ts、industry/sources.json 和 scripts/fiscal/p3-http-budget.ts。没有 HTTP、DB、Git、collector、worker、模型或 OCR 操作。

## initializedAt 的最小裁定

允许现有无 pagination 的 legacy `collectSource(sourceId,{force:true})` 在 fresh、可丢弃、名称以 `_test` 结尾的独立数据库中正常写入 `cursor.initializedAt`。该字段仅记录本次 legacy 首次成功运行的实现行为；同时产生的 lastOkAt、health=ok 和 fetch_run=ok 同样只说明单次运行结果。它们绝不证明首次近90日回填完成、历史完整、日期权威、来源准入、生产初始化或 Gate 2 通过。最终报告必须原样记录这些字段，并明确本轮只有单页最多两篇的有限样本、coverage=unproven。

Phase A 原裁定已明确“缺省保持现有 single-page 路径和初始化行为”；Phase A/B 的无初始化限制针对显式 pagination 模式的覆盖协议。此次没有 pagination opt-in，不进入该协议。原 packet 将“零 initializedAt”扩张到所有一次性测试库 legacy 运行，超过了该边界；本裁定仅在本轮 disposable `_test` 中纠正该要求。无需修改核心 collector、加入框架、预置假 initializedAt、执行后清除 cursor 或改写源数据。测试数据与 cursor 不复制/导入正式或 preview 库，不用该库进行后续增量采集；保存审计证据后保留为隔离测试事实。

## 唯一允许的来源、fixture 与请求

只有 `mof-fujian-supervision-dynamics` 一条测试 source，enabled=false、site_fulltext=false、syndicate_fulltext=false。从现有福建配置复制，保留所有日期、标题、正文规则与严格正文就绪策略；仅在隔离 fixture 中收窄 `_aihot.initialBackfillLimit=2`、`detail.maxFetches=2` 及候选 allowUrlPrefixes 为下面两条完整详情 URL。这两个 prefix 是现有解析器的候选过滤手段；它们不替代派发边界上的精确 URL 等值校验。fixture 差异须逐项保存，不回写 industry/sources.json，不增加 pagination。

仅允许 GET 以下三条精确 URL，origin 固定 `https://fj.mof.gov.cn`，目录固定 `/gzdt/caizhengjiancha/`，无 query/fragment/credentials/异常端口：

1. `https://fj.mof.gov.cn/gzdt/caizhengjiancha/`
2. `https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm`
3. `https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260817_3995605.htm`

一次 direct legacy invocation，最多一个列表、两个候选、两个不同 HTML 详情；候选必须来自本次列表且精确等值匹配。零匹配即只保留列表观察，不补 href 或请求；一条匹配最多处理一条，不为凑数量扩张范围。正文只走现有静态 `.my_doccontent` 规则，不执行页面脚本。第二条详情仅批准 HTML 本身，不批准其相邻 PDF；发现附件链接只保留原链接、待解析状态，不下载或自动精选。缺失/异常日期、身份/正文不符、未知响应均记录有限失败/未决事实，不人工补日期或正文。

总上界 **12 次 actual network dispatch，包含每个 redirect hop、超时和失败派发**；默认无跳转应至多3次。无重试、并发、分页、追加来源、附件、API/XHR、Jina 或其他网络。最小允许实现可以直接拒绝所有 redirect；若支持 redirect，每跳也只能是上面精确 URL 且保持本次 list/article 身份，不能把剩余额度用作新的目标内容请求。全程保留现有 SSRF/DNS、字节和 timeout 防护；非 HTML 响应不得被包装成正文成功。预算/目标拒绝即使被 legacy detail best-effort catch 吞掉，独立 manifest 仍必须显示拒绝与不完整结果，不能据 collector=ok 覆盖它。

## Executor 必须在真实派发前证明的事项

这是执行前置条件，不要求新的核心实现或新分页 opt-in。executor 可以复用现有 P3-only instrumented runner，在隔离的一次性进程中添加最小局部目标/响应防护；不把这种 instrumentation 加入常驻 backend。现有 `installP3HttpBudget` 只提供累计预算，不提供精确 URL 或 Content-Type admission，不能单独声称已满足本裁定。

- 解析本轮 fixture 与源配置，证明 pagination 缺省、HTML-only，无 PDF/附件 helper/Jina/adapter；候选 cap=2、detail cap=2 及完整精确 URL 集实际生效。证明新列表不会把其余八条材料存入库，URL prefix 后缀变体也不能派发。
- 使用纯 fake transport 或独立 loopback preflight，证明预算在实际 backend Undici dispatch 前扣除且覆盖列表、详情、redirect；cap canary 的超额请求为0实际派发，错误 host/path/method、附件/未知目标、身份改变及回环均在派发前拒绝。响应 Content-Type 校验不能仅发生在材料写入后；非 HTML canary 不进入正文/成功材料处理。
- 证明运行使用 backend pinned Undici 及被 instrument 的 Agent 路径，没有 Node global fetch、其他 Undici 副本或 ALLOW_PRIVATE_NETWORK_FETCH 绕过。已有脚本的诊断事件是观察证据，禁止在 diagnostics_channel callback 中抛错来实现阻断；必须使用真正的派发边界 guard。禁止为现场方便关闭真实请求的 SSRF/DNS。
- preflight 与真实 run 分开计数，真实预算从0开始；安装、卸载在本进程内完成。保存 per-request admission/dispatch、URL、method、redirect、响应状态/类型/最终URL、raw bytes/hash、错误/拒绝和真实计数。退出前无在途请求；失败不自动续跑。
- fresh `_test` 连接身份及数据初态须核验；不接生产/preview。worker/API/服务/scheduler、模型/provider/API OCR/本地 OCR、推送均不启动，所有相关开关关闭。`force:true` 只绕过这条 disabled 测试源，不是全局采集授权。

任一项不能证明就停在 preflight，不请求官方站点；root 对本次最多12次真实派发另作一次核销。既有用户允许适量小规模实际测试支持此范围，不需要为 initializedAt 的隔离记录再次向用户请求授权。

## 终检与证据边界

只读终检记录：唯一测试 source 仍 disabled/全文关闭；最多两篇材料；列表原始显示日、详情解析值、实际保存日期、URL/path token 分开列出，不将日期一致性推广为全源权威。记录正文 ok/pending/unconfirmed 及真实附件缺口。记录 fetch_run、所有 cursor 字段及队列计数；legacy 可创建分析/抽取队列项但不得消费，worker/job_run=0，analysis/receipt/publication/selected 写入=0，attachment dispatch=0。

报告明确 `legacyInitializedAtObserved=true/false`（仅文档/manifest 注记，不新增库字段）、`coverage=unproven`、`limitedSample=true`、`sourceAdmission=NOT_ADMITTED` 和 Gate2=NOT_PASSED。如 legacy 返回 ok 而详情拒绝/失败，保留 ok 原值并独立标记样本 partial，不篡改历史、补跑或声称覆盖完整。始终保存原始成功/失败事实；本裁定未批准90日完整性算法、正式来源迁移或生产采集。

### enqueue-only PgBoss 生命周期澄清

另只读核对实际 `jobs/queue.ts` 与 ignored `p3-fujian-small-20261006/run-once.mjs`：正常 `enqueue → ensureQueue → getBoss` 会调用 `PgBoss.start()`；这属于现有入队客户端初始化，允许在该 fresh 隔离 `_test` 库内正常发生，包括 PgBoss 自身的 schema/内部维护生命周期。本文“scheduler/worker 不启动”指应用采集调度器和应用业务 worker；不禁止 enqueue 所必需的 PgBoss 内部维护，不要求 fake queue 或修改共享 backend。

runner 不得注册 `.work()` 业务处理器、调用 `.schedule()`/应用调度入口或加载应用 worker 启动入口。content 队列项只入队、零业务消费；终检应列出其状态及 started/completed 等消费字段以证明未执行，不只给总数。应用 job_runs/analysis/receipt/publication/selected 写入仍为0，模型和外部服务仍为0。PgBoss 内部维护不能被报告为应用 worker/scheduler 已运行或业务验证通过。正常结束及异常清理调用现有 `stopBoss()` 后关闭 DB；runner 目前的正常结束和 finally 均包含该清理。此处仅澄清既有队列生命周期，不放宽请求、来源、候选或业务执行额度。

FILES_CHANGED=仅 docs/fiscal-finance/S1_P3_LIMITED_LEGACY_COLLECTION_SCOPE_2026-10-06.md。
TESTS_RUN=未运行；只读文档与实际实现审阅。
RISKS=legacy ok/initializedAt 容易被误当覆盖完成；detail best-effort catch 可能掩盖拒绝；固定候选可能已离开当前首屏；HTML容器不保证正文可用。由隔离、raw审计与独立partial声明约束，来源级风险仍未闭环。
BLOCKERS=initializedAt 不再是此次隔离 legacy 测试的架构阻塞；executor 的精确 URL/响应防护及 per-dispatch preflight 尚待证明；root run 核销尚待完成。Gate 2历史/日期/正文/跨周期阻塞保持。
NEXT=executor 做最小隔离 runner/preflight 并交 QA/root 核对；满足上述条件后执行一次有限run和只读终检。本审查没有核销或实施任何真实请求。
