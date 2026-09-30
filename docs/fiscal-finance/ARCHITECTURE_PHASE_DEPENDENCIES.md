# S1：P3、正文能力与部署阶段依赖裁决

DATE=2026-09-30（Asia/Shanghai）
REVIEWER=gpt-6.1-sol
DECISION=APPROVED（仅本文件规定的阶段依赖与最小后续工作范围）
GATE_2=NOT_PASSED；本次不是正式 Gate 2 Review，不授权开启模型、来源、规模采集或部署。
REVIEW_HEAD=21cd590f9d5283b9a50d5827f8acc870564e8897；SOURCE_CONFIG_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79。

## 依据与裁决范围

依据仓库 [AGENTS.md](../../AGENTS.md)、[任务书](../../财政金融热点站完整开发与部署任务书.md)“二十九、本地 Phase 2：信源调试 / Gate 2”“三十三、本地 Phase 4：完整集成测试 / Gate 4”“四十二、当前优先级”、[PROJECT_PLAN.md](PROJECT_PLAN.md)、[ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) AD-009/010、[STATUS.md](STATUS.md)、[P3_GATE2_READINESS.md](P3_GATE2_READINESS.md)、[区域分页报告](P3_REGIONAL_PAGING_VALIDATION.md)、[OMO 跨日报告](P3_OMO_FRESHNESS_2026-09-30.md)，以及当前 collector、正文 helper、PDF 子进程和处理队列实现。

任务书要求逐源记录 HTTP、文章发现、标题、发布时间、URL、正文、重复及栏目噪声，并要求“核心官方源稳定以后才能打开模型调用”。计划补充要求记录分页、历史及跨周期结果。任务书没有把“实现通用自动分页”“实现 OCR”或“NAS 完成验收”列为 Gate 2 的通用前置条件。与此同时，AD-009 对重要正文完整性、失败样本保留及福建厦门核心 T1 身份的要求继续有效。本裁决只澄清阶段归属，不追认缺失验证，也不撤销已有安全与内容要求。

## 1. P3 先证明覆盖需求，不机械扩展分页或 OCR

**当前不批准新增自动分页或 OCR 实现，也不要求修改 apps/packages/schema。** 当前证据尚不能证明必须改造通用 collector 才能完成 P3，但同样不能证明首页采集已经足够。

`sources/web-list.ts#fetchListingText/fetchWebList` 每轮读取一个 `config.url`；`sources/collect.ts#collectSource` 对首次导入应用时间与数量上限，后续非 X 来源每轮至多 60 项。读取历史页的临时验证脚本没有改变这条采集路径，`fetch_runs.status=ok` 也只表示本轮流程成功，不证明全部详情正文或历史覆盖成功。

P3 下一步必须逐源核对实际配置首页容量、最旧候选日期、DOM 日期是否排序、正常新增速度与突发批量发布、轮询间隔、失败后的退避与最长可接受中断，以及候选过滤/首导入上限是否引入漏项。大多数核心源配置间隔为 120 分钟，两条监管局源为 360 分钟；不能把正常轮询间隔直接当成所有故障情况下的最大采集间隔。应利用保存快照与后续有界新快照，说明文章在首页停留多久、更新期间是否曾在两次成功检查之间完全滑出首页。

历史分页是必须核查的来源质量项目；Gate 2 不要求遍历声明的全部 20/10/34 页，也不要求把所有历史档案接入持续采集。明确区分持续新增覆盖、受控首导入与历史补录。若首页不足以覆盖实际新增或要求的首导入范围，或者已观测到滑窗漏项，再提交有证据的最小分页 S1：明确页数/请求/时间上限、URL 安全范围、跨页去重与故障游标语义。不得用猜测 URL、无限翻页或隐式补录代替。

扫描 PDF 的可靠正文确需另一获取路线，但两份失败诊断并不授权直接建设通用 OCR。先明确重要业务材料缺哪些页、表格、字段，核查是否有同一官方完整文字版本或受控人工文本获取办法，并保留扫描负例与原文关联。若该核心来源的必要内容持续只能通过 OCR 获得，另立必要架构审查和实施阶段；不得以“不做 OCR”把关键正文缺口写成来源验收通过。

## 2. PDF Linux 与 NAS 的阶段归属

