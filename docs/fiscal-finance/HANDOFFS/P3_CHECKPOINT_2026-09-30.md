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
| `mof-regional-supervision-dynamics` | 财政部“财政新闻”首页快照25项；parser 按“监管局”标题筛出7条唯一候选。隔离库固定广西国有金融资本产权登记 URL 两轮 collector：`found/created/revised` 为 `1/1/0`、`1/0/0`；详情 HTTP 200，标题与列表一致，列表日与详情 PubDate 同日。后续一次 `extractArticleBody(id, false)` 以1个GET写入1,720字，SQL `body_status=ok`、revision 2，正文 hash 已记录。 | 只验一个固定URL；详情原始 HTML 未保存。中央来源为选登汇总，不代表35局全量；未请求20页历史，没有更多文章正文、跨周期稳定性或长期重复率结论。 |
| `mof-xiamen-supervision-dynamics` | 厦门监管局工作动态首页快照解析10项。隔离库固定厦门财金协同普惠金融 URL 两轮 collector：`found/created/revised` 为 `1/1/0`、`1/0/0`；详情 HTTP 200，标题与列表一致，列表日与详情 PubDate 同日。后续一次 `extractArticleBody(id, false)` 以1个GET写入1,935字，SQL `body_status=ok`、revision 2，正文 hash 已记录。 | 只验一个固定URL；详情原始 HTML 未保存。没有历史分页、更多文章正文、跨周期 freshness/重复率证据。 |
| 福建独立监管局源（未配置） | 财政部中央选登样本含一篇福建监管局稿件；35局目录列有福建官网。 | 本机对福建局栏目/详情的两次有界请求均返回 HTTP 502；没有原始列表快照，不能配置独立 selector 或声称栏目通过。 |
| 其余33个目录局 | 目录名称及域名可用于机构目录/中央 allowlist 核对。 | 没有逐局检查新闻栏目、抓取结构、详情正文或覆盖情况。 |

### 新增来源的有限 collector 验证

正式报告为 [P3_REGIONAL_COLLECTOR_VALIDATION.md](../P3_REGIONAL_COLLECTOR_VALIDATION.md)，验证时仓库 HEAD 为 `48122c8d7f1454be0bc19522a6041f6cc935a7c9`，来源配置代码 SHA 为 `0ec0704c0e60a88d84bc99d558eb569c56731c79`；隔离库 `fiscalhot_regional_p3_test` 完成35项迁移。测试副本仅允许两个确切 URL；两源配置均保持 disabled/fulltext=false，所有安全开关为 false，没有 worker、模型、Jina、通知或发布调用。报告记录中央源5次 guarded fetch（含早期成功调试预检）、厦门源4次，共9次，低于12次预算且无重试。独立审计可从正式脚本/JSON材料核对8次（两次列表预检、4次collector、2次详情）；额外早期中央预检仅有报告记录，缺少单独机器日志/响应哈希，因此该第9次不是独立机器证据。

中央广西样本与厦门普惠金融样本各自两轮 collector 均为第一轮 `found/created/revised=1/1/0`、第二轮 `1/0/0`；每篇 URL 唯一，四个 fetch run 均为 `ok`。后续 [P3_REGIONAL_BODY_VALIDATION.md](../P3_REGIONAL_BODY_VALIDATION.md) 在隔离库对每篇各调用一次现有 `extractArticleBody(id, false)`：Undici diagnostics 记录各1个 GET hop，HTTP 200、无重定向/超时。此前 `pending/rev1` 均更新为 `ok/rev2`；广西正文1,720字、厦门1,935字，SHA-256、长度与首尾各400字保存在忽略的 `.data/fiscal-regional-collector-validation/body-validation.json`。正文报告记录的数据库前后 source/article 数2、fetch_runs仍4，analyses/receipts/publications/reports/stories仍0；两个 `content.extract-body` job 留在 `created`、retry 0，直接函数调用未消费任务。来源仍 disabled/fulltext=false，预览库没有修改。

正文验证前重新核对代码：`guardedFetch` 最多跟随5次重定向，每次提取调用最坏可能产生6个HTTP hop。因此原先“至多新增2次请求”的口径不能保证实际 hop 上限；负责人将本轮两次正文调用预算调整为最多12个新增 hops，加上先前报告总计口径9次为21。本次实际新增2 hops，合计记录口径11/21。先前9次里8次有机器材料；第9次是仅有人工过程记录的中央预检，历史 collector 请求没有逐跳日志，不能还原为准确历史 HTTP hop 数。预算与限制见正文验证报告，不将其表述为21次实际网络请求。

保存页面与前一日快照离线比较：中央7/7、厦门10/10的 URL 和日期相同；这只是约一天的静态快照观察，不能证明长期稳定性。详情 URL 路径日期与发布日不同，但采用列表日期入库并与详情 PubDate 在日级相符。请求计数、实际文章、环境和限制以正式报告为准；第9次请求仅有报告文字归因，不能当作独立机器证据。

