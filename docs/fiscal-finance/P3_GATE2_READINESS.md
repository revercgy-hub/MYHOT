# Gate 2 证据就绪审计（2026-09-30）

STATUS=IN_PROGRESS；本文件是送审就绪审计，不是 Gate 2 Review，也不判定 Gate 2 通过。
GATE_1=PASSED；GATE_2=NOT_PASSED。
BRANCH=feat/fiscal-finance-hot；审计起始 HEAD=21cd590（以 `git rev-parse HEAD` 核实）；SOURCE_CONFIG_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79。
SCOPE=核对当前12条配置来源各自已有证据、缺口与进入正式 Sol Gate 2 Review 的条件；不改变来源启停、抓取器代码或测试数据。

## 结论

目前事实足以向 Sol 说明 Gate 2 尚未就绪，不足以支持核心源稳定或 Gate 2 通过。12 个配置源仍全部 `enabled=false`，`site_fulltext=false`、`syndicate_fulltext=false`。多条来源仅对一个精确 URL 做了两轮隔离 collector；这种证据只支持该 URL 的幂等行为。现有材料还记录了明确正文假阳性、领域噪声、附件正文缺失、较旧栏目和尚未核验的历史/周期覆盖。日期审计已纠正会计司 UTC 切日误读，并说明厦门证监元数据语义未知；这些澄清不构成周期稳定性验证。监管局两条来源已有固定文章正文入库成功，但首页覆盖、历史页和长周期稳定性还没有证明。

本次又完成会计司/预算司与财政部中央/厦门监管局两批完整配置首页隔离验证。核心20篇候选的一天内两轮产生 `10/0` 与 `1/9` 的创建数，且12篇正文样本呈 `6 ok / 6 unconfirmed / 8 pending`；区域18篇正文均`ok/rev2`。这提高了当前首页和所抽正文的事实覆盖，但仍是有界快照批次。两批HTTP计数 hook 均失效，实际 hop 总量/预算上限不能证明；正文 `ok` 也不等于逐字段完整性。首次预算司导入12个月窗口和之后cursor同步行为的差异、失败原因unknown、区域短正文、噪声及长期freshness仍需处理。

这份审计不筛掉问题源，也不通过降低核心源标准来制造 Gate 通过。区域分页和 OMO freshness 两份报告已完成，原始 HTML 与机器/SQL记录均已复核。若问题样本继续保留，正式审查材料必须原样呈现其限制和失败。

## 任务书与阶段依赖核对

仓库根目录《财政金融热点站完整开发与部署任务书.md》“首批核心源验证”列出每个源必须形成记录的项目：HTTP、文章发现、标题、发布时间、URL、正文、重复、导航、党建、招聘、培训、错栏目；Gate 2 原文是“核心官方源稳定以后才能打开模型调用”。`PROJECT_PLAN.md` 将 P3 定义为逐源真实抓取，并将 Gate 2 放在 P3 后、P4 模型验证前。任务书并未写明 Gate 2 要求实现通用自动分页，也没有要求在此阶段完成 NAS 部署或真实官方 PDF 的 Linux 解析。

历史来源状态/交接文档曾将真实 PDF Linux 解析、NAS RSS 硬限制与运行隔离列为 Gate 2 前风险/待办，或使用“Gate 2 阻塞”字样。保留真实结果（PDF 请求返回 `pdf_page_no_text`、Linux CI 未解析 PDF、NAS限制未测），不改写过去的失败事实。阶段依赖S1见 [ARCHITECTURE_PHASE_DEPENDENCIES.md](ARCHITECTURE_PHASE_DEPENDENCIES.md)：`DECISION=APPROVED`仅适用于阶段依赖/范围，`GATE_2=NOT_PASSED`。原裁决不批准通用分页/OCR或管线实现。针对持续自动获取核心业务公告的新提案 [P3_SCAN_BODY_PROPOSAL.md](P3_SCAN_BODY_PROPOSAL.md) 已由 GPT-6.1 Sol 在 [S1_SCAN_OCR_POC_REVIEW.md](S1_SCAN_OCR_POC_REVIEW.md) 批准一次固定五页、本机 Tesseract 离线实验及最多三次有界官方语言文件请求；没有批准 OCR worker/collector集成、通用 OCR、NAS安装或改变 Gate 2。实验结果尚未完成。重要业务PDF正文属于P3来源样本质量；已实现PDF路径的真实Linux兼容性最迟P7/Gate4前验证，NAS容器硬RSS/隔离和持续运行在P8/P9/Gate5阶段验证。以上裁决不把真实正文缺口改成通过。

