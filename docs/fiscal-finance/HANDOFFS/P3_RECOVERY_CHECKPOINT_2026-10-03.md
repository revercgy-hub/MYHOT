# P3 原10/2范围恢复检查点（2026-10-03）

STATUS=IN_PROGRESS
STAGE=P3 本地抓取与正文验证
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=26ca72f2b94d37383072c0e54be6f94682b0e9bd（本检查点编写时的已提交代码SHA；随后单独提交文档，最终HEAD以git实测为准）
STAGE_CODE_SHA=26ca72f2b94d37383072c0e54be6f94682b0e9bd（本地回归与本次CI所测代码）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=原10/2代码已分两提交并push；共享状态及证据文档、此检查点待提交。其他Agent当日新建文件不属于本文的变更范围，未stage。

## 阶段退出条件与结论

本次仅恢复并核对原10/2已批准范围：OCR准备与fake-child守护逻辑、会计正文selector离线probe、当日来源和失败样本证据。Gate 2还缺跨周期覆盖、正文负例处置和正式review；P3仍进行中。没有把本地tests、来源首页快照或preview作为Gate通过依据。

## 完成内容与可复核证据

代码分为两个小提交，均只含其明确范围：

- A提交 `08492e0443b68dbffbe036f6b64ea9b6426655f8`：`scripts/fiscal/ocr-scan-poc.ts` 与 `tests/fiscal-ocr-scan-poc.test.ts`。
- B提交 `26ca72f2b94d37383072c0e54be6f94682b0e9bd`：`tests/fiscal-accounting-body.test.ts` 与 `tests/fixtures/fiscal-accounting-body/`五份HTML fixture。

A的[过程核验](../P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)报告17/17 focused tests、typecheck及目标diff检查通过；Windows真实monitor对短fake-child首采样72ms、最大样本间隔162ms。该短样本与注入故障覆盖不证明Tesseract负载下持续cadence、硬RSS或进程树终止。B的[正文复核](../P3_ACCOUNTING_BODY_FIX_2026-10-02.md)报告6/6测试通过；union误收短多段通知和装饰表，较严格CSS仍误收装饰表，因此没有改 `industry/sources.json`。

原测试结果在本次恢复回合重新核验：`npm run typecheck`退出0；新建独立 `fiscalhot_oct03_verify_test` 空库完成35项migration；`npm test` 184/184通过；`npm run build -w @aihot/web`成功；`node --test apps/web/tests/*.test.ts` 15/15通过。后端测试使用本地stub providers，测试凭证路径不存在；采集、Jina、IndexNow、Feishu与私网开关为false。记录保存在ignored `.data/test-pg/oct03-final-verification.log`、`.data/test-pg/oct03-npm-test.log`。`git diff --check`通过。

