# P3 剩余来源缺口核验（2026-10-07）

## 范围与当前阶段

本记录聚焦目前最明确的五项来源缺口：甘肃官方新闻栏目入口、浙江“动态简讯”JS跳转范围、青岛详情超时、云南列表/详情日期差异、新疆 URL 日期与列表/详情不一致。先离线复核现存报告、HTML、manifest和行业来源配置，之后按 Root 分批核准的4个精确URL各完成一次HTML GET。没有数据库、collector、模型、OCR、附件或付费API操作；证据保存在 ignored `.data/fiscal-qa/continuous-source-gaps/`。

逐局范围仍按用户已确认的35个财政部地方监管局新闻动态栏目；中央选登只是补充。Gate 2 继续 `NOT_PASSED`，这些有限观察不能作为来源准入或全覆盖证明。基线见[逐局矩阵](REGIONAL_BUREAU_COVERAGE_MATRIX.md)、[用户决定](GATE2_USER_DECISIONS.md)及[加速交接](HANDOFFS/ACCELERATED_P3_CHECKPOINT_2026-10-07.md)。

## 离线证据核对

### 甘肃：已找到“工作动态”列表入口，来源仍未通过

财政部官网目录保存页中已有甘肃机构映射 `http://gs.mof.gov.cn`。2026-10-05 的一次 HTTPS 首页 GET 超时，未得到栏目入口。Root 于10月7日另行核准对该 HTTPS 首页做一次独立GET，结果HTTP 200、最终URL与请求一致、完整读至EOF；raw为19,557字节，SHA-256 `15ac8f1c786a92b59e067bfabf38b6a572a8a0e9feb63a3de72ccf7f26d011ea`，manifest记录响应headers。页面标题和局名均为“甘肃监管局”。保存首页中实际主内容“工作动态”标题锚点为 `./gzdt/caizhengjiancha/`，精确候选列表URL因此为 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/`。第二锚点 `./gzdt/` 只标“工作动态”且为栏目上层，不替代主内容列表。

首批只请求首页，没有自动扩展到列表GET。Root 随后单独核准对该页面实见栏目URL进行一次HTML观察；栏目详情见下文。

### 浙江：“动态简讯”跳转只到图片新闻

保存的浙江首页在主导航中实际列出“监管工作” `./caizhengjiancha/` 和“动态简讯” `./dtjx/`。后者曾按精确 observed href 请求，保存响应只有379字节，并含明确脚本 `location.replace("./tupianbaodao_1/")`；这将目标精确解析为 `https://zj.mof.gov.cn/dtjx/tupianbaodao_1/`，但该次 one-shot 预算没有跟进请求。

之后对保存首页实际展示的“监管工作”栏目做过独立 GET：`https://zj.mof.gov.cn/caizhengjiancha/` 返回标题为“监管工作”的列表，9条同域 HTML 候选、声明16页；第一条详情也已有单篇验证。另有对动态简讯跳转目标路径的单独列表观察，报告标作“图片新闻”，共9条，范围比监管工作窄。故现阶段可配置的较强栏目证据是“监管工作”；不能把 `dtjx` 的图片新闻列表说成完整动态简讯或浙江全部新闻动态。

### 青岛：详情已重观测，内容边界仍有限

保存列表中首条详情的精确 URL 是 `https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998487.htm`，标题为中秋活动稿，列表日期为2026-09-30。该 URL 于2026-10-06首次请求按时限超时；Root 于10月7日另行核准一次新预算重观测。第二次精确GET返回HTTP 200、最终URL一致并读至EOF，无重定向；raw为17,408字节，SHA-256 `401be4ddbc5540dc5f685df675ca7bc5eca5324b7afd09496246a22df2f93eb4`。详情页标题、`h2.title_con`与列表标题经空格/NBSP规范化后相同；`PubDate` 为 `2026-09-30 16:33:00`，可见发布日期是2026年09月30日，与列表日一致。独立QA复解析 `.my_doccontent`，移除内嵌`style/script/noscript`后有6个段落、1,046个规范化正文字符、0个附件链接；原始one-shot manifest记录的2,764字符为容器 `.text()`，包含内嵌CSS，不能当作正文长度。页面内容为中秋慰问、职工健步活动、廉洁家风及文明倡议；这个样本没有具体财政监管事实。未请求附件，也未在该样本上推断青岛全栏质量或过滤比例。详情重观测填补“内容未知”的边界，但一次失败加一次成功仍不足以证明周期稳定或source pass。

