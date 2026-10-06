# 单页离线 OCR 验证 S1 范围包 — 2026-10-06

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：盘点已保存的厦门扫描页 OCR 实验前置，并准备一个供 Sol 新 S1 审查的单页离线执行方案。

**MODEL**：GPT-6 Luna High；未调用仓库模型或外部服务。

**FILES_CHANGED**：仅新增本文。未修改 wrapper、配置、Git 忽略目录数据、数据库或共享状态。

**TESTS_RUN**：未运行测试、真实 OCR、来源请求、网络或数据库操作。只读核对本机 Tesseract/version/language listing、现存模型与许可证 manifest/哈希、固定 PNG 身份和 wrapper/test/report。复用既有 fake-child 验证记录，不重跑旧测试。

**RESULT**：模型、许可证、引擎和单页输入当前均在本机且身份匹配。已保存的 `chi_sim.traineddata` 可由 Tesseract 5.5.0 在显式 tessdata 目录下识别。现有 wrapper 有时间/输出限制、单 PID 监控和 kill/wait 代码；它只在 fake child 上获得过有限监控证据。生产 `run` 锁仍为 false，CLI 仍固定五页。本范围包建议的下一项仅为厦门已保存 PNG 单页候选实验，并要求 Sol S1 先审查监控前置和明确单页入口；本报告不授权执行。

**RISKS**：512 MiB 是采样软停止线，不能限制瞬时峰值；单 PID 终止不保证子进程树终止；fake child cadence/kill 结果不能证明实际 Tesseract 的资源或停止行为，也不证明 NAS/Linux 隔离。

**BLOCKERS**：需要 Sol 对真实负载采样/kill-wait 前置和单页受控入口作新的架构范围裁定。Tesseract 实际 OCR 输出、峰值工作集、负载下 monitor cadence 以及资源阈值行为均未知。

**NEXT**：交由 Lead 安排 Sol S1 Medium 只读审查；审查完成并取得单独执行核销前，保持 `OCR_RUN_ENABLED=false`，不调用任何 OCR 子进程。

## 现有前置：本机已验证事实

以下核对为本轮本机只读事实。模型和许可证位于 Git 忽略目录 `.data/fiscal-qa/scan-ocr-poc-20261003/`，不应复制进 tracked 文件。

| 项目 | 本机证据 | 状态与边界 |
|---|---|---|
| Tesseract | `C:\Program Files\Tesseract-OCR\tesseract.exe`；`tesseract --version` 返回 `5.5.0.20241111`、Leptonica `1.85.0`；可执行文件 SHA-256 `CCD044D6CF16EAAAD151260E1FCC5E3E1504CD1B8644E940B4F7AE3E315DD0D3`。 | 本轮运行的是版本和 language-list 查询命令，没有输入图像或执行 OCR。 |
| Wrapper runtime | Node.js `v24.16.0`；monitor 命令为 `C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe`、Windows PowerShell `5.1.26100.9444`。Wrapper 当前 SHA-256 `0CA47A1FC9F594EECF2C1E7AA042188A352F81998F1CB22CC87113A6A0EAC874`。 | 仅记录本机工具身份。实际采样观察仅是报告中既有的 fake child 测试。 |
| 默认语言目录 | 默认 tessdata 仅列出 `eng`、`osd`。 | 不能依赖默认目录找到简体中文模型；调用必须显式固定 `--tessdata-dir`。 |
| 固定语言数据 | `.data/fiscal-qa/scan-ocr-poc-20261003/tessdata/chi_sim.traineddata`，2,469,156 bytes；SHA-256 `A5FCB6F0DB1E1D6D8522F39DB4E848F05984669172E584E8D76B6B3141E1F730`；Git blob SHA `388bac276d033d06e5ed5ba7a7ad14ae58f97dab`；固定上游 `tesseract-ocr/tessdata_fast` commit `87416418657359cb625c412a48b6e1d6d41c29bd`。 | 当前文件 SHA-256 与 `manifest.json` 一致。`tesseract --list-langs --tessdata-dir .data/fiscal-qa/scan-ocr-poc-20261003/tessdata` 只列出 `chi_sim`，证明本机二进制能从此目录发现文件；不证明真实 OCR 成功或语言质量。 |
| LICENSE | 同批 `.data/fiscal-qa/scan-ocr-poc-20261003/LICENSE`，11,358 bytes；Apache-2.0；SHA-256 `CFC7749B96F63BD31C3C42B5C471BF756814053E847C10F3EB003417BC523D30`；Git blob SHA `d645695673349e3947e8e5ae42332d0ac3164cd7`。 | 当前文件 hash 与 complete manifest 一致；license 核验不构成 OCR 执行授权。 |
| Manifest | `.data/fiscal-qa/scan-ocr-poc-20261003/manifest.json` 为 `status=complete`、`trainedDataComplete=true`、`runnable=true`，固定上述 commit、模型/license blob 身份、size、SHA-256 与三条历史准备请求记录。 | `runnable=true` 只描述已准备的数据 manifest。它不表示当前 CLI run 开关已开启；源码仍 `OCR_RUN_ENABLED=false`。 |
| 单页 PNG | `.data/fiscal-qa/xiamen-debt-round16-page.png`，1 页，1323×1871 = 2,475,333 pixels，602,201 bytes；SHA-256 `B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D`。 | 本机 hash/PNG IHDR dimensions 与既有单页人工复核报告匹配；低于既有单页上限 20 MiB、25 MP。没有重新下载 PDF 或重渲染。 |

