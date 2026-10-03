# Gate 2 action checklist

**基线**：工作区HEAD `f7cd0f2`；Gate 1已通过，Gate 2=`NOT_PASSED`；12个source config仍禁用，全文发布关闭。本文把现行计划书、Gate 2 readiness审计和已有P3证据改写为可执行核对项；不增加或重定义Gate条件，不宣称任一source已整体通过。正式结论仍由授权的Gate 2审查作出。

## 六项核对

“完成标准”只说明已有Gate 2/P3问题有可审证据结清，不代表Gate 2自动通过。旧批次的unknown照实保留；不能追认历史hop计数，但未来一批经验证的新范围证据可以满足后续预算审查，不把旧unknown设为永久阻塞。

| 维度 | 现有证据 | 缺口 | 下一具体动作 | 完结标准 | 责任 |
|---|---|---|---|---|---|
| G2-A1 来源与候选身份 | **现状：部分。** `industry/sources.json`有12个官方配置；列表配置含source id、首页URL、selector、日期映射与URL前缀；12源均disabled、全文关闭。`P3_GATE2_READINESS.md`与`SOURCE_MATRIX.md`逐源记录已有解析结果。 | 个别分页/候选、详情标题/日期/发布主体、allow-prefix边界尚未逐源闭环；厦门证监局详情`PubDate`/生成时间语义仍unknown。配置存在不能代替实时字段对照。 | 按当前已验证配置离线审查保存候选；对尚缺的关键source，单次详情观察只从保存列表取确切URL，不猜selector，不请求附件。仅对会影响当前使用的日期字段核语义。 | 每个纳入本Gate范围的source都有官方入口身份、列表标题/日期/URL、详情身份与日期对照；URL落在允许范围内；元数据语义不明者不被误用且有记录。 | 工程；使用范围由用户决定（见决定1）。 |
| G2-A2 首页窗口与栏目/历史候选 | **现状：未结。** 会计司、预算司、财政部监管汇总、厦门监管动态已有完整首页隔离批次；多个其他源已存首页/相邻历史页快照。当前配置一轮只读`config.url`；任务书要求评估列表发现与分页/导航，不要求全历史接入或通用分页。 | 一天内双轮/一两个相邻日快照不能说明正常发布速度、突发批量发布、停机时长与首页容量是否会让候选滑出；会计司和预算司列表窗口跨度、区域汇总边界不同。初次导入需要多长历史未由用户确认。 | 先把保存快照时间、实际候选数/最旧日期/顺序与配置poll interval并排；再为有漏窗风险的优先源形成至少两个时间分开的只读观察，记录新增/退出及间断，不为了“扫全历史”加页。新增观察需单独核销。 | 能用观测与配置说明正常/突发更新和合理中断时首页候选是否可能在成功轮询间滑出；若无法证明，明确继续受限而不假称覆盖。超出首页的历史深度只按用户确认范围记录。 | 工程；栏目覆盖与首次历史跨度需用户确认（决定1、5）。 |
| G2-A3 新鲜度、失败恢复与轮询稳定性 | **现状：未结。** 配置常规source多为120分钟，两条监管局动态为360分钟；OMO有一次9/29→9/30第192号进入/旧项退出证据；会计/预算与区域有界批次可复核。 | 尚无覆盖多个常规间隔/失败中断/突发发布的证据；一次跨日变化或collector两轮幂等不等于长期freshness、失败退避可恢复或漏项率可接受。用户期望时延未确认。 | 在预算工具本地验证通过的前提下，对优先source做时间分散的列表快照；记录服务发布时间、观测时间、poll interval、候选进入/退出、请求失败和恢复/退避。先按Root核销的小窗口提案实施。 | 实际观测跨度能够对照配置轮询与用户接受时延；失败后恢复行为可复核，未观察到无法解释的滑窗丢失；如果覆盖证据仍不足，行状态保留blocked/unknown。 | 工程与Lead；可接受发布时延/故障容忍需用户确认（决定4）。 |
| G2-A4 日期、一致性、去重与幂等 | **现状：部分。** 既有精确URL双轮证明若干固定文章幂等；会计司9/22 UTC切日误读已纠正；厦门证监API发布时间字符串和正文可见日均9/15；监管汇总与厦门当前候选无exact URL交集。 | 精确URL双轮不证明跨源相同事件去重；没有交集也不能证明去重；区域批次identity overlap为0、runtime dedupe unknown；日期元数据未知须保持unknown。 | 复用保存候选离线比较canonical URL/identity；在新快照出现重合时才检查真实入库dedupe；对固定样本核列表日、详情可见日和业务字段，不借URL路径推断日期。 | 重复/修订同一来源的行为有可审ID与revision证据；日期采用明确语义；跨源去重只在实际重叠样本测试后作结论，零重叠写unknown。 | 工程。 |
| G2-A5 正文可用性、领域事实与边界噪声 | **现状：未结。** 多源固定正文和12源核心/区域样本已存状态、长度/hash及部分正文证据；厦门债205字假阳性、福建会计领证噪声、厦门监管五篇短正文、7/15会计司`attachments_unprocessed`均有单独记录。正文“ok”不等于逐字段完整。 | 核心债券招标结果机器正文未得；福建扫描附件不支持机器正文；会计司批次失败原因须按source分布记录；其他业务正文和“会议/培训/领证/地方调研”边界未形成用户确认规则。短文长度不能代表新闻价值。 | 离线先收束已保存的负例与可读正例；对文章逐项核标题/日期/主体/财政业务动作、关键金额/表格、导航污染。附件不能处理时明确状态并排除其正文主张，不把人工转录写成机器通过；新正文URL须单独核销。 | 每个关键source至少有可人工对照的标题、日期和正文事实样本；确定假阳性不再作为有效正文，失败样本有可复核的fail-closed状态；哪些业务/会议/地方实践算产品内容由用户确认。 | 工程；内容边界/不支持附件的产品处理需用户确认（决定2、3）。 |
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

**BLOCKERS**：部分来源仍缺足够时间跨度、正文或边界证据；产品内容范围和初次历史窗口等待用户逐项确认。

**NEXT**：先等待Root已发出的决定1；不要把未答决策记成确认。之后由Root按`GATE2_USER_DECISIONS.md`顺序逐项提问，其余能离线完成的source与证据整理可继续按本清单推进。QA核文档diff与引用后，由QA owner处理stage/commit。