### 云南：详情发布日期晚于列表与路径日期

已保存列表首行日期为2026-09-18，链接路径也含 `20260918`。精确详情 raw 的 `PubDate` 是 `2026-09-24 08:22:00`；可见“发布日期”和正文首行均为2026年9月24日，`ArticleTitle`、页面标题和正文标题相符。详情日期的三处页面内显示一致，而列表字段较早六天。当前证据不能解释列表为何保留较早日期（例如列表生成/更新机制未知），也不能推出其他文章的日期优先级。不要用 URL 日期替代发布日期；当前来源配置依赖列表日期，若要改用详情发布日期或发生冲突时覆盖，需先明确该来源的日期策略及适用范围。

Root随后批准核对一篇不同的已保存列表详情URL，作为不含列表/页面发布日期冲突的候选：列表raw中2026-08-27条目“财政部云南监管局：线上赋能 线下核查 多维统筹持续提升转移支付预算执行常态化监督质效”对应 `https://yn.mof.gov.cn/caizhengjiancha/202608/t20260821_3995882.htm`。2026-10-07单次详情GET返回HTTP 200、最终URL匹配、EOF，body 18,895字节，SHA-256 `1d6899ef3558f730b2ea2b7f7cc294a0e1859ae2a8dc34a147b94025a474a599`；`ArticleTitle`/页面标题/`h2.title_con`与列表标题匹配，`PubDate=2026-08-27 08:58:00`、可见发布日期与正文首行为2026-08-27。移除内嵌style/script/noscript后的 `.my_doccontent` 为1,656字符、9段，描述预算管理一体化系统线上监控、线下核查及转移支付预算执行监督；未观察到附件链接。详情URL路径token仍是08-21，但列表与页面发布日期一致，因此只作为这篇非冲突业务候选，不改变通用URL日期规则。此精确候选已由Root接受待配置；raw/manifest及离线复核保存在 ignored `.data/fiscal-qa/continuous-source-gaps/last-two-details-20261007/`。

### 新疆：列表与详情发布日期一致，URL 日期较早

已保存列表首行显示2026-09-24，详情 `PubDate` 是 `2026-09-24 08:32:00`，可见发布日期及正文首行也是2026年9月24日，标题一致。路径 token 却是 `20260717`。证据支持把这个 URL token 记为与页面发布日期不同，不能支持把发布时间改成7月17日。尚未知此类 token 差异在新疆是否常见，也不能仅凭一篇文章制定全局日期政策。

云南、新疆 saved detail reports 分别为[Batch 8 详情记录](REGIONAL_BUREAU_BATCH8_DETAILS_2026-10-06.md)和[Batch 9 详情记录](REGIONAL_BUREAU_BATCH9_DETAILS_2026-10-06.md)。本记录的结论复核了现存 HTML，而不是重新访问网站。

## 有界执行记录与下一请求

现有保存 HTML 已解决 Zhejiang 跳转目标的语义（图片新闻子栏目），也已逐字段核对云南和新疆的列表/详情日期。重复请求这三类 URL对栏目范围或来源级日期策略帮助有限；日期权威策略应先由来源配置负责人提案，若需要覆盖采集器通用解析语义，再单独交 Sol 审查。

Root 核准本批精确两个URL、dispatcher cap=2；新目录使用仓库现有 one-shot guarded-fetch 与 Undici budget helper。两请求按顺序完成，总用时约0.5秒；attempted/dispatched/rejected=`2/2/0`，Undici create/sendHeaders/headers/error=`2/2/2/0`。每个响应均保存实际headers、HTTP status、最终URL、完整响应字节数/SHA和EOF标记；程序native exit `0`。甘肃成功后只离线提取了页面中真实可见的新闻锚点，没有自动扩展到列表请求。

| 次序 | 精确 URL | 用途 | 实际结果 |
|---:|---|---|---|
| 1 | `https://gs.mof.gov.cn/` | 首页重观测；原始页面指向精确新闻列表候选 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/` | 1 GET，HTTP 200，19,557字节 |
| 2 | `https://qd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998487.htm` | 首条已知详情重观测；不换文章、不请求附件 | 1 GET，HTTP 200，17,408字节 |

