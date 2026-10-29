# 验收清单

## 2026-10-29 09:49+08 恢复后当前验收

- [x] 故障归因有证据：03:30 summary entrypoint实际传了`--execute`；其`PLAN_ONLY`日志只是预检。真实execute因唯一业务pool连接被`sql.reserve()`持有PG advisory lock而自锁。02:00 oldnight状态另为`REVIEW_REQUIRED`/`LAUNCHER_FAILED_OR_INTERRUPTED`；不归因其持锁。06:00 collector log为`SKIPPED_LOCK_BUSY`。
- [x] 限定终止与锁恢复：仅终止容器内Node PID1281，API主服务未重启、restartCount0；保留once marker和lock inode76:161641，终止后无holder且前台取得/释放PASS。没有draft、intent、provider call或receipt。
- [x] 修复回归：operator改用专用PG advisory-lock session，业务池仍max1；隔离PG17.11 `summary_lock_20261029_test` focused 7/7，测试持锁时业务查询可完成、竞争锁拒绝、释放后可重取；typecheck PASS。
- [x] r6 bounded launcher安装：GNU timeout foreground限25分钟且不越过上海06:00，TERM后10秒KILL；保留02:00–05:59执行门、once、20 sources/max10/local-only/noRetry。容器timeout和时窗smoke由Core报告：TERM exit124、KILL exit137、目标PID退出；未提供独立原始smoke文件。首轮未加foreground的测试留下已退出zombie PID2072；不重启API处理该测试遗迹。
- [x] r6实际运行时hash/cron readback：operator `03fcf23c…2c3704`、launcher `f7012eae…e2efd146d`、runtime manifest `729d0b69…965ee311`、entrypoint `a411682f…1642c2d3`，API image ee9。4 owned markers实际读回；crontab 1900B/SHA `274649597fe358a92894df0ebc5b76385953ce5c701340f177517e86b656e338`。summary block本身483B/SHA `e64809e2…c7be1`精确；仅有一个安装器/readback追加LF，其他三份job命令不变，结论`PASS_WITH_DOCUMENTED_FORMATTING_DELTA`。
- [x] 安装后plan-only smoke：10 targets、providerCalls0、draft/intent0，once marker保留。它不证明有真实摘要生成。
- [x] 补跑06:00缺口的单次manual fixed46采集并独立核验：run `manual-recovery-20261029-0942`，46/46 sources ok、49 GET、5 new、3 detail、0失败/model/provider。49份raw response长度/raw SHA/decoded SHA及EOF/HTTP/no-redirect复核通过；五个new ID各自revision1+discovery1，0 publication/override。此run是manual，不记作06:00 scheduled success。
- [x] SQL及公开边界读回：510/804/510，body319/182/9，publications/editorial overrides137/137，Gold cases200、receipts0、source flags0。五个新条目没有公开。`/all`无7天过滤；直接no-proxy Web/pool HTTP200，137项/40每页/4页，latest published_at 10/27 09:35+08；近期没看到新文章来自无新publications，不是缓存/分页问题。private SQL/response QA sidecar `.data/fiscal-qa/manual-recovery-20261029-independent-qa.json` SHA `175e470abedf5d8a4f802a90b1fe7c483ccd333fc82f261a8854640f426aa82b`。
- [ ] 今日12:00/18:00 collector与10/30 01:00 backup仍待真实计划触发；下一次summary为10/30 03:30，除非用户明确许可白天一次执行（目前尚未答复）。Gate 3 `CHANGES_REQUIRED`，Gate 4/5未通过；来源90日覆盖、多个周期稳定性及逐条摘要人工审核仍开放。

详细时间线及版本见[10/29恢复交接](HANDOFFS/TRIAL_RECOVERY_2026-10-29.md)。

## 2026-10-29 01:20+08 开工验收快照（历史）

