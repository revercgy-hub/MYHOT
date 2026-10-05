# P3 检查点交接：区域来源受限真实验证（2026-10-06）

STATUS=IN_PROGRESS
STAGE=P3 / Gate 2 remediation
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=由接手者以 `git rev-parse HEAD` 实时读取；此交接不自引用自己的文档提交SHA
STAGE_CODE_SHA=本地回归检查的未提交工作树（`industry/sources.json` 19项；检查前提交基线仍为a00795ea5911afaa2bdf4ac31580b29a9c84a33c，后续提交SHA未知）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
ROUND_BASE_SHA=437c63e（本轮恢复开始时的branch HEAD）
WORKTREE=当前工作树含A的19项disabled来源配置候选、source规则/解析测试与8个synthetic fixtures；B正在按Sol批准范围实施S4 backend/body-readiness修复及回归测试，并在industry/sources.json的福建项增加strict opt-in。代码均未提交；S4前19源full green已记录为baseline；无本轮最终CI。接手时运行`git status --short`核对当前实际文件和index；`.data/`为ignored证据，不入Git。QA独占Git index。

## 阶段退出条件与结论

Gate 2要求逐局官方动态栏目、列表/详情身份与日期、正文业务质量、历史/分页和跨周期行为证据。当前矩阵有35局目录映射；Batch 1–9中32局获得目标工作动态列表首屏，厦门有既有有限列表证据，浙江另有一页“监管工作”列表及首篇详情；甘肃在首页请求超时且无目标列表。页面和collector只说明被观测的候选，不证明栏目完整或全量覆盖。

北京、福建、上海在fresh隔离`_test`库均已按批准的小预算运行真实collector。上海repeat list因一次GET超时保留为partial；北京首轮11个response body hash为unknown；福建唯一pending文章获批cap1诊断，结果`unconfirmed/non_article_container`、正文只有16字重复标题，旁边selector外PDF链接未请求。首轮warning无article ID，不能追溯归因。Sol只读审查发现无marker的unconfirmed正文存在自动分析/精选可达路径，结论`CHANGES_REQUIRED / APPROVED_SCOPE`；Root已安排最小source-specific正文就绪保护实现，尚未完成。A四源19-source工作树配置此前fresh full suite通过，但此为S4修复前baseline。新增的Batch6–9/Zhejiang详情观察已完成并经QA核raw/hash/预算。Gate 2保持`NOT_PASSED`。

## 完成内容与可复核证据