批次精确URL清单、headers、状态、raw/hash、运行标准输出/错误输出和native exit记录于 ignored `.data/fiscal-qa/continuous-source-gaps/manifest.json`、`gansu-homepage.html`、`qingdao-detail.html`及相邻日志。QA已独立复核通过。

Root 随后单独核准甘肃实见栏目URL `https://gs.mof.gov.cn/gzdt/caizhengjiancha/` 的一次HTML GET。该页HTTP 200、最终URL精确匹配、EOF；raw 12,555字节，SHA-256 `2d30c52e5c3cd93e34dba0d183c971aadca43e2ddc27866ccaef9079dbc9f27e`。预算attempted/dispatched/rejected=`1/1/0`，Undici create/sendHeaders/headers/error=`1/1/1/0`，无redirect/retry，native exit `0`。页面标题为“工作动态”，栏目元数据 `ColumnDescription`、`ColumnKeywords`、`ColumnType`均为“工作动态”。主内容中有10个唯一同host `.htm`候选，实际列表锚点路径为 `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li > a`；脚本声明 `currentPage=0`、`countPage=10`，只是静态分页元数据，未请求其它页。

本页候选日期非单调，列表日与路径日期有3个样本冲突。最强的可读财政业务详情候选是列表第7条：2026-09-04，标题“财政部甘肃监管局：构建‘一二三’监管体系 推动甘肃中央财政监管工作提质增效”，精确URL `https://gs.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260821_3995880.htm`（列表显示日与URL token不同）。仅凭标题仍不判断正文或发布日期权威；本次未请求详情。其它日期/候选、完整headers、raw、manifest与runner日志见 `.data/fiscal-qa/continuous-source-gaps/gansu-list-20261007/`。QA已独立复核通过。

Root 随后核准上述第7条的单次详情GET，返回HTTP 200、最终URL一致并读至EOF；raw 23,013字节，SHA-256 `3cfab10e2e7b1e91d6607f9926a55a31661e8ca693212ac6ac7d2de1226fe8bf`。预算attempted/dispatched/rejected=`1/1/0`、Undici create/sendHeaders/headers/error=`1/1/1/0`，无重定向/重试，native exit `0`。详情`ArticleTitle`、`h2.title_con`与列表标题规范化后相同；`PubDate=2026-09-04 08:19:00`、页面可见发布日期和正文首行均为9月4日，匹配列表显示日。路径token是2026-08-21，仍与三个发布字段不一致；这说明URL日期不可靠，不能据此覆盖列表/详情发布日期。正文容器实际路径 `div.mainboxerji > div.box_content > div.my_conboxzw > div.my_doccontent > div.TRS_Editor`；独立QA移除style/script/noscript后核得2,923字符、16段，内容记录了超长期特别国债资金监管、转移支付审核/监督、地方财政运行、部门预算及债务监管等实质业务。保存页未见附件链接。此一条配对样本支持甘肃列表入口、标题/详情和日期字段核对；仍不足以证明历史覆盖、分页/周期稳定性或全栏目质量，不构成source pass。

页面日期行序非单调；列表日/path token不同的例子包括列表9月4日但URL日期9月28日、列表9月4日但URL日期8月21日、列表8月25日但URL日期8月13日。被核实的第7条详情的 `PubDate` 与列表都为9月4日。QA独立核验首页锚点指向、列表raw/manifest、10条候选、分页元数据及第7条详情raw/metadata/title/body均通过。详情raw、manifest、离线解析JSON和runner日志见 `.data/fiscal-qa/continuous-source-gaps/gansu-detail-20261007/`。

整个Gansu栏目链有3次分开授权的HTML GET（首页、实见列表、列表首个强财政业务候选详情），每次各自cap=1，无重定向/重试；没有对分页或附件继续请求。首个列表runner的一次准备执行因本地变量名错误在dispatcher安装前退出1次，budget未启动且没有HTTP dispatch；该日志单独保存在 `gansu-list-20261007/preflight-01.*`，修复后同一未用的一次GET预算成功执行，manifest/raw完整保留。

按Root后续指示，本来源证据阶段在这一组列表/详情配对及独立QA后结束；日期冲突策略交Sol做架构依赖审阅。浙江主“监管工作”列表已有同类有限观察；青岛详情已成功重观测。

