# 2026-10-26 开发剩余工作盘点

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：回答“程序开发还有多少没完成”，将通用功能实现、行业集成、验收证据和外部运行依赖分开盘点。

**MODEL**：Luna High；本轮只读审查仓库、任务书及既有状态记录，没有调用模型。

**FILES_CHANGED**：新增本交接；更新 `STATUS.md` 与 `PROJECT_PLAN.md` 的当前检查点。另在ignored `.data/fiscal-qa/development150-score-candidate-e82e-20261026/` 准备了e82e development score-only输入、私有opaque maps、contracts与shards；未改业务代码、数据库、运行环境或NAS。

**TESTS_RUN**：没有运行业务测试；本轮用现有`eval-selection-native.ts prepare-scores`校验生成score packet（87 cases），再运行独立的prepare artifact validator，结果 `PASS_PREPARE_ONLY_SCORE_BLIND_PACKETS`。proof SHA-256为`57bda1565dae14a5f398d2a30b042b6ea61c407c3ecadbbd4985553936c18eaa`，独立validation SHA-256为`b5b5cd57fa8d0f79b798772b344d8b74b61c60ac6b25ffabbade421a36de4b16`。最新source-metadata代码链仍为10月25日485项/484通过/0失败/1跳过，typecheck、Web build和Web测试22/22通过；唯一跳过为未配置 `P3_PAGE_CONTINUATION_TEST_DATABASE_URL` 的固定gzip采集集成测试，结果清单为 `.data/test-pg/source-metadata-20261025-final/results.json`（SHA-256 `881d3261c12f076567d232d1c18e75ccd533467eb6bbfc05ff652fe069d5f16c`）。上述本地代码QA不是本轮全套回归重跑。

**RESULT**：不能用一个开发百分比准确概括。网站和后台的大部分通用能力已经实现；财政金融项目仍未达到可交付验收状态，主要欠缺Gate 3筛选效果闭环、25–35个高质量行业来源及全国地方监管局栏目覆盖、严格90天/每日运行的实证、附件失败处理闭环、Gate 4正式验收和Gate 5持续运行验收。详细顺序见下方“剩余工作”。

## 已有实现与当前证据边界

- **通用站点与出版流程已实现**：首页、全部动态/分类/主题、热点/事件、日报周报月报、RSS/API/MCP与后台路由已在Web/API代码中；后端有采集adapter、内容预筛/评分/理解、聚簇/综述、publication读取层、报表compose及worker schedule。出处可从 `apps/web/app/routes/`、`apps/api/src/routes/`、`packages/backend/src/{sources,jobs,content,events,publication,reports,admin}/` 核查。存在通用实现不等于财政金融配置已生产运行。
- **后台复核、信源管理、评测、运行记录已有通用界面和接口**：包括信源试抓、内容诊断、review、SelectBench、runs、模型设置及管理员认证。当前项目是否有足够的行业数据与完整操作链，仍需Gate验收。
- **采集/附件有部分通用处理**：RSS、web list、JSON list等adapter、分页支持、正文抽取与PDF文本/OCR边界诊断已存在；但不可解析附件是否被持续标记为“待解析且不得自动精选”，以及Treasury附件业务路径，仍需单独核验/闭环。10/25 treasury PDF样本仍是 `attachments_unprocessed` 并保持hold。
- **行业业务规则部分已编码**：财政金融taxonomy、prompts、source目录和若干source-specific解析配置在仓库；近90天初始回填与1440分钟检查目标写入行业source配置，但不能据此认定数据库已同步、无发布日期条目被拒绝或每日schedule已实际运行。10/25 policy/treasury/Shanghai selector已通过保存response QA，Root已审核并批准代码改动；B使用本地mock对四篇已存档文章完成当前selector replay（零官方网络请求、零业务数据库读写），报告为 `.data/fiscal-qa/source-metadata-offline-replay-20261025/current-parser-replay-v2.json`（SHA-256 `92298367cbb7d4d15e5eb77922bbf8b67ef3532d063ea44ce4007faa4e116680`）。10/26另对四个旧raw目标尝试fresh exact4 prepare，但Staging DB source config与repository private catalog不一致，guard拒绝且没有生成fresh operator manifest/proposal；没有DB写、GET或CAS。不能把10/25历史parser输出称为fresh提案。Treasury两项仍`attachments_unprocessed`，来源仍disabled、尚未准入或同步NAS。
- **当前验证状态**：10/25最新source-metadata本地链485 tests/484 pass/0 fail/1 skip，typecheck、Web build、Web22通过。C在10/26只读检查观察到Staging仅有web/api/db容器，没有worker容器；API/Web镜像均是 `d45f0d9` app-only镜像 `sha256:54d1a34f104b665ccdecc60e82f4cb67acf114fb3171b742990464ee6d4c7bc6`，LAN health和首页HTTP 200。单次inspect显示api/web启动于10/24 02:15:43Z、db启动于10/21 22:45:59Z且healthy，三者restartCount均0、restart policy为unless-stopped；这只是单时点uptime，不是跨周期连续health监控。Staging的COLLECT/MODEL/Feishu/IndexNow安全开关truthy值均false。未取得cron/schedule或附件job配置证据，不能推断其不存在或被关闭。此前NAS有界只读部署QA的 `PASS_WITH_DOCUMENTED_LIMITATIONS` 只覆盖那次部署保护和公开面。
- **行业数据现状**：C于10/26 07:16（上海时间）完成独立RR/RO数据库核验 `.data/fiscal-qa/runtime-independent-readonly-20261026/db-raw-sanitized.json`：418 articles/650 revisions/418 discoveries，body 232 ok/180 pending/6 unconfirmed，publications/overrides 126，Gold cases 200；48个source的enabled/fulltext/syndicate均为0，`pgboss.jobs`、`job_runs`、`fetch_runs`、`analyses`、`receipts`均为0。Gold case SHA-256 `fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`、rowset aggregate SHA-256 `eeaaf6273f59b6ac027539810ee2fb59e64376600d34e5c020432c9261b71b1a`与10/25 09:36Z核验一致；报告只持久化正文hash，未保存正文。该快照证明数据与有限批次操作，不证明source覆盖或Gate通过。

