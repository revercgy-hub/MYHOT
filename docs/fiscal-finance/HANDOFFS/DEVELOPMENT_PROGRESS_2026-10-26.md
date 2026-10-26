# 2026-10-26 开发剩余工作盘点

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：回答“程序开发还有多少没完成”，将通用功能实现、行业集成、验收证据和外部运行依赖分开盘点。

**MODEL**：Luna High；本轮独立复核了既有e82e开发评分与exact10摘要draft QA记录；没有新增模型调用。

**FILES_CHANGED**：更新 `STATUS.md`、`PROJECT_PLAN.md` 与本交接当前状态。ignored `.data/fiscal-qa/`仅保留本轮证据；未改业务代码、数据库、运行环境或NAS。

**TESTS_RUN**：核验现有`eval-selection-native.ts normalize/evaluate`与Gold v2 development评估，见上面的e82e结果和SHA；独立QA检查exact10 post-CAS body结果与native summary grounding/canonical contract。没有运行软件测试套件，也没有新的provider/DB写入。source-metadata代码链旧结果仍为485/484 pass/0 fail/1 skip，typecheck、Web build、Web22通过；该链不是本轮全套回归。

**RESULT**：不能用一个开发百分比准确概括。网站和后台的大部分通用能力已经实现；财政金融项目仍未达到可交付验收状态。e82e开发集v2结果为TP16/FP27/FN8/TN99，accuracy 76.67%、precision 37.21%、recall 66.67%、F1 47.76%；同一v2标签下冻结cd0为16/30/8/96、74.67%/34.78%/66.67%/45.71%。这只是development-only事后对照，差异为3个FP转为TN，不能宣称泛化提升或通过Gate 3。两轮87条分数MAE为5.160920，16条单轮分数跨过各自固定阈值。剩余仍包括Gate 3正式裁定、25–35个高质量来源及地方监管局栏目覆盖、严格90天/每日运行的实证、附件失败处理闭环、Gate 4正式验收和Gate 5持续运行验收。详细顺序见下方“剩余工作”。

**RISKS**：P2 shard-02原per-shard audit有一个65字符哈希手误；已由只绑定原件与独立输入/index/session audit的sidecar记录，原审计/raw/分数未改，QA保持注明例外状态。e82e与cd0比较使用相同development标签，不能当作盲测或独立泛化证据；16/87的两轮分数分跨固定阈值也需要纳入Gate 3人工判断。

**BLOCKERS**：Gate 3仍为`CHANGES_REQUIRED`，e82e precision37.21%未达到自动精选要求；不调Gold/阈值或重开全面GateReview。五条PASS摘要draft独立canonical QA已过但尚未应用，若继续需Root精确hash授权；五条BLOCK摘要和十条正文HOLD排除。25–35来源与地方栏目覆盖、严格90天/每日调度实证、附件业务闭环、完整Gate 4/5验收仍未完成。Staging当前无worker，scheduler/cron和附件job配置状态未知。

## 已有实现与当前证据边界

