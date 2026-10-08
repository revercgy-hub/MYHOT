# 连续 P3 配置与验证交接（2026-10-07）

STATUS=IN_PROGRESS
STAGE=P3 / Gate 2 remediation
GATE=截至原2026-10-07记录时Gate 2 NOT_PASSED；2026-10-08正式review已批准`PASSED_FOR_BOUNDED_P4_PILOT`，仅限本交接末尾定义的三source逐篇合格小样
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=2e2a021ae5a5eaa614a758724480dc8b266f33e3（代码提交；本交接文件随后的文档提交另记于Git）
STAGE_CODE_SHA=2e2a021ae5a5eaa614a758724480dc8b266f33e3
BASE_SHA=e30353e36f2dbc09d35a9f7e54d917586639f295
WORKTREE=代码提交已push；本交接及共享状态/矩阵文档在后续docs-only提交中。

## 阶段退出条件与结论

本轮完成了冻结后的46项来源配置/fixture回归、独立保存响应核验、本地全套软件QA、代码push和同SHA GitHub Actions Check+Docker。它只证明本轮配置约束和测试范围内的软件行为，不满足Gate 2对35局栏目、窗口/分页、来源级日期语义、正文与附件降级、更新去重和跨周期稳定性的完整退出要求。所有source仍disabled、全文许可关闭，Gate 2保持`NOT_PASSED`。

浙江首期栏目由用户明确确定为“监管工作”；“图片新闻”作为后续补充。该决定不代表栏目历史完整或来源通过。P3/Gate 2的材料身份检查与P4事件语义聚类分开：P3要求对实际相同normalized URL/material identity的发现、更新、IDs及revision留证；无重叠写`not observed / runtime dedupe unknown`。语义事件聚类保留为`P4_REQUIRED_NOT_RUN`，不提升为Gate 2新退出条件。详细依赖和现行完整要求见[Gate 2 action checklist](../GATE2_ACTION_CHECKLIST.md)及[S1连续Gate依赖审阅](../S1_CONTINUOUS_GATE_DEPENDENCIES_2026-10-07.md)。

## 完成内容与可复核证据

