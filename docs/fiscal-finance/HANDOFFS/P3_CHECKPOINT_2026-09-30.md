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

## 2026-09-30 后续检查点追加：区域分页、OMO跨日与S1阶段裁决

以下追加信息保留此前检查点记录时点的历史描述；新报告扩展了证据，不覆盖旧结论或改写旧范围。

**当前状态**：`P3=IN_PROGRESS`，`Gate 2=NOT_PASSED`。12个来源继续全部`enabled=false`且`site_fulltext=false`、`syndicate_fulltext=false`。新文件包括 [区域分页核验](../P3_REGIONAL_PAGING_VALIDATION.md)、[OMO跨日核验](../P3_OMO_FRESHNESS_2026-09-30.md)、[Gate2就绪审计](../P3_GATE2_READINESS.md) 和 GPT-6.1 Sol 的 [S1阶段依赖裁决](../ARCHITECTURE_PHASE_DEPENDENCIES.md)。S1 `DECISION=APPROVED` 仅是依赖范围批准，`GATE_2=NOT_PASSED`；不能在任务交接中称 Gate 2 已批准或通过。

区域只读分页核验共6次guarded fetch，均HTTP200、无重定向，证据完整HTML/哈希保存在 ignored `.data/fiscal-regional-paging-validation/`。配置 parser 从中央首页/相邻历史页分别解析8/7项，从厦门首页/历史页解析10/10项；相邻URL精确重复各0；历史详情正文1,832/1,979字。中央首页对照旧快照新增厦门局一篇候选；与本轮厦门当前首页的exact URL、same host/path及标题比较均无匹配。未来同host/path经 `normalizeUrl` 的HTTPS规范URL产生同identityKey仅是代码路径事实，本轮无跨源collector写库。中央页脚声明20页、厦门10页，本轮各仅读两页；collector仍只请求配置首页，不声称实现翻页。

OMO检查比较2026-09-29和09-30首页，均解析20项；第192号进入首页，旧第172号滑出。第192号隔离库两轮为`1/1/0 → 1/0/0`，正文SQL 135字、1完整表格，与原始HTML一致；未给公告补写不存在的利率数据。调用一次`extractArticleBody`结果`skipped`，因采集器已把完整短正文标为`ok`。报告记录脚本末尾错误断言退出非零；错误是将`content.analyze`队列job计数误作`analyses`表计数。最终独立SQL证据为队列一个`created/retry0`、analysis表0行、receipts/model记录0；未重跑。此样本说明一天窗口间出现一次更新，不证明长周期稳定性。

**S1裁决与下一步**：不新增通用分页或OCR实现，不要求P3完成NAS。P3需基于实际首页容量、最旧候选日期/排序、常规与突发新增、轮询间隔、失败退避及中断、初始backfill上限验证是否可能滑窗漏项；如证据不足，才提交有界分页S1。必要业务PDF正文属于P3源质量；已实现解析路径的真实PDF Linux集成最迟P7/Gate4前验证，NAS硬RSS/隔离在P8/P9/Gate5前。只有完成P3证据并正式通过Sol Gate2 Review后才能进入P4。P4须用全新隔离pilot库，固定完整的article ID/revision/content hash并逐条人工核正文；不可将含P3未消费jobs的数据库交给泛worker/sweeper/requeue。`source.enabled=false`不能阻断已经排队的`unconfirmed`分析job；当前安全依靠`MODEL_CALLS_ENABLED=false`且无worker。未确认PDF/RAR、partial HTML和已知假阳性不得入pilot或发布。