- **通用站点与出版流程已实现**：首页、全部动态/分类/主题、热点/事件、日报周报月报、RSS/API/MCP与后台路由已在Web/API代码中；后端有采集adapter、内容预筛/评分/理解、聚簇/综述、publication读取层、报表compose及worker schedule。出处可从 `apps/web/app/routes/`、`apps/api/src/routes/`、`packages/backend/src/{sources,jobs,content,events,publication,reports,admin}/` 核查。存在通用实现不等于财政金融配置已生产运行。
- **后台复核、信源管理、评测、运行记录已有通用界面和接口**：包括信源试抓、内容诊断、review、SelectBench、runs、模型设置及管理员认证。正式admin支持`PATCH /api/admin/sources/:id`更新现有source config：`updated_at`乐观版本校验、supported-config校验和审计已实现；seed的`ON CONFLICT DO NOTHING`仅是幂等初始化，不代表缺少更新API。精确Staging batch仍用独立CAS来绑定本次目标/备份/保护行集，不是因为普通配置编辑模块不存在。当前项目是否有足够行业数据和完整操作链，仍需验收。
- **采集/附件有部分通用处理**：RSS、web list、JSON list等adapter、分页支持、正文抽取与PDF文本/OCR边界诊断已存在；但不可解析附件是否被持续标记为“待解析且不得自动精选”，以及Treasury附件业务路径，仍需单独核验/闭环。10/25 treasury PDF样本仍是 `attachments_unprocessed` 并保持hold。
- **行业业务规则部分已编码**：财政金融taxonomy、prompts、source目录及若干source-specific selector已实现并经已存响应测试；近90天/每日检查是行业配置目标，不能据此称严格90天和运行调度已验收。policy-release/Shanghai exact2 metadata-only CAS已后验通过；随后exact10 body-only CAS COMMITTED，C在10/26 02:04:09.944Z独立post-QA PASS（报告SHA `5280629c1d08dfbb4cf5c290b07484cd041d9d271ca8efb61e8c987b5dc33b55`），Staging为418/660/418、body242/170/6、pub/override126；Gold200、source flags、保护行集不变，10条HOLD留在pending rev1。exact10 Luna High native summary draft为5 PASS/5 BLOCK/0 UNKNOWN，C独立grounding与repository canonical validation均PASS（canonical report SHA `1c4ba7fbc13fa5f65be9cdb4306921b93b08eeda9603395d40a57d68d800ea3d`；manifest `c66dc66d17fa122146861dd5574b73959436532e377ad8a87824a640d902805e`，draft `499468530f60763e959dc8601d881cc3ab23346f829b9a5dd9a59316687356d1`）。这仍是未应用草稿：没有summary DB写或publication增加，5 BLOCK排除。Treasury PDF仍`attachments_unprocessed`并保持hold。
- **当前验证状态**：10/25最新source-metadata本地链485 tests/484 pass/0 fail/1 skip，typecheck、Web build、Web22通过。C在10/26只读检查观察到Staging仅有web/api/db容器，没有worker容器；API/Web镜像均是 `d45f0d9` app-only镜像 `sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`，LAN health和首页HTTP 200。单次inspect显示api/web启动于10/24 02:15:43Z、db启动于10/21 22:45:59Z且healthy，三者restartCount均0、restart policy为unless-stopped；这只是单时点uptime，不是跨周期连续health监控。Staging的COLLECT/MODEL/Feishu/IndexNow安全开关truthy值均false。未取得cron/schedule或附件job配置证据，不能推断其不存在或被关闭。此前NAS有界只读部署QA的 `PASS_WITH_DOCUMENTED_LIMITATIONS` 只覆盖那次部署保护和公开面。
- **行业数据现状**：C于10/26 02:04:09.944Z独立post-CAS核验`.data/fiscal-qa/fresh-source-metadata-exact4-20261026/independent-body-cas-postqa-r1-v3.json`（SHA-256 `5280629c1d08dfbb4cf5c290b07484cd041d9d271ca8efb61e8c987b5dc33b55`）：418 articles/660 revisions/418 discoveries，body242 ok/170 pending/6 unconfirmed，publications/overrides126，Gold cases200；48个source enabled/fulltext/syndicate flags全0，jobs/job_runs/fetch_runs/analyses/receipts为0。十条exact10 body HOLD保持pending revision1；其他保护rowsets通过。报告仅存正文hash。NAS运行容器仍只有web/api/db，没有worker；scheduler/cron与附件job配置状态未核实。该快照证明有界body import及保护条件，不证明来源覆盖或Gate通过。

## 尚未完成的工作（按先后顺序）

