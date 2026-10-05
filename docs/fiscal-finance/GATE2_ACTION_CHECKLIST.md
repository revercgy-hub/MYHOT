# Gate 2 action checklist

**基线与最近代码检查点**：项目BASE `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`；本轮恢复基线 `437c63e61f1e5b1b7a2053a600c787bff259ab4a`；最终combined代码SHA `b3546ab9c803b6872eb6b82d68fab8ca87da8520` 的Check run [37346160222](https://github.com/revercgy-hub/MYHOT/actions/runs/37346160222) success。当前配置19项（18 HTML、1 JSON），全部disabled、全文关闭；FJ strict-body flag只是处理保护且来源disabled。Gate 1已通过，Gate 2=`NOT_PASSED`。本清单不增加或重定义Gate条件，不宣称任一source已整体通过；正式结论仍由授权的Gate 2审查作出。

**2026-10-06恢复核验状态**：两项代码提交及最终CI已完成；本机fresh backend full 257/257，CI Linux backend 257/256/0/1（1项Windows-only skip）、Web15/15。S4针对性回归5/5；source-specific正文保护已实现。所有真实请求的时点按manifest UTC；逐局证据见[矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。

## 六项核对

“完成标准”只说明已有Gate 2/P3问题有可审证据结清，不代表Gate 2自动通过。用户已确认首阶段逐一覆盖全国财政部地方监管局新闻动态栏目；中央选登只能补充，不算逐局覆盖。35个目录/域名仅是调查候选，逐局栏目、入口、正文质量和状态以[覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)逐项核实。旧批次的unknown照实保留；不能追认历史hop计数，但未来一批经验证的新范围证据可以满足后续预算审查，不把旧unknown设为永久阻塞。

| 维度 | 现有证据 | 缺口 | 下一具体动作 | 完结标准 | 责任 |
|---|---|---|---|---|---|
| G2-A1 来源与候选身份 | **现状：部分。** 已提交19项配置（新增河南、湖北、湖南、广东四项disabled）。北京/FJ/SH隔离collector与各地详情有限样本仍有效；新增详情15次GET中14份raw/hash核实、青岛单次timeout。FJ诊断触发S4正文就绪保护，已完成测试和CI。 | 单篇和单页不能证明全栏目质量；北京首轮response hash仍unknown；上海repeat timeout partial；云南、新疆日期冲突未裁定。 | 按矩阵继续填补source范围、历史和跨周期证据。 | 官方入口、列表/详情身份、日期语义与正文边界均有逐source证据且配置allowlist正确。 | QA/Lead；本轮仅有限样本。 |
| G2-A2 首页窗口与栏目/历史候选 | **现状：未结。** 32局目标工作动态首屏；厦门有既有限定记录，浙江监管工作列表与首篇详情已见，甘肃主页超时无列表。Batch6四个第二页样本各10项、无首页重叠；显示日范围最早到2026-07-29，未覆盖10月6日往前90天。 | 单页与单个page2样本不证明完整分页/90日历史/失败恢复；北京、福建、上海无可复用分页脚本证据。 | 按矩阵续查已保存页面历史/分页及跨周期；S1阶段A仅批准离线/loopback实现，不是source接入批准。失败保留partial不重试。 | 多时点证据可说明daily目标、历史窗口及失败恢复，不把配置值或少数分页样本当运行覆盖。 | QA/Lead；仍缺跨度与范围。 |
| G2-A3 新鲜度、失败恢复与轮询稳定性 | **现状：未结。** 19项工作树配置目标为每日检查且disabled、未导入DB，scheduler未验证；短间隔同页不变只代表两个手工时点。 | 尚无多轮间隔、失败退避恢复、滑窗进入/退出完整证据。 | 仅在获批应用数据库/启用后观察daily轮询与失败恢复；不得据JSON声明运行通过。 | 可复核实际轮询、失败恢复及窗口更新行为。 | 工程与Lead；时效容忍仍需用户决定。 |
| G2-A4 日期、一致性、去重与幂等 | **现状：部分。** 既有精确URL双轮证明若干固定文章幂等；会计司9/22 UTC切日误读已纠正；厦门证监API发布时间字符串和正文可见日均9/15；监管汇总与厦门当前候选无exact URL交集。 | 精确URL双轮不证明跨源相同事件去重；没有交集也不能证明去重；区域批次identity overlap为0、runtime dedupe unknown；日期元数据未知须保持unknown。 | 复用保存候选离线比较canonical URL/identity；在新快照出现重合时才检查真实入库dedupe；对固定样本核列表日、详情可见日和业务字段，不借URL路径推断日期。 | 重复/修订同一来源的行为有可审ID与revision证据；日期采用明确语义；跨源去重只在实际重叠样本测试后作结论，零重叠写unknown。 | 工程。 |
| G2-A5 正文可用性、领域事实与边界噪声 | **现状：未结。** 北京一篇body ok；福建9 body ok、1篇诊断后unconfirmed；上海10 body ok。新增detail样本中既有财政监管业务，也有内部活动/学习。S4严格正文就绪保护已按来源opt-in实现并通过focused/full/CI。 | 单篇样本不能测全源质量；附近PDF未请求，selector配置未覆盖所有内容类型；全栏业务质量与噪声率未知。 | 积累正负正文边界样本，不将短度直接作噪声判定；任何附件能力另行核销。 | 来源正文异常安全保留；自动精选/公开行为可审；机器、人工、模型判断分开。软件通过不等于来源验收。 | 工程/QA；内容质量未闭环。 |
| G2-A6 有界执行与可复核账目 | **现状：部分。** P3 dispatch cap已用于三次真实collector阶段、详情批次和repeat；北京/FJ/SH均有隔离库、事件与只读SQL。 | 北京首轮11个response body hash仍unknown；上海repeat dispatch 1次后超时、无headers/body/hash并以partial停止；福建pending warning无article ID；9/30历史hop仍unknown。hook边界不覆盖其它Undici实例、worker/旁路或代理CONNECT内部。 | 保持分阶段cap、exact host/path和no retry；对已观测超时保留partial。证据报告明确分开“响应hash已捕获”与“response body未收到”；不得靠后续GET补旧hash。 | 新批次有可审计上限、dispatch事件、响应/失败和DB前后状态；旧unknown保留，不追认或静默改写。 | 工程/QA；Lead核销预算。 |

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

**TASK**：维护Gate 2/P3六维可审清单并同步本轮S4与来源/分页证据，不改变Gate条件。

**MODEL**：Luna High；本轮项目provider调用0。完整软件测试仅连接localhost fake providers。

**FILES_CHANGED**：本次文档检查点更新STATUS、PROJECT_PLAN、SOURCE_MATRIX、区域矩阵、此清单、北京阶段交接、S4 operator notes，并纳入owned QA/范围报告；代码与数据库未改。

**TESTS_RUN**：文档工作只做离线报告/manifest/raw hash、候选与SQL结果核验；无新增软件测试、网络请求或数据库写入。代码检查事实为本轮已完成：fresh 35 migration local backend 257/257，typecheck/Web build/Web tests15/15，preview smoke29/29；combined SHA CI run37346160222 Linux backend257/256/0/1。

**RESULT**：代码SHA `b3546ab9c803b6872eb6b82d68fab8ca87da8520` 已push并通过唯一最终CI。19项来源全disabled（18 HTML、1 JSON），FJ唯一strict-body opt-in也仍disabled。Batch6 page2四局各10唯一候选、无page1重叠；最老显示日期2026-07-29，未证明90日覆盖。Gate 2仍`NOT_PASSED`。

**RISKS**：35局的目标栏目、历史/分页、可信日期、正文业务质量、噪声与跨周期证据仍有缺口。北京首轮response hash unknown；青岛详情和上海repeat各有一项timeout partial；甘肃栏目未知；云南/新疆日期冲突未裁定。

**BLOCKERS**：Gate 2来源验收证据未闭环；S1阶段A尚未实现，且当前裁定不允许把现有19个含详情规则的来源迁入阶段A或声称90天回填完成。P4真实provider、Gold标注、P6/P7与Gate4仍未完成。

**NEXT**：Lead已接受S1 Phase A限定为离线/loopback能力验证；按[scope review](S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md)完成代码与契约测试后独立评估，保持production source config关闭、无真实请求、无migration/apps。之后继续来源级历史和跨周期验证，并单独安排Gate 2审查。此次docs-only提交不重复CI。
