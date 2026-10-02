# P3 进行中检查点交接（2026-10-02）

STATUS=IN_PROGRESS
STAGE=P3 本地抓取与正文验证
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=a8d1dbed313ae68598085187e754829ac3d93464
STAGE_CODE_SHA=aaea0502e9fe8df7b858c64df61bb46e207b71de（已提交OCR准备工具代码，GitHub Check 36676119420通过；这是历史tested code SHA，不是本次HEAD）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=共享工作区包括OCR owner的`ocr-scan-poc.ts`与测试修改，source Agent新增`P3_SOURCE_CHECKPOINT_2026-10-02.md`、`P3_ACCOUNTING_BODY_FIX_2026-10-02.md`、`P3_SCAN_OCR_REVIEW_2026-10-02.md`及会计司tests/fixtures，Sol新增`S1_P3_OCT02_SCOPE_REVIEW.md`，以及本文列出的共享状态文档；更早状态曾出现未归属`undefined.txt`，后续`git status`时已不再列出，来源未知。HEAD取自 `git rev-parse HEAD`，未预测提交SHA。

## 阶段退出条件与结论

P3还缺核心来源覆盖和跨周期稳定、失败正文处置及可审计预算等证据。2026-10-02五源只读快照补充了候选窗口变化和两篇失败正文HTML诊断；没有运行collector或数据库写入，不满足Gate 2正式复核的完整条件。来源保持disabled，Gate 2维持`NOT_PASSED`。P4不得启动；不得据单次页面差分宣布来源通过。

## 完成内容与可复核证据

