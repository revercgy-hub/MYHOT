# 福建两页有界 collector 实跑检查点（2026-10-12）

STATUS=IN_PROGRESS
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=c133db772d1718281fed55bef3a1d2390ed39245（当前阶段代码SHA）
CURRENT_CODE_SHA=c133db772d1718281fed55bef3a1d2390ed39245（本轮代码未变）
DOCS_BASE_HEAD=cc0b8305748b08c4059846ee8a1821ddb04bbb93（本轮文档提交父SHA；最终文档commit另见Git）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
RECOVERY_SHA=cc0b8305748b08c4059846ee8a1821ddb04bbb93（本轮实际clean起点）
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=P3来源主线与本地开发预览维护；本轮只核验福建来源两页有界执行，不扩Gate或source准入
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`，仅限[正式review](../GATE_2_REVIEW.md)规定的三个核心source逐篇合格小样；本次福建运行不改变Gate裁定
REVIEW=Root批准两页/10详情候选/12共享dispatch上限、redirect使用现有identity/prefix守卫且每hop计入共享预算；本轮只发2次direct列表GET。manifest预算、离线解析与只读DB逐条核对独立通过；metadata窗外计数漏记留待代码owner评估。

## 结果

2026-10-12 07:50 UTC，来源owner按本轮批准范围，对`mof-fujian-supervision-dynamics`在fresh隔离库`fiscalhot_fj_pagination_20261012_test`（35 migrations）执行一次`mof_index_v1`两页collector。范围允许复用既有identity/prefix redirect守卫，redirect hop统一计入共享12-dispatch预算；详情目标最多10个，列表单个响应限8 MiB、详情单个响应限6 MiB，timeout 20秒，不重试、不取附件。实际仅发出两个direct官方列表GET：栏目首页和`index_1.htm`，均HTTP 200、完整EOF、无redirect、无重试；dispatch `2/12`。没有发详情或附件请求。列表实体响应分别为4,432 B、SHA-256 `ec08b0675efe1f23a6ab29b16204d37a91b79b6baafbfbed653e83b732cc1b02`，及4,396 B、SHA-256 `d1285328bc6dde8d04f32fa9f14b3094832ff4d51726e3b4828e4accf35f8421`。两页响应均完整EOF；运行器原始包与manifest核对及离线解析/数据库比对见ignored证据目录。

QA独立解压两份保存响应并用当前`fromHtml`重放：每页10项，共20个唯一URL、无重复。窗口锚点为`2026-10-12T07:50:52.074Z`，截止时刻为`2026-07-14T07:50:52.074Z`；17条列表发布日期落在窗口内，并与数据库新建文章逐条匹配URL、标题和日期；3条较早候选（列表日2026-07-10、07-09、07-08）未入库。独立复核发现7条列表日期与URL路径日期不一致；本次没有详情GET，不能用路径日期替代页面日期，也不能据此裁定详情发布日期。

本次collector报告`found=20`、`created=17`、`revised=0`。一共新建17篇隔离库article、17条revision、17条discovery，并排入17个`content.extract-body` job（均`created`）。17篇正文全为`pending`且为空。无worker、`job_runs=0`、`analyses=0`、`receipts=0`、`publications=0`、`selected_ledger=0`。这些是本次隔离collector记录，不代表网站新增可见内容或精选结果；source运行后仍`enabled=false`，`site_fulltext=false`、`syndicate_fulltext=false`。未请求文章详情、附件、模型、付费provider、OCR；没有执行网站/API操作。

collector/fetch_run的状态为`ok`，但本轮只提交两页，`partial=true`、`stopReason=max_pages_per_run`、`nextPageIndex=2`、`coverage=unproven`。这只表示有界运行完成，不表示分页到末页、90日回填完成、来源质量通过或source准入。页内联候选日期行序和URL日期均不能单独证明历史完整。

### QA发现与限制

- 独立离线审计确认20项候选、17项落库、3项窗外未落库；但collector metadata中的`rowsOutsideWindow=0`与独立复核的3条窗外候选不一致。QA追到`direct_html_metadata_v1`路径将过窗项记录为`excluded/outside_window`，却没有累加该计数字段；这是本次该run telemetry字段漏计，不代表没有窗外候选。没有在本轮改代码或据此重新解释其它状态。
- 一个显式宽松标题正则`机关文化|党建|党支部|党日活动|党课|党务干部|政治监督|正确政绩观`命中7/20，其中6条在窗口内并入隔离库。命中标题包含机关文化、党务/党建会议、学习教育/党课、政治监督等主题。它只是QA启发式观察，不是项目噪声规则、正文审核、人工Gold标签或模型评估。
- 预检时运行器的原始捕获与单页8 MiB配置曾不一致；来源owner将捕获恢复并按批准范围统一为列表8 MiB、详情6 MiB。真实运行使用此上限，捕获未截断；生产代码未改。这是运行器准备阶段的修正，不是本次生产collector安全违规。
- 本轮实际请求与运行由来源owner完成；QA独立复核保存响应hash/字节/EOF、`fromHtml`解析与库内17条记录，并只读审计数据库计数。Requested model `Luna High`；actual model unverified。应用模型调用为0。

原始manifest及响应、独立raw/parser/DB比较、只读SQL结果保存在ignored `.data/fiscal-qa/fujian-pagination-20261012/evidence/`：`manifest.json`、`responses/`、`independent-raw-db-audit.json`、`independent-sql-audit.txt`。这些是本地审计材料，不提交到Git。

## 必需任务字段

**TASK**：执行经范围批准的福建两页`mof_index_v1`真实collector观察，并独立核对请求、解析、窗口过滤和fresh隔离库写入。

**MODEL**：requested `Luna High`，actual model unverified；没有项目模型、provider、OCR或worker调用。

**FILES_CHANGED**：运行前仅调整一次性ignored runner的raw捕获及响应上限配置（列表8 MiB、详情6 MiB）；没有生产代码变更。文档更新为本handoff、`STATUS.md`、`SOURCE_MATRIX.md`、`REGIONAL_BUREAU_COVERAGE_MATRIX.md`与handoff索引；文档commit SHA另见git log。

**TESTS_RUN**：本轮未跑代码测试或CI；无代码改变。实际collector请求2/12，GET 2次均200/EOF、无重定向/重试/详情/附件。35 migrations fresh DB；独立offline `fromHtml`和只读DB审计确认20条候选、17条窗口内精确落库、3条窗外排除；17 articles/revisions/discoveries与17 created extract jobs；worker及下游处理均0。

**RESULT**：两页限额内的collector持久化及筛选有独立证据，当前窗口的17条只处于隔离库正文待抽取状态；正文、噪声业务判断、source质量、90日完整覆盖和准入尚未得到验证。

**RISKS**：`rowsOutsideWindow` telemetry为0但独立核实存在3条窗外候选；metadata route漏计原因已定位，需作为后续实现审查项。列表与URL日期7条不一致，且本轮无详情响应。启发式噪声标题仅提示采样价值。

**BLOCKERS**：Gate 2范围之外的来源主线继续；福建的正文质量/噪声、90日历史覆盖及来源准入未证明；17篇均pending/空正文，不能进入精选。

**IN_PROGRESS**：独立两页解析和17条写入已核；正文业务质量、列表日期可信度、完整分页/90日覆盖与跨周期稳定性仍未核。

**NEXT**：由Lead决定是否另行安排经授权的详情抽取或后续分页、以及是否需要修正`rowsOutsideWindow` metadata telemetry；本轮预算不授权自动续页或详情请求。source保持disabled、全文关闭，不消费jobs。

## 声明

本检查点只记录上述固定时间、两页响应、单个fresh测试库与独立QA结论。collector状态`ok`、隔离库创建或当前配置均不构成source admission、Gate提升、正文通过、网站可见或精选。