| 事项 | 所属阶段/最晚退出点 | 当前要求 |
|---|---|---|
| 本地 pilot 将使用的官方 HTML/PDF 正文完整性 | P3/Gate 2；实际送入模型前再次核实 | 在实际本地运行环境核对全页、业务表格、数字、单位、标题与日期；失败材料保留缺口，不能以 intro、页尾或文件题名替代 |
| 已实现 PDF 依赖的 Windows/Linux 兼容要求 | AD-009 已提出；真实 PDF 的 Linux 集成验证应在 P7/Gate 4 前补齐；若更早使用 Linux，则在该使用前完成 | Windows 单篇成功和 Ubuntu 通用 CI 不等于 Linux 真实 PDF 成功；仍是开放验证项，不追认历史实现前要求已满足 |
| NAS 容器硬 RSS、运行隔离、并发、清理与故障恢复 | P8 Staging 建立隔离与限额；P9 启用相应路径前验证，Gate 5 前完成运行验收 | 按任务书在 Gate 4 后进入 NAS；部署基础隔离先验证，之后才逐步启用采集/模型；不得将 P8/P9 整体倒置为 P3 前置，也不得部署未验收 PDF 路径 |

`content/pdf-text.ts` 已串行执行独立子进程，每次 6 MiB 输入、40 页、120,000 字符、10 秒 deadline、1 MiB 子进程输出上限；子进程有 `--max-old-space-size=192`。`bounded-process.ts` 在 deadline/输出超限时实际 kill 并等待 close。这些是现有有界解析措施，**V8 heap 上限不等于 OS 硬 RSS，上述子进程也不等于容器或 OS 安全沙箱**。本次不声称实现了网络/文件系统硬隔离。PDF worker 接收 bytes，禁用自动 fetch/stream、系统字体与 eval；官方 PDF 网络获取另由 `pdf-body.ts` 的 guardedFetch、HTTPS origin/path allowlist、无重定向、MIME/魔数与字节上限控制。

厦门第十六期 PDF 的 `pdf_page_no_text` 只能说明遇到至少一页无可用文字，不能由失败返回推断总页数或全文件扫描；福建四页扫描件有既有逐页视觉证据。两者仍是关键正文缺口，与 NAS 阶段归属没有因果替代关系。将 Linux/NAS 从笼统“Gate 2 前置”改记为相应阶段待验，绝不能把这两条来源的正文状态同步改成通过。

## 3. unconfirmed/disabled 不是模型隔离

当前 `MODEL_CALLS_ENABLED=false` 且没有启动 worker，维持现阶段安全。本裁决不要求当前修改通用处理管线；AIHOT 通用流程原本允许对正文未确认的摘要材料分析，财政金融附件完整性要求应在受控 pilot 输入边界落实，不能为一项来源格式问题全局禁止摘要/RSS 行业抽象。

必须直面实际代码行为：

- `jobs/content.ts#route` 只在 `body_status=pending` 且需要正文时走 extraction；`unconfirmed` 会走 analyze。
- `registerExtractionJobs` 在提取返回 `unconfirmed` 后仍显式排队 analyze；异常重试耗尽后亦如此。
- `editorial/analyze.ts#waitsForPage` 只等待 pending；`processArticle` 没有 source.enabled 的阻断条件。source disabled 主要阻止常规采集，不能阻止已经存在的处理 job。
- `extractArticleBody` 会跳过已为 `ok` 的文章。因此已发现的厦门页尾假阳性不能靠继续调用该函数自动纠正，也不能仅凭 DB 标志入选 pilot。

**P4 的最小安全策略（仅待 Gate 2 正式通过后实施）：** 建立全新独立 pilot 库；只导入经原文复核完整的明确 article ID/revision/content hash，并记录正文来源、字段核对和人工验收结果。运行前检查库内全部文章、jobs、模型预算与回执，采用固定样本逐条处理入口，不启动泛 worker、sweeper 或批量重排队去消费既有 P3 库。P3 原库保留失败记录与未消费 jobs，模型开关继续 false。未确认 PDF/RAR、partial HTML 和已知 `ok` 假阳性均不送模型、不发布，不修改其状态来伪造完整。

这只是 pilot 数据隔离，不是把问题源从核心验收中排除。福建厦门核心 T1 身份和重要格式负例继续保留；源级覆盖缺口必须在正式 Gate 2 材料中逐项裁定。若后续需求改为同库泛 worker 或自动处理混合正文来源，必须先证明运行入口能执行来源/文章限制；现有 disabled/unconfirmed 无此保证，届时另做最小管线 S1 和行为测试。

## 4. Gate 2 的证据边界与最小下一步

