# 厦门单页离线 OCR 入口实现与验证记录 — 2026-10-06

DATE=2026-10-06（Asia/Shanghai）  
MODEL=GPT-6 Luna / High  
SCOPE=仅实现与 fake-process contract tests；真实 OCR 和两项正式 native monitor preflight 未运行  
OCR_RUN_ENABLED=false；OFFLINE_XIAMEN_OCR_ENABLED=false  
TARGET_OUTPUT=.data/fiscal-qa/offline-ocr-xiamen-20261006（本轮确认不存在）

## 实现结果

按 [S1 单页 scope review](S1_OFFLINE_OCR_SINGLE_PAGE_SCOPE_REVIEW_2026-10-06.md) 实现固定厦门 PNG 的独立离线单页入口并加固其复用的 process wrapper。入口不接受 CLI 参数或生产 test hooks，固定输入、Tesseract/model/license 身份、一次性独占 attempt marker、监控日志位置和输出目录。marker 在任何 Tesseract 子进程（含 `--version`）之前创建；启动后即使失败也不允许同一目录自动重试。对路径做 workspace canonical realpath containment 和 reparse/junction 检查；输出目录必须是新建目录，并对最终目录所有文件做 cap 检查。

Wrapper 将 5 秒有限 cleanup 留在单一 180 秒总 deadline 内；child/monitor close/wait 均有界，无法确认收尾时记失败/状态未知，不产生成功结果。固定单页预算包含 30 秒 page deadline、TXT/TSV/stderr 合计 1 MiB、文本 120,000 字符、控制/monitor 日志 1 MiB、输出目录 10 MiB（保留 failure 诊断空间）、20 ms monitor 配置和 250 ms sample gap 判据。512 MiB 是 sampled soft-stop，不是 OS 硬 RSS 限制。

固定报告独立比较 OCR TSV 候选与人工 reference 的 14 个字段，保留原始值、页码及 match/mismatch/missing；不能从 reference 补 candidate。未可靠解析的拆分到期日保持 missing，并保留原始 cell 证据。结果只是本地 ignored QA candidate，不写文章正文状态、业务数据库、publication 或 Gold labels。

此次只改以下 4 个代码/测试文件；源文件 SHA-256 为：

| 文件 | SHA-256 |
|---|---|
| `scripts/fiscal/ocr-scan-poc.ts` | `F96FBCCE78403A79035BA9660D0B5DDD273C86F4D61CC092B1C653C129A250B3` |
| `scripts/fiscal/offline-xiamen-ocr.ts` | `42AF3AA90CFE40E13D5E645B9DB63B46AD32B74AB0C7E78F8AC903A198D0320A` |
| `tests/fiscal-ocr-scan-poc.test.ts` | `C65B49586C9912A01EBA170168C0777BB2FB5D19AF877D8A624FD6D2A17F6996` |
| `tests/offline-xiamen-ocr.test.ts` | `B0C28492F91E5F3FE9854AE7B36840E390DA2C7F40C6413DD3A7BAD9EBD64268` |

Read-only source-contract review by `oct06_c_source_admission` confirmed the four requested fixes are present: canonical ancestor/output containment; explicit failure on directory-cap audit errors, including killed paths; exclusive marker before any Tesseract process; and the 120,000-character post-read gate. Reviewer reported no remaining source-contract blocker and did not run tests, preflights, or OCR.

## 本轮验证

完整 focused 命令已通过，原始 stdout/stderr/exit 分别保存在 ignored 目录 `.data/fiscal-qa/offline-ocr-tests-20261006-final-02/`：

```text
node --test --test-concurrency=1 tests/fiscal-ocr-scan-poc.test.ts tests/offline-xiamen-ocr.test.ts
```

结果：exit 0，41 tests / 41 pass / 0 fail；日志 `stdout.log` 3,759 bytes，`stderr.log` 0 bytes，`exit-code.txt` 为 `0`。相邻检查 `npx tsc --noEmit -p tests` exit 0。该测试运行包含一个旧有的短时 Windows fake-child monitor test；它观察到 PID 347872、1 个 sample、first sample 74 ms、最大间隔 159 ms，并自然关闭/wait。它不是下面定义的两项正式 preflight，也不等于真实 OCR 资源测量。

