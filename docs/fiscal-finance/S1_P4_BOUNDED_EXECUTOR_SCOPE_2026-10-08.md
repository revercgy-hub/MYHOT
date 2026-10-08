# S1：P4 一次性有界执行器范围审查（2026-10-08）

**RESULT=APPROVED_SCOPE。** 批准下述最小实现及离线/loopback 软件验证范围，交给 Luna High 执行。现有实现不能直接用于用户提议的“串行两篇、失败即停、不自动重试、不发布”冒烟；需要少量 `packages/backend` 兼容点。此结论不是实现验收、真实模型执行授权、Gate 2 重审或 P4 质量通过。20/10 次请求上限仍待用户决定；本审查不选择额度、不读取密钥、不修改数据库或开关。

审查基线：`feat/fiscal-finance-hot`，HEAD `fad270a2dce1ed6ef953f7fc20c6430d5e98f492`。静态读取 AGENTS、README、PROJECT_PLAN、STATUS、GATE_2_REVIEW、P4_PILOT_READINESS，以及实际 planner、analysis/input/models、jobs/content/queue、LLM/receipts 代码。`P4_PILOT_READINESS.md` 当前已有未提交修改，保持原样；本文独占新增路径。

## 代码裁定与既有处理链

| 路径 | 实际行为 | 本次可否直接使用 |
|---|---|---|
| `scripts/fiscal/p4-pilot.ts` | 只读 manifest；容量快照未 reserve；不执行 analysis | 继续作准备器，不能把 ready 当运行授权 |
| `registerContentJobs` / `processArticle` | 普通 handler 调用 `analyzeArticle`，随后 publish、可能 enqueue group；failure/reschedule 与 pg-boss 均有重试路径 | 不可启动普通 worker、注册普通队列或直接调用 processArticle 来冒烟 |
| `analyzeArticle` | load 当前输入；attachment/body guard、waitsForPage；复用 runAnalysis；正常提交 analyses/processing_state 并 complete receipts | 复用这个既有 analysis 段，增加窄 opt-in 执行合同 |
| `runAnalysis` | 没有 article 入口 guard；structure 与 scores 并行，structure 失败可在 writer 完成后才暴露；评分内容过滤会变 refused，understand 拒绝可转 summarize | 不允许 CLI 直接调用它取代 guarded analysis；需要 opt-in 串行严格停止语义 |
| `chatJson` → `paidRequest` | 每 attempt 一次 fetch；先持久化/count attempt，再 POST；service advisory lock 下检查 minute/hour/day；failed 后下一次调用可重付，unknown 不自动重发 | 原样保留；禁止自写 fetch/SDK、绕 receipts、恢复 unknown 或再次执行失败链 |

Gate 2 的“既有内容处理路径”和“模型调用继续经过 worker”可由一次性专用 worker 入口满足：CLI 只读取/校验冻结合同并调后端 jobs 层窄 handler；该 handler 复用 `analyzeArticle → runAnalysis → chatJson → paidRequest`。它不启动常驻普通 worker、不注册 pg-boss、不启 scheduler/sweeper。这是既有 worker analysis 段的受限调度，不能仅把一个直调 `runAnalysis` 的脚本改名为 worker。无需修改 apps、industry、数据库 schema、普通队列默认策略或发布层。

## 允许的最小变更