**人工预览当前环境**：按Lead授权恢复原有`.data/test-pg/cluster`共享PostgreSQL集群，使用仓库忽略目录中的EDB PostgreSQL 17.11-3 binaries。`127.0.0.1:5432`、API `127.0.0.1:3001`和Web `127.0.0.1:3000`均已验证监听loopback。只读SQL核实既有`fiscalhot_preview_test`仍为35 migrations、34 topics、3 articles、3 publications；3 source均disabled/fulltext=false；3条样本score/reason null、selected=0、analysis/receipt=0。首页、`/all`、health和pool端点均HTTP200；pool为3条且未精选；smoke 30/30通过。API/Web由可管理exec会话运行，`NODE_ENV=development`，Web预览flag true，其余COLLECT/MODEL/JINA/IndexNow/Feishu/私网flag false，DEV_AUTH为空；未启动worker。未重建数据库、不触碰私有OMO `55432`集群、不消费任何P3 job。预览保持运行给用户查看。

**Git快照**：追加工作开始时`feat/fiscal-finance-hot` HEAD=`21cd590f9d5283b9a50d5827f8acc870564e8897`；源配置代码SHA仍为`0ec0704c0e60a88d84bc99d558eb569c56731c79`；S1审查针对HEAD `21cd590f9d5283b9a50d5827f8acc870564e8897`。本段只依据已报告结果和只读原始文件审计，无代码修改或新CI。文档提交SHA在提交后由Git命令记录。

修订：2026-09-30，阶段负责人依据新分页/OMO报告、S1裁决、原始ignored证据、preview恢复只读核验追加；Gate 2仍未通过。

## 2026-09-30 后续质量、日期与人工证据追加

**状态仍为 `P3=IN_PROGRESS` / `Gate 2=NOT_PASSED`。** 区域两源一页历史与OMO一次跨日数据只是有限快照；中央新增厦门候选相对当前厦门首页 exact URL、host/path、标题均0匹配，未请求详情，未做跨源collector去重实测。

日期/首页窗口审计见 [P3_DATE_COVERAGE_AUDIT.md](../P3_DATE_COVERAGE_AUDIT.md)：会计司原始列表span、详情PubDate、正文发布日期同为9/22，parser UTC `2026-09-21T16:00:00Z` 换算中国日也是9/22，旧记录已按UTC切日/URL路径误读更正；厦门证监API字符串/正文可见日期同9/15，`PubDate`与生成元数据9/23的含义未知。预算司保存首页10条、日期新到旧2026-03-26至2023-07-24；首次导入12个月条件在此快照仅剩1条是代码条件推算，不是collector结果。

Lead有限裁定见 [P3_CORE_BODY_RESOLUTION.md](../P3_CORE_BODY_RESOLUTION.md)：福建现金管理四页23行和厦门第十六期专项债单页转录均经双Luna逐字段/逐格核对并接受为 `P3 manual_sample_evidence=ACCEPTED`。详见 [福建复核](../P3_FUJIAN_TRANSCRIPTION_REVIEW.md) 和 [厦门复核](../P3_XIAMEN_MANUAL_REVIEW.md)。此范围只认可手工核对的P3样本事实；不认可机器正文 `ok`、来源验收、Gate 2通过、P4导入/模型/publication。福建机器正文仍unconfirmed；厦门旧 `pdf_page_no_text` 与205字Readability假阳性不变。未发生数据库或正文状态修改。

### 本轮环境、Git与检查

- 本轮质量核验基线：branch `feat/fiscal-finance-hot`，HEAD `d9b2433b9f032cdab7cccd07b549df7fb07ebb18`；`SOURCE_CONFIG_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79`；阶段基线 `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。本次无代码/config更改；本文和三份共享矩阵/状态文档以及四份证据报告为待审docs改动，最终提交HEAD未知，不预测。
- `CI_TESTED_SHA=8e845812b6ce1db45821ade7b2162a90f589e1de` 对应已成功run 36647432023；其早于本轮当前基线，不含当前文档修订，也不解析真实官方PDF。本轮未重跑typecheck、npm test或web build。
- 本轮恢复/核对的预览仍用既有 `fiscalhot_preview_test`，35 migrations，3 articles/3 publications；来源disabled/fulltext关闭，body_status=none、revision=1、selected=0、score/reason为空、analysis/receipt/job_runs=0。API/Web/PostgreSQL仅监听 `127.0.0.1:3001/3000/5432`；采集、模型、Jina、IndexNow、Feishu、私网旗标显式false，DEV_AUTH未设置，没有应用worker。`/api/site/pool`3条，主页、`/all`与样本详情200，人工标记和noindex可见；`node scripts/smoke.ts --base http://127.0.0.1:3000` 30/30通过。