当前日志目录被 Git ignore；本轮确认真实 OCR target directory 不存在。更早的历史记录需如实区分：此前一次 40-case focused run 曾为 38 pass / 2 fail、exit 1；修复后曾有 40/40 工具结果但没有保留本轮原始日志。最终证据以本文件所列 final-02 原始日志及 41/41 结果为准。

## 待 Root 明确核销的两项正式 native monitor preflight

以下仅是可审阅的执行计划，**本轮没有启动**。测试通过、S1 scope approval 和此计划都不构成运行授权。待 Root 在 QA heavy tasks 完成后分别明确核销；固定参数如下：

1. **自然关闭 / cadence probe，一次。** 使用真实 Windows PowerShell monitor 和一个固定本地 fake child；child 在单进程中持续 CPU 工作 10 秒后自然退出，可申请固定不超过 64 MiB 的测试 buffer。不得启动 Tesseract。配置 20 ms sampling、250 ms 最大 sample/gap 判据；单项墙钟最多 60 秒，probe page 不超过 30 秒，日志最多 1 MiB。独立 artifact 放入 Git-ignored `.data/fiscal-qa/offline-ocr-preflight-20261006/` 下单独子目录，绝不触碰 OCR target。记录 exe/runtime 与 monitor 身份、READY、精确 PID、每次 flushed/live sample、首样本/最大 gap/末样本至 close、observed peak、child close 与 monitor close/wait。
2. **native soft-line kill/wait probe，一次。** 仅在第一项成功并经 Root 单独核销后，使用同一真实 PowerShell monitor 和独立固定 fake child，以测试 seam 的 0-byte low soft line 触发本机原生 `Process.Kill()`/`WaitForExit()`。不得启动 Tesseract。保持 20 ms cadence 配置、250 ms gap 判据、单项最多 60 秒、日志最多 1 MiB；artifact 写进同一 ignored preflight 根目录的另一个独立子目录。必须保留 PID、触发原因、kill 请求、child close、monitor close/wait 和 cleanup elapsed 的分项记录。该低阈值只用于停止路径，不证明 512 MiB 行为。

各项只运行一次。第一项失败则停止，不执行第二项，更不执行 OCR；第二项失败也保持 OCR blocked，不自动重跑或修改 250 ms 条件。无论两项是否通过，它们只验证本机 fake process 的监控/收尾路径，不证明真实 Tesseract workload、硬 RSS 上限、进程树隔离、NAS/Linux 隔离或业务正文质量。Root 必须在 preflight 证据审查后另行明确核销唯一一次单页 OCR。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按已批准 S1 scope 实现厦门固定单页 offline OCR 入口及局部 process-wrapper 守卫；真实 OCR 和正式 native preflight 不在本轮执行。

**MODEL**：GPT-6 Luna / High。

**FILES_CHANGED**：上述 4 个 owned source/test 文件；新增本文。未改 shared docs、五页 run flag、backend/apps/industry/schema/provider/dependencies。忽略目录仅用于保存 focused test 原始日志。

**TESTS_RUN**：完整两文件 focused suite 41/41、exit 0；`npx tsc --noEmit -p tests` exit 0。正式 10 秒 CPU probe、native 0 soft-line kill/wait probe、真实 OCR 均未运行。

**RESULT**：实现冻结并通过 focused verification；只读合同复核无遗留 blocker。两个默认许可仍关闭，真实 OCR target 仍不存在。测试证明的是 fake-fixture contracts。

**RISKS**：512 MiB 仍是 sampled soft-stop，不是硬内存保证；单 PID 的证据不证明 process-tree/NAS 隔离。真实 OCR 的输出质量、耗时、RSS、cadence 和停止表现未知。正式 native preflight 仍待授权及实测。

**BLOCKERS**：须待 Root 在 QA 完成后逐项明确核销两项正式 preflight；任何单页 OCR 另需 Root 后续独立核销。A/QA 的审查不能替代这两项核销。

**NEXT**：QA 完成最终 fresh full/build 验证；Root 逐项核销后按以上固定计划各运行一次。第一项失败即停止后续步骤；任何时候均不因测试绿自动启动 OCR。
