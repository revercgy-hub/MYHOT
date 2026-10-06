# S1 单页离线 OCR 最小范围裁定 — 2026-10-06

DATE=2026-10-06（Asia/Shanghai）  
REVIEWER=GPT-6.1 Sol / Medium  
DECISION=APPROVED_SCOPE（仅下述局部实施与监控前置验证范围）  
ACTUAL_OCR=BLOCKED_BEFORE_LEAD_EXECUTION_CHECKOFF  
GATE_2=NOT_PASSED  
BASELINE=Lead 提供 docs HEAD `290f55ca`、tested code `b85f4e21`；本审查未运行 Git 命令重核。

## 裁定

批准新增一个只接受既存厦门 `xiamen-1` PNG 的受控一次性本地开发入口，复用现有 process wrapper；批准为该入口补足本文件列出的局部守卫、日志边界和故障验证。无需建设通用 OCR 服务、OS 硬 RSS 沙箱、进程树管理器或 NAS/Linux 隔离，亦不批准这些能力的验收声明。

**本裁定没有批准启动真实 OCR。** Lead 必须先核销新入口及本机监控 preflight 证据，随后明确核销唯一一次单页执行。此前 [10/3 S1](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md) 的执行阻塞在核销前继续有效；本文件只给出解除本次单页阻塞所需的最小路径。现有五页 `run` 和 `OCR_RUN_ENABLED=false` 保持不变；直接导入 `invokeTesseract()` 后无守卫调用不是批准入口。

依据为 [AGENTS](../../AGENTS.md)、[PROJECT_PLAN](PROJECT_PLAN.md)、[STATUS](STATUS.md)、[本轮 packet](OFFLINE_OCR_VALIDATION_SCOPE_PACKET_2026-10-06.md)、[API prepare](P3_OCR_API_PREPARE_2026-10-03.md)、[process verification](P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)、[旧 OCR scope](S1_SCAN_OCR_POC_REVIEW.md)、[厦门人工复核](P3_XIAMEN_MANUAL_REVIEW.md)及实际 [wrapper](../../scripts/fiscal/ocr-scan-poc.ts)、[focused tests](../../tests/fiscal-ocr-scan-poc.test.ts)。本审查没有重审全项目、执行测试或重新测量工具/模型/PNG；packet 中的身份与旧测试是引用证据。

## 入口与一次性守卫

最小必要改动是一份 `scripts/fiscal/` 下的专用单页开发脚本及 focused test，或现 wrapper 中等效、独立的固定单页入口。不要将原五页 `run()` 改成可选页数/任意图片 CLI。仅允许为此实验补足 wrapper 的局部边界；不改 apps/backend/industry、schema、source、worker、依赖锁文件或生产 flags。

入口必须具备以下条件，不能仅靠开发者手工选参数：

- 专用执行许可默认关闭，且独立于五页 `OCR_RUN_ENABLED`。Lead 核销时绑定 tested 入口/wrapper 的代码身份和本次固定输入 profile；许可不自动从 manifest 的 `runnable=true` 推导。不得暴露 exe/image/tessdata/output/语言/PSM/预算的任意 CLI 覆盖或真实运行的 test hooks。
- 固定绝对路径解析至 `.data/fiscal-qa/xiamen-debt-round16-page.png`、既有 10/3 tessdata 与新目录 `.data/fiscal-qa/offline-ocr-xiamen-20261006/`。拒绝替代文件、额外页、路径逃逸及重解析到其它位置的输出目录；检查输出目录的 ignored 属性。不得覆盖旧准备/失败批次。专用目录应为新建且空，无旧 result/attempt/failure。
- 在首次真实子进程 admission 前，以独占创建（例如 `wx`）保存 attempt marker；该 marker 一经创建，成功、失败、进程崩溃均不允许本批次第二次 OCR。并发入口最多一个被 admit；拒绝重复时不删 marker、不清空目录、不自动恢复锁。前置被拒同样保存有限诊断；改变目录/日期不构成自动重试许可。
- 运行前重新核对当前 bytes：PNG **602,201 bytes、1323×1871、SHA-256 `B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D`**；固定 Tesseract 路径 `C:\Program Files\Tesseract-OCR\tesseract.exe`、版本 `5.5.0.20241111`、SHA-256 `CCD044D6CF16EAAAD151260E1FCC5E3E1504CD1B8644E940B4F7AE3E315DD0D3`。版本查询也要有界，不把原五页入口的无超时 version 查询直接复制为新前置。
- 调用既有 `assertPreparedManifest()` 并额外对照本轮固定 profile：commit `87416418657359cb625c412a48b6e1d6d41c29bd`；model **2,469,156 bytes**、Git blob `388bac276d033d06e5ed5ba7a7ad14ae58f97dab`、SHA-256 `A5FCB6F0DB1E1D6D8522F39DB4E848F05984669172E584E8D76B6B3141E1F730`；LICENSE **11,358 bytes**、Git blob `d645695673349e3947e8e5ae42332d0ac3164cd7`、SHA-256 `CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30`，Apache-2.0。只用现存文件，不发 prepare/下载/业务请求。
- 仅一次 `chi_sim --oem 3 --psm 6`、显式固定 `--tessdata-dir`、TXT+TSV、参数数组和受限环境，`OMP_THREAD_LIMIT=1`。并发 1；无 OSD、eng fallback、参数搜索、自动重跑或福建页面。