- [x] 42条正文 CAS及独立只读后验：`pending-body-20261028-r1`，42 proposals通过、8 holds未变、受保护rowsets exact、source flags关闭、Gold200未变；505/789/505，body306/190/9，publication/override137/137。post-CAS audit SHA-256 `81b6fc45bacf64063a04d23831b7412c3822ecbebbe0179eaf4a17a34db56813`。这更新了10/28快照，不能再写“未CAS”。
- [x] 新API/UI Staging只读QA：image897/ee9，LAN smoke30/30；匿名`/api/admin/summary-drafts`401、`/admin/summary-drafts`302登录；summary route chunk与本地build相同SHA42107b80…58891。公开all样例body null/noindex，selected为空。没有完成管理员认证操作或批准draft。
- [x] Summary nightly plan-only：r4 exact operator c2d231…799db；10/29 01:16 run `summary-draft-plan-20261029-0116-4081654` roster10 unique、10 `plan-only`、providerCalls0、once/draft/intent文件0。只证明计划解析路径可运行，不是生成10条草稿或03:30 scheduled run。
- [x] PG17 daily backup operator focused tests：旧版run operator/test SHA84a716…f495a9/900972…c2170测试9/9；已完成NAS manual run。后续存原schema.sql及normalized fingerprint增强版本SHA F50F86A5CA2A0AA1119A0E89F03226BD8C4C3CEFF535E722058B624289A43B1B、test SHA835FED67F1F55F6D9594FBB59E92142AFAFF1734575961B9AB4BFE14E4881E82，focused10/10+nodecheck PASS。备份不重跑。
- [x] 集成最终全树回归：typecheck PASS、npm 532 total/526 pass/0 fail/6 skip（旧228 artifact positive 1 + existing DB skips 5）、Web build PASS、Web tests25/25；Node24.16/PG17.11/36 migrations。日志见`.data/fiscal-qa/final-suite-20261029`。
- [x] NAS Staging app/runtime/cron readback：image `sha256:ee9ead66eb33d557bbc6206c975ed9649b87973a6de15b4049b4f18543ec54ba`，四owned marker latest06/12/18、understand02、summary03:30、backup01:00均逐条读回；(当前已部署状态不代表计划触发成功)。 final crontab SHA `843520657abd32fd389b82c2dd64f5cefa3ea3d585a33c6bb14b75dcae4fd2bb`/1898B/0600，marker外0字节。NAS 01:20:35+08时今日02/03:30/06/12/18待触发，首个计划backup 10/30 01:00。
- [x] NAS manual PG17.11 backup：run `pg17daily-20261028T170513Z-fb171fdf716d`，dump 2,036,885B / SHA `ace17130aca76b71dc60f75405d0214195e6c347ceeb404fa48c79d3b0a92da2`，manifest verified/manual，fixed `fiscalhot_staging`；mode0600，restore-list raw SHA match。schema raw 84,572B hash保留；PG17每次生成的匹配restrict/unrestrict token之外字节一致，normalized SHA `f0144ff2230accae53eaf9c7800558197bf071b26ea62c130b0d80a07276c666`。不prune/upload。01:00首次计划backup仍待10/30。
- [x] 独立隔离restore：现有PG17.11 image79bd…，唯一容器`fiscalhot-restore-trial-20261029`，`--network none`/ports none/mounts none，到`fiscalhot_restore_test`执行`pg_restore --exit-on-error --no-owner --no-privileges`成功。64 public tables、557 constraints、123 indexes、36 migrations；505/789/505、body306/190/9、publication/override137/137、receipts0。删除精确owned容器/副本，保留原dump；不声称全64表rowhash一致。Gate5仍未通过。
- [x] Oldnight source freeze与窗外NOOP：Node24.22.1私有runtime，`verifyFrozenFiles` 228 files、code manifest DFB2EDAA…0922B06、input95370FAA…1271517、wrapper84D754…FFD968、launcher8B2AB…08CAE5、package-lock canonical5C05F560…6E902C。client image54d1…与network-anchor ee9…分列；01:22 cron-style run `NOOP_OUTSIDE_WINDOW`、state/results aggregate SHA/1 file未变，lock76:161641同inode无holder，provider0。
- [ ] 按NAS 10/29 01:20:35+08只读确认：今日02:00 oldnight、03:30 summary、06/12/18 collector尚待触发；backup安装时已错过当天01:00，首个scheduled backup为10/30 01:00。安装、plan-only、窗外NOOP不能替代实际计划运行证据。
- [x] r2 final4部分捕获、proposal与backup-bound preflight独立QA：13 attempts=12 complete/1 timeout/8 notRequested；10 READY/11 HOLD、coverage incomplete，backup proof/preflight绑定一致且PREFLIGHT_PASS_NO_WRITES。
- [x] Root精确GO后执行一次10条r2 READY CAS并独立post-CAS QA：execute report SHA `331449edf41c39c221984aace994e4ae033e73a41d15ae7d9d4a796e0acb3d5e`；10条article及revision2正文/HTML/content hashes逐条一致，11 hold rows精确未变；articles/revisions以外所有冻结rowsets exact；counts505/799/505、body316/180/9、pub/override137/137、Gold200、receipts0、source flags0。独立sidecar `.data/fiscal-qa/pending-body-20261029-r2/recovery-r2/postcas-independent-qa.json` SHA `f01af15f20201d151c9340ea286a574e8d83190052731d71daa8c9146dfbc976`。partial coverage remains incomplete.
- [ ] 来源90日/分页覆盖及跨周期稳定性、body pending/unconfirmed处理、摘要逐项人工审核仍未完成。Gate 3 `CHANGES_REQUIRED`；Gate 4/5未通过。

