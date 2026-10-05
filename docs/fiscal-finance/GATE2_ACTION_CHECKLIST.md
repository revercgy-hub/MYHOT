# Gate 2 action checklist

**基线与最近代码检查点**：项目BASE `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`；本轮基线 `c73473b386c9724ab9d14aded97df3bf2f8e7cd7`；S1代码SHA `dd3835460d4f6d180209acbe0a48e4b142ea7ac0` 的CI run 37163791233历史结果success。本轮代码SHA `a00795ea5911afaa2bdf4ac31580b29a9c84a33c` 的Check run [37281829324](https://github.com/revercgy-hub/MYHOT/actions/runs/37281829324) 已success。当前配置15个source，全部disabled且全文关闭。Gate 1已通过，Gate 2=`NOT_PASSED`。本清单不增加或重定义Gate条件，不宣称任一source已整体通过；正式结论仍由授权的Gate 2审查作出。

## 六项核对

“完成标准”只说明已有Gate 2/P3问题有可审证据结清，不代表Gate 2自动通过。用户已确认首阶段逐一覆盖全国财政部地方监管局新闻动态栏目；中央选登只能补充，不算逐局覆盖。35个目录/域名仅是调查候选，逐局栏目、入口、正文质量和状态以[覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)逐项核实。旧批次的unknown照实保留；不能追认历史hop计数，但未来一批经验证的新范围证据可以满足后续预算审查，不把旧unknown设为永久阻塞。

| 维度 | 现有证据 | 缺口 | 下一具体动作 | 完结标准 | 责任 |
|---|---|---|---|---|---|
| G2-A1 来源与候选身份 | **现状：部分。** `industry/sources.json`有15个配置，均disabled且全文关闭。2026-10-05新增三局配置和saved-fixture测试、北京两阶段collector/DB/queue/extract fixture集成通过；详见[配置报告](OCT05_BUREAU_CONFIG_IMPLEMENTATION.md)与[集成QA](OCT05_BUREAU_INTEGRATION_QA.md)。福建、北京、上海仍各只有一条真实详情观察；有限栏目的矩阵见[逐局覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。 | 北京列表日2026-09-24与详情`PubDate=2026-09-30`不一致，详情title省略列表title“财政部”前缀；福建/上海观测日期匹配。Fixture通过只证明保存响应下软件路径，不证明现在的页面或业务正文。batch2/3日期路径差异及batch4三局详情仍未知。 | 三局配置/测试工程任务已完成；下一步继续逐局真实页面/详情审查与证据补齐，严格区分页面观察、fixture集成和来源验收。任何后续真实请求仍需核销有界预算。 | 每个纳入本Gate范围的source都有可复核官方入口、列表标题/日期/URL、详情身份与日期语义；URL落在允许范围；元数据不明者不被误用并留有边界记录。 | QA/Lead；代码配置已完成，不代表source验收。 |
| G2-A2 首页窗口与栏目/历史候选 | **现状：未结。** 会计司、预算司、中央汇总、厦门动态有既有完整首页批次；区域矩阵已有14局目标新闻列表页快照（含福建/北京/上海、batch2/3八局、batch4江苏/安徽/江西），另厦门有既有有限配置/历史页证据。浙江额外观察到9项“图片新闻”列表，但目标动态栏目范围仍未确认。 | 单时点/单页不能证明分页、历史窗口、正常/突发更新、故障恢复或首页容量风险。2026-10-05福建/北京/上海同一列表快照相隔32小时22分10.133秒，3/3页面hash相同、每局10/10候选无变化；这只是两个观测点，不证明daily运行或稳定性。其余19局仍缺本批独立页面观察。三局的近90天首次范围在disabled config中，未导入数据库或运行。 | 三局配置和两阶段测试已完成；下一步根据逐局矩阵审查详情/业务日期，并对仍未知局按独立授权做有界调查。需要深页或更多时间点时另核销；不因候选列表称90日已经回填。 | 用有间隔观测说明首页容量、正常/突发更新、失败恢复与候选滑出风险；首次90天只有在配置应用并验证运行后才可计入，证据不足继续标blocked/unknown。 | QA/Lead；列表/窗口与跨周期证据仍不足。 |
| G2-A3 新鲜度、失败恢复与轮询稳定性 | **现状：未结。** 用户确认目标为所有来源每日一次更新检查；15个行业配置目标`interval_minutes=1440`，全部disabled且未导入数据库，因此schedule未运行/验证。OMO第192号曾有一次9/29→9/30进入/退出；本轮三局列表两时点短间隔hash无变化。 | 尚无覆盖多个间隔、失败中断、突发发布与恢复的证据；两次短间隔内容一致不等于长期freshness、失败退避可恢复或漏项率可接受。具体时刻、失败恢复策略和目标时效仍unknown。 | 仅在数据库配置应用、授权启用后观察daily检查时间、发布时间、轮询、候选进入/退出、请求失败与恢复/退避。当前不能据JSON配置宣称daily已运行。 | 实际观测能核对daily目标及首页滑窗/失败恢复行为；失败后恢复行为可复核，未观察到无法解释的滑窗丢失；证据不足继续标blocked/unknown。 | 工程与Lead；可接受发布时延/故障容忍需用户确认（决定4）。 |
| G2-A4 日期、一致性、去重与幂等 | **现状：部分。** 既有精确URL双轮证明若干固定文章幂等；会计司9/22 UTC切日误读已纠正；厦门证监API发布时间字符串和正文可见日均9/15；监管汇总与厦门当前候选无exact URL交集。 | 精确URL双轮不证明跨源相同事件去重；没有交集也不能证明去重；区域批次identity overlap为0、runtime dedupe unknown；日期元数据未知须保持unknown。 | 复用保存候选离线比较canonical URL/identity；在新快照出现重合时才检查真实入库dedupe；对固定样本核列表日、详情可见日和业务字段，不借URL路径推断日期。 | 重复/修订同一来源的行为有可审ID与revision证据；日期采用明确语义；跨源去重只在实际重叠样本测试后作结论，零重叠写unknown。 | 工程。 |
| G2-A5 正文可用性、领域事实与边界噪声 | **现状：未结。** S1附件诊断持久化、自动分析入口和publication/v1防漏已实现；本轮新三局saved fixtures使用合成正文，数据库fixture集成验证成功。真实来源正文业务质量仍需独立验收。 | 核心债券招标结果机器正文未得；福建扫描附件机器正文未确认；会计司失败样本reason分布、真实模型质量与硬过滤器尚未评估。Fixture不是现实正文质量证据；短文长度不能代表新闻价值。 | 三局配置/两阶段软件测试已完成。下一步按逐局矩阵补真实详情元数据和业务内容审查；附件/真实正文任何新请求按来源和预算单独核销。不因本轮软件测试绿而开启worker或模型。 | 失败样本有可复核fail-closed状态；附件不支持时保留URL/待解析且不得自动精选，完整可信提取后才恢复；人工/模型及机器状态不混淆；正负样本按确认规则复核。软件回归不代表Gate通过。 | 工程/QA；Gate 2内容/源质量仍未闭环。 |
| G2-A6 有界执行与可复核账目 | **现状：部分。** 新`p3-http-budget.ts`对后端Undici 8.11.2的Agent/ProxyAgent dispatch admission设cap，并有5项localhost测试；batch4及浙江target一次复查用该工具留下预算。 | 9/30历史hop仍unknown，不能证明原预算，也不能重放追认；工具边界不覆盖OS全局请求、其他Undici实例、worker/旁路与代理CONNECT内部；不能把顶层函数次数写成GET/hop数。 | 每个新批准观察先离线验证具体请求路径确实被cap捕获；运行时把dispatch、请求事件、redirect、cap拒绝、HTTP状态、response hash和DB前后状态关联到同一范围；旧库队列绝不交泛worker。 | 新验收批次内被授权的网络范围有可验证硬上限/dispatch记录、失败与停止边界，且数据状态/安全开关可复查；历史unknown仍标unknown但不追认为本轮失败。 | 工程/QA；预算核销由Lead负责。 |

## 原12个核心配置source的处理顺序

以下优先级沿用`P3_GATE2_NEXT_BATCH_2026-10-03.md`，仅标行动顺序，不改变source目标或门槛。它记录的是前一批12个核心配置source，不包括后续新增的regional disabled configs。详细已有证据和候选URL见该报告及`SOURCE_MATRIX.md`。

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

2026-10-05新增`mof-fujian-supervision-dynamics`、`mof-beijing-supervision-dynamics`、`mof-shanghai-supervision-dynamics`三条disabled配置，共同间隔1440分钟/严格首次90天日期要求。fixture和数据库集成测试已通过，真实来源仅有10/04保存响应和获批的三局10/05首页复查证据；均仍需真实来源日期/正文质量、分页/历史、跨周期验证。不能将software integration pass视为source pass。

## 明确后置项与记录修正

- Gate 2不以实现通用分页、遍历全部历史页、OCR、NAS RSS/内存验收或Linux真实PDF解析为通用前置；业务核心源若依赖不支持的附件，须按具体source清楚标记机器正文未验证/不支持。真实PDF Linux路径最迟P7/Gate 4验证；NAS在P8/P9验证。
- 所有source请求只作有界P3验证；Gate 2通过后P4也必须使用隔离新库，不能消费旧P3遗留jobs。
- 财政部监管局汇总只代表官网选登候选，35个域名allowlist也不等于35局动态完整覆盖；不得以该汇总或一条厦门独立源宣称“全国35局full coverage”。
- 历史完整首页批次的hop证据不可追认，但未来一批经审计且预算硬停验证的新范围证据可用于验收；不必永久阻塞。
- 文档交叉检查发现`P4_P7_EXECUTION_PLAN.md`把合计“6篇unconfirmed、8篇pending”容易读成预算司单源数字。已反馈最小精确修正：会计司 `5 ok / 5 unconfirmed / 0 pending`；预算司 `1 ok / 1 unconfirmed / 8 pending`。本任务不修改该文档。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：将已有Gate 2/P3要求按六个验收维度拆为缺口、动作、完结标准与责任，并列出逐项待用户决定的问题。

**MODEL**：Luna High；只读文档/配置，没有项目模型调用。

**FILES_CHANGED**：仅新增本文与`GATE2_USER_DECISIONS.md`；未改shared docs、代码、sources、数据库或Git index。

**TESTS_RUN**：只读查看`AGENTS.md`、`PROJECT_PLAN.md`、`STATUS.md`、`P3_GATE2_READINESS.md`、`P3_GATE2_NEXT_BATCH_2026-10-03.md`、`SOURCE_MATRIX.md`和`industry/sources.json`；离线字段核对文档当前source列表。无软件测试、联网或数据库操作。

**RESULT**：Gate 2仍`NOT_PASSED`。本清单六项核对已据2026-10-05最新配置、fixture测试与受限静态页面证据更新；原12个核心配置source顺序另保留，新增三局单列，旧budget unknown未追认，也未设为永久阻塞。

**RISKS**：状态文档为历史累积记录，不同时点的样本批次必须带日期和source边界；汇总选登不等同35局全量；“正文ok”不等同业务价值或无噪声。

**BLOCKERS**：部分来源仍缺足够时间跨度、正文或边界证据；内容prompt已按规则更新但模型效果未验证；附件能力不支持的样本仍未机器解析；15项daily/近90天行业JSON配置均disabled、未导入数据库或运行；具体时刻/失败恢复unknown；35局只有有限批次观察，尚未逐项完成来源核验。新增三局配置与软件测试已完成，不作为当前工程阻塞。Gate 2仍`NOT_PASSED`。

**NEXT**：按逐局矩阵继续有界审核尚缺栏目/详情/正文质量，并开展跨时点新鲜度、失败恢复和首页窗口证据；另在适当范围复核附件/正文质量与人工Gold。浙江“动态简讯”图片列表只能作为该页面的有限观察，不代表目标监管新闻全覆盖。保持所有source disabled；应用daily/90日配置、运行collector/worker或真实模型均需相应授权，不因本轮软件回归直接启动。
