# Phase C S1 离线OCR软件QA与monitor preflight检查点（2026-10-06）

STATUS=IN_PROGRESS（软件实现与回归完成；native资源前置未通过）  
STAGE=P3 / Phase C evidence preparation  
GATE=Gate 2 `NOT_PASSED`；OCR scope `APPROVED_SCOPE` 仅限固定入口/守卫/前置验证；actual OCR `BLOCKED`  
BRANCH=`feat/fiscal-finance-hot`  
HANDOFF_HEAD=本handoff和索引作为docs-only提交，不作自引用；读取时用 `git rev-parse HEAD`。最新tested code为下列 `c7a0274…`。  
STAGE_CODE_SHA=`290619355c9d60b6da155c9215381c82b6acf9b2`（固定单页工具与focused tests）  
LATEST_TESTED_CODE_SHA=`c7a027491b809f91edec42c3abeaee017e901ba9`（仅增加deadline测试夹具预算隔离）  
BASE_SHA=`290f55cafe8f42289c9efb7b76a9ae5c92e6ae0a`（本轮Phase C恢复基线）  
WORKTREE=docs checkpoint提交后预期干净；`.data/`测试、preflight、原始证据均Git-ignored。

## 状态与退出条件

S1 fixed-profile implementation、只读合同review、本机软件QA和一项native monitor preflight各有独立结果。代码实现通过本机与CI软件检查；native case 1 因真实PowerShell monitor sample gap超过250 ms失败，按守卫停止了fake child。case 2未启动，actual OCR未运行。故软件QA状态为通过，monitor前置状态为失败，OCR执行准备未通过；不能将本检查点写成OCR-ready、source-pass、body-ready或Gate 2完成。

Lead批准的单页scope仍只有厦门固定PNG、独立默认关闭入口、局部monitor/cleanup/cap守卫、focused tests及两项fake-child preflight。预置 `OFFLINE_XIAMEN_OCR_ENABLED=false`、历史五页 `OCR_RUN_ENABLED=false`。任何新的preflight或真实OCR运行须有后续独立核销；本次case 1失败不能靠重跑、降低250 ms门槛或启动case 2清除。

## 软件代码、身份与测试

代码只包含以下四个owner文件；没有改backend、行业source、schema、依赖锁、默认production flag或业务数据：

- `scripts/fiscal/ocr-scan-poc.ts`
- `scripts/fiscal/offline-xiamen-ocr.ts`
- `tests/fiscal-ocr-scan-poc.test.ts`
- `tests/offline-xiamen-ocr.test.ts`

工具实现commit `290619355c9d60b6da155c9215381c82b6acf9b2` 已推送 `origin/feat/fiscal-finance-hot`。它后的单独test fixture commit `c7a027491b809f91edec42c3abeaee017e901ba9` 将page deadline测试的page/total budget拉开，断言仍只接受`page deadline`；源码、entry及Web/API/runtime未改。当前latest tested code为c7 commit。

本机最终冻结代码的软件结果：Node `v24.16.0`，全新数据库 `fiscalhot_oct06_s1_qa2_test` 执行35项migration后 `npm test` 为303/303、exit 0；`npm run typecheck` exit 0；Web production build exit 0、Web tests 15/15、loopback smoke 30/30均通过。只改test fixture后的再验证使用新库 `fiscalhot_oct06_s1_fixturefix_test`，35 migrations、`npm test` 303/303 exit 0、typecheck exit 0。后一次改动不触及运行时代码，故Web build/tests/smoke沿用同一提交序列中已通过且runtime未变的实测，不重复执行。

