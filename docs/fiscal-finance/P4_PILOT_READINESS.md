# P4 精选试点只读准备器

## 2026-10-10 P4质量审阅准备（当前；模型质量尚未运行）

**P4实际质量状态**：没有真实provider执行、没有人工Gold标签、没有P4内容质量结论。用户选择暂不付费，DeepSeek执行继续 `DEFERRED_BY_USER`；offline review工具不会替代模型运行或Gold标注。历史packet exporter精确SHA `2664e1fa817d9f1242fc9b227d3bbcde6b1b8d66`（backend357/357、Web15/15；Check+Docker run [37942455582](https://github.com/revercgy-hub/MYHOT/actions/runs/37942455582) success）是前一软件基线。本工具冻结工作树在运行时HEAD `1f30ee1`时通过fresh 35-migration QA（backend362/362、typecheck、focused5/5、Web build/Web15/15），相同冻结内容随后提交/推送为 `0b372dae2202c42ddc52535454c239bc8e592856`；GitHub Actions run [38016328910](https://github.com/revercgy-hub/MYHOT/actions/runs/38016328910)对精确headSha完成，Check job 114107294320与Docker job 114107294619均success（Check typecheck、Web build/tests、migrate+seed、built-site smoke、backend tests；Docker build+smoke）。

## 2026-10-10 人工review结果sidecar（软件QA/CI完成）

独立脚本 `scripts/fiscal/p4-quality-review-results.ts` 提供 `template <execution-report.json> <article-analysis-metadata.json> [--out results.json]` 与 `validate <execution-report.json> <article-analysis-metadata.json> <filled-results.json> [--out issue-ledger.json]` 两种离线命令。独立QA在fresh `p4_quality_results_20261010_test`完成35 migrations，冻结运行HEAD `6a808c7`，两目标文件起止SHA稳定、pre业务计数0、真实P4执行0；typecheck、focused 8/8、backend 370/370（0 fail/skip）、Web build和Web 15/15全exit 0。日志位于`.data/fiscal-qa/p4-quality-results-qa-20261010/`。相同冻结内容随后提交/push为`0b3cec2b2d155ee57adb908fc477f0737b556ad9`，不得将QA runtime HEAD写成该commit。ignored synthetic `results-template.json`和`draft-issue-ledger.json`均用实际CLI exit 0：1条模板/ledger记录的四维 judgment/reason、reviewer与reviewedAt全null；ledger状态`DRAFT_INCOMPLETE`、pending1、issues0、systemClustering`NOT_RUN`。该精确SHA的GitHub run [38016781363](https://github.com/revercgy-hub/MYHOT/actions/runs/38016781363)已对headSha匹配并完成；Check job 114108703432与Docker job 114108703289均success，Check内typecheck、Web build/tests、migrate+seed、built-site smoke、backend tests均success，Docker compose build+smoke success。此前SHA `0b372dae2202c42ddc52535454c239bc8e592856`及CI `38016328910`属于上一阶段。

模板/结果schema为`fiscal-p4-quality-review-results/v1`，ledger为`fiscal-p4-quality-issue-ledger/v1`。每条review须与report及metadata逐项匹配`runHash`、article ID、source ID、revision、contentHash和analysis ID；四个维度`facts`、`contentType`、`taxonomy`、`scoring`从空`judgment/reason=null`模板填写（前三维可选accurate/partially_wrong/wrong/unable_to_judge，scoring可选reasonable/too_high/too_low/unable_to_judge），并提供reviewer及显式时区、有效日历日期的reviewedAt。校验输出只保留白名单字段并丢弃额外字段。`DRAFT_INCOMPLETE`保留已填reviews且pending数量可见，但`qualityIssues`为空；仅字段完整时标记`REVIEW_COMPLETE`并产生结构化issue ledger，这只表示审核表填写完整，不表示模型或内容质量通过。该sidecar不生成Gold、质量指标、阈值判断或Gate变化，也不执行系统聚类。

**质量报告缺口与获准准备范围**：只读审计确认，当前P4 execution report及P5 Gold packet没有呈现模型生成的中文短摘要、topic/category、评分细节或fact frames，因而不能作为这类输出的人工审阅面板。Root已批准只新增独立 `scripts/fiscal/p4-quality-review.ts` 与其专用测试，用现有redacted article/analysis metadata生成本地离线review report。输入关联必须强校验article ID、source ID、revision、content hash和analysis ID；输出只允许白名单字段及模型短摘要/评分/fact frames，并提供空白人工审查栏。不得读取数据库、正文、receipt response或凭证，不调用模型，不写回、不自动做事件聚类判断、不导入Gold。工具owner报告冻结实现的typecheck、focused 5/5和diff check通过。独立QA在新fresh `p4_quality_review_20261010_test`确认35 migrations，typecheck与P4 focused 5/5通过，backend全套362/362（0失败/跳过），Web build及Web tests 15/15通过；日志保存在ignored `.data/fiscal-qa/p4-quality-review-qa-20261010/`。QA运行时HEAD为`1f30ee1`，其验证的冻结实现随后由code owner提交为`0b372dae2202c42ddc52535454c239bc8e592856`；不能表述为运行时HEAD即该commit。GitHub Check+Docker run [38016328910](https://github.com/revercgy-hub/MYHOT/actions/runs/38016328910)已对精确`headSha=0b372dae2202c42ddc52535454c239bc8e592856`完成，Check job 114107294320与Docker job 114107294619均success。Producer/reviewer共享schema版本，article ID映射与source ID/revision/contentHash/analysis ID关联逐项匹配并强校验；输出限白名单元数据和空白人工栏，不含正文/bodyRef/receipt响应/凭证，不读数据库、不调用模型或写入Gold。环境日志有一条正则把`DATABASE_URL`子串误当`BASE_URL`的误报；独立核验确认provider key/base URL/model配置和代理均0、凭证目录不存在、`P4_EXECUTOR_INTEGRATION_TEST`未启用。曾复用旧Gold packet QA环境的357/357报告已被Root拒绝，不属于本工具QA结果。合成演示表位于ignored `.data/fiscal-qa/p4-quality-review-demo-20261010/review.md`，明确标记`SYNTHETIC`，只展示格式和白名单字段，不含真实文章/模型结果。本结果仅验收离线审阅软件合同，不是P4内容质量、真实模型、Gold或Gate通过。

**软件故障用例的去重说明**：截至10月9日，N+1/receipt预算、静态20-cap、动态第9次attempt上调、analysis/receipt事务提交失败和final report写失败已分别有隔离fake/`_test`证据，详见本文10月9日当前节与连续P3 handoff。无需把这些已记录用例重复写成新的P4质量工具待办，也不得把它们泛化为全部executor failure paths已覆盖；全局currency/token硬上限与其它未实测failure semantics仍未证明。五项revision/hash/media/source-config/provider输入漂移有各自0-POST拒绝测试，同样不能替代模型输出质量检查。

**人工确认与外部质量边界**：8条Gold `humanAnnotation`仍为null/`needs_review`。领域人员仍须决定每条select/reject/either、event group、development/holdout split、annotator和确认时间。review report中的fact frame只供人判断，事件同一性判断必须留空待人填写；没有Gold或模型输出运行，不计算质量/校准指标。来源级日期、覆盖和正文质量不能由有限候选或离线报表外推。

## 2026-10-09 当前免费软件验证状态：本地QA与精确SHA CI通过

浙江 pagination source/config SHA `6668c70da306473977eb55c3b6073be3d5fd535f` 已包含仅该disabled entry的既有HTML pagination opt-in、保存fixture及config test。Sol scope为 `APPROVED_SCOPE`，仅批准该单entry离线配置验证，不授权collector或新的HTTP。fresh `fiscalhot_zhejiang_finalqa_20261009_test`完成35 migrations、61 tables；typecheck、backend 351/351、Web build、Web tests 15/15及浙江focus 5/5通过。P4 opt-in保持unset；source仍disabled、fulltext关闭，collector/worker/provider均未运行。此次local smoke未运行。唯一GitHub Check run [37935221740](https://github.com/revercgy-hub/MYHOT/actions/runs/37935221740)精确绑定该SHA；Check job 113835474656与Docker job 113835474297均success；CI内置smoke也通过。软件结果不代表P4内容质量、source admission、90日覆盖或Gold评估。

### 已完成的 P4 离线故障与预算软件验证

以下均为严格MockAgent/隔离`_test`库软件验证，不调用真实provider，不构成内容质量评估或付费执行授权：

- 五项输入漂移：article revision、content hash、media、source configuration、provider model。各自fresh 35-migration数据库focused 1/1，均为0 provider POST、无执行report；test-only SHA `b0a0eeb59e19c696b94e045d2d6d3dcb08a69ea1`的Check+Docker run [37743439955](https://github.com/revercgy-hub/MYHOT/actions/runs/37743439955)通过。
- N+1/receipt预算：fresh `fiscalhot_p4budget_n1_20261009_test`完成35 migrations，fake POST 9次（5 completed、4 received），1 analysis，结束时report reservation为空；相同输入重跑0 POST。
- 静态20-cap case：focused 1/1，replay 0。该case没有在活动运行中修改预算，不单独证明预算漂移。
- 动态上调：以CLI max=10开始，在第9次attempt触发minute/hour/day预算由10升至20；fresh `fiscalhot_p4budget_up_drift_final_20261009_test`完成35 migrations，integration 1/1、typecheck通过。结果2 articles、2 analyses、10 receipts status=completed、10 receipt_attempts status=received、10 fake POST、report maximum 10、replay 0。首个动态harness曾hung且无receipt，进程已停止；该失败留作harness历史，不是产品缺陷。budget test-only commit `e97b02bd303116c739caeb983c00e9ba2ff7b49c`未单独跑full suite。
- Analysis/receipt事务提交失败：fresh `fiscalhot_p4persist_commit2_20261009_test`完成35 migrations，5 fake POST、5 received receipts/5 attempts、0 analyses/0 completed receipts，report为0B；重跑0 POST。
- Final report写失败：fresh `fiscalhot_p4persist_report2_20261009_test`完成35 migrations，10 fake POST、10 completed receipts/10 attempts、2 analyses，report为0B；重跑0 POST。上述两类失败均没有fetch/publication/selection。

这些case验证有限的请求/receipt和写失败路径；未验证全局currency/token hard cap，也未建立真实模型质量、人工Gold、source质量或正式P4通过结论。P4软件裁定保持 `APPROVED_SOFTWARE_FOR_OFFLINE_QA_ONLY`。付费执行仍`DEFERRED_BY_USER`，Gold人工标签仍未完成。旧queued/pending检查点保留为历史，不再表示以上软件case待实现。

## 2026-10-09 continuation 本机QA完成，GitHub Check queued（历史快照；终态见文首）

Source commit `15e3464c0bff45af96e52514b831f2aba8fc6043`已推送且remote ref匹配。本机结果：focus6 55/55、focus7 typecheck + integration 1/1、fresh full2 35 migrations / backend 346/346 / Web build / Web tests 15/15均通过。单次GitHub Check [37905438753](https://github.com/revercgy-hub/MYHOT/actions/runs/37905438753)已确认`headSha`为上述commit；此段记录生成时仍queued，后续Check与Docker均已success（见文首）。

DB integration只涉及2次list、零details，未覆盖并发collector或真实wall-clock timeout；7/5仅unit。没有新HTTP、preview写入、服务操作、provider或付费调用。docs暂不提交，待CI最终结果及Root检查。

## 2026-10-09 GovCN continuation 最终本地QA结果（远端CI待新代码SHA）

Root已接受范围修复。focus6 broad为55/55；focus7的typecheck和fresh integration为1/1。唯一full2使用fresh `fiscalhot_govcn_resume_full2_test`，35 migrations后backend 346/346、Web build通过、Web tests 15/15。full1的单一失败属于旧analysis全库计数导致的测试隔离错误；article/source过滤修复只改QA测试，历史结果保留。

DB integration只执行两个list请求、零detail；未测试并发collectors或真实wall-clock deadline。软件结果不构成live coverage或90日完整性。Source owner正提交5个code/test文件；待收到准确code SHA后，对feature branch只派一次Check并按run headSha核验。此前不提交文档；无API/preview、HTTP、paid/provider、worker或smoke操作。

## 2026-10-09 continuation full-suite isolation correction

Backend full1为346项、345通过/1失败；唯一失败是新integration test对全库analysis做计数，受其它测试合法写入影响，属于测试隔离断言问题，不是runtime/provider故障。QA只修改该测试：analysis按当前article/source关联统计，receipt按article ID核对。fresh `fiscalhot_govcn_resume_focus7_test`的35 migrations、typecheck、新integration 1/1均通过。唯一full2正在运行，full1失败仍保留；full1未跑Web build或Web tests。

full2只有在Root明确确认通过后才收尾；之后对最终代码SHA最多dispatch一次GitHub Check，明确仓库为 `revercgy-hub/MYHOT`，feature ref为 `feat/fiscal-finance-hot`。当前不提交或dispatch CI，既有source仍未准入。

## 2026-10-09 GovCN continuation 最新QA：focused通过，full pending

Lead指出的首轮p2/backfill标记、事务内semantic hash、完整cursor CAS缺口现已由Luna修复。最终focused测试55/55及typecheck通过，fresh DB `fiscalhot_govcn_resume_focus6_test`迁移35项；独立唯一full suite已启动，尚无结果。fresh DB实际覆盖maxDispatches=2、0 details；7-dispatch/5-detail预算只通过unit验证。事务证据包括material、queue、source cursor更新及deferred fetch_run的COMMIT/ROLLBACK/replay；另核了rolling/fixed anchor、semantic drift和mode=0拒绝零HTTP。此前focus1–5的失败来自测试fixture、log-slice、旧48h断言、hook或expectation，不是runtime错误，历史记录保留。

实现当前未冻结、未提交；full suite未完成前不提交、不派CI。没有新官方HTTP、preview写入、provider/collector/worker/OCR或本机服务操作。来源仍48/42、全disabled/fulltext-off且未准入；90日历史完整性与新Gate通过均未声称。

## 2026-10-09 GovCN durable continuation 审查反馈（实现中，QA未通过）

上一版GovCN无resume软件和独立QA仍是通过的基线；本次新增durable continuation实现尚未冻结。Lead review指出：首轮回填缺少p=2、没有初次backfill标记、semantic identity hash未在事务内生成、cursor CAS不完整。Luna正在修复并协调独立QA；以上均为待关闭缺口，不记录成已解决。

工作树中的 `collect.ts`、`json-list-pagination.ts`、`json-list.ts`和新resume测试/S1文件是未冻结改动。没有新HTTP/DB写入、provider、collector、worker、OCR或本机服务控制；本机旧preview/历史真值不重查。现有来源仍48/42且全disabled/fulltext-off、未准入；本轮不宣称90日完整或新Gate通过。

## 2026-10-09 本轮起始状态（已由下方最新事实修正）

当前工作从 `b9e62d7e1b9e89859954c4c38a16c22e84302488` 开始。GovCN JSON query pagination 的 S1 scope 为 `APPROVED_SCOPE`，不是代码/QA通过、source admission或source pass。获准实现仅对 `govcn-policy-library` 增加每次从p=1开始的stateless有界扫描：最多2页、总dispatch/detail限额和120秒deadline、无resume，并在已有run detail中始终标记partial与coverage unproven。Ignored packet `.data/fiscal-qa/govcn-pagination-20261009/` 已准备精确p=1/2/3 URL与3-dispatch、20s/request、60s total、6MiB/request、18MiB total、无redirect/retry的runner；MockAgent干跑3/3 intercepted (p=1 uses saved response; p=2/3 synthetic clones), 0 rejected。它只验证本地packet/预算路径，不是新source code QA或fresh evidence；真实GET尚未执行，需独立软件QA PASS与Lead最终接受后才运行。

当前目录仍48 sources / 42 exact strict IDs，全disabled且全文关闭；用户已明确真实付费执行延期。上一代码测试修复SHA `bb02255051bedc3470eaf60add6723662e1df6ce` 的Check+Docker #37758646045 green；本轮待新实现冻结后才做独立QA，并按root授权对最终新代码SHA dispatch一次GitHub Check。无provider调用、官方HTTP、collector、worker或本机API服务控制。

DATE=2026-10-08（Asia/Shanghai；本节更新）
STAGE=P4 bounded pilot preparation / model execution not started
GATE_2=PASSED_FOR_BOUNDED_P4_PILOT（仅限Gate_2_REVIEW中的逐篇合格文章）
MODEL=DeepSeek V4.1 Flash（DeepSeek API model slug: deepseek-flash；用户已选择）
MODEL_EXECUTION=NOT_RUN；PAID_EXECUTION=DEFERRED_BY_USER；MODEL_CALLS_ENABLED=false；COLLECT_ENABLED=false；未配置真实API key
BUDGET=用户决定目前先不付费；20/10次数选择不再是当前阻塞，不追问；无预算预留或真实调用授权
LATEST_SAMPLE=隔离库 fiscalhot_p4_preparation_20261008_test；Treasury 1、PBOC OMO 1；厦门监管负例另存ignored候选且尚未冻结
GOLD=人工标签仍为null/needs_review；未形成Gold Dataset或模型质量结论
EXECUTOR_STATUS=bounded executor代码SHA `57647d954ac56f4269b89adf0cc184a36b530ee0`；五个输入漂移集成场景test-only SHA `b0a0eeb59e19c696b94e045d2d6d3dcb08a69ea1`及CI run37743439955 Check+Docker均成功。NFRA implementation code SHA `e09d7cb5c2b3f4c3130e2bbe63721475b8f53cb1`独立fresh35-migration typecheck/backend334/334/Web build/Web15/15通过；其首次CI #37757946149旧测试误要求`ALLOW_PRIVATE_NETWORK_FETCH=false`环境字符串必须显式存在（workflow未设置；配置默认false）。Test-only修复SHA `bb02255051bedc3470eaf60add6723662e1df6ce`的Check+Docker #37758646045成功。post-code local preview smoke未运行。其它fault cases仍待覆盖，不宣称完整fail-path验收。

## 2026-10-09 GovCN 分页当前事实修正

上方“分页实现中”是本轮开始时的历史快照；现代码SHA为`7372d47a1d6d71b81b735e4b8025158e672233eb`，已推送。独立软件QA为focused 51/51、typecheck、fresh 35-migration persistence 1/1、backend 342/342、Web build和tests 15/15。GitHub Check+Docker run [37881613214](https://github.com/revercgy-hub/MYHOT/actions/runs/37881613214)针对该SHA最终success。Root接受的独立三页观察完成3/3 HTTP 200、15条不同URL；`searchVO`当前页/总量字段全为0，不据此宣称terminal或历史覆盖。响应实体SHA和packet根路径修正见continuous handoff。GovCN仍disabled/unadmitted，源目录48/42 strict；产品maxPagesPerRun仍为2。付费执行仍`DEFERRED_BY_USER`。

Root接受的独立packet只读执行一次：p=1/2/3精确GET，3/3 HTTP 200、JSON/code 200、总实体102,489 B、15行/15个不同URL、paramsVO页码和n值匹配、dispatch 3/3/0。服务的`searchVO.currentPage/pageSize/totalCount/totalpage`均为0，不能证明total或terminal。raw实际在packet根目录`page-N.body`，不是声明的`responses/`；三份manifest basename、原始响应、one-shot marker与gate均保留，路径修正单独记在ignored `artifact-correction-v2.json`。详见continuous handoff的hash明细。

这次三页观察不改变产品配置maxPagesPerRun=2，不是90日历史或来源准入。48个来源/42个strict ID仍全部disabled/fulltext-off；Gate 2边界和P4准备状态不变。未运行模型/collector/worker/OCR或DB操作；本地post-code smoke未执行。用户已延期付费provider执行。

## 2026-10-09 GovCN durable continuation scope（IN_PROGRESS / S1 pending）

续页能力目前只有范围审查准备：Sol 的 `govcn_resume_scope` 最小架构审查尚未结束，source owner 正准备实现相关事实。当前通过的 `7372d47a` 保持每轮从p=1开始、最多2页、无跨运行resume；此前p=1/2/3只是一次有界观察，不能当作下一运行的检查点。尚未批准持久next-page token、checkpoint提交时序、失败重放或配置漂移协议，也没有实现这类代码。

本阶段没有发新HTTP、写数据库、启provider/worker/OCR，也不做本机API服务操作。待S1范围批准、实现冻结后再按独立验收安排QA；source保持48配置/42 strict ID、全部disabled/fulltext-off且未准入，付费仍`DEFERRED_BY_USER`。

## 2026-10-08 NFRA compatibility preparation (in progress)

本轮只准备NFRA已有saved JSON响应的离线兼容工作。source-scope审查已给出窄范围，implementation code SHA `e09d7cb5c2b3f4c3130e2bbe63721475b8f53cb1`已通过独立focused/full QA；test-only correction SHA `bb02255051bedc3470eaf60add6723662e1df6ce`的Check+Docker #37758646045成功。先前run #37757946149仅因旧版测试要求workflow显式提供`ALLOW_PRIVATE_NETWORK_FETCH=false`字符串而失败；workflow未设置此项，配置默认值为false。post-code local preview smoke/count comparison未运行，启动尝试被工具策略阻止后又发生过已向Root披露的替代启动偏差；此后不得再运行服务操作。NFRA尚未source-admitted。本轮不发真实HTTP、不采集、不启动worker或模型，不做付费调用（测试请求仅由disableNetConnect MockAgent拦截）。当前代码包含48项/strict 42项，新增`nfra-regulatory-dynamics`仍disabled、fulltext-off。公共仓库`revercgy-hub/MYHOT`经GitHub核验为`PUBLIC`，这是用户明确选择的托管可见性，不表示production部署。

初始preview核验：`http://127.0.0.1:3000/`与API `http://127.0.0.1:3001/api/health`均HTTP 200；监听仅为loopback `127.0.0.1:3000/3001/5432`。对`fiscalhot_preview_test`以`postgres@127.0.0.1:5432`执行只读事务：35 migrations、3 sources（0 enabled/0 fulltext）、3 articles、3 publications；analyses、receipts、receipt_attempts、fetch_runs、selected_ledger、job_runs均0。此为本阶段before snapshot；API/Web/PG已运行，本次没有重启服务或写preview内容。

Focused QA通过：`fiscalhot_nfra_independent_focus4_20261008_test` fresh 35 migrations，typecheck exit 0、focused 98/98；source rules/strict exact config 9/9，48/42且enabled 0。MockAgent `disableNetConnect` 下collector恰有7次请求（1 exact list + 6 distinct detail），延迟detail另作1次mock回放；文章1273452保持`unconfirmed`/无body-ready文本/revision 1并有`attachments_unprocessed` marker，analyses/receipts/selected publications/article jobs均0。另有20秒fake-clock boundary验证已过deadline后0 dispatch；这不是120秒真实wall-time测试。最终fresh full suite正在进行，暂不记录为通过。

首次full attempt保留为`333 pass / 1 fail / 334 total`：失败在新测试的环境断言误把fake-provider suite期望为`MODEL_CALLS_ENABLED=false`，而该suite按项目测试协议显式启用fake-only MODEL并以`MockAgent.disableNetConnect`拦截；尚无runtime失败依据。该test-only假设已修正，追加focused/typecheck再次通过；首次失败记录保留、不覆盖、不删除。

最终fresh retry `fiscalhot_nfra_independent_full4_20261008_test`通过35 migrations、backend334/334、typecheck、Web build与Web tests15/15；日志位于ignored `.data/test-pg/nfra-independent-qa-20261008/`。该QA只证明冻结软件候选的本地/Mock行为。隐藏`Start-Process`请求曾被工具策略拒绝；之后的一次foreground Node启动使API PID 374832加载了代码，但按协调要求未运行smoke。启动后只读SQL counts与before相同，settings只有标准`heartbeat.api:3001`行；这不构成post-code smoke pass，且Root已指示不得再进行runtime操作。run #37757946149的旧测试断言误要求`ALLOW_PRIVATE_NETWORK_FETCH`环境字符串显式为`false`；GitHub workflow未设置该变量，而应用配置默认false。仅修正测试后，SHA `bb02255051bedc3470eaf60add6723662e1df6ce`的Check+Docker #37758646045成功。N+1 budgets和其它未针对NFRA增加的错误/外部环境场景不得推称已证明。

## 当前付费选择与软件验证状态（2026-10-08）

`PAID_EXECUTION=DEFERRED_BY_USER`。用户决定先不付费；此前提出的20次/10次方案已不再是当前阻塞，也不应再次追问。此项延期不妨碍无付费的软件验证。Fake/loopback fixture的请求cap仅约束测试行为，不构成真实provider请求的授权；真实模型执行仍需未来明确的新授权。模型开关、collection开关保持关闭，没有写入API key或调用provider。

## 2026-10-08 恢复后的当前软件QA状态

当前代码HEAD为`99c3a9a3a1da91457eb2fdda81b1694d217b0511`。新增的五个bounded executor输入漂移场景（revision/hash/media/source-config/provider）各在fresh 35-migration `_test`库通过1/1，均0 provider POST且无report；该test-only提交SHA `b0a0eeb59e19c696b94e045d2d6d3dcb08a69ea1`的Check与Docker run [37743439955](https://github.com/revercgy-hub/MYHOT/actions/runs/37743439955)为green。代码随后增加的GovCN候选及identity兼容变更，经fresh `fiscalhot_govcn_compat_full_20261008_test`（35 migrations）backend322/322、typecheck、Web build、Web tests15/15验证；focused Gov/selected-body/metadata/PDF/source-rule/strict组合46/46。相关QA log保存在ignored `.data/test-pg/govcn-compat-fullqa-20261008/`。实际saved list/detail fixture与原始saved HTTP entity bytes逐字节一致，Gov detail identity新测试6/6。上述检查没有调用模型/worker/采集或真实HTTP，也没有source admission。

post-Gov本地preview smoke对当前API代码运行30/30、exit 0；原`fiscalhot_preview_test`启动前后read-only counts不变：35 migrations、3 disabled/fulltext-off sources、3 articles、3 publications、0 analyses/receipts/fetch_runs/selected/job_runs；仅API健康`settings` heartbeat存在。API/Web只监听loopback 3001/3000，Postgres监听loopback5432。smoke logs位于ignored `.data/fiscal-qa/preview-smoke-20261008/`。本机确认的工作流`.github/workflows/check.yml` feature push不会自动触发（push filter仅main）；workflow支持pull_request和`workflow_dispatch`。Gov代码SHA `99c3a9a3a1da91457eb2fdda81b1694d217b0511`的Check+Docker run #37744820133现已成功；该workflow仅覆盖对应代码SHA，不需要为docs-only提交重复dispatch。

余下可免费推进的是executor failure-path剩余验证与GovCN disabled-source适配/测试、其它官方source主线的离线/最小工程补证。暂未知的executor行为包括：预算N+1或已有receipt组合、预算/运行配置漂移边界、provider返回后的数据库提交失败、结果report最终写入失败及unknown/timeout细分。五个漂移场景通过不覆盖这些路径。用户已决定先不付费；真实DeepSeek调用与其额度cap继续延期且不追问，OCR仍按用户决定延期，生产/NAS/Staging与真实采集/常驻worker没有启动。Gold标签需要人工，不以软件QA替代。

S1有界执行器代码已提交并推送SHA `57647d954ac56f4269b89adf0cc184a36b530ee0`（5个实现/contract代码路径及2个integration/preload测试文件）；`packages/backend/src/editorial/analyze.ts`、`packages/backend/src/editorial/input.ts`、`packages/backend/src/jobs/p4-pilot.ts`、`scripts/fiscal/p4-execute.ts`、`tests/fiscal-p4-executor-contract.test.ts`。实现代理报告typecheck exit 0及focused contract test 2/2通过；独立QA在fresh `fiscalhot_p4_existing_suite_20261008_test`（35 migrations）报告typecheck及backend 317/317通过，并完成Web build及15/15测试；这是新增report独占预留修复前的基线，不是新代码SHA的完整suite结果。另以严格MockAgent `disableNetConnect`、官方endpoint及假key运行opt-in fake-provider integration：旧happy DB `fiscalhot_p4qa_happy_retry6_20261008_test`为10个串行POST、2 analyses、10 receipts且fetch/publication/selected为0；429隔离DB `fiscalhot_p4qa_429_retry1_20261008_test`为一条failed receipt，重复执行0 POST；存在其他DB连接时拒绝且0 POST。report输出路径修复提交SHA `57647d954ac56f4269b89adf0cc184a36b530ee0`后的focused QA再用`fiscalhot_p4qa_out_20261008_test`（35 migrations、2 fixtures）验证既存report拒绝：0 analyses/receipts/attempts/fetch_runs，sentinel保持原字节，MockAgent 0请求；`fiscalhot_p4qa_happy_fd_20261008_test`（35 migrations）验证active-session guard 0 dispatch后fake-only执行生成1500-byte report，2 analyses/10 completed receipts/10 received attempts，fetch/publication/selected均0。全程仅MockAgent无真实HTTP/付费调用。未发生真实HTTP或付费调用。post-fix只跑typecheck/focused contract2/2/output-exists1/1/happy1/1；新SHA完整suite未重跑。所有S1 fault cases仍待完整QA记录；smoke未运行，因为3000/3001无listener且未启动服务。

厦门内部活动负例候选的ignored证据为`.data/fiscal-qa/p4-xiamen-negative-candidate-20261008.json`（SHA-256 `5c1c9bf9be5bbadc703c8b5adb0faa6440e044057ea3b367c7f2f9d547eeb1c3`）。保存P3正文片段可复原379字符正文并匹配body hash；候选仅供审阅，不是Gold。此前只读连接`fiscalhot_regional_batch_test`失败；QA恢复本机127.0.0.1:5432测试集群后，此候选当前DB行仍未重新验证，故候选未冻结。它不构成当下付费阻塞，因为付费执行已按用户决定延期。
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

Gate 2只放行 `pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`中逐篇核验身份、日期、附件无未决问题且正文 `body_status=ok`、trim后非空的文章。10月8日隔离准备快照只包含前两项各一篇；planner给出的 `ready` 和receipt容量只用于静态准备，不执行分析、不预留预算，也不表示全部三项来源或全目录通过。早先提出的20次/10次或暂不付费方案现由用户选择“先不付费”所取代；当前无须再选择且不追问。此前“首次两篇不以前置负例为条件”的措辞已由[S1有界执行器范围审查](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md)纠正：首次付费前必须冻结合格的厦门监管业务活动负例及后续独立执行边界；负例不必与前两篇同一进程执行，也不加入首批两篇executor的固定ID或共享额度。详细阶段范围以[Gate 2正式审查](GATE_2_REVIEW.md)为准。

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

At the time of this static audit, there was no dedicated bounded P4 executor. The subsequent [S1 scope review](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md) approved a narrow implementation contract and delegated implementation to Luna High; implementation is present as five uncommitted files; the implementer reports typecheck and focused contract tests passing, while strict fake-provider integration and the full backend suite remain pending. This does not reopen Gate 2 or authorize a paid call. The minimum contract is a one-shot worker restricted to the two frozen article IDs, revisions and hashes, invoking guarded analysis only in article order, stopping on the first error, and avoiding queue retry, sweeper, publish, grouping, collector and admin-recovery paths. If paid execution is later reauthorized, retain receipts and configure a single-service attempt cap matching the newly authorized run as a second guard. The user has since deferred paid execution, so the previously discussed 20/10 request limit is not a current blocker and should not be asked again. Continue unpaid software validation only; a fixture cap does not authorize live execution. No budget row, model setting or runtime flag has been changed and no provider call was made.

## 后续配置清单（尚未应用）

用户目前决定先不付费，真实执行处于延期状态。若用户将来主动重新启动付费执行，仍须重新明确授权并核验本清单；本清单不构成授权，也不要求现在提供API key。

- **五项分析能力统一路由**：`prefilter`、`score`、`structure`、`understand`、`summarize`都必须解析到同一DeepSeek路由/服务，避免服务级预算被拆开。`modelFor()`优先级是数据库`settings.models.<capability>`覆盖，其次是对应环境变量（`PREFILTER_MODEL`、`SCORE_MODEL`、`STRUCTURE_MODEL`、`UNDERSTAND_MODEL`、`SUMMARIZE_MODEL`），最后才是代码默认`default`。执行前须复核五项的有效值，不读取或输出secret。
- **选定一条配置路径**：最贴近当前planner快照（五项均为`default`）的是保持五项为`default`，设置`LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-flash`及`LLM_API_KEY`；这条注册项的budget service ID是`llm`。若将五项都显式路由到命名preset `deepseek-flash`，则配置`DEEPSEEK_BASE_URL`、`DEEPSEEK_API_KEY`；此preset的service ID是`deepseek`。`LLM_*`只配置`default`注册项，不会覆盖数据库已有的每项model设置。DeepSeek可选的`LLM_EXTRA_JSON`仅适用于default路由；named preset自身已关闭thinking。
- **预算**：仅在新鲜、专用于这次pilot的`_test`数据库，为实际共用的service ID配置receipt budget；`per_day`按待定选择设为20或10，并保留合理的minute/hour限制。检查由现有receipt逻辑在每次请求前执行，计的是request attempts，不是token、人民币或美元金额；planner快照不预留预算，金额仍unknown。不得只设`llm`而实际请求走`deepseek`，反之亦然。
- **密钥保管**：由负责人将key安全注入仅供一次性后端worker读取的进程环境，或放在仓库外受访问控制的`AIHOT_CREDENTIALS_DIR/models.env`；进程环境优先于凭据文件。不要发到聊天、写入Git或运行日志，不读取/回显key值。
- **运行开关**：`MODEL_CALLS_ENABLED`在后端代码中的默认值是true，变量缺失不能当作关闭；普通API/runtime显式保持false。将来只在获批的一次性P4 worker进程开启true，并继续显式关闭`COLLECT_ENABLED`、Jina fallback、Feishu、IndexNow、embeddings及私网抓取。`MODEL_CALLS_ENABLED=false`会让`chatJson()`抛出disabled错误；普通content worker会把它当作失败并排期重试，所以不要以“开worker但模型阀关闭”代替有界dry-run。
- **执行器缺口**：`scripts/fiscal/p4-pilot.ts`只读规划，不运行分析；普通worker会重试并可继续发布/归组。符合固定ID/revision/hash、逐篇顺序、首次错误停止、无自动重试且不运行collection/publication/group/sweeper的专用worker正在按S1范围实现；尚无已验收/测试通过的runner。当前模型调用开关仍关闭、未启worker；预算和model settings也未配置。

## 2026-10-08 S1范围批准与负例要求纠正

[S1一次性有界执行器审查](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md)的结论为`APPROVED_SCOPE`：仅批准最小实现和loopback软件验证范围，不是Gate 2结论、实现验收、真实模型授权或P4质量通过。实现现包含5个未提交文件；typecheck与focused contract 2/2通过，严格fake-provider integration及full suite待独立QA。前述“首次两篇无需负例前置”的历史说法与正式Gate要求冲突，现按S1裁定更正：在首次付费调用前必须核验并冻结一篇合格的`mof-xiamen-supervision-dynamics`真实内部活动负例及其后续独立执行边界。Treasury+OMO仍可作为第一批、executor只接受这两个固定ID；负例无需和它们同进程付费执行，不加入这批ID或共用这批预算。若负例尚未合格并冻结，只继续实现与loopback QA，不进行首轮付费调用。配置清单已在上一节记录；DeepSeek V4.1 Flash已选；用户当前决定先不付费，20/10不是当前阻塞且不追问。5个未提交实现文件的typecheck和focused contract 2/2通过，fake-provider integration/full suite待QA；运行开关保持关闭。
