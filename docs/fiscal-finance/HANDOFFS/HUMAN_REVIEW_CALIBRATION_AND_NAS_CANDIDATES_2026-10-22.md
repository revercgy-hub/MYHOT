# 2026-10-22 人审校准与 NAS 候选恢复交接

## 最新状态：18条native摘要首发、恢复演练复核与新评分盲包（2026-10-22）

本节覆盖下文较早的“尚未prepare/apply”“fresh50待冻结score”等历史描述。当前branch `feat/fiscal-finance-hot`；工具/提示代码tip `67abdfb`（之后有独立文档检查点提交），base `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。NAS正在运行的Web/app仍是部署SHA `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`，Web端口3221；本地工具提交没有部署到NAS。Gate 2保持 `PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5均未通过。

NAS Staging当前有418 articles、445 revisions、418 discoveries；文章body状态27 `ok`、385 `pending`、6 `unconfirmed`。48个source均disabled，`site_fulltext`/`syndicate_fulltext`仍关闭。此前27条capture-backed正文CAS已独立逐行核验通过，Gold150旧批次整行hash保持 `95256427f9ec31cea491b8baf8b3231330128c16e17ee56a2d70802778e61a65`。之后Root批准的native摘要first-import仅导入独立grounding QA判为18 `PASS`项，另外9 `BLOCK`项不写入。QA文件 `.data/fiscal-qa/nas-candidate-batch-20261022/native-summary-qa-independent-27.json` SHA-256 `3ecfc7e8935ac7371010c991db64ca58a63bbac4971aee3e586bc5fe4f19f091`，绑定manifest `0d94e3ef03758778662f501bb61aeb58b76bd9fdf3af1707040933cd69d1480e`；NAS postcheck SHA-256 `7330dafebf1ad97c108fe26151c2c17466f7c418e8f4d30b6ab6a75a593adc83`，import result SHA-256 `14ada46680a60b73b136bfa3609abb667a7ce0ba6889025a5c87773d6a9612d7`。独立只读SQL再次确认18个PASS目标body hash/revision与postcheck相符，18 publications、18 overrides、18 pool rows；summary body mode、`selected=false`、score/reason null、indexable/syndicate false；9个BLOCK未发布。sources 48安全旗标均0，selected_state/ledger、analyses、receipts/attempts、jobs、fetch runs均0；revisions仍445、discoveries仍418。没有发source GET、provider或worker请求。

Fresh50仍是Gold200中新增的50条待标注项：Gold总数200，其中150 confirmed（26 select、124 reject）及fresh50全部pending，decision/source binding仍null。独立只读SQL按导入前锁定snapshot核验50条payload/body逐行及SHA相符；article 418、source 48及body状态正确。50导入postcheck v2 SHA-256 `06d87b8aeef9be3817acdbc79a14c860217186272dfd44361e87495966f6855b`在导入时间点显示expected `settings` heartbeat drift；此后native摘要首发发生，故相对同一Gate5 baseline的当前6个差异表为articles、audit_log、editorial_overrides、pool_search、publications、settings，均对应18条已批准摘要写入及API heartbeat；没有额外副作用。

Gate 5恢复演练的独立核验针对真正NAS目标库 `fiscalhot_staging_restore_20261022_snapshot_test` 重新计算64张public table哈希，64/64与同MVCC snapshot baseline完全一致，diffs为空。同步dump SHA-256 `7a46d69bbb9f4b2acaa75e22df1d6c41dc5edbfddaf522a375703cd07d253392`、mode 0600；baseline SHA-256 `bad3233a9059b1f212b92550dcfc017af86ff55baf3e1b68cb6d2b59591f1694`；verification JSON SHA-256 `30f817f26f3f681d8b676eac020d93d18102feb5731263393479fea5b8944541`。较早首个dump时间为21:42:06 +0800，后取baseline为21:43:20；两次snapshot比较唯一settings heartbeat行漂移的时间窗finding保留。同步baseline与dump在21:44:58使用同一exported MVCC snapshot；恢复子项PASS，但不是整个Gate 5 PASS。

