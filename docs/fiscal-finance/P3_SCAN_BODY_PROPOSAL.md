# 扫描型官方 PDF 正文路线提案（P3）

DATE=2026-09-30（Asia/Shanghai）
STATUS=LOCAL_FIXED_SAMPLE_POC_APPROVED；仅批准一次固定 5 页本地实验；尚未运行 OCR，未批准业务接入、Gate 2 或 P4。
SCOPE=依据福建 4 页国库现金管理公告与厦门 1 页专项债招标结果公告的已接受人工证据，评估自动获取业务正文的必要性及最小实现边界。

## 建议裁定

两份附件的人工图像转录都已由第二位 reviewer 逐页/逐字段核对，Lead 接受为 `P3 manual_sample_evidence=ACCEPTED`。这证明人能从指定图像中读取所列字段，不证明采集器、PDF parser 或 OCR 能自动得到完整正文。福建 PDF 的机器文本层逐页为空，状态仍为 `unconfirmed`；厦门既有严格解析仍是 `pdf_page_no_text`，详情 HTML 的约 205 字 Readability 结果是已知假阳性。不得把人工验收回写成数据库 `body_status=ok`。

扫描正文有实际业务价值：福建公告包含 23 家机构的中标额度、利率和预计利息，以及 100 亿元规模和起止日期；厦门公告包含债券编码、计划/实际发行额、期限、利率和付息日。Lead 已明确产品需要核心财政业务公告持续自动获取，因此机器正文路线确有 S1 价值，长期逐次人工转录不能满足目标。与此同时，这不把泛 OCR 变成 Gate 2 的通用硬前置：Gate 2 仍审 12 源整体覆盖、正文负例与稳定性；这两类扫描件只有在被纳入自动处理范围前才需要机器正文验收。P3 当前仍可将两份附件如实列为人工核验/机器未确认。

官方可读替代调查没有找到可确认的同公告 HTML 或可读附件：福建现/旧站同题入口均指向 PDF；若干新站 PDF 直链超时，不能据此推定有或没有等价机器版本；厦门财政局详情 HTML 只有简介及该 PDF；搜索到的深交所上市通知不是同一招标结果。详细入口与有限请求记录见 [核心正文缺口处置](P3_CORE_BODY_RESOLUTION.md)。后续只有在官方可读替代被实际访问并核对标题、日期、期次及业务字段后，才可选它作为机器正文源。

## 人工受控输入与 OCR 的边界

人工受控输入适用于少量、明确指定的 P3 样本：保留官方 URL、原 PDF 与逐页图像的 SHA-256、页码、转录版本、字段来源位置、未知项和独立复核记录；人工文本只标为 `manual_transcription` / P3 证据，不伪装成 parser 输出，不静默写入正式 article body、分析队列或 publication。若 Gate 2 后 Lead 批准人工材料进入 pilot，必须复制到新的隔离 pilot 样本，并将 `article ID/revision/content hash` 与人工证据一同固定；不得启动可消费 P3 遗留任务的泛 worker。

OCR 适用于需要重复自动处理的附件。OCR 输出是机器候选，应逐页保留页号、原图引用及引擎/版本；关键金额、单位、百分比、日期、编号和表格合计需要完整性校验及人工抽核。低置信、缺页、列错位、预算耗尽或解析超时均保持 `unconfirmed`，不得回退到详情简介/Readability 摘要冒充完整正文，也不得送模型或发布。OCR 不替代来源核验或人工对照，不能因为结果“可读”就自动标成可信。

## 最小可维护路线（供限定 S1 与 PoC 审查）