分页/历史是必须记录和评估的来源质量证据；现有 collector 每轮读取一个 `config.url`。S1明确Gate2不要求遍历全部历史页或将全部历史档案接入持续采集。P3必须结合实际首页容量、最旧候选日期/排序、常规新增速度和突发批量发布、轮询间隔、失败退避及最长中断、初始导入数量/时间上限，检查是否有条目在两次成功轮询间滑出首页。只有新证据显示首页不足时，才提交有页数/请求/时间上限、URL安全范围、跨页去重和故障游标语义的分页S1；当前不改 `apps/`、`packages/`。

## 当前12个配置源逐项证据与缺口

| source ID | 已验证事实 | 未验证/阻塞 Gate 2 评估的事实 |
|---|---|---|
| `mof-budget-work` | 官方首页快照10项、10个唯一URL，2026-03-26至2023-07-24；第二页有2023/2022历史项。完整配置隔离批次两轮 `found/accepted/created/revised=10/1/1/0 → 10/10/9/0`，真实观察到首轮近12个月窗仅入2026-03-26一条、次轮因cursor已初始化放入其余9篇旧文；固定URL既有正文样本 `ok`、2,272字。 | 本批只取得一个长期较旧的首页窗，不能推断更新速度/稳定性或滑窗风险。12篇正文本轮共调用、此源2篇被调用；未确认的动员会正文1篇，原因unknown；8篇预算司正文保持pending未请求。首轮时间窗只限制首轮导入，不能表述为后续同步一直限近12个月。未确认原因及噪声人工判定仍缺；HTTP hop上限未证。 |
| `fujian-finance-notices` | 官方首屏selector解析5项，5个候选URL唯一；原始页面还预渲染22个列表块/108项。固定领证通知两轮 `1/1/0 → 1/0/0`，正文 `ok`、629字。Lead接受现金管理扫描 PDF 人工样本：4页23行双人逐格一致，额度和预计利息合计相符。 | 领证正文是会计资格服务噪声，不能证明领域质量。现金管理 PDF 机器文本层每页为空，正文 `unconfirmed`；人工转录不证明自动提取。配置selector仅取第一组5项；未验证全栏目时间覆盖、噪声率、附件文章内容完整性与长期freshness。 |
| `xiamen-finance-debt` | 官方首页解析15项，覆盖2026-05-08至09-11；固定 URL 两轮 `1/1/0 → 1/0/0`。Lead接受厦门第十六期债券 PDF 人工单页字段复核。 | 205字 Readability 被标 `ok` 是正文假阳性：DB内容为标题/日期、扫码提示和页尾，没有招标结果。精确 `.Custom_UnionStyle` selector 经 helper fail-closed，识别其外 PDF 附件；PDF受限请求后解析 `pdf_page_no_text`；人工转录不证明自动提取。首页没观察到分页链接；其余14项正文、历史/刷新范围、噪声未验证。 |
| `pboc-xiamen-work` | 官方首页20项，声明663条/34页；直查第2页20项与首页 URL 无重叠。固定 URL 两轮 `1/1/0 → 1/0/0`，正文 `ok`、1,745字；完整标题属性已配置。 | 仅单篇进行了持久 collector/正文验证；首页其余候选正文与噪声、34页深度/历史重复、候选窗口是否能覆盖两小时采集间隔及跨周期 freshness 未验证。 |
| `mof-policy-release` | 首页10项；隔离库两轮各10个候选，`10/10/0 → 10/0/0`；30篇批次正文后续 SQL 汇总29 `ok`、1 `unconfirmed`，该源10/10 `ok`；代表正文4,024字。历史第2页静态结构和异类内容已有观察。 | 最新可见日2026-08-26；跨周期 freshness 未验证。collector仍只读首页，旧页/历史正文和重复完整率未验证；综合栏目含彩票等内容，噪声率与编辑边界未验收。 |
| `mof-finance-notices` | 首页10项两轮 `10/10/0 → 10/0/0`；检查首页与历史第2页各10项，精确URL无重复；有同标题不同年度URL。30篇批次最新SQL本源9 `ok`、1 `unconfirmed`；另一个历史样本从0字经单篇HTML+PDF复核成1,454字。 | 最新列表日2026-07-16，约75天旧；首页到第二页日期边界有重叠，逐条标题/URL重叠判断不完整。短正文/PDF/RAR混合；RAR样本仍不确认，PDF未在Linux解析（S1列为P7/Gate4兼容性验证）。单个历史附件复验不代表附件路径整体可靠或周期稳定。 |
| `mof-accounting-notices` | 首页10项、详情结构已核验；固定征求意见函两轮 `1/1/0 → 1/0/0`，正文 `ok`、473字。全首页隔离批次实际两轮 `10/10/10/0 → 10/10/0/0`。正文本批调用10篇，其中5篇 `ok`、5篇 `unconfirmed`（失败原因未被helper接口/日志记录，unknown）；另有预算司未调用文章留在pending。日期复核确认列表 `<span>`、详情 `PubDate` 和正文日期均为2026-09-22；UTC `2026-09-21T16:00:00Z` 按+08:00为9/22，函件落款9/17。 | 该全首页仅一天间复读，不能证明周期稳定；旧快照仅有5/10 URL可精确比较，另5条与旧 representative-only 输出无法差分。正文有6篇被调的结果归因与原始材料见批次报告；未确认失败原因unknown，且 `ok`不等于逐字段完整；噪声、长周期freshness及HTTP预算未验。此前日期冲突是UTC日/URL路径误读。 |
| `pboc-open-market` | 首页20条逐日公告、URL唯一；9/29与9/30两份真实首页经同一parser比较，新第192号进入、旧第172号退出首页；隔离库该固定URL两轮 `1/1/0 → 1/0/0`。正文135字、1张表，7天期和0亿元两列与原文吻合；公告没有利率字段，正文也没有补写利率。`extractArticleBody`返回`skipped`，因为collector已保存 `ok` 正文。 | 这是一个跨日样本，不是长期周期稳定性；其他首页19项正文、分页、未来更新频率仍未核。运行后留下1个 `content.analyze` `created/retry0` job；`analyses` 表0行，receipts/models为0且未启动worker，不能把队列误报为已分析。执行脚本末尾错误断言将job数误当analysis行数导致非零退出，报告已独立SQL分清并记录，未重跑。 |
| `mof-treasury-debt-data` | 首页10项及第2页10项被检查；精确候选结构可解析。隔离库两轮 `10/10/0 → 10/0/0`；30篇批次本源正文均 `ok`（按SOURCE_MATRIX该源10/10），代表正文1,021字。列表最新日2026-09-24，详情标题/PubDate匹配。 | 首页第2页最新日回溯到2025年10月且混有PDF、中央收支统计；collector仅请求首页，未核定这些栏目交叉内容/历史噪声风险。完整多页重复率、周期更新和候选窗口无漏项能力未验证。 |
| `xiamen-csrc-regulatory-work` | 官方JSON API page1 20项、page2 20项且URL无重叠；列表 `publishedTimeStr=2026-09-15 12:43:00` 与 epoch 和正文可见9/15一致。固定样本两轮 API 每轮 `found=20`、精确allowlist仅写1条；正文 `ok`、1,157字。当前配置按 `+08:00` 读取该列表字符串。 | 详情 `PubDate` 与页面生成元数据均为09-23，语义未知；当前配置未读取 `PubDate`，不构成已证实的映射错误。总量399项、只抽page1/page2；未测深页、轮询漏项风险、全量重复/噪声。 |
| `mof-regional-supervision-dynamics` | 完整配置首页8项，两轮 `8/8/8/0 → 8/8/0/0`；8篇正文 `ok/rev2`。既有分页快照首页/相邻历史页8/7项、URL重复0、历史正文1,832字。 | 仅首页collector、网页声明20页；中央选登不是35局全量。批次与厦门候选身份无重叠，因此运行时跨源去重unknown；长周期/深页未验。预定28 hop上限未证，至少25次guardedFetch、实际redirect hop unknown，不能预算PASS。 |
| `mof-xiamen-supervision-dynamics` | 厦门局工作动态完整首页10项，collector两轮 `10/10/10/0 → 10/10/0/0`；10篇正文均`ok/rev2`。固定普惠金融URL正文1,935字；相邻历史页10项、历史业务稿1,979字。 | 网页声明10页，本批只抓首页、旧快照只看相邻页；5篇本批正文短（223–379字）须逐篇复核，10篇正文未载明确发布日期。长周期更新、深页重复及栏目噪声未核；无跨源overlap所以collector dedupe unknown；HTTP上限28 hop未证，实际redirect hop unknown。不能外推其他34局。详见 `P3_REGIONAL_BATCH_2026-09-30.md`。 |