Root收到的用户评分范围为“主要关注财政金融监管条线：财政支持金融、金融企业财务和金融风险等，其他条线优先重大政策”。最小提示修订SHA-256 `1bd9f51d25b30fa36409c6c7e8728a2be4b52125784898ebfe21295ccbddb34f`仅更新范围说明，五轴、权重、阈值、地方parity及安全规则保持；原development150 832a17结果仍是旧baseline（TP=11、FP=26、FN=15、TN=98；accuracy 72.7%、precision 29.7%、recall 42.3%），未以此改阈值。新评分用的是同一批冻结输入和同case逐字相同的scoreUser，fresh50仍是原holdout，不是新独立样本。第一次非sealed传输packet显式带出threshold后，Root中止并作废相关运行；其结果不采纳。之后只向新fork-none轮次提供sealed score-only文件，递归allowlist字段只有全局scoreSystem及每case随机opaque `caseId`/逐字`scoreUser`，没有threshold、prefilter结果、来源ID、body/input hash、Gold/human label、旧score或决策字段。开发150 prefilter通过的91例packet为 `.data/fiscal-qa/review-batches-20261022/sealed-blind-score-development150-score11b6-20261022.json`，SHA-256 `5bfa378ac0a174120e6f58ecae6f04f65ae548bfda8e5c155531f1e5ca7871f8`；fresh50 prefilter通过的31例packet为 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/sealed-blind-score-holdout50-score11b6-20261022.json`，SHA-256 `2b36b1268a77697f4e429cc82bdc2ae53931e3f95385a62920105cb664e25c98`。共同score system SHA-256 `0c7a98747104a7f682aa7b9118526d49727d3fdc9ae07c249ed92be13c02a975`；封包allowlist QA `.data/fiscal-qa/review-batches-20261022/sealed-score-transport-qa.json` SHA-256 `6c0bc474562092e1846f737bc79613fb3a196f0b3839023a4ed5d2a238f6844c`。两包各做两轮独立native评分中；在结果冻结前不读取fresh50人工decision/reason，也不以旧分数重采样。

最终代码提交分组为transport `93dd4c7`、body CAS `56c5bd1`、native summary importer `9ada0d3`、Windows OCR sampling race `8c6959f`、评分提示 `67abdfb`。测试在修复race后使用36-migration隔离Postgres库：full typecheck PASS、fullsuite 458 tests/457 pass/0 fail/1 skipped、Web build PASS、Web tests 22/22；OCR focused 38/38，Windows monitor focused重复25/25。初始两次suite的唯一失败日志保留在`.data/fiscal-qa/final-merge-20261022/npm-test-fresh2.log`与`npm-test-fresh3.log`；修复后结果见`npm-test-final.log`。NAS LAN只读smoke：3221 `/`、`/all`、财政金融分类和`/robots.txt` 200/noindex；internal `/api/health`、meta、pool与imported item detail均200，pool 18；selected/feed/full RSS及category feed均200且0 items，`/feed/all.xml`有16条summary items，未返回全文。无管理员访问或secret输出。

现Gate blocker仍为fresh50用户标注及独立评测、错例复核；Gate4覆盖证据与正式review；Gate5稳定性观察与正式review。完成新版score后，只能用已确认的150 development Gold做新旧baseline比较；fresh50在用户blind review前保持封存，不能根据分数重抽样或把score当人工标签。

以下为较早恢复记录，记录当时从本机 `.data` 证据恢复的Git branch `feat/fiscal-finance-hot`、文档更新前HEAD `b30af0f377fe29f37f6f39c8d0bb8f1449f03442`、代码恢复基线HEAD `efd47e51f7c878cd71df3370984294331c87a541`及base `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。其后operator代码与测试已分组提交；当前测试代码/提示tip为 `67abdfb`，最新文档checkpoint提交后HEAD另见Git log。NAS Staging固定运行代码仍为 `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`。本次handoff不代表本地工具代码已部署。

## 晚间增量：27条CAS已提交并通过独立只读后验

