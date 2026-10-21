# 2026-10-21 有界大批量目录采集与正文处理交接

本交接记录本轮获批的48源列表元数据采集及两个隔离测试库的正文批次。此前[10月21日增量与正文候选检查点](P3_LATEST_INCREMENTAL_AND_BODY_REVIEW_2026-10-21.md)保留为上一阶段历史；此处结果不覆盖其代码与CI记录。两库是不同数据集，所有计数分开报告。

## 结果

主库`fiscalhot_catalog_sweep_20261013_test`的48个已配置官方源各发1次列表/base GET，48/48请求成功，发现498项，其中300项按既有身份跳过、198项新增。总预算上限60、每源最多1次、无重定向/重试/详情请求。48份响应均完整保存并独立核对字节数、SHA-256与EOF；无capture violation、敏感信号或provider调用。采集期间所有collector、模型、OCR、Jina、索引提交和worker开关均显式为`false`。源配置、cursor及旧文章内容未被更新；198项仅写入列表元数据，其中194项进入普通待处理队列、4项保持`unconfirmed`；没有启动或消费队列。

随后主库正文scope选择新增文章中的40项。执行34个直接详情GET，29项正文成功，5项保持`unconfirmed`，6项因相应来源首个失败后停止而未请求。34个请求中32个HTTP 200且原始响应完整，另2个为Undici错误23/超时，响应体0字节；没有重试。独立post-QA为`PASS`：仅34个目标article行、29条新revision和34条summary-only publication projection变化；非目标article/revision/publication与其它表稳定，jobs 588前后相同、job_runs为0。5个hold和6个未请求项均未生成正文摘要。

正文分页库`fiscal_pagination4_20261016_test`独立处理三批：30项/30 GET/30成功；40项/40 GET/39成功、1项`unconfirmed`；40项scope中实际30 GET、29成功、1项`unconfirmed`，同源后续10项未请求。合计100个详情GET、98项正文成功、2项`unconfirmed`、10项未请求。三批post-QA均通过；最终仅成功正文对应的98条revision及100条summary-only publication projection新增，非目标行及其他全局表保持稳定。两个失败分别为海南旧式正文容器被结构检查拒绝，以及重庆页面正文只有“见附件”并链接到未配置处理的PDF；未重试。

本轮实际HTTP GET总计182次：48次列表请求、134次详情请求。134次详情中127项成功、7项`unconfirmed`，另16个批准scope内的目标因来源停止而没有请求。MAIN最终640篇（407 `ok` / 211 `pending` / 22 `unconfirmed`）；PAGINATION最终153篇（102 `ok` / 47 `pending` / 4 `unconfirmed`）。不得把两库计数相加或称为独立材料去重总数。主库新增198条元数据，不表示198条均已读正文。

## 独立QA与运行边界

主库列表采集报告：`.data/fiscal-qa/bulk-collection-20261021/attempt-4/execution-result.json`。独立post-QA发现PgBoss producer初始化触发内置retention维护，删除了33条已过期的旧`cancelled content.analyze` job；它们于10月13日完成，`deletion_seconds=604800`，在本轮观测前均已过期。证据保留了33条精确ID、原行文本与行哈希：`.data/fiscal-qa/bulk-collection-20261021/attempt-4/pgboss-retention-evidence.json`。因此该次列表运行结论为`PASS_WITH_PGBOSS_RETENTION_FINDING`，不能声称旧job行集完全不变。另新增194条未启动`content.extract-body` job；job计数427→588。没有启动worker或消费job，job_runs仍0。未回填、复活或重建被清理的cancelled job。该retention finding不改变后续直接正文批次的post-QA结论。