所有12项当前配置行都保留为 disabled，且两项全文发布许可为 false。逐项更完整的旧证据见 `SOURCE_MATRIX.md`、`P3_INGEST_VALIDATION.md`、`P3_LOCAL_SOURCE_VALIDATION.md`、`P3_REMAINING_SOURCE_VALIDATION.md`、`P3_OMO_VALIDATION.md`、`P3_REGIONAL_COLLECTOR_VALIDATION.md`、`P3_REGIONAL_BODY_VALIDATION.md` 与 `P3_XIAMEN_DEBT_PDF_VALIDATION.md`。不将同源某篇成功正文外推为该来源整体通过。

## 日期与首页覆盖补充（2026-09-30）

[P3_DATE_COVERAGE_AUDIT.md](P3_DATE_COVERAGE_AUDIT.md) 离线复核保存快照及当前代码，未新增官方请求。会计司列表原始 `span`、详情 `PubDate` 和正文发布日期均为 9/22，parser UTC `2026-09-21T16:00Z` 换回 +08:00 也是 9/22；旧“列表9/21”是UTC日期切片或URL路径误读。厦门证监 API 时间和可见正文日期均为9/15，配置映射未改变；详情 `PubDate` / 页面生成时间为9/23但业务语义未知。预算司首页快照10项，2026-03-26至2023-07-24，首次导入近12个月/最多30条代码条件只留1条候选。该单次快照不说明发布率、跨周期更新或自动采集结果。日期纠正不能解除 Gate 2。

