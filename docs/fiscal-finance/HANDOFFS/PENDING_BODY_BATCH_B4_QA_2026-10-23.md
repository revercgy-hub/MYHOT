# b4 pending-body 离线证据 QA 检查点（2026-10-23）

STATUS=IN_PROGRESS
STAGE=NAS staging pending-body b4；离线输入/解析证据QA完成；NAS writer已执行获批CAS，postcheck待独立核验
GATE=Gate 3 `CHANGES_REQUIRED`；本检查点不是Gate裁决，也不是正文写入完成证明
BRANCH=`feat/fiscal-finance-hot`
QA_HEAD=`cb9797cafb5c7aada23022b11570f7fc42f15afd`
BASE_SHA=`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`
WORKTREE=QA开始时clean；本次只提交文档，不改operator代码、b4原始输入/索引/proposal或数据库

## 阶段退出条件与结论

这次检查确认冻结batch、历史GET与响应raw之间的证据绑定，逐条核对body解析输入，并核proposal是否可从同一冻结材料确定性复现。所有离线检查均通过：20 targets来自11个source；20/20 raw response bytes/hash与manifest绑定，20/20 target row identity/hash匹配，19条proposal的body hash有效，1条保持hold。原先5个待新证据hold URL不在本次目标中。

这只完成数据和解析算法检查。20条全部是既有历史抓取，fresh GET为0，历史network cadence仍为`UNPROVEN_HISTORICAL_CADENCE`。Root随后已对精确19条READY proposal批准CAS，批准身份同时绑定manifest SHA `a57159d9701c1b2bc419ddbf2cc755ee742b05f8fb76253e8170eb9ab31a950b`、proposal **文件** SHA `a2149b340f241eb0b192ed73fef60412c371e4fd9f6c71d8dce645949fab90e9`、proposal bundle内部`inputSha256` `971dec5a0b87eb6a9370ae622c84c632a64f310f9ac02983c4f1d27f3b2ffbc0`及writer记录的fresh dump证明（完整SHA由其后验交接引用）。文件SHA与bundle input digest是不同字段，不可互称或互换。授权执行者正在实施CAS，实际写入与独立后验尚待完成；本批仍为`IN_PROGRESS`。

## 冻结输入、哈希与复核命令

| 证据 | 路径 / SHA-256 |
|---|---|
| NAS行manifest | `.data/fiscal-qa/pending-body-batch-20261023-b4/manifest-b4.json` / `a57159d9701c1b2bc419ddbf2cc755ee742b05f8fb76253e8170eb9ab31a950b` |
| 20条capture index | `.data/fiscal-qa/pending-body-batch-20261023-b4/captures-index-b4.json` / `56d18f64e67bb21699741b07b1de23cc1bdd8dd6eea67e56ae918491818b1da4` |
| excluded response URL evidence | `.data/fiscal-qa/pending-body-batch-20261023-b4/detail-response-exclusions-b4.json` / `6d5b89e225fe231e46025b07c07d551e861220d84ad6cea63d265398da8e1a11` |
| 冻结proposal bundle | `.data/fiscal-qa/pending-body-batch-20261023-b4/proposals-b4.json` / `a2149b340f241eb0b192ed73fef60412c371e4fd9f6c71d8dce645949fab90e9` |
| proposal input digest | `971dec5a0b87eb6a9370ae622c84c632a64f310f9ac02983c4f1d27f3b2ffbc0` |
| capture-set digest | `6440d3ae5e4790a298f930eefb552c1db84a9be5ea2263084802f7933f59f1af` |
| legacy inventory | `.data/fiscal-qa/pending-capture-inventory-20261022/inventory.json` / `a67f047a2e4b90afc7cbcd0b9abe66b9f470dbcaa5da702189b8e5fa06367ee2` |
| source catalogue | `industry/sources.json` / `efbd747f771fafd75370e3cbe02f45c01305b56fa8e765e992b7e28c0cc38eb5` |
| operator code bytes | `scripts/fiscal/nas-pending-body-batch.ts` / `113689cf00fab3ddab2d613f29776e5ba2045dafeb96fb8a0d1512d39478db4b` |

执行离线复解析：

```powershell
node scripts/fiscal/nas-pending-body-batch.ts --mode offline-parse --manifest .data/fiscal-qa/pending-body-batch-20261023-b4/manifest-b4.json --captures .data/fiscal-qa/pending-body-batch-20261023-b4/captures-index-b4.json --capture-dir .data/fiscal-qa/pending-body-batch-20261023-b4/captures-b4 --out .data/fiscal-qa/pending-body-batch-20261023-b4-independent-reparse-20261023.json
```

退出码0；结果`OFFLINE_PARSE_COMPLETE`，输入SHA保持`971dec5a…f2ffbc0`，19 proposals、1 hold。独立比较冻结bundle与复解析JSON完全相同；新报告仅在ignored `.data/`，未覆盖b4任何冻结输入。随后QA脚本以排序键稳定JSON重算snapshot/captures/exclusion/proposal digest，并逐条核对manifest、index、legacy inventory、原始响应、sources配置及proposal；20/20项校验通过。`offline-parse`只读冻结HTML和本地代码，不请求网络或连接NAS数据库。

## 逐项QA结果

