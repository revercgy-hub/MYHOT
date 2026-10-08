# S1：连续 P3 的最小 Gate 依赖审阅（2026-10-07）

**RESULT=CHANGES_REQUIRED（验收表述及云南日期例外）；常规 disabled 配置续批维持 CONDITIONAL_CONFIG_ONLY。Gate 2=NOT_PASSED；source admission=NOT_ADMITTED。** 本文是一次窄架构依赖裁定，不是正式 Gate 2 审查、通过或跳关授权。Lead/Luna 可继续不依赖下述例外的35局来源证据工作。

## 依据与证据边界

只读核对 `AGENTS.md`、README、根目录《财政金融热点站完整开发与部署任务书.md》第二十六、二十九、三十节、`PROJECT_PLAN.md`、`GATE2_ACTION_CHECKLIST.md`、`GATE2_USER_DECISIONS.md`、`STATUS.md`、10/7严格正文配置续批 standing rule、Batch 8/9详情记录、`P3_REMAINING_SOURCE_GAPS_2026-10-07.md`、Phase B详情元数据裁定及实际 sources/collect、materials、URL identity、events/group 代码。保存字节/hash及正文长度沿用报告的独立 QA，不宣称本审查重新完成 raw QA。

用户已确认首阶段逐局覆盖35个地方监管局的新闻动态、每天检查、首次近90天并保留真实原发布日期；内部活动与实质业务事实按已确认内容边界处理。目录数、配置数、单篇正文及软件测试均不代替来源通过。只读时行业配置已出现甘肃、青岛、大连、宁波、深圳五个新增 disabled 项；动态工作树数量仍由实施方冻结后核算，不以父任务27项快照代表当前数量。

## G2-A4：入库重复与语义事件必须分开验收

任务书明确模型关闭时检查采集重复，核心官方源稳定后才能开启模型；下一模型阶段检查事件聚类准确性。计划对应 P3/Gate 2 → P4。实际 `content/materials.ts` 的 `identityKeyFor`、`upsertMaterial` 与 `lib/url.ts` 采用 URL material identity；唯一 identity 冲突时增加 discovery，相同来源真实内容变化才进入 revision，跨来源相同 material 不夺取原来源字段。这不需要真实模型。

`events/group.ts` 的语义路径依赖 analysis、召回及 `group`/`groupReview` provider receipt。虽然存在 same-URL 和无需判模型的分支，它们不证明不同 URL 的政策报道、解读、实施细则已正确区分 `SAME_OCCURRENCE`、`SAME_STORY` 与不同事件。要求真实模型语义归组先通过才开放 Gate 2 后模型，会产生循环依赖。

**最小文档修正**：Lead 把 G2-A4 的“跨源相同事件去重”拆为以下两项，不删需求、不把零交集改写成功：

- Gate 2/P3：实际相同 normalized URL/material identity 的重叠候选与重复运行须保留 source ID、article ID、identity、discovery、revision 和前后计数证据；原来源修订与跨来源 discovery 分开核对。未出现重叠的 source pair 写 `not observed / runtime dedupe unknown`，保存离线 identity 比较只证明输入相同或不同。禁止新增标题相似去重或跨域 canonical 猜测来制造通过。
- P4：用有业务区别的真实样本验证同政策多来源报道/解读的归组，以及征求意见、正式发布、实施细则、后续调整、执行数据的区分，记录模型决策/receipt和人工预期。该项记为 `P4_REQUIRED_NOT_RUN`，不能预先称通过；Gate 2正式审查仍独立审所有采集稳定性及用户35局范围证据。

本裁定只纠正阶段依赖；不是把当前 Gate 2 判为通过，也不将全部核心源稳定、每日运行/恢复、可信日期、正文边界及近90天要求简化为 URL 测试。合成 fixture 只能核销软件行为，不能填真实来源重叠/跨周期证据。

## 云南：原始日期未知，权威开关暂不批准

精确冲突 URL：`https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997724.htm`。Batch 8及10/7复核记录列表9月18日、路径9月18日；详情 `PubDate=2026-09-24 08:22:00`、可见“发布日期”和正文首行均9月24日。三处页面字段一致只能证明详情现显示9月24日，不能证明9月18日字段不可信，或9月24日是首次原始发布而不是后续更新/重发。不能凭多数字段、标题一致或较新日期选择原发布日期。

实际 legacy collector 已支持 `detail.publishedAtAuthoritative=true`：首次窗口过滤不先按列表排除，随后清空列表日期并在有界详情中读取配置规则，最终重新做首次日期窗过滤。这个开关表达整条 source 的列表不可信及详情权威；它不是只覆盖一条冲突记录，也不是 original-date 语义验证器。已存 identity 的 legacy 路径也不能当作日期修复工具。Phase B另有两个可信日期必须完全一致及存量元数据需审规则；本文不启用 Phase B、不批准 `<24h` 精度升级、不改 legacy 算法。

**精确裁定**：不批准为候选 `mof-yunnan-supervision-dynamics` 设置 `publishedAtAuthoritative=true` 或以其使本 URL 自动通过。最小 hold 是此 URL 的可信原发布日期及对应来源日期权威结论；其正文、标题和栏目证据继续有效，不删除云南覆盖目标，不要求把所有云南稿永久排除。其他无冲突配对样本可继续独立补证，source 可保留明确 `date unresolved` 的 dormant 配置草案，但不能引用 standing rule 把未解决日期写成来源准入通过。