## 地方监管局首批详情抽样（11个已知列表锚点）

为补齐目录中“已有已核验列表但尚无详情证据”的缺口，配置负责人先从已保存、QA复核的三批列表raw中导出首条精确同域详情锚点；Root核准后对下列11个URL各做一次直接HTML GET。没有遍历更多列表记录、生成替代URL、跟随重定向或重试。独立QA同时复核每个列表raw/manifest的SHA、标题和实际锚点；批次中10个详情获得HTTP 200、精确最终URL并读至EOF，辽宁单篇在20秒时限内超时且没有重试。总运行时间约22.6秒；Undici telemetry为11次create、11次sendHeaders、10次headers、1次error，attempted/dispatched/rejected=`11/11/0`。响应raw与headers已分别保存；SHA按`guardedFetch`返回的body字节计算，受Undici内容编码解压影响，不声称是压缩wire字节数。

以下10个成功页面的标题（标题、ArticleTitle、h2可用时）与列表标题匹配，空格/NBSP差异经规范化；PubDate日和页面可见发布日期均与列表显示日相同。QA对10个raw独立复核通过。正文计数取`div.my_doccontent`移除`style/script/noscript`后的规范化字符与段落；附件只统计页面中观察到的链接、没有下载。页面主题描述是此单篇样本的正文事实，不代表该局全栏质量或准入结论。

| 地方局 | 详情URL | 列表日 / PubDate | 清理正文 | 单篇内容观察 |
|---|---|---|---:|---|
| 天津 | `https://tj.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260929_3998309.htm` | 09-29 / 09-29 14:29 | 2,240字，8段 | 过紧日子专题培训与财政监管能力 |
| 河北 | `https://he.mof.gov.cn/caizhengjiancha/202609/t20260915_3997463.htm` | 09-15 / 09-15 15:23 | 384字，3段 | 中小企业发展专项资金重点绩效评价 |
| 山西 | `https://sn.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998420.htm` | 09-30 / 09-30 11:48 | 2,172字，18段 | 财会监督外勤检查的廉政责任与全流程防控 |
| 内蒙古 | `https://nmg.mof.gov.cn/caizhengjiancha/202609/t20260923_3998041.htm` | 09-23 / 09-23 17:41 | 1,596字，9段 | 财政收入监管与财政科学管理 |
| 辽宁 | `https://ln.mof.gov.cn/gzdt2/caizhengjiancha/202609/t20260911_3997251.htm` | — | 未取得 | 该URL单次20秒请求超时；无重试。另一个不同详情URL已成功核实（见后文） |
| 吉林 | `https://jl.mof.gov.cn/caizhengjiancha/202609/t20260930_3998472.htm` | 09-30 / 09-30 15:46 | 2,051字，17段 | 转移支付资金绩效自评复核、重点评价及整改 |
| 黑龙江 | `https://hlj.mof.gov.cn/caizhengjiancha/202609/t20260929_3998307.htm` | 09-29 / 09-29 14:14 | 637字，3段 | 普通高中办学条件补助资金办法及监管重点 |
| 山东 | `https://sd.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260922_3997968.htm` | 09-29 / 09-29 08:34 | 1,181字，7段 | 中小企业专项资金重点绩效评价；URL路径日期为09-22，与列表/页面日期不同，不据路径改日期 |
| 江苏 | `https://jsz.mof.gov.cn/caizhengjiancha/202609/t20260930_3998382.htm` | 09-30 / 09-30 11:01 | 624字，4段 | 总结正确政绩观学习教育，属于机关工作动态样本 |
| 安徽 | `https://ah.mof.gov.cn/caizhengjiancha/202609/t20260930_3998374.htm` | 09-30 / 09-30 09:51 | 233字，2段 | 现场观察地方债发行；正文记述专项债券发行268.07亿元 |
| 江西 | `https://jx.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260930_3998513.htm` | 09-30 / 09-30 18:10 | 386字，2段 | “三优”评选与青年调研结果，属于工作成果动态样本 |