NAS operator在Root既有批准及fresh backup/zero-write preflight后提交27项capture-backed body CAS。计划SHA-256为 `6a5ba8c1213a0de3a278b8368288a58588a755ae3d75257caedca9aa345492a0`，正确418-rowset SHA-256为 `f56a4a3f7d9037cb5bb41761524f69e2a67fc01902296dedfec3b2bf2250cd7f`；提交报告为 `.data/fiscal-qa/nas-candidate-batch-20261022/nas-body-cas-result.json`，postcheck SHA-256 `ef9eb79eb3dc96f6be91180cebd841bc361f38e0fae6fffacd7771118389cb8f`。独立QA以repeatable-read/read-only事务逐行核验冻结baseline：418篇文章只有27个目标的body_text/body_html/body_status/revision/content_hash/updated_at允许变化，目标正文/hash与冻结proposal逐项相符，其余字段与非目标文章逐行不变；445 revisions包含原418逐行保留及27个proposal对应新revision；418 discoveries无变化。最终状态27 `ok` /385 `pending` /6 `unconfirmed`。48 sources整行hash `8d017180f9fdaa0aa101a9c1c3b24a0666ade2ba9adda3c64e905db7f1edcb98`且enabled/site-fulltext/syndicate-fulltext均0；Gold review 150整行hash `95256427f9ec31cea491b8baf8b3231330128c16e17ee56a2d70802778e61a65`保持。publication/analysis/receipt/receipt_attempt/job/fetch runs全0，pgboss表不存在。此QA只读，没有执行NAS写入、source GET、provider或worker。

## Native summary importer边界审查与fresh50状态

独立审查 `scripts/fiscal/nas-native-summary-import.ts` 的`--prepare`路径为安全边界PASS：只SELECT读取数据库身份、选定articles/sources及override/publication/analysis状态；拒绝非`ok`正文、非空既有override/publication/analysis、开启的source安全flag及非48 disabled来源集；不含HTTP/provider/worker/队列或SQL写。manifest绑定article/source整行baseline及body、prefilter/summary prompt全文与hash；输出限制在`.data`并通过`wx`/0600创建。尚未运行NAS prepare/apply。本地专用`*_test`测试2/2和typecheck由实现operator报告；full checks待A/B未提交代码收敛后执行。

fresh holdout50原始manifest/selection proof/body-only input未重采样或改动。独立native blind prefilter结果为31 PASS/19 BLOCK，仍无人标注；native score packet `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/native-score-packet-fresh-holdout50-score832a17-20261022.json` SHA-256 `d3c635ddfc3cf3e0944c683c072c3c18aba3b1c46e6cb1db2f3f6bb09be92c49`。下一步冻结独立score预测，再制作不暴露机器建议的用户盲审材料。development150结果不用于重新筛选fresh50；不据此更改60/65/76门槛。Gate 3/4/5仍未通过。

## NAS Staging 真值与采集缺陷

`.data/fiscal-qa/nas-candidate-batch-20261022/remaining46-actual-network-ledger.json` SHA-256 为 `fd73a1105c3db26357450286f01b487e15a367293f5271a1dded5f33ecf2277c`。证据分类 `RUNNER_DEFECT_RESULT_MISMATCH`：runner报告42次列表、详情0次；Undici捕获和逐项raw核验显示42次list + 30次detail，共72个HTTP 200。所有raw大小/哈希/EOF核验通过，无redirect。详情请求没有经runBudget登记，且没有保存dispatch timestamps，因此1秒间隔不能追溯验证。另有4个固定来源列表请求因scope guard拒绝，未发出。不得把历史runner汇总当作详情0；也不要重发已捕获详情GET。