当前分项与限制见[试运行交接](HANDOFFS/TRIAL_RUN_2026-10-28.md)。下方10/28记录作为历史快照保留。

## 2026-10-28 Staging试运行当前结果

- [ ] 10/28计划cron运行验收：02:00 understand及06:00、12:00 daily-latest均因owned QA PID `2630524`持共享night lock而skip；当日scheduled collector discovered=0。该历史仍算计划任务未成功，后续manual run不回填。
- [x] 既有Staging页面/出口只读smoke：`node scripts/smoke.ts --base http://192.168.3.100:3221`，2026-10-28 exit0、30/30；匿名`GET /api/admin/review-batches`为401，`/admin/review`为302登录；7日`mode=all`返回13条且均`selected=false`，`mode=selected`返回0；样例detail body=null、indexable=false，HTML/headers noindex。`readingMode=full`指非`visibility=summary-only`的常规detail projection，与body_mode/是否有正文正交，不代表全文权限；Root裁定本次没有正文泄露或待修缺陷。此项不勾Gate 4整体。
- [x] 20源manual bounded trial：`daily-latest-manual-20261028-1601`固定20源，30 GET、10新增，scope/raw/hash/7日窗口/预算均复核通过；10/10当前body hash与run结果匹配，各1 revision/discovery，0 publication/override，Gold/source/其余受保护rowsets不变。settings逐key唯一差异为heartbeat.api:3001的value hash和updated_at；updated_by不变，selected_ledger_epoch不变。DB只读快照较after约晚5分钟，非同一MVCC；没有逐请求timestamps，不能证明实际间隔。`PASS_WITH_DOCUMENTED_LIMITATION`。
- [x] remaining26 manual list-only trial：`remaining26-manual-20261028-1630`按实际app-root plan (`dfb833c2…`)和冻结operator执行一次；26/26 GET为HTTP200、完整、零重试/重定向、26/26 source结果ok、0失败、0详情，发现56条。39项bundle manifest及全部26 raw/解压hash独立复核通过；A核对56/56 ID/来源/URL/日期/body_status，before dump不存在，每项各1 revision/discovery、无publication/override。保护rowsets before/after无变化；当前较新快照只有heartbeat.api:3001更新，值hash/时间变，updater不变；selected_ledger_epoch完整不变。after 449/691/449→505/747/505，body264/179/6→264/232/9，pub/override137/137，source flags48/0/0/0。`PASS_WITH_DOCUMENTED_LIMITATION`：0详情导致56条并非可摘要正文；257列表项中56新增、25已知、176 parse-held；不能据此宣称90日/分页/源质量通过。没有逐请求timestamps，无法独立证明真实GET间隔。sidecar SHA `18fc0b87440e8106291c7ef9a06c37e3fe147f3749f48364db186d1eaeda01b7`。
- [ ] 正文清理：最新快照为505/747/505、264 ok/232 pending/9 unconfirmed；继续严格按当前revision/body hash更新待办和旧快照，不可靠正文保持HOLD。不由摘要生成器补正文或自动精选。
- [ ] 摘要草稿与人工审核：r4 Staging plan-only已读10个target、provider0、未写draft；待03:30首次真实job及逐项领域审核。`/admin/summary-drafts`审批只生成canonical `body_mode=summary` public publication，原文链接可见，body null、`selected=false`/noindex/不syndicate；它不涉及Gold或精选。管理员如另行决定精选，须通过`/admin/content`→“人工修正”→精选“强制入选”单独设置。旧受限visibility记录不迁移。
- [x] Gate5备份/恢复子项：一次PG17.11 manual dump verified，私有run目录、0600、sha/list核验；隔离restore exit0且临时容器已清理，business DB未重启。此为单次备份与恢复可读性子项，不能替代01:00计划运行、多个周期、受控重启/故障恢复，Gate5整体仍未通过。