这组证据足以区分“列表已有对应详情且正文可读”和“详情请求仍未知”，支持对已验证页面做逐篇候选配置评审；并不自动批准配置，也不证明来源长期稳定、分页完整、全栏均为实质财政监管内容或source pass。辽宁该批9月11日目标仍未验证；8月13日的另一条详情已在下文核对通过。所有成功页面均未观察到附件链接。请求清单、逐条headers/status/final URL/EOF/body bytes与SHA、dispatcher telemetry、raw和离线解析见 ignored `.data/fiscal-qa/continuous-source-gaps/first-details-11-20261007/`；一次无HTTP的本地preflight失败另存为`preflight-01.*`，修正批次4状态标记后才创建dispatch marker并执行获批批次。


### 辽宁与云南另选的业务详情（Root接受）

Root批准从已保存列表中另选两篇不同于先前待核/日期冲突样本的业务详情各做一次GET。批次于2026-10-07完成，用时536ms，HTTP hard cap=`2`，attempted/dispatched/rejected=`2/2/0`，Undici create/sendHeaders/headers/error=`2/2/2/0`。两次均HTTP 200、最终URL与请求一致并到达EOF，响应头 `content-encoding=gzip`；清单记录的字节数和SHA针对guardedFetch解压后的response.body，不冒称压缩wire字节。

| 地方局 | 精确详情URL | 列表日 / PubDate / 可见日 | 清理正文和业务事实 | raw body |
|---|---|---|---|---|
| 辽宁 | `https://ln.mof.gov.cn/gzdt2/caizhengjiancha/202608/t20260813_3995391.htm` | 08-26 / 08-26 08:16 / 08-26 | 1,535字、8段；农村环境整治资金重点绩效评价 | 18,765字节；SHA-256 `68490364580d6704f19143e182d3e585f8da87ad13301245f418ad9fb83cdfb1` |
| 云南 | `https://yn.mof.gov.cn/caizhengjiancha/202608/t20260821_3995882.htm` | 08-27 / 08-27 08:58 / 08-27 | 1,656字、9段；线上监控、线下核查与转移支付预算执行监督 | 18,895字节；SHA-256 `1d6899ef3558f730b2ea2b7f7cc294a0e1859ae2a8dc34a147b94025a474a599` |

两篇的列表标题、`ArticleTitle`、页面标题与`h2.title_con`匹配，清理后`.my_doccontent`可读，未观察到附件链接，独立QA通过并由Root接受。两条URL路径日期分别比列表/页面日期早13天和6天；这些样本只确认列表日与详情发布日期一致，不对路径日期作权威解释。辽宁先前超时的是另一条2026-09-11文章，保持该特定URL失败记录，无重试。云南较早的2026-09-18列表候选与详情日不一致仍单独记录，当前非冲突替代只支持这篇8月业务样本。批次raw、manifest、请求预算和离线复核见 ignored `.data/fiscal-qa/continuous-source-gaps/last-two-details-20261007/`。


## 阶段边界

当前仍没有对日期冲突采用“URL优先”的依据。云南此前那篇列表日期为9月18日的详情页面内多处发布日期一致、比列表晚6天；另选的8月27日列表业务详情与页面日期相同。新疆列表和详情页面日期一致，只有path token较早。这足以在报告中记录事实和保留逐来源冲突标记，但不足以把通用 collector 全局切换为详情日期优先。若只更改特定来源规则，应由来源配置负责人说明现有 parser 能力、影响和回归范围；任何通用采集器变化另交 Sol 审查。

所有未由 raw、manifest 或当前配置支持的栏目、selector、日期语义和覆盖状态均保持未知。来源仍 disabled、全文关闭；来源准入、90日覆盖和 Gate 2 状态不因本记录改变。



## 后续：甘肃一篇列表—正文配对的 legacy collector 最小 packet（仅离线准备）

Root要求下一步定位并准备此前福建实跑过的 instrumented legacy collector executor；此处仅记录可复用路径与改动边界，不运行collector、不建库、不写DB、不发HTTP。已有 executor 为 ignored `.data/fiscal-qa/p3-fujian-small-20261006/run-once.mjs`，配套 dispatch/响应体 observer 为 `.data/fiscal-qa/p3-fujian-small-20261006/fujian-dispatch-guard.mjs`，同目录 `preflight.mjs` 是 loopback-only 的网络边界预检；生产实现入口为 `packages/backend/src/sources/collect.ts` 的 `collectSource`，真实采集使用 `packages/backend/src/lib/http-fetch.ts` 的 `guardedFetch`。此legacy route 的 `collectSource` 不走 pagination；不启用 `collectWebListBackfill`，不改 packages/backend，也不改 production source row。福建实跑有独立 fresh `_test` DB、禁用source/fulltext、禁用worker/model/provider的证据，但对甘肃不得直接复用福建数据库或URL allowlist。