1. **完成Gate 3精选效果闭环**：e82e两轮评分已独立QA并使用现有native evaluator跑Gold v2 development150。结果TP16/FP27/FN8/TN99，P37.21/R66.67/F1 47.76；同一v2标签cd0冻结基线16/30/8/96（P34.78/R66.67/F1 45.71），仅为development-only事后对照，不证明泛化提升。Gate3按Root裁定仍为`CHANGES_REQUIRED`，原因包括precision未达自动精选目标；不调Gold/阈值、不重开全面GateReview。下一项可选工作是对既有development预测作离线错例归因，不新增人工标签。退出条件：Root确定后续是否有独立未使用样本与规则变化需求，再按原门槛复核。
2. **补足并逐项验收行业信源**：任务书要求约25–35个高质量来源，并明确全国财政部地方监管局新闻栏目逐局覆盖；目录计数和source配置不等于栏目通过。逐源证实列表、详情标题/日期、去重、分页和历史范围，记录允许/不允许自动精选的原因。退出条件：来源矩阵对目标栏目有可复核证据与明确准入结论，覆盖与质量风险由Gate review接受。
3. **验证首次回填与每日检查规则**：当前行业JSON写有约90天首次回填、1440分钟检查目标；但`initialBackfillMonths=3`与通用collector默认12个月并不能证明精确90天边界/无日期条目行为正确。通用scheduler/worker代码存在，但Staging无worker且schedule配置状态未知，daily job未实证。退出条件：以隔离样本确认边界日期、缺失日期、去重和发布时间，再于安全小规模运行中记录scheduler实际周期。
4. **验收附件失败处置链**：通用代码已有pending/unconfirmed状态分流、附件诊断marker及防自动分析/精选门控；常规failed项支持批量`processing/requeue`，单篇也有`extract/analyze/group`重跑和`contentChain`诊断。但批量requeue明确排除pending attachment marker；单篇extract rerun也会经过`queueProcessing`的marker守卫，marker未清除时不入队。当前未发现专用的附件hold批量重试/解除/复核API，因此这是附件专属管理闭环的缺口，不是基础状态分流没实现。本轮10条HOLD仍pending rev1，不据此推断全局情况；Treasury PDF仍未处理。退出条件：对附件缺失/损坏/无法解析样本验证marker、原URL、自动精选hold及管理员可见诊断，再通过经审计的人工解决/新证据路径清除marker并恢复单条处理；若确需批量附件操作，再按实际需求定义安全范围。
5. **完成端到端自动化与Gate 4验收**：通用页面/API/RSS/MCP及后台模块存在，但任务书要求25–35源完整实例逐项验首页、动态/筛选/主题、热点/聚类、日报周报、RSS/API/MCP、后台。现有软件回归主要是通用测试，尚非此规模财政金融完整业务验收。退出条件：fresh隔离DB，覆盖行业源配置和上述用户路径的测试/Smoke记录完整，正式Gate 4 review通过。
6. **完成Gate 5稳定运行与恢复验收**：10/26单次只读观察到Staging没有worker容器，数据库队列与job/fetch/model分析/receipt表为0；当前cron/scheduler或附件job配置状态未核实。api/web约45小时、DB约4天存活且restartCount为0，是一次inspect的uptime值，不构成跨周期连续健康证据。已有d45 Staging有限部署QA以及64/64 row hash、64/64 inventory、16/16 sequence验证都只是保护/恢复演练子项。还缺按任务书证明连续采集、worker、模型处理、事件/日报生成、重启恢复、备份、错误恢复和NAS smoke的正式Gate 5证据。退出条件：批准范围内小规模运行达到稳定观察要求，独立复核各项数据与恢复，再正式通过Gate 5。真实模型API凭据、NAS网络/存储和运维窗口属于外部运行依赖，不是单纯补代码可以替代。
7. **完成生产发布收尾**：生产隔离配置、固定通过Gate 5的SHA部署、回滚/备份策略，以及站点条款内容确认属于生产启动前工作，不代表当前代码缺少对应通用页面。`industry/pages/terms.md` 和 `industry/pages/privacy.md` 现为模板；任务书要求发布前负责人确认。退出条件：Gate 5正式通过后，按任务书production清单完成隔离部署与负责人条款确认。

## Gate与开发量的解释

当前 `Gate 2=PASSED_FOR_BOUNDED_P4_PILOT` 只表示限定小样的P4准入，不代表全来源通过；`Gate 3=CHANGES_REQUIRED`；`Gate 4/5`尚无正式通过结论。故剩余工作并非“把网站从零开发”，而是若要交付一个有证据支持、可稳定运行的财政金融热点站，上述行业质量、覆盖、集成和运行验收仍须完成。若只看通用软件框架，主要页面、后台、管线已有；若按任务书目标交付，仍有多个关键阶段未退出，不能折算为可靠百分比。

## RISKS / BLOCKERS

- 选择质量不能凭软件测试或development150的离线对比宣称改善；fresh50已消费，继续校准必须限制在development，独立效果验证需另取不重叠样本并在人审前冻结预测。
- 25–35是逐源质量要求，不是凑数量目标；地方监管局目录或单次页面访问不等于完整栏目、90日覆盖或周期稳定。
- Gate 5需要真实运行环境/凭据/观察窗口。保持采集、模型及外部发布安全开关关闭，直到对应Gate条件和明确执行边界满足。
- `Gate 5`的64/64、64/64、16/16只是恢复子项，不能表述为Gate 5已完成。

**NEXT**：Gate 3按Root裁定保持`CHANGES_REQUIRED`；可以只对既有development结果做离线错例归因，不加人工标签、不改Gold/阈值。exact10 body阶段已PASS后验；native摘要draft 5 PASS/5 BLOCK也通过C grounding/canonical QA，但未apply，若继续需Root精确hash授权summary-only写入。之后完成统一catalog fresh4、25–35来源/栏目覆盖、严格90天与daily运行证据、附件工作流实证、Gate4端到端验收和Gate5稳定/恢复验收。真实模型API adapter要求endpoint/key并经paidRequest；目前没有验证过的免费/本地provider路线，不能默认发生付费调用；若用户要求保持零付费，需先建立并验证零成本路线或维持模型安全开关关闭。
