# P3 固定扫描页 OCR PoC 执行结果（2026-09-30）

DATE=2026-09-30（Asia/Shanghai）
DECISION=BLOCKED_BEFORE_OCR
GATE_2=NOT_PASSED
CODE_TESTED_SHA=aaea0502e9fe8df7b858c64df61bb46e207b71de
CI_RUN=https://github.com/revercgy-hub/MYHOT/actions/runs/36676119420 (Check; success)
SCOPE=执行 [S1 固定样本裁定](S1_SCAN_OCR_POC_REVIEW.md) 批准的一次语言数据准备；未运行 OCR。

## 结果

这次 OCR PoC 在训练数据准备阶段阻塞，五张固定图片均未送入 Tesseract。一次性准备流程只发出两次官方请求：完整 commit 查询成功；固定 commit 的 `chi_sim.traineddata` 请求返回 HTTP 200，但响应流超过每请求 30 秒期限后被中止。因 S1 明确禁止重试，本次没有再次请求，也没有发送第三次许可证请求。没有完整模型或许可证，OCR 和逐字段 gold 比较均为 `NOT_RUN`。

记录的 commit 为 `87416418657359cb625c412a48b6e1d6d41c29bd`。实际调用、URL、时间、状态及失败详情保存在 ignored `.data/fiscal-qa/scan-ocr-poc/prepare-failure.json`；不完整状态在同目录 `manifest.json` 标为 `trainedDataComplete=false`、`runnable=false`、`OCRStarted=false`。第二次请求的旧记录没有保存流中已接收字节数；不能据此推断收到或保存了多少模型数据。目录中没有 `chi_sim.traineddata`、许可证、OCR TXT/TSV 或 `run.json`。`run` 命令当前也由 `OCR_RUN_ENABLED=false` 明确拒绝，避免把尚未验证的 Windows 资源监控路径当作可运行 PoC。

## 请求证据

| 次序 | 请求 | 结果 | 处置 |
|---:|---|---|---|
| 1 | GitHub 官方 `tesseract-ocr/tessdata_fast` commit API 定位 | HTTP 200；4,358 bytes；SHA-256 `8B63053AD3BDD7B131B45C8364D6C289ECE15972678DAB4392EE11C76DD42706`；得到上述完整 commit | 成功；无重定向 |
| 2 | `raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/chi_sim.traineddata` | HTTP 状态 200；读取响应流超过 30 秒后 `AbortError`；流字节数未被本轮旧 logger 保存 | 失败；未完整保存、不重试 |
| 3 | 同一固定 commit 的 `LICENSE` | 未发出 | 前置语言文件失败后停止 |

请求使用 `redirect=manual`、单次 `fetch`、每次 30 秒 deadline；未使用 `main/latest` 原始文件 URL、替代仓库或镜像。S1 的最多 3 次请求不是必须凑满；第二次失败后立即停止。

## 固定输入与识别核验状态

五张图像哈希与人工复核报告所固定的身份相同；边界预检记录如下。此次未运行 Tesseract，因此没有新增 OCR 页输出、时延、置信度或内存实测值。

| 页 | 固定图像 | 宽×高 / 像素 | 字节 | SHA-256 | OCR / gold 比较 |
|---:|---|---:|---:|---|---|
| 福建 1 | `fujian-1.png` | 827×1169 / 966,763 | 170,010 | `0D40BD4CCCBE928AC564185F089D177991C6DFD758CF732296E542872C7A016A` | NOT_RUN |
| 福建 2 | `fujian-2.png` | 827×1169 / 966,763 | 184,814 | `F577BAC70BAAF3E9BABB855FBBB6284DFBAA47B38A4F5A744F2C13D8A9CCE97E` | NOT_RUN |
| 福建 3 | `fujian-3.png` | 827×1169 / 966,763 | 87,350 | `06AD562A74E89003122DBB1197698420B93E8DF37AAB49493DB118D1DDD9253A` | NOT_RUN |
| 福建 4 | `fujian-4.png` | 827×1169 / 966,763 | 57,198 | `F8856773CC55744FF6246724CDC464C309F51EE45028254901320B98F89D00F8` | NOT_RUN |
| 厦门 1 | `xiamen-debt-round16-page.png` | 1323×1871 / 2,475,333 | 602,201 | `B4F300D8F3C768FD4B7F30411ACA9E2CAA9AEC2155532F7586AA13543816794D` | NOT_RUN |

输入身份和单页/总量尺寸上限满足批准边界。福建的机构、文号、标题、23 行机构/金额/利率/利息、合计、规模、期限及日期，厦门人工复核中的 14 个字段，本轮机器候选覆盖均为零；不能将既有人工作为 OCR 候选或机器命中。印章细字和二维码仍保持 `unknown`。

## 工具边界和验证

