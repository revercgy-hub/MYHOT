# Gate 2 action checklist

**基线与最近代码检查点**：项目BASE `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`；旧代码检查点与历史CI结果按下文保留。当前代码SHA `3108be5671ec0939bda7341a0b0c5f4753a1daf7`的工作树配置46项（45 HTML、1 JSON），全部disabled、全文关闭；29个来源使用既有strict-body flag（28个regional standing IDs和单独批准的中央`mof-accounting-notices` exact exception）。fresh全套本机QA及同SHA CI run [37614483314](https://github.com/revercgy-hub/MYHOT/actions/runs/37614483314)已通过；配置未seed，软件QA不等于source admission。Gate 1已通过，Gate 2=`NOT_PASSED`。用户决定本地OCR为`OCR_DEFERRED_NOT_GATE2_BLOCKER`；详情见[OCR延后决策交接](HANDOFFS/OCR_DEFERRED_USER_DECISION_2026-10-06.md)。本清单不增加或重定义Gate条件，不宣称任一source已整体通过；正式结论仍由授权的Gate 2审查作出。用户已确认浙江首期以“监管工作”为主栏目，“图片新闻”后续补充；该范围决定不表示完整覆盖或来源通过。

**2026-10-06恢复核验状态**：两项代码提交及最终CI已完成；本机fresh backend full 257/257，CI Linux backend 257/256/0/1（1项Windows-only skip）、Web15/15。S4针对性回归5/5；source-specific正文保护已实现。所有真实请求的时点按manifest UTC；逐局证据见[矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)。

## 六项核对

“完成标准”只说明已有Gate 2/P3问题有可审证据结清，不代表Gate 2自动通过。用户已确认首阶段逐一覆盖全国财政部地方监管局新闻动态栏目；中央选登只能补充，不算逐局覆盖。35个目录/域名仅是调查候选，逐局栏目、入口、正文质量和状态以[覆盖矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)逐项核实。旧批次的unknown照实保留；不能追认历史hop计数，但未来一批经验证的新范围证据可以满足后续预算审查，不把旧unknown设为永久阻塞。

| 维度 | 现有证据 | 缺口 | 下一具体动作 | 完结标准 | 责任 |
|---|---|---|---|---|---|
| G2-A1 来源与候选身份 | **现状：部分。** 工作树有46项配置（45 HTML、1 JSON），均disabled；已核验多批首页/列表/配对详情，原始身份和有限正文边界见逐局矩阵。strict-body exact IDs为29项：28个区域来源加一个单独批准的会计司中央精确例外，仅为自动处理保护。 | 单篇和单页不能证明全栏目质量；个别目标详情超时或日期冲突保留，配置flag不等来源通过。 | 按矩阵继续填补来源范围、日期语义、正文质量和跨周期证据。 | 官方入口、列表/详情身份、日期语义与正文边界均有逐source证据且配置allowlist正确。 | QA/Lead；本轮仍为有限样本。 |
| G2-A2 首页窗口与栏目/历史候选 | **现状：未结。** 按用户口径需覆盖35个地方局新闻动态栏目；浙江用户已指定首期主入口为“监管工作”、图片新闻后续补充。多局已保存首页和有限分页样本，含甘肃配对详情；三局历史页样本已经触达2026-07-09边界，但未证明完整历史。 | 单页和少数分页样本不能证明完整栏目、来源级可信日期、失败恢复或跨周期稳定；不以机械遍历全部旧页作为Gate 2的通用前置。 | 按矩阵继续核实35局实际入口/规则，并审有限历史样本的日期、窗口边界、失败安全和partial处理；保留非单调行序及URL路径冲突。完整近90天首次回填能力与覆盖/partial解释属于P7/Gate 4上线准备以及P8/P9 staging和首次上线前验收。 | Gate 2保留逐局范围、核心源有限历史/日期/失败安全证据；不能把countPage或有限页面说成完整覆盖。完整近90天首次回填仍须在上线阶段验收，不因阶段区分而删去用户要求。 | QA/Lead；当前仍缺核心质量与周期证据。 |
| G2-A3 新鲜度、失败恢复与轮询稳定性 | **现状：未结。** 46项工作树配置仍全disabled、未导入DB；daily目标未通过scheduler实跑验证。 | 尚无多轮间隔、失败退避恢复、滑窗进入/退出完整证据。 | 仅在获批应用数据库/启用后观察daily轮询与失败恢复；不得据JSON声明运行通过。 | 可复核实际轮询、失败恢复及窗口更新行为。 | 工程与Lead；时效容忍仍需用户决定。 |
| G2-A4 日期、材料身份去重与事件聚类 | **现状：部分。** PBOC OMO两个保存列表经runtime MockAgent相邻快照回放：191号重复候选保持同article ID/material identity/hash/revision与一次discovery；192号作为新精确URL新建一次。时钟相邻日为模拟，不能据此认定daily可靠性。区域来源间目前缺少形成充分重叠的已验证runtime样本，零交集保持unknown。 | **P3 / Gate 2**须核验相同normalized URL/material identity候选在重复发现、更新和跨来源发现时的source/article IDs、identity、discovery与revision变化；无实际重叠时记`not observed / runtime dedupe unknown`，不得以零交集宣称去重通过。日期冲突按来源保留hold/规则，不以URL token推断发布日期。 | 复用保存候选离线比较canonical URL/identity；在确有重叠且获准运行时检查真实入库dedupe，并保留前后计数。对固定样本核列表日、详情PubDate/可见日，不借路径覆盖冲突。 | 精确材料身份重复/修订行为有可审ID和revision证据；日期规则明确；零重叠仍写unknown。 | 工程/QA。 |
| G2-A5 正文可用性、领域事实与边界噪声 | **现状：未结。** 北京一篇body ok；福建9 body ok、1篇诊断后unconfirmed；上海10 body ok。新增detail样本中既有财政监管业务，也有内部活动/学习。S4严格正文就绪保护已按来源opt-in实现并通过focused/full/CI。用户确认附件无法可靠解析时保留原文URL、正文待解析且不进入自动精选。 | 单篇样本不能测全源质量；附件类内容的业务正文可用性与全栏质量仍未知。 | 对HTML、JSON及可读text-PDF来源继续逐源小规模准入验证并积累正负正文边界样本；不将短度直接作噪声判定。扫描件OCR已延后，不作为Gate 2 blocker；若未来有实际需求，再评估provider API。 | 来源正文异常安全保留；自动精选/公开行为可审；机器、人工、模型判断分开。软件通过不等于来源验收。 | 工程/QA；内容质量未闭环。 |
| G2-A6 有界执行与可复核账目 | **现状：部分。** P3 dispatch cap已用于三次真实collector阶段、详情批次和repeat；北京/FJ/SH均有隔离库、事件与只读SQL。 | 北京首轮11个response body hash仍unknown；上海repeat dispatch 1次后超时、无headers/body/hash并以partial停止；福建pending warning无article ID；9/30历史hop仍unknown。hook边界不覆盖其它Undici实例、worker/旁路或代理CONNECT内部。 | 保持分阶段cap、exact host/path和no retry；对已观测超时保留partial。证据报告明确分开“响应hash已捕获”与“response body未收到”；不得靠后续GET补旧hash。 | 新批次有可审计上限、dispatch事件、响应/失败和DB前后状态；旧unknown保留，不追认或静默改写。 | 工程/QA；Lead核销预算。 |

**G2-A4阶段边界（不删减要求）**：P3/Gate 2验收真实材料身份去重、同URL重复发现与同源内容修订行为；只有在实际出现相同material identity样本时才能声称观察到跨源身份处理，零重叠仍为unknown。跨来源同一事件的语义聚类准确性为`P4_REQUIRED_NOT_RUN`，保留为P4明确待验事项，不伪装为已完成，也不将其提升为Gate 2退出条件。P4开始后仍须用隔离新库和经授权的真实Gold样本完成模型/语义聚类验证。更详细的依赖分界见[S1连续Gate依赖审阅](S1_CONTINUOUS_GATE_DEPENDENCIES_2026-10-07.md)。

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
- 完整近90天首次回填仍是用户确认的首次上线要求，但不是Gate 2要求在上线前对35局机械遍历所有旧页。P7/Gate 4应验收回填实现、覆盖/partial状态解释和安全边界；P8/P9在实际Staging及首次上线验收中完成所需回填并按真实发布日期呈现，不删除已有数据库数据。
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

**BLOCKERS**：Gate 2来源验收证据未闭环：各目标栏目覆盖、逐源分页与历史、日期语义、正文业务质量、附件降级和跨周期重复仍缺实证；当前有限样本不能证明90天回填或来源通过。P4真实provider、Gold标注、P6/P7与Gate4仍未完成。OCR延后状态见本清单顶部链接，不构成Gate 2 blocker。

**NEXT**：恢复主线为HTML/JSON/text-PDF来源准入与小规模验证，继续逐源检查栏目、分页/历史、日期、正文业务质量、附件失败降级和跨周期重复；source仍按独立范围审查与授权。扫描附件无法可靠解析时保留原文URL、标注正文待解析且不自动精选。API OCR只在未来有实际需求时按既有provider预算与receipt机制评估；当前不启用API/模型或实现调用。Gate 2仍`NOT_PASSED`，不把未完成的逐源证据描述为通过。此次docs-only提交不重跑CI。