在 `2e2a021ae5a5eaa614a758724480dc8b266f33e3` 代码检查点，来源配置为46项（45 `web_list`、1 `json_list`），含精确28个区域 `_aihot.requireBodyReadyForAutomaticSelection: true` IDs。其后获批的会计司中央精确ID例外见本交接末尾更新。全部来源仍`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；配置未导入或seed到preview/production。精确ID和operator边界见[operator notes](../STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md)；逐局实际观察和未完成项目见[regional coverage matrix](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)及[source matrix](../SOURCE_MATRIX.md)。

QA重新比对了本轮获准source/list/detail raw、manifest记录、byte length与SHA-256，并检查精确URL/最终URL、HTTP结果/EOF、列表候选到详情title/date映射、可见日期、正文清理和附件链接。首篇详情批次10/11成功；辽宁最先授权候选一次timeout、无重试，后来核准的另一篇辽宁候选成功配对。甘肃首页栏目锚点指向“工作动态”列表。甘肃详情title与列表相符，列表日、PubDate、可见日为2026-09-04，URL路径日期为2026-08-21，clean正文约2,923字符/16段且没有附件链接。甘肃列表、detail与manifest边界见[P3 remaining source gaps](../P3_REMAINING_SOURCE_GAPS_2026-10-07.md)。

末两篇精确详情（raw和manifest位于ignored `.data/fiscal-qa/continuous-source-gaps/last-two-details-20261007/`）均HTTP 200，列表/详情题名匹配且无附件链接。辽宁列表、PubDate、可见日为8月26日，URL token为8月13日；去除日期/来源前缀后的正文1,535字符/8段。云南列表、PubDate、可见日为8月27日，URL token为8月21日；clean正文1,656字符/9段。云南另一篇已知冲突详情`https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997764.htm`保留历史hold并按Sol批准的source-specific exact URL deny排除；新配对样本不裁定云南来源级日期权威策略。不要用URL路径替代发布日期，也不要把上述单篇样本描述为栏目标杆或source pass。其它accepted rows的有限详情与短文/内部活动边界见矩阵； synthetic fixtures仅测试selector/身份逻辑。

甘肃collector前置的loopback canary另由独立QA核验：成功manifest `.data/fiscal-qa/continuous-source-gaps/gansu-legacy-20261007/loopback-preflight.manifest.json` 为exit0、7/7 canaries passed，标记no external HTTP/no DB/no collector；两次失败的初始attempt manifest分别保留，没有覆盖。成功gzip response capture为4,488B、SHA `b6a3a91fbac3b6040423c1e8aa291a9a059c2a9882d2f770d1117ac310fa6090`；解压后12,555B逐字节等于已保存列表raw（SHA `2d30c52e5c3cd93e34dba0d183c971aadca43e2ddc27866ccaef9079dbc9f27e`），EOF为true，配置parser得到精确甘肃候选。canary覆盖确切source/URL范围、六个拒绝变体、redirect不follow、non-HTML零body、6 MiB压缩和解压限额及dispatch cap=2拒绝第三次。对配套`run-once.mjs`仅做静态核对：总时限60秒、HTTP 20秒、预算/dispatch各2、只接受指定loopback隔离库`fiscalhot_oct07_gansu_legacy_test`、保持source disabled和全文关闭、单一列表/详情目标各限1。该preflight并未运行实际collector，也不表示source pass。

之后root明确GO的一次甘肃有限legacy collector run已独立复核。`.data/fiscal-qa/continuous-source-gaps/gansu-legacy-20261007/live-run.manifest.json` native exit0；Undici cap `attempted/dispatched/rejected=2/2/0`，唯一列表和唯一详情GET均HTTP200/gzip/EOF，raw response capture独立hash及解压后字节与已保存list/detail逐字节相符。fresh `fiscalhot_oct07_gansu_legacy_test` 在loopback:5432、35 migrations，前计数全0、后source/article/fetch_run为1/1/1；run `ok, found=1, new=1`。已独立SQL核验文章detail精确URL/title、发布日期2026-09-04+08、`body_status=ok`、revision 1、2,923字符；从DB独立计算正文SHA与manifest一致。来源仍disabled/fulltext-off；没有analysis/receipt/publication/selected/job_run；仅一个`content.analyze` job为created，started/completed均null，无worker。此有限执行证明指定快照/文章在隔离collector路径里的处理，不证明daily轮询、历史/90日覆盖、故障恢复、全栏质量、source admission或Gate 2。此前两次preflight失败artifact保留。

另有一项零外网的P3 runtime replay（不是新增source准入）：`.data/omo-runtime-replay-20261007/manifest.json` native exit0，单独fresh 35-migration DB `fiscalhot_omo_runtime_replay_20261007_retry1_test`，Undici MockAgent `disableNetConnect=true`、external HTTP 0、exact four mocked requests。两份相邻日存档列表由当前配置解析各20候选，URL精确交集19；191号文章跨两轮保留同article ID、normalized URL identity、content hash、revision 1与单次discovery，192号文章新进入第二页窗口并新建一次；每篇详情各只请求一次。独立raw审计的四份SHA与保存raw匹配，title/PubDate正确；独立read-only SQL确认2个成功fetch_runs、2篇body-ok文章（各revision1）、0 receipts/models/analyses、2个created未消费的`content.analyze` jobs。模拟时钟只推进app生成的游标时间，数据库仍用真实墙钟；这证明一次相邻快照runtime行为，不是实时时间表、生产调度或daily可靠性，也不证明P4事件语义聚类。初次失败preflight用的另一个数据库保留且未复用。P3 URL/material identity与P4语义聚类仍按Gate清单分开。

本机全套QA在全新数据库`fiscalhot_p3_continuous_20261007_test`执行35 migrations：`npm run typecheck`通过；`npm test` 310/310通过、0失败、0跳过；`npm run build -w @aihot/web`通过；`node --test apps/web/tests/*.test.ts` 15/15通过；`node scripts/smoke.ts --base http://127.0.0.1:3000`全部检查通过。日志保存在ignored `.data/test-pg/continuous-qa/`。只对测试进程开放`MODEL_CALLS_ENABLED=true`，其模型相关用例连接本机stub；真实provider API keys/base URLs均清除，代理变量清空，collect/Jina/Feishu/IndexNow/private-network/OCR/embeddings开关关闭。未运行真实模型、collector、worker或OCR。

同一代码SHA的GitHub Actions [Check+Docker run 37611936804](https://github.com/revercgy-hub/MYHOT/actions/runs/37611936804)成功。Check的typecheck、web build、web tests 15/15、migration/seed、built-site smoke及backend tests均通过；backend 310项为309 pass、0 fail、1 skip。Docker build/start与smoke成功。该run测试代码SHA与配置SHA均为`2e2a021ae5a5eaa614a758724480dc8b266f33e3`。更早失败run保留在[STATUS](../STATUS.md)时间线，没有覆盖或改写。

本轮分析模型在任务说明中标为Luna High；QA无法独立验证Agent实际推理runtime/模型服务来源，因此不把该标签当作独立运行时证明。本地项目provider调用数为0。Sol范围审批只按已有记录引用，不从粗略token估算推断审批比例。

## 环境与安全边界

测试使用已存在PostgreSQL 17 loopback实例`127.0.0.1:5432`和独立新测试库；恢复了已知本地API/Web服务，只绑定loopback。QA后对既有`fiscalhot_preview_test`作只读事务核验：35 migrations、3 sources/0 enabled/0 fulltext-enabled、3 articles（3篇空body）、3 publications、analyses/receipts/receipt_attempts/fetch_runs/selected_ledger/job_runs均为0；与恢复前记录计数一致。API和Web loopback health均HTTP 200，监听端口只有127.0.0.1:5432/3000/3001；没有连接`55432`、没有新建或重装数据库服务、没有改写preview样本、没有启动worker。计数证据及历史安全边界见[状态页](../STATUS.md)。本交接不把独立测试数据库的迁移和写入解释为preview/production数据变化。

## 未完成项、风险与阻塞

35局逐一目标栏目、近90日历史与分页终点、来源级发布日期语义、全栏内容质量/噪声、附件降级、真实runtime材料身份去重、跨周期更新与失败恢复仍未全部核验。甘肃当前只是一组配对详情样本；云南既有日期冲突继续hold；河北、安徽、江西的真实短正文样本有限，parser合成夹具只验证selector。多个页面“count/page”展示或配置窗口不能替代历史覆盖实证。已保存旧失败与超时保持原记录。

P4真实provider/语义事件聚类和P5 Gold标注属于后续Gate；不得在本轮伪称通过。地方来源完整覆盖仍以用户要求的35局逐一新闻动态栏目为准，中央选登只作补充。所有未观察项目应继续标为unknown，不通过新增配置数量设定替代退出条件。

## 下一批工作与文件边界

先审阅本交接、Gate 2清单、来源矩阵、区域矩阵及`STATUS.md`；按root分配继续处理剩余Gate 2证据。可复用已保存raw做离线审查；任何新HTTP、collector或数据库操作仍需按已有精确范围/预算授权。source config/test文件的本轮批次已冻结，新增配置不得默认沿用当前QA结论。文档提交后记录新HEAD，但不要将docs-only SHA说成已由上述CI测试。

## 声明

本报告将页面观察、配置、selector fixtures、本地软件QA和CI分开叙述。未由manifest、raw、命令输出或数据库查询支持的事实保持unknown。Gate 2仍为`NOT_PASSED`，本交接没有新增来源准入或生产运行授权。

## 2026-10-08 精确正文保护续批与恢复检查点

当前代码HEAD为`edd0644ddcdee42de03eb21ad4704108f08000a5`（分支`feat/fiscal-finance-hot`），来源目录为46项（45 `web_list`、1 `json_list`）；精确40个source启用既有`_aihot.requireBodyReadyForAutomaticSelection: true`，包括35个地方局来源和5个中央/核心来源。全部来源仍`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；本批没有修改生产/preview数据库，也没有seed配置。配置统计不代表来源准入或Gate通过。35地方局范围与五个非地方局例外的精确ID见[operator notes](../STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md)。

39-ID代码检查点`14073fafefedb5d445cd9099945981a1eb12b675`与40-ID检查点`edd0644ddcdee42de03eb21ad4704108f08000a5`均位于该分支。39阶段第一份fresh全套测试曾有309/310通过，唯一失败是`tests/regional-bureau-config.test.ts`的精确flag期望集遗漏获批ID；失败日志保留，测试期望仅在现有精确列表中补齐后，另一新建35-migration数据库重跑为310/310。40阶段使用新建隔离库`fiscalhot_xmdebt40_fullqa_test`，完成35 migrations；`npm run typecheck`通过、`npm test` 310/310通过、Web production build通过、Web tests 15/15通过、loopback smoke通过。模型相关测试仅在测试子进程使用localhost fake providers；真实provider凭证/base URL与代理环境清空，凭证目录不存在。采集、Feishu、Jina、IndexNow、私网和全局embedding开关关闭；runtime/API未开启真实模型、collector、worker或OCR。此前39批的初次25项model-valve失败和其隔离配置原因继续作为历史，不计作代码失败或最终通过证据。

39-ID commit的GitHub Actions [run 37709351011](https://github.com/revercgy-hub/MYHOT/actions/runs/37709351011) 对其精确SHA成功；40-ID commit的 [run 37709884742](https://github.com/revercgy-hub/MYHOT/actions/runs/37709884742) 对`edd0644ddcdee42de03eb21ad4704108f08000a5`的Check和Docker均成功。该结果只覆盖软件回归，不表示source admission、来源正文质量、近90日历史完整或Gate 2通过。代码commit和CI使用显式仓库`revercgy-hub/MYHOT`；旧默认remote权限失败保留在历史记录，没有重复尝试。

### 厦门地方债来源的严格正文负例

获批的精确核心flag仅为`xiamen-finance-debt`；没有因此扩展到其它未标记核心来源。离线使用当前配置和保存的列表/详情重新运行实际`fromHtml`及`extractConfiguredHtmlBody`后，匹配候选URL `https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/t20260911_3016829.htm`的详情返回`identity_missing`、正文为空；`requiresBodyReadinessHold("unconfirmed", null)`为true，fetcher调用为0。保存详情raw位于`.data/fiscal-source-audit/details/xiamen-finance-debt.html`，大小15,640字节，SHA-256 `19a2f94d976ad7a077c7c1789e0fbb40159bb8d9d35ec843c521b713b3468a08`；可复核JSON为`.data/fiscal-source-audit/xiamen-finance-debt-strict-helper-probe-20261008.json`。已知旧数据库中205字符的历史假正文未修改；它不是正文就绪正例。该来源尚无机器正文就绪正例，仍未获来源准入；此负例也不证明所有PDF均不可读或OCR结果。

### 10月8日保存列表快照

独立QA按获批的精确cap=2/60秒批次离线核验`.data/fiscal-qa/core-list-snapshots-20261008-attempt2/manifest.json`、运行退出状态、目标/最终URL、响应状态、EOF、raw长度/SHA，并用当前`fromHtml`重解析。财政部统计栏目raw为12,330字节，SHA-256 `DFCEE01132E64572FD373457A4CAB5796DFA56E0ACD8632C28C2E0B8E6055E9D`；和现有绑定raw逐字节相同，当前解析10项，页面最旧可见日期2025-12-30、最新2026-09-24。厦门监管局列表raw为12,797字节，SHA-256 `927B4F055EFB98202737D410DD65BE029AB21E57D866C9E4FF744A537E07F89E`；和9月29日保存raw逐字节相同，解析10项，可见日范围2026-09-01至09-29。该厦门列表中一条路径日期为9月20日而页面发布日期为9月24日，按可见发布日期记录，路径token仅作冲突诊断。Undici实际记录`attempted/dispatched/rejected=2/2/0`，只访问获批两个host；没有详情/PDF、DB、collector、worker、模型或OCR操作。两份第一页同此前raw相同只证明所保存两次快照内容一致；既不确定先前捕获时点，也不证明日常刷新、分页历史覆盖、90日完整或source pass。人工title noise cue不是分类器结果。

### Gate与交接边界

本次恢复不扩大历史观察跨度。有限窗口、现有相同URL/material identity更新证据、未知的跨周期稳定性和来源级日期/正文/附件情况仍按各矩阵保存；跨来源语义事件聚类维持`P4_REQUIRED_NOT_RUN`，不与P3材料身份去重混为一项。完整近90日首次回填仍须按已冻结的S1阶段裁定，在后续上线准备/实际staging阶段验证，不以机械遍历所有历史页作为Gate 2全局硬前置。正式审查已冻结于[Gate 2正式审查](../GATE_2_REVIEW.md)：`APPROVED / PASSED_FOR_BOUNDED_P4_PILOT`仅覆盖`pboc-open-market`、`mof-treasury-debt-data`、`mof-xiamen-supervision-dynamics`中逐篇通过真实身份/日期/附件核实且`body_status=ok`、trim非空的固定小样。它不是46源全量准入、35局持续运行通过、无人值守采集或生产授权。厦门地方债`xiamen-finance-debt`明确`NOT_ADMITTED`、安全排除；不得修改、删除或复制其205字符历史假正文进入pilot。中国政府网/NFRA仍保留在来源主线与后续阶段待办，但不阻断这三个已核核心source的小样P4 pilot；其它source不得由此自动defer或扩scope。未决日期/身份/附件文章必须排除于该小样之外。完整review列明P4执行准备与未来来源工作的最小闭环。

## 2026-10-07 会计司中央精确例外与有限历史检查

### 会计司正文就绪保护

Sol 批准在既有严格正文就绪source flag中，为 `mof-accounting-notices` 增加一个独立的中央精确ID例外；原28个区域ID standing set不变，当前共29个 opt-in IDs、46个来源。它没有把规则扩展到其他中央或核心来源。会计司仍disabled，`site_fulltext=false`、`syndicate_fulltext=false`；不导入或seed到任何预览/生产source行。

来源配置与fixture的代码提交为 `3108be5671ec0939bda7341a0b0c5f4753a1daf7`，只改`industry/sources.json`、`tests/source-rules.test.ts`和`tests/strict-body-readiness.test.ts`。在fresh隔离库 `fiscalhot_oct07_accounting_guard_test` 完成35项迁移；`npm run typecheck`、`npm test` 310/310、Web build、Web tests 15/15、loopback smoke 30/30通过。测试时模型调用开关只在本地stub测试进程开启；真实provider key/base URL及proxy变量清空，采集、Jina、Feishu、IndexNow、私网和OCR开关关闭。GitHub Actions run [37614483314](https://github.com/revercgy-hub/MYHOT/actions/runs/37614483314)对同一SHA的Check与Docker job均成功，backend 310项/309通过/0失败/1 Windows-only skip，Web tests 15/15、migration/seed、built-site smoke及Docker smoke通过。代码已推送到`origin/feat/fiscal-finance-hot`。软件测试不构成source admission或Gate 2通过。

会计司另有独立的offline MockAgent before/after负例，证据目录为ignored `.data/accounting-xlsx-runtime-replay-20261007/`。输入为保存列表 `mof-accounting-1.html`（14,348 bytes，SHA-256 `7ecbff8d2c9a6c227163b77b179d157dc8a1b33eab26635a90f9c75ee99c031f`）和固定真实题名fixture（572 bytes，SHA-256 `682cb13078371d318e58be1869eb7dc4f3763819a70d9b89007e3a4067460b62`）。fresh独立数据库 `fiscalhot_accounting_xlsx_runtime_replay_20261007_test` 有35 migrations。修复前只派发精确列表/详情Mock各一次，collector found/created/revised=`1/1/0`；详情体抽取为`unconfirmed`、真实diagnostic `selector_missing`、body为空、revision 1，未产生附件诊断；自动strict hold当时为false。strict开启只应用于该测试库；同一文章上的既有`queueProcessing`返回null，`analyzeArticle`返回`body_not_ready`且provider未到达；文章状态未改、只有一个created extract job，receipt/analysis/lb_model均为0。精确XLSX tripwire保持未触发，未请求附件。测试使用固定MockAgent且`disableNetConnect=true`，外部HTTP为0；runner环境曾将`ALLOW_PRIVATE_NETWORK_FETCH=true`，所以此证据只能表述为exact mock-bounded offline replay，不能称该开关为false，也不验证live SSRF保护或私网访问安全。所有退出文件均为0，QA独立重算manifest/log/SQL快照和fixture SHA，并用只读SQL核对结果。该样本说明source-level严格flag不依赖附件诊断、也不实现XLSX解析；真实附件是否可读和全源正文质量仍未知。

### 限定分页窗口与PBOC快照观察

独立离线复核了ignored `.data/fiscal-qa/continuous-source-gaps/history-pages-20261007/`中regional page 1、page 2和PBOC当前列表artifact。三个地方局每批均为精确3 GET、`3/3/0`、HTTP 200、最终URL精确、gzip EOF；QA重算raw大小/SHA和page0/page1引用hash，并用当前仓库`fromHtml`重解析六份HTML，每页10行、URL集合匹配manifest。page 1对page0无URL重叠、页内重复为0，显示日期均晚于2026-07-09边界。page 2对page0和page1无URL重叠、页内重复为0；按页面显示日期统计，2026-07-09及以前的行数为天津7、山东4、内蒙古4。page 2的显示日期最旧分别是2026-05-29、2026-06-25、2026-06-22；显示日与URL路径日差异仍有1/6/3项。日期行序和路径冲突不能当作可信日期结论或完整窗口；每局都只有两页样本，不构成近90日完整覆盖。

同目录PBOC `pboc/manifest.json`是cap=1的单次当前列表快照，HTTP 200、EOF、raw 40,079 bytes、SHA-256 `fe16e2da27948d98b63dee28239f5d53895acacdd24a124e461b34864178aa4d`。实际parser得到20项，URL与既有保存snapshot的20项完全重合，new/removed/changed均0，最旧上海显示日为2026-09-04。此为单次列表对照，不是跨日runtime去重、daily可靠性或来源通过。上述两个regional page batch与PBOC list均未访问数据库或运行collector；manifest保留在ignored目录。

### 阶段边界修正

根据[S1连续Gate依赖与历史阶段裁定](../S1_CONTINUOUS_GATE_DEPENDENCIES_2026-10-07.md)，Gate 2继续要求35局真实入口、来源规则、有限历史窗口/日期可信度、正文/噪声、附件退化、身份去重/修订及失败安全/跨时点稳定性有证据；不把遍历所有历史页或对35局完整抓取90天作为通用Gate 2前置。首次上线近90天回填要求继续保留，完整能力与覆盖/部分状态解释属于P7/Gate 4上线准备及P8/P9实际运行、首次上线验收；不得因拆分阶段把回填待办写成已通过。当前新增page2触达90日边界只推进有限样本，不改变该结论。Gate 2仍`NOT_PASSED`，来源仍全部disabled，未作来源准入或上线授权。

## 2026-10-07 Central core exact flags and fresh QA

Sol approved the exact central IDs `mof-budget-work` and `mof-finance-notices` for the existing strict-body Boolean flag. Together with the previously approved `mof-accounting-notices`, the current 46-source catalogue has exactly 31 strict IDs: 28 regional IDs and these three central IDs. The regional standing set is unchanged. Each new core flag is the JSON Boolean `true`; the source's other selectors, attachment contracts, dates, interval, and backfill values are unchanged. All sources remain disabled with `site_fulltext=false` and `syndicate_fulltext=false`, and no database import or preview seed occurred. The matching exact-ID assertions were updated in `tests/source-rules.test.ts` and `tests/strict-body-readiness.test.ts`; the source config has no runtime-policy change.

Independent `BEGIN READ ONLY` queries against the existing isolated databases verified budget article `s411ti7pcubnwhgmza55uicgx` in `fiscalhot_corebatch_test` and finance article `sfz58qc6jd7t83eohtop1ihlg` in `fiscalhot_ingest_test`. Both rows were `unconfirmed`, with body text and HTML length 0, revision 1, raw NULL, and empty media; neither database's stored source config contains the new strict flag. The historical extraction failure cause remains unknown. No old database was modified.

Code commit `d7154d7` (`Guard core finance sources until body ready`) was pushed to `origin/feat/fiscal-finance-hot`. Fresh local QA used newly created `fiscalhot_oct07_coreflags_retry1_test` at loopback PostgreSQL 17.11; absence was checked before creation and `schema_migrations` contains 35 entries. `npm run typecheck` passed; `npm test` passed 310/310 with 0 failures/skips; the Web production build passed; Web tests passed 15/15; `node scripts/smoke.ts --base http://localhost:3000` passed all checks, including public routes, API endpoints, feeds, assets, and MCP initialize. Model calls were enabled only in the test process for per-test ephemeral loopback stubs; model keys/base URLs/proxies were cleared and `AIHOT_CREDENTIALS_DIR` pointed to a nonexistent path; `EMBEDDINGS_ENABLED=false`, and collection, Jina fallback, Feishu, IndexNow, private network fetch, and OCR switches were false. The smoke check used existing loopback API/Web endpoints and made no provider calls; no worker was started. A preliminary full-suite attempt with the model valve forced off failed provider-dependent tests as expected; it was not treated as a code failure. A second attempt on that already-touched database was stopped and retained; the authoritative run used the fresh retry database above.

The single explicit GitHub Actions Check workflow run for code SHA `d7154d7bad86fd8c82c8659c7243225b294d10d1` is [37616924621](https://github.com/revercgy-hub/MYHOT/actions/runs/37616924621); Check and Docker both succeeded. CI typecheck, web build/tests15/15, migration/seed, built-site smoke, backend tests, and Docker smoke all passed. The prior code SHA/CI results remain preserved in [STATUS](../STATUS.md). Local software QA, strict-body guard behavior, and these two historical database rows do not establish source extraction quality, source admission, or Gate 2 completion; Gate 2 remains `NOT_PASSED`.