- **目标与身份**：manifest 20条，article ID和URL各20个唯一值，覆盖11个配置来源。每个target的冻结row text SHA、article/source ID、精确URL、title、发布日期、revision、content hash及`body_status=pending`均相符。
- **原始HTTP响应绑定**：20/20 capture均记录GET、精确目标URL与response URL相同、HTTP 200、HTML content type、EOF。每个raw文件长度和SHA均匹配capture index；再由legacy inventory唯一记录绑定到原source manifest中的request ID、请求URL、rawFile路径和raw文件SHA，20/20通过。记录的时间是历史证据时间；capture index的`completedAt=null`按legacy schema保留。
- **来源配置**：20/20 source当前catalog配置均为`web_list`、`enabled=false`、站内和转发全文均关闭，配置了direct HTML body selector且URL落在各自allow prefix。manifest的catalog/operator SHA分别匹配本地JSON与脚本字节。
- **title/date/body**：离线parser使用冻结页面、source配置的title selector及PubDate regex，对成功解析19条验证title精确等于target title、发布日期落在来源配置时区的同一天；body selector均返回非空正文HTML/文本。bodyText字符数234–2225，文本/HTML SHA在proposal中逐条匹配。第20条`y07ju0meexzmuilo1dmaopdnl`被source parser以`short_body_not_allowed`拒绝，proposal bundle诚实列为`body_selector_declined`，body SHA `2dfdaab130d130fa7688cc5291040af60f30ed42b1b900c17777d4f6947967bb`，不得当作ready proposal。
- **旧hold排除**：5条先前hold URL在新的exclude evidence中均标为`offline-review-required`，全部被manifest target排除，仍待新证据。只改变排除状态，不表示重新抓取或修复了hold。
- **proposal分布**：冻结bundle含19 proposals、1 hold、`freshDispatchCount=0`、`legacyOfflineCaptureCount=20`、`historicalNetworkCompliance=UNPROVEN_HISTORICAL_CADENCE`。未调用Gold标签或模型预测作选择依据。

## 环境与安全边界

本检查没有网络请求、provider调用、NAS连接或数据库读写；没有正文CAS、发布、模型处理或任务队列消费。当前snapshot是manifest记录的历史只读快照：`fiscalhot_staging`、418 sources、418 articles、490 revisions、418 discoveries、40 editorial overrides、40 publications；这些数字是快照，不是本轮live查询。本地当前正文计数仍记录为72 `ok` / 340 `pending` / 6 `unconfirmed`；40 publications保持。该QA不声称计数已经再次实时确认，也不表示b4已有任何数据库业务变化。

同伴`/root/luna_next_body_scope`是本轮唯一NAS artifact/backup/preflight/CAS writer；其fresh backup与read-only preflight证据及已获Root批准的精确CAS执行范围，以其独立报告为准。本QA没有读取或更改同伴计划写入的backup/preflight文件，也没有执行任何CAS。本轮只授权19条READY，不包括1条hold。

## 未完成项、风险与阻塞

1. proposal通过本地离线算法与证据校验，不代表NAS当前rows与manifest仍匹配；需fresh backup及fresh DB preflight重新确认CAS前置条件。
2. legacy GET cadence不能从现有原始证据充分证明；因此不能转述为本次有间隔保障的新网络调用。
3. `body_selector_declined`保持hold；19 proposals仅表示可进入后续独立preflight的算法候选，不等于已写入或业务验收。
4. 旧5个hold没有被重新抓取、重解析或解除。

## 下一批 Agent

NAS writer已报告Root批准并执行限定19条CAS，operator结果为COMMITTED（19条、各创建revision 2，1条hold）；该writer交付后，独立QA须从fresh post-snapshot核验expected 91 `ok`/321 `pending`/6 `unconfirmed`、509 revisions、publications 40、sources 48、Gold200及受保护行集未变，再判定是否可结束b4。writer随后准备19条native-summary输入；那是新阶段，必须独立grounding QA并经Root另行批准才能发布。当前Gate3正式结果见[Gate 3 review](../GATE_3_REVIEW.md)：`CHANGES_REQUIRED`，与b4正文处理独立。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立审查pending-body b4的20条历史response与19条body proposal，不读写数据库。

**MODEL**：本地确定性离线parser；无provider或项目模型调用。

**FILES_CHANGED**：仅新增本handoff与ignored reparse结果；b4原manifest、exclusion evidence、capture index、raw和proposal未改。无源码、数据库或NAS业务数据变更。

**TESTS_RUN**：运行`offline-parse`，退出0；独立复核20/20 raw/hash/GET绑定、20/20冻结行、20/20来源配置、5旧hold exclusion、19 body hash/长度、1 selector hold及proposal digest；冻结与reparse bundle完全一致。

**RESULT**：离线证据和算法复验PASS；writer已报告批准范围内19条CAS COMMITTED，fresh GET=0、historical cadence unproven。1项保持hold；独立fresh postcheck尚未签收，b4仍`IN_PROGRESS`。

**RISKS**：历史response时间间隔证明有限；manifest snapshot并不替代CAS前实时行校验。

**BLOCKERS**：fresh post-snapshot独立核验尚未完成；native-summary输入与发布另需后续QA及Root批准。

**NEXT**：等待NAS writer提交post-snapshot证据，独立确认受限写入范围及表保护；在postcheck通过前不报告19条body已验收完成。
