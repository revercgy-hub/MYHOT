# 2026-10-22 人审校准与 NAS 候选恢复交接

本检查点从本机 `.data` 证据恢复，Git branch `feat/fiscal-finance-hot`、HEAD `efd47e51f7c878cd71df3370984294331c87a541`，基线 `589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。NAS Staging 固定运行代码仍是 `21ca4d400bda9071f1e0b8761d404d1fc5b001e5`。工作区有四个 NAS operator 文件未提交，归 operator 所有；本交接没有修改它们：`scripts/fiscal/nas-candidate-batch.ts`、`tests/fiscal-nas-candidate-batch.test.ts`、`scripts/fiscal/nas-candidate-body-cas.ts`、`tests/fiscal-nas-candidate-body-cas.test.ts`。只提交实际完成QA且通过的文档状态更新。

## NAS Staging 真值与采集缺陷

`.data/fiscal-qa/nas-candidate-batch-20261022/remaining46-actual-network-ledger.json` SHA-256 为 `fd73a1105c3db26357450286f01b487e15a367293f5271a1dded5f33ecf2277c`。证据分类 `RUNNER_DEFECT_RESULT_MISMATCH`：runner报告42次列表、详情0次；Undici捕获和逐项raw核验显示42次list + 30次detail，共72个HTTP 200。所有raw大小/哈希/EOF核验通过，无redirect。详情请求没有经runBudget登记，且没有保存dispatch timestamps，因此1秒间隔不能追溯验证。另有4个固定来源列表请求因scope guard拒绝，未发出。不得把历史runner汇总当作详情0；也不要重发已捕获详情GET。

Staging四来源后核快照 `.data/fiscal-qa/nas-candidate-batch-20261022/four-unattempted-native-rowset-postcheck.json` SHA-256 `f56a4a3f7d9037cb5bb41761524f69e2a67fc01902296dedfec3b2bf2250cd7f` 显示：`fiscalhot_staging` 共有418 articles/revisions/discoveries，包含原20条PBOC pilot和本批398条候选；48来源、0 enabled，site/syndicate fulltext保持关闭；412篇body pending、6篇unconfirmed；publications、analyses、receipts、receipt_attempts、job_runs、fetch_runs均为0。来源全行hash `8d017180f9fdaa0aa101a9c1c3b24a0666ade2ba9adda3c64e905db7f1edcb98` 与此前baseline一致。Gold review行hash `95256427f9ec31cea491b8baf8b3231330128c16e17ee56a2d70802778e61a65` 保持不变。PG boss表探测为null/无job表记录可读；不报告worker运行。

离线详情重放 `.data/fiscal-qa/nas-candidate-batch-20261022/remaining46-offline-detail-replay.json` 记录0网络、0数据库写、30条解析，27篇body `ok`、3篇hold。下一文件 `remaining46-offline-detail-cas-plan.json` SHA-256 `6a5ba8c1213a0de3a278b8368288a58588a755ae3d75257caedca9aa345492a0` 内含27项严格行CAS提案，明确 `proposal_only_not_executed`。这是可继续核验的候选，不是已写入状态。当前任务禁止远端写入，因此不得在NAS执行；若后续授权写入，先做只读现场preflight，确认当前418行快照、source/review hash、0 jobs/副作用及全部27个pending/null body行与CAS基线完全一致，之后才可在同一串行化事务提交。任一差异均停止并重新取证，不能重抓详情。

## Gold development 与独立 holdout

开发集评估 `.data/fiscal-qa/review-batches-20261022/native-evaluation-development-150-score832a17-20261022.json` SHA-256 `57a0a5022dd19f209114befa4a237d709ab28a5c7ed20955328efab97f0141ef` 是offline native evaluation，不是runtime provider结果。150个development标签的confusion matrix为TP=11、FP=26、FN=15、TN=98；accuracy 72.7%、precision 29.7%、recall 42.3%。固定阈值决策保持。结果不足以过Gate 3，不应据此调整60/65/76门槛。150标签均已用于开发评估，不再作为独立留出。

独立未标注集合已在 `.data/fiscal-qa/review-batches-20261022/fresh-holdout50-20261022/` 冻结：manifest SHA-256 `18ed7e4bbc5bfc187400564e560a7ceeeaf29ea407adaa777e2cf1490f0b8e02`，selection proof SHA-256 `7abd95c498537fd09f981d7db3cd214b450594980408156a805c1756265e388c`。manifest为50个fresh正文候选；proof显示筛选前body-ok且近期502、development精确身份排除144、跨库精确去重后466、fresh pool 322、覆盖39来源。正文至少80字，按sourceArticleId、规范URL、identityKey、contentHash和正文UTF-8 hash排除开发重叠；相似标题只用于排除同一事件，未按native score/decision重新抽样。没有native预测，也没有人标。严禁根据development结果重选、排序或删换这50条。后续应在隔离运行中冻结native预测输入/输出，再将盲审包交用户；不得把sidecar建议写进Gold标签。

## 下一步边界

- 对operator最新CAS代码做只读审查并运行其focused测试；测试数据库只能用loopback、`*_test`/`*_ci`，如果专用库不存在可按仓库既定隔离方式创建；不设置真实provider key或endpoint。full suite若需模型fixture，只允许测试子进程 `MODEL_CALLS_ENABLED=true` 并指向localhost stub，其余所有副作用flags为false；NAS运行flags全false。
- 对CAS只做离线/本地测试验证；这次不做NAS写入、不发来源GET、不触发provider，也不改变用户Gold标签。
- 在50条holdout上冻结两次隔离native预测后才制作用户盲审材料。现有150 development结果已充分暴露，50条保持不看native分数的原始样本顺序与选样结果。
- Gate 3仍缺holdout人标、独立评估/错例审查及阈值决策；Gate 4仍缺计划范围来源与覆盖证据；Gate 5仍缺稳定性观察、恢复演练和正式review。Gate 2只保持 `PASSED_FOR_BOUNDED_P4_PILOT`。

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=efd47e51f7c878cd71df3370984294331c87a541
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
STAGE=NAS隔离Staging候选采集与150条development评估；NAS当前418篇，候选正文27项仅离线CAS提案
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3/4/5未通过
REVIEW=42 list + 30 detail raw均核验，但runner结果少报详情且无detail间隔时间戳；review hash稳定；CAS仍未执行；fresh holdout已冻结50项但未预测/未标注
BLOCKERS=NAS operator代码/测试仍未收敛；当前不允许远端写入；Gate 3–5证据未齐
COMPLETED=恢复`.data`真实证据；确认staging 418 articles、412 pending/6 unconfirmed、48 sources disabled、public/provider/job side effects为0；离线详情30项中27 ok/3 hold；development 150评估TP11 FP26 FN15 TN98；50 fresh holdout选择证明已核
IN_PROGRESS=operator body-CAS代码/测试独立QA；holdout隔离native预测准备；用户盲审包待预测冻结后制作
NEXT=独立运行operator focused tests和CAS测试；仅做本地/只读preflight，不远端写入；冻结fresh50两次native预测；随后准备无分数盲审包；维持60/65/76门槛和全部source/provider安全阀
```