- 已提交代码SHA `a00795e...` 有15项；当前未提交工作树source配置为19项（14 HTML、1 JSON），四个新增配置disabled/fulltext=false。S4修复前fresh `fiscalhot_oct06_sources_final_test` 完成35 migrations、Node24 `npm test` 252/252、typecheck、Web build、Web tests 15/15、loopback smoke 28/28；这不是S4修复后最终QA。CI run [37281829324](https://github.com/revercgy-hub/MYHOT/actions/runs/37281829324)仅覆盖已提交SHA，Linux backend为252 tests、251 pass、0 fail、1个Windows-only skip。
- 2026-10-05 regional batch5–9新增尝试19局，18局栏目列表HTTP200，甘肃主页GET超时后无栏目请求/重试。QA独立核对目录href、首页到栏目锚点、Undici事件计数和所有成功raw bytes/SHA。各批报告： [batch5](../REGIONAL_BUREAU_BATCH5_2026-10-05.md)、[batch6](../REGIONAL_BUREAU_BATCH6_2026-10-05.md)、[batch7](../REGIONAL_BUREAU_BATCH7_2026-10-05.md)、[batch8](../REGIONAL_BUREAU_BATCH8_2026-10-05.md)、[batch9](../REGIONAL_BUREAU_BATCH9_2026-10-05.md)。
- 浙江“监管工作”精确栏目候选页获批GET一次，HTTP200、9条唯一同域`.htm`、JS显示16页、可见1个PDF未请求；本地raw SHA/bytes独立核验。它只补充栏目入口证据，不代表浙江整栏/历史窗口验收。见[浙江报告](../REGIONAL_BUREAU_ZHEJIANG_REGULATORY_COLUMN_2026-10-05.md)。图片新闻页和379字节JS包装页仍分开记录。
- 河南/湖北/湖南/广东列表首条详情各GET一次，总cap4，attempted/dispatched/rejected=4/4/0，4个request create/sendHeaders/headers，0 error；全为精确URL HTTP200，保存raw bytes/hash逐一匹配manifest。标题及列表/详情可见日期相符。河南1383字符/7段、广东1790字符/10段为财政监管业务内容；湖北235字符/2段是青年获奖宣传，湖南313字符/3段是内部公文/保密/内控培训。只代表各一篇样本，见[四局详情报告](../REGIONAL_BUREAU_BATCH5_DETAILS_2026-10-05.md)。
- 北京真实运行及本库终检见[北京报告](../BEIJING_REAL_COLLECTOR_2026-10-05.md)。fresh `fiscalhot_oct05_beijing_live_test`完成35 migrations、单source disabled/fulltext false。Collector cap11新增10篇；指定文章单次显式抽取cap1后body pending→ok、revision1→2、正文1696字符；list-only repeat cap1成功found10/created0/revised0。首轮11响应hash没有捕获，保持UNKNOWN。10个extract-body jobs均created、无worker；9篇仍pending，analyses/receipts/publications/selected/ledger/job_runs为0。
- 福建、上海的真实collector结果及独立终检见[福建报告](../FUJIAN_REAL_COLLECTOR_2026-10-05.md)与[上海报告](../SHANGHAI_REAL_COLLECTOR_2026-10-05.md)。两库各35 migrations、仅单个disabled/fulltext false source，无worker/模型或业务记录。福建首轮cap11，10新文章、9 body ok/1 pending；extract helper因目标已ok而0请求跳过，repeat list 1/1/0成功；末态9个analyze和1个extract job未消费。上海首轮cap11，10篇均body ok；helper亦0请求跳过。Repeat list GET仅dispatch一次后超时、无headers/body/hash，第二fetch_run失败，partial停止且未重试；数据库内容/revision/jobs不变。
- 本轮QA独立读取FJ/SH JSON与SQL，核对上列计数和报告；FJ首轮`non_article_container`运行warning没有article ID或数据库marker，不归因给pending行。上海repeat结果不可列幂等验收通过。北京/FJ/SH结果只是一次列表各十项附近的有限样本。
- 福建pending文章cap1诊断见[报告](../FUJIAN_PENDING_BODY_DIAGNOSTIC_2026-10-06.md)：唯一pending exact row经SQL确认，HTTP200、4391 wire bytes、runner hash `9ef4fad6dfe3e82b130222e41ededf5917a0adcbe9e655d0ccd9c9c5dd14a9c2`；该次reason `non_article_container`，状态pending→unconfirmed，revision1/title/date/body保持，无marker。gzip response离线展开12,147 bytes；body selector只有16字标题文本，无p/table/list；邻接PDF未请求。首轮warning没有article ID，不追认。下游审计与批准修复范围见[只读审计](../FUJIAN_UNCONFIRMED_SELECTION_GUARD_AUDIT_2026-10-06.md)和[Sol范围审查](../S4_ATTACHMENT_GUARD_SCOPE_REVIEW_2026-10-06.md)。
- 新增15个direct detail GET预算核销为15/15/0，事件create/sendHeaders/headers/error=15/15/14/1；14份成功raw的bytes/hash逐份匹配manifest，唯一失败为青岛单次20秒timeout且未重试。浙江监管工作首篇详情HTTP200，标题/日期匹配、666可读字符/4段、无附件；云南和新疆的list/URL日期差异未裁定，见[区域矩阵](../REGIONAL_BUREAU_COVERAGE_MATRIX.md)。
- 本地19项source候选的修复前回归：fresh `fiscalhot_oct06_sources_final_test` 35 migrations；Node24 `npm test` 252/252、0 skip；typecheck通过；Web build成功、Web tests 15/15；当前API `/api/health`和Web `/` 200，`node scripts/smoke.ts --base http://127.0.0.1:3000` 28/28。安全环境只调用localhost fake providers，真实key/baseURL/credentials清除；前两次npm test在setup guard因`DATABASE_URL`unset退出，未连库，正确fresh `_test` URL的第三次才是252/252。此验证早于S4修复。

## 环境与安全边界

上述真实Collector操作各使用对应fresh隔离`*_live_test`库和35项既有migrations；没有修改`fiscalhot_preview_test`。真实运行的`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、push、私网、OCR、embeddings、Jina flags均false，provider key/baseURL/secret被清除，credentials目录不存在；没有worker、模型、OCR、Jina或外部推送。真实页面请求为本次获批的固定官网HTTPS host/path，沿用P3 Undici 8.11.2硬预算、direct/no redirect/no retry。QA本身只读文件与SQL日志，没有新增外部请求或数据库写入。各fresh测试库的未消费queue条目保留原状。

## 未完成项、风险与阻塞

- 35局栏目范围、各栏历史分页/90日覆盖、日期语义、正文业务质量与跨周期仍未闭环；浙江首篇详情已观察，但无后续页/历史样本。
- 北京首轮11个response body hash未采集，后续请求不能补记为旧请求hash。福建有一个pending文章，首轮warning无article ID，尚未查清其对应关系。
- 上海repeat阶段dispatch后约25秒超时，无response headers/body/hash；整体partial、无retry。不要对该库重跑同阶段，也不要写repeat idempotency pass。
- 当前工作树19项source配置均disabled；修复前software QA已绿但最终S4修复回归/CI未完成，不能作为修复后验收或Gate通过。
- 无marker的unconfirmed正文自动分析/精选可达路径已由Sol审查确认，最小保护实现/复测待完成。邻接PDF仍未请求。
- 获批新增15篇候选详情观察已完成：14次HTTP200且raw/hash核验通过，青岛一次timeout partial；日期语义、来源范围与周期稳定性仍未知。
- Gate 2保持`NOT_PASSED`。生产source没有启用或导入；P4真实provider、P5人工Gold、P6/P7与Gate4仍未完成。

## 下一步

1. Luna High B按Sol `APPROVED_SCOPE`完成最小source-specific strict-body-ready保护与新增回归；不新增migration、公开合同或PDF下载，不破坏legacy RSS summary-only。
2. 对S4修复做针对性验证，并对最终combined code SHA运行一次必要fresh完整回归和CI。19源full green是修复前baseline，不重复dispatch中间CI。
3. Gate 2继续`NOT_PASSED`；sources仍disabled、未导入正式source表，无worker/model。后续补来源范围、分页/历史/90日窗口、日期差异和跨周期证据。

## 声明

没有由记录支持的事实不作猜测；本交接没有声称全35局来源通过、栏目稳定、daily scheduler运行、90日窗口完整或Gate 2通过。未提及的行为不视为已验证。
