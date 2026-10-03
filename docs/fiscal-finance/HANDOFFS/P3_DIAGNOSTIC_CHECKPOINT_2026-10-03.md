# P3 抽取诊断检查点（2026-10-03）

STATUS=IN_PROGRESS
STAGE=P3 本地抓取与正文验证
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=e7fac2b23b3e0baa375f273a97edbdf8c1c37584（本次docs-only改动提交前实测HEAD；最终文档HEAD以提交后Git记录为准）
STAGE_CODE_SHA=e7fac2b23b3e0baa375f273a97edbdf8c1c37584
BASE_SHA=e16cda6519dc5d6fa7b6e41015535f60ba4e9504（本次代码提交的父基线；此前最近业务代码SHA为`9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651`）
WORKTREE=代码提交已push；本检查点、STATUS、SOURCE_MATRIX、P3_GATE2_READINESS、HANDOFFS/README、诊断报告和Gate 2 next-batch报告为本次docs-only变更，提交前待提交；`.data/`证据被Git忽略。

## 阶段退出条件与结论

Gate 2仍未通过。12个生产来源全部disabled且全文关闭；现有全首页采集和单篇正文证据不构成长周期稳定性、首页窗口覆盖或全栏目验收。两次旧完整首页批次的hop总量仍unknown，不能追认预算通过；后续新验收可通过已审计的dispatch硬上限和清晰的问题范围建立新的证据。12源优先级、候选最小验证及限制见[Gate 2下一批报告](../P3_GATE2_NEXT_BATCH_2026-10-03.md)，本检查点不重列整表。

本次先完成结构化helper warning的本机observer与fixture，再按Root单独核销对会计司保存列表中一篇文章进行一次direct extract。真实请求受限为一条disabled source与一条article、Undici dispatch cap=1、redirect=0、不重试、不取附件、不启collector/worker/model。HTTP 200后helper返回`attachments_unprocessed`，文章仍`unconfirmed`。该结果记录了helper的具体保护拒绝原因，但由于没有保存响应HTML，只能说helper检测到PDF样式链接；链接的真实文件类型及其与页面正文/业务内容的关联unknown。该reason在身份、表格和正文长度核验之前返回，不能据此判定页面正文或source通过。9/4旧会计司详情的helper reason仍unknown且未重试。

## 完成内容与可复核证据