## 关键反证与环境边界

- `xiamen-finance-debt` 已实证一般 Readability 门槛可收进页尾噪声；修正配置只让特定正文选择 fail-closed，尚未取得债券结果正文。
- `fujian-finance-notices` 固定HTML正文成功但主题是会计领证服务信息，领域价值不足；扫描PDF业务样本仍无文本层。
- 会计司此前的列表/详情日期冲突已由原始列表 span 与 +08:00 parser 复核纠正；厦门证监局 `publishedTimeStr` 与正文可见日期同为9/15，详情 `PubDate`/生成时间同为9/23但业务语义未知。日期报告见 `P3_DATE_COVERAGE_AUDIT.md`；这项澄清不等于跨周期 freshness 验收。
- `pboc-open-market` 有一次9/29→9/30真实更新和新固定URL双轮幂等证据；该次脚本末尾误断言失败已由SQL说明是 `content.analyze` 队列任务数1与 `analyses` 表0行的字段混淆。存在任务不等于模型分析已运行。
- 区域来源隔离验证仅有两篇精确URL。已保存 machine JSON 与 HTML 列表快照可复核状态、哈希、两轮计数、正文hash/长度/首尾样本与DB行；body报告指出没有保存正文详情原始HTML响应。报告口径为之前9次列表/详情请求（其中1次仅人工计数，历史hop无法还原）加本轮实测2个GET hop；不可把21预算上限写成实际请求数。
- 本地校验、Ubuntu CI与实际生产NAS/真实附件运行是不同证据。已通过的 CI tested SHA 为 `8e845812b6ce1db45821ade7b2162a90f589e1de`，测试通用Linux路径，不解析真实PDF；它不是当前文档HEAD，也不代表NAS验收。
- `source.enabled=false` 不会隔离已有 processing jobs。`body_status=unconfirmed` 仍可排队分析，已为`ok`的文章再次调用extractor会被跳过；已知假阳性不能靠重调提取器修复。当前`MODEL_CALLS_ENABLED=false`且无worker，因此仍安全。P4须在Gate2通过后使用全新独立pilot库，只导入逐条核实的article ID/revision/content hash和正文验收结果，禁止用含P3遗留jobs的库启动泛worker/sweeper/requeue。区域隔离库的两个`content.extract-body` jobs、OMO库的一个`content.analyze` job均未消费。
- 预览运行的API/Web不是worker；预览恢复状态和只读SQL核查记录在`STATUS.md`与阶段检查点。

## 送正式 Sol Gate 2 Review 前最小工作包（3–5项）