解除 hold 需要保存、可审的来源证据说明原始发布与更新字段的含义，或本文章明确原日期；若拟设 source-wide authoritative，另需证据证明配置规则适用于该来源而非只适用一篇。之后 Lead 提交精确 ID/rule 与 fixture 回归范围作例外核销。重复获取同一未变 HTML 不自动补足语义。用户可以决定产品范围，却不能通过选择9/18或9/24替代来源日期事实。现阶段 hold 是 P3 证据/验收记录，不宣称 legacy runtime 已实现逐 URL date-conflict 自动拦截；真实 collector 请求包必须先避免处理此未决候选或另获适用裁定。

## 新疆：URL token 不作日期权威，disabled 配置可继续

精确配对 URL：`https://xj.mof.gov.cn/caizhengjiancha/202607/t20260717_3993738.htm`。Batch 9及10/7复核记录列表9月24日、`PubDate=2026-09-24 08:32:00`、可见发布日和正文首行9月24日；只有路径 token 为7月17日。当前 parser 实际读取列表/配置详情规则，不把路径 token 转为发布日期；因此无需增加“ignore path date”运行时 knob，也不能改成7月17日。

**APPROVED_SCOPE（有条件）**：候选 `mof-xinjiang-supervision-dynamics` 可在官方映射、保存列表/配对详情、独立 QA及精确 fixture核销后，按现有 standing rule添加 disabled、全文关闭、1440分钟、首次3个月/require-date和严格正文保护配置；保留列表发布日规则，不增加 source-wide authoritative，不启用采集或分页模式。路径差异保留为非权威 token observation；它本身不阻断该 disabled 配置。列表/详情现显示日一致也不是“原始发布/更新语义全源已证明”；Gate 2日期可信度与历史原日期要求仍需逐源证据，不据此宣布来源通过。

## 浙江：明确候选栏目，可配置；覆盖替代需 COLUMN 决策

保存首页真实并列“监管工作” `/caizhengjiancha/` 与“动态简讯” `/dtjx/`。后者379字节 JS wrapper指向图片新闻子栏目，不能说成完整动态简讯；前者已有9条列表、首篇财政业务详情及16页静态声明。栏目和配对样本证明一个实见财政监管业务候选，可按真实名字保留/准备 `mof-zhejiang-supervision-dynamics` disabled 配置；不能改名成已完整覆盖新闻动态，也不能仅凭一篇认定整个栏目纯业务。

**TRUE_HUMAN_DECISION=COLUMN**：若 Lead 要把浙江“监管工作”作为用户逐局新闻动态要求的浙江覆盖入口，而不再核动态简讯新闻范围，需一次用户范围确认：是否接受这个明确业务栏目作为浙江目标入口。现有证据无法证明两个栏目等价，也没有用户选择全部栏目；不能自动判 all-column pass或强制扩大所有35局到全站栏目。等待决定时继续其他局证据及浙江已知栏目的事实记录；决定只确定目标入口，不通过历史、日期、质量或来源验收。

## 实施交接与边界

Lead/Luna 只需：修正 G2-A4两阶段记录；云南 exact URL/date authority hold；新疆按条件做常规 disabled配置；浙江栏目替代单独列 COLUMN 决策。甘肃、青岛、大连、宁波、深圳已新增配置及剩余已知入口，仍按10/7 standing rule逐项接受证据与精确 ID/fixture/strict-body allowlist，不必每批重复 Sol审查。任何新 runtime、来源日期例外、未核栏目替代或启用均超出该常规规则。

**MODEL**：Sol 单次窄依赖审阅；后续实施/来源证据/QA交 Luna。**FILES_CHANGED**：仅本文。**TESTS_RUN**：无；静态读取，无HTTP、DB、Git、worker、provider或OCR操作。**NEXT**：Lead更新其 owned清单与未决记录，继续有界 P3；不修OCR、不重开模型、不宣称35局覆盖或 Gate 2通过。

## 同日最小补充裁定：云南精确 URL 配置排除及浙江用户决定

**SUPPLEMENT_RESULT=APPROVED_SCOPE（条件配置）；云南原日期 hold 继续；COLUMN=CONFIRMED。** 根据 Root 转述的用户新决定，浙江以“监管工作”为主入口，图片动态以后补。此前 COLUMN 待决定状态已解除；现阶段只核所选业务栏目的证据和配置，不要求图片动态先通过，也不宣称浙江全部栏目已覆盖。来源/历史/质量验收状态不变。

云南可使用现有 `denyUrlPrefixes`，值仅为完整冲突 URL `https://yn.mof.gov.cn/caizhengjiancha/202609/t20260918_3997724.htm`。实际 `sources/web-list.ts:46` 的 `allowed` 先匹配 deny 再匹配 allow，使用 `startsWith`，并只统一 HTTP/HTTPS scheme；`fromHtml` 在生成候选前调用它（154行），`fetchWebList` 走该 parser，legacy `sources/collect.ts:121,133` 获取列表后再次过滤，早于详情循环和 material store。因此在无 rewrite、直接 HTML 列表配置下，这条实见 URL 会被排除出 collector 候选，不进入该轮详情或入库。完整 URL 前缀还会匹配其 query/fragment及任何相同起始字符串；这是既有前缀语义，不是新增 exact-identity 全局封锁。不能将它写成整个 `/202609/` 或栏目目录，也不猜其他 URL aliases。

