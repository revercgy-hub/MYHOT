# 2026-10-22 人审校准与 NAS 候选恢复交接

本检查点从本机 `.data` 证据恢复，Git branch `feat/fiscal-finance-hot`，文档更新前HEAD `b30af0f377fe29f37f6f39c8d0bb8f1449f03442`，代码恢复基线HEAD `efd47e51f7c878cd71df3370984294331c87a541`，base `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。NAS Staging固定运行代码仍是 `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`。工作区operator脚本与测试未提交，归各operator所有；本交接仅修改项目文档。

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
CURRENT_SHA=b30af0f377fe29f37f6f39c8d0bb8f1449f03442（本次文档更新前；代码恢复基线efd47e51f7c878cd71df3370984294331c87a541）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS Staging 27条正文CAS已提交并独立后验；部署SHA21ca4d4，418 articles / 445 revisions / 418 discoveries
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3/4/5未通过
REVIEW=42 list + 30 detail raw完整但runner少报详情、无详情间隔时间戳；CAS目标proposal匹配、非目标与旧revision不变；fresh50 prefilter 31 PASS/19 BLOCK，仍无人标注
BLOCKERS=Gate 3盲审、独立holdout评测/错例复核未完成；Gate 4/5证据未齐
COMPLETED=27 CAS独立只读post-QA PASS；source48及Gold150 hash保持；发布/provider/worker/job副作用0；summary prepare边界审查PASS
IN_PROGRESS=fresh50独立native score冻结准备；summary-import专用_test 2/2及typecheck由实现operator报告，集成full checks待代码收敛
NEXT=冻结fresh50独立native预测，再制作不含机器结果的用户盲审包；其后独立评测；NAS first-import另需fresh CAS及独立QA；不改Gate门槛、Gold标签或原始抽样
```