1. 保留现有正文流程：严格 PDF 文本提取优先；仅遇到受允许域名/路径下的 PDF 且结果为 `pdf_page_no_text` 时，才由单源显式 opt-in 决定是否调用 OCR。当前 helper 已将 HTTPS origin/path allowlist、零重定向、MIME/魔数、6 MiB 下载上限、40 页/120,000 字、10 秒解析 deadline 和 1 MiB worker 输出限制放在现有路径；这些是应沿用的边界。
2. 本轮限定 PoC 建议用本机 Tesseract，不调用付费云 API、不下载或运行 NAS 部署。本机检查发现 Tesseract `5.5.0.20241111` 在 PATH，但仅装有 `eng`、`osd`，没有中文简体 `chi_sim` 数据；因此当前不能直接完成中文 OCR PoC。官方 Tesseract 文档说明需另装语言训练数据，`chi_sim.traineddata` 对应简体中文，并说明 Windows/Linux 等安装方式（[安装文档](https://tesseract-ocr.github.io/tessdoc/Installation.html)，[官方语言数据表](https://tesseract-ocr.github.io/tessdoc/Data-Files.html)）。若限定 S1 批准，应从官方数据仓库/官方包取得固定版本 `chi_sim` 文件，记录来源、版本、SHA-256 后仅在本机 `.data`/忽略目录使用；不要把大型模型二进制加入 Git，也不要在运行时自动下载。离线 PoC 到此只增加一次明确的本机模型文件获取，不引入 npm 依赖或线上服务。
3. 若 PoC 证明路线有效并另获实现审查，再在 `packages/backend` 的正文 helper 后端接入单一可替换适配器，接收已经下载的受限 PDF 页图；不让前端直接调用 OCR，不引入通用网页 OCR API。限制最大页数、单页像素、总字节、墙钟时间和并发；仅允许明确配置的源/附件类型，默认关闭。测试用 fake adapter，不访问外网。未来如改用外部付费服务，必须走现有 receipts 与预算熔断并单独授权；当前提案默认不付费调用。
4. 正文输出逐页带页码和“官方 PDF 原文”链接，保存 OCR 引擎/版本、语言模型 hash 及原附件 hash 的可追溯元数据。正文不得把表格重新拼成未经验证的事实；在跨页/列结构未通过代表样本核验前，保留页面级文本与布局。OCR 的缺页、空页、损坏页、金额/日期校验失败或置信度不足，一律返回明确 `unconfirmed` 原因，不能部分内容 `ok`。
5. 用这两个固定样本做离线 PoC：输入 PDF 与页图 hash 固定；核对福建全部 4 页、23 行字段和两项合计，厦门 1 页的全部业务字段；保留字符/表格对照、失败模式、时延/峰值内存。当前是本机 Tesseract，不产生 API 费用；不推算未来成本。只有样本可重复且完整性策略过审后，才增加更多扫描负例；两条样本本身不能证明泛化准确率。

## 是否需要改 apps、packages 或迁移

- **`apps/`：目前不需要。** 采集与正文处理由后台 job 执行，读者页面不触发模型/OCR；无需新增前端入口。若未来要审阅人工/OCR证据，应另行评估后台只读审阅 UI，本提案不包含。
- **`packages/backend`：离线 PoC 不需要。** PoC 可用一次性本机命令验证固定 PDF 和输出；后续要让正文 job 自动调用 OCR，才需在这里接入受限子进程/适配器，复用现有 fail-closed 模式及受限 PDF 下载。首选 Tesseract CLI，不增加 npm 包；目标运行环境需显式安装固定版本的 Tesseract 与 `chi_sim.traineddata`，但当前不批准 NAS 安装或打包。
- **数据库迁移：此 PoC 不需要。** 对人工样本保持 ignored 文件与报告，不写业务表。自动 OCR 若仅作为待复核候选，并在既有 body 结果写入前执行，不增加持久状态即可验证；若产品要求留存每页 OCR 置信度、人工纠错版本、审批人和长期审计，则必须先提出兼容 schema S1，不能把这些信息塞进现有 `body_text` 或未经裁定的 metadata。

## 阶段与放行边界

本提案不改变 Gate 2 的通用条件，也不把 OCR 实现列为所有官方来源的通过前提。Gate 2 仍须按 12 个来源矩阵审核覆盖、正文负例和稳定性；若厦门债/福建现金管理被认定为必须自动处理的核心内容，则这两类源的机器正文完整性在进入相应自动处理范围前继续阻塞，直到可靠可读替代或经过审核的 OCR 路径通过。若选择暂不自动处理，只可在阶段结论中明确保留这些业务 PDF 为机器未确认/人工样本，不能据此宣称其正文质量通过。

真实 PDF Linux 集成仍按既有 S1 最迟 P7/Gate 4 验证；NAS 硬 RSS、容器隔离及持续运行在 P8/P9/Gate 5 验证。若更早决定在 Linux/NAS运行 OCR，则必须提前验证所用实现的真实运行环境与资源限制。当前 12 个来源继续 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`，`MODEL_CALLS_ENABLED=false`；本提案没有启动模型、OCR、worker 或 publication。

## 引用与证据

- [P3 核心正文缺口处置核验](P3_CORE_BODY_RESOLUTION.md)：替代路线调查、旧 parser/Readability 失败、PDF 请求边界与字段转录。
- [福建逐页转录独立复核](P3_FUJIAN_TRANSCRIPTION_REVIEW.md)：4 页、23 行逐格一致、合计算术核验；PDF 文本层每页为空。
- [厦门逐字段人工复核](P3_XIAMEN_MANUAL_REVIEW.md)：1 页、债券字段一致；严格 parser 旧结果仍为 `pdf_page_no_text`。
- [阶段依赖裁决](ARCHITECTURE_PHASE_DEPENDENCIES.md)：当前不授权通用 OCR；OCR 如确需实现应另行审查。
- 当前实现证据：`packages/backend/src/content/pdf-text.ts`、`pdf-text-worker.ts`、`pdf-body.ts` 和 `bounded-process.ts`。parser 接受离线 bytes，不自行解析 URL；当前不含 OCR fallback。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：依据两份人工双核验 PDF 样本，评估扫描正文机器路线必要性及最小范围。

**MODEL**：Luna High；未调用仓库运行时模型或 OCR。

**FILES_CHANGED**：仅新增本文；未改业务代码、schema、来源配置、数据库、文章正文状态或其他文档。

**TESTS_RUN**：只读检查现有 PDF helper、S1、正文缺口报告和两份人工复核。loopback 预览检查/恢复记录见阶段交接；本提案没有调用 OCR。

**RESULT**：人工核验能支撑两条有限 P3 样本事实，不能支撑自动正文成功。产品要求持续自动获取核心财政公告，扫描机器路线有 S1 价值；但不构成 Gate 2 的通用 OCR 前置。当前本机有 Tesseract 5.5.0、没有 `chi_sim`，离线 PoC 前需取得并固定中文训练数据。

**RISKS**：两份样本不能证明 OCR 跨文档准确性；表格结构、金额及日期需独立校验。未知印章文字、二维码不应由 OCR 推测补齐。

**BLOCKERS**：无已验证的同公告官方可读替代；自动正文路线未接入业务系统。本提案本身不是 S1 批准。

**NEXT**：限定 S1 曾批准对固定五张现有 PNG 做一次本地 OCR 实验，含最多三次有界官方语言文件请求。结果见 [P3_SCAN_OCR_POC_RESULT.md](P3_SCAN_OCR_POC_RESULT.md)：commit 定位成功，训练文件响应流未在30秒内完成；依不重试边界停止，OCR与gold对照 `NOT_RUN`。若要继续请求语言数据需Lead另行裁定；资源monitor的fake-child/kill-wait路径也须独立验证后才考虑解除默认 `OCR_RUN_ENABLED=false`。不接业务管线、不调整 Gate 2、不启用来源。
