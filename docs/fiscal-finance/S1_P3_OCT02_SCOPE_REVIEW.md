# S1：10月2日 OCR 新准备批次与会计司正文配置范围

DATE=2026-10-02（Asia/Shanghai）
REVIEWER=gpt-6.1-sol
REVIEW_HEAD=a8d1dbed313ae68598085187e754829ac3d93464（实测 HEAD；同时只读参考本轮未提交文件）
OCR_PREPARE=APPROVED（scope only；执行前置条件见下文）
ACCOUNTING_TABLE_ONLY=CHANGES_REQUIRED
ACCOUNTING_ALTERNATIVE=APPROVED（限离线候选与最小行业配置验证；核销条件见下文）
GATE_2=NOT_PASSED；本次不是正式 Gate 2 Review。

## 裁定依据和边界

已读仓库 [AGENTS.md](../../AGENTS.md)、README、[PROJECT_PLAN.md](PROJECT_PLAN.md)、[STATUS.md](STATUS.md)、[原扫描 S1](S1_SCAN_OCR_POC_REVIEW.md)、[OCR 实验结果](P3_SCAN_OCR_POC_RESULT.md)、[10月2日来源检查点](P3_SOURCE_CHECKPOINT_2026-10-02.md)。只读检查真实 `ocr-scan-poc.ts`、配置 key 校验、`selected-body.ts`、`pdf-body.ts`、`extract.ts`、`web-list.ts`，并用现有纯 helper 对既存原始 HTML 做离线检查。未联网、未安装数据、未运行 OCR、未连接数据库、未修改任何业务实现或行业配置。

10月2日检查点的 7 个 backend Undici dispatch 与每请求 create/sendHeaders/headers 事件可作为该批有限请求证据。它不追认9月30日两批 unknown 的历史 HTTP 预算，也不证明完整来源覆盖、正文可靠性、跨周期稳定性或 Gate 2 通过。来源、全文、采集、模型、Jina、IndexNow、Feishu 与私网开关保持当前关闭状态；评分门槛不动。

## OCR：批准一个新的独立准备批次

前次 30 秒 Abort 留存为失败事实。允许新批次复用已经记录的不可变官方 commit `87416418657359cb625c412a48b6e1d6d41c29bd`，仅取得以下两个精确 URL，各最多一次实际 HTTP 请求：

1. `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/chi_sim.traineddata`
2. `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/LICENSE`

模型最多32 MiB，许可证最多1 MiB；每请求墙钟 deadline **120秒**，串行准备的总墙钟 deadline **240秒**。总 deadline 从新批次启动计时，第二请求使用剩余预算，不在计时结束后继续读取、保存或发请求。官方版本 API 请求数为0，redirect follow为0，自动/手动 retry为0，无替代仓库、镜像、其他语言或参数搜索。任一请求失败、重定向、越界或提前中断，停止该批，不以剩余请求额度尝试补救。两次是新批次上限，不累计冲淡前次失败。

使用新的专用 ignored 目录，例如 `.data/fiscal-qa/scan-ocr-poc-20261002/`。不删除、重置、覆盖旧 `.data/fiscal-qa/scan-ocr-poc/` 的失败 manifest、日志或 one-shot guard。新批次开始即留下尝试记录，重复调用在任何联网前拒绝；写文件使用独占创建，不能借路径参数写入其他目录。事前以本地假响应验证精确 URL 白名单、request admission、redirect拒绝、deadline、字节上限、EOF失败及重复尝试拒绝。

必须保存每请求 URL/固定 commit/开始结束时间/状态/实际收到字节/完整EOF结果与失败原因。HTTP200不代表完整文件：非空完整流结束、可用的长度一致性、完整模型与许可证 SHA-256、许可证原文和名称都满足后才写 runnable manifest。初次本地 hash 是内容固定身份，不称上游签名。run 前重新校验模型和许可证 bytes/hash，以及 manifest 中官方精确 URL、批准 commit 和 complete 状态；缺许可证或哈希不符必须拒绝。