1. 两批完整配置证据现已落盘：[核心两源批次](P3_CORE_BATCH_2026-09-30.md)、[区域两源批次](P3_REGIONAL_BATCH_2026-09-30.md)。会计司 `10/10/10/0→10/10/0/0`；预算司 `10/1/1/0→10/10/9/0`，第二轮实际补入9篇旧文。20篇库样本的正文 helper调用12次：6 `ok`、6 `unconfirmed`、8 `pending`；六个失败原因unknown，另有20个未消费 extraction jobs。区域两源18/18正文 `ok/rev2`，第二轮均0新增。两报告各自 HTTP hop 计数 hook 未命中，计数预算均不能判定通过；区域至少25次guardedFetch且跳转hop未知，核心批次实际hop总数unknown。区域只有相邻页快照；OMO报告证实9/29→9/30第192号进入、旧第172号退出的单次跨日变化，并说明队列job=1、analyses表=0和脚本非零退出原因。上述都不能外推长期稳定性。
2. 按S1要求补首页覆盖窗口证据：逐源记录首页实际容量、最旧候选日期/排序、正常新增速度和突发批量发布、轮询间隔、失败退避/最长中断、初始导入上限及可能滑出窗口的文章；以有界快照说明持续新增是否会漏项。
3. 离线工具 `scripts/fiscal/p3-http-budget.ts` 已锚定后端实际 Undici 8.11.2，以 Agent/ProxyAgent dispatch admission 计数并在第 N+1 次进入原 dispatch 前拒绝；5项 localhost 测试覆盖跳转上限、代理委派、错误响应与卸载恢复。该工具只覆盖精确后端 Undici 实例的 dispatch 边界，不是 OS 全局网络预算；global fetch/其他 Undici 副本/worker/私网旁路及 proxy CONNECT 内部仍不在计数范围。本地工具验证不追认两轮批次的历史网络计数，既有核心 hop总数仍unknown、区域仍至少25次 guardedFetch且总hop未知。后续由 Lead 决定是否另开新的有界联网预算；确认计数方案符合具体来源路径后，再对核心来源补跨周期有界复读与DB前后比较，核不同日期/新条目、URL重复、正文状态、日期语义及候选窗口；固定URL第二轮判重不算跨周期稳定性。
4. 为问题正文与来源元数据形成处置结论或保留阻塞：至少厦门专项债结果缺文、福建扫描附件及领证噪声；保留厦门证监生成元数据语义未知。厦门与福建 PDF 的人工字段已双人核对，但机器正文仍未通过。Lead明确核心财政公告需要持续自动获取；限定 OCR PoC 已按 S1 发出两次官方请求：commit定位成功，固定版本 `chi_sim.traineddata`虽响应HTTP 200但未在30秒内完整接收；遵照不重试边界停止，没有许可证文件、OCR或gold结果，完整记录见 [P3_SCAN_OCR_POC_RESULT.md](P3_SCAN_OCR_POC_RESULT.md)。若继续，须Lead另行有限授权；不付费调用、不安装 NAS、不接入业务处理job、不变更 Gate 2 通用条件。会计司日期差异已确认是UTC日/URL路径误读，厦门证监API与可见正文日期一致。不能隐去问题样本或缩减核心源来绕过验收。重要材料计划送pilot前必须逐样本核实正文完整。
5. 证据齐备后由GPT-6.1 Sol安排正式Gate 2 Review。reviewer须能查到原始数据、失败样本、分支/代码SHA与安全开关；正式结论前保持`NOT_PASSED`，不得打开模型/规模采集。

## 下批 Agent 文件所有权与风险

区域分页、区域全首页、会计司/预算司全首页及OMO freshness报告均已交付，分别见相应 `P3_*` 文件。原 S1 依赖裁决没有批准泛 OCR、分页或管线实现，也无需将 NAS/Linux 整体前置；新的限定扫描 S1 已批准一次固定五张图的本机 OCR PoC及最多三次官方语言文件请求。本次官方语言文件响应未在限时内完成，遵照不重试边界停止，OCR和gold比对`NOT_RUN`；resource-monitor路径未通过fake-child验证，CLI默认`OCR_RUN_ENABLED=false`。详见 [P3_SCAN_OCR_POC_RESULT.md](P3_SCAN_OCR_POC_RESULT.md) 和独立gold报告；不得扩展为通用 OCR、业务处理job、NAS安装或 Gate 2 前置。HTTP hop 本机计数 helper 已实现并通过5项 localhost tests，仍需由 Lead 决定后续真实来源预算运行；helper 的实例/dispatch边界与两个历史批次budget unknown均须保留。

## Git 与修订