marker、身份 manifest 与默认关闭许可是范围守卫，不声称防御同一用户恶意篡改文件或 OS 网络沙箱。

## 实际执行与输出边界

| 项目 | 本次上限与失败处置 |
|---|---|
| 输入 | 恰好上述 1 页/602,201 bytes/2,475,333 pixels；还须满足既有 20 MiB、25 MP 单页限制。不重新采样/渲染以规避身份核对。总输入就是此页，无五页 100 MiB 扩展。 |
| 进程 | 1 个固定 Tesseract PID，另 1 个固定 Windows PowerShell monitor；没有第二个 OCR 子进程。捕获实际 PID，监控/停止只指向本次句柄/PID，不使用宽泛进程名 kill。 |
| 时间 | 单次 page deadline 30,000 ms，含 monitor 启动；完整入口墙钟预算 180,000 ms，含前置与输出核对。READY ≤5,000 ms，且不越过剩余 page/total admission 预算。不得把每一步重新计算成一个新的 180 秒。 |
| 采样 | 固定 20 ms 配置；首 sample ≤250 ms、live latest-age ≤250 ms，成功验收的最大 sample/首尾 gap ≤250 ms。watchdog 的调度粒度和实际停止延迟须报告，不能把采样设定当成实测 cadence。 |
| 内存 | Tesseract `WorkingSet64` 512 MiB sampled soft-stop，超过即请求终止并 wait；记录 observed peak。无瞬时峰值、monitor/parent 总内存、RSS 硬上限或进程树保证。 |
| OCR 输出 | TXT+TSV+实际累计 stderr 总计 ≤1 MiB；文本 ≤120,000 chars。watchdog 查文件并在 close 后复核；发生超限即失败。1页不继承 5 MiB 的可用额度。采样查文件可暂时越线，只能称停止/验收线。 |
| 日志与目录 | monitor JSONL、monitor stdout/stderr、未完成行 buffer 和诊断均必须有限；本次 monitor/控制日志合计设 ≤1 MiB，超过停止。新目录全部新增文件（含 marker、manifest、candidate、run/failure）合计 ≤10 MiB；预留失败日志空间并进行写入/close后检查，不能只数 TXT/TSV/stderr。模型/许可证只引用，不复制。 |
| 收尾 | deadline、输出/内存/monitor 故障须停止精确 child，等待 child close 与 monitor close/wait；自然成功也需两者完整证据。停止后收尾 grace ≤5,000 ms，并计入 180秒。monitor 不退出时终止本次 monitor；child/monitor 未在 grace 内关闭则记 cleanup timeout/状态未知、失败且不产生成功 candidate 结论，Lead 人工核实残留后再决定恢复，不自行追加 OCR。 |

现代码有准确 PID handshake、采样和 output 检查，但 `await closed`/`await monitorClosed` 收尾可能无期限，monitor stderr/live buffer 未设 byte cap；现 `directoryBytes` 检查只计五页 TXT/TSV/stderr，不覆盖全部目录。这些是本次必须补的局部边界。不能用报告文字替代实际入口控制，也不能将 kill 请求成功写成 close/wait 已完成。

## 可核销的监控 preflight

不要求先启动 Tesseract 才取得所谓前置资源保证。旧一次 fake child 的 first 72 ms/max gap 162 ms 是有限证据；deadline tests 实际采用注入 monitor，soft-line 注入也不是 Windows 原生 `Process.Kill/WaitForExit` 实测。旧 focused suite 可复用，不须重复完整项目 QA，但新入口及局部修正须有本轮结果。

允许一次本机离线 preflight，使用**真实 Windows PowerShell monitor**和固定本地 fake child，零 OCR/HTTP/DB：

1. 一个固定 child 在单进程中做约 10秒持续 CPU 工作后自然结束，可只申请 ≤64 MiB 的固定测试 buffer；probe page ≤30秒、整项 ≤60秒、日志 ≤1 MiB。记录实际 exe/runtime/monitor身份、READY、精确 PID、每次 flushed/live sample、first/max/末 sample-to-close gap、observed peak、两端 close 和 monitor waited。必须首尾全覆盖、gap ≤250ms、无错误；buffer 大小不是进程硬内存保证。
2. 一个独立固定 fake child 通过同一真实 monitor 的测试专用低软线（如 0）触发原生 `Process.Kill()`/`WaitForExit()`，并核对 PID、kill reason、child close、monitor close/wait及收尾 grace。此项只证明停止路径，不能写成真实 512 MiB threshold 或 Tesseract 资源验收。低阈值仅存在于本地 test seam。

