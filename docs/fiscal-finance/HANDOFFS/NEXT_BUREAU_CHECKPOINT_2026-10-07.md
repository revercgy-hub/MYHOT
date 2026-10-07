# P3 / Gate 2 新四局配置检查点（2026-10-07）

STATUS=IN_PROGRESS
STAGE=P3 source evidence preparation / S1 configuration-only body-ready scope
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED；source admission NOT_ADMITTED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=d4fd46ded57cd899793e819a3b49ff8bf6e72e4f（handoff随后的文档提交前的代码HEAD快照；不自引用）
STAGE_CODE_SHA=e3791c2744c285c7967cb1c6597da3187817889b
FOLLOWUP_CODE_SHA=d4fd46ded57cd899793e819a3b49ff8bf6e72e4f（获准最小OCR deadline分类维护，已提交推送；本地full QA与CI run37574033213均通过）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=配置与deadline维护代码已提交并推送；本handoff、状态/矩阵/operator notes及history/scope报告由后续独立文档提交收录，不自引用自身提交。忽略目录测试和请求日志不入库。

## 阶段退出条件与结论

四个已确认地方监管局配置进入行业source清单，且继续disabled、全文许可关闭；每项采用已批准的strict body-ready配置。此项配置和测试变更已完成并推送，但不意味着栏目质量验收、来源准入、90日历史覆盖或Gate 2通过。35局逐一栏目识别与各Gate 2证据仍未闭环。