新增 [固定样本本地 CLI](../../scripts/fiscal/ocr-scan-poc.ts) 和 [离线测试](../../tests/fiscal-ocr-scan-poc.test.ts)。CLI 只含固定五页及固定 `chi_sim` 路径，不调用来源/DB/worker/model/publish；下载失败 manifest 会 fail closed。未来候选保留原始文本/TSV及固定表格框位置信息，不自动判定 gold 匹配或正文可信。由于本轮没有训练数据，且没有实际验证 Windows monitor 与 kill/wait，本代码默认 `OCR_RUN_ENABLED=false`；这是显式停止保护，不表示进程资源控制已经通过。

已运行的离线测试覆盖单元格精确比较（禁止全页数字碰撞）、TSV 坐标/置信度保留、邻格不能满足目标单元格，以及不完整/缺失/哈希变化的模型 manifest 必须拒绝。测试 4/4 通过。质量 reviewer 另行验证：`npm run typecheck` 通过；在新建 `_test` 数据库迁移 35 次后，`npm test` 165/165 通过；Web build 和 Web tests 通过（15/15）；preview smoke 30/30 通过。上述项目检查不表示 OCR 被运行。fake native child 的 timeout、超输出、监控退出、实际 kill+wait 尚未验证；本地 Tesseract `5.5.0.20241111` 和可执行文件 SHA-256 `CCD044D6CF16EAAAD151260E1FCC5E3E1504CD1B8644E940B4F7AE3E315DD0D3` 是此前只读环境检查记录，本轮没有启动 OCR 或宣称运行时/资源检查通过。512 MiB 设计值如未来解除执行锁，也只能作为 100ms 采样得到的软停止线，不能称为 RSS 硬限。

本次未修改 `apps/`、`packages/`、schema、数据库、来源配置或 Gate 2；来源仍依原配置管理。本报告不表示 OCR 成功、body `ok`、来源通过或 Gate 2 通过。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按一次性批准，为固定五张财政扫描页准备固定版本简体中文 Tesseract 数据并尝试本地离线 OCR PoC。

**MODEL**：Luna High；未调用仓库运行时模型服务。官方 OCR 语言数据只开始一次固定 commit 获取；Tesseract OCR 未运行。

**FILES_CHANGED**：新增本文、`scripts/fiscal/ocr-scan-poc.ts`、`tests/fiscal-ocr-scan-poc.test.ts`。忽略目录只保存 `prepare-failure.json` 和 `manifest.json`。无完整训练数据/许可或 OCR 输出；未修改业务集成。

**TESTS_RUN**：`node --test tests/fiscal-ocr-scan-poc.test.ts`：4/4 通过。实际 `prepare` 两请求；第二请求在 30 秒边界失败。重复 `prepare` 在联网前被 one-shot guard 拒绝；执行 `node scripts/fiscal/ocr-scan-poc.ts run` 验证默认拒绝。质量 reviewer 运行 `npm run typecheck` PASS；新鲜`fiscalhot_agent_verification2_test`数据库迁移35次后`npm test` 165/165 PASS；Web build PASS、Web tests 15/15 PASS、preview smoke 30/30 PASS；`git diff --check` exit 0。GitHub Check #36676119420 对代码 SHA `aaea0502e9fe8df7b858c64df61bb46e207b71de` 全绿，包括Ubuntu typecheck/build/webtests/smoke/backend tests及Docker构建/smoke。上述CI不获取训练数据，也不运行OCR或资源monitor。未运行OCR或gold比较。

**RESULT**：`BLOCKED_BEFORE_OCR`。已定位固定上游 commit，但语言文件未完整取得；无重试，无许可证请求，无 OCR。固定样本识别与字段 gold 比较 `NOT_RUN`。Gate 2 仍 `NOT_PASSED`。

**RISKS**：HTTP 200 不代表响应体完整；旧请求 logger 未保留中断前流字节数。没有模型 hash/许可证，不能证明训练文件完整或可分发。timeout、输出限额及 Windows monitor kill/wait 只做静态实现审查，尚无 fake child/真实进程证据；故 OCR 执行锁保持关闭。已有人工 gold 不能替代机器对照。

**BLOCKERS**：本次允许的一次性下载已失败，S1 无重试边界阻止再次请求；缺训练数据和许可证。OCR 执行监控路径尚未通过隔离 fake-process 验证。本文不请求/实施第三次请求或运行其他语言/模型替代。

**NEXT**：保持本轮停止。若之后继续，需由 Lead 先裁定新的有限语言数据准备授权，并独立完成 fake child 的 timeout、超输出、monitor 退出和 kill/wait 检查；在完整固定模型/许可证及该检查可审计前不得解除 `OCR_RUN_ENABLED=false`。扫描业务集成、来源启用、Gate 2/P4、模型及发布均未获本次 PoC 批准。