起始分支 `feat/fiscal-finance-hot`，原审计时 HEAD `21cd590`；本次共享质量文档更新前当前HEAD `d9b2433b9f032cdab7cccd07b549df7fb07ebb18`。来源配置代码 SHA `0ec0704c0e60a88d84bc99d558eb569c56731c79`，阶段原始基线 `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。本次只改文档、未重跑代码CI；最后一次HEAD和未提交状态见追加交接记录。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：审计12个配置源的 P3/Gate 2 证据就绪度并建立可接续记录。

**MODEL**：gpt-6-luna / high。

**FILES_CHANGED**：新增本文；阶段负责人另更新 `STATUS.md`、`SOURCE_MATRIX.md` 和 `HANDOFFS/P3_CHECKPOINT_2026-09-30.md`，引用独立执行报告和S1范围裁决。

**TESTS_RUN**：只读检查任务书、计划、验收矩阵、来源配置、P3/S1报告、Git历史/状态与ignored机器材料；没有重抓来源或重跑全量测试。按Lead授权恢复既有preview PostgreSQL/API/Web；SQL与HTTP只读核对及smoke 30/30通过；没有启动worker。

**RESULT**：12个来源均保持 disabled/fulltext=false。单篇幂等与正文成功证据已与整个栏目稳定性分开；发现正文假阳性、领域噪声、附件机器正文缺口和分页/freshness证据空白。后续日期审计已纠正会计司UTC日误读，厘清厦门证监API可见日与生成元数据的边界；Gate 2 尚不适合正式通过审查。

**RISKS**：部分历史抓取只存摘要而无详情原始HTML/逐跳日志；没有长周期运行数据；首页窗口漏项和跨周期重复风险还无法定量。source disabled并不阻挡已排队processing job，只因当前model flag false且没有应用worker才安全。

**BLOCKERS**：区域分页证据只覆盖相邻两页和各一篇历史正文；OMO仅有一个跨日样本；仍缺更长周期验证及已知失败样本的处理裁定。会计司日期切日误读已更正；厦门证监局生成元数据语义仍未知，但当前映射依据有原文和API字符串支持。

**NEXT**：先补齐P3首页覆盖/跨周期证据并处理正文负例，再安排正式Sol Gate 2 Review；通过后另建P4独立pilot库并固定article ID/revision/hash。

## 2026-09-30 后续证据与交接修订

- 新证据：[P3_DATE_COVERAGE_AUDIT.md](P3_DATE_COVERAGE_AUDIT.md)、[P3_CORE_BODY_RESOLUTION.md](P3_CORE_BODY_RESOLUTION.md)、[P3_FUJIAN_TRANSCRIPTION_REVIEW.md](P3_FUJIAN_TRANSCRIPTION_REVIEW.md)、[P3_XIAMEN_MANUAL_REVIEW.md](P3_XIAMEN_MANUAL_REVIEW.md)。会计司原列表/详情日期差异为UTC日或URL路径误读；厦门证监的列表API与正文日一致，9/23生成时间语义仍未知。预算司首页一次快照10项，日期2026-03-26至2023-07-24，代码默认首次导入近12个月在此快照只剩1项的说法是条件推算，不是collector实测。
- Lead裁定接受福建23行/四页与厦门一页逐字段双Luna复核为 `P3 manual_sample_evidence=ACCEPTED`。该范围只认可带来源、hash、页数/转录及独立复核的人工样本事实；不认可机器 `body_status=ok`、来源验收、Gate 2、P4导入/模型/publication。厦门原严格解析 `pdf_page_no_text` 与旧205字Readability假阳性、福建机器文本层空白和 `unconfirmed` 均保留。
- 中央新增厦门条目与当前厦门首页 exact URL、host/path、标题三种比较均无匹配；其详情未请求，也没有跨源collector去重实测。单项无匹配是有限快照观察，不支持重复，也不证明跨源去重行为。
- 本轮最新质量核对 Git 基线 HEAD 为 `d9b2433b9f032cdab7cccd07b549df7fb07ebb18`；工作树待提交，仅文档变更。CI仍引用成功 workflow run 36647432023 / tested SHA `8e845812b6ce1db45821ade7b2162a90f589e1de`，不是此HEAD。此次 docs-only 未重跑 typecheck、npm test 或 web build；恢复既有 loopback preview 后 `node scripts/smoke.ts --base http://127.0.0.1:3000` 30/30通过，未启动应用worker。

## 2026-10-02 五源首页与本地预览增量质量证据

来源细节和 ignored 原始材料索引见 [P3_SOURCE_CHECKPOINT_2026-10-02.md](P3_SOURCE_CHECKPOINT_2026-10-02.md)。五个官方首页各一次GET、会计司两个失败详情各一次GET；7次真实请求均HTTP200且无redirect，backend Undici 8.11.2 dispatch hard cap=12，7/12使用、拒绝0，request create/sendHeaders/headers事件完整。列表由项目 `fromHtml()` 解析，不是 collector 写库。预算司旧快照10/10重合但首页最旧日期2023-07-24；会计司当前10项对9/30 accepted集合9/10、对9/29 parser样本5/5重合，而9/30原始HTML缺失，不能推断其余候选是新增发布；中央监管局选登8项，较9/30快照增3退3；厦门监管局与两份相邻首页均10/10重合；OMO对9/29新增第192号并退出9/3第173号。上述为有限快照差分，不建立长期覆盖或周期稳定。

两条会计司详情均HTTP200且title/date符合列表：一条当前 `.TRS_Editor` 仅24字并提供XLSX，另一条有323字和2-row table但未过现行抽取门槛；未请求附件、未运行正文helper、未写数据库状态。中央汇总厦门稿与厦门自身首页当前候选无exact URL交集，但没有实际运行时去重结论。此前两个全首页批次的历史HTTP预算仍分别unknown；本次小规模dispatch观测不追认旧批次。

预览以现有 `fiscalhot_preview_test` 恢复：35 migrations、3篇固定人工样本 `body_status=none/revision=1`，3条publication `score=NULL/selected=false/eligible=true`，分析、回执、job_runs为0；3 sources disabled、全文开关关闭。loopback PostgreSQL/API/Web为5432/3001/3000；health、`/`、`/all`、pool API 200，页面 `noindex, nofollow`。smoke本轮实际输出29项通过；先前交接记录30/30，差异原因未核实。没有应用worker，API进程的配置显式关闭采集、模型、Jina、IndexNow、Feishu和私网开关。此仅为展示预览，不影响Gate判断。

