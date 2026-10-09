# S1 GovCN durable continuation 最小范围裁定

**RESULT=APPROVED_SCOPE**。只批准显式 opt-in 的持久页观察进度及纯离线实现/QA；不批准来源运行、HTTP、数据库写入、模型调用、服务操作或覆盖完成声明。不重审已通过 Gates。本文件只审此次范围，实施和独立 QA 另阶段进行。

## 事实与选择

基线 `feat/fiscal-finance-hot`，HEAD `7fa6ad8a940671171ce5c35cbad4149c9c9e13f3`。已读 AGENTS、README、PROJECT_PLAN、STATUS、前次 JSON pagination scope，实际 json-list-pagination/json-list/config-keys/collect、HTML cursor/store 事务和 queueProcessing 接口。当前 `govcn_query_v1` 每运行 p1 开始最多两页，先读全部列表，再详情，最后 store；只有普通 initializedAt/lastOkAt，没有持久 JSON 页 checkpoint。collect 内 store 未传事务，不能直接以最后 source UPDATE 冒充逐页原子提交。

ignored `.data/fiscal-qa/govcn-pagination-20261009/independent-audit.json` 和 live-manifest 保存同期 p1/p2/p3，15 个唯一 material identities、15 条 pubtime 均在该次90日窗口，paramsVO 页号对应；观察到日期顺序不等于稳定排序契约。root count=0、sort=score，未证明终点、全类别或跨运行快照。新增游标只表示已提交观察页号；offset 页移动仍可能遗漏历史项目。不得命名或报告 completed/exhausted/90days_complete。

保留 `govcn_query_v1` 三字段、1..2页、1..12 dispatch 的既有行为，absent mode/legacy/NFRA/HTML 也不改变。新增且仅新增 `pagination.mode="govcn_query_resume_v1"`；精确三字段仍为 mode/maxPagesPerRun/maxDispatches，新模式 maxPagesPerRun 必须为2，maxDispatches 为安全整数2..12，建议7。detail.maxFetches 仍1..5、固定120秒总deadline、每请求最多25秒且受remaining限制；列表+详情共用预算、不retry/redirect。每运行总列表请求最多2次，每页raw rows最多5，总候选最多10；不把持久 nextPage 与本运行页数混用。硬编码 continuation 页号1..200，200仅工程上限，非来源终点；达到上限进入 blocked/page_cap，partial/unproven，不能自动创建新generation。URL、query及映射/详情固定契约沿用前裁定，只放宽新模式被验证后的 p 值；stateless直接入口仍拒绝p3。

## 第一页与续页的精确流程

新generation先持久初始化 nextPage=1；初始化只写已有 cursor JSON，不代表一页已完成。每次普通 poll 都读 p1，以运行当前时间及当前90日窗口发现新资讯；该 p1 freshness 写入不得改generation anchor/cutoff/nextPage。generation continuation 始终使用固定 anchorAt 和 cutoffAt=anchorAt-90*86400000，无论 initializedAt 是否存在。

若 nextPage=1，本次 p1 响应同时用于 freshness 和generation p1，两种日期过滤各自正确处理，material identity归一后只存一次；p1事务成功后 continuation目标为p2。若 nextPage>=2，则本次请求恰为 p1 与 nextPage；例如已提交p1/p2后下一运行是p1/p3，再下一次p1/p4。不得每运行重新创建游标或因firstImport=false重置p2。

先保留两次列表dispatch额度，详情不能使续页永久饥饿。允许先取得两份有界响应，再按页处理、逐页事务提交；第二份预取不推进游标。详情总cap5，两页共享material identity去重及detail目标去重；当前详情身份/date不替换、summary非body、严格正文hold和allowed/noise规则不变。未取得正文仍可保存pending metadata并提交该观察页，但必须报告pendingDetails，页提交不表示正文完成。不得为了推进页号把pending转ok或绕过正文hold；不新增补解析worker/自动详情重试机制，pending的实际完成证据仍在后续来源阶段补齐。

首次p1分支必须先提交p1才提交p2。后续freshness p1允许独立提交：续页失败时已存新资讯仍保留，nextPage保持未提交目标。freshness在事务内合并最新source.cursor，不得用运行开始时的nextCursor覆盖backfill键。freshness新资讯不能被固定旧generation anchor排除；generation行不得被当前滑动窗口替换。backfill标记按generation历史材料使用既有first-import语义，freshness新增当前资讯沿用普通发现语义，重复项目保留已有历史语义。

## 最小持久状态与事务