GitHub workflow `check.yml` 的push自动运行限定main，故本次显式以 `workflow_dispatch` 对 `revercgy-hub/MYHOT` 的 `feat/fiscal-finance-hot` 启动 [Check run 37077418870](https://github.com/revercgy-hub/MYHOT/actions/runs/37077418870)，tested SHA为 `26ca72f2b94d37383072c0e54be6f94682b0e9bd`。最终CI失败：Docker job成功；check job的install、typecheck、Web build/tests、migration/seed和smoke均成功，backend tests为183/184。唯一失败是 `tests/fiscal-ocr-scan-poc.test.ts:128` 的真实Windows PowerShell monitor test在Ubuntu运行时找不到 `powershell.exe`（ENOENT）。本地Windows fresh npm test 184/184；该远端失败暴露了测试的平台可移植性问题，已交OCR代码owner处理，尚未有修复后的CI。

## 来源与环境边界

10/2五源快照见[来源报告](../P3_SOURCE_CHECKPOINT_2026-10-02.md)，七个GET均200无redirect，dispatch观测7/12。该结果不追认9/30旧批次hop预算。来源12项配置继续 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；`industry/sources.json`无diff。

10/2新训练文件准备批次仅发出一次固定模型URL请求：HTTP 200、Content-Length 2,469,156，实际收到16,384 bytes后于70,722ms `TypeError: terminated`，EOF不完整，非120秒deadline；没有LICENSE请求、完整模型或hash。停止无重试，manifest `incomplete/runnable=false`，无OCR。9/30旧失败材料保留。详见[准备审计](../P3_SCAN_OCR_REVIEW_2026-10-02.md)和[过程报告](../P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)。OCR锁保持关闭。

既有loopback preview只读核验：PostgreSQL `127.0.0.1:5432`连接 `fiscalhot_preview_test`，35 migrations；3个sources disabled且全文关闭；3个固定样本均`body_status=none/revision=1`；3条publications均`score=NULL/selected=false/eligible=true`；analyses、receipts、job_runs均0。API `/api/health`和Web `/all`均200，页面 `X-Robots-Tag=noindex, nofollow`。smoke于10/2先前输出记为29项通过；10/3当前运行输出30项全过，分别留档，差异原因unknown。Web/API/PG端口3000/3001/5432仅监听loopback；未监听55432，无项目worker；`.env`不存在。未写既有preview库，也未seed或启动worker。

## 变更文件与排除项

本次文档提交范围为本文件、[10/2原检查点](P3_CHECKPOINT_2026-10-02.md)、[会计正文报告](../P3_ACCOUNTING_BODY_FIX_2026-10-02.md)、[OCR过程报告](../P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)、[OCR准备审计](../P3_SCAN_OCR_REVIEW_2026-10-02.md)、[五源快照](../P3_SOURCE_CHECKPOINT_2026-10-02.md)、[10/2 S1裁定](../S1_P3_OCT02_SCOPE_REVIEW.md)，以及 `STATUS.md`、`SOURCE_MATRIX.md`、`P3_GATE2_READINESS.md`、本目录 `README.md`。本文件以外文档为当日原范围证据及其索引；没有stage `.data/`、模型partial chunk、其他Agent新proposal、新S1文档或后续未完成实现。

## 未完成项、风险与阻塞

- 远端Check run 37077418870结束为failure（Docker通过、Ubuntu backend tests中一项Windows-only monitor test以spawn `powershell.exe` ENOENT失败）；其余列明的检查通过。
- smoke本次为30项，10/2旧记录为29项，差异成因unknown。
- OCR模型/许可证未完整获取，OCR与gold比较均未运行；fake-child短样本不替代真实负载监控验收。
- 正文fixture暴露两个负例误收风险，行业selector配置未修改。
- Gate 2仍缺多周期覆盖、正文完整性和失败样本的处置证据。

## 下一批 Agent

可在本报告对应代码提交完成后继续其新授权范围，但需以新S1文档及新的证据记录为界。本检查点只描述截至10/3本次代码SHA的旧范围，不为新范围预先背书。OCR_RUN_ENABLED保持false；来源禁用；不运行collector或消费P3遗留jobs。

## 声明

`26ca72f2b94d37383072c0e54be6f94682b0e9bd`为本检查点代码基线和CI tested SHA；文档提交在后，不改变被测代码内容。该SHA的CI为失败，需由OCR owner修复Ubuntu测试适配后产生新的tested SHA和CI结果。最终分支HEAD、remote ref须以提交后Git记录为准。未由报告、SQL、测试输出或Git记录支持的行为不推断；Gate 2没有通过。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：接续并核实10/2原批准scope，提交小范围代码和证据交接。

**MODEL**：Luna High。

**FILES_CHANGED**：A/B两代码提交与上述原范围交接/质量文档；无source配置及数据库改动。

**TESTS_RUN**：typecheck；35 migrations后的新隔离测试库；全量184 tests；Web build与15个Web tests；loopback smoke 30项；diff check。

**RESULT**：本地质量检查通过，代码已推送；远端Docker job成功，Ubuntu backend tests 183/184，唯一失败是Windows PowerShell测试在Ubuntu无法启动。

**RISKS**：smoke历史计数差异原因未知；OCR监控与正文selector均有边界未验。

**BLOCKERS**：远端CI失败待平台适配修复；OCR数据及许可证缺失；Gate 2证据不齐。

**NEXT**：由OCR owner修复仅限Windows的真实PowerShell测试与Ubuntu workflow的兼容；修复后重跑指定repo CI并追加其SHA/run结果。维持Gate 2 NOT_PASSED与所有采集/OCR安全锁。