Staging四来源后核快照 `.data/fiscal-qa/nas-candidate-batch-20261022/four-unattempted-native-rowset-postcheck.json` SHA-256 `f56a4a3f7d9037cb5bb41761524f69e2a67fc01902296dedfec3b2bf2250cd7f` 显示：`fiscalhot_staging` 共有418 articles/revisions/discoveries，包含原20条PBOC pilot和本批398条候选；48来源、0 enabled，site/syndicate fulltext保持关闭；412篇body pending、6篇unconfirmed；publications、analyses、receipts、receipt_attempts、job_runs、fetch_runs均为0。来源全行hash `8d017180f9fdaa0aa101a9c1c3b24a0666ade2ba9adda3c64e905db7f1edcb98` 与此前baseline一致。Gold review行hash `95256427f9ec31cea491b8baf8b3231330128c16e17ee56a2d70802778e61a65` 保持不变。PG boss表探测为null/无job表记录可读；不报告worker运行。

离线详情重放 `.data/fiscal-qa/nas-candidate-batch-20261022/remaining46-offline-detail-replay.json` 记录0网络、0数据库写、30条解析，27篇body `ok`、3篇hold。下一文件 `remaining46-offline-detail-cas-plan.json` SHA-256 `6a5ba8c1213a0de3a278b8368288a58588a755ae3d75257caedca9aa345492a0` 内含27项严格行CAS提案，明确 `proposal_only_not_executed`。它仍不是已写入状态；operator在Root既有批准范围内先做fresh backup与只读preflight，通过后才可提交；任一差异均停止并重新取证，不能重抓详情。本QA agent未写入NAS。

本机恢复仅使用原`.data/test-pg/cluster`：原PID 11132经`pg_ctl status`及进程路径确认属于该cluster，启动日志记录WAL恢复/fsync，最终`pg_isready`接受loopback连接；未重复启动、改名或删除PID。隔离测试库`fiscalhot_nas_candidate_test`有36 migrations，运行`node scripts/migrate.ts`返回up-to-date。operator报告两个NAS focused test文件真实PostgreSQL测试14/14通过、0 skipped，并且`npx tsc -p tests --noEmit`通过，其中包含stale第二目标使同事务第一目标更新整体rollback。独立查询确认测试后sources=48、articles/revisions=1/1、publications=0、临时`casfix_`/`casfail_`文章0；唯一测试fixture保持原identity，净影响0。较早无DB focused run的2个skip不作为最终通过结果。

独立代码审查PASS只覆盖测试与实现安全边界，不代替NAS现场写入前检查。CAS脚本SHA-256 `0d0007260d8f6c566b039df46016b623d04cc8515584beac104983b6244f84bf`；运行器SHA-256 `3767758641b9e044c77ddeef241f18a72e289dc3fc60e344b0ebd31cbb27880f`。CAS精确绑定plan hash `6a5ba8c...`、418-rowset hash `f56a4a3f...`，验证398新文章加20 PBOC文章合计418，另验证16条followup是既有新文章行的精确子集。现场preflight核对48来源及Gold 150整行hash/状态、418 articles/revisions/discoveries、非目标副作用计数和pgboss job；目标每行按完整native `to_jsonb`文本/哈希、revision、content hash、标题、excerpt、source、pending状态及body为null做CAS，新增article revision与更新在同一SERIALIZABLE事务完成。operator测试文件SHA `cefe8091d6a7655f9839bcf6233ea023360edbd50ab438179caa25ff88aa2334`。

## Gold development 与独立 holdout

开发集评估 `.data/fiscal-qa/review-batches-20261022/native-evaluation-development-150-score832a17-20261022.json` SHA-256 `57a0a5022dd19f209114befa4a237d709ab28a5c7ed20955328efab97f0141ef` 是offline native evaluation，不是runtime provider结果。150个development标签的confusion matrix为TP=11、FP=26、FN=15、TN=98；accuracy 72.7%、precision 29.7%、recall 42.3%。固定阈值决策保持。结果不足以过Gate 3，不应据此调整60/65/76门槛。150标签均已用于开发评估，不再作为独立留出。