扫描PoC 9/30旧失败事实保留：30秒请求中断、实际流字节数未记、未取LICENSE；不是新批次的结果。正式新S1 [P3范围裁定](S1_P3_OCT02_SCOPE_REVIEW.md)批准复用immutable commit、固定官方模型/许可证URL各一次、redirect0/no retry、每请求120秒/全批240秒及32MiB/1MiB界限。Lead核销后A于10/2执行一次新目录准备，只发出模型URL一个HTTP请求：status 200、Content-Length 2,469,156，实际仅收到16,384 bytes，70.7秒后 `TypeError: terminated`，未到120秒deadline且`eofComplete=false`；无hash，LICENSE请求未发出。停止无retry；新manifest标 `incomplete/runnable=false`，未写模型，OCR未运行。ignored机器记录 `.data/fiscal-qa/scan-ocr-poc-20261002/prepare-failure.json`，旧9/30目录未覆盖。数据准备与OCR运行是两项授权；fake-child 17项通过只核销部分执行故障行为，Lead未核销长时间monitor cadence或解除run lock。

S1后续 [会计司正文selector报告](P3_ACCOUNTING_BODY_FIX_2026-10-02.md)的6/6 focused tests证明union候选保留三个缓存正例、拒绝题名+附件，但错收短多段通知及装饰表格；较收窄CSS仍错收装饰表。行业source配置未改。Fresh全套回归：`npm run typecheck`通过；`fiscalhot_oct02_full_test` fresh 35 migrations、`npm test`184/184通过（测试本地provider stubs）；Web build通过、web tests 15/15；loopback services恢复后的smoke 29项全过。Gate 2仍 `NOT_PASSED`，12源全部关闭。

## 2026-10-03 原10/2交付回归与远端CI状态

独立复核基线是已提交代码SHA `26ca72f2b94d37383072c0e54be6f94682b0e9bd`。`npm run typecheck`通过；新隔离 `fiscalhot_oct03_verify_test` 空库迁移35项；`npm test` 184/184、Web build和Web tests 15/15通过。运行记录保存在ignored `.data/test-pg/`，来源快照与失败正文状态没有数据库写入。会计正文fixture中union误收短多段与装饰表，严格CSS仍误收装饰表，故未修改 `industry/sources.json`。OCR process 17项验证亦通过，但只覆盖报告所列fake-child路径；未运行Tesseract，训练文件准备仍是不完整manifest，run lock关闭。