相关证据：[10/3 API prepare 报告](P3_OCR_API_PREPARE_2026-10-03.md)、[10/2 process verification](P3_OCR_PROCESS_VERIFICATION_2026-10-02.md)、[OCR transfer proposal](P3_OCR_TRANSFER_PROPOSAL_2026-10-03.md)、[首次 PoC 结果](P3_SCAN_OCR_POC_RESULT.md)、[10/3 Sol S1 执行裁定](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md)。10/3 裁定明确 `OCR_EXECUTION=CHANGES_REQUIRED`，要求保持执行锁关闭；本 packet 不覆盖该裁定。

## Wrapper 与资源边界：代码能力和实际证据分开

现有实现是 [scripts/fiscal/ocr-scan-poc.ts](../../scripts/fiscal/ocr-scan-poc.ts)，本机文件 SHA-256 `0CA47A1FC9F594EECF2C1E7AA042188A352F81998F1CB22CC87113A6A0EAC874`。现有导出的 `invokeTesseract()` 可复用既有 child、monitor、stdout/file output 检查。它的默认参数固定 `-l chi_sim --oem 3 --psm 6 --tessdata-dir <dir> txt tsv`，传入受限环境，`OMP_THREAD_LIMIT=1`。Tesseract 的版本和可执行 hash也会由全量 `run()` 记录。

当前 CLI 的 `run()` 仍固定预检福建 4 页和厦门 1 页后逐张执行，并在入口检查 `OCR_RUN_ENABLED`；该 flag 仍 false。它没有经过独立审查的一页 CLI mode。不得通过直接导入/调用 `invokeTesseract()` 绕开 `run()` 的闭锁。单页实验若获准，S1 应明确一个仅接受固定 `xiamen-1` 输入/输出目录的受控入口如何复用既有 helper；不因此改现有五页范围、开放泛化参数或重写 process wrapper。

| 边界 | 当前代码设定 | 实际验证证据 | 未知/限制 |
|---|---|---|---|
| Monitor 启动 | Windows PowerShell monitor 先启动；须在最多 5 秒内发 `READY`，之后才 spawn Tesseract。无 `READY` 则取消 monitor 并 fail closed。 | 既有 fake-child tests 覆盖启动失败时不启动 child。 | 没有 Tesseract 负载下的启动实测。 |
| 采样与 cadence | PowerShell 对捕获的精确 child PID 读取 `WorkingSet64`；配置采样 `Start-Sleep -Milliseconds 20`。Parent 若首样本缺失/样本旧于 250 ms 会终止 child；计算并核对首样本、最大间隔和结束前 gap。 | 真实本机 PowerShell monitor 对 fake child 的一次记录：首样本 72 ms，最大 sample/edge gap 162 ms，最后样本 162 ms；低于 250 ms 要求。 | 这是 fake workload 的单次观察，不是 Tesseract；真实 workload cadence、调度抖动与峰值漏采未知。 |
| 超时 | 代码 `pageMs=30,000`、总 run `180,000`；watchdog 至少每 100 ms 检查实际墙钟限制。Monitor startup 时间计入剩余预算。 | fake-child tests 验证 page/total deadline 会终止 child，并等待 close。 | 没有 OCR 的真实超时或高负载实测。 |
| Kill 与 wait | Parent 用 `child.kill()`；monitor 超工作集软线时通过 `Process.Kill()` 后 `WaitForExit()`。Parent 同时等待 child close 和 monitor close，记录 PID/退出/等待结果。 | fake-child 对 timeout、软线触发与自然关闭路径有 kill/wait 测试。 | 控制目标是一个 PID；`processTreeKill=false`，不证明子进程树终止。假 child 测试没有证明 Tesseract 正在使用的全部资源都会及时下降。 |
| 内存 | `workingSetSoftBytes=512 MiB`。监控每次采样时记 `WorkingSet64`，超过即发停止并等待。 | 仅 soft-line 注入 fixture 以 `threshold=0` 构造超限，验证停止/wait 记录。 | 没有实际峰值数据；采样之间可能越线，512 MiB 是软停止线，不是硬 RSS cap、Windows Job Object 限制或 NAS 隔离。 |
| 输出 | 单页 `.txt + .tsv + stderr` 合计最多 1 MiB；整体 OCR output 5 MiB，文本最多 120,000 chars，ignored 目录输出封顶 10 MiB；watchdog 每 100 ms 查文件与 stderr。 | fake-child fixtures 覆盖 stderr 和 txt/tsv 文件超限时终止及 close 后复核。 | 没有真实版面输出量数据；一页方案仍按原单页和目录边界，不提高上限。 |