**精确批准条件**：在另一条保存的云南列表/详情配对获得独立 QA，标题、列表日/详情可见发布日及配置发布字段无已知冲突、真实 selector明确后，可注册 `mof-yunnan-supervision-dynamics` disabled 配置，采用该保存证据支持的标准列表日期规则、现有详情/正文规则和精确上述 deny。保留1440分钟、首次3个月/require-date、严格正文 flag及两个全文 false；禁止 `publishedAtAuthoritative=true`、日期精度升级、分页 opt-in、URL rewrite、运行时修改、DB导入或存量日期覆盖。Lead按 standing rule核销新配对与精确 source-ID/strict allowlist，Luna为配置/parser fixture锁定冲突 URL 不产生候选、无冲突实见候选仍保留及其真实日期；相同 scheme 的既有前缀语义按适用检查记录。本审查不执行该 QA。

这允许云南保留覆盖目标并推进 disabled 注册，不需要先查清这条已排除文章的原始日期；该文章仍列为未决、未采入及历史覆盖缺口，不能被计为已完成90日回填。此配置只阻止该 source 的 future collector列表候选，不改变已存文章、旧 jobs、其他来源或手工 ingest；不是通用日期冲突识别，也不证明其他未知冲突自动受保护。解除该 deny/hold仍需上文要求的原始日期来源证据。若后续另一配对也冲突，条件未满足，保留草案并继续补证，不设 source-wide authoritative 绕过。

本补充仅追加同一报告，无代码、测试、HTTP、DB或Git操作；不重开正式 Gate 2审查。

## 同日最小扩源裁定：甘肃一次隔离 legacy collector

**GANSU_PACKET_RESULT=APPROVED_SCOPE（执行前置条件及 Root 最终核销）；Gate 2=NOT_PASSED，sourceAdmission=NOT_ADMITTED，coverage=unproven。** 已只读核对 `P3_REMAINING_SOURCE_GAPS_2026-10-07.md` 末尾 packet、`S1_P3_LIMITED_LEGACY_COLLECTION_SCOPE_2026-10-06.md` 原合同及 ignored 福建 runner/guard/preflight。这是同一有界 legacy 模式换一个已有 disabled 来源的范围扩展，不需要新 collector 架构、分页模式或 initializedAt 例外。历史福建 preflight/实跑不自动核销甘肃克隆或真实请求。

唯一 source 为 `mof-gansu-supervision-dynamics`；唯一两条 GET 为列表 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/` 与业务详情 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260821_3995880.htm`。列表日、PubDate日及可见发布日9月4日一致，路径8月21日只作诊断；2,923清理正文字符等保存 QA事实不是本轮 collector结果，不以路径或抓取日替代发布时间。

批准在新 ignored甘肃目录局部复制既有 `run-once.mjs`、`fujian-dispatch-guard.mjs` 和 corrected/gzip preflight；仅替换 source/fixture/URL/origin、fresh absent `_test`库校验、目录/manifest标签及更窄限制常量。fixture从当前甘肃对象复制，继续 disabled/全文false、既有日期和 `.my_doccontent`规则、严格正文flag；只把候选 allow-prefix收窄为完整唯一详情、`initialBackfillLimit=1`、`detail.maxFetches=1`。pagination缺省，无rewrite/adapter/Jina/PDF helper。一次 `collectSource(id,{force:true})`，只允许本次列表中精确出现的那一篇；不存在即零文章观察，不补链接、不换文章。

两次 actual dispatch硬上限包含失败/超时；拒绝任何redirect、重复URL/retry及其它方法/host/path/query/fragment/附件目标。单请求20秒、HTML响应字节及解压结果各不超过6MiB、全进程总时限60秒；共享边界不得只写入manifest而不实际执行。guard的动态 `allowedUrls`/`expectedOrigin`须全量替换，福建默认目录/错误标签及保存路径不可留下错误语义；完整 URL prefix不替代派发边界等值校验。保留真实 SSRF/DNS、backend pinned Undici及真实 Agent防护，无global-fetch/其他实例旁路。

真实请求前必须由执行者和 QA核销甘肃克隆的 syntax、配置/保存raw hash，以及 loopback-only preflight：唯一候选留存、prefix后缀拒绝、第三次超额实际派发为0、错误目标/方法拒绝、redirect零第二跳、非HTML拒绝、响应/解压上限及gzip列表先有界解压再以真实 parser检查精确候选。历史福建live gzip边界 partial不能追认成甘肃通过；preflight与真实预算分开从0起。任一未证明停在preflight；新真实run仍由Root另行核销。

唯一新 absent disposable `_test`数据库须先核实本地连接身份、库不存在及35项migration/零业务初态；不连preview/正式库。写入范围沿用原合同：唯一disabled source、一次 fetch_run、最多一篇article及其revision/discovery、source cursor/health时间戳与 enqueue-only内容队列。PgBoss入队必要内部生命周期允许，应用 `.work()`、`.schedule()`、worker/scheduler入口禁止，队列业务started/completed及job_runs/analysis/receipt/publication/selected写入均为0。采集总开关、模型、推送及其他外部服务开关关闭，force仅限本fixture。初始化、cleanup及异常都须保存审计，正常/异常调用既有stopBoss与DB关闭；60秒硬停若中断清理，独立QA必须核实无残留业务进程/在途请求并照实标partial，不续跑。