只使用 `sources.cursor.govcnQueryBackfill`，与webListBackfill分离。精确状态字段：v=1、generationId(UUID)、configHash(SHA256)、anchorAt、cutoffAt、nextPage、pagesCommitted、lastPageFingerprint(null/SHA256)、lastPageIdentityHashes(最多5个唯一排序SHA256)、state(active/blocked/config_changed)、stopReason(null/短字符串)、coverage="unproven"、updatedAt。nextPage=pagesCommitted+1，合法1..201；pagesCommitted0..200。日期严格ISO、恰好90日差，字段类型/上限/不一致/未知key均fail closed；不把旧stateless.lastPageFetched迁移成已提交页。不持久全历史identity set、raw page、detail snapshot或通用pendingPage状态机。

configHash规范化绑定source id/kind、完整config及tier/participation_mode/first_party这些材料/处理语义。每个dispatch前重新核对当前源/配置/游标目标；不把enabled从false变true。初始化和每页提交均在source row FOR UPDATE下重新检查generationId/configHash/state/expected nextPage；并行运行冲突失败而非两个请求各自推进。可复用现有HTML advisory-lock语义，但不能改HTML实现或建立共享pager框架。

每页 `upsertMaterial(material, tx)`、`queueProcessing(articleId,{db:tx})`、合并最新cursor后的nextPage/page计数/fingerprint、对应fetch_runs.detail及count更新必须同一事务。无需新增store层：在collect内加窄页提交helper或本模式专用路径即可。事务设置剩余deadline对应statement_timeout，开始/提交前assertActive；DB等待不能突破run cap。初始事务只建立generation，页事务仅在全部应保存的该页材料/队列成功后推进。若预算只限制详情，metadata pending可合法提交；HTTP/JSON/identity/DB失败则该页不推进。

失败重放保持同generation、同anchor/cutoff、同nextPage；已提交上一页不回滚，未提交页下次重新获取。动态响应可能变化，报告 replayRefetched=true/snapshotConsistency=unproven；不能宣称恢复到原响应。详情已发但页提交失败，下次运行可重试同目标，预算只按单次运行约束。配置漂移标记config_changed并停止；非法cursor/窗口不一致停止，不清空重建，不自动换anchor，不靠修改mode绕过。preflight要求generation anchorAt和updatedAt不晚于本run时钟；时钟倒退、日期溢出或不合法90日差均hold/invalid_anchor，dispatch=0，不修正时间继续请求。无需新增reset API，本阶段不实现generation reset。

空页、同fingerprint乱序页、无新增identity页仅停止并blocked，partial/unproven；不得当作来源terminal。fingerprint及identity应使用原始映射身份集合，先于日期/噪声过滤，避免全旧/全过滤页被误作无新页。上页identity最多5项只用于相邻重叠诊断，不能推导全历史无遗漏。全旧、短页、counts或排序不驱动完成；非空raw无法映射仍失败。failed fetch_runs要保留已经提交的页/材料计数及当前target，失败终结不得覆盖前页checkpoint。

## 精确文件范围与 QA

生产文件只准：`packages/backend/src/sources/json-list-pagination.ts`（新mode validator、bounded URL/page admission、cursor小状态/summary及固定/当前窗口参数）；`packages/backend/src/sources/json-list.ts`（新模式安全整数p1..200直接入口，原stateless仍1..2）；`packages/backend/src/sources/config-keys.ts`（新mode分派、NFRA保持拒绝）；`packages/backend/src/sources/collect.ts`（新mode窄分支、两页调度、事务checkpoint、freshness合并）。可选第五文件 `industry/sources.json` 仅govcn-policy-library从已显式stateless切为disabled resume opt-in；若不切，测试fixture配置即可。48源、42 exact strict IDs、全部disabled/fulltext-off保持。不得改schema/migration/apps/types/provider/worker/publication/HTML/NFRA/正文规则。

准许新增 `tests/govcn-json-resume.test.ts` 与 `tests/govcn-json-resume-integration.test.ts`、现有配置测试最小断言及docs实施结果。真实三页fixture可由ignored raw复制并保留hash/出处，仅作有限历史回放；p4+必须标synthetic，不请求网络。

离线MockAgent disableNetConnect测试：p1/p2→p1/p3→p1/p4、不重置；模拟一个月后p1包含generation anchor之后的新日期，该项通过current-run窗口、历史页仍按原fixed窗口，p1不得改pagesCommitted/nextPage/anchor；初次nextPage1同响应复用也须transaction成功才推进。覆盖当前窗口下界、generation窗口下界、exact anchor日及future/invalid，clock倒退/漂移/非法anchor均0dispatch；同页identity重叠/乱序、未知/非法/未来/旧日期、全过滤/短页不误完成；empty/duplicate/no-new/page200都partial/unproven；未知mode/key、resume页数非2、dispatch越界、非法游标/config drift fail closed；两列表优先额度、detail共cap5/dispatch7、120秒含body及事务等待、failure停止无多派发；所有legacy/Gov identity/HTML/NFRA回归。

