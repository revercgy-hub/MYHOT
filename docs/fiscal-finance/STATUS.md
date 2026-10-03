# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=1a15e3449e281ab4ce2137926f753a3f8a188f4a（2026-10-03 P4/P5离线准备代码SHA；GitHub run 37111577268对同SHA成功。最新docs-only HEAD由检查点与Git记录区分）
SOURCE_CONFIG_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79
CI_TESTED_SHA=1a15e3449e281ab4ce2137926f753a3f8a188f4a（GitHub Check run 37111577268，success）
CI_TESTED_RUN=37111577268
CI_PREVIOUS_FAILED_SHA=26ca72f2b94d37383072c0e54be6f94682b0e9bd（run 37077418870；平台修复前的历史失败仍保留）
CI_PREVIOUS_FAILED_RUN=37077418870
PREVIOUS_CI_TESTED_SHA=8e845812b6ce1db45821ade7b2162a90f589e1de
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3仍进行中：新增监管局两源完成完整首页各两轮collector、18篇正文与相邻历史页核验；会计司/预算司两个核心源完成完整首页各两轮、正文最多12篇核验；OMO新增一次9/29→9/30首页跨日更新。两批HTTP计数hook失效、hop预算未证；仍缺更长周期、深页/栏目覆盖、区域短正文与正文失败原因处置。本地3样本人工预览已恢复；Gate 2尚未通过。
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集。S1范围裁决`ARCHITECTURE_PHASE_DEPENDENCIES.md`的`DECISION=APPROVED`仅适用依赖范围，不等于Gate 2通过。
REVIEW=Sol Gate 1 Review已由Lead核销修复并通过；AD-008日期/titleAttribute、AD-009短正文与PDF PoC、AD-010附件envelope、AD-011 route文案及AD-012本地人工样本预览均按批准范围实施。fresh fiscalhot_content_preview_test 35 migrations后 npm test 156/156；AD-012 focused guard 4/4、typecheck、web build、web tests 15/15、smoke 30/30通过。Ubuntu Check run [36589569943](https://github.com/revercgy-hub/MYHOT/actions/runs/36589569943) 对 tested SHA `dafe9386838f6423dba8e080c51cd9114066992f` 全绿；验证通用 Linux 测试/构建，不含真实官方PDF解析。厦门第十六期PDF完成一次受限 GET，解析状态 `pdf_page_no_text`；未得到页数/字段，也未保存原始 bytes。Gate 2未通过。
LATEST_CI=GitHub Check run [37111577268](https://github.com/revercgy-hub/MYHOT/actions/runs/37111577268) 对 `CI_TESTED_SHA=1a15e3449e281ab4ce2137926f753a3f8a188f4a` 成功，Docker与check jobs均success；CI backend tests 234项、233通过、0失败、1跳过（Windows-only monitor），Web tests 15/15。CI仅是代码software checks，不代表Gate 2/3/4、真实provider或来源覆盖验收。
CURRENT_TURN=12源仍全部disabled、全文关闭。核心会计司/预算司全首页隔离批次：accounting两轮 `10/10/10/0 → 10/10/0/0`，预算司 `10/1/1/0 → 10/10/9/0`，第二轮实际新增9篇旧文。20篇中尝试正文12篇，6 `ok`、6 `unconfirmed`，8 `pending`；失败原因unknown，20个extract jobs未消费。区域完整首页隔离批次：中央/厦门两源 `8/8/8/0→8/8/0/0`、`10/10/10/0→10/10/0/0`，18篇全`ok/rev2`、第二轮0新增。两个批次Undici dispatch计数hook均未命中；核心批次真实hop数unknown，区域至少25次guardedFetch调用且总hop unknown，预算上限均不能判通过。后续新增离线 `scripts/fiscal/p3-http-budget.ts`，以backend Undici Agent/ProxyAgent dispatch admission计数、阻止第N+1次 dispatch；5项localhost测试通过。它仅覆盖该后端Undici实例，不含OS全局请求、其他Undici副本、worker、私网旁路和proxy CONNECT内部；这不追认历史批次预算。本段旧批次总结未含后续单独核销；唯一新增的July14会计司单篇详情诊断已执行，见本文件2026-10-03增量。区域跨源identity overlap为0、运行时dedupe unknown；短正文、长期窗口、深页和更多来源仍未验。OMO有9/29至9/30第191→192号首页变化，20项窗口一入一出；仅一次跨日证据。会计司列表/详情/正文日均9/22，旧9/21说法为UTC切日/URL误读；厦门证监API列表/可见日均9/15，9/23生成元数据语义未知。Lead已接受福建现金管理PDF23行、厦门债PDF单页的双Luna人工核对，仅为`manual_sample_evidence=ACCEPTED`，不表示机器正文`ok`、来源验收、Gate2、P4或publication。扫描路线提案见 [P3_SCAN_BODY_PROPOSAL.md](P3_SCAN_BODY_PROPOSAL.md)，限域PoC已按S1尝试一次固定五页路线，但`chi_sim.traineddata`请求在30秒时限中断；因无重试授权，OCR/gold对照均`NOT_RUN`，详见 [P3_SCAN_OCR_POC_RESULT.md](P3_SCAN_OCR_POC_RESULT.md) 和独立gold审阅。OCR不是Gate2通用前置。
BLOCKERS=Gate 2尚未满足：首页滑窗/跨周期、核心正文缺口及各源实际覆盖证据仍不齐；用户已确认首阶段逐一覆盖全国财政部地方监管局新闻动态栏目，但35局实际栏目、入口与质量尚未逐项映射/验证，中央选登仅作补充。历史hop unknown仅不可追认，可由未来经审计的新范围证据替代。P4真实provider配置/凭据当前缺失；Gold只有8条草稿且全未人工确认；P6的25–35候选调查与P7验收尚未开始。

COMPLETED=P0接管；财政金融静态改造和Gate 1；12源disabled配置与preview；P3三源30篇列表两轮和正文验证（29 ok/1 unconfirmed）；AD-009/AD-010单篇隔离提取；OMO第191/192号样本和一次跨日首页变化；区域相邻历史页、双来源完整首页两轮和18篇正文；会计司/预算司完整首页两轮、12篇正文尝试并得6 ok/6 unconfirmed，8篇pending；会计司/厦门证监日期口径审计；福建现金管理四页23行、厦门债券单页字段双Luna人工图像复核，Lead接受为有限P3人工样本事实。以上不改变机器失败状态、来源验收或Gate结论。通用Linux CI未解析真实官方PDF，两个新批次hop预算均未证。
IN_PROGRESS=P3/Gate 2继续进行；用户已确认首阶段逐一覆盖全国财政部地方监管局新闻动态栏目，35个目录/域名仍待离线映射实际栏目、入口和质量，未映射/验证项不计覆盖，中央选登只作补充。当前仍只有12个disabled配置source。P4只完成只读pilot planner准备、P5只完成Gold元数据validator/模板；两者focused和fresh软件回归通过，不构成正式P4模型验证或P5人工Gold评测。P4模型执行需Gate 2正式通过、用户/负责人提供真实provider配置及单独授权。P6一般25–35 feeds尚未调查，P7和Gate 4未进行。详见逐局覆盖矩阵和最新P4-P7检查点。
NEXT=继续完成P3 Gate 2既定覆盖、首页窗口/跨周期与正文质量证据。按[逐局覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)逐一核实35个财政部地方监管局的新闻动态栏目；中央选登只作补充，未映射/核验项不计覆盖。用户决定2已确认内容边界规则（内部活动无实质业务事实排除；政策/问题发现/监管措施/调研成果纳入；地方一手不降优先），但规则尚未实现为自动过滤器；用户决定3已确认：无法可靠解析的业务附件保留原始URL、正文待解析且不自动精选，后续补解析能力；该策略尚未实现于应用。用户决定4轮询频率方案已询问待答；按[Gate 2行动清单](GATE2_ACTION_CHECKLIST.md)推进可离线工作，并按[用户决定表](GATE2_USER_DECISIONS.md)逐项确认后再由Root决定正式Sol审查。Gate 2正式通过前仅做P4/P5离线准备，不运行实际模型/worker；P6一般信源扩容与P7验收均未开始。详细阶段准入见[P4-P7执行计划](P4_P7_EXECUTION_PLAN.md)。

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

新P4只读样本准备器和P5 Gold schema validator通过本机fresh回归；实际模型调用/分析写入为0。P4 planner的`ready`仅描述read-only快照候选状态；P5模板8条人工决策均为null/needs_review，校验结果`DRAFT_INCOMPLETE`，并非Gold。真实P4 provider缺失：无`.env`且provider环境变量不存在。详细测试、数据库/服务边界和阶段条件见[执行计划](P4_P7_EXECUTION_PLAN.md)、[最新准备检查点](HANDOFFS/P4_P7_PREPARATION_2026-10-03.md)、[Gate 2行动清单](GATE2_ACTION_CHECKLIST.md)、[用户决定表](GATE2_USER_DECISIONS.md)、[逐局覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[P4报告](P4_PILOT_READINESS.md)与[P5报告](P5_GOLD_DATASET_READINESS.md)。Gate 2仍NOT_PASSED；用户决定1要求逐局覆盖但尚未逐项核验；决定2内容规则已确认但未实现/评估，决定3附件退化策略已确认但未实现；决定4轮询频率待答；P4/P5正式阶段、P6扩源、P7/Gate4均未完成。