独立前后DB QA、每dispatch及响应raw/hash/EOF/编码/失败、实际保存日期/正文/队列状态和全部cursor须记录。`initializedAt`、`lastOkAt`、health/fetch_run ok均仅表示该单次legacy事实；不得清除伪装零初始化、复制cursor、称近90日已完成或覆盖来源通过。详情best-effort失败/guard拒绝即使被collector吞掉，也独立报partial，不篡改ok原值或消费旧jobs。无附件、OCR、模型、生产source改动及存量日期更新。

本次只追加裁定；未克隆runner、运行preflight、建库、执行测试/HTTP/collector/DB/Git。执行准备和QA继续交Luna，满足条件后交Root核销唯一真实run。

## 同日最小例外裁定：会计司未就绪正文保护

**ACCOUNTING_RESULT=APPROVED_SCOPE（exact ID配置及负例QA）；Gate 2=NOT_PASSED。** 本轮只审 `mof-accounting-notices`，中央会计司不属于35局配置 standing rule，此处单独扩展既有严格正文flag的配置许可；不自动扩展其他中央、福建厦门核心源。

只读代码确认当前会计司有两项真实正文bodyPolicies，未设置strict flag、detail maxFetches或attachmentSelector；保存 `tests/fixtures/fiscal-accounting-body/real-title-xlsx.html`只有题名容器和XLSX链接，不满足这些正文策略。`content/selected-body.ts`未匹配策略时返回 `selector_missing`；现有pdfLinks不是通用XLSX探测器。本报告未执行该负例，实际 extract结果/诊断有无由Luna与独立QA原样记录。

既有 `content/body-readiness.ts`精确读取source config布尔true，没有区域source ID分支；`jobs/content.ts`未就绪路由只允许pending走extract，unconfirmed的queueProcessing直接返回null。`editorial/input.ts`读取当前source config，`editorial/analyze.ts:425`在provider之前返回body_not_ready；`events/group.ts:643`阻断自动group。`publication/publish.ts`和公开items/v1/groups的当前配置投影压住自动selected，精确布尔manual selection保留原例外。`content/extract.ts`无attachment diagnostic的抽取失败分支同样写unconfirmed并对strict source同步publication。因此此负例的hold不依赖PDF/XLSX诊断或新的附件schema。

**最小实现许可**：只为 `industry/sources.json`中 `mof-accounting-notices`的 `_aihot`增加 `requireBodyReadyForAutomaticSelection: true`，保持既有列表/日期/bodyPolicies、每日/三个月配置、disabled及两个全文false；不添加解析XLSX、attachmentSelector、detail maxFetches、日期authority、分页、抽取回退、schema或packages/apps改动。该source所有未就绪稿均受保护，这是已存在source-level开关的效果，不是仅对一个XLSX URL的分支。可靠正文ok且trim非空仍按原路线恢复，不人为改变样本body_status。实际JSON提交不更新任何已导入DB source行；DB启用/迁移/存量操作均未在此获准。

Luna同步精确配置与allowlist断言：当前读取为46源、28个regional opt-in，新增会计司后source总数不变，opt-in为原28项加此exact ID；最终冻结时与其它已授权并发变更核算。`STRICT_BODY_POLICY_OPERATOR_NOTES_2026-10-06.md`须区分区域standing rule与本中央exact-ID例外，保留用户附件规则和未解析事实，不写成所有中央源已受保护。

**最低验证要求**：复用既有 `strict-body-readiness.test.ts`与`strict-body-readiness-publication.test.ts`的配置精确布尔、未就绪hold、pending仅extract、旧analysis不得复活、非空ready恢复、当前公开投影/同步撤回、manual exact布尔及absent/false legacy回归。另在Luna正在进行的fresh `_test`/MockAgent会计司真实fixture负例中使用修改后的实际配置：保留原article URL，确认XLSX未dispatch、body空/unconfirmed及真实selector_missing、无诊断时不伪造diagnostic，自动queue/analyze的hold与零provider/receipt，自动selected/公开精选不进入。保留标题/安全摘要/原文链接可见行为与manual例外；不为证明hold执行付费或外部请求。可在同一负例记录已准备的修复前事实及修复后效果，不改变历史日志。独立QA复核后按仓库要求完成适用软件检查；本审查不核销尚未执行的测试。

原文文章链接及unconfirmed是本配置可保证的退化边界；未新增附件诊断时，不能宣称XLSX原附件URL已结构化持久化或UI已展示附件待解析详情。保存fixture中的附件链接证据继续保留，读者可经原文链接访问；附件解析/结构化状态若后续需要再另审。严格flag也不判断财政事实质量、不能修正错误判为ok的假正文，不能把所有附件格式或该来源整体判为通过。

其他已known unconfirmed核心源须继续逐源列出自动路径风险及用户附件规则缺口；无需将它们捆绑为本会计司最小保护的前置条件，也不代表风险已豁免或其Gate项可结清。确有同类路径证据时另提exact ID配置许可，不能据本裁定或35局standing rule批量扩展。本文未运行负例、测试、网络/DB/provider/OCR/Git，未改任何代码；实施及独立QA继续交Luna。