纯offline集成test代码应验证真实transaction接口：在隔离fresh `_test`/`_ci`数据库且所有外部/付费开关关闭的独立QA阶段，故障注入第二材料upsert、queue write、cursor UPDATE、fetch_runs UPDATE、COMMIT，均不得留下该页材料/队列或推进；上一已提交页保留；freshness不能覆写cursor；重放幂等、config/tier漂移、并发cursor冲突、固定anchor、failed run计数正确。本次只批准写测试代码，不执行DB创建/迁移/写入或CI派发；mock纯函数测试不能替代这些持久化实证。typecheck及适用纯离线测试可运行，服务不启动/停止/重启，Git不commit。数据库QA未做时明确 SOFTWARE_PERSISTENCE_QA_NOT_RUN，不能判durable实现通过。

最低run detail在前次字段上补generationId、pollAnchorAt/pollCutoffAt、continuationTarget、pagesCommittedThisRun/pagesCommitted、nextPageCommitted、pendingDetails、replayRefetched、snapshotConsistency="unproven"、partial=true、coverage="unproven"。ordinary status=ok只代表有界软件成功；source admission、90日覆盖及终止证明另stage，不以此裁定替代。

## 八字段交接

**TASK**：S1 GovCN持久续页最小范围审查。

**MODEL**：静态源码及保存证据审查，无provider/外部模型调用。

**FILES_CHANGED**：仅本范围文档。

**TESTS_RUN**：未运行测试、HTTP、DB写入或服务操作；读取源码、文档、保存manifest/audit、Git HEAD/status。

**RESULT**：APPROVED_SCOPE，限显式govcn_query_resume_v1及上述四个必需生产文件、小JSON cursor/逐页事务；stateless默认行为保留。

**RISKS**：score offset跨运行会移动/遗漏，持久页号不是快照coverage；详情cap可留下pending；真实transaction/并发软件QA尚未执行。

**BLOCKERS**：实现和独立持久化QA未完成；真实terminal、稳定排序、source admission/90日coverage仍未证明；不新增付费或用户选择事项。

**NEXT**：按此精确范围实施，先离线测试，再独立核准的隔离数据库QA；继续保持partial/unproven，覆盖验收单独阶段。

## 实施与独立软件QA处置（2026-10-09）

Root结论：`APPROVED_SOFTWARE_FOR_OFFLINE_QA_ONLY`。代码commit `15e3464c0bff45af96e52514b831f2aba8fc6043`仅修改三个必需生产文件（`collect.ts`、`json-list-pagination.ts`、`json-list.ts`）及两个resume tests；`config-keys.ts`既有通用mode dispatcher已足够，无需修改。disabled行业候选保持stateless配置，source catalogue仍48项/42 strict IDs，全disabled/fulltext-off。

独立QA：focus6 broad 55/55；focus7 typecheck与fresh persistence integration 1/1；fresh `fiscalhot_govcn_resume_full2_test`迁移35项，backend 346/346、Web build及Web tests 15/15通过。full1的345/346失败为测试全库analysis计数导致的隔离错误，修复只调整QA断言范围，保留历史记录，不是runtime错误。

持久化DB实证限于两次list请求、零detail；没有验证并发collector或真实wall-clock expiry。7 dispatch/5 details仅unit。先前p=1/2/3仍是独立只读有限观察；本轮没有新HTTP，也未证明live history、90日覆盖或terminal。软件结论不等于source admission或Gate提升。GitHub Check run [37905438753](https://github.com/revercgy-hub/MYHOT/actions/runs/37905438753)的headSha精确为code SHA `15e3464c0bff45af96e52514b831f2aba8fc6043`；此段写入时为queued，现已终结success，见下方更正。

## CI及后续离线QA状态更正（2026-10-09）

上述本地QA裁定仍为 `APPROVED_SOFTWARE_FOR_OFFLINE_QA_ONLY`。GitHub Check run [37905438753](https://github.com/revercgy-hub/MYHOT/actions/runs/37905438753)现已完成success；`headSha`精确匹配`15e3464c0bff45af96e52514b831f2aba8fc6043`，`check`与`docker` jobs均success。该终态仅覆盖续页代码SHA，不覆盖其后的P4 test-only工作。

后续fresh `fiscalhot_p4budget_n1_20261009_test`完成35 migrations，budget-n1 1/1：9 fake POST（5 completed+4 received）、1 analysis、report reservation为空；重跑0 POST。test-only HEAD `e8525d46ddda64a0311b381c1b18b9f4c8045d67`又完成analysis/receipt事务提交失败与final-report写失败focused cases；均为MockAgent假请求，无付费，且未跑full suite/CI。以上P4测试不是本S1批准的source admission或付费执行。该续页实现没有测试真实并发collector、真实wall-clock expiry或live history覆盖，既有列表证据仍有限，不证明90日完整。