| Packet项 | 甘肃候选值 / 下一步 |
|---|---|
| 已存在来源 | `mof-gansu-supervision-dynamics`；`industry/sources.json` 中仍 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false` |
| 本次source fixture两条精确GET | 列表 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/`；单篇正文 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260821_3995880.htm` |
| 边界 | exact URL allowlist两项，总Undici/origin dispatch cap=2；每次GET 20s、HTML body上限6MiB、无redirect follow-up/无retry、共享总时限建议60s；无附件、API、模型、OCR或通知 |
| fixture限制 | 从甘肃production source对象做内存clone；fixture `allowUrlPrefixes` 限到上述唯一详情URL，使list parser只选中这篇；`initialBackfillLimit=1`、`detail.maxFetches=1`、pagination保持缺省/关闭，正文selector沿用已核实 `.my_doccontent`。不要改production JSON开启来源 |
| 已有证据 | list和detail都已分别QA通过，详情日期与列表同为2026-09-04；采集若运行应只触达这两条精确URL，不取分页或其它候选 |
| 复用方式 | 在新的ignored甘肃子目录中克隆现有`run-once.mjs`与guard，调整fixture和参数；不增加应用侧framework或改backend包 |
| 改runner时需替换的福建常量 | fixture/source ID、fresh disposable DB名与校验、source URL及exact detail list、allowlist/origin、detail/backfill=1、HTTP/collector hard cap=2和manifest任务名；dispatch guard接口接受`allowedUrls`/`expectedOrigin`，但其导出名与一部分失败代码仍写“Fujian”，须在离线克隆中确认每个allowlist和输出语义均随甘肃改变 |
| 授权前预检 | 先对克隆runner跑 `node --check`；再对已存在 `preflight.mjs` 的fixture最小适配并仅在loopback验证exact two-URL、超cap预拒绝、redirect不发第二跳、只接受HTML/6MiB界限、gzip列表先安全解压再检查exact detail candidate。离线校验两份saved raw的manifest hash、唯一候选标题/日期、fixture保持disabled/fulltext-off/no pagination；确认fresh local test DB目标名与35 migrations/零业务行方案后，将具体DB和写入清单回报Root。以上全部通过后仍要等Root另批collector真实执行scope；不得在此准备阶段执行迁移、插入source、调用`collectSource`或外发请求 |

这个packet只限定了可审阅的下一步；尚未创建甘肃runner克隆、运行loopback预检或真实legacy collector。此前福建 runner会写source/fetch_run、最多一篇article及可能的内容队列项，并初始化cursor/health时间戳，因此真实运行属于待Root新批的DB mutation。甘肃候选配对raw及HTTP evidence见上文和 `.data/fiscal-qa/continuous-source-gaps/`。




### 克隆版与本地 canary 已完成（等待真实采集授权）

已将福建受instrumented legacy executor局部克隆到 ignored `.data/fiscal-qa/continuous-source-gaps/gansu-legacy-20261007/`：`run-once.mjs`、`gansu-dispatch-guard.mjs`、`preflight.mjs`。未修改backend/packages或production source config。克隆fixture为 `mof-gansu-supervision-dynamics` 的内存副本：source及两种fulltext均关闭、`allowUrlPrefixes`仅含单篇已QA文章、`initialBackfillLimit=1`、`detail.maxFetches=1`、无pagination，正文沿用`.my_doccontent`。运行器写死隔离目标名 `fiscalhot_oct07_gansu_legacy_test`，只接受本机`127.0.0.1:5432`这个精确库名；本阶段未连接、创建或写入任何数据库，因此库是否已存在仍需未来授权运行前核查。真实运行入口必须保留 `ALLOW_PRIVATE_NETWORK_FETCH=false`、禁用worker/provider通知，Undici/P3共2 dispatch cap、精确list+detail allowlist、每请求20秒/6MiB以及启动后60秒`process.exit(124)`硬停；不跟重定向、不重试。runner本身没有被执行。

loopback-only `preflight.mjs` native exit `0`，manifest和stdout分别在 `loopback-preflight.manifest.json`、`loopback-preflight.stdout.log`。验证了准确的两条生产URL白名单及6类拒绝变体、redirect在第二跳前拦截、非HTML在body消费前拒绝、6MiB传输与gzip解压输出上限、cap=2在第三个origin dispatch之前拒绝。gzip端点使用已保存甘肃列表raw本地生成，响应头标记gzip；loopback解压后与原始列表逐字节一致：12,555字节，SHA-256 `2d30c52e5c3cd93e34dba0d183c971aadca43e2ddc27866ccaef9079dbc9f27e`。guard捕获压缩体4,488字节，SHA-256 `b6a3a91fbac3b6040423c1e8aa291a9a059c2a9882d2f770d1117ac310fa6090`，EOF=true。实际甘肃source config的list selector唯一解析该篇，显示日2026-09-04，标题与QA列表一致。该canary共8次本机Undici dispatch，0外部请求、0数据库访问、0 collector调用。

两次修复前的loopback失败manifest、stdout与native exit均作为`loopback-preflight-attempt-01.*`和`loopback-preflight-attempt-02.*`保留；第一次修复了列表标题NBSP规范化比较，第二次修复了capture目录跨执行重用导致的`EEXIST`。成功结果由独立QA复核中。未来的2条实际HTTP与DB collection仍需Root最终GO；本packet不构成来源准入或Gate通过。

### Root最终GO后的唯一甘肃 legacy run（2026-10-07）

Root最终核准后，先通过QA确认的本机PostgreSQL 17 `postgres` role只读检查目标库不存在；在`127.0.0.1:5432`创建`fiscalhot_oct07_gansu_legacy_test`，对该新库应用35项迁移，并只读验证连接身份、迁移数及所有业务表初态为0。随后只执行一次克隆runner；没有访问QA/preview/正式库。运行native exit `0`，开始至完成不到1秒，P3与派发guard attempted/dispatched/rejected=`2/2/0`，Undici 8.11.2 create/sendHeaders/headers/error=`2/2/2/0`。两个请求严格为获准列表及唯一详情，各自HTTP 200、最终URL一致、`content-type=text/html`、`content-encoding=gzip`、EOF=true；没有redirect/retry、第三个dispatch或附件请求。

| 请求 | 捕获实体字节（gzip编码） | SHA-256 | 实际结果 |
|---|---:|---|---|
| 列表 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/` | 4,402 | `bc1031388b55d4dc4262e3450416c645ba3836043afa836e2bd6243d827230da` | 200，EOF |
| 详情 `https://gs.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260821_3995880.htm` | 8,604 | `d4e11dac4708bc99c6060bb9fa4e14c18109a3eb0166d5e3e4db15bd3068b990` | 200，EOF |

