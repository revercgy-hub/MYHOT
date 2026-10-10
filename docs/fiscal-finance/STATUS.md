# 项目状态

## 2026-10-10 当前权威状态：Luna辅助预览已写入隔离库；live页面待API服务

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2（本阶段预览代码SHA、文档交接提交前的HEAD；文档提交SHA另由git log核实）
RECOVERY_SHA=199e85717e1b9acaaa0888328a9cbfb62c6723d7（本轮实际恢复起点；当时工作树clean）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c（项目基线；不是本轮测试SHA）
WORKSPACE=D:\AI-work\MYHOT\AIHOT；本轮只更新STATUS、P3_LOCAL_PREVIEW与Luna-assisted preview handoff
STAGE=用户授权的Luna内容识别、本地预览软件QA及精确隔离库seed已完成；代码SHA `7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`的CI run `38027644649` Check/Docker success；页面live核验因API未监听而未发起GET；正式provider执行和P4质量评估未运行
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`仅限原三source固定小样；本轮未改变Gate，不代表全部source准入
REVIEW=用户授权gpt-6-luna/high对四份saved official body做codex_agent_assisted识别，独立body-blind复核保留分歧；这是模型辅助编辑审阅，不是app provider/receipt执行或人工Gold。system cluster未运行、Gold未填写；内容仍未经正式模型精选且Gate未变。来源disabled/fulltext-off
BLOCKERS=真实provider/付费执行按用户决定deferred；8条Gold人工标签及分组/split尚待领域人员确认；来源级质量与覆盖仍未证明
COMPLETED=P4质量审阅工具：冻结工作树runtime HEAD `1f30ee1`独立fresh QA backend362/362、focused5/5、typecheck、Web build/Web15；同内容提交`0b372dae2202c42ddc52535454c239bc8e592856`的CI run `38016328910` Check+Docker success。P4结果sidecar：冻结运行HEAD `6a808c7`、两目标文件起止SHA稳定、pre业务计数/真实P4执行均0，fresh35 migrations、typecheck、focused8/8、backend370/370（0 fail/skip）、Web build/Web15全exit0；同内容commit `0b3cec2b2d155ee57adb908fc477f0737b556ad9`的CI run `38016781363` Check+Docker success。Synthetic CLI template与draft ledger均exit0；草稿一条记录保持四维/审阅人/时间全空，DRAFT_INCOMPLETE、pending1、issues0、systemClustering NOT_RUN。Luna预览：会话授权的4篇saved-body识别及盲评完成；冻结工作树HEAD `199e857` QA（35 migrations、pre业务0、backend370/370、focused4/4、typecheck、Web build/Web15）通过；精确seed原3 unchanged、新3 created且baseline/provenance核对通过；代码`7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`的CI run `38027644649` Check/Docker success。旧Gold packet `357/357`只属于SHA `2664e1f`；预算静态20-cap与动态上调case分别独立验证。
IN_PROGRESS=API未监听，导致本机live页面GET=0，root/item可见性与HTTP noindex尚未验证；等待用户手动启动API后核验。正式provider P4执行未运行且付费`DEFERRED_BY_USER`；8条humanAnnotation仍null/needs_review，decision、event group、split及annotator/时间待领域人员。来源级质量与覆盖未证明；source disabled/fulltext-off。
SOURCE_AUDIT=预算司官方动态列表唯一GET获独立QA接受：saved raw/hash一致，离线重解析10行逐项匹配当前source config，近90日候选0、selected为null、详情请求0。request headers未保存且当次EGRESS_PROXY_URL未知，网络路径不能归因；见SOURCE_MATRIX与本handoff。
LUNA_CONTENT_RECOGNITION=基于两隔离_test DB inventory只读复算4份body identity/contentHash；输入`.data/fiscal-qa/luna-content-20261010/input.json` SHA-256 `d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c`。识别结果和metadata audit及blind second-review存同目录。识别样本为OMO192、2026年8月地方债、厦门央企国资收益审核、网安宣传负例BLOCK；两次评分明确对应为OMO69/69、地方债81/85、厦门56/70、网安28/32，厦门分歧保留、不平均作校准或改阈值。`siteProviderCalls=0`、receipts=0、`humanGold=false`、`cluster=NOT_RUN`。
NEXT=live页面验证需用户手动启动API后再安排，不自行操作服务；noindex HTTP行为仍待live核验。付费provider/Gate/Gold和来源质量未完成。
LATEST_TESTED_CODE_SHA=7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2（Check+Docker CI run 38027644649 exact headSha success；本机QA在冻结工作树HEAD 199e857运行，随后提交此代码SHA）
P4_QUALITY_REVIEW_QA=冻结工作树（运行时HEAD `1f30ee1`；该实现随后提交为`0b372dae2202c42ddc52535454c239bc8e592856`）：fresh 35 migrations，backend 362/362、typecheck、focused5/5、Web build/Web15/15 PASS；无新SHA测试主张
P4_QUALITY_REVIEW_RESULTS_QA=冻结内容在运行HEAD `6a808c7`独立fresh DB `p4_quality_results_20261010_test`（35 migrations；两目标文件起止SHA稳定；pre业务计数0、真实P4执行0）通过typecheck/focused8/8/backend370/370（0 fail/skip）/Web build/Web15，全部exit0；日志`.data/fiscal-qa/p4-quality-results-qa-20261010/`。同内容commit/push `0b3cec2b2d155ee57adb908fc477f0737b556ad9`的CI run 38016781363 exact headSha Check+Docker均success。synthetic template/draft ledger CLI均exit0，草稿1条全空人工字段，DRAFT_INCOMPLETE/pending1/issues0/systemClustering NOT_RUN
LATEST_TESTED_RUNTIME_SHA=6668c70da306473977eb55c3b6073be3d5fd535f（含当前Zhejiang source config；packages runtime实现未变）
LATEST_GREEN_CI=38027644649（Check+Docker均success；headSha精确为`7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`；sidecar前阶段run 38016781363对应`0b3cec2`）
CURRENT_CI=38027644649（`check.yml`单次dispatch；精确headSha `7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`；Check job 114141797374与Docker job 114141797320均completed/success；Check typecheck、Web build/tests、migrate+seed、built-site smoke、backend tests success，Docker compose build+smoke success）
P5_PACKET_FINAL_QA=2664e1fa817d9f1242fc9b227d3bbcde6b1b8d66（fresh DB `gold_packet_qa_corrected_20261009_test`，35 migrations；backend 357/357、0 skip，typecheck、Web build、Web tests 15/15 PASS；fake-only paths，外部模型调用和source body extraction均0）
LATEST_TESTED_TEST_ONLY_SHA=e97b02bd303116c739caeb983c00e9ba2ff7b49c（P4 budget upward-drift standalone fresh integration 1/1及typecheck通过；budget结果不借入浙江full QA）
ZHEJIANG_FOCUSED_QA_WORKTREE_BASE=e97b02bd303116c739caeb983c00e9ba2ff7b49c（浙江冻结config/fixture工作树：typecheck与focused offline 29/29通过）
ZHEJIANG_FINAL_QA=6668c70da306473977eb55c3b6073be3d5fd535f（fresh DB `fiscalhot_zhejiang_finalqa_20261009_test`、35 migrations/61 tables；backend 351/351、typecheck、Web build、Web tests 15/15、浙江focus 5/5 PASS；P4 opt-in unset）

续页代码SHA `15e3464c0bff45af96e52514b831f2aba8fc6043`本地独立QA：focus6 55/55，focus7 typecheck及持久化integration 1/1；fresh `fiscalhot_govcn_resume_full2_test`完成35 migrations，backend 346/346、Web build通过、Web tests 15/15。GitHub run [37905438753](https://github.com/revercgy-hub/MYHOT/actions/runs/37905438753) 对精确该SHA已完成，`check`与`docker`均success。以上为已完成的历史软件/CI基线，与本轮恢复的文档HEAD `2cb5610ed16098d104821173632fa68066ebcde6`分列。

P4既有N+1预算与指定事务/report failure测试的完整历史、证据与边界见[连续P3 handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)。预算静态20-cap case在fresh库通过1/1、replay 0；动态case以CLI max=10运行，在第9次attempt触发minute/hour/day预算由10上调至20后通过1/1：2 articles、2 analyses、10 receipts status=completed、10 receipt_attempts status=received、fake POST=10、report max=10、replay=0。fresh `fiscalhot_p4budget_up_drift_final_20261009_test`完成35 migrations，typecheck及integration 1/1通过。首轮动态尝试hung且无receipt，owner已停进程；原harness故障记录保留，不归因生产问题。测试SHA `e97b02bd303116c739caeb983c00e9ba2ff7b49c`无backend full suite或CI，浙江source full QA不重复运行预算case。浙江“监管工作”候选保存材料的offline audit显示：列表第1页与详情匹配配置，列表含9个HTML项和1个PDF项，保存的JS有16页，提取正文666字符、4段，标题与日期一致。另一次经批准的唯一page 2 GET访问`https://zj.mof.gov.cn/caizhengjiancha/index_1.htm`，HTTP 200、final URL精确匹配，12,469字节、SHA-256 `f0346a5b9c5e2a721f2d092b3683cdc0f324ca73a3385b67eddc0b8bed48e704`，UTF-8 decoder replacement=0且EOF完整；请求attempted/dispatched/rejected=1/1/0，无详情或附件请求。保存base page与`index_1.htm`各解析10行，exact identity overlap为0；日期分别覆盖8/17–9/30与6/16–8/11，存在6日显示日期空档，`index_1.htm`有5/10项列表显示日期与URL日期token不同；这是尚未裁定的URL日期疑点，不是已证list/detail日期冲突，也不得用URL日期改写列表日期。base page PDF仍按既定规则pending；page 2无PDF。Sol已批准[浙江分页S1范围](S1_ZHEJIANG_PAGINATION_SCOPE_2026-10-09.md)，source改动仅为单一disabled entry的既有HTML pagination opt-in，参数`maxPagesPerRun=2`、`maxDispatches=12`、`maxPageIndex=15`、`detailMode=direct_html_metadata_v1`。source commit `6668c70da306473977eb55c3b6073be3d5fd535f`已推送；focused offline suite 29/29与typecheck通过。fresh `fiscalhot_zhejiang_finalqa_20261009_test`完成35 migrations/61 tables，backend 351/351、typecheck、Web build、Web tests 15/15与浙江focus 5/5均通过；P4 opt-in unset。该full QA不借用此前预算standalone case结果。Source仍disabled、fulltext关闭、未运行collector，local smoke未运行。该精确SHA的Check+Docker run [37935221740](https://github.com/revercgy-hub/MYHOT/actions/runs/37935221740)已completed/success（Check 113835474656、Docker 113835474297），不是当前代码SHA的CI。观察不证明稳定分页、完整历史、90日覆盖、质量通过或source准入。续页full QA/CI及各轮失败细节保留在handoff。来源目录48/42 strict、全部disabled/fulltext-off；Gate 2仍只限原三source固定小样。