Gate1与无关历史软件套件不在本轮重跑；冻结的core suite证据见`.data/fiscal-qa/final-suite-20261029`。部署后Staging route/smoke和operator plan-only验收不等于正式Gate4整体通过；25–35高质量来源/栏目及90日覆盖仍未证。Gate3仍`CHANGES_REQUIRED`，fresh50已消费；Gate4/5整体未通过。完整证据与后续计划见[试运行交接](HANDOFFS/TRIAL_RUN_2026-10-28.md)。

## Gate 1：静态行业改造

- [x] taxonomy、ITEM_TYPES、category fallback、topics 与提示词白名单一致。
- [x] 主题 slug 稳定；主题组显示为机构、重点领域、内容类型。
- [x] 关于页、首页及用户可见行业语义已改为财政金融。
- [x] 专属扩展功能关闭；机构发布域名映射限于已核验的官方域名，当前条目见 `industry/taxonomy.ts`，来源证据见 `SOURCE_MATRIX.md`。
- [x] 对站点品牌、开发日志、示例 Gold 数据和用户可见表单占位文案完成 AI 行业残留检查与处理；条款模板保留待负责人确认。
- [x] Gate 1 测试与审查在其验收时通过。这里曾记录的 `npm test` 132/132、web tests 11/11 和 loopback smoke 30 项是当时的历史回归，不代表当前 HEAD 的测试结果；Gate 1 审查核销见 `GATE_1_REVIEW.md`。
- [x] Sol 完成一次架构 Review；三项最小修复由 Lead 核销，`GATE_1_REVIEW.md` 记录 `FINAL_GATE_STATUS=PASSED`。Review 本身不替代上述测试 Gate。

## Gate 2—5

- [x] Gate 2：正式状态为 `PASSED_FOR_BOUNDED_P4_PILOT`，只允许 `GATE_2_REVIEW.md` 列明的三个核心来源中逐篇身份、日期、正文及附件均核实通过的固定小样进入有界 P4 准备；不代表48项来源目录、35个地方局或无人值守采集全部通过。
- [ ] Gate 3：Gold Dataset 开发集与留出集完成，精选规则和门槛有评测依据。
- [ ] Gate 4：25—35 个高质量信源、本地完整页面与 smoke 验收通过。
- [ ] Gate 5：NAS Staging 连续运行、实际备份恢复、重启和故障恢复验证通过后，才允许 Production。local备份job代码准备与测试不能替代任何真实时间观察或恢复演练。

### 2026-10-24 NAS Staging d45 rollout review