独立未标注集合已在 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/` 冻结：manifest SHA-256 `18ed7e4bbc5bfc187400564e560a7ceeeaf29ea407adaa777e2cf1490f0b8e02`，selection proof SHA-256 `7abd95c498537fd09f981d7db3cd214b450594980408156a805c1756265e388c`。manifest为50个fresh正文候选；proof显示筛选前body-ok且近期502、development精确身份排除144、跨库精确去重后466、fresh pool 322、覆盖39来源。正文至少80字，按sourceArticleId、规范URL、identityKey、contentHash和正文UTF-8 hash排除开发重叠；相似标题只用于排除同一事件，未按native score/decision重新抽样。原始manifest/selection proof未修改。

本轮另依只读白名单从原始manifest与正文cache生成native输入，不读取人审字段、提案、event group、split或samplingContext，不变更原样本及顺序。input SHA-256 `57db0536bbb34bae6e38e626c9ed89efec29db580a0e4bbdcb1de024acff820e`，50正文合计55,126字符、每篇111–8,289字符；预处理由`eval-selection-native.ts prepare`完成。prepared SHA-256 `9a8467483e2a03f07b650d780d16c4b07ffb7c24d02ef5a758bf7d7c49ff86d0`，prepared digest `587c1ecbde488d5bae1e4ee90eaeda93f6bf91b911f9e642ad3b35be6cfc7d0f`。给fork-none blind prefilter的packet路径为`.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/native-prefilter-packet-fresh-holdout50-score832a17-20261022.json`，文件SHA-256 `486f79add092579bf65f609871afd5ea12c28a37ed47c67b3f75559a450974ee`、packet digest `41336bba9557fd91c2a0c97424dc7fbf0ad42ec379515b9d173a7d9c00ccbcd8`；50 cases，system+user prompt共118,682字符。prompt freeze为`selection-score@832a17cbc4`/system hash `58f4b8886b86abbac57969c892fcd2519f879119101f599312b95ee034776eae`、`prefilter@ee1af7f0cc`。这些只是冻结输入和预筛prompt；未执行native预测，未进行人审。

## 下一步边界

- 对operator最新CAS代码做只读审查并运行其focused测试；测试数据库只能用loopback、`*_test`/`*_ci`，如果专用库不存在可按仓库既定隔离方式创建；不设置真实provider key或endpoint。full suite若需模型fixture，只允许测试子进程 `MODEL_CALLS_ENABLED=true` 并指向localhost stub，其余所有副作用flags为false；NAS运行flags全false。
- 对CAS只做离线/本地测试验证；这次不做NAS写入、不发来源GET、不触发provider，也不改变用户Gold标签。
- 在50条holdout上冻结两次隔离native预测后才制作用户盲审材料。现有150 development结果已充分暴露，50条保持不看native分数的原始样本顺序与选样结果。
- Gate 3仍缺holdout人标、独立评估/错例审查及阈值决策；Gate 4仍缺计划范围来源与覆盖证据；Gate 5仍缺稳定性观察、恢复演练和正式review。Gate 2只保持 `PASSED_FOR_BOUNDED_P4_PILOT`。

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=67abdfb（tested code/prompt tip before this docs checkpoint; deployed NAS remains 21ca4d400bda9071f1e0b8761d404d1fc5b001e5）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS Staging: 27 body CAS + 18 native summary first-imports independently post-verified; 418 articles / 445 revisions / 418 discoveries; Gold 200
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3/4/5未通过
REVIEW=Fresh50为pending且同一holdout不重采样；42 list+30 detail raw完整但旧runner少报30详情且没有详情间隔时间戳
BLOCKERS=Gate 3 fresh50用户标注/独立评测/错例复核；Gate 4覆盖证据与review；Gate 5稳定性与正式review
COMPLETED=27 CAS独立PASS；18/27 native summary独立grounding QA和first-import PASS，9 BLOCK；Gate5同步snapshot恢复目标64/64；typecheck/fullsuite/Web build/Web22均通过
IN_PROGRESS=两组sealed score-only packet（dev91/fresh31）正在两轮fork-none native评分；用户新评分范围保持，旧832a17结果保留baseline
NEXT=完成新评分无损归一化和development150比较；fresh50盲审完成前不读标签、不用分数改样本、不调60/65/76门槛
```