预览只读核实三条人工样本和publication状态未变，12源仍禁用，未启动worker。10/2既有smoke记录29项全过；本次10/3当前脚本输出30项全过，差异原因unknown，不把本次计数覆盖为旧批次结果。GitHub Check run [37077418870](https://github.com/revercgy-hub/MYHOT/actions/runs/37077418870) 经 `workflow_dispatch` 对指定repository `revercgy-hub/MYHOT` 和feature branch运行；其tested SHA为 `26ca72f2b94d37383072c0e54be6f94682b0e9bd`。最终run结论为failure：Docker job成功，check job其余install/typecheck/Web build/tests/migration/seed/smoke步骤成功，backend tests 183/184。唯一失败是Windows-only真实monitor测试在Ubuntu找不到`powershell.exe`（ENOENT）；本地Windows `npm test`仍为184/184。该SHA不能标成CI通过，修复由OCR代码owner接手。

这些回归只说明原10/2代码范围和测试库，不增加来源周期/页面覆盖，不变更source/body状态，也不满足Gate 2退出条件。Gate 2继续 `NOT_PASSED`。

## 2026-10-03 新S1增量（不改变Gate结论）

10/3 S1离线实现、review与有限实测见 [新P3检查点](HANDOFFS/P3_CHECKPOINT_2026-10-03.md)、[S1裁定](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md)、[正文policy结果](P3_ACCOUNTING_BODY_POLICY_2026-10-03.md)和[OCR准备结果](P3_OCR_API_PREPARE_2026-10-03.md)。新代码SHA `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651` 的fresh Windows全套回归通过（35 migrations、typecheck、211/211 backend、Web build、15/15 Web tests、30/30 smoke）；指定仓库CI run [37078956435](https://github.com/revercgy-hub/MYHOT/actions/runs/37078956435) 对同一SHA的Docker/check jobs均success。CI成功仅验证软件构建与测试，不增加P3来源覆盖样本。

正文policy离线短表/长段负例和调用门控测试通过，精确会计司配置已核销，但本轮获准的唯一详情抽取结果为HTTP 200、单dispatch，最终`unconfirmed`且无正文/hash。helper decline reason因runner未留存为unknown；未重试，不能将离线9/9当成真实来源通过。OCR固定commit三请求准备成功并验证模型/LICENSE身份；`OCR_RUN_ENABLED=false`、无run.json、没有OCR/gold输出。准备成功不改变Gate2正文要求或执行授权。

因此Gate 2继续 `NOT_PASSED`。12个生产source均保持disabled/fulltext关闭；旧批次hop预算unknown、长周期/首页滑窗/噪声缺口和机器正文失败均保留。下一步先通过localhost fixture验证runner能安全持久化structured helper failure reason；不重跑本次URL。若后来要补一次真实详情诊断，需单独核销请求范围。不得用feature CI成功或训练文件完整状态绕过来源退出条件。

## 2026-10-03 本机诊断与单篇受限观察

抽取拒绝reason observer与其2/2 focused fixture结果见 [P3_EXTRACT_DIAGNOSTICS_2026-10-03.md](P3_EXTRACT_DIAGNOSTICS_2026-10-03.md)。Root随后另行核销并完成会计司保存列表中2026-07-14候选的一次direct extract；精确URL、列表身份与逐源12项优先级见 [P3_GATE2_NEXT_BATCH_2026-10-03.md](P3_GATE2_NEXT_BATCH_2026-10-03.md)。新隔离库35 migrations、source disabled/fulltext关闭；Undici 8.11.2 hard cap=1，attempted/dispatched/rejected=1/1/0，HTTP 200，create/sendHeaders/headers各一次，最终body `unconfirmed`、revision=1、正文/hash为空、analysis/publication/receipt/job_runs均0。结构化helper reason为`attachments_unprocessed`，只表明该响应被helper的PDF样式链接保护检查拒绝；原始HTML未留存，实际文件类型及其与业务正文的关联unknown，且此拒绝先于身份、表格与长度核验。无附件请求、重试、collector、worker、模型或OCR。历史9/4详情的reason仍unknown，不重跑；不声称本URL是首次访问或新增来源覆盖。

新代码SHA `e7fac2b23b3e0baa375f273a97edbdf8c1c37584` 的GitHub Check run [37088146532](https://github.com/revercgy-hub/MYHOT/actions/runs/37088146532) 全绿（backend tests 213项、212通过、0失败、1个Windows-only monitor跳过）。本机fresh回归通过35 migrations、typecheck、npm test、Web build、15/15 Web tests及30项smoke；preview DB在恢复服务前后只读状态一致，worker未运行。证据/服务/安全开关细节见 [P3_DIAGNOSTIC_CHECKPOINT_2026-10-03.md](HANDOFFS/P3_DIAGNOSTIC_CHECKPOINT_2026-10-03.md)。

Gate 2继续`NOT_PASSED`。single-URL拒绝reason不证明该页面正文可接受，也不概括其他文章；测试和CI不增加来源覆盖。下一步可在localhost fixture定性无关PDF样式链接的保守误拒风险，若需修改通用guard须另经S1；其余工作优先补可读正文、核心负例、首页窗口及跨周期证据。下一批源级排序与最小验收见上述报告，不重复整张12源矩阵；所有生产source保持disabled/fulltext关闭。

## 2026-10-03 附件scope与短正文QA增量

按 [S1范围裁定](S1_P3_ATTACHMENT_SCOPE_REVIEW_2026-10-03.md) 实现可选、fail-closed的HTML附件祖先scope；focused 34/34、fresh Windows完整回归与同SHA CI通过，证据见 [实现报告](P3_ATTACHMENT_SCOPE_IMPLEMENTATION_2026-10-03.md) 和 [正文质量检查点](HANDOFFS/P3_BODY_QUALITY_CHECKPOINT_2026-10-03.md)。Root核销的单次July14 DOM观察显示两个PDF样式href位于正文外的业务附件区，scope外导航/页脚无PDF；本页的`attachments_unprocessed`应保留。未请求附件，实际MIME/文件内容unknown。行业source scope未获核销，`industry/sources.json`未改。

区域固定五篇短正文只读复核为2项有最小业务证据、3项人工拒绝；2篇详情日期unknown；同批224/259/296字三条未纳入该五篇，不能将五篇当作全部短文。既有五篇报告说明了判定及边界。此结果补充质量证据，不证明全源正文稳定或长周期覆盖。Gate 2继续`NOT_PASSED`，所有生产source仍disabled/fulltext关闭。

代码SHA `8b1c4446a1c3131034a4d9b7c5ed482a92b80166` 经GitHub run [37093486152](https://github.com/revercgy-hub/MYHOT/actions/runs/37093486152) 全绿：backend 222项（221 pass、1 Windows-only skip），Web tests 15/15；fresh本机回归见检查点。代码SHA与docs-only最终HEAD分开记录。