d45 app-only部署的独立只读QA为`PASS_WITH_DOCUMENTED_LIMITATIONS`：api/web实际运行镜像为`d45f0d93f5374b7c72cdf0efb64ada6a03b84404`，Staging smoke 30/30通过，匿名后台审核API返回401、页面跳转302，公开面检查包含noindex/RSS/新增类别。Gold200仍200 confirmed、原标签未变，来源48项仍关闭；articles418、revisions509、discoveries418，body为91 ok/321 pending/6 unconfirmed，publications/overrides各54。详见[NAS Staging当前部署与验收](NAS_DEPLOYMENT.md)和[10/24交接及独立QA证据](HANDOFFS/DEVELOPMENT150_AND_MAJOR_POLICY_2026-10-24.md)。此项只接受当前d45 Staging rollout边界，不表示Gate 3、4或5通过，也不是本地fresh-preview验收。

Gate 5已完成的64/64表行hash、64/64 inventory、16/16 sequence状态和受限restore权限仅是备份恢复子项。历史source rowset与当前只读行hash相同；settings仅heartbeat的`value`、`updated_at`变化，但可得快照并非部署前即时MVCC，不能据此声称全应用表在整个部署期间无变动。Gate 5连续运行、重启和故障恢复验收仍未完成。

## 当前证据

### 2026-10-18追加证据

Gate 2状态仍为`PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3、4、5均未通过。当前100条`gold/candidates-2026-10-18.json`仅为metadata DRAFT，validator `DRAFT_INCOMPLETE`、0 confirmed、100 pending；全部100条来源等级为T1，不能作为T1.5/T2校准或25–35高质量来源验收，也不代表NFRA、中国政府网及未来所有信源覆盖。正式Gold、真实development/holdout、provider质量评测均未完成。10/18人工审阅材料与精确证据见[本轮handoff](HANDOFFS/GATES_3_5_QA_2026-10-18.md)。

Root批准的分页page4/5隔离批次经独立QA通过，实际8个GET全部200；cursor 4→6，唯一新增16条重庆列表metadata，旧文章/修订/job队列和6条publication投影不变；来源继续disabled/fulltext-off，job未消费，90日coverage仍unproven。软件QA为backend 401/402通过、1 skipped，typecheck、隔离Web build、Web 17/17通过。API/Web进程创建被执行策略拒绝，健康和smoke记`NOT_RUN`；不能据此勾选Gate 4页面验收。NAS未执行，目标和访问信息待确认。

本节以 2026-10-16 检查点为准，详细运行状态及其边界见 [STATUS.md](STATUS.md) 与[本轮验收 handoff](HANDOFFS/FISCAL_ACCEPTANCE_QA_2026-10-16.md)。行业目录目前有48项来源配置，JSON中全部disabled且站内/转发全文均关闭；目录规模和配置测试不等于来源准入或覆盖完成。预览库有104条摘要型预览记录；这些记录不含正文，首页精选目前仍为空，也不代表正式模型分析、receipt、评分、精选或Gold。预览库记录及安全字段以本次导入和独立核验材料为准。

现有P4/P5工具边界彼此独立：`scripts/fiscal/p4-pilot.ts`只对显式文章ID生成只读就绪/调用预算计划；它不调用provider、不写分析或发布结果，也不保留预算。`scripts/fiscal/p4-execute.ts`是单独的显式授权执行入口；没有执行报告时不能据pilot报告声称已完成评分或receipt。`gold/metadata-template.json`仍是待人工标注的草稿，`scripts/fiscal/gold-dataset.ts`只能核验其结构/完整性；proposal不等于人工Gold，validator就绪也不等于Gold评测或Gate 3通过。以上工具存在、测试通过或网页预览成功均不改变Gate。

PDF解析、附件诊断和固定样本人工正文resolution已有实现及逐项证据；结果只适用于各自冻结文章与附件。扫描页或仅页码文本不能冒充完整正文，解析能力和单篇人工resolution不构成全源附件覆盖。当前代码回归与preview smoke只证明其被测试的本地软件路径，不替代真实来源的栏目/90日分页/跨周期证据、P4内容质量结论、Gold人工标签、Gate 4完整页面与运行验收，或Gate 5 NAS备份恢复和稳定性验收。