**NEXT**：优先补核心首页整批、首页滑窗/跨周期证据；评估扫描材料是否确有机器可读业务需要，再提交必要的最小S1架构提案，不预设OCR实现。保持所有来源关闭与P3遗留jobs隔离。等有新证据组成完整包后安排正式Gate 2 Review。

## 2026-09-30 扫描正文提案与预览复核追加

**状态仍为 `P3=IN_PROGRESS` / `Gate 2=NOT_PASSED`。** 区域分页和 OMO 跨日两批 Agent 报告已各自独立交付并纳入 [SOURCE_MATRIX](../SOURCE_MATRIX.md)、[Gate 2 就绪审计](../P3_GATE2_READINESS.md)：区域报告6次 guarded fetch 均200，中央首页/相邻历史页8/7项、厦门10/10项，跨页精确URL重叠各0，两篇历史详情正文1,832/1,979字；仅覆盖相邻两页。OMO报告比较9/29与9/30的20项首页，第192号进入、第172号退出；第192号两轮 `1/1/0 → 1/0/0`，135字正文含完整表格。脚本退出非零由把 `content.analyze` 队列任务数误作 analyses 行数的断言造成；独立 SQL 为队列一个 `created/retry0`，analyses/receipts/model记录为0，未启动worker且未重跑。该跨日样本只有一次，不证明长期稳定。中央厦门候选与厦门当前首页三种比较均无匹配，但未请求候选详情、未验证跨源 collector 去重。

Lead确认产品需要核心财政业务公告持续自动获取。福建现金管理4页23行和厦门专项债1页字段均已双Luna视觉复核并接受为 `P3 manual_sample_evidence=ACCEPTED`，但这不代表机器正文 `ok`；福建仍 `unconfirmed`、厦门旧 parser 仍 `pdf_page_no_text`，Readability 假阳性不变。新增 [P3_SCAN_BODY_PROPOSAL.md](../P3_SCAN_BODY_PROPOSAL.md) 后，GPT-6.1 Sol已按 [S1_SCAN_OCR_POC_REVIEW.md](../S1_SCAN_OCR_POC_REVIEW.md) 批准一次固定五张现有PNG的本机OCR PoC和最多三次固定版本官方语言文件请求；只允许离线实验，不接collector/body job，不改变Gate 2或P4。当前Tesseract `5.5.0.20241111`只有`eng`/`osd`、缺`chi_sim.traineddata`；语言文件尚未获取，OCR尚未运行。默认不付费、不安装NAS。PoC不需 `apps/`、业务管线或迁移；未来持续集成另审 `packages/backend` 有界适配器。

