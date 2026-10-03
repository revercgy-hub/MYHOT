# P3 检查点：新S1实现、有限实测与质量回归（2026-10-03）

STATUS=IN_PROGRESS
STAGE=P3 本地抓取与正文验证
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651（本轮已全套验证并通过远端CI的代码SHA；本检查点为后续独立文档提交，不把未来文档HEAD写成事实）
STAGE_CODE_SHA=9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651
BASE_SHA=5ecb093e0304af7169918ab1989620a0a27cc206（10/2恢复文档提交；此后为本轮S1代码提交）
WORKTREE=文档提交前含本检查点、STATUS、SOURCE_MATRIX、P3_GATE2_READINESS、HANDOFFS/README及10/3 S1实施裁定/提案/OCR准备结果/会计司正文结果报告；代码已分别提交，ignored `.data/` 测试和有限实测材料不纳入Git。

## 阶段退出条件与结论

P3仍未满足来源覆盖和周期稳定性退出条件：12个生产来源持续关闭；历史批次hop预算、长周期freshness、首页滑窗和多个机器正文失败仍有缺口。此次只完成10/3 S1中通用可选正文policy与固定Git Blob训练数据准备工具的受限实现/测试，以及各一次经Lead单独核销的准备与固定详情提取。代码与测试通过，不等于行业源通过；详情实际为 `unconfirmed`。Gate 2仍为 `NOT_PASSED`，没有启动大规模抓取、OCR、模型、worker或P4。

## 范围与裁定

正式范围见 [S1_P3_OCT03_IMPLEMENTATION_REVIEW.md](../S1_P3_OCT03_IMPLEMENTATION_REVIEW.md)。`detail.bodyPolicies` 获准作为web_list的可选fail-closed策略；不改apps、schema/migrations、采集门槛或PDF envelope语义。会计司精确值获Lead核销：短表 selector `.my_doccontent > .TRS_Editor:has(table)`、五个按序表头、至少一条完整数据行、`minTextChars=1`；段落 selector `.my_doccontent > .TRS_Editor:has(p + p)`、`minTextChars=200`。来源 `mof-accounting-notices` 仍disabled，这组配置只受缓存HTML和负例约束，不代表所有栏目可靠。

OCR准备只允许固定Git commit的Contents目录+两Blob路径、最多三次串行request admission、120秒/请求和240秒总限额、redirect/retry/fallback均为0，以及完整 EOF、Git blob SHA-1、SHA-256与Apache-2.0许可证核对。一次准备成功不解锁OCR；固定图/gold运行仍未授权且 `OCR_RUN_ENABLED=false`。

## 完成内容与可复核证据

代码两小提交已推送到明确remote `https://github.com/revercgy-hub/MYHOT.git` 的 `feat/fiscal-finance-hot`：正文策略及入口 `9719580`；OCR固定Git Blob准备工具 `9bfa0d1`。完整tested code SHA为 `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651`，本地与origin feature ref一致。没有stage或提交无关代码。

新隔离库 `fiscalhot_oct03_quality_test` 从空库完成35 migrations。Windows fresh checks：`npm run typecheck`通过；`npm test` **211/211**；`npm run build -w @aihot/web`通过；`node --test apps/web/tests/*.test.ts` **15/15**；`node scripts/smoke.ts --base http://127.0.0.1:3000` **30/30**。focused：OCR **34/34**（含Windows真实短PowerShell fake-child及故障收尾）；正文policy **9/9**、旧characterization **6/6**、`source-rules` **7/7**、`sources` **14/14**。npm test provider均使用本机stub；测试credentials指向不存在目录，采集、Jina、IndexNow、Feishu、私网访问关闭。