legacy `collectSource`与`fetch_run`均原样返回`ok`，found=1/new=1，创建唯一详情文章，未修改或隐藏成功状态。存储页标题与QA已核列表/详情一致，body_status=`ok`，正文2,923字符，SHA-256 `915ef8b8ed4df330ff36dfa3982ab541e94e2ea2280a62cf5f1baba014bfec4d`。数据库时间戳显示`published_at=2026-09-04 00:00:00+08`、`published_at_claim`相同；原页面PubDate/列表日/可见日均为9月4日。URL中8月21日仅为path token观察，不覆盖发布字段。source表仍enabled=false、两种fulltext=false、health=ok；legacy写入`initializedAt`与`lastOkAt`仅表示这一次执行。隔离库运行后sources/articles/fetch_runs各1；analyses/receipts/publications/selected_ledger/job_runs均为0。仅有1个`content.analyze`队列项，state=`created`、`started_on`与`completed_on`均NULL，已独立只读确认未被业务worker消费；模型、OCR、推送和worker均未启动。

运行manifest、stdout/native exit与每条原始响应捕获均保存在 ignored `.data/fiscal-qa/continuous-source-gaps/gansu-legacy-20261007/`。独立QA正在复核live raw/hash及只读DB状态。此执行只核销甘肃一个列表—单篇详情的有界legacy样本；coverage仍`unproven`、sourceAdmission=`NOT_ADMITTED`、Gate 2=`NOT_PASSED`，不是近90日回填或来源通过结论；隔离测试库只保留审计事实，不用于增量采集。