两项属于预先列明的不同故障/自然关闭案例，不是失败重试；每项一次，任一失败停止并保持真实 OCR blocked，不自动改 250ms 容忍度或降低监控要求。如此证据只说明当前机器的固定探针具备可审计监控路径；真实 OCR workload 的 latency/RSS 仍未知。Lead 可在这些前置合格后核销唯一一次单页 OCR 来观测未知项，实际运行若 gap/输出/资源/终止失败就如实失败，不要求事先无证据的强平台隔离。

最小离线故障矩阵还须覆盖：许可关闭、marker已存在/并发竞争、任一固定身份变化、额外输入/越界输出路径均 **0 OCR child admission**；monitor无READY/启动timeout阻止 child；错误PID、缺首sample、stale sample、monitor早退/失败导致停止；page/total deadline与输出超限停止并close后复核；child或monitor卡在收尾不无限等待、不report success；目录/监控日志超限停止；一次失败后再次入口不启动。已有未改变路径的旧测试不必机械复制，新守卫/cleanup/cap必须有 focused 证据；缩小注入预算仅用于本地 fake fixtures。

## Lead 的两步核销与结果边界

**第一步，仅核销实现/preflight：** Lead 取得精确代码/工具 hash、默认锁状态及无五页/production flag变更的 diff，focused fault tests 原始命令/exit/结果、上述两个真实 monitor preflight raw JSONL 与时序/byte汇总；核对 kill与close/wait分开、所有成功判据通过、无剩余探针PID、新OCR目录尚无 attempt/result。输入/引擎/model/license/current manifest 的固定 bytes/profile再核对且输出目录ignored。该步通过只建立执行准备。

**第二步，独立核销唯一单页执行：** Lead 明确记录本次固定 profile、tested入口版本、新ignored目录、一次性许可、1 OCR admission、上述预算和无重试。默认锁不能因本文件、测试绿或 `runnable=true` 自动打开；不打开五页 flag或任何生产开关。核销后入口在admission前独占marker并留存允许参数、守卫结果、PID/monitor/时限/输出/错误等日志。

运行结果须保留 raw TXT/TSV、stderr、monitor/control记录和失败原因。成功只是 `fixed_sample_ocr=candidate-only`，不是 `body_status=ok`；完整性与字段评价单独记录。按既有人工报告固定全部14字段的 expected/candidate/missing/mismatch及页号，不能只用现 helper 的10个表格candidate覆盖标题/机构/招标日期/签章日期；缺字段如实missing。显式归一化可单列，不能从人工expected补值，印章细字与QR继续unknown。记录语言/模式、实测墙钟/peak/gap、停止原因、两端close/wait、实际bytes及限额是否满足。实际未触发512MiB停止就写未触发/未知，不宣称已实测超阈值行为。

会计司与厦门既有正文仍 unconfirmed；此实验不写 article/body helper、DB、queue、analysis、selection、publication或Gold dataset/labels，不开启来源或全文，不更新Gate 2。无跨期泛化、自动运行、来源稳定、多页通过或NAS资源验收结论。任何进一步OCR/参数比较/业务集成须另有证据与范围核销。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：仅裁定一个固定厦门单页本地OCR实验的最小受控入口与前置核销路径。

**MODEL**：GPT-6.1 Sol / Medium；未调用仓库provider。

**FILES_CHANGED**：仅新增本文；不改shared docs/index、代码、开关或ignored数据。

**TESTS_RUN**：只读上述规约/计划/状态/packet/旧裁定与process/prepare报告、人工复核、wrapper及focused test源码；没有测试、Git、DB、HTTP、OCR或进程探针运行。296项本机/CI绿来自既有状态，不是本轮OCR验收。

**RESULT**：APPROVED_SCOPE，限入口/局部边界实现及上述监控preflight；actual OCR仍BLOCKED_BEFORE_LEAD_EXECUTION_CHECKOFF。准备身份已由packet核对，未由本审查重新测量；Gate2 NOT_PASSED。

**RISKS**：真实Tesseract输出、内存、负载cadence与停止延迟尚未知；512MiB与文件监测均为采样停止线；单PID无树/硬RSS/NAS隔离；单固定样本无泛化证据。

**BLOCKERS**：实际执行前仍缺新入口/收尾/全目录cap实现与focused证据、持续真实monitor preflight及Lead独立一次性执行核销。业务机器正文、核心source验收和Gate2继续阻塞。

**NEXT**：Luna按本scope最小实现和本机fake preflight，Lead依两步清单核销；核销前真实OCR不运行。核销后最多一次单页候选实验，失败停止并保留证据。
