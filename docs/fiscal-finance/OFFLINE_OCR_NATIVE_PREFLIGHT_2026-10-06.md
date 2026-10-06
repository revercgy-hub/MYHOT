# 厦门单页 OCR native monitor preflight — 2026-10-06

DATE=2026-10-06（Asia/Shanghai）  
TASK=Lead 核销的本机 fake-child monitor preflight  
MODEL=GPT-6 Luna / High  
ACTUAL_OCR=NOT RUN  
CASE1=FAILED; CASE2=NOT STARTED  
OCR_RUN_ENABLED=false；OFFLINE_XIAMEN_OCR_ENABLED=false

## 结果先行

只启动了一次自然关闭/cadence probe。真实 Windows PowerShell monitor 在 20 ms 配置下，两条 sample 间隔为 **281.6508 ms**，超过 250 ms 上限；wrapper 按守卫以 `resource monitor sample overdue` 终止 fake child。child 的 PID close/wait 与 monitor close/wait 均已观察到，没有残留 PID，但 wrapper 又因最后 sample 时间晚于 child close 而以失败结束。因此第一项 **FAILED**。按核销条件，第二项 native low-soft-line kill/wait probe 未启动，实际 OCR 未运行。没有重试、降低 gap 条件、修改 wrapper 或对任意进程执行 kill。

本证据说明当前 Windows monitor path 没有通过本次固定 cadence gate。它不证明 Tesseract 的实际负载/质量，也不证明硬 RSS 或进程树隔离。此次 failure 安全地拒绝了成功结果；要继续需 Root 审阅失败证据并明确后续范围，不能从本报告推导 OCR 准入。

## 固定 profile 与身份

所有 preflight artifacts 位于 Git-ignored `.data/fiscal-qa/offline-ocr-preflight-20261006/`；实际 OCR target `.data/fiscal-qa/offline-ocr-xiamen-20261006/` 仍不存在。

| 项目 | 本次身份 / 限额 |
|---|---|
| Frozen process wrapper | `scripts/fiscal/ocr-scan-poc.ts` SHA-256 `F96FBCCE78403A79035BA9660D0B5DDD273C86F4D61CC092B1C653C129A250B3` |
| Single-page entry（未调用） | `scripts/fiscal/offline-xiamen-ocr.ts` SHA-256 `42AF3AA90CFE40E13D5E645B9DB63B46AD32B74AB0C7E78F8AC903A198D0320A` |
| Runner 1 | `case1-natural-close.mjs`, SHA-256 `E6CFFAC29A15EF8B2F66F8EACF595F73DF884D31B426A584D63EF4A6D0A7CB2A` |
| Runner 2（已检查但未启动） | `case2-softline-kill.mjs`, SHA-256 `0E472FF92A3408F1A850CA159D7BA0E96BB262A80FADD46EA34826FB2DBBE7BD` |
| Node | `C:\Users\cnyyc\.codex\tools\node-v24.16.0-win-x64\node.exe`, v24.16.0, SHA-256 `B3094D0B49F9AD602262A9921551737BB97637C05DD357A06AE98188D7290AA3` |
| Native monitor | `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`, Windows PowerShell 5.1.26100.9444, SHA-256 `8BB6FA8C283B4D92120B1EF249A9B311B0F804D4CABBE9981159976C8BE76A5E` |
| Monitor settings | READY ≤5,000 ms；sample interval 20 ms；first/max/tail sample gap ≤250 ms；每项 ≤60,000 ms；cleanup grace ≤5,000 ms 且计入总预算；每项 artifacts ≤1 MiB |
| Case 1 fake child | 单一 Node 子进程，CPU loop 目标约 10 s，固定 `Buffer` 16 MiB（上限 64 MiB）；run 预算 60 s、page 30 s、cleanup 5 s；WorkingSet 软线保持默认 512 MiB |
| Case 2（未开始） | 固定单一 idle Node fake child；测试 soft line 0 bytes；相同 monitor/time/log 限额 |

运行前对两个 runner 执行 `node --check` 并检查 wrapper import；均通过。检查时两个 case marker 均不存在。运行前身份/参数记录保存在 `preflight-host.json`。第一项 marker 以 `wx` 创建；它是一次性 admission 证据，不删除或重用。第二项没有 marker。

## Case 1 的原始观测

Case 1 的完整 artifacts 在 `.data/fiscal-qa/offline-ocr-preflight-20261006/case1-natural-close/`：`case-marker.json`、`monitor.jsonl`、`summary.json`、`stdout.log`、`stderr.log` 和 `exit-code.txt`。目录共 2,604 bytes，少于 1 MiB；Git ignore 检查通过。原始命令为：

```text
node .data/fiscal-qa/offline-ocr-preflight-20261006/case1-natural-close.mjs
```