指定仓库GitHub Check run [37078956435](https://github.com/revercgy-hub/MYHOT/actions/runs/37078956435) 对tested SHA `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651` 全绿；Docker和check两个job均success，check包含安装、typecheck、Web build/tests、migration/seed、smoke和backend tests。旧平台失败run [37077418870](https://github.com/revercgy-hub/MYHOT/actions/runs/37077418870) 的SHA `26ca72f...`仍作为历史失败记录，不代表本轮CI。

最新preview只读检查：`fiscalhot_preview_test`有35 migrations、3 sources disabled、3固定样本`body_status=none/revision=1`且body为空；3条publications `score=NULL/selected=false/eligible=true`；analyses/receipts/job_runs为0。API/Web/PostgreSQL仅监听loopback `127.0.0.1:3001/3000/5432`；health、`/`、`/all`、pool均200且有 `X-Robots-Tag: noindex, nofollow`；`.env`不存在，无worker。10/2 smoke记29项，本次30项；差异原因unknown，均保留实测计数。

### 单次训练数据准备结果

经Lead授权后，A一次性请求固定commit `87416418657359cb625c412a48b6e1d6d41c29bd` 的精确根目录和两个SHA派生Git Blob，共 **3 requests、均HTTP 200、2,911ms**。根目录响应136,046 bytes且Content-Length匹配；model blob线上3,402,253 bytes，decoded 2,469,156 bytes；LICENSE blob线上15,951 bytes，decoded 11,358 bytes。manifest完整、`runnable=true`；QA独立读取两文件并用 `assertPreparedManifest()`复核blob SHA、SHA-256、大小和Apache-2.0标记通过。详细记录见 [OCR准备结果](../P3_OCR_API_PREPARE_2026-10-03.md)，数据仅存忽略目录 `.data/fiscal-qa/scan-ocr-poc-20261003/`。9/30 core/旧OCR及10/2失败目录均保留；未请求第四次。未创建run.json/run lock，没有运行OCR、图像基线或gold。

### 单次会计司详情正文结果

经Lead另行核销后，B在fresh `fiscalhot_oct03_accounting_live_test`（35 migrations）只运行一次 `extractArticleBody()`。disabled web_list source与唯一pending article固定为会计司注销备案名单目标URL/title/date；实际Undici hard cap=1，`attempted/dispatched/rejected=1/1/0`，create/sendHeaders/headers各1，HTTP 200，无redirect、第二请求或重试。最后article `body_status=unconfirmed/revision=1`，body与content hash均空；publication/analysis/job均无。ignored `result.json`只存请求事件摘要和结果，原HTML没有保存。runner未将helper的结构化拒绝reason留档，因此具体原因 **unknown**，不得推测为selector、表头或身份问题。详情见 [会计司policy结果](../P3_ACCOUNTING_BODY_POLICY_2026-10-03.md)。离线9/9通过不能覆盖这一live未确认结果。

## 来源逐项记录

本检查点没有扩大来源抓取或周期覆盖。此次唯一生产域名请求是已核销的一次会计司固定详情GET；它不运行collector、不启用来源，且最终机器正文 `unconfirmed`。其余11个来源没有新网络验证；12个production sources仍 `enabled=false`、全文关闭。会计司新增policy仅支持缓存样例的精确结构且真实详情实测未确认，不作为来源验收证据。旧批次hop数unknown及其他source缺口照历史报告记录，不追认。

## 环境与安全边界

本轮fresh全套回归与 live detail 使用不同新 `_test`库；preview库只读，保持既有3个人工样本和状态。OCR文件仅在ignored新目录，旧失败目录未改。测试provider指向localhost stubs；API/Web/PostgreSQL只绑定loopback；没有应用worker。生产采集、Jina fallback、模型调用、IndexNow、Feishu push/internal及private-network开关保持false；无`.env`。`OCR_RUN_ENABLED=false`且run lock关闭。prepare成功仅表示固定训练文件身份和完整性；不要把runnable数据误当成OCR授权或执行结果。

## 未完成项、风险与阻塞

- Gate 2仍未通过：来源长周期/栏目覆盖、真实增量hop预算、首页滑窗、噪声率和机器正文缺口仍需证据。
- 会计司唯一live详情正文未确认，runner遗漏helper decline reason，原响应未保存。不要重复请求或为补证据重跑；下一步先在离线方式审查helper/runner日志链路。若要再访问真实站点，须先由Lead批准新的单次请求方案，并只记录脱敏结构化reason，不无意保存原文。
- OCR数据已完整准备，但真实Tesseract持续资源采样/故障行为仍未验证；固定图/GOLD对照、run manifest和OCR执行都为NOT_RUN。
- smoke29与30的历史计数差异原因unknown；当下预览和两次实测状态并无推断覆盖。

## 下一批 Agent

先读本检查点、[项目状态](../STATUS.md)、[来源矩阵](../SOURCE_MATRIX.md)、[Gate 2就绪审计](../P3_GATE2_READINESS.md)、[10/3 S1裁定](../S1_P3_OCT03_IMPLEMENTATION_REVIEW.md)以及两份10/3 owner报告。后续诊断任务先做静态helper/runner调用链核对和localhost fixture，保持网络/DB/OCR关闭；输出结构化reason示例、明确的单次请求必要性与停止条件。不得重试刚才的详情URL，不修改生产body状态或source enabled值，不启动worker，不运行OCR。任何新的网络或OCR动作先取得对应Lead核销。文档owner更新本检查点和状态文件；OCR工具与backend实现仍按owner分别修改，Git index由负责人独占。

## 声明

所有命令、SHA、CI run、状态和拒绝原因均以本轮实际输出或ignored证据为准。helper拒绝reason未知；不据此猜测。历史smoke计数差异未知。没有由记录支持的事实不作推断；此检查点不是阶段完成交接或Gate通过。