## 同日阶段依赖裁定：有限历史验证与首次上线近90日回填

**HISTORY_STAGE_RESULT=CHANGES_REQUIRED（仅修正文档阶段归属）；可停止机械遍历旧页，继续核心来源质量和稳定性补证。Gate 2=NOT_PASSED。** 不改变任何用户要求或正式Gate权限，不新增退出条件、审批表或实现框架。

任务书第二十九节要求模型关闭时逐源核HTTP、发现、标题、发布时间、URL、正文、重复、导航/党建/招聘/培训及错误栏目；其Gate 2原文为“核心官方源稳定以后才能打开模型调用”。下一节才是小规模核心源模型验证。计划对应P3/Gate 2→P4。`GATE2_ACTION_CHECKLIST.md`又明确“不以实现通用分页、遍历全部历史页……为通用前置”。用户决定5明确“首次上线回填近90天”，而非“Gate 2之前遍历35局所有历史页”。因此STATUS/BLOCKERS若把每源完整90日回填一概列为Gate 2前置，确实超出既有阶段约定，应拆开，不向用户重复询问已确认要求。

**Gate 2仍保留的35局范围**：逐局实见目标栏目与官方映射、列表/详情候选身份、实际source规则/allow/deny、日期与正文业务边界及已知异常必须逐项记录，浙江按已确认主“监管工作”范围。中央选登、35域名、46配置或单篇配对不能替代逐局覆盖证据；未核实的局/入口/关键规则不因“核心源”措辞被删除或默认为通过。Lead所述当前35局配对及新增配置以对应QA矩阵为准，本报告不重核其原始响应，不把这些准备证据升级为各源稳定性/全栏目通过。

**Gate 2所需历史验证沿用现有P3有限证据边界**：用已保存/有界样本说明首页日期窗口、旧稿/非单调行序/分页入口的真实边界；核已有首次过滤规则的可信日期、缺失/非法/未来及实际冲突处理，截止内/外和等于截止的既有行为，历史按真实发布时间呈现而不冒充新稿、不删除存量；对失败/预算停止、重复发现和修订保留真实partial及恢复/稳定性证据。软件fixture核销边界行为，真实来源样本核日期/内容语义，两类证据分开。这些是现有规则的核验内容，不要求为每个35局各新增一套runtime测试或全页遍历。核心源质量、附件安全退化、重复/更新和跨时点稳定性的未决问题继续真实列为Gate 2缺口；单次成功、配置daily或模拟时钟均不核销稳定性。

**完整近90日要求继续是首次上线验收待办**：P7/Gate 4本地完整验收应核销拟上线回填能力、来源适用性与完成/部分状态的可信解释，保留尚需真实环境确认的缺口；P8/P9按原计划在隔离Staging验证实际采集、调度、恢复和覆盖，首次上线前必须履行用户选定的近90日范围与真实原发布日期原则。不是把尚未完成的历史覆盖直接称作Gate 4通过，更不是允许首次上线用一页初始化替代90日回填。若完整回填能力仍不支持，应明确作为P7/上线准备阻塞处理，未来所需最小实现另按既有S1机制审阅；本次不授权该实现或大规模GET。

实际legacy `collect.ts`只对单页候选执行首次90×24小时过滤、有限候选/detail处理后写initializedAt；Phase A/B及`web-list-pagination.ts`保持coverage=unproven，旧日期、countPage/空页、预算页数和maxPageIndex都不产生complete，Phase B原裁定明确不实现complete/增量切换/跨页完整性。把三个page2中出现7月9日前日期或countPage=50升级为窗口完成，违反这些边界。非单调日期下不能在第一个旧日期停为complete；也不能因未完成便强制在Gate 2前抓35×50页。继续机械请求旧页不能补足完成协议、日期可信度、首屏漂移或业务质量证明。

**给Lead/Luna的准确修正文案**（替换当前笼统Gate 2 BLOCKERS/NEXT，历史事实保留）：

> Gate 2仍NOT_PASSED：35局目标栏目与来源规则须逐项有证据，核心官方源的标题/可信日期、正文业务质量与噪声、附件安全退化、材料身份重复/修订及跨时点稳定性仍按矩阵核销；有限首次窗口与失败安全验证不足之处如实保留。逐源完整近90日回填及coverage完成证据尚未完成，列为P7/Gate 4上线准备与P8/P9实际运行、首次上线验收待办，不作为Gate 2通用全历史遍历前置。现有配置、单页initializedAt及少数旧页样本均不证明历史完成或来源通过。暂停机械旧页遍历，优先补核心源日期、噪声/正文、附件退化、重复更新及跨周期证据；P4真实模型仍待正式Gate 2审查通过及授权。

G2-A2只需把“完整栏目/90日历史未证明”标为持续范围/上线历史待办，并说明本阶段有限样本证明什么、不能证明什么；不删除记录，不把unknown写PASS，也不新增一个“每局历史边界必须抓到”的前置。每日上线目标仍保留，Staging完整调度实跑也不反向变成Gate 2前需运行NAS。此处仅区分既有阶段，不裁定当前采集证据已经够稳定。