1. 新增独立 CLI（例如 `scripts/fiscal/p4-execute.ts`）和后端 jobs 层一次性 handler（例如 `packages/backend/src/jobs/p4-pilot.ts`）；准备器保持只读、无自动 execute。CLI 默认拒绝执行，必须收到具体冻结 manifest、明确执行确认参数、经用户确认的 20 或 10 上限和实际运行授权；不能用预算选项代替用户授权。
2. 在 `analyze.ts` 增加窄、显式、默认关闭的 bounded opt-in：严格按 prefilter → score1 → score2 → structure → writer 顺序执行；任何 provider/parse/budget/receipt/DB 错误立即向上抛出。该模式下内容过滤/拒绝同样终止，不继续第二评分或 summarize fallback。合法 BLOCK 是正常结束；低分进入既有 summarize 分支不是重试。普通 analysis 的并行、内容过滤与 fallback 语义保持现状，不调整评分门槛、prompt 或双评分规则。
3. 对 `analyzeArticle` 增加预期输入约束，将 id/revision/content hash 与实际加载的同一份输入绑定，在首次 provider 调用之前校验；提交前再校验 revision/hash。按需在 `input.ts` 的同一次 SELECT 返回 hash/必要元数据，避免“先校验旧行、再重新加载新输入”竞态。既有 attachment/body guards 必须继续生效，bounded 模式额外要求所有源正文 ok、trim 非空、editorial；missing、needsBody、skippedReason、stale、无 output 均是停止结果，不触发抽取或队列。不得通过改 bodyStatus、清诊断或 fabricated input 释放 guard。
4. 在新 jobs handler 实施 exact allowlist、独占执行、冻结输入/配置重核及一次性结果清单；每篇只调 guarded analysis 一次，任一步异常立即停止剩余文章。不 catch 后续重跑整链，不更换 attemptTag 重付，不操作 admin recovery，不把非模型阶段失败当作模型重试原因。正常结果保留隔离库 analysis/receipt 证据；故障保留已收响应/unknown/failed，不删除或重置账目。结果报告落盘失败也不得重新调用 analysis。

若实现需要超出这些文件的 provider 重试框架、通用 task runner、schema、新 endpoint 或全局 worker 改造，停止该扩展并提交具体证据另审。

## 首次两篇执行合同

来源和文章 ID 不可混用。当前 ignored manifest `.data/fiscal-p4-pilot/gate2-p4-isolated-two-20261008.json` 的 SHA-256 manifestHash 为 `080620c962fecaa07ec8452d997ba60de0a4b694dfa7354e6378b13282fcbd31`，候选如下；这里只核对保存文件，不证明数据库现状。

| 顺序 | article ID | source ID | revision | contentHash = revisionContentHash |
|---|---|---|---|---|
| 1 | `p4prep_treasury_20261008` | `mof-treasury-debt-data` | 1 | `88017464a38e35078e6b4ef1843255a1f50a63952d685aa354489cee76700c11` |
| 2 | `p4prep_omo192_20261008` | `pboc-open-market` | 1 | `a1bcfc5973a0fba355317c42893e3ba5cb2f9934327943509700b2027313adaa` |

- 新 fresh 隔离库，只接受 loopback PostgreSQL 且名字严格 `_test`；执行时核 current_database。不得复用 preview/production/P3 旧 jobs 或 receipt。允许执行阶段在专用库作必要 seed/config/analysis 写入，本次审查没有进行这些动作。保留真实 published_at/backfill、URL、正文、来源身份，seed 不做 HTTP、不抽附件。全部 source disabled、全文许可 false，collector/外部推送开关关闭。
- 冻结并重核 prompt versions、五个 capability 实际 model key/service/model slug/base endpoint/extra、source 配置和输入元数据。全部解析为用户所选 `deepseek-flash`、同一 service 与 endpoint；`default` 路由是 service `llm`，named preset 是 `deepseek`，不能只按展示名设置预算。不读取/输出凭证值；credential 注入留给获批执行。不得静默用 registry fallback 或 admin override 切换另一供应商。
- 本次仅文本。拒绝含 image media、xPost/quoted media 等可能进入 `firstImagePart/produceImage` 的输入，确认无图像下载、image fallback 或附加 HTTP。除了获批 provider POST，不允许其他真实外部请求。无图 strict fail-stop 链每篇最多 prefilter 1 + score 2 + structure 1 + writer 1 = 5 次，两篇最多 10 次；BLOCK/低分等可减少。旧 planner 的普通 6 次/篇包含 fallback，不能作为 strict 执行的已验证保证。
- 在 dedicated fresh 库实际 service 的 budgets 中强制存在非零有限行，per_day 为用户选择的 N，minute/hour 不得放宽成无限；baseline live attempts 为 0，其他 service 不得被执行。receipt 原有锁及 attempt 计数保留。缺预算行会 unlimited，因此必须拒绝。executor 同时固定最大 N 与有限单次运行时长（小于24小时），不等待预算窗口回补、不换 service；超额/配置漂移停止。此为请求数量 cap，金额和 token 费用未知。
- 拒绝其他 worker/API/admin/scheduler 同库活动、目标相关 created/retry/active jobs、processing retry/failed、已有 analysis/attempt、pending/unknown receipt；专用一次性互斥锁避免两个 executor 并发。心跳快照不是独占证明，必须配合进程/连接核验及禁止另开普通 worker的执行管理。提交前发现 drift 即停止并保留证据；不持长事务跨模型请求。
- 不 publish、不 group/digest/translate、不 sweeper、不 queueProcessing、不 extract、不 collect、不 ops.recover。同 run 标识及完成/失败结果不得自动再次执行；发生 crash/unknown 保留隔离库待人工核销，不自动重开 fresh 库或新 attemptTag 来“恢复”。