- [五源只读来源报告](../P3_SOURCE_CHECKPOINT_2026-10-02.md)及ignored原始材料 `.data/fiscal-source-checkpoint-20261002/`：五个配置首页各一次GET，会计司两篇既知 `unconfirmed` 详情各一次GET。全部7请求HTTP200且无redirect，后端实际解析的Undici 8.11.2 Agent/ProxyAgent dispatch hard cap=12，attempted/dispatched=7/7、rejected=0；每个request均有create、sendHeaders和headers事件。`tests/fiscal-p3-http-budget.test.ts` localhost测试5/5通过。未跑collector、未写DB、未请求附件、未更改正文或来源状态。
- [来源矩阵增量](../SOURCE_MATRIX.md)与[Gate 2就绪审计增量](../P3_GATE2_READINESS.md)记录了候选差分及未知边界。会计司当前10项，对9/30 collector accepted URL集合9/10相同；9/30没有原始首页HTML，9/29 parser快照仅有5项且本次与旧5项全重合，不能把其余候选推断为新发布。预算司当前10项与9/29原始HTML和9/30 accepted集合均10/10重合，首页日期2026-03-26至2023-07-24。财政部区域汇总8项，较9/30快照增3退3；厦门区域10项与9/29及9/30均重合；OMO 20项对9/29为19/20，第192号进入、第173号退出。上述只反映相邻快照，不证明长期稳定。
- 会计司详情 `t20260920_3997803.htm` 的 `.TRS_Editor`仅24字且提供XLSX；`t20260904_3996714.htm` 有323字与一张两行表格，均未过当前Readability门槛。二者标题、列表日与详情元数据相符；附件未取、正文helper未重跑、DB状态未改。中央区域汇总厦门稿与厦门自身当前首页窗口无exact URL交集，未做运行时跨源去重。
- S1后B按批准范围完成 [会计司正文selector复核](../P3_ACCOUNTING_BODY_FIX_2026-10-02.md)，`node --test tests/fiscal-accounting-body.test.ts` 6/6通过。union候选保留180字表格和473字无表征求函、拒绝24字题名+XLSX，但也误收短多段通知及装饰表格；较严格CSS仍误收装饰表。故未修改 `industry/sources.json`，新fixture只能作为有限结构边界证据，不能证明来源正文全面可靠。
- GitHub Check run [36676119420](https://github.com/revercgy-hub/MYHOT/actions/runs/36676119420) 对 `aaea0502e9fe8df7b858c64df61bb46e207b71de` 通过，含Ubuntu测试、build、smoke与Docker检查。此SHA早于本检查点HEAD；同一CI不表示本次快照、当前未提交OCR owner改动或当前HEAD已经测试。本轮没有重新跑typecheck、npm test、Web build/test。

## 来源逐项记录

本轮五源均按原始配置首页读取一次，所有12项配置的启停及全文授权状态见[来源矩阵](../SOURCE_MATRIX.md)：12源继续 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。本轮未请求列表外的URL（两篇允许的会计司详情除外），未跑项目collector。中央财政部汇总仅是监管局稿件选登，不代表35局全量；厦门局栏目也只代表自身当前窗口。未观察实际collector去重结果。

五源的URL、标题、页面顺序、日期、raw HTML hash、差分和请求事件存于ignored材料，由报告逐项记录。预算司首页历史最旧日较早，但静态快照不能证明新稿发布速率或失败退避期间漏项风险。会计司两日差分受到9/30缺原始HTML、9/29 parser仅识别5项的限制。区域和OMO均是相邻日期对照；不表示周期稳定或深页覆盖。

## 环境与安全边界

按既有预览方式恢复`.data/test-pg/cluster`，只在 `127.0.0.1:5432` 使用 `fiscalhot_preview_test`，没有重建或seed数据库，也没有触碰55432 OMO集群。只读SQL确认35项migration、3个source均禁用且全文关闭、3条固定人工样本 `body_status=none/revision=1`、analyses/receipts/job_runs均0；3条publication均`score=NULL`、`selected=false`、`eligible=true`。API监听`127.0.0.1:3001`、Web监听`127.0.0.1:3000`；API health、Web首页、`/all`、pool API均200，预览页面`X-Robots-Tag=noindex, nofollow`。API配置显式关闭采集、模型、Jina、IndexNow、Feishu及私网网络开关；无应用worker。

Fresh全套检查：`npm run typecheck` exit 0；新建隔离 `fiscalhot_oct02_full_test` 库完成35项migration，`npm test`184/184；`npm run build -w @aihot/web`成功，`node --test apps/web/tests/*.test.ts`15/15。测试进程以 `MODEL_CALLS_ENABLED=true` 运行provider测试，但使用本地stub，测试凭证目录指向不存在路径；采集/Jina/IndexNow/Feishu/私网开关显式false。完整测试后预览服务没有监听，首轮smoke30项因连接失败；重新按既有配置恢复loopback PG/API/Web后 `node scripts/smoke.ts --base http://127.0.0.1:3000` 本轮29项全过。先前交接记30/30，差异原因未知。API最初以Windows当前用户名连接数据库失败，改用已有库角色`postgres`后health恢复。没有应用worker。

扫描PoC的9/30旧失败事实保留：固定commit `87416418657359cb625c412a48b6e1d6d41c29bd` 已定位，模型流在30秒边界中断，实际字节数未记录、LICENSE未请求、OCR/gold `NOT_RUN`。新S1 [范围裁定](../S1_P3_OCT02_SCOPE_REVIEW.md)批准一个scope-only准备批次：复用immutable commit、不查版本API，固定模型与同commit `LICENSE` URL各至多一次、redirect=0/no retry、单请求120秒/整批240秒、大小上限32MiB/1MiB。Lead核销后A仅执行一次准备尝试：实际只发出模型请求一次，HTTP 200、Content-Length 2,469,156，收到16,384 bytes后于70,722ms以 `TypeError: terminated` 结束，EOF不完整；这不是120秒deadline。未请求LICENSE、未计算hash、未写模型；新manifest为 `incomplete/runnable=false`，旧9/30目录保留。无重试、无OCR，run lock仍false。完整证据见[准备批次复核](../P3_SCAN_OCR_REVIEW_2026-10-02.md)。

A的Windows fake-child/process核验见[OCR过程报告](../P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)：focused tests 17/17、typecheck与目标diff-check通过；READY后短child自然退出，首采样72ms、最大采样间隔162ms，deadline、输出上限和monitor故障注入路径按测试记录 fail-closed 并等待child结束。此为本地fake-child证据，不是Tesseract负载下的持续cadence、硬RSS或进程树隔离证据；OCR锁继续关闭。

同一S1拒绝会计司table-only selector（`CHANGES_REQUIRED`），批准 `.TRS_Editor:has(table)` 与多段落分支合并候选的行业配置fixture验证范围；B按其独占文件权属核验同一selector同时保留180字注销表与473字无表征求函，并拒绝24字题名+XLSX和身份/容器负例。只有验证结果满足裁定条件后，Lead才可核销最小行业配置；此授权不代表所有会计司内容或附件已处理，也不开放source、DB或collector。

## 未完成项、风险与阻塞

- Gate 2仍缺跨周期来源覆盖、候选噪声与窗口漏项判断、关键正文机器完整性、已知失败内容处置和正式Sol审核。9/30两个完整首页批次的实际HTTP预算仍unknown，不能由本次dispatch工具和7次新请求追认。
- 会计司其中一篇失败详情的数据在XLSX附件；附件未请求。另一篇结构化短表有323字和表格，现有CSS候选在固定HTML上可提取180字，但误收身份匹配的装饰表负例，不能安全地写入行业配置。不得用人工gold取代机器正文。
- 预算司页面旧、区域中央源不承诺覆盖35局、厦门来源未跨周期、OMO仅一轮相邻日期增量；这些都限制来源结论。
- OCR训练数据和适用许可证缺失；新两URL准备批次已获S1 scope-only批准，但须先完成fake-response等本机验证并由Lead核销。资源monitor、timeout/kill-wait fake-child证据由代码owner负责；native OCR须在这些执行证据及Lead核销后才可运行。
- Web smoke计数和旧记录30/30之间的差异原因未知。

## 下一批 Agent

1. A / `ocr_process_verification` 已交付OCR过程代码、测试及报告；本轮唯一准备尝试已失败，禁止本批次重试或运行OCR。任何新准备均需新的范围审查与授权；OCR还缺完整模型/LICENSE、持续原生monitor cadence及后续执行核销。保留 `OCR_RUN_ENABLED=false`。
2. B / `source_checkpoint_oct02` 已交付 [P3_ACCOUNTING_BODY_FIX_2026-10-02.md](../P3_ACCOUNTING_BODY_FIX_2026-10-02.md) 和6项独立测试；因短多段与装饰表负例未通过，没有改 `industry/sources.json`。如需扩大到helper级区分策略，需另提新范围审查；不得由当前失败报告推断配置可放行。
3. Lead：核实A/B交付和本文件的最终diff scope，fresh全套检查通过后小提交并针对明确origin repo运行CI。正式Gate 2 review仍需长期/跨周期覆盖及正文负例处置；此S1不是Gate 2放行。P4只在Gate 2后另建全新隔离库。

## 声明

没有由Git、ignored材料、SQL、HTTP响应或报告支持的事实不作推断。报告内历史环境和CI只代表其记录时点；未提及的来源覆盖、附件内容、长期稳定性或生产行为均未验证。本检查点不宣布阶段完成或Gate 2通过。