本次仅追加本文，静态核对任务书/决策/清单及Phase A/B与当前collector代码；无测试、HTTP、DB、Git或运行时改动。Lead/Luna同步其owned状态与清单，继续小规模P3质量主线。

## 同日核心来源保护续批裁定：预算司、金融司与固定12核心ID

**CORE_BODY_RESULT=APPROVED_SCOPE；CORE_STANDING_RULE=CONDITIONAL_CONFIG_ONLY。** 本轮精确批准 `mof-budget-work`、`mof-finance-notices`各增加现有 `_aihot.requireBodyReadyForAutomaticSelection: true`。不自动修改其他source，不正式验收Gate 2；区域35局standing rule继续沿用，核心12项的规则仅由本段单独授予。

只读复核实际source JSON、materials新建状态、jobs/content的route/queueProcessing/processArticle及抽取完成/失败重排链、既有strict-body tests。预算司为editorial web_list，暂无detail配置，仍因现有wantsBody/web_list路线处理pending；金融司已有article/body/attachment规则。`materials.ts`新建有正文时按输入状态，无正文默认pending；两条正常列表路径不因缺detail maxFetches而必然落none。strictfalse下无marker的unconfirmed可进analyze；stricttrue不依赖marker，pending仅extract，unconfirmed/none等非ready状态hold，真实非空ok按原流程恢复。父任务所述预算1条空body unconfirmed/8 pending与金融1条空body unconfirmed作为待QA核实的负例线索，不借本只读审查追认历史DB或marker事实。

**none边界**：none不是ready，strict hold是既有意图，不可为避免停留把none伪装成ok或自动改pending。现有strict route对none不自动enqueue extract；它可能等待实际既有补正文入口或明确人工处置，这不等于所有none均能自动恢复。故每个续批源须核对真实正常创建/抽取路径，确认可读业务样本能pending→extract→非空ok并恢复，或已有可信body入口；若正常可读稿长期产生none且没有既有到ready路径，不满足常规续批条件，单独说明实际例外。hold未解析失败稿是产品规则，不以“防死锁”为由绕过guard；本规则不新增none恢复算法、body补写或存量修复。

**本轮最小实施/QA**：两项只改精确布尔flag，其enabled/fulltext、date/body/attachment规则、daily/首次三个月及其它配置保持。源总数不变；在当前已批准会计司+区域精确集合上只追加这两个ID，冻结时据实际配置核算strict allowlist。Luna更新配置断言及operator notes，明确核心条件规则与区域规则不同。以两源实际配置和保存/负例数据在fresh `_test`核无marker unconfirmed同样不入auto queue/analyze/group/selected、零provider/receipt；有marker对照照实记录、不伪造旧诊断；pending仍只extract及已核实可读正文ready恢复、旧analysis不复活，none hold和未就绪empty/whitespace ok hold。复用既有strict-body routing/publication、manual exact布尔及false/absent legacy回归与适用整体检查，由独立QA核销。允许合成状态fixture检验软件guard，不能把合成稿计为真实来源正文可读证据。历史marker未知不阻止加强当前保护，也不因新flag而变成已复原。

**固定核心条件续批集合**（从原12核心清单与实际source对象核对；不可增域名/机构）：`mof-budget-work`、`fujian-finance-notices`、`xiamen-finance-debt`、`pboc-xiamen-work`、`mof-policy-release`、`mof-finance-notices`、`mof-accounting-notices`、`pboc-open-market`、`mof-treasury-debt-data`、`xiamen-csrc-regulatory-work`、`mof-regional-supervision-dynamics`、`mof-xiamen-supervision-dynamics`。这只是允许逐项考虑的固定ID集合，不是本轮全部opt-in集合。

集合内未来source在以下现有边界均满足后，可由Lead/Luna继续配置保护，无需每源重复Sol：已有保存/真实负例证明未可靠正文或无marker unconfirmed的自动路径风险；独立QA核对actual source身份/配置与负例事实、正常正文路径及上文none/pending/ready边界；Lead接受exact ID并更新精确allowlist及operator notes；仅增加现成true，所有source继续disabled/全文false且日期/body规则保持；核销同一严格正文行为回归、实际source配置/fixture与适用QA。未知诊断可以明确保留，不要求追认所有历史marker；但不得从旧数字推断当前正文状态或把未知当ready。不满足任何条件则保留该source缺口，另提具体例外或补证。

本standing不批准新source/domain、JSON摘要假正文、false-positive ok修复、附件解析/diagnostic/schema、runtime/queue/none处理变化、OCR/paid调用、门槛、source启用/DB配置更新或存量操作。尤其已知假正文ok必须另有真实业务质量判定，flag不能解决；合法summary-only稿若因来源正常流程无正文而全部hold，不能默默降低ready条件，须保留具体产品/能力缺口。安全摘要与原文链接及现有manual选择例外继续沿原实现，软件ready不代替业务事实质量或来源验收。

本次只追加同一报告，未执行测试、HTTP、DB、Git或代码修改。Luna完成两ID配置和负例，独立QA核销；后续仅按条件精确续批，不把本规则写成12核心全量自动批准。