## Gate 2 负例要求的正式解释

`GATE_2_REVIEW.md` 明文：“P4执行前……准备完成后冻结样本集合”，并规定“小样包括业务正例及已知内部活动负例”。`P4_PILOT_READINESS.md` 页首后来的“首次两篇冒烟不以内部活动负例为前置条件”不是正式 Gate 裁定，与前者冲突时不采用。

因此内部活动负例是获批 P4 固定小样集合的必备组成，不得宣布纯 Treasury+OMO 两篇就是合规完整 pilot。可以把两篇作为该集合的第一批执行：在首次付费调用前，Lead 必须先逐篇核验并冻结一个来自已准入厦门监管局的真实负例及后续独立请求边界；首批 executor 仍只接受上表两 ID，不自动增第三篇、不共享首批付费额度。负例不必与首两篇同一次进程付费执行，但不能把其身份/正文核验和冻结无限推迟到两篇之后。不存在合格负例时，软件实现和 loopback QA 可继续，真实执行准备尚未闭环；这不回滚 Gate 2 已通过的有界来源结论。禁止制造已付费负例结论或将待人工标签称为 Gold。

## Luna 实现后的最低验证

本审查不运行测试/CI。实现后按 AGENTS 完成适用的软件 QA：typecheck、fresh loopback `_test` backend tests、Web build/tests，运行站点后仅 loopback smoke；任何 CI 派发由 Lead 既有授权安排，不能据本文启动真实服务。focused fake-provider integration 必须证明：精确两 ID 顺序及每阶段串行；revision/hash/source/body/attachment/media/model/budget/重复执行拒绝均为0 provider POST；5/篇上界与第 N+1 attempt 阻断；429/5xx、unknown timeout、拒绝、parse/structure/写库错误后无后续请求/第二篇/重试；receipt先于POST、raw先于analysis；analysis commit/报告失败不重新收费；0 publication/group/jobs/sweeper/collect/额外HTTP。原默认路径的并行/fallback/guard 回归保持通过。fake provider 只用 localhost，真实MODEL_CALLS仍关闭。

QA 结果必须关联最终代码SHA，分别报告实现验证与未来付费实测。首次真实调用还需用户明确额度、安全配置 key、重新冻结运行合同、满足上述负例准备并由Lead核销；本文件不声称这些已经完成。

**TASK**：窄 S1 P4 bounded executor 架构及最小 packages 兼容点审查，不重做 Gate 2。

**MODEL**：本任务为父任务指定的 S1 审查代理；未请求任何项目模型/provider，项目付费请求 0。

**FILES_CHANGED**：仅新增本文；未改业务代码、其它文档、配置、Git index 或数据库。

**TESTS_RUN**：仅静态文件读取、保存 manifest 指定字段及只读 Git HEAD/status 核对；测试、CI、HTTP、worker、DB 操作、secret 读取均未运行。

**RESULT**：APPROVED_SCOPE；Luna 可实现一次性 jobs handler + guarded analysis opt-in；现有普通 worker/direct runAnalysis 不能直接满足合同。

**RISKS**：预算仅滚动数量 cap；金额未知；snapshot不是独占或完整输入保证；并发/回退/失败重入必须由上述合同和软件QA消除。两篇结果不证明Gold、聚类、全源质量或P4完成。

**BLOCKERS**：无实现范围阻塞；真实执行仍待20/10额度授权、credential、最终SHA QA、重新冻结合同和合格内部活动负例准备。

**NEXT**：Lead交Luna High按范围实现并独立QA，核销负例准备文案冲突；保留正常运行开关关闭，待具体调用授权后再决定首次执行。