本段为最新状态权威摘要。续页scope、实现修复、full-suite与CI的中间pending快照已完成生命周期；重复细节及失败记录保留在连续P3 handoff。

## 2026-10-09 GovCN durable continuation历史索引

本日早先的scope pending、实现review待修、focused通过/full pending、full1隔离失败/full2 pending及CI queued均为当时真实快照，最终软件QA与run `37905438753`的Check+Docker结果见[连续P3 handoff](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)“Continuation source commit and remote Check”及其前序历史。最终实现SHA `15e3464c0bff45af96e52514b831f2aba8fc6043`的fresh full QA与精确SHA CI均通过；这些旧pending项不再代表当前待办。handoff中的原始过程记录完整保留。

## 2026-10-09 GovCN分页软件QA与受限列表观察（历史快照）

当前代码提交为 `7372d47a1d6d71b81b735e4b8025158e672233eb`（GovCN bounded JSON pagination）。独立QA完成：focused 51/51、typecheck、fresh 35-migration persistence 1/1、backend 342/342、Web build、Web tests 15/15；代码 Check+Docker workflow run [37881613214](https://github.com/revercgy-hub/MYHOT/actions/runs/37881613214) 对该精确SHA已完成且success。其后一次独立、Root接受的p=1/2/3只读列表batch完成：3 attempted/dispatched、0 rejected，3个精确final URL均HTTP 200，15条候选URL均不同；解析与SHA见本轮continuous handoff和ignored `.data/fiscal-qa/govcn-pagination-20261009/`。服务响应的`paramsVO.p/n`分别匹配1/5、2/5、3/5；每页`searchVO.currentPage/pageSize/totalCount/totalpage`均为0，因此不据此推断总量或terminal。该观察既非产品配置的三页运行，也非90日历史/完整性、来源质量或准入证明。

响应实体字节已由独立审计重算；当前runner实际写入packet根目录的`page-1.body`至`page-3.body`，而声明的`responses/`目录为空。原始gate、manifest、marker与响应未改写、未重跑；忽略目录中的`artifact-correction-v2.json`记载路径差异及离线复核。GovCN候选保持disabled/unadmitted，配置仍48来源/42 strict IDs、全disabled/fulltext-off。付费provider、collector、worker和OCR均未运行；本机API服务操作保持禁止，post-code本地smoke未执行。

P4_FAULT_TEST_ONLY_HEAD_AT_SNAPSHOT=e8525d46ddda64a0311b381c1b18b9f4c8045d67（该历史快照中的N+1与故障用例HEAD；非当前HEAD）
LATEST_TESTED_CODE_SHA=15e3464c0bff45af96e52514b831f2aba8fc6043（GovCN continuation full QA及Check/Docker green）
LATEST_GREEN_CI=37905438753（Check+Docker success，headSha精确为`15e3464c0bff45af96e52514b831f2aba8fc6043`）
CHECK_AT_SNAPSHOT=37905438753（GitHub workflow_dispatch；对15e3464，Check与Docker均success；test-only SHA e8525d4无新CI）
SOURCE_AT_SNAPSHOT=48个配置/42个strict IDs；全部disabled、fulltext-off；未作source admission
STAGE_AT_SNAPSHOT=GovCN durable continuation已通过独立软件QA与精确SHA CI；P4 N+1及指定事务/report failure test-only cases已focused通过并推送。来源仍未准入，90日/terminal/来源质量待证
PAGINATION=产品模式仍每次p=1、最多2页；一次性实测batch为p=1/2/3，15行、15个不同URL，`searchVO`总量/当前页字段均为0；只限有限观察
P4=Gate 2仍仅`PASSED_FOR_BOUNDED_P4_PILOT`；本轮分页观察不属于P4样本验收

### 2026-10-08及更早状态字段归档

以下字段是各自历史阶段的原始快照，可能有当时的CURRENT/NEXT/IN_PROGRESS标签；不得覆盖本文首部当前状态。重要失败与阶段详情保留在本handoff及对应历史记录。

## 2026-10-09 continuation范围准备历史索引

当日scope审查及恢复起点属于续页实现前的历史快照，最终scope、实现、QA与CI结果见连续P3 handoff；不作为当前scope pending状态。

## 2026-10-09 GovCN bounded JSON pagination — phase-start snapshot (superseded by latest checkpoint above)

本轮从代码/文档基线 `b9e62d7e1b9e89859954c4c38a16c22e84302488` 恢复，分支 `feat/fiscal-finance-hot`；开始时工作树仅有已授权的未跟踪审查文档，当前source实现/测试及QA状态文档均在各自owner工作树中。GovCN S1 裁定为 `APPROVED_SCOPE`，只批准实现范围，不代表实现通过、source admission、分页实测或来源质量通过。方案要求每次运行从 p=1 开始，最多两页、无持久resume，统一请求预算并始终过滤可信90日窗口；持久化状态必须明确为 partial/coverage unproven。Ignored只读GET packet ` .data/fiscal-qa/govcn-pagination-20261009/` 已由MockAgent dry-run验证预算，但真实GET仍未运行；软件QA/Lead核销完成前不得运行。

`industry/sources.json` 当前仍为48 sources / 42 exact strict IDs，均disabled且全文关闭。NFRA adapter独立QA结果仍为backend334/334；不推测成338。上个修复SHA `bb02255051bedc3470eaf60add6723662e1df6ce` 的GitHub Check+Docker #37758646045为green；当前基线文档SHA `b9e62d7e1b9e89859954c4c38a16c22e84302488`不单独触发CI。真实付费执行继续 `DEFERRED_BY_USER`，本轮不调用官方HTTP、provider、collector或worker。本机loopback API/Web/PostgreSQL当时均已存在，health为200；本阶段禁止启动/停止服务或做smoke，preview仅可只读审计。

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=e8525d46ddda64a0311b381c1b18b9f4c8045d67（test-only HEAD；budget与指定failure cases focused通过）
LATEST_TESTED_CODE_SHA=15e3464c0bff45af96e52514b831f2aba8fc6043（continuation fresh full QA通过；Check+Docker run37905438753 success）
LATEST_GREEN_CI=37905438753（Check+Docker success，对应精确代码SHA `15e3464c0bff45af96e52514b831f2aba8fc6043`；test-only HEAD e8525d4尚无独立CI）
PHASE_A_CHECKPOINT_CODE_SHA=b2f479c4517d040f4b1c24b14e1407ad342bbb3a（历史Phase A组合代码与publication测试fixture修复；本机fresh `npm test` 276/276）
PHASE_B_BASE_CODE_SHA=b2f479c4517d040f4b1c24b14e1407ad342bbb3a（Phase B批准范围工作起点；未包含Phase B实现）
SOURCE_CONFIG_SHA=7372d47a1d6d71b81b735e4b8025158e672233eb（48项source；42个exact strict IDs＝35个地方局＋7个核心例外；所有source disabled且fulltext-off）
SOURCE_CONFIG_WORKTREE=与当前代码SHA一致；GovCN/NFRA保持候选，未seed到preview/production、未source-admitted；不将分页有限观察当作source pass。
CURRENT_STAGE=2026-10-09 GovCN JSON分页实现、独立软件QA和一次有界列表观察完成；候选仍未准入，90日/terminal/来源质量仍未证明；真实付费DEFERRED_BY_USER。
WORKSPACE_BASELINE=branch feat/fiscal-finance-hot；本轮开始时HEAD `b9e62d7e1b9e89859954c4c38a16c22e84302488`且worktree clean；后续仅本owner状态文档修改。公开仓库可见性已由前序GitHub核验为PUBLIC。
PREVIOUS_NFRA_CONFIG_QA=implementation SHA `e09d7cb5c2b3f4c3130e2bbe63721475b8f53cb1` + test correction SHA `bb02255051bedc3470eaf60add6723662e1df6ce`：48项 / 42 strict exact IDs，独立full QA完成、未source-admitted。CI #37757946149旧版测试错误要求workflow未设置的`ALLOW_PRIVATE_NETWORK_FETCH=false`环境变量；配置默认值仍为false。仅测试修正后的CI #37758646045成功。此为历史NFRA阶段，不是当前配置SHA。
CI_TESTED_SHA=18e159be43810974dc80b2bb26d05babd6744646
CI_TESTED_RUN=37712335532（success；Check+Docker成功；typecheck、Web build/tests15/15、migration/seed、built-site smoke、backend tests、Docker smoke通过；[GitHub Actions](https://github.com/revercgy-hub/MYHOT/actions/runs/37712335532)）
PHASE_C_PREVIOUS_FAILED_CI_SHA=290619355c9d60b6da155c9215381c82b6acf9b2
PHASE_C_PREVIOUS_FAILED_CI_RUN=37436673475（保留历史失败；Linux backend 303项/301通过/1失败/1 skip，page-deadline fixture原因见本轮handoff）
CI_PREVIOUS_FAILED_SHA=26ca72f2b94d37383072c0e54be6f94682b0e9bd（run 37077418870；平台修复前的历史失败仍保留）
CI_PREVIOUS_FAILED_RUN=37077418870
PREVIOUS_CI_TESTED_SHA=8e845812b6ce1db45821ade7b2162a90f589e1de
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
PHASE_B_ROUND_BASE_SHA=9814ceb0dcdf3fc71ab647d04fd12a1997f73c5f（历史Phase B恢复时branch HEAD）
ROUND_BASE_SHA=95c0596796ba6b6cdde7766147229b68d3451035（2026-10-07离线审计/解码器QA轮branch起点；不替代项目BASE_SHA）
DOC_HEAD=本次docs-only提交后以`git log -1 --format=%H`核实；docs SHA不是CI tested code SHA，CI code SHA单独记录
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3来源主线与有界P4 pilot准备；S1 Phase A/B受限实现与软件QA完成；本地OCR工作`OCR_DEFERRED_NOT_GATE2_BLOCKER`。
GATE=Gate 1 PASSED；Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`，依据[2026-10-08正式Gate 2审查](GATE_2_REVIEW.md)。只准对`pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`中逐篇确认身份/日期/附件无未决问题且`body_status=ok`、trim非空的固定小样开展有界P4验证；不是46源全量准入、35局持续运行通过、无人值守采集或生产授权。厦门地方债`xiamen-finance-debt`明确`NOT_ADMITTED`并安全排除。35局完整来源主线及GovCN/NFRA等待办继续保留；完整90日首次回填属于P7/Gate4与P8/P9上线验证，不是Gate 2遍历全部旧页前置。
REVIEW=浙江 `mof-zhejiang-supervision-dynamics` 最小分页范围由Sol裁定 `APPROVED_SCOPE`，配置已按范围冻结；source仍disabled、fulltext严格关闭，不授权collector/新HTTP/DB/worker/model/付费运行
HISTORICAL_LATEST_CI_AS_OF_2026-10-08=SHA 18e159be43810974dc80b2bb26d05babd6744646的run [37712335532](https://github.com/revercgy-hub/MYHOT/actions/runs/37712335532) success；仅作NFRA decoder阶段历史，不是当前CI。
HISTORICAL_TURN_AS_OF_2026-10-08=JSON外层charset修复及其独立QA、CI run37712335532；对应NFRA仍未准入，Gate 2审查范围当时限定三source逐篇合格文章。当前状态请读本文件顶部。
CURRENT_SOURCE_PREPARATION=2026-10-08 GovCN/NFRA original 4-GET packet plus separate GovCN exact query/detail pair independently audited; all saved hashes, status/final URL/EOF/caps checked. GovCN query list candidate in `bumenfile` date 2026.09.28 exactly pairs to one detail page with matching title/firstpublishedtime; actual body selector `#UCAP-CONTENT .trs_editor_view` is 5635 chars/35 paragraphs, no attachments. Query snippets are summaries only; this single pair does not establish category/page completeness or admission. NFRA outer JSON is valid UTF-8 and raw list/detail title/id/date match; embedded gb2312 meta is inner HTML only. Shared decoder meta-sniff bug is fixed at code SHA 18e159be43810974dc80b2bb26d05babd6744646; focused tests and actual saved NFRA detail raw replay pass. Raw-based corrections preserve prior erroneous derived observations. NFRA nested-category/separate JSON detail support remains unimplemented; GovCN/NFRA remain on source mainline and unadmitted; no GovCN source configuration was added.
CURRENT_P4_PREPARATION=Independent final planner/audit and read-only SQL agree on 2/2 isolated article candidates in fresh `fiscalhot_p4_preparation_20261008_test` (35 migrations): Treasury and PBOC OMO 192. Zero fetch/analysis/receipt/job/selected rows; sources disabled/fulltext-off; zero model/HTTP/queue/write activity. Provider is UNCONFIGURED; budget unreserved and amount estimate unknown. This prepares two source IDs within the approved three-source sample scope; no Xiamen supervisor article is included. It is not a P4 execution or source admission. Artifact hashes and provenance are in the continuous handoff.
P4_MODEL=用户选择 DeepSeek V4.1 Flash；官方API model slug=`deepseek-flash`；公开文档字段与当前 OpenAI-compatible Chat Completions client静态匹配，尚无实际API/端到端验证。准备配置示例见[P4准备报告](P4_PILOT_READINESS.md)，不代表已应用或已实测。
PAID_EXECUTION=DEFERRED_BY_USER；用户决定目前先不开展付费模型执行。20/10次上限不再是当前工作阻塞，不追问该选项；未获得未来付费运行的新授权前不执行。
P4_EXECUTION=未运行真实provider；PAID_EXECUTION=DEFERRED_BY_USER；MODEL_CALLS_ENABLED=false、COLLECT_ENABLED=false；无真实API key。fixture/MockAgent cap只约束离线测试，不授权live。当前代码SHA `57647d954ac56f4269b89adf0cc184a36b530ee0` 已推送；三份状态文档尚待提交。pre-output-reservation-fix基线QA fresh `fiscalhot_p4_existing_suite_20261008_test` 35 migrations：typecheck PASS、backend 317/317、Web build PASS、Web tests 15/15（该full suite不代表新SHA）。最新SHA后验证：typecheck及focused contract 2/2；`fiscalhot_p4qa_out_20261008_test` 35 migrations、2 fixtures、0 analyses/receipts/attempts/fetch_runs、sentinel unchanged、MockAgent 0请求；`fiscalhot_p4qa_happy_fd_20261008_test` 35 migrations，active-session guard 0 dispatch后fake-only路径生成1500-byte report、2 analyses/10 completed receipts/10 received attempts，fetch/publication/selected均0。MockAgent `disableNetConnect`、官方DeepSeek endpoint及假key；真实网络HTTP/付费调用0。post-fix完整suite及smoke未运行；smoke因3000/3001无listener且未启动服务。没有CI run关联新SHA；最近绿色CI `37712335532`只对应较早代码SHA `18e159be43810974dc80b2bb26d05babd6744646`。S1完整fault matrix仍待QA。隔离候选仍Treasury+OMO各一篇；Gold仍null/needs_review。
P4_NEGATIVE=候选证据保存在ignored `.data/fiscal-qa/p4-xiamen-negative-candidate-20261008.json`；厦门监管内部活动候选body hash与长度可由保存P3片段复原核实，但`fiscalhot_regional_batch_test`当前只读连接失败（5432无运行服务），故当前DB行未核实、候选未冻结且不是Gold。未来付费执行前仍须Lead独立核验并冻结合格负例及其独立执行边界；当前付费已按用户决定延期，不追问或把此项包装为眼下付费阻塞。
PREVIOUS_TURN=2026-10-07 root核准福建`index_1.htm`至`index_3.htm`三次精确列表GET，独立QA核对raw/hash与manifest；四页40候选、行序非单调，90日覆盖仍未证明。新增四局后共27 sources（26 HTML、1 JSON），精确九项严格正文opt-in，全部disabled/fulltext-off。配置SHA `e3791c2744c285c7967cb1c6597da3187817889b` 本机fresh 35-migration QA backend310/310、typecheck、Web build/tests15/15、smoke30/30均通过，其CI run37573322451的deadline分类失败仍保留。获准最小reason冻结维护SHA `d4fd46ded57cd899793e819a3b49ff8bf6e72e4f` 的fresh 35-migration DB backend310/310、typecheck通过；同SHA CI run37574033213 Check+Docker通过，backend 309通过/0失败/1 Windows-only skip，Web checks全部通过。post-QA preview只读核验仍为35 migrations、3 disabled/fulltext-off sources、3空body articles、3 publications及0 fetch/analysis/receipt/selection/job runs。宁夏/青海各一页历史快照成功并独立核验；另一份单独获准宁夏快照的首页前置GET 20秒超时，`1/11` dispatch后停止，未请求历史页。均不证明90日完整或collector分页能力。Gate 2仍NOT_PASSED、source admission未批准；OCR继续`OCR_DEFERRED_NOT_GATE2_BLOCKER`。没有运行真实provider、collector、worker或OCR。详见[新四局检查点](HANDOFFS/NEXT_BUREAU_CHECKPOINT_2026-10-07.md)。
LATEST_HANDOFF=连续P3交接已追加2026-10-08 exact 40-ID配置、JSON charset修复与fresh local QA/green CI run37712335532、GovCN/NFRA原始证据、GovCN单篇政策列表/详情配对、P4隔离样本准备、DeepSeek选择及S1 bounded-executor状态；见[交接](HANDOFFS/CONTINUOUS_P3_HANDOFF_2026-10-07.md)、[P4准备](P4_PILOT_READINESS.md)、[S1范围审查](S1_P4_BOUNDED_EXECUTOR_SCOPE_2026-10-08.md)和[正式Gate 2 review](GATE_2_REVIEW.md)。Gate 2只批准固定小样P4边界，不代表来源广泛准入或Gate 3/4通过。
BLOCKERS=当前无用户选择待办，付费执行延期且不重问20/10。持续完成S1 fault-case独立QA；最新SHA仅typecheck、focused contract/output guards和happy-path fake验证通过，317项full suite是报告文件独占预留修复前的基线结果，不能视作新SHA完整suite。未来任何付费执行仍须新明确授权、run contract与厦门负例复核/冻结；当前候选DB行未重验、不是Gold。Gate 3及来源主线仍未完成；所有sources disabled、全文关闭。
COMPLETED=预算静态20-cap与第9次attempt动态上调case在fresh隔离库验证通过；浙江候选已完成有限保存响应offline audit与单次page 2观察，但未证明source质量/覆盖
IN_PROGRESS=浙江冻结配置/fixtures/config test的typecheck及focused offline 29/29已通过；最终合并状态的独立fresh full suite pending。Source仍disabled、fulltext关闭、未运行collector
PREVIOUS_IN_PROGRESS=Phase C P3 source evidence准备仍进行中。福建已完成三次经root逐项核准的分页列表GET，raw/hash/manifest经独立复核；四页40候选不足以证明90日覆盖或source admission。配置现为27项，新增广西、海南、重庆、四川、宁夏、青海、陕西、贵州八项；九项严格正文就绪opt-in均disabled。所有source仍disabled、站内/转发全文关闭，未导入正式库或运行collector/worker/真实模型。post-test readonly SQL事务核验preview为3 sources/0 enabled、3 articles、analysis/receipt/fetch/selection/job-run均0。root批准的deadline分类确定性维护及其fresh QA正在进行；Gate 2维度继续按矩阵闭环；OCR仍`OCR_DEFERRED_NOT_GATE2_BLOCKER`。
NEXT=Root安排对浙江冻结代码+配置执行一次独立fresh full QA；通过后按Root安排一次最终CI。预算测试不重跑。RECOVERY_SHA `2cb5610`、当前test-only HEAD `e97b02b`及续页历史runtime SHA `15e3464`分列
PREVIOUS_NEXT=在deadline reason维护代码冻结后，由唯一QA执行者对fresh 35-migration test DB运行typecheck、backend full suite、既有Web build/tests及loopback smoke，并仅对最终维护SHA触发一次CI；保留run37573322451失败结果，不重跑旧SHA。之后继续核实用户确认的35个地方局新闻动态栏目，对未覆盖局逐一补来源身份、分页/近90日历史、可信日期、正文业务质量/噪声、附件退化、更新去重及跨周期证据；新HTTP须按精确host/path与dispatch budget单独核准。维持27项disabled、全文关闭、无collector/worker/model/生产操作。按来源矩阵逐项保留unknown直到证据闭环；Gate 2保持NOT_PASSED。OCR依既有用户决定继续延后且不作为Gate 2 blocker。

## 2026-10-07 保存响应离线审计与有界内容解码器

本轮源码只有两个新文件，提交 `cdbb329529f407f25db122510dc042ceca5fd975`，已推送 `origin/feat/fiscal-finance-hot`：一个读取本机保存响应、限制原始/解码后输入均不超过6 MiB的离线 identity/gzip/Brotli/deflate 解码工具，及7项 focused 覆盖；不改通用 Fetch、collector、source config、数据库或运行时。完整核验和安全边界见[10/7 P3检查点](HANDOFFS/P3_CONTENT_ENCODING_CHECKPOINT_2026-10-07.md)。

福建保存响应审计在[独立报告](P3_FUJIAN_SAVED_RESPONSE_AUDIT_2026-10-07.md)：列表10条URL唯一，但行序不按日期严格倒序；第7行的9/22条目排在多个较新条目后，四项路径日期与列表日不同；首屏最旧日为8/10，没有更早页证据。`index_1.htm` 可由保存脚本导出为下一页候选，尚未请求。未来不能依赖“首个90日外条目即停止”；如继续分页，需要新请求包和 root 预算，不能复用10/6一次性 collector 核准。两个持久化详情一篇正文可用，一篇只有标题且 pending、PDF 未请求。source 仍 disabled/fulltext-off，来源准入 NOT_ADMITTED、coverage unproven；Gate 2仍 NOT_PASSED。

最终代码SHA `cdbb329529f407f25db122510dc042ceca5fd975` 在新loopback PostgreSQL 17 `_test` 数据库 `fiscalhot_oct07_content_encoding_frozen_test` 上完成35项migration、Node24.16.0 `npm run typecheck`和`npm test` 310/310。模型测试开关仅在全 provider 凭证/base URL 清空的测试进程中开启，各模型测试使用自己的 loopback stub；采集、Feishu、IndexNow、Jina、私网、全局embedding开关关闭，未启worker/真实provider或来源HTTP。Web build退出0、Web tests 15/15、loopback smoke 30/30来自相同 Web/runtime 源码的检查。另一个与 CLI 有界读取最后收尾并发的测试进程被中断并丢弃，不计为验证结果。preview数据库使用只读事务前后核验一致。CI run [37556665439](https://github.com/revercgy-hub/MYHOT/actions/runs/37556665439) 对该SHA的Check与Docker jobs均成功；Linux backend tests为310项（309 pass、0 fail、1 Windows-only skip），Web tests15/15，built-site smoke通过。

## 2026-10-06 福建单源有限 legacy collector 结果

Sol 范围裁定 `APPROVED_SCOPE` 允许在全新 disposable `_test` 数据库执行一次 legacy collector，并保留其首次 `initializedAt`、`lastOkAt` 与 fetch health 写入；这些值只代表这次最多两篇的有限运行，不代表90日覆盖、来源准入或 Gate 2。不得回写正式 source 配置、添加 pagination opt-in，或将测试 cursor 复制到 preview/production。请求包已更正原“零 initializedAt”硬阻塞，见 [P3 单源请求包](P3_NEXT_SMALL_COLLECTION_PACKET_2026-10-06.md) 与 [Sol 范围裁定](S1_P3_LIMITED_LEGACY_COLLECTION_SCOPE_2026-10-06.md)。

root核销后仅执行一次新disposable `_test`库collector，结论为`PARTIAL_LIMITED_SAMPLE`，不代表source pass、90日覆盖或Gate 2。实际3/12次GET dispatch（列表+两条精确allowlist详情），文章2条，fetch_run 1；一条正文`ok` 1659字符，另一条`pending/non_article_container`且相邻PDF未请求。source仍disabled/fulltext关闭；`initializedAt`/`lastOkAt`只记录单次测试运行。queue中`content.analyze`与`content.extract-body`各一条created、started/completed为0，analysis/receipt/publication/selected/job_run均0。live列表body为gzip，而live guard未解压后验证候选在parser边界的exactness，故保留PARTIAL；之后通过的offline gzip canary不追溯证明live。preview在运行前后只读核验仍为35 migrations、3 disabled/fulltext-off sources、3空body articles、3 publications、fetch/analysis/receipt/selected/job_run为0；未触及preview。详情、raw哈希与证据版本边界见[检查点](HANDOFFS/P3_SMALL_COLLECTION_CHECKPOINT_2026-10-06.md)及[请求包结果](P3_NEXT_SMALL_COLLECTION_PACKET_2026-10-06.md)。

阶段仍`P3 IN_PROGRESS`、Gate 2 `NOT_PASSED`、source admission `NOT_ADMITTED`、coverage `unproven`。本次仅增加一页两条详情的有限证据，live gzip listing候选边界未证明、第二篇正文pending；不可再用本次核销重跑，也不可把测试cursor复制到preview/production。OCR继续`OCR_DEFERRED_NOT_GATE2_BLOCKER`。后续source评估须另行确定范围与核销。

## 2026-10-03 本机诊断与fresh质量回归增量

新本机观察器见 [P3抽取诊断报告](P3_EXTRACT_DIAGNOSTICS_2026-10-03.md)：在固定 `_test` 库与唯一 loopback fixture 中通过2/2 focused tests验证能捕获 `identity_mismatch`、`short_body_not_allowed`、成功无reason、无关日志隔离与异常后恢复。该fixture仅验证日志观察器；9/4旧URL的reason仍unknown且不重试。随后经Root核销，在全新 `fiscalhot_oct03_diagnostic_live_test` 库对保存列表中2026-07-14会计司文章 `https://kjs.mof.gov.cn/gongzuotongzhi/202607/t20260714_3993483.htm` 做了一次direct extract：Undici 8.11.2 hard cap=1，attempted/dispatched/rejected=1/1/0，create/sendHeaders/headers各1、HTTP 200、无request error；最终 `unconfirmed`、`failureReason=attachments_unprocessed`、revision=1、正文长度0、hash为空，publication/analysis/receipt/job_runs均0。该reason表示helper检测到至少一个PDF样式链接后按安全策略拒绝，未保存HTML，因此真实文件类型及附件与正文/业务内容的关系unknown；拒绝发生在身份/表格/正文长度核验之前。来源禁用、全文关闭；不跟附件、不重试，不宣称历史首次访问或新增覆盖。该reason只对本URL此次响应成立，不外推其他会计司正文或Gate结论。测试进程环境安全开关保持false；fixture测试为本地HTTP读取临时放宽进程内backend config，但source前缀仅允许该loopback fixture，且finally恢复。未调用模型或OCR。

`e7fac2b23b3e0baa375f273a97edbdf8c1c37584` 已push，GitHub Check run [37088146532](https://github.com/revercgy-hub/MYHOT/actions/runs/37088146532) 全绿；CI backend tests 213项，212通过、0失败、1个Windows-only monitor跳过。Windows fresh `_test` 数据库完成35 migrations；本机typecheck、`npm test`、Web build、Web tests 15/15和loopback smoke 30项均成功。新诊断wrapper另经Root核销对July14候选发送一次真实单篇GET，状态与限制见下方和[Gate 2下一批报告](P3_GATE2_NEXT_BATCH_2026-10-03.md)；本轮无OCR或模型调用。

既有 preview `fiscalhot_preview_test` 在服务启动前及smoke后各做一次只读SQL核验，结果相同：35 migrations、3 sources均disabled/fulltext=false、3人工样本 `body_status=none/revision=1` 且正文为空、3 publications、analyses/receipts/job_runs均0。API/Web/PostgreSQL仅监听 `127.0.0.1:3001/3000/5432`；未启动worker或监听55432。启动脚本显式关闭COLLECT/MODEL/JINA/IndexNow/Feishu/private-network环境开关，`.env`不存在。见[10/3 P3诊断检查点](HANDOFFS/P3_DIAGNOSTIC_CHECKPOINT_2026-10-03.md)。

`CURRENT_SHA=d9b2433b9f032cdab7cccd07b549df7fb07ebb18` 是本轮文档更新前经 `git rev-parse HEAD` 实测的分支HEAD；本轮文档改动未提交，最终文档提交HEAD未知，不推测。此前的 `21cd590...` 是旧审计基线，不是当前HEAD。`SOURCE_CONFIG_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79` 是来源配置代码提交。`CI_TESTED_SHA=8e845812b6ce1db45821ade7b2162a90f589e1de` 对应成功的 Check run 36647432023；较早 run 36589569943 的 `PREVIOUS_CI_TESTED_SHA=dafe9386838f6423dba8e08c51cd9114066992f` 也通过。CI tested SHA 早于本轮HEAD，仅覆盖通用Linux测试/构建，未验证真实官方PDF解析；此轮 docs-only 未重跑typecheck/npm test/web build。S1阶段依赖裁决 `ARCHITECTURE_PHASE_DEPENDENCIES.md` 仅批准范围，Gate 2仍未通过。阶段交接记录见 [HANDOFFS](HANDOFFS/README.md) 及 [P3检查点](HANDOFFS/P3_CHECKPOINT_2026-09-30.md)。

**历史时点说明**：上段 `d9b2433...` 和 `21cd590...` 是2026-09-30及更早审计时引用的Git快照，并非当前工作区的损坏或当前SHA。此处历史上下文的 `CI_TESTED_SHA=aaea...` 是更早工具代码成功的CI；当前tested code SHA与CI状态见文首及下方2026-10-03新S1增量。

## 2026-10-02 新证据与预览质量复核

**阶段仍为 `P3=IN_PROGRESS` / `Gate 2=NOT_PASSED`。** 五源只读检查报告见 [P3_SOURCE_CHECKPOINT_2026-10-02.md](P3_SOURCE_CHECKPOINT_2026-10-02.md)：按当前配置各取官方首页一次，HTTP均200，backend Undici dispatch预算上限12、实际7/12、拒绝0，每请求的create/sendHeaders/headers事件均可见；另对会计司两篇既知 `unconfirmed` 详情各取一次只读HTML。没有运行collector、写数据库、请求附件、启动worker或调用模型；此证据不追认9/30核心/区域批次的历史HTTP计数。

五源快照：会计司本次解析10项，对9/30 collector accepted URL集合9/10相同；旧9/29原始HTML parser仅命中5项，故不能把与之差异的5项一概视为新发布。预算司10/10项与9/30 accepted集合及9/29原始HTML重合，但列表最新日仍为2026-03-26、最旧日2023-07-24。财政部监管局汇总页8项，对9/30快照5/8重合（新进3、退出3）；厦门监管局10/10项与9/29、9/30均重合；OMO 20/20项与9/30重合，对9/29为19/20，新第192号进入、9/3第173号退出。均为快照差分，不等于跨周期稳定性；详情HTML审查显示会计司一篇 `.TRS_Editor` 仅24字并提供XLSX，另一篇有323字、1表格且低于当前抽取门槛，不请求附件、不修改存量正文状态。中央汇总厦门稿与厦门当前窗口无exact URL交集，不是运行时跨源去重证据。

预览环境由本轮恢复：`pg_ctl`启动既有 `.data/test-pg/cluster`，仅使用 `127.0.0.1:5432` 的 `fiscalhot_preview_test`；不触碰55432集群。API/Web在 `127.0.0.1:3001/3000`，SQL只读确认35 migrations、3个source均disabled且两项全文关闭、3篇固定人工样本正文状态`none/revision=1`、3条publication均`score=NULL`、`selected=false`、`eligible=true`，analyses/receipts/job_runs均0。API health、Web `/`、`/all`、`/api/site/pool`为200，页面带 `noindex, nofollow`。`node scripts/smoke.ts --base http://127.0.0.1:3000` 本轮输出29项全绿；旧检查点记30/30，差异成因未核实。API环境显式关闭采集、模型、Jina、IndexNow、Feishu与私网开关；无应用worker。API第一次以本机用户名尝试连接数据库并返回503，识别原因后改用 `postgres@127.0.0.1` 重启，最终核验均通过。

扫描PoC仍为9/30 `BLOCKED_BEFORE_OCR`：旧固定commit `87416418657359cb625c412a48b6e1d6d41c29bd` 已记录，model请求流30秒中断、bytes未保存、license未取、OCR/gold `NOT_RUN`。本轮未发训练文件请求。新S1 [P3范围裁定](S1_P3_OCT02_SCOPE_REVIEW.md) 已批准一个独立准备批次(scope only)：复用immutable commit，不再请求版本API；模型与同commit LICENSE各一次、redirect=0/no retry、32MiB/1MiB上限、每请求120秒/全批240秒。执行仍依赖工具owner完成本地fake-response验证及Lead核销；旧失败目录保留，新尝试用独立ignored目录。训练数据取得不等于OCR放行；OCR仍需监控/timeout/kill-wait实测前置，本S1不改变Gate 2或业务集成范围。

Sol正式裁定记于 [S1_P3_OCT02_SCOPE_REVIEW.md](S1_P3_OCT02_SCOPE_REVIEW.md)：批准上述新准备批次；拒绝会计司 `table-only` 配置，批准 `.TRS_Editor:has(table)` 与 `p + p` 并集候选的固定行业fixture验证范围。B新增 `tests/fiscal-accounting-body.test.ts` 和5份fixture，focused test 6/6通过；但union错收短多段通知与装饰表格，较收窄CSS仍误收装饰表，故 `industry/sources.json` 未改，候选配置未核销。详见 [P3_ACCOUNTING_BODY_FIX_2026-10-02.md](P3_ACCOUNTING_BODY_FIX_2026-10-02.md)。A完成OCR工具fake-child/fault focused tests 17/17；领导仅核销fake-child证据，未核销长cadence或放行OCR。Lead批准独立准备批次后A仅发出1次模型文件请求：HTTP 200、Content-Length 2,469,156，但70.7秒后仅收16,384字节并 `TypeError: terminated`，无EOF/hash，不是120秒deadline。遵照S1停止，无重试、无许可证请求，文件未写入，manifest为incomplete，OCR未运行；旧9/30失败目录保留。详见ignored `.data/fiscal-qa/scan-ocr-poc-20261002/prepare-failure.json`。

**本轮全套质量检查**：`npm run typecheck`退出0；fresh `fiscalhot_oct02_full_test`数据库完成35项migration，`npm test` 184/184；`npm run build -w @aihot/web`成功，Web tests 15/15。完整后端测试使用 `MODEL_CALLS_ENABLED=true`，测试由本地stub provider处理；AIHOT_CREDENTIALS_DIR指向不存在的测试目录，采集/Jina/IndexNow/Feishu/私网开关均显式false。共享预览服务在较长测试后未监听，首次smoke 30项全部因连接失败；按既有设置恢复loopback PG/API/Web后，`node scripts/smoke.ts --base http://127.0.0.1:3000` 29项全部通过。差异计数原因未知。未运行OCR，未启动worker，未改来源或预览数据库。

## 安全和验证环境

- `.env.example` 的COLLECT、MODEL、JINA、INDEXNOW及两项FEISHU开关均为false；本地无持久.env。当前12个source均为`enabled=false`且全文开关关闭。Check workflow显式关闭采集/Jina/IndexNow/Feishu。
- 完整npm test的provider集成测试仅在测试子进程设置MODEL_CALLS_ENABLED=true，并指向本地127.0.0.1假服务、使用test key；这不调用真实provider。第一次错误保持MODEL=false导致25个stub测试失败，该尝试无效；fresh重跑按隔离stub约定通过156/156。
- Windows测试使用官方EDB PostgreSQL 17.11-3，数据位于忽略的.data/test-pg。fresh `fiscalhot_content_preview_test` 完成35项migration，`npm test` 156/156；typecheck通过。Web build与`apps/web/tests/*.test.ts` 15/15通过。seed在独立 `fiscalhot_preview_test` 双轮执行：首轮3 created，次轮3 unchanged；每篇article/publication/override版本各1。SQL核验score/reason null、selected/analysis/fulltext/selected-ledger/state/receipt/job均0；API pool 3条、选中snapshot0条、RSS全量摘要带人工标记。2026-09-30本轮将既有 `.data/test-pg/cluster` 与仓库配套EDB PostgreSQL binaries恢复，数据库 `fiscalhot_preview_test` 经只读SQL确认为35 migrations、34 topics、3 articles、3 publications；3 sources disabled且全文关闭，pool API返回3条、score/reason为空、selected=0、analysis/receipts=0。预览当前Web `127.0.0.1:3000`、API `127.0.0.1:3001`、PostgreSQL `127.0.0.1:5432`均只绑loopback；smoke 30/30通过。Node服务在两个可管理exec会话中运行，无应用worker；`NODE_ENV=development`、仅Web `LOCAL_PREVIEW_ENABLED=true`，采集/模型/Jina/IndexNow/Feishu/私网开关false、DEV_AUTH为空。此次没重跑完整测试或CI。Ubuntu Check run [36647432023](https://github.com/revercgy-hub/MYHOT/actions/runs/36647432023) 对 `CI_TESTED_SHA=8e845812b6ce1db45821ade7b2162a90f589e1de` 的通用检查通过；该HEAD包含来源代码0ec0704，但不是最终文档HEAD。此前run 36589569943测试SHA为dafe9386838f6423dba8e080c51cd9114066992f，也已通过。真实官方PDF未在Linux解析。厦门债第十六期PDF仅一次受限请求：200、`application/pdf`、457111字节、无重定向；parser `pdf_page_no_text`，无页数或字段返回，失败摘要保存在ignored目录，原始bytes未保存，也不据此推断所有页面皆扫描件。不要提交.data或凭证。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。

## 2026-10-03 原10/2范围恢复与代码质量核验

本节只更新10/2已批准交付的状态，不纳入本日其他独立proposal。代码测试基线为 `26ca72f2b94d37383072c0e54be6f94682b0e9bd`，包含OCR process/prepare wrapper与17项测试，以及会计正文helper probe、6项focused测试和5份固定HTML fixture；`industry/sources.json`无diff，未改数据库/schema/采集器。`npm run typecheck`退出0；新隔离数据库 `fiscalhot_oct03_verify_test` 从空库执行35项迁移；全套 `npm test` 184/184、Web build、Web tests 15/15通过。可复核日志在ignored `.data/test-pg/oct03-npm-test.log` 和 `.data/test-pg/oct03-final-verification.log`；smoke输出在 `.data/test-pg/oct03-smoke.log`，30个检查全绿。

预览仍连接既有 `fiscalhot_preview_test`，只读查询为3 source全disabled/全文关闭、3固定样本`body_status=none/revision=1`、3 publication `score=NULL/selected=false/eligible=true`、analyses/receipts/job_runs均0。API `/api/health`和Web `/all`为200、`X-Robots-Tag=noindex, nofollow`；端口3000/3001/5432均loopback，未监听55432，无应用worker，`.env`不存在。10/2交接曾记录29项smoke通过；10/3本次明确数到30项，差异原因unknown，分别保留两次输出，不推断是脚本变化。测试provider由本地stub提供，测试credentials目录不存在，副作用开关显式false。没有运行OCR或发训练文件请求。

A、B代码分别提交：`08492e0443b68dbffbe036f6b64ea9b6426655f8` 与 `26ca72f2b94d37383072c0e54be6f94682b0e9bd`，已推送到明确remote `https://github.com/revercgy-hub/MYHOT.git` 的 `feat/fiscal-finance-hot`。GitHub workflow `check.yml` 的push自动触发仅限main，故对feature分支手动dispatch Check run [37077418870](https://github.com/revercgy-hub/MYHOT/actions/runs/37077418870)，tested SHA `26ca72f2b94d37383072c0e54be6f94682b0e9bd`，最终失败：Docker job通过；check job的install、typecheck、Web build/tests、migrate/seed和smoke通过，backend tests为183/184。单一失败是Windows-only真实PowerShell monitor test在Ubuntu找不到 `powershell.exe`（ENOENT），属测试的平台可移植性缺陷；Windows本地全量tests为184/184。该跨平台修复由OCR代码owner后续处理。Gate 2仍`NOT_PASSED`，12源保持关闭。

完整恢复记录见[10/3 P3检查点](HANDOFFS/P3_RECOVERY_CHECKPOINT_2026-10-03.md)。本状态文档提交晚于上述测试代码SHA；最终文档HEAD以Git日志为准，不把未来提交SHA写成事实。

## 2026-10-03 新S1实现、实测与远端CI

10/3 S1范围裁定见 [S1_P3_OCT03_IMPLEMENTATION_REVIEW.md](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md)。正文策略与离线GitHub API准备实现按批准范围落地；会计司精确 `bodyPolicies` 已由Lead核销，`mof-accounting-notices` 仍为 `enabled=false`、全文开关关闭。代码拆为两个小提交：正文策略/入口/配置/行业值与fixture `9719580`，OCR准备工具及其测试 `9bfa0d1`；tested code SHA为 `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651`，推送到明确remote `origin=https://github.com/revercgy-hub/MYHOT.git` 的 `feat/fiscal-finance-hot`，push前后remote SHA一致。

本地fresh质量回归：新隔离库 `fiscalhot_oct03_quality_test` 从空库执行35项migration；`npm run typecheck`退出0；`npm test`为211/211；`npm run build -w @aihot/web`成功；`node --test apps/web/tests/*.test.ts`为15/15；loopback smoke为30/30。离线focused结果为OCR 34/34（Windows真实PowerShell短fake-child与故障测试）、新正文策略9/9 + 旧selector characterization 6/6、source-rules 7/7、sources 14/14。GitHub Check run [37078956435](https://github.com/revercgy-hub/MYHOT/actions/runs/37078956435) 的tested SHA同为 `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651`，Docker与check两个job均success；check包含install、typecheck、Web build/tests、migration/seed、smoke、backend tests。旧SHA run [37077418870](https://github.com/revercgy-hub/MYHOT/actions/runs/37077418870) 的平台失败是修复前历史记录，不与新绿CI混淆。

preview只读复核：`fiscalhot_preview_test`有35 migrations、3条source均disabled、3条固定人工article均 `body_status=none/revision=1` 且 `body_text/body_html`为空；3条publication均 `score=NULL/selected=false/eligible=true`；analyses/receipts/job_runs均0。PostgreSQL/API/Web只监听 `127.0.0.1:5432/3001/3000`；health、`/`、`/all`、pool API为200且返回 `X-Robots-Tag: noindex, nofollow`；无应用worker、`.env`不存在。测试provider只指向localhost stubs；测试时COLLECT/JINA/IndexNow/Feishu/private-network flags关闭；OCR执行锁仍false。smoke本次30项通过；10/2记录29项通过，差异原因unknown，两次输出均保留。

两项另行授权的单次操作均有独立证据。OCR新目录 `.data/fiscal-qa/scan-ocr-poc-20261003/` 已取得固定commit `87416418657359cb625c412a48b6e1d6d41c29bd` 的模型与LICENSE；manifest记录恰好3次GitHub API请求、均200、总耗时2,911ms，模型2,469,156字节、许可证11,358字节，EOF、Git blob SHA-1、SHA-256及Apache-2.0身份校验通过。QA重新调用本地 `assertPreparedManifest()` 并读取两文件验证一致；9/30、10/2旧失败目录保留。`run.json`/run lock不存在，`OCR_RUN_ENABLED=false`，没有运行Tesseract或图片/gold比较。详见 [P3 OCR API准备结果](P3_OCR_API_PREPARE_2026-10-03.md)。

会计司单篇验证见 [P3正文策略结果](P3_ACCOUNTING_BODY_POLICY_2026-10-03.md)。新隔离库 `fiscalhot_oct03_accounting_live_test` 有35 migrations；source disabled、仅一条固定article。对固定短表名单URL的direct `extractArticleBody()`仅执行一次，Undici `maxRequests=1`实际`attempted/dispatched/rejected=1/1/0`，HTTP 200，无redirect/retry/第二请求；最终 `body_status=unconfirmed/revision=1`，无正文和内容hash。原始响应未保存，runner漏记helper decline reason，故拒绝原因unknown。此为正文未确认，不是source通过；不重复请求、不猜测原因，9/9离线结果不能覆盖此失败。

本日没有重跑collector、批量source抓取或修改preview DB；单篇live验证只触及独立新 `_test`库。Gate 2继续 `NOT_PASSED`，12个生产source均保持disabled/fulltext关闭。下一步先离线审查一次请求内持久化structured helper reason所需的最小诊断方案；再次访问官方详情前须由Lead单独核销新请求边界。训练文件准备完成不自动授权OCR，保持执行锁及 `OCR_RUN_ENABLED`关闭。以上工具和有限正文证据不代表长期来源质量、完整栏目覆盖或Gate通过。

## 2026-10-03 P4/P5离线准备与P6/P7准入增量

新P4只读样本准备器和P5 Gold schema validator通过本机fresh回归；实际模型调用/分析写入为0。P4 planner的`ready`仅描述read-only快照候选状态；P5模板8条人工决策均为null/needs_review，校验结果`DRAFT_INCOMPLETE`，并非Gold。真实P4 provider缺失：无`.env`且provider环境变量不存在。详细测试、数据库/服务边界和阶段条件见[执行计划](P4_P7_EXECUTION_PLAN.md)、[最新准备检查点](HANDOFFS/P4_P7_PREPARATION_2026-10-03.md)、[Gate 2行动清单](GATE2_ACTION_CHECKLIST.md)、[用户决定表](GATE2_USER_DECISIONS.md)、[逐局覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[P4报告](P4_PILOT_READINESS.md)与[P5报告](P5_GOLD_DATASET_READINESS.md)。Gate 2仍NOT_PASSED；用户决定1要求逐局覆盖但尚未逐项核验；决定2内容规则已确认但未实现/评估，决定3附件退化策略已确认但未实现；决定4 daily检查目标已确认但未实现；决定5首轮90天回填已确认但代码默认12个月尚未改；P4/P5正式阶段、P6扩源、P7/Gate4均未完成。


## 2026-10-04 用户Q4决定增量

用户确认Q4选项C：上线后所有来源每天做一次更新检查。只确认频率，不含具体执行时刻或失败重试/恢复策略；目标schedule未实现或验证，现有120分钟常规源和360分钟监管动态配置没有更改，也未启用采集、模型或worker。此时Q5回填范围问题仍待答复；后续用户决定见下方增量。没有因此创建定时任务、自动化或新的网络/数据库/model操作。

## 2026-10-04 用户Q5回填决定增量

用户确认首次上线回填近90天；历史稿必须保留原发布日期，不冒充当天新稿，且不能删除数据库现有数据。随后12条disabled行业source JSON设置`initialBackfillMonths=3`，通用collector默认12个月未改；该值按30天/月计算且无发布日期条目仍可进入，故严格90天边界未实现。daily目标也已写入12条source JSON（1440分钟），但配置未导入数据库，所有来源仍disabled，未运行采集或worker。内容prompt已按决定2更新措辞，无真实模型评测。附件待解析/禁止自动精选仍未实现，待S1最小范围裁定。本状态不表示已完成任何Gate或开始回填。Q1逐局覆盖、Q2内容边界、Q3附件降级、Q4每日检查、Q5首次90天回填均已确认，但不等于全部实现或Gate 2通过。P4真实provider配置仍缺失且属Gate 2后事项，不重复询问。

## 2026-10-04 已确认规则的行业配置、提示词与fresh QA增量

代码提交 `d7b49539e6981cff99b71c6f57c7053e2cda5b40` 将现有12个行业source目标间隔设为1440分钟、`initialBackfillMonths=3`；`79a0f44330b50fe562ba54a03051c271cbc378e6`仅改动`industry/prompts/prefilter.md`与`selection-score.md`，落实已确认的业务事实边界措辞。GitHub Check [37137271384](https://github.com/revercgy-hub/MYHOT/actions/runs/37137271384)对prompt代码SHA全绿（backend 234项/233 pass/0 fail/1 skip，Web 15/15；docker/check均success）。本机fresh全套与边界、完整SHA和日志路径见[交接检查点](HANDOFFS/CONFIRMED_RULES_2026-10-04.md)、[source配置审计](CONFIRMED_RULES_IMPLEMENTATION_AUDIT_2026-10-04.md)及[内容边界报告](CONTENT_BOUNDARY_IMPLEMENTATION_2026-10-04.md)。所有12个source仍`enabled=false`，全文关闭；配置没有导入source数据库行，未运行daily schedule、采集或worker。严格剔除无日期的首次候选，以及附件失败后的待解析持久状态/自动精选阻断均未实现；所需最小S1本轮因agent thread capacity未取得，未绕过审查。内容prompt通过文本更新而非人工Gold或模型输出验证。Gate 2仍`NOT_PASSED`；P4/P5仅离线准备，provider缺口保留在Gate 2后，P6/P7未完成。

## 2026-10-08 恢复检查点：有界P4软件QA与GovCN单篇候选

本节覆盖当前HEAD `99c3a9a3a1da91457eb2fdda81b1694d217b0511`，并 supersede 本文较旧的executor待测/46-source及Gate 2未通过措辞；较早记录保留为历史。正式Gate 2结论不变：`PASSED_FOR_BOUNDED_P4_PILOT`，仅三个指定核心来源中逐篇核验合格的固定小样，不代表全source admission或Gate 3/4完成。当前目录47 sources、精确41个strict body-ready opt-ins；所有来源disabled且全文/转发全文关闭。新加的`govcn-policy-library`为单页、summary-only、disabled候选，不是来源通过。

代码`57647d9`后的P4 executor五个输入漂移场景由fresh 35-migration隔离库各自验证1/1、provider POST 0、无执行report：revision、content hash、media、source config与provider model。完整精确QA数据库分别为`fiscalhot_p4_fx_rev3_20261008_test`、`fiscalhot_p4_fx_hash4_20261008_test`、`fiscalhot_p4_fx_media4_20261008_test`、`fiscalhot_p4_fx_src3_20261008_test`、`fiscalhot_p4_fx_provider3_20261008_test`；typecheck exit 0。日志位于ignored `.data/test-pg/p4-fault-next-v3-20261008/`及`p4-fault-next-v4-20261008/`。测试单文件提交`b0a0eeb59e19c696b94e045d2d6d3dcb08a69ea1`的GitHub Check+Docker run [37743439955](https://github.com/revercgy-hub/MYHOT/actions/runs/37743439955)成功。N+1既有receipt/预算边界、预算漂移拒绝、持久化失败等其余fault paths仍未证明，不能按已覆盖处理。

GovCN精确保存pair离线验证对应当前候选：目录raw与详情raw fixture逐字节相同，分别34,046 B / SHA `b6df9bf38ff165c672154b3696c30e4cc7c2e9965523a267be4afc4b59a89d35`和61,625 B / SHA `49a45d9fd5ea90f53978736363c005d9ee819ff613b1093424b29183e4a7c61d`。1个5行JSON summary候选映射精确配对一篇2026-09-28政策详情；没有完整目录/90日覆盖、source admission或新HTTP结论。独立本地Gov fixture测试6/6，QA fresh 35-migration数据库`fiscalhot_govcn_compat_focus_20261008_test`及`fiscalhot_govcn_compat_full_20261008_test`；typecheck、指定Gov/selected-body/PDF/source-rule focus 46/46、backend 322/322、Web build、Web tests 15/15通过。官方saved raw与回放/数据库QA不涉及生产source或preview数据。GitHub Check+Docker run #37744820133 对当前代码SHA `99c3a9a3a1da91457eb2fdda81b1694d217b0511`成功；前一run #37743439955测试的是前一test-only SHA `b0a0eeb`。

本地preview smoke在重新加载当前API代码后30/30、exit 0；日志在ignored `.data/fiscal-qa/preview-smoke-20261008/post-gov-smoke.log`。`fiscalhot_preview_test`启动前后只读SQL均为35 migrations、3 sources（0 enabled / 0 fulltext）、3 articles、3 publications、0 analyses/receipts/fetch_runs/selected/job_runs；仅API标准健康心跳在`settings`中。API/Web仍仅监听`127.0.0.1:3001/3000`，PostgreSQL仅`127.0.0.1:5432`；未启普通worker。模型、采集、推送、Jina、embedding、私网和egress-proxy开关均关闭，真实HTTP/provider/OCR/付费调用0。

可无付费推进：bounded executor尚未覆盖的失败路径软件测试、GovCN固定候选的后续配置/离线审查与其他来源主线最小工程补证、只读planner/负例核验、Gold schema与评测工具准备。人工Gold标签仍需领域人员决定。延期/未获授权：用户已选择暂不付费，故DeepSeek真实执行继续deferred且不再询问20/10；OCR仍按既有用户决定延期；生产/NAS/Staging部署及真实采集/常驻worker保持未启动。Gate 2 bounded pilot已通过，其它来源质量、首次90日覆盖、Gate 3/4不宣称完成。
