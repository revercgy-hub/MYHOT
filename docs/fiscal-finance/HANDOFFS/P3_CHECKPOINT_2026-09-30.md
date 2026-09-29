# P3 阶段检查点（进行中，2026-09-30）

STATUS=IN_PROGRESS（P3 尚未完成；本文不是阶段完成交接）
STAGE=P3 本地抓取与正文验证
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=48122c8d7f1454be0bc19522a6041f6cc935a7c9（本检查点开始撰写时 HEAD；待提交文件不会包含在此 SHA 中）
STAGE_CODE_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79（来源配置代码；之后文档提交不改变该来源配置）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=检查点开始前 `git status --short` 为空。当前有其他 Agent 并行开发，后续状态需重新运行 `git status --short`，不要假设仍干净。

## 目标与已知退出条件

P3 要逐源验证真实抓取结果，包括标题、日期、详情页、URL、分页、导航过滤、历史项和重复项；在进入 Gate 2 审核前，必须把覆盖范围、正文质量及限制记入来源证据。现有 P3 多个旧来源的小样本记录不自动覆盖本轮新增监管局来源。Gate 2 尚未通过，不得开始大规模采集。

## 本轮新增监管局来源：截至已知的静态证据

配置变更依据 [SOURCE_MATRIX.md](../SOURCE_MATRIX.md) 和 [REGIONAL_SUPERVISION_SOURCES.md](../REGIONAL_SUPERVISION_SOURCES.md)。当前总计12个来源（原10个加2个）；全部 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。两条新增源均为 T1 `web_list`，配置频率每6小时。目录核对35个财政部监管局域名不等于35个动态栏目验证。

| 来源 ID | 当前已有证据 | 未完成/边界 |
|---|---|---|
| `mof-regional-supervision-dynamics` | 财政部“财政新闻”首页快照25项；parser 按“监管局”标题筛出7条唯一候选。另在隔离库固定广西国有金融资本产权登记 URL 两轮 collector：`found/created/revised` 为 `1/1/0`、`1/0/0`；详情 HTTP 200，标题与列表一致，列表日与详情 PubDate 同日。 | 详情 Readability 临时解析1,720字，但未调用正文入库流程；SQL 为 `body_status=pending`、`body_text` 长度0、revision 1，留1个未消费 `content.extract-body` job。中央来源为选登汇总，不代表35局全量；未请求20页历史，没有跨周期稳定性或重复率结论。 |
| `mof-xiamen-supervision-dynamics` | 厦门监管局工作动态首页快照解析10项。另在隔离库固定厦门财金协同普惠金融 URL 两轮 collector：`found/created/revised` 为 `1/1/0`、`1/0/0`；详情 HTTP 200，标题与列表一致，列表日与详情 PubDate 同日。 | 详情 Readability 临时解析1,935字，但未调用正文入库流程；SQL 为 `body_status=pending`、`body_text` 长度0、revision 1，留1个未消费 `content.extract-body` job。没有历史分页、更多文章正文、跨周期 freshness/重复率证据。 |
| 福建独立监管局源（未配置） | 财政部中央选登样本含一篇福建监管局稿件；35局目录列有福建官网。 | 本机对福建局栏目/详情的两次有界请求均返回 HTTP 502；没有原始列表快照，不能配置独立 selector 或声称栏目通过。 |
| 其余33个目录局 | 目录名称及域名可用于机构目录/中央 allowlist 核对。 | 没有逐局检查新闻栏目、抓取结构、详情正文或覆盖情况。 |

### 新增来源的有限 collector 验证

正式报告为 [P3_REGIONAL_COLLECTOR_VALIDATION.md](../P3_REGIONAL_COLLECTOR_VALIDATION.md)，验证时仓库 HEAD 为 `48122c8d7f1454be0bc19522a6041f6cc935a7c9`，来源配置代码 SHA 为 `0ec0704c0e60a88d84bc99d558eb569c56731c79`；隔离库 `fiscalhot_regional_p3_test` 完成35项迁移。测试副本仅允许两个确切 URL；两源配置均保持 disabled/fulltext=false，所有安全开关为 false，没有 worker、模型、Jina、通知或发布调用。报告记录中央源5次 guarded fetch（含早期成功调试预检）、厦门源4次，共9次，低于12次预算且无重试。独立审计可从正式脚本/JSON材料核对8次（两次列表预检、4次collector、2次详情）；额外早期中央预检仅有报告记录，缺少单独机器日志/响应哈希，因此该第9次不是独立机器证据。