测试 suite 名为 `tests/fiscal-ocr-scan-poc.test.ts`。报告记录其 Windows monitor + fake-child 测试通过，包括 20 ms 设定的实际一次 cadence、超时 kill/wait、输出超限、monitor failure/no samples 与 threshold 注入。**这些是 wrapper 控制流/假负载证据，不是 Tesseract OCR 或资源隔离验收。**

## 提交 Sol 审查的最小单页提案

以下是待评审的实验包，不是执行授权：

| 范围项 | 提议值 |
|---|---|
| 输入 | 只用 `.data/fiscal-qa/xiamen-debt-round16-page.png`；运行前校验 602,201 bytes、1323×1871、SHA-256 `B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D`，不再下载/渲染 PDF，不加入福建页。 |
| 引擎/语言 | 本机固定 `C:\Program Files\Tesseract-OCR\tesseract.exe`，5.5.0.20241111 与 SHA-256 上述值；`-l chi_sim --oem 3 --psm 6 --tessdata-dir .data/fiscal-qa/scan-ocr-poc-20261003/tessdata`；`OMP_THREAD_LIMIT=1`。模型 commit/blob/hash 与 Apache-2.0 license hash 必须从现有 complete manifest 与当前 bytes 再核对。 |
| 输出 | 新目录 `.data/fiscal-qa/offline-ocr-xiamen-20261006/`，全目录 ignored；只写本次输入 manifest、单页原文 TXT、TSV、stderr、monitor JSONL、候选字段和边界日志。每页输出≤1 MiB，目录新增输出≤10 MiB。现存 prepared model/License 不复制进新目录。失败保留失败记录，不自动重跑。 |
| 时间 | 复用每页≤30秒、run 总≤180秒的现有上限；monitor startup≤5秒且计入预算；deadline 触发须真实 terminate 并观察 child close 和 monitor close/wait。 |
| 监控/内存 | 20 ms 采样配置，first sample/latest-age/观测 gap 按既有 250 ms fail-close 条件；记录真实 Tesseract PID、每次 sample、peak observed WorkingSet、kill reason、child close、monitor close/wait、墙钟与监控错误。512 MiB 超限策略仍是 sampled soft-stop；不得声称硬内存上限。 |
| 字段核对 | 从已有人工作业固定的厦门人工记录核对全部 14 个字段；保存 raw TXT/TSV 和逐字段 candidate/missing/mismatch，不自动补值、不把人工 gold 写回 OCR 输出。seal fine print 与 QR 保持 unknown。 |
| 下游隔离 | 无 article/body helper/worker/DB/queue/analysis/selection/publication/Gold dataset 写路径。机器结果只是 `candidate-only`，不设置 `body_status=ok`、来源验收、Gold label 或 Gate 2 结论。 |

现有 `run()` 是五页专用入口，flag false；审查需要确认能否批准一个严格固定厦门单页的 entrypoint 复用 `invokeTesseract()`，以及执行前对 monitor 的哪些前置测试/观测已经足够。不要用直接函数调用绕过现有 run lock，也不要在本阶段修改 flag、运行命令或更改 wrapper。若 Sol 认为真实 monitor readiness 必须另以 fake/负载探针补证，先裁定该最小验证及其安全路径；注入式 RSS fixture 不能替代真实 Tesseract RSS 证据。要是缺少可审计的 kill/wait/cadence 方案，则明确保持 `BLOCKED_BEFORE_OCR`，不为“收集真实资源数据”自行先启动 OCR。

## 审查结论边界

- 现有模型/LICENSE 确认准备完整、Tesseract 可枚举 `chi_sim`、PNG hash 正确；这些仅建立输入/工具准备身份。
- 现有 test 通过只说明测试控制的 fake child 路径。尚无真实 Tesseract 的 OCR输出、墙钟、cadence、WorkingSet、超阈值停止、等待与候选字段准确性证据。
- 此处提案是一个厦门单 PNG 开发实验；范围须由新的 Sol S1 核准，并由 Lead 单独核销执行后才可运行。10/3 的 `OCR_EXECUTION=CHANGES_REQUIRED` 和锁定状态继续有效，除非后续明确更改裁定。
- 即便该单页实验成功，也只会形成固定样本候选结果；不解锁原五页 run、不解锁来源采集、模型分析、文章正文写入、Gold labeling、发布、Gate 2 或部署资源验收。