| 核对项 | 保存的结果 |
|---|---|
| Native runner exit | `1`；summary 状态 `FAIL`；墙钟 741 ms |
| READY | wrapper 收到 READY 后才 admission fake child，因此通过“≤5 s”界限；wrapper 不暴露 READY 的精确耗时，保存为 unknown/null |
| PID | `358552`；wrapper observed child close/wait；`Get-Process -Id 358552` 复核无残留。未使用宽泛进程名或 kill 命令 |
| Native sample JSONL | 2 行：`2026-10-06T08:38:38.3466731Z`，`74,854,400` bytes；`2026-10-06T08:38:38.6283239Z`，`0` bytes |
| Gap gate | 两行间隔 **281.6508 ms > 250 ms**。该数为原始 UTC sample 时间戳的差；README 条件未以平均值替代最大 gap |
| 停止与 wait | wrapper `killed=true`，reason `resource monitor sample overdue`；child close observed/waited=true，signal `SIGTERM`、exitCode null；PowerShell final row `waited=true`、exitCode null；monitor process exit 0 且 close/wait observed |
| Peak sample | PowerShell final row `peakWorkingSetBytes=74,854,400`；这是该短 fake child 的 observed WorkingSet64，不是硬上限测量 |
| Final validation | wrapper error `resource monitor final sample preceded child close check is invalid`；没有成功的 natural-close/cadence result |
| Output / side effects | 仅本地 ignored preflight artifacts；actual OCR=false、HTTP=false、DB=false；单页真实 OCR target 不存在 |

PowerShell 原始 sample/final 行如下；没有从注入值生成结果：

```json
{"pid":358552,"at":"2026-10-06T08:38:38.3466731Z","workingSetBytes":74854400}
{"pid":358552,"at":"2026-10-06T08:38:38.6283239Z","workingSetBytes":0}
{"pid":358552,"exitCode":null,"peakWorkingSetBytes":74854400,"waited":true,"samples":2,"at":"2026-10-06T08:38:38.6623237Z"}
```

wrapper 的失败行为是 fail-closed：既记录 overdue 停止，也不接受晚于 child close 的 sample 序列作为有效 monitor 证据。当前只有这一次真实 monitor 结果，不能将它归为可重试瞬时抖动。

## 后续 gate

Case 1 已失败，故 case 2 **不执行**。Case 2 marker 不存在。除 Root 对新范围作出明确裁定外，不重新执行 case 1、不改采样上限/阈值、不改 frozen wrapper、不启动 OCR。若后续决定修正 wrapper，需要新的代码 review、focused/native test 与更新的 frozen hash；旧 preflight 失败记录保留，不能由代码修复抹除。

真实单页入口有独立常量许可，当前仍为 `false`；没有 env/CLI override。其私有 `runSinglePage()` 在许可为 false 时立即抛出，正式入口不接受参数。要在将来 admission，必须有 Lead 对 exact tested code/profile 的独立 checkoff，并经过明确授权的 reviewed source change 开启专用常量；不能裸调用 exported `invokeTesseract()`、不能开启原五页 flag，也不能把 fake-child preflight 当成 OCR 许可。本次没有尝试任何 unlock。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：在固定 profile 下对真实 Windows PowerShell monitor 做一次自然关闭/cadence fake-child preflight；只有它全部通过才可继续 low-soft-line case。

**MODEL**：GPT-6 Luna / High。

**FILES_CHANGED**：新增本文与 ignored preflight artifacts；未改 frozen wrapper 或单页入口。依 Root 前一边界指示，仅修改 owned test 的 page-deadline fixture，以隔开 total/page budgets；该测试文件 SHA-256 为 `BCB22A2D9B64BCC80A62F168C451EE2E1FC7DA3BD54D1D4405DF3B94D7454180`。

**TESTS_RUN**：runner `node --check` 与 wrapper import 检查通过；改后的完整两文件 focused suite 41/41、exit 0，原始日志 `.data/fiscal-qa/offline-ocr-tests-20261006-page-deadline-fixture-01/`；formal case 1 native run exit 1。未重跑全项目 CI/build。

**RESULT**：CASE1 FAILED：真实监控 gap 281.6508 ms 超过 250 ms，随后 child 以资源监控 overdue 结束；关闭/wait 被观察到且无残留 PID，但最终 sample 发生在 child close 后，wrapper 按失败拒绝结果。CASE2 NOT STARTED。ACTUAL OCR NOT RUN。

**RISKS**：monitor sampling 在本机长于目标间隔；收尾 sample 与 child close 时间次序可能竞争并 fail-close。512 MiB 仍只是 sampled soft-stop，无硬 RSS/process-tree/NAS 隔离结论。真实 Tesseract 表现完全未知。

**BLOCKERS**：本轮 preflight gate 不通过，禁止自动进入 case 2 或 single-page OCR。wrapper/runtime 行为需 Root 审阅后另定；不得重试或放宽 250 ms 门槛。

**NEXT**：Root review 本原始失败证据；在新的明确范围和必要修复/验证之前，不执行下一项 native preflight 或 OCR。