原S1“脚本不进入Git”在本轮明确限定为一次性下载执行器、页面抓取执行器及实验数据/输出。允许现有 tracked `scripts/fiscal/ocr-scan-poc.ts` 与其离线测试继续作为固定样本开发工具，并做满足上述边界所需的最小修复；不将实验二进制、原图、模型、许可证副本、TSV、机器字段、manifest 或原始输出加入Git。此处是本次向后明确范围，不能写成旧S1当时已批准tracked脚本，也不授权通用OCR框架或业务入口。

## OCR：执行前置与工具问题

新数据准备可与本地 fake-child 检查分别推进；**取得文件不等于放行OCR**。进程负责人必须先在本机真实验证 normal exit、每页/总 timeout、文本+TSV+stderr超量、monitor启动失败/提前退出、软工作集超线，以及实际kill后等待child close、monitor退出且目标进程不再存活。日志记录峰值、采样时间与实际最大间隔，采样间隔上限250ms；不可靠、超标或无法证明可靠监控就fail closed，执行锁保持关闭。初始等待首样本和最后样本至退出期间的覆盖也需说明，不能只报告日志中相邻两样本的均值。采样线512MiB是软停止线，不是硬RSS；监控测试成功也不能消除此局限。

只读工具发现以下最小修复/验证要求，不能由本文件替代执行证据：

- 当前 `run()` 首先 `assertPreparedManifest(manifest)`，而校验函数在没有 `modelBytes` 时必抛，后续readFile不可达。应明确区分元数据验证与读取后内容验证，测试完整合法准备可以走到进程前置、缺失/变化的模型和许可证均拒绝。
- 现有prepare仍请求版本API、使用旧目录和30秒/3请求参数，直接重新调用不符合本裁定。必须独立批次、固定两个URL/2请求与120/240秒限制；旧失败不覆盖。
- 当前 `monitorMaxGapMs` 检查在进程退出后进行。仅把事后抛错写作“250ms实时可靠监控已通过”不成立；owner须以实际fake-child证据核销可靠性和fail-closed处置。
- 模型prepared与许可校验、总deadline、未完成响应流、文件输出上限及失败诊断均应有本地离线验证；当前CI全绿不能替代这些本机证据。

上述前置核销后，由Lead记录所用tested工具版本和完整数据身份，才允许原S1固定五张PNG的一次基线：页序、图像hash、引擎身份、`chi_sim`、OEM3/PSM6固定，串行每页一次共5次，无调参和失败自动重跑。每页30秒、实验总180秒、原S1所有输入/输出/目录上限与gold对照要求继续适用。原始candidate不能用gold补值；关键字段错误保留为失败。印章细字和二维码unknown。无正文helper/collector/worker/DB/publication接入，无body ok，无P4或Gate2放行。

## 会计司：table-only方案必须修改

`detail.bodySelector='.TRS_Editor:has(table)'` + `allowShortBody=true` 在两篇失败样本上能区分注销表与题名页，但它应用于整个source。现有schema只有一个bodySelector字符串和一个allowShortBody布尔值；没有按文章类型或长度分支的selector fallback。`fetchDetail()` 与 `extractFromUrl()` 一旦配置selector，失败均不降级到Readability或Jina。

既存 `.data/fiscal-central-audit/html/mof-accounting-detail.html` 为会计数智化征求意见函，`ArticleTitle`、`PubDate=2026-09-22 14:39:00` 有完整身份；原结果body为473字。该页没有table，且有两层嵌套`.TRS_Editor`。本次用真实helper复核，table-only命中0，返回`selector_not_unique`、body=null。直接改整个source会使新提取的该类正文退化为未确认；已经body ok的DB条目会被extract job跳过，不代表配置没有回归。故该原候选为 **CHANGES_REQUIRED**，不能只把两个既知失败页测试通过当作配置验收。

无需修改apps/packages，可先验证以下既有CSS union与顶层来源容器候选：

```json
"detail": {
  "bodySelector": ".my_doccontent > .TRS_Editor:has(table), .my_doccontent > .TRS_Editor:has(p + p)",
  "allowShortBody": true,
  "publishedAtUtcOffset": "+08:00"
}
```

本轮离线真实helper结果：