focused历史需保留：更早一次focused结果曾是38/40、两项失败，没有原始日志；final-01原始日志为40/41、exit 1（output-directory-cap测试仍期待旧错误文本）；final-02为41/41、exit 0。初次combined CI run [37436673475](https://github.com/revercgy-hub/MYHOT/actions/runs/37436673475) 测试 `2906193…` 时Docker通过，但Linux backend为303项/301 pass/1 fail/1 Windows-only skip；失败是deadline fixture期望`page deadline`、实得`total deadline`。test-only修复后page-deadline-focused日志41/41 exit 0；最终combined CI run [37438292607](https://github.com/revercgy-hub/MYHOT/actions/runs/37438292607) 测试精确SHA `c7a027491b809f91edec42c3abeaee017e901ba9`，Check与Docker均success，含Linux backend、typecheck、Web build/tests、migration/seed及smoke。

错误profile的本机full历史同样保留：fresh `fiscalhot_oct06_s1_qa_test`、35 migrations、`npm test` 303项/278通过/25失败/exit 1；原因是本机测试子进程全局设为`MODEL_CALLS_ENABLED=false`，而既有测试需访问各自localhost fake provider。此run不是有效代码回归，未被删除或覆盖。过程中清掉继承的provider keys/base URLs和代理、凭据目录不存在，副作用开关关闭；没有请求级网络telemetry，因此不声称此错误profile run的non-loopback请求数为0。正确profile下，`MODEL_CALLS_ENABLED=true`只在`npm test`进程使用；真实provider keys/base URLs仍清空、credentials dir为不存在路径、provider测试使用各自localhost stubs、`EMBEDDINGS_ENABLED=false`全局默认、COLLECT/Jina/IndexNow/Feishu/private network/OCR均关闭。

另一次无run的workflow误派发尝试是默认 `gh` 指向upstream `KKKKhazix/AIHOT` 后遭HTTP 403；GitHub明确未创建run。随后显式指定origin仓库和Check workflow ID `369857246`，只创建了上文正确仓库的两个combined CI runs；最新绿色run为37438292607。误派发不是权限阻塞，不需用户介入。

本机记录日志位于ignored `.data/fiscal-qa/s1-final-qa-20261006/`，test-fix复验在 `fixturefix/` 子目录。preview `fiscalhot_preview_test` QA前后只读计数保持相同：35 migrations、3 sources（enabled/site_fulltext/syndicate_fulltext全为0）、3 articles（body_status非none为0）、3 publications；analyses、receipts、fetch_runs、selected_ledger、job_runs均0。API/Web仍只监听`127.0.0.1:3001/3000`，health为`{ok:true,db:ok}`，Web返回200且X-Robots为noindex；没有worker。固定输入/profile核验通过：PNG 602,201 bytes、1323×1871、SHA-256 `B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D`；Tesseract `C:\Program Files\Tesseract-OCR\tesseract.exe`版本profile `5.5.0.20241111`、文件SHA-256 `CCD044D6CF16EAAAD151260E1FCC5E3E1504CD1B8644E940B4F7AE3E315DD0D3`；chi_sim model 2,469,156 bytes、SHA-256 `A5FCB6F0DB1E1D6D8522F39DB4E848F05984669172E584E8D76B6B3141E1F730`；LICENSE 11,358 bytes、SHA-256 `CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30`。输出目录 `.data/fiscal-qa/offline-ocr-xiamen-20261006` 不存在且被Git忽略；没有Tesseract进程。

## Native preflight：CASE1 FAILED，CASE2 NOT STARTED

Root只核销了一次10秒CPU fake-child自然关闭/cadence测试。固定PowerShell monitor配置采样间隔20 ms，sample gap上限250 ms。原始数据与精确边界见[preflight报告](../OFFLINE_OCR_NATIVE_PREFLIGHT_2026-10-06.md)、[failure analysis](../OFFLINE_OCR_MONITOR_FAILURE_ANALYSIS_2026-10-06.md)和ignored目录 `.data/fiscal-qa/offline-ocr-preflight-20261006/case1-natural-close/`。

独立QA确认：case1 manifest记录Node24.16.0、Windows PowerShell 5.1.26100.9444、runner/wrapper SHA与冻结代码匹配；`preflight-host.json` SHA-256 `FFB0FD9F3785A85740E615D8F7F27872AD385F76AD68FE8A9351AE814B2B1D08`；case1 runner SHA `E6CFFAC29A15EF8B2F66F8EACF595F73DF884D31B426A584D63EF4A6D0A7CB2A`；wrapper SHA `F96FBCCE78403A79035BA9660D0B5DDD273C86F4D61CC092B1C653C129A250B3`。原始JSONL SHA-256 `F0757E362A2F5D7F4CE793AD310F987278E48C3D0B2AE87DAFBB20486CBD94C1`，summary SHA `6873047BDD4F2B5FCDCCE7CE36D466AB983E8D45AD7DC733AB547BF9872E7340`，one-shot marker SHA `3822A1239EBA31875A54E9BBA2CD8B34412FBD102BFDDE67F1ACFDFFB3C264CA`。原始JSONL两条WorkingSet样本分别是`2026-10-06T08:38:38.3466731Z / 74,854,400 bytes`与`2026-10-06T08:38:38.6283239Z / 0 bytes`，间隔281.6508 ms，超过250 ms。PID `358552`、总历时741 ms，wrapper主停止原因为`resource monitor sample overdue`，发出SIGTERM；child close/wait=true、monitor exit=0且close/wait=true。Node与Tesseract PID均无残留。Case1 ignored artifacts共2604 bytes，小于1 MiB；one-shot marker保留。

summary里的次级wrapper错误原文为`resource monitor final sample preceded child close check is invalid`。wrapper按 `childClosedAt - lastSampleAt` 作校验并在负值时抛该错误；当前raw没有保存精确child close timestamp或负值幅度。报告应只写成“wrapper比较显示最后sample时间晚于所记录的Node child-close时间”，不能凭错误文案倒读方向或推定底层OS事件顺序。第一次primary overdue stop与次级tail validator failure是两个事实；不会互相覆盖。

case2目录可能为空，但`case-marker.json`与`monitor.jsonl`均不存在；没有执行case2的0 soft-line kill/wait probe。actual OCR output目录与attempt marker不存在。没有Tesseract启动、OCR请求、HTTP、DB写入、source/collector、worker或model调用。source状态没有改变。

## Phase C source / data 边界

上海原始证据单独记录于[S1 Phase C source evidence checkpoint](S1_PHASE_C_SOURCE_EVIDENCE_CHECKPOINT_2026-10-06.md)：两次分别核准的一次性列表/详情GET及hash已经QA复核；日期差异仍未裁定，候选保持`EVIDENCE_PACKET_ONLY / NOT_ADMITTED`。该证据不因本次工具实现、CI绿灯或OCR scope approval转为source pass。区域覆盖矩阵、来源矩阵和Gate 2结论不变。

当前正文缺口仍见[Phase C body-gap report](../PHASE_C_BODY_GAP_REMEDIATION_2026-10-06.md)。S1 single-page OCR输出未来也只允许`candidate-only`，不代表人工Gold、正文`ok`、publication eligibility、来源完整性或业务验收。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：完成Phase C S1单页离线OCR工具的QA handoff，并独立核实native preflight case1原始结果；不运行第二项probe或真实OCR。

**MODEL**：GPT-6 Luna High。

**FILES_CHANGED**：新增本handoff；更新`STATUS.md`、`PROJECT_PLAN.md`与`HANDOFFS/README.md`；一并索引和保留本阶段source/body-gap/OCR范围、implementation、readonly review、preflight与failure analysis报告。产品代码仅在前述290619和c7两项已提交提交中变更。

**TESTS_RUN**：本机正确profile fresh backend `npm test` 303/303两次、typecheck通过；Web build、Web tests 15/15、loopback smoke 30/30一次（runtime未变，test-only fix后复用）；正确仓库CI run37438292607 success。focused原始日志和各项失败历史如上。case1 native preflight实际运行一次且失败；QA只读检查raw/manifest/hash/PID状态，没有重跑preflight。case2与actual OCR未运行。

**RESULT**：软件实现测试状态`PASS`；native monitor case1 `FAIL`；case2 `NOT_STARTED`；actual OCR `NOT_RUN / BLOCKED`；上海source `NOT_ADMITTED`；Gate 2 `NOT_PASSED`。默认许可保持关闭。

**RISKS**：native fake workload的真实PowerShell sample gap未满足250 ms；case1没有运行满10秒，不能代表长负载，或Tesseract运行/内存表现。采样和512 MiB WorkingSet均为soft-stop/acceptance，不是硬资源隔离。失败根因未知；原始证据未采集monitor flush/Node receipt/OS scheduling duration。GitHub CI只证明c7 SHA的软件检查。

**BLOCKERS**：按已批准scope，case1没通过，因此case2未核销、真实OCR仍blocked；任何后续诊断、preflight重试、case2或OCR需要Root逐项给出新的明确范围和执行核销。Gate 2仍因逐局来源覆盖、日期、历史、正文质量和跨周期证据未完成而`NOT_PASSED`。

**NEXT**：Root先审阅[monitor failure analysis](../OFFLINE_OCR_MONITOR_FAILURE_ANALYSIS_2026-10-06.md)，决定是否另开诊断/修复范围。未获得后续核销前，不重跑case1、不启动case2、不修改250 ms阈值、不创建OCR marker、不运行OCR。来源工作继续按各自handoff推进；所有source保持disabled、coverage unproven。
