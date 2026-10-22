# 2026-10-22 人审校准与 NAS 候选恢复交接

本检查点从本机 `.data` 证据恢复，Git branch `feat/fiscal-finance-hot`，文档checkpoint父HEAD `96256609612c71966c2b15b6cf7ba73aa59e20e7`，代码基线HEAD `efd47e51f7c878cd71df3370984294331c87a541`，base `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。NAS Staging固定运行代码仍是 `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`。工作区NAS operator文件与测试未提交，归operator所有；本交接没有修改它们。恢复文档commit `9625660`只包含3份项目文档并已push。

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
CURRENT_SHA=96256609612c71966c2b15b6cf7ba73aa59e20e7（本次文档更新前；代码基线efd47e51f7c878cd71df3370984294331c87a541）
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS隔离Staging候选采集与150条development评估；NAS当前418篇，候选正文27项仅离线CAS提案
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3/4/5未通过
REVIEW=42 list + 30 detail raw均核验但runner少报详情、无详情间隔时间戳；CAS未执行；fresh50原始样本冻结且body-only input与native prefilter packet已生成，尚未预测/标注
BLOCKERS=27 CAS须先经fresh NAS备份与zero-write只读preflight；Gate 3–5证据未齐
COMPLETED=恢复`.data`真实证据；NAS418/48 disabled/0 publication-provider-job副作用核实；offline详情27 ok/3 hold；development150指标；operator测试14/14、0skip且local test DB净影响0，独立CAS代码QA PASS；fresh50预筛packet已冻结
IN_PROGRESS=fork-none Luna fresh50 blind prefilter；B待fresh backup和preflight后执行27 CAS
NEXT=冻结/核验fresh50 native预筛结果后制无native结果盲审包；CAS仅在Root既有批准的fresh backup和zero-write preflight全通过后执行；维持门槛、Gold标签和抽样不变
```