Root随后补充Luna只读核销的两条真实行：`corebatch_test`预算司article `s411ti7pcubnwhgmza55uicgx`、URL `https://yss.mof.gov.cn/gongzuodongtai/202506/t20250625_3966523.htm`；`ingest_test`金融司article `sfz58qc6jd7t83eohtop1ihlg`、URL `https://jrs.mof.gov.cn/gongzuotongzhi/202512/t20251212_3979075.htm`。两行均unconfirmed、正文0字符、revision1、raw/attachment marker/DB strictflag为NULL，当前对应JSON未opt-in。这使无marker自动路径风险有具体行证据；本报告引用该Luna核验、不冒称亲自查询。原抽取响应/失败上下文仍unknown，不能据此推断selector或HTTP原因；两项配置保护许可不依赖先复原该原因，独立QA继续核现负例与配置效果。

## 2026-10-08 厦门财政地方债：仅安全暂停自动路径的精确例外

**XIAMEN_DEBT_HOLD_RESULT=APPROVED_SCOPE（exact ID dormant/pending保护）；Gate 2=NOT_PASSED，source admission=NOT_ADMITTED，machine body readiness=UNPROVEN。** 唯一对象为厦门市财政局 `xiamen-finance-debt`，不是财政部厦门监管局。此项单独批准安全hold，不按固定12核心standing的正常正文恢复条件宣称常规续批完成，也不扩展其他source。

只读核对实际JSON、保存 `.data/fiscal-source-audit/details/xiamen-finance-debt.html` 与selected-body/extract/jobs/editorial/group/publication代码：当前正文selector仍是 `.Custom_UnionStyle`；保存页该容器只有公告提示，业务PDF在容器外。现helper的页面身份字段不能读取此页的 `.article_time` 日期，因而在附件扫描和长度判定之前先拒绝 `identity_missing`，不能把历史报告的 `attachments_unprocessed`追认成当前运行结果；本轮未运行helper。配置selected-body抽取失败直接返回，不fallback Readability/Jina。历史205字generic Readability `ok`已被既有正文审计认定为标题、日期、扫码及页尾假正文；旧单次PDF验证只返回 `pdf_page_no_text`，不证明全文件扫描或可读业务字段。本轮没有同源机器正文positive，实际pending→非空ok的业务恢复路径仍未证明，不用合成ready稿填补此缺口。

**最小许可**：Luna仅为该ID既有 `_aihot`增加精确布尔 `requireBodyReadyForAutomaticSelection: true`，保留enabled=false、site_fulltext=false、syndicate_fulltext=false、当前日期/列表/body selector、每日检查和首次3个月配置。现成guard不依赖attachment marker；pending只可进入既有extract，失败成为unconfirmed后不进入自动queue/analyze/group/selected，none及空白ok同样hold。安全标题/摘要和原文章URL沿现实现保留，“正文待解析”投影及精确布尔manual选择例外沿既有规则；不宣称PDF附件URL已结构化持久化。允许长期待解析符合用户已确认的附件决定C及OCR延后决定，不需要先获得正文positive才能加强安全暂停；这不授权启用、DB导入、模型pilot或任何source验收。

flag不修复已存非空 `ok`假正文：`isBodyReady`只核状态与trim非空，抽取入口也跳过既有ok。旧205字记录、旧状态/日志/DB必须保留，不改写、不删除、不宣称已撤回或重解析。行业JSON新增flag也不会自动更新已导入DB source行。后续经正式Gate 2及模型授权的pilot须使用新隔离库和另行核实的真实业务样本，不能复制此错误sample或消费旧P3 jobs；解除本source能力hold仍需实际可靠业务正文证据，所需identity/附件支持另审。

**实施/QA边界**：仅精确flag及其allowlist/operator notes、适用负例fixture；不增加PDF/OCR解析、identity fallback、short-body豁免、schema、runtime、queue或none恢复算法。Luna与独立QA在当前39-ID冻结批结束后核销新增exact ID；source总数不变，若无其他变更则39→40，不并改已冻结四个codefiles。QA复用严格正文回归并以实际source配置、保存HTML核当前拒绝事实，fresh隔离负例验证无marker unconfirmed的hold、pending仅extract、零外部provider/receipt、旧analysis不能复活、当前公开精选投影与原文链接保留、none/empty/whitespace hold及manual/absent/false边界；合成非空ok只能验证既有软件ready分支，明确不计为本sourcepositive。本审查不核销尚未执行的QA，不要求重复HTTP或再取PDF。

**TASK**：厦门财政地方债未就绪自动路径的窄架构例外。**MODEL**：派发 `gpt-6.1-sol / medium`，一次审阅；项目provider调用0。**FILES_CHANGED**：仅追加本文，Root授予本段唯一append所有权，QA冻结期不并写。**TESTS_RUN**：无；仅静态文件读取，无HTTP、DB、模型、OCR、worker、测试或Git操作。**RESULT**：APPROVED_SCOPE，仅exact ID安全暂停，未实施。**RISKS**：旧非空ok假正文不受flag拦截；当前无可靠machine正文positive，附件结构化状态和恢复能力未证明。**BLOCKERS**：正文能力及来源质量缺口继续保留，Gate 2未通过。**NEXT**：Luna在当前QA冻结批完成后实施精确配置/断言与负例，由独立QA核销；保持disabled、隔离新库原则和旧DB记录。

## 2026-10-08 JSON外层编码：共享fetch的最小必要维护

