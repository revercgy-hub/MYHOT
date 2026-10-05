# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=以 `git rev-parse HEAD` 实时读取的当前分支HEAD为准（文档不自引用）
CHECKPOINT_CODE_SHA=a00795ea5911afaa2bdf4ac31580b29a9c84a33c（两个Oct05代码commit组合；本机fresh full 252/252）
SOURCE_CONFIG_SHA=a00795ea5911afaa2bdf4ac31580b29a9c84a33c（15项source随代码commit提交；全部disabled，未导入数据库或启用）
WORKTREE_SOURCE_COUNT=19（未提交候选；新增河南/湖北/湖南/广东4项disabled source，full-text关闭）
CI_TESTED_SHA=a00795ea5911afaa2bdf4ac31580b29a9c84a33c
CI_TESTED_RUN=37281829324（success；Linux backend 252 tests/251 pass/1 Windows-only skip；[GitHub Actions](https://github.com/revercgy-hub/MYHOT/actions/runs/37281829324)）
CI_PREVIOUS_FAILED_SHA=26ca72f2b94d37383072c0e54be6f94682b0e9bd（run 37077418870；平台修复前的历史失败仍保留）
CI_PREVIOUS_FAILED_RUN=37077418870
PREVIOUS_CI_TESTED_SHA=8e845812b6ce1db45821ade7b2162a90f589e1de
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
ROUND_BASE_SHA=c73473b386c9724ab9d14aded97df3bf2f8e7cd7（本轮交接基线，不替代项目BASE_SHA）
DOC_HEAD=文档提交不自引用；文档提交后由 `git rev-parse HEAD` 实时读取，CI code SHA单独记录
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3 / Gate 2 remediation；Oct05三局配置与fixture测试及signals本地provider fixture隔离改动已提交，fresh local software checks和最终代码SHA CI通过。Gate 2尚未正式通过。
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED。S1的`APPROVED_SCOPE`只批准实现范围，不是Gate 2审查/通过，也不启用source、collector或模型worker。
REVIEW=新本地fresh `_test`库 `fiscalhot_oct05_bureau_final_rerun_test` 完成35 migrations；Node24 `npm run typecheck`通过，`npm test` 252/252且0 skip。最终代码SHA的Linux CI backend为252 tests/251 pass/0 fail/1 Windows-only monitor skip；CI另通过typecheck、Web build/tests、migration/seed、built-site smoke和Docker smoke。Vite Web build本机成功（有>500KB chunk warning）；Web tests 15/15，loopback smoke 28/28。全套测试进程MODEL_CALLS_ENABLED=true仅供localhost fake providers；signals测试局部启用现有localhost embedding stub，并选用本文件现有localhost Deepseek review stub；全局EMBEDDINGS_ENABLED=false。真实provider keys/baseURLs清空、credentials目录不存在、无`.env`；COLLECT/JINA/Feishu/IndexNow/private-network/OCR均false。preview固定3条source均disabled、三篇article `body_status=none/revision=1`且正文长度0，analyses/receipts/job_runs均0；API/Web/Postgres只绑127.0.0.1，无worker。没有新增apps/packages/backend/schema/migration实现改动。
LATEST_CI=run [37281829324](https://github.com/revercgy-hub/MYHOT/actions/runs/37281829324) 对 `a00795ea5911afaa2bdf4ac31580b29a9c84a33c` 已完成且success。CI仅证明其tested SHA软件检查通过，不代表Gate 2/3/4、真实provider或来源覆盖验收。
CURRENT_TURN=恢复日期2026-10-06；本轮网页请求真实UTC时间取各manifest，主要观察发生于10月5日，不推导额外跨日/跨周期证据。提交代码基线a00795e有15项disabled source；当前未提交工作树配置为19项（14 HTML、1 JSON），新增河南/湖北/湖南/广东4项均disabled、全文关闭。19源代码修复前Node24 fresh 35-migration回归252/252、typecheck、Web build、Web tests15/15、smoke28/28通过；它不是S4修复后的最终回归。批次5–9共19局、18局观察到工作动态首屏，甘肃主页超时；浙江监管工作页有9项列表和首篇详情（标题/日期一致、666字符/4段财政监管业务样本）。batch5–9详情共18次尝试、17个HTTP200/raw已核hash匹配manifest，青岛1次20秒timeout；新增获批15条中14次HTTP200/raw核验通过、青岛timeout。云南列表日/URL日为9月18、详情PubDate/可见日为9月24；新疆显示/PubDate为9月24、URL日为7月17，均保留差异不推断。北京/FJ/SH单源隔离collector结果已核验；FJ唯一pending文章cap1诊断为unconfirmed/non_article_container、正文只有重复标题16字，邻近PDF链接未请求；首轮无ID warning不追认给该行。Sol只读审查结论`CHANGES_REQUIRED / APPROVED_SCOPE`：无marker的unconfirmed正文存在自动分析/精选可达路径；B已开始最小source-specific严格正文就绪保护实现，未测试/提交。上海repeat list超时partial，无重试。所有来源仍disabled、未导入正式source表；无worker/model；Gate 2仍NOT_PASSED。
BLOCKERS=Gate 2仍NOT_PASSED：35局目标栏目范围、逐源分页/历史窗口、日期/正文业务质量、噪声和跨周期证据尚未闭环；旧预算或hash unknown不追认。上海重复列表与青岛详情各有一次timeout，均保留partial且不重试；云南、新疆日期字段冲突未决。S4发现无marker的unconfirmed正文有自动分析/精选可达路径，批准的最小source-specific保护正在实现，修复后回归和最终CI未完成。P4真实provider配置/凭据仍缺；Gold有8条草稿未完成人工标注；P6/P7与Gate4未完成。

COMPLETED=本轮之前的代码/CI基线 `a00795e` 与run 37281829324；当前工作树19项disabled source候选；四局region config parser focused test与source-rules新增断言；fresh 35-migration `fiscalhot_oct06_sources_final_test` 上Node24 npm test252/252、typecheck、Web build、Web tests15/15及loopback smoke28/28；regional batch5–9和浙江栏目raw/hash/锚点QA；四局详情raw/hash/正文结构QA；北京/FJ/SH各自隔离库结果SQL QA。有效测试进程MODEL_CALLS_ENABLED=true仅为现有localhost fake providers，EMBEDDINGS_ENABLED全局false且signals测试局部启用本地fake；其他安全阀关闭且凭据目录不存在。前两次npm test尝试由于PowerShell环境筛选误删/未传DATABASE_URL，在setup guard处拒绝、未连测试库，不是测试失败；仅最后显式传入`*_test`库的252/252计入回归结果。CI still为已提交a00795e/run37281829324，19项候选新代码CI待后续提交/dispatch。
IN_PROGRESS=Root已采纳Sol S4只读审查结论；B按批准范围正在实现最小backend source-specific保护（无migration/app公开合同/PDF下载，保留legacy RSS summary-only）。A授权的15条详情追加核验已完成并独立核hash/manifest，浙江首篇详情纳入；所有owned结果与matrix可复核。当前19源配置及测试为修复前候选，原252/252套件仅作为该基线记录；等待S4实现冻结后做必要fresh回归和最终combined SHA一次CI。所有来源仍disabled，未导入正式source表；source验收与Gate 2未完成。
NEXT=完成并审核S4最小修复及针对性行为验证；按AGENTS对最终combined code执行一次必要fresh全套与CI，再明确路径分组提交代码并docs-only收尾。此前已验证S4前的19源full绿结果不可表述为修复后最终验收；不重复dispatch中间CI。保持来源disabled、无worker/模型。Gate 2仍NOT_PASSED。

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