目前 Gate 2 明显未就绪。12 源全部 disabled；原三源 30 篇 29 ok/1 unconfirmed，以及其余固定 URL 两轮样本，不能合成“12 源稳定”。OMO 9/29→9/30 观察到新第192号进入、旧第172号退出，单篇双轮和 135 字完整短正文有证据；只有一次跨日变化。区域两源各首页/一页历史及一篇历史详情可解析，但不代表全35局、全历史或自动分页。原始 OMO summary 中 `ledgers.analyses=1` 实际是 analyze job 数，报告已解释独立 SQL 的 analyses 表为 0；不能复用该误名字段当模型结果。

正式 Gate 2 材料至少应做到：

1. 保留12源总矩阵和首批约10—12核心源任务范围，逐项写出已证事实、重要格式负例、未确认原因与覆盖缺口。不能只挑成功的 HTML 源或普通领证通知，隐藏福建/厦门业务材料后声称整体通过。任何分阶段核心范围建议须明确缺失领域与后续责任，在正式审查中另判；本文件不批准缩减范围。
2. 对拟验收核心源，用实际 source 配置做有界首页批次与第二轮判重，并抽核代表性重要内容及已知格式边界；明确原始 found、过滤后 accepted、入库 created/revised 与正文质量之间的区别。固定 URL allowlist 的两轮仅保留为样本级证据。
3. 对日期冲突给出来源字段语义、代码使用口径和 freshness 后果；不能静默选较新日期。对陈旧栏目调查官方更新节奏与新快照；最晚可见日期旧不等于 HTTP 故障，也不自动证明栏目能覆盖新业务发布。
4. 按第1节补齐首页窗口、历史相邻页/跨源重复与跨周期新增证据；保留中央选登的35局覆盖限制。观察时长应匹配来源发布节奏，任务书没有规定统一“几轮/几天”数值，本次不虚构该门槛。
5. 对厦门假阳性、福建扫描 PDF、金融司 RAR 等重要材料落实可核查处置和待验边界。fail-closed 与 pilot 隔离是必要安全措施，不能单独证明该核心源的重要内容完整或稳定。正文依赖无法可靠解决且暂无完整替代路线时，相应核心来源验收仍受阻。
6. 证据齐备后再申请正式 Gate 2 Review。审查者应能查到原始快照/hash、配置/代码 SHA、实际运行方式、数据库与队列状态、失败样本及安全开关。正式通过前不启用真实模型，不扩大采集。

最小本轮收尾是由 readiness 文件负责人把本裁决链接入状态和交接，区分“来源正文/覆盖阻塞”“Linux待验”“P8/P9资源待验”，保持真实失败事实；下一批由 Luna 实施上述有界来源验证与 pilot 方案文档。只有新证据证明通用能力确实缺失，才再次申请最小实现范围，不重做已有 parser/PDF helper。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：一次 S1 跨模块阶段依赖与后续 pilot 隔离裁决；不进行正式 Gate 2 通过审查。

**MODEL**：gpt-6.1-sol；本次未调用仓库运行时模型服务。

**FILES_CHANGED**：仅新增本文。未改其他 Agent 文档、代码、schema、source 配置、数据库、队列或模型/采集开关。

**TESTS_RUN**：只读审查任务书、计划、既有裁决/报告、collector/正文/PDF/队列真实代码；核对当前 Git HEAD，阅读 ignored 区域机器记录与 OMO collector summary、独立 SQL 审计脚本。未重取官网、启动服务、连接验证库、重跑 collector 或测试套件；正文/SQL结果引用对应执行报告，不声称本次重新执行。

**RESULT**：S1 APPROVED（scope only）：保持 P3 有界质量核验；当前无需自动分页/OCR或通用管线改造；明确 Linux/NAS 对应阶段与 P4 的独立固定样本隔离。Gate 2 仍 NOT_PASSED。

**RISKS**：只有单页/单篇与一次跨日证据；重要附件不完整和日期冲突未解决；当前管线能分析 unconfirmed，disabled 不隔离既有 jobs；V8 heap 不等于硬RSS；Ubuntu通用CI未解析真实官方PDF。历史AD-009实现前Linux兼容要求的证据缺口继续开放，不因本裁决追认。

**BLOCKERS**：无本次文档裁决阻塞；Gate 2 的来源级覆盖、正文完整性、日期/freshness和跨周期证据仍有实质缺口。

**NEXT**：Lead/readiness负责人同步阶段依赖表述与交接；Luna补齐最小来源证据、保留失败样本并形成P4固定样本隔离方案；条件齐备后安排正式Gate2 Review，按需另审必要分页/OCR/管线变更。