**JSON_CHARSET_RESULT=APPROVED_SCOPE（仅JSON MIME跳过body内编码探测）。** 这是一项已确认真实字节证据支持的packages维护，不是Gate 2重审、NFRA准入或P4新增前置。正式[Gate 2结论](GATE_2_REVIEW.md)在固定 `edd0644ddcdee42de03eb21ad4704108f08000a5`上的三条HTML核心bounded pilot保持 `PASSED_FOR_BOUNDED_P4_PILOT`；NFRA仍待来源兼容性核销，不能据编码修正直接准入。

已静态读取actual `packages/backend/src/lib/http-fetch.ts:144`：`decodeBody`先用HTTP Content-Type的既有charset正则，有命中则优先该声明；无命中先默认utf-8，随后无MIME区分地扫描前2048原bytes的latin1视图，先HTML `<meta ... charset=...>`，再`encoding=...`，命中可覆盖默认值；gb2312映射gbk，TextDecoder异常才fallback UTF-8，末尾合并连续U+FFFD。`GuardedResponse.body`仍是原Buffer，只有text()调用该decoder。因而JSON字段中的HTML声明当前可错误改变整个外层JSON的解码，属于共享transport错误，不是NFRA原文或raw损坏。

独立QA的ignored `.data/fiscal-qa/govcn-nfra-source-20261008/nfra/raw-based-correction.json`记录列表raw SHA `a45ad64cf1313e75850616e77a2e1cf65036008e7b1e51e915c07c3d5c914600`、详情raw SHA `b6e46388f904c8c8fead84cc66997b0a11dc4eca79e02fd03de1556fa7fc2af7`；两者HTTP application/json且无charset，strict UTF-8 JSON有效，docId/date一致、标题按空白规范化一致。docClob为47038字符、0 replacement；内嵌gb2312 meta在响应byte1772。本文引用QA核验，不重新跑解码、请求或hash。保留先前错误derived manifest并标明已由raw-based correction替代；不得重写raw、删旧观察或称源端重新编码。

**允许最小变更**：只改上述文件decoder，在HTTP显式charset优先的原语义下，将Content-Type的媒体类型部分（去参数、trim、大小写无关）识别为application/json或有效 `type/subtype+json`时，跳过整个body内meta/encoding sniff，缺显式charset继续UTF-8。必须识别真实MIME而非任何字符串含json；application/problem+json、application/ld+json等属于该范围，application/jsonp或带参数文字json的text/html不能误中。非JSON或缺Content-Type继续既有meta→encoding探测及GBK行为；既有显式HTTP charset、无效charset fallback、replacement规范化不扩大、不重写。无需export私有decoder、新增配置键或source特判，优先在原函数局部完成。

原bytes、fetch/解压行为、maxBytes与deadline/runBudget、redirect、SSRF/DNS、dispatcher、provider receipt、2048字节探测上限及所有非JSON正文语义均不改。不得顺带实现NFRA分类flatten、JSON详情/body driver、adapter、日期authority、schema/apps或新来源配置；这些是独立来源兼容性工作。修复共有decoder是必要主线维护，但不把它设成原三HTML核心pilot的付费provider解锁前置。

**最低meaningful QA**：新增一份小的transport回归（可用 `tests/http-fetch-json-charset.test.ts`），通过真实 `guardedFetch(...).text()`的loopback或backend pinned Undici mock链验证，而非只复制decoder实现。UTF-8 JSON内嵌前2048字节gb2312 meta及encoding声明时，application/json、+json、大小写/参数变体仍JSON.parse正常，中文title/date/IDs与输入精确一致、0 replacement；body Buffer与送入bytes逐字节一致，text()重复读取不改bytes。另用确实GBK编码的fixture核显式HTTP charset优先（包括JSON）且不被内嵌冲突声明覆盖；非JSON HTML无HTTP charset的gb2312/GBK meta路径、encoding fallback和普通无声明UTF-8路径保持。检查jsonp等近似MIME不误中；含相同中文/ASCII字段的合成fixture足够，官方raw可离线复核但不提交或再次请求。mock必须拒绝未匹配联网；loopback如需既有私网测试开关，仅测试进程局部设置并finally恢复，不改变production guard。可复用既有transport边界回归，不为这次局部判定重造SSRF/预算框架。Luna实现后由唯一QA对冻结SHA完成focused及仓库fresh适用全套检查和同SHA CI；本scope不核销尚未执行结果。

**TASK**：JSON字段内HTML charset误导外层解码的窄维护范围审查。**MODEL**：派发 `gpt-6.1-sol / medium`；项目provider调用0。**FILES_CHANGED**：仅追加本文；已告QA本段sole ownership。**TESTS_RUN**：无；静态读取代码、已QA correction和测试模式，无HTTP、DB、模型、OCR、测试或Git操作。**RESULT**：APPROVED_SCOPE，仅最小MIME判断＋transport regressions，未实现。**RISKS**：显式错误HTTP charset仍按既有优先语义处理；修正UTF-8不是NFRA分类/详情兼容或来源通过。**BLOCKERS**：修复及独立QA待Luna/QA执行，不改变已正式通过的bounded Gate 2。**NEXT**：Luna仅改http-fetch.ts与专属测试，冻结后交唯一QA；NFRA保持未准入，旧错误derived证据和raw均保留。