**代码与CI。** 新诊断observer及tests在代码提交`e7fac2b23b3e0baa375f273a97edbdf8c1c37584`，已push到`origin/feat/fiscal-finance-hot`。GitHub [Check run 37088146532](https://github.com/revercgy-hub/MYHOT/actions/runs/37088146532) 对相同SHA成功，Docker与check jobs全绿；backend tests为213项、212 pass、0 fail、1 skipped（Windows-only monitor）。CI覆盖安装、typecheck、Web build/tests、迁移/seed、smoke及backend tests，不验证真实来源覆盖或OCR。

本机新建隔离库`fiscalhot_oct03_lunaqa_test`，空库完成35 migrations。`npm run typecheck`、`npm test`、`npm run build -w @aihot/web`成功；Web tests为15/15；`node scripts/smoke.ts --base http://127.0.0.1:3000`通过30项。Focused observer测试另在fresh `fiscalhot_oct03_diagnostic_test`完成35 migrations后运行，2/2通过；typecheck通过。测试运行时进程环境的采集、模型、Jina、IndexNow、Feishu、私网与OCR开关均false；模型相关测试只使用本机fake providers，测试credentials目录不存在。

Focused extractor fixture需经localhost读取；仅该test module临时将已加载backend config的`allowPrivateNetworkFetch`内存值设为true，source URL与唯一`allowUrlPrefixes`严格限定到当次127.0.0.1 fixture，结束时恢复原值并关闭server。进程环境值仍为false。此窄范围测试配置不授权任何外部/private-network业务请求。

真实单篇诊断的ignored证据为`.data/fiscal-qa/diagnostic-live-20261003/result.json`及同目录`runner.mjs`。新隔离库`fiscalhot_oct03_diagnostic_live_test`复核有35 migrations；source仍disabled、`site_fulltext=false`、`syndicate_fulltext=false`。真实URL为：

`https://kjs.mof.gov.cn/gongzuotongzhi/202607/t20260714_3993483.htm`

Seed文章预期标题来自保存列表，列表日为2026-07-15；离线比对未在9/30该source十个已访问URL/ID或10/3此前固定URL中找到它，但其他历史会话访问记录unknown，不称“首次访问”或“新增覆盖”。唯一本次请求的事件为`request:create`、`sendHeaders`、`headers`各1次；HTTP 200、无request error，budget=`attempted/dispatched/rejected 1/1/0`。终态`body_status=unconfirmed`、revision 1、正文长度0、正文hash/contentHash为空，publications/analyses/receipts/job_runs均0。日志中没有原HTML。未重试、无第二次dispatch、未请求附件，未启动collector、worker或模型。

## 来源逐项记录

本检查点只增加会计司一条精确URL的单次抽取诊断，不是来源阶段全量验收。该source id为`mof-accounting-notices`，生产配置继续disabled、全文关闭。候选列表来自已保存的`mof-accounting-index-1.html`；文章URL、标题和列表日见上。详情HTTP为200，但机器body未确认。`attachments_unprocessed`是helper观测到至少一个PDF样式链接后按保护策略拒绝；因HTML未保存，实际文件类型/业务关联未知，且拒绝先于身份、表格与长度检查。此次未请求链接、未验证附件、栏目覆盖或collector行为。其余11源及所有跨周期/首页滑窗项目无本次新增核验，详见[来源矩阵](../SOURCE_MATRIX.md)和[Gate 2下一批报告](../P3_GATE2_NEXT_BATCH_2026-10-03.md)。

## 环境与安全边界

本机loopback preview API/Web/PostgreSQL通过仓库既有脚本启动，仅绑定`127.0.0.1:3001/3000/5432`；端口55432无监听，无应用worker。对`fiscalhot_preview_test`在启动服务前与smoke后分别执行`BEGIN READ ONLY`查询及`ROLLBACK`，结果一致：35 migrations、3 sources全部disabled/fulltext false、3固定样本`body_status=none/revision=1`且正文为空、3 publications、analyses/receipts/job_runs=0。GET health、pool、`/`及`/all`均200，页面带`X-Robots-Tag: noindex, nofollow`。预览数据库未被改动。

`.env`不存在；preview启动脚本与单篇runner显式设置`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`、`OCR_RUN_ENABLED`为false。本次已核销的一次会计司详情GET是唯一外部业务HTTP；无模型/OCR/付费调用、无附件访问。本轮没有新建数据库以外的业务状态写入，P3 live测试库仅含固定source/article及抽取结果，不含publication/analysis/receipt/job run。

## 未完成项、风险与阻塞

- Gate 2仍为`NOT_PASSED`；完整来源覆盖、轮询窗口/跨周期表现、失败退避和区域短正文仍待证。
- 此次单篇HTML被附件保护规则拒绝。该reason本身不证明PDF链接为真实附件或与业务相关；无原HTML可离线判定。若需进一步识别无关PDF样式链接导致的误拒，先以localhost fixture验证。改变通用guard需新的S1审查。
- 9/4会计司详情旧请求reason继续unknown，未重试；July14候选历史是否在更早未记录会话中访问同样unknown。
- OCR数据准备虽已完整，`OCR_RUN_ENABLED=false`，OCR及gold仍`NOT_RUN`；Gate 2也不以OCR作为通用前置。

## 下一批 Agent

先读本检查点、[项目状态](../STATUS.md)、[来源矩阵](../SOURCE_MATRIX.md)、[Gate 2就绪审计](../P3_GATE2_READINESS.md)、[12源优先级与最小验证](../P3_GATE2_NEXT_BATCH_2026-10-03.md)及相应owner报告。下一步聚焦支持的可读HTML正文样本、附件负例的离线分类、关键短正文判定和有时间间隔的首页窗口证据；任何新官方URL必须由Lead另行核销。维持12源disabled、模型/采集/worker/OCR关闭；通过正式Gate 2前不得开始P4。

## 声明

记录的SHA、CI run、SQL状态、请求事件和reason均来自Git、GitHub Actions、ignored执行记录或只读SQL输出。`attachments_unprocessed`仅为此次helper保护拒绝，不推断实际附件类型、正文业务关联或其他文章状态；9/4旧reason与历史URL访问仍按unknown记录。没有由证据支持的事实不作推断；本检查点不代表Gate 2通过。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：恢复P3诊断交接、验证loopback preview只读状态、核对结构化拒绝reason observer，并记录Root核销的一次单篇详情提取结果。

**MODEL**：Luna High；未调用项目运行时模型。

**FILES_CHANGED**：代码提交`e7fac2b`仅新增诊断script与test；本次docs-only提交更新`STATUS.md`、`SOURCE_MATRIX.md`、`P3_GATE2_READINESS.md`、`HANDOFFS/README.md`，新增本检查点，并纳入已完成owner报告`P3_EXTRACT_DIAGNOSTICS_2026-10-03.md`与`P3_GATE2_NEXT_BATCH_2026-10-03.md`。没有修改`industry/sources.json`、backend抽取逻辑、迁移或生产source状态。

**TESTS_RUN**：focused诊断2/2；fresh 35-migration隔离库、typecheck、全套`npm test`成功、Web build、Web tests 15/15、smoke 30项；同一代码SHA的CI backend tests 213项、212 pass、0 fail、1 skipped，Docker/check jobs全绿。preview的前后SQL核验均为只读。

**RESULT**：observer通过本机fixture；经核销的July14单篇HTTP请求1/1，状态`unconfirmed`，structured reason=`attachments_unprocessed`，正文/hash为空。9/4旧URL reason unknown保留；Gate 2仍未通过。

**RISKS**：单次拒绝没有保留响应HTML，PDF样式链接的类型与页面业务关联未知；source历史访问未知，不据此声称首访或覆盖。

**BLOCKERS**：12源完整性与跨周期证据不足，短正文/附件负例仍需按可复核标准处理；Gate 2正式审查尚未通过。

**NEXT**：QA维护者完成本docs-only提交并记录最终git HEAD；之后按Gate 2 next-batch报告先用offline fixture审查附件误拒，再补有界跨周期/首页窗口证据。任何新URL、通用guard改动或OCR执行均需各自范围审查/核销。
