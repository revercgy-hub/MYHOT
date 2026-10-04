# Gate 2 action checklist

**基线**：项目BASE `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`；本轮基线 `ea5d3af0d8241772ea6fac0abcc26386d81c6d36`；S1代码SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0`；GitHub run 37163791233待定。Gate 1已通过，Gate 2=`NOT_PASSED`；12个source config仍禁用，全文发布关闭。本文把现行计划书、Gate 2 readiness审计和已有P3证据改写为可执行核对项；不增加或重定义Gate条件，不宣称任一source已整体通过。正式结论仍由授权的Gate 2审查作出。

## 六项核对

“完成标准”只说明已有Gate 2/P3问题有可审证据结清，不代表Gate 2自动通过。用户已确认首阶段逐一覆盖全国财政部地方监管局新闻动态栏目；中央选登只能补充，不算逐局覆盖。35个目录/域名仅是调查候选，逐局栏目、入口、正文质量和状态以[覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)逐项核实。旧批次的unknown照实保留；不能追认历史hop计数，但未来一批经验证的新范围证据可以满足后续预算审查，不把旧unknown设为永久阻塞。

| 维度 | 现有证据 | 缺口 | 下一具体动作 | 完结标准 | 责任 |
|---|---|---|---|---|---|
| G2-A1 来源与候选身份 | **现状：部分。** `industry/sources.json`有12个官方配置，均disabled且全文关闭。福建、北京、上海有2026-10-04单篇detail观察；天津、河北、山西、内蒙古、辽宁、吉林、黑龙江、山东有一次首页/栏目列表观察、无详情。三批报告和当前矩阵见[逐局矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)，三局配置兼容见[准备审阅](REGIONAL_BUREAU_BATCH1_CONFIG_READINESS_2026-10-04.md)。 | 北京列表日2026-09-24与详情`PubDate=2026-09-30`不一致，详情title省略列表title“财政部”前缀；另外两篇详情日匹配。第二/三批列表日与URL路径日期有差异，正文日期未核。单次静态观察不等于source验收。 | 新的下一项是为福建/北京/上海建立disabled source objects及saved-fixture测试；重点集成验证北京首次详情identity失败时metadata仍更新、后续extract按已存identity工作。只写disabled配置/纯fixture不等于运行通过；其他逐局按矩阵推进，任何新详情另行核销。 | 每个纳入本Gate范围的source都有可复核官方入口、列表标题/日期/URL、详情身份与日期语义；URL落在允许范围；元数据不明者不被误用并留有边界记录。 | 工程/QA；11局有有限页面观察，尚无建议的三局disabled配置与北京两阶段集成测试。 |
| G2-A2 首页窗口与栏目/历史候选 | **现状：未结。** 会计司、预算司、中央汇总、厦门动态有完整首页隔离批次；2026-10-04三批合计11局有限页面观察。福建/北京/上海各10个候选并有一篇详情；batch2/3另8局各见10条候选但无详情。 | 11局都仅单一时点与单页；未见明确分页不证明无历史页、正常/突发发布、故障恢复或首页容量风险。其余23局未有本轮独立栏目观察。用户确认首次历史回填90天；通用collector仍默认12个月。严格日期实现已通过本地fresh回归，但配置未导入DB/运行。 | 先用保存页面离线分析候选与日期；后续优先补三局disabled配置和北京detail→extract身份集成测试。需跨时点或深页证据时另行核销；不因列表候选声称90日已回填。 | 用有间隔观测说明首页容量、正常/突发更新、失败恢复与候选滑出风险；首次90天只有在配置应用并验证运行后才可计入，证据不足继续标blocked/unknown。 | 工程/QA；11局有限静态观察，跨周期/详情证据仍不足。 |
| G2-A3 新鲜度、失败恢复与轮询稳定性 | **现状：未结。** 用户确认上线目标为所有来源每日一次更新检查；行业JSON中现有12个source的`interval_minutes`已设1440，但全部仍disabled，数据库配置未导入，故未运行或验证daily schedule。OMO有一次9/29→9/30第192号进入/旧项退出证据；会计/预算与区域有界批次可复核。 | 尚无覆盖多个间隔/失败中断/突发发布的证据；一次跨日变化或collector两轮幂等不等于长期freshness、失败退避可恢复或漏项率可接受。具体时刻、失败重试/恢复策略以及是否满足时效仍unknown。 | 在日频source配置经单独应用、启用并授权后观察检查时间；记录服务发布时间、观测时间、轮询、候选进入/退出、请求失败和恢复/退避。当前不能据行业JSON配置宣称daily检查已运行；新增观察仍需Root核销。 | 实际观测能核对daily目标及首页滑窗/失败恢复行为；目前只有用户目标和disabled配置，没有实施运行或验证，不计为完成；失败后恢复行为可复核，未观察到无法解释的滑窗丢失；如果覆盖证据仍不足，行状态保留blocked/unknown。 | 工程与Lead；可接受发布时延/故障容忍需用户确认（决定4）。 |
| G2-A4 日期、一致性、去重与幂等 | **现状：部分。** 既有精确URL双轮证明若干固定文章幂等；会计司9/22 UTC切日误读已纠正；厦门证监API发布时间字符串和正文可见日均9/15；监管汇总与厦门当前候选无exact URL交集。 | 精确URL双轮不证明跨源相同事件去重；没有交集也不能证明去重；区域批次identity overlap为0、runtime dedupe unknown；日期元数据未知须保持unknown。 | 复用保存候选离线比较canonical URL/identity；在新快照出现重合时才检查真实入库dedupe；对固定样本核列表日、详情可见日和业务字段，不借URL路径推断日期。 | 重复/修订同一来源的行为有可审ID与revision证据；日期采用明确语义；跨源去重只在实际重叠样本测试后作结论，零重叠写unknown。 | 工程。 |
| G2-A5 正文可用性、领域事实与边界噪声 | **现状：未结。** 多源正文/领域内容仍有质量缺口；本地S1已实现附件诊断持久化、所有自动分析入口和publication/v1防漏，fresh suite 250/250。10/4三局单篇详情只提供静态body与身份/日期事实，不是业务价值评估。 | 核心债券招标结果机器正文未得；福建扫描附件机器正文未确认；会计司失败样本仍需reason分布核验；prompt无真实模型评测或硬过滤器。S1不含附件下载/OCR/解析，也未改区域source config；待解析不能写成正文ok或source通过。短文长度不能代表新闻价值。 | 下一项按内容规则建立三局disabled source fixture，覆盖北京detail metadata与两阶段extract身份；真实正文/附件仍需各自证据。不因S1软件测试通过而开启worker或模型。 | 失败样本有可复核fail-closed状态；附件不支持时保留URL/待解析且不得自动精选，完整可信提取后才恢复；人工/模型及机器状态不混淆；正负样本按确认规则复核。S1与软件回归均不代表Gate通过。 | 工程/QA；S1本地集成回归通过，Gate 2内容/源质量仍未闭环。 |
| G2-A6 有界执行与可复核账目 | **现状：部分。** 新`p3-http-budget.ts`对后端Undici 8.11.2的Agent/ProxyAgent dispatch admission设cap，并有5项localhost测试；历史两批实际hook未命中；source仍disabled、无生产采集。 | 两批历史真实hop为unknown，不能证明原预算，也不能重放追认；工具边界不覆盖OS全局请求、其他Undici实例、worker/旁路与代理CONNECT内部；不能把顶层函数次数写成GET/hop数。 | 每个新批准观察先离线验证具体请求路径确实被cap捕获；运行时把dispatch、请求事件、redirect、cap拒绝、HTTP状态、response hash和DB前后状态关联到同一范围；旧库队列绝不交泛worker。 | 新验收批次内被授权的网络范围有可验证硬上限/dispatch记录、失败与停止边界，且数据状态/安全开关可复查；历史unknown仍标unknown但不追认为本轮失败。 | 工程/QA；预算核销由Lead负责。 |

## 12个配置source的处理顺序

以下优先级沿用`P3_GATE2_NEXT_BATCH_2026-10-03.md`，仅标行动顺序，不改变source目标或门槛。详细已有证据和候选URL见该报告及`SOURCE_MATRIX.md`。

| 优先级 | source ID | 当前主要待结事项 |
|---|---|---|
| P0 | `mof-accounting-notices` | 10篇已尝试：5 ok、5 unconfirmed；另7/15正文0字/无hash，reason仅能说明附件保护拒绝；不重试旧9/4，不把附件样本评成正文。 |
| P0 | `xiamen-finance-debt` | 205字假阳性已经确认；不再拿该内容当正文。新一期需可读招标业务字段或记录当前附件能力不支持。 |
| P0 | `fujian-finance-notices` | 可读HTML中有领证噪声；关键现金管理扫描PDF机器状态仍unconfirmed，人工转录不等自动提取。 |
| P1 | `mof-budget-work` | 10篇中仅2篇尝试：1 ok、1 unconfirmed、8 pending；首页最新日期2026-03-26且含旧稿；需明确真实窗口/频率。 |
| P1 | `mof-regional-supervision-dynamics` | 完整首页与正文已有；中央选登不是35局全量，跨源去重/长期更新仍unknown。 |
| P1 | `mof-xiamen-supervision-dynamics` | 完整首页/正文已有；短文语义已抽审一部分；仍需按内容边界和时间窗口结项。 |
| P1 | `xiamen-csrc-regulatory-work` | 两页各20与一个正文样本已核；详情生成时间语义unknown，避免擅自解释。 |
| P2 | `pboc-xiamen-work` | 首页及第2页快照已查；其余首页正文、噪声及时间窗口可按风险后置。 |
| P2 | `mof-finance-notices` | 首页偏旧、HTML/PDF/RAR混合；优先现成可读HTML，PDF Linux集成留P7/Gate4。 |
| P2 | `mof-policy-release` | 有正文样本但综合栏目含非目标内容；离线核财政主题/彩票等分类，不急于加新详情请求。 |
| P2 | `mof-treasury-debt-data` | 当前债券统计正文已有；第2页混有PDF及中央收支统计，首页/历史边界和周期待说明。 |
| P2 | `pboc-open-market` | 一次跨日窗口更新已见；不消费遗留analyze job、不重抓第192号，需另时点才支持持续性判断。 |

## 明确后置项与记录修正

- Gate 2不以实现通用分页、遍历全部历史页、OCR、NAS RSS/内存验收或Linux真实PDF解析为通用前置；业务核心源若依赖不支持的附件，须按具体source清楚标记机器正文未验证/不支持。真实PDF Linux路径最迟P7/Gate 4验证；NAS在P8/P9验证。
- 12源的全部请求只作有界P3验证；Gate 2通过后P4也必须使用隔离新库，不能消费旧P3遗留jobs。
- 财政部监管局汇总只代表官网选登候选，35个域名allowlist也不等于35局动态完整覆盖；不得以该汇总或一条厦门独立源宣称“全国35局full coverage”。
- 历史完整首页批次的hop证据不可追认，但未来一批经审计且预算硬停验证的新范围证据可用于验收；不必永久阻塞。
- 文档交叉检查发现`P4_P7_EXECUTION_PLAN.md`把合计“6篇unconfirmed、8篇pending”容易读成预算司单源数字。已反馈最小精确修正：会计司 `5 ok / 5 unconfirmed / 0 pending`；预算司 `1 ok / 1 unconfirmed / 8 pending`。本任务不修改该文档。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：将已有Gate 2/P3要求按六个验收维度拆为缺口、动作、完结标准与责任，并列出逐项待用户决定的问题。

**MODEL**：Luna High；只读文档/配置，没有项目模型调用。

**FILES_CHANGED**：仅新增本文与`GATE2_USER_DECISIONS.md`；未改shared docs、代码、sources、数据库或Git index。

**TESTS_RUN**：只读查看`AGENTS.md`、`PROJECT_PLAN.md`、`STATUS.md`、`P3_GATE2_READINESS.md`、`P3_GATE2_NEXT_BATCH_2026-10-03.md`、`SOURCE_MATRIX.md`和`industry/sources.json`；离线字段核对文档当前source列表。无软件测试、联网或数据库操作。

**RESULT**：Gate 2仍`NOT_PASSED`。6项均已列现证据、缺口、下步动作、完结标准及责任；12源沿现有优先级列出待结事项。Gate门槛未改写，旧budget unknown未追认，也未设为永久阻塞。

**RISKS**：状态文档为历史累积记录，不同时点的样本批次必须带日期和source边界；汇总选登不等同35局全量；“正文ok”不等同业务价值或无噪声。

**BLOCKERS**：部分来源仍缺足够时间跨度、正文或边界证据；内容prompt已按规则更新但模型效果未验证；附件待解析/自动精选保护与严格首次日期范围已由S1批准实现范围、但A/B仍在实现/集成且QA未完成；daily与近90天目标仍只在disabled行业JSON，未导入数据库或运行；具体时刻/失败恢复unknown；35局仅3局有一批有限页面证据，仍未逐项核验。

**NEXT**：待A/B按已批准S1范围完成实现与集成，QA核验附件诊断marker、全部自动选中/公开投影保护、人工selected override、可信提取解除及近90天日期边界，然后执行fresh完整软件回归；同时按逐局矩阵分批推进余下新闻栏目观察。未核实栏目不计覆盖；source仍保持disabled，应用daily/90日配置另须正式执行与验证。