| 既存原始HTML | table-only | 上述替代候选 |
|---|---|---|
| 9/4注销名单（`detail-t20260904_3996714.htm.html`） | 唯一命中、180字 | 唯一命中、180字，5列的表头及完整业务行均保留 |
| 9/20年度信息题名+XLSX（`detail-t20260920_3997803.htm.html`） | 0命中、拒绝 | 0命中、拒绝；不能把24字题名当正文 |
| 9/22会计数智化征求意见函（`mof-accounting-detail.html`） | 0命中、拒绝 | 唯一命中、473字，既存bodyPreview全文保留 |

顶层直接子选择避免嵌套TRS重复；多段落分支保留已有无表正文。这是由三个真实类型支持的配置候选，**不证明所有会计司文章覆盖**。`allowShortBody` 对两个分支都生效，不表达“表格可短、正文必须200字”；多段落也不保证内容完整，装饰表格也不能凭身份一致成为业务正文。不能宣称新增了长度分支或附件校验能力。

批准独占industry配置和离线fixtures的最小验证范围；Lead在配置落地前必须核销以下证据：真实短表格完整行列保留；真实题名+XLSX仍拒绝；既存473字无表征求函不回归；重复顶层容器、空/导航容器、题名与中国日期不一致均拒绝。同一候选必须同时通过，不为每fixture换selector。若其他已有成功类型有原始快照，纳入同一离线核对；缺快照则明确覆盖局限。对短多段落、装饰/目录table等潜在假阳性保持显式局限；若实际来源负例出现而现有selector无法排除，配置停止落地，继续离线诊断，不借本S1修改通用helper或放宽身份规则。

本轮额外离线检查对替代selector的题名不符、日期不符和重复顶层容器分别返回`identity_mismatch`、`identity_mismatch`和`selector_not_unique`，均body=null。此证据只涵盖该本地构造负例。后续独占配置测试应将这些重要行为固化，并运行行业配置验证与typecheck；依仓库要求由Lead完成必要全套回归。不能联网临时扩展本审查预算；其他类型缺快照也不能被报告为通过。

XLSX-only公告继续unconfirmed；HTML表格仅表示该可见注销公告，不表示关联XLSX全名录已取得。既有simple selected-body只检测全页PDF链接，不拒绝全部XLSX/DOCX；optional PDF envelope则要求200字且会拒绝未分类附件，不是此180字表格的等价替代。不得为了表格成功把全部附件宣称已处理、改用附件envelope绕门槛、请求XLSX或改存量正文状态。本S1没有来源联网/collector/数据库预算。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：一次高价值S1，裁定独立固定commit两文件准备范围及会计司跨类型selector范围；不是正式Gate2。

**MODEL**：gpt-6.1-sol；不调用仓库运行时模型服务。

**FILES_CHANGED**：仅新增本文；本轮其他未提交文件为只读参考，未修改。无实现、网络、数据/来源/DB状态变更。

**TESTS_RUN**：只读规约/计划/报告/schema/helper/tool和实测HEAD/status；stdin Node离线调用真实selected-body，3种真实HTML分别检查table-only与替代CSS候选；3个本地身份/重复容器负例通过。未运行全套测试、下载、OCR、fake child或服务，不声称monitor实测通过。

**RESULT**：新准备APPROVED(scope only)：固定两URL各一次、API0、redirect0/no retry、120秒每请求/240秒总、32MiB/1MiB与独立ignored批次。原会计司table-only CHANGES_REQUIRED；替代selector最小离线与industry验证范围APPROVED，落地须按上述跨类型核销。Gate2 NOT_PASSED，OCR未放行。

**RISKS**：完整流/许可与本机monitor证据仍缺；采样是软线；allowShortBody全局作用且CSS形状不能证明正文完整；固定少量HTML及五图不是泛化或来源稳定证据。

**BLOCKERS**：OCR执行需合法完整两文件、固定输入与真实fake-child监控/kill-wait前置；配置执行需跨类型成功正文与负例核销。旧HTTP预算unknown、来源完整性和长期稳定性继续阻塞Gate2。

**NEXT**：Luna独占开发工具完成监控/终止和新准备本地验证，Lead核销后实施本次两文件准备；行业负责人完成同selector跨类型离线fixtures后再落industry最小配置。各自新增结果报告，保持旧失败和来源关闭；自动业务集成另提S1。