**本轮预览复核**：开始时 PostgreSQL 在 `127.0.0.1:5432` 监听，API/Web未监听，初始 smoke 30项失败。按既有授权启动 API `127.0.0.1:3001` 与构建版 Web `127.0.0.1:3000`，环境显式设置 `NODE_ENV=development`、固定 `fiscalhot_preview_test`、loopback Host/URL、Web `LOCAL_PREVIEW_ENABLED=true`，`COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、Jina/IndexNow/Feishu/私网均关闭；没有 worker。恢复后只读 HTTP 检查 `/`、`/all`、health、`/api/site/pool` 均200，pool显示3条；smoke 30/30通过。未重新运行 seed、没有 SQL写入/数据库重建、没有触及 private OMO 55432 集群。预览服务继续运行供用户查看。API/Web由本轮可管理 exec 会话维持。

**Git与检查范围**：开始工作时分支 `feat/fiscal-finance-hot`，HEAD `d9b2433b9f032cdab7cccd07b549df7fb07ebb18`，干净工作树。当前只新增扫描提案并编辑 `STATUS.md`、`SOURCE_MATRIX.md`、`P3_GATE2_READINESS.md`、本检查点；没有应用/包/schema/source config改动。以实际 git 最终状态为准。docs-only不跑 typecheck/npm test/build；本轮 smoke 是唯一新运行验证。CI仍是早前成功 SHA `8e845812b6ce1db45821ade7b2162a90f589e1de`，不代表本轮文档或真实PDF Linux OCR。

**NEXT（记录时点）**：当时扫描路线 S1 尚待 Lead 决定。后续 GPT-6.1 Sol已批准一次固定图像离线OCR PoC及其严格输入/资源/官方训练数据获取边界；结果尚未生成。Lead另已批准离线HTTP hop工具修复和localhost测试任务。二者都不代表 Gate 2通过、业务OCR集成或新来源请求预算。Gate 2仍不得写作通过。

## 2026-09-30 两批完整首页采集证据追加

正式报告现已落盘并纳入 [SOURCE_MATRIX](../SOURCE_MATRIX.md) 和 [P3 Gate 2 就绪审计](../P3_GATE2_READINESS.md)：[会计司/预算司批次](../P3_CORE_BATCH_2026-09-30.md) 与 [财政部区域两源批次](../P3_REGIONAL_BATCH_2026-09-30.md)。两份报告是隔离库中的实际执行证据，不能并入公开 preview 或误写成来源通过。

**核心两源**：会计司两轮 `found/accepted/created/revised=10/10/10/0 → 10/10/0/0`；预算司 `10/1/1/0 → 10/10/9/0`。预算司首轮 12 个月窗口实际只收一篇，第二轮 `cursor.initializedAt` 已建立后补入9篇旧文，这是实际行为。数据库20篇中正文 helper只调用12篇，SQL和逐篇列表核为6 `ok`、6 `unconfirmed`、8 `pending`；6个失败原因没有进入helper返回值/日志，只能标 `unknown`。20个 `content.extract-body` jobs 均 `created` 未消费，analyses/receipts/job_runs为0。会计司旧完整快照仅5/10 URL可完整精确比较；预算司旧HTML10/10与新候选相同，但新运行没有保存列表响应正文。此批也观察到栏目会议、会计边缘内容，过滤规则为0不能当成零噪声。

**区域两源**：中央配置首页两轮 `8/8/8/0 → 8/8/0/0`，厦门 `10/10/10/0 → 10/10/0/0`；18篇正文全 `ok/rev2`。中央8篇正文日期与列表日一致；厦门10篇列表日期解析完整，但正文未见发布日期，且5篇正文只有223–379字需逐篇人工核对。两个候选集合 `identityKey` overlap=0，因此本轮跨源 collector dedupe 实测为 `unknown`。仍仅采首页；中央声明20页、厦门10页，区域相邻分页报告也只核一页历史。

**两批预算计数失效**：执行器覆写 `Agent.prototype.dispatch` 的hook都未命中。核心批次实际 HTTP hop 总数 `unknown`；区域批次预设28 hop，但可核 24 次批次 guardedFetch 加一探针（至少25 hops），其余 redirect hop无日志。均不能证明请求硬预算上限，也不把顶层函数调用量当网络次数。发现失效后已停止联网、没有重试/重跑。下一开发任务为先离线确定并修复计数与硬停止，再用无外网 localhost/canary确认hook可见且第N+1 hop被拒绝；没有 Lead 批准前不安排新来源请求。regional batch报告含诊断边界与建议的undici diagnostics事件及验证dispatcher方案，不虚构具体hook失效原因。

核心正文机器路线上，Lead已明确产品要求核心财政公告持续自动获取。双Luna人工复核只支撑P3样本字段事实，不支撑自动提取。离线 OCR PoC 的限缩 S1 已由 GPT-6.1 Sol `APPROVED`，固定五张PNG及最多三次官方语言文件请求；当前没有获取语言模型、未调用OCR、不接业务管线。Lead要求实验只产出逐页raw TSV/text、candidate字段及资源/来源manifest和完整独立gold checklist；由另一位Luna对照全部字段，不开发通用表格gold抽取算法，unknown行不能凑成机器匹配。S1不扩大为Gate 2通用OCR前置。HTTP计数工具已实现，5项localhost测试通过；其准确范围是后端 Undici 8.11.2 Agent/ProxyAgent dispatch admission cap，未覆盖全局所有网络路径，也不追认两个历史批次预算。

**阶段结论仍是 `P3=IN_PROGRESS` / `Gate 2=NOT_PASSED`**。两批只证明给定快照与样本的隔离执行结果，预算未证，跨周期、来源噪声、首页滑窗、区域短正文及已知扫描附件机器提取仍需审查；12个来源均继续disabled且全文关闭，模型开关false，无worker。本次文章/队列都只在专用隔离库；原来三条公开人工预览样本未重建，服务端口仍为loopback，Smoke 30/30通过。

## 离线工具验收与扫描 PoC 结果（2026-09-30）

`scripts/fiscal/p3-http-budget.ts` 通过本地服务5项测试，包括第N+1请求在原dispatch前拒绝、redirect hop分别计数、ProxyAgent内部委派不双计、observer不改变错误响应、卸载恢复。覆盖仅限 backend Undici 8.11.2 的Agent/ProxyAgent dispatch admission；global fetch/其他Undici/worker/私网dispatcher旁路及proxy CONNECT内部调用不覆盖。既有核心批次HTTP hop仍unknown、区域至少25次guardedFetch且完整hop未知，不因该离线验证变成预算PASS；新来源联网运行仍待Lead授权。

固定五图扫描 PoC 结果见 [执行报告](../P3_SCAN_OCR_POC_RESULT.md) 和 [独立 gold 审阅](../P3_SCAN_OCR_GOLD_REVIEW.md)。官方commit定位请求成功；固定版本 `chi_sim.traineddata`响应为HTTP 200，但30秒内响应流未完整读取，因S1不重试边界停止，第三次许可证请求未发出。ignored目录仅含`prepare-failure.json`和不完整`manifest.json`，没有模型、许可证、OCR文本/TSV或`run.json`。因此OCR与gold字段对比均`NOT_RUN`；五图哈希和尺寸边界已核对，但机器候选为零。`OCR_RUN_ENABLED=false`，运行资源监控、超时/kill-wait尚无fake-child或native-process证据；不能将CLI离线测试通过表述为可运行OCR PoC。

**完整检查**：全仓 `npm run typecheck`通过；新鲜 `fiscalhot_agent_verification2_test` 数据库运行35项migration，`npm test` 165/165通过；Web production build成功，Web tests 15/15通过；既有loopback preview smoke 30/30通过。`node scripts/fiscal/ocr-scan-poc.ts run`在模型读取/子进程启动前按预期返回disabled。准备一次曾在30秒请求限制上终止模型下载；不能重试也未启动OCR。GitHub Actions [Check #36676119420](https://github.com/revercgy-hub/MYHOT/actions/runs/36676119420) 对工具代码 `aaea0502e9fe8df7b858c64df61bb46e207b71de` 全绿，含Ubuntu typecheck/build/webtests/migrations/smoke/backend tests及Docker build/compose smoke。CI未获取语言模型，未运行OCR或资源monitor。preview数据库没有用于P3测试写入，worker/source/publication开关维持关闭。本段用于本轮质量记录，最终文件范围与Git状态以Lead最后检查为准。