中央广西样本与厦门普惠金融样本各自两轮 collector 均为第一轮 `found/created/revised=1/1/0`、第二轮 `1/0/0`；每篇 URL 唯一，数据库四个 fetch run 均为 `ok`。每个详情页另作一次独立 HTTP 200 和 Readability 临时解析，临时文本分别约1,720、1,935字，标题、列表日与详情 PubDate 日级一致。质量 Agent 独立 SQL 复核为2个 source、2篇 article、2个 dormant `content.extract-body` job、receipts/publications/reports 等均0。该结果没有执行 `extractArticleBody()`，SQL 中两篇均仍是 `body_status=pending`、`body_text` 长度0、revision 1；数据库中每篇有1个未消费 `content.extract-body` job，共2个。不能把临时 Readability 结果写成数据库正文通过。详情 HTML 未保存；正文片段由结果材料抽查其业务相关性，但无法对原页面做二次离线解析。

保存页面与前一日快照离线比较：中央7/7、厦门10/10的 URL 和日期相同；这只是约一天的静态快照观察，不能证明长期稳定性。详情 URL 路径日期与发布日不同，但采用列表日期入库并与详情 PubDate 在日级相符。请求计数、实际文章、环境和限制以正式报告为准；第9次请求仅有报告文字归因，不能当作独立机器证据。

## Git、CI 与已知回归证据

- 当前交接基线分支 `feat/fiscal-finance-hot`；代码配置 SHA `0ec0704c0e60a88d84bc99d558eb569c56731c79`，本检查点编写前 HEAD `48122c8d7f1454be0bc19522a6041f6cc935a7c9`，初始基线 SHA `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。
- Ubuntu Check run [36589569943](https://github.com/revercgy-hub/MYHOT/actions/runs/36589569943) 测试的 SHA 为 `dafe9386838f6423dba8e080c51cd9114066992f`。它证明该历史版本的通用 Linux 测试/构建检查通过；不证明 `0ec0704` 或此处 HEAD 已被该 CI 测过，也不证明真实官方 PDF 在 Linux 解析通过。
- P3 较早验证见 [P3_INGEST_VALIDATION.md](../P3_INGEST_VALIDATION.md)、[P3_BODY_VALIDATION.md](../P3_BODY_VALIDATION.md)、[P3_REMAINING_SOURCE_VALIDATION.md](../P3_REMAINING_SOURCE_VALIDATION.md)、[P3_OMO_VALIDATION.md](../P3_OMO_VALIDATION.md)、[P3_XIAMEN_DEBT_PDF_VALIDATION.md](../P3_XIAMEN_DEBT_PDF_VALIDATION.md) 与 [P3_LOCAL_PREVIEW.md](../P3_LOCAL_PREVIEW.md)。其中每份记录的样本范围保持原样，不用其结果替代新来源验收。
- 最近状态记录的区域来源配置后本地验证为 fresh `fiscalhot_regional_sources_test` 35 项 migration、`npm test` 156/156、typecheck、allowlist/selector focused 检查、Web build、Web tests 15/15、smoke 30/30通过。独立 collector 样本使用另一个 `fiscalhot_regional_p3_test`，没有运行应用测试套件；不可将其中一个库或验证结果混为另一个。

## 环境与安全

截至 STATUS 记录：12 个 source 全部禁用且站内/RSS 全文关闭；`.env.example` 中采集、模型、Jina、IndexNow、Feishu 开关关闭。此前的静态候选验证未写库；本轮仅在独立 `fiscalhot_regional_p3_test` 中由两个固定 URL collector 各写入1篇 article，并留下2个未消费正文任务，正文仍 pending/0字。之前的人工预览库未改；collector 测试未启动 worker、模型或全文发布。进入下一步前应从 STATUS、Agent 验证记录和实际进程/数据库证据重新确认，不能推测服务当前仍在运行。

## 阻塞、风险与下一批 Agent

1. 独立复核 collector 报告与 SQL/JSON 原始证据，确认详情临时可读与数据库正文 pending/0 字分开呈现；当前已有两条固定 URL 的有限 collector 和判重证据，但尚无实际正文入库确认。
2. 对新增两源补正文提取结果、分页范围、发布日期口径、过滤噪声、重复和跨周期 freshness 证据；逐项记录未覆盖内容。中央选登不能承诺全35局覆盖。
3. 如果福建局独立栏目需纳入，先取得可复核列表原文及结构证据后再决定配置；重复502仍视为未核验。
4. 下一批建议由独立质量复核 Agent 审查 SQL、正文样本、重复和风险，再安排有限分页及正文提取验证；当前 `P3_REGIONAL_COLLECTOR_VALIDATION.md` 由 collector Agent 独占，当前检查点由阶段负责人维护。接手前确认后续文件所有权，避免覆盖。
5. Gate 2 需正式审查核心来源稳定性后另行记录；本检查点不判定通过。无证据不猜测正文完整性、发布者、覆盖率、当前服务状态或 CI 覆盖。

## 修订记录

- 2026-09-30：根据 SOURCE_MATRIX、监管局来源调查、正式 collector 报告、当前 STATUS 和 Git 快照建立进行中检查点；记录有限的两条固定 URL collector 证据，并保留正文数据库状态及 Gate 边界。