## Git、CI 与已知回归证据

- 当前交接基线分支 `feat/fiscal-finance-hot`；代码配置 SHA `0ec0704c0e60a88d84bc99d558eb569c56731c79`，本检查点编写前 HEAD `48122c8d7f1454be0bc19522a6041f6cc935a7c9`，初始基线 SHA `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。
- 最新 Ubuntu Check run [36647432023](https://github.com/revercgy-hub/MYHOT/actions/runs/36647432023) 成功，tested SHA=`8e845812b6ce1db45821ade7b2162a90f589e1de`；该 HEAD 包含来源代码 SHA `0ec0704c0e60a88d84bc99d558eb569c56731c79`。本检查点后续文档提交 HEAD 会变化，CI tested SHA 仍保持为实际 `8e845...`。较早 Check run [36589569943](https://github.com/revercgy-hub/MYHOT/actions/runs/36589569943) 测试 SHA `dafe9386838f6423dba8e080c51cd9114066992f`。两次 CI 均为通用 Linux 测试/构建；未在 Linux 解析真实官方 PDF。
- P3 较早验证见 [P3_INGEST_VALIDATION.md](../P3_INGEST_VALIDATION.md)、[P3_BODY_VALIDATION.md](../P3_BODY_VALIDATION.md)、[P3_REMAINING_SOURCE_VALIDATION.md](../P3_REMAINING_SOURCE_VALIDATION.md)、[P3_OMO_VALIDATION.md](../P3_OMO_VALIDATION.md)、[P3_XIAMEN_DEBT_PDF_VALIDATION.md](../P3_XIAMEN_DEBT_PDF_VALIDATION.md) 与 [P3_LOCAL_PREVIEW.md](../P3_LOCAL_PREVIEW.md)。其中每份记录的样本范围保持原样，不用其结果替代新来源验收。
- 最近状态记录的区域来源配置后本地验证为 fresh `fiscalhot_regional_sources_test` 35 项 migration、`npm test` 156/156、typecheck、allowlist/selector focused 检查、Web build、Web tests 15/15、smoke 30/30通过。独立 collector 样本使用另一个 `fiscalhot_regional_p3_test`，没有运行应用测试套件；不可将其中一个库或验证结果混为另一个。

## 环境与安全

截至 STATUS 记录：12 个 source 全部禁用且站内/RSS 全文关闭；`.env.example` 中采集、模型、Jina、IndexNow、Feishu 开关关闭。此前的静态候选验证未写库；两轮 collector 在独立 `fiscalhot_regional_p3_test` 中各写入一个固定 URL article，随后正文验证将两篇更新为 `ok/rev2`。人工预览库没有修改；所有提取安全开关关闭，未启动 worker、模型、Jina或全文发布。两个遗留 `content.extract-body` job 保持 created/retry0，没有消费。正文提取每次最多6个HTTP hop，两个调用预算最多12个新增hop，报告合并的历史计数预算21；本次实际总计2个GET hop。pnpm预检失败曾将4组依赖留在忽略目录 `node_modules/.ignored`；后续 `npm ls --depth=0` 和 `npm run typecheck` 均退出0，Web `/` 和 API `/api/health` 只读检查均200；依赖可解析，4组忽略目录残留没有重装/清理。未测试多条文章、历史分页或跨周期。服务当前是否运行以新进程证据确认。

## 阻塞、风险与下一批 Agent

1. 当前两条固定 URL 已有正文入库确认；后续扩展时继续区分详情临时读取和 SQL 中 `body_text/body_status/revision`，保留正文 hash 与审计材料。
2. 对新增两源补分页范围、更多文章正文、发布日期口径、过滤噪声、重复和跨周期 freshness 证据；逐项记录未覆盖内容。中央选登不能承诺全35局覆盖。
3. 如果福建局独立栏目需纳入，先取得可复核列表原文及结构证据后再决定配置；重复502仍视为未核验。
4. 下一批建议由独立质量复核 Agent 审查 SQL、正文样本、重复和风险，再安排有限分页及正文提取验证；当前 `P3_REGIONAL_COLLECTOR_VALIDATION.md` 由 collector Agent 独占，当前检查点由阶段负责人维护。接手前确认后续文件所有权，避免覆盖。
5. Gate 2 需正式审查核心来源稳定性后另行记录；本检查点不判定通过。无证据不猜测正文完整性、发布者、覆盖率、当前服务状态或 CI 覆盖。

## 修订记录

- 2026-09-30：根据 SOURCE_MATRIX、监管局来源调查、collector 与正文验证报告、当前 STATUS 和 Git 快照建立进行中检查点；记录两条固定 URL 的隔离 collector/正文入库证据、HTTP-hop预算审计及 Gate 边界。