## 尚未完成的工作（按先后顺序）

1. **完成Gate 3精选效果闭环**：e82e selection-score候选已准备两轮独立native评分包，尚未评分，不代表效果改善。开发集150条中，只有在case/input/body/prefilter prompt/result hashes逐项相同后才复用旧prefilter结果（87 PASS/63 BLOCK）；这轮核实150/150完全匹配。pass1/pass2各含相同有序的87个评分prompt，使用不同opaque IDs与私有映射，各8片，单个60,135字符的评分输入独立成片。blind input没有Gold/fresh50/旧评分/prefilter标签或阈值。artifact proof和独立validator分别为 `.data/fiscal-qa/development150-score-candidate-e82e-20261026/candidate-preparation-proof.json`（SHA-256 `57bda1565dae14a5f398d2a30b042b6ea61c407c3ecadbbd4985553936c18eaa`）和`candidate-preparation-validation.json`（SHA-256 `b5b5cd57fa8d0f79b798772b344d8b74b61c60ac6b25ffabbade421a36de4b16`）。下一步由两个独立的fresh fork-none Luna High session逐片评分，再由独立provenance QA核验并仅在Gold v2 development标签上评估；保留阈值和Gold原始集。fresh50已消费，禁止用于调参。退出条件：Gate 3 review依据任务书及development证据作出正式结论。
2. **补足并逐项验收行业信源**：任务书要求约25–35个高质量来源，并明确全国财政部地方监管局新闻栏目逐局覆盖；目录计数和source配置不等于栏目通过。逐源证实列表、详情标题/日期、去重、分页和历史范围，记录允许/不允许自动精选的原因。退出条件：来源矩阵对目标栏目有可复核证据与明确准入结论，覆盖与质量风险由Gate review接受。
3. **实现并证明首次回填与每日检查规则**：当前行业JSON目标为首次约90天、每日一次，但`initialBackfillMonths=3`按30天折算且通用collector默认12个月；严格90天截止、无日期条目处理、历史发布时间保留和不冒充新鲜度尚未形成完整运行证据。每日1440分钟尚未证明已同步数据库并由scheduler实际执行。退出条件：隔离环境测试边界日期/缺失日期/重复项和发布时间，再以安全的小规模运行记录证明每日调度。
4. **闭合附件失败策略**：确认正文失败时原始附件链接保留、文章标记待解析且不能自动精选，并覆盖后台可见诊断与后续重试/人工处置；OCR目前按既有决定延期，不应把OCR延期说成Gate 2阻塞。Treasury PDF仍未处理。退出条件：测试证明附件异常不会静默变成正文通过或自动精选，并有人工复核路径。
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

**NEXT**：先用两个独立fresh fork-none会话完成e82e 87条score-only native评分并独立QA，再基于development Gold v2评估与错例处置；之后按来源矩阵补齐source正文/覆盖、严格日期和附件业务闭环；随后执行端到端自动化与Gate 4，最后开展有界Staging运行并审查Gate 5。production部署应在Gate 5正式通过后单独排程。PBOC及policy/treasury/Shanghai selector无需重复代码审查。四个旧raw的fresh exact4 prepare本轮被catalog-drift guard拒绝，未生成proposal。Root已批准先为两个已测试来源（policy release、Shanghai）准备仅三字段的Staging `DB.config` metadata CAS：policy标题/日期与Shanghai标题。C的独立计划QA结果为 `PASS_WITH_PREWRITE_PROTECTED_ROWSET_EVIDENCE_GAP`（报告 `.data/fiscal-qa/fresh-source-metadata-exact4-20261026/independent-source-config-exact2-cas-plan-qa.json`，SHA-256 `db36ab6613853b9dda2ea5e93f21e526bf8a4f5a0872f8b6a9eefb89af34b6b6`）：CAS/禁用flags/cursor/回滚核对通过，但执行前仍需全库备份及所有受保护表fresh rowset hashes。尚未写入。完成这些前置并由Root精确hash核准后，才应用再用统一Staging catalog链准备fresh4。该范围不更新其他来源、应用镜像或live目录，不启用采集/模型/worker，不改guard/packages/schema。