MAIN正文执行manifest与独立报告：`.data/fiscal-qa/bulk-collection-20261021/main-body40/attempt-2/execution-manifest.json`、`independent-postqa.json`。冻结scope SHA为`9962c9c8e9344b2b0f4b36845c131b2043a4846bbadfe3f78ab4a3cc1fb23e4a`，baseline SHA为`67420279186cd1aac16c47b8f0cdce1f417a4c56ca8c5a8b79a7658fa5e14c08`。第一次attempt在HTTP/写入前因JS Date表示比较而安全中止；attempt-2以Postgres原生行文本及源行CAS重新完成preflight。此次是比较器表示差异，不是数据漂移。

分页正文批次manifest及独立post-QA分别位于`.data/fiscal-qa/bulk-body-20261021/`、`bulk-body-20261021-batch2/`和`bulk-body-20261021-batch3/`。Batch3在一次比较中曾出现revision漂移告警；随后使用PostgreSQL原生`to_jsonb(t)::text`逐行集合复核为0新增/0移除，226行全等，证实该告警是比较器/读取表示误报。列表日历日与URL日期段不一致的条目仅作为“待核验差异”排除候选，保留原列表日期且未据URL修改。

成功正文另生成127份Luna High原生摘要审计（MAIN 29、PAGINATION 98），均绑定对应article ID、来源、日期、revision与内容哈希；抽样覆盖检查确认批次成功ID无缺失、无重复。它们是基于已保存正文的描述性辅助材料，不是独立事实核验，不是`analyses`记录、Human Gold标签或模型provider receipt；未调用付费provider。正文projection保持summary mode且不可精选、不可索引/转发；来源仍disabled、全文/自动公开关闭，没有自动进入公开页面或feed。

没有代码变化，本轮没有重跑software test suite、build或CI。旧代码SHA `6159de76f55601dcdcfd640d00d74e2a085afc08` 的CI run `39530549243`仅作为上一代码检查点的历史记录，不代表本次文档HEAD的新软件验证。Gate 2仍为`PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3、4、5均未通过。48次成功列表请求不证明来源准入、90日覆盖或Gate通过。

## 后续

- 不自动重试本轮失败或未请求目标。下一次网络/数据库批次需要新的明确scope及fresh CAS QA。
- 按来源单独核验7项正文hold并决定是否需要新的来源诊断；海南旧结构和重庆未处理PDF各有保存响应DOM诊断，不能借此扩大到附件/OCR或模型处理。
- MAIN仍有211项pending、PAGINATION仍有47项pending；以逐条身份、日期与正文证据决定后续范围。
- 继续补来源质量与近90日覆盖证据，并按正式Gate条件推进Gate 3–5；不可从本次请求数推导coverage。

## 必需字段

```text
TASK=48-source metadata sweep + bounded direct-body collection in two isolated test databases
MODEL=Luna High for native summary audit; provider calls=0
FILES_CHANGED=docs/fiscal-finance/STATUS.md; docs/fiscal-finance/PROJECT_PLAN.md; docs/fiscal-finance/HANDOFFS/README.md; this handoff
TESTS_RUN=document consistency/link/status checks only; no software suite/build/CI rerun because tracked code did not change
RESULT=182 GETs total; 48 list successes; 134 detail GETs, 127 body successes, 7 unconfirmed, 16 approved targets not requested; A list post-QA PASS_WITH_PGBOSS_RETENTION_FINDING; both body databases post-QA PASS
RISKS=33 expired cancelled analyze jobs purged by PgBoss retention during main list run; seven unconfirmed bodies; source coverage remains unproven; native summaries are not Gold or publication eligibility
BLOCKERS=Gate 3–5 evidence remains incomplete; 211 MAIN and 47 PAGINATION articles remain pending
NEXT=review seven holds and remaining pending items under new scopes; gather source and 90-day coverage evidence; no automatic retry or publication
```

```text
BRANCH=feat/fiscal-finance-hot
CODE_SHA=6159de76f55601dcdcfd640d00d74e2a085afc08 (tested code checkpoint; no code edits in this documentation change)
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKTREE=clean before documentation edits; final commit SHA/status recorded in Git
```