在代码SHA `e3791c2744c285c7967cb1c6597da3187817889b` 上，本地全套软件QA通过；GitHub Actions run [37573322451](https://github.com/revercgy-hub/MYHOT/actions/runs/37573322451) 的Docker成功，Check中typecheck、Web build/tests、migration/seed与built-site smoke成功，但backend tests为308通过、1失败、1 skip。唯一失败位于`tests/fiscal-ocr-scan-poc.test.ts:319`：deadline分类race使fixture得到`total deadline`而期望`page deadline`。失败日志保存在ignored `.data/test-pg/oct07_bureau9_ci_37573322451_failed.log`。它被保留，不用本地通过结果覆盖，也未在相同SHA重跑。Root批准的确定性维护已在commit `d4fd46ded57cd899793e819a3b49ff8bf6e72e4f`完成并推送：在预算准入时冻结reason，不依赖稍后的wall-clock callback读数；focused OCR tests37/37，fresh35-migration `npm test`310/310、typecheck通过。Web build/tests和smoke为两文件维护未改源码，因此按Root指示沿用同轮已通过结果。新SHA的显式CI run [37574033213](https://github.com/revercgy-hub/MYHOT/actions/runs/37574033213) Check与Docker均成功；Check backend tests310项/309通过/0失败/1 Windows-only skip，typecheck、Web build/tests15/15、migration/seed与built-site smoke全过。旧失败保留，不改写历史。

## 完成内容与可复核证据

- 配置代码SHA `e3791c2744c285c7967cb1c6597da3187817889b`：`industry/sources.json`有27项（26 HTML、1 JSON），增加`mof-ningxia-supervision-dynamics`、`mof-qinghai-supervision-dynamics`、`mof-shaanxi-supervision-dynamics`、`mof-guizhou-supervision-dynamics`。九个获批的strict body-ready source ID见[operator notes](../STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md)。所有source `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。Sol的附加配置范围和未来条件规则见[续批裁定](../S1_BUREAU_BODY_POLICY_CONTINUATION_2026-10-07.md)。
- 四局列表/详情解析使用保存的source snapshots和8个合成parser fixtures；合成正文仅证明selector解析。各局详情样本与噪声边界见[Batch 8](../REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)及[Batch 9](../REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)。来源配置测试`node --test tests/regional-bureau-config.test.ts`为1/1通过；新strict-ID精确断言列出九个ID。
- Local QA在全新`fiscalhot_oct07_bureau9_test`运行35 migrations：`npm run typecheck`通过；`npm test` 310/310；`npm run build -w @aihot/web`通过；`node --test apps/web/tests/*.test.ts` 15/15；`node scripts/smoke.ts --base http://127.0.0.1:3000` 30/30。日志为ignored `.data/test-pg/oct07_bureau9_{migrate,typecheck,npmtest,webbuild,webtests,smoke}.log`。provider keys/base URLs/credentials和proxy环境已清除，副作用flags关闭；`MODEL_CALLS_ENABLED=true`只在npm test的localhost stub子进程中设置。无真实provider、OCR、collector、worker或模型调用。
- deadline reason维护后，第二个fresh DB `fiscalhot_oct07_deadline_final_test`执行35 migrations、typecheck exit0、`npm test`310/310 exit0。日志保存在ignored `.data/test-pg/oct07_deadline_final_{migrate,typecheck,npmtest}.log`；focused OCR tests37/37。维护仅改script/test两文件，Web build/tests15/15与loopback smoke30/30沿用同轮未变源码先前pass；该SHA的CI随后也重新通过各项Web和smoke检查。
- 代码QA前后只读preview SQL计数一致：35 migrations；3个source全部disabled且全文关闭；3篇空body article；3 publications；fetch_runs、analyses、receipts、selected_ledger、job_runs均0。preview API与Web loopback health仍HTTP 200；未对preview作写操作。
- deadline维护后再次在`fiscalhot_preview_test`只读事务核验：35 migrations；3 sources、0 enabled、0 fulltext；3 articles、0 nonempty body；3 publications；fetch_runs、analyses、receipts、selected_ledger、job_runs仍均0。事务ROLLBACK，无preview写入。
- root核准的宁夏/青海历史页观测为两次顺序GET，manifest `../../../.data/fiscal-qa/oct07-next-history/manifest.json`：`attempted/dispatched/rejected=2/2/0`，均HTTP 200、无重试/重定向。宁夏`index_1.htm` 12,844 bytes，SHA-256 `680fb95d23712bea8967d7f873e6f146cb5ba541d78b7cd21567750c900a30ed`；10项无首页URL重叠，日期2026-06-23至08-14，9项达到2026-07-09窗口、1项较旧，4项可见日期/路径日期不符。青海`index_1.htm` 12,541 bytes，SHA-256 `9a81600765deb19bddb98476274d4745de8d0e24022609c0181e8eb1cdbd1b26`；10项无首页URL重叠、日期顺序非单调，范围2026-08-10至09-11，2项可见日/路径日冲突，未到90日边界。独立离线QA输出为同目录`independent-qa-attempt4.log`；前三次检查器失败及各自日志保留，不计作请求。
- 另一次后续获准的宁夏窗口快照manifest `../../../.data/fiscal-qa/oct07-next-history/ningxia-snapshot-manifest.json`与上两条请求分开：首页前置GET在20秒超时，`1/11` dispatch、一个request:error，无response/raw，不重试；依失败停止规则未发送其余历史页或首页后置请求。

## 来源逐项记录

宁夏、青海、陕西、贵州各新source目前均disabled、全文关闭。四个新增source的一篇详情样本并非来源质量验收；宁夏样本有转移支付监管业务信息，青海、陕西、贵州所采样本偏组织/学习活动，不能推出全栏噪声率。宁夏/青海各自仅新增一页page2观察，分页更深历史、跨周期稳定、详情权威日期和90日完整覆盖未知。每页的显示日与路径日冲突和排序情况见上文及[历史页报告](../P3_NEXT_HISTORY_CHECK_2026-10-07.md)。陕西、贵州本轮没有追加历史页请求。配置不启用collector，不产生source admission。

## 环境与安全边界

原始preview环境服务仅使用loopback：Web `127.0.0.1:3000`、API `127.0.0.1:3001`、PostgreSQL `127.0.0.1:5432`；没有55432 listener。preview核验为只读transaction，QA使用独立fresh test database。历史页仅为上述显式有界GET，无详情、附件、XHR、OCR、数据库、collector、worker或模型。环境无provider凭证/Base URL，副作用开关均关闭；测试stub的模型开关仅在测试进程内。来源JSON提交不等于数据库行更新；没有运行seed至preview/production，也没有修改preview或production数据。

## 未完成项、风险与阻塞

Gate 2仍NOT_PASSED，35个官方地方局栏目没有逐一完成覆盖；列表分页与近90日连续性、可信日期、业务正文质量/附件降级、噪声、重复更新和跨周期行为需逐源补证。宁夏、青海的page2单页不能证明历史完整或日期权威；后续宁夏首页超时导致该独立快照计划按预算停止。strict flag仅保护自动精选的body-ready条件，不是source admission、正文质量判定或full-text许可。GitHub run 37573322451旧SHA失败有独立后续确定性修复；最终维护SHA d4fd46d的run37574033213完整通过，来源风险与Gate 2状态仍不变。

## 下一批 Agent

建议由Root/Lead先审阅本handoff、`SOURCE_MATRIX.md`、`REGIONAL_BUREAU_COVERAGE_MATRIX.md`、`P3_NEXT_HISTORY_CHECK_2026-10-07.md`和Sol续批裁定，再决定是否继续地方局证据工作。QA负责在deadline维护代码冻结后以新鲜隔离测试DB执行typecheck、full `npm test`、既有web/smoke必要检查并触发一次CI；保留旧失败日志，禁止无变化重跑。来源证据下一批仍需精确URL/dispatch budget授权，不能从本handoff推导GET权限。Source review/coverage docs分别由其owner更新；严格正文policy future candidate必须满足Sol裁定中的精确身份/保存证据/QA与Lead接受条件。禁止source enablement、生产数据库操作、大规模采集、真实模型/OCR或将测试cursor复用到其他环境。

## 声明

本检查点只报告文件、manifest和测试记录支持的事实。它不把配置flag、单页历史、软件测试或CI Docker成功解释为来源通过、90日覆盖、Gate 2或生产批准。未提及的行为不视为已验证。
