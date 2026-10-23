# b4 pending-body 离线证据 QA 检查点（2026-10-23）

STATUS=BODY_AND_APPROVED_SUMMARY_APPLY_COMPLETE; later work remains in progress
STAGE=NAS staging pending-body b4；离线证据QA、获批19条CAS、exact14摘要CAS、独立read-only DB/LAN postcheck均完成；Gate 3与Gate 5整体仍未通过
GATE=Gate 3 `CHANGES_REQUIRED`；本检查点不是Gate裁决；仅证明限定body批次后验和summary QA已完成
BRANCH=`feat/fiscal-finance-hot`
QA_HEAD=`cb9797cafb5c7aada23022b11570f7fc42f15afd`
BASE_SHA=`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`
WORKTREE=QA开始时clean；本次只提交文档，不改operator代码、b4原始输入/索引/proposal或数据库

## 阶段退出条件与结论

这次检查确认冻结batch、历史GET与响应raw之间的证据绑定，逐条核对body解析输入，并核proposal是否可从同一冻结材料确定性复现。所有离线检查均通过：20 targets来自11个source；20/20 raw response bytes/hash与manifest绑定，20/20 target row identity/hash匹配，19条proposal的body hash有效，1条保持hold。原先5个待新证据hold URL不在本次目标中。

这只完成数据和解析算法检查。20条全部是既有历史抓取，fresh GET为0，历史network cadence仍为`UNPROVEN_HISTORICAL_CADENCE`。Root对精确19条READY proposal批准CAS，批准身份同时绑定manifest SHA `a57159d9701c1b2bc419ddbf2cc755ee742b05f8fb76253e8170eb9ab31a950b`、proposal **文件** SHA `a2149b340f241eb0b192ed73fef60412c371e4fd9f6c71d8dce645949fab90e9`、proposal bundle内部`inputSha256` `971dec5a0b87eb6a9370ae622c84c632a64f310f9ac02983c4f1d27f3b2ffbc0`及fresh dump SHA `a0a51d09ab35221adc6d3f36c5daa4db96b45684c30d8ad3716266a26935f331`。writer执行结果为`COMMITTED`（19 writes、各升至revision 2，1 hold）。我从NAS API容器独立执行PostgreSQL `REPEATABLE READ READ ONLY`检查；b4 body CAS后验通过。文件SHA与bundle input digest是不同字段，不可互称或互换。Root随后批准summary仅exact14 PASS导入（5 BLOCK不写）；writer结果与独立DB及LAN后验均通过。

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

此次离线proposal复验没有网络请求或数据库连接；后续独立postcheck只读连接`fiscalhot_staging`，使用PostgreSQL只读、repeatable-read事务，没有数据库写入、provider调用、发布或任务队列消费。summary apply后的live快照为418 articles、509 revisions、418 discoveries、48 sources、54 editorial_overrides、54 publications；body状态为91 `ok` / 321 `pending` / 6 `unconfirmed`。

同伴`/root/luna_next_body_scope`是唯一NAS artifact/backup/preflight/CAS writer；独立QA只读复核其写后数据库状态，没有写库，也没有改动备份、preflight或b4冻结输入。Root批准并提交19条READY，不包括1条hold。摘要阶段只对19行冻结body与输入/输出做离线QA，不改数据库。

## 未完成项、风险与阻塞

1. 19条历史捕获body已验证并写入；fresh GET仍为0，历史network cadence仍无法证明，`UNPROVEN_HISTORICAL_CADENCE`不变。
2. legacy GET cadence不能从现有原始证据充分证明；因此不能转述为本次有间隔保障的新网络调用。
3. `body_selector_declined`保持hold；19 proposals已按Root批准的精确范围写入并独立后验，但不等于对外发布或业务精选。
4. 旧5个hold没有被重新抓取、重解析或解除。

## 下一批 Agent

NAS writer已完成Root批准的19条CAS和exact14 summary apply。summary后独立postcheck通过：91 `ok`/321 `pending`/6 `unconfirmed`，418 articles/509 revisions/418 discoveries，48 sources全部disabled且全文/转发关闭，54 publications与54 overrides，Gold200及受保护行集保持。14条summary均绑定冻结QA/body/source provenance，eligible但未selected、score/reason为空、body mode summary、indexable/syndicate关闭；5 BLOCK没有summary import。LAN正确base `http://192.168.3.100:3221`的health、`/all`、pool API、详情及RSS均符合noindex/summary-only预期；详情API body为null，7日RSS未含10月7日旧条目属窗口边界。数据库QA、目标QA及LAN QA见下节。Gate3见[正式Gate 3 review](../GATE_3_REVIEW.md)：`CHANGES_REQUIRED`，与b4正文处理独立。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：独立审查pending-body b4的20条历史response、19条body proposal及写后数据库状态；数据库检查只读。

**MODEL**：摘要draft由独立native offline session生成；本QA逐条核对冻结原文和prompt输入，并以本地validator校验；provider receipt为null，pipeline未运行。

**FILES_CHANGED**：更新本handoff；reparse、只读DB结果和summary QA/audit留在ignored `.data/`；b4原manifest、exclusion evidence、capture index、raw、proposal及native draft未改。无源码或数据库写入。

**TESTS_RUN**：运行`offline-parse`，退出0；独立复核20/20 raw/hash/GET绑定、20/20冻结行、20/20来源配置、5旧hold exclusion、19 body hash/长度、1 selector hold及proposal digest；冻结与reparse bundle完全一致。对live DB在只读repeatable-read事务复核418 articles/509 revisions、status91/321/6、48安全source、Gold200与受保护行集；19目标article/source row text逐项精确匹配冻结post-CAS输入。将19条article恢复为冻结CAS前row text，重算hash精确还原基线；删除19条目标revision 2后，490 revisions hash也精确还原基线。

**RESULT**：离线证据/算法复验PASS；获批19条CAS和exact14摘要apply经独立只读DB/LAN后验PASS，1条保持hold，5条BLOCK未写；fresh GET=0、historical cadence unproven。Gold200和状态计数按实际值记录。Gate3为`CHANGES_REQUIRED`；Gate5 restore仅其row-hash subitem通过。

**RISKS**：历史response时间间隔证明有限；body验证不等于精选或推荐；获批写入仅覆盖19条正文和14条summary，Gold200及所有获保护标签未变。本QA本身没有数据库写入。

**BLOCKERS**：b4批准范围内后验无阻塞；后续body批次需各自证据与审批。历史GET cadence未证明；Gate3与Gate5整体未通过。fullsuite最终正确harness结果由D独立运行并另行报告。

**NEXT**：以development材料继续评估用户明确偏好规则；fresh50不可再作未来未见holdout。Gate5其它验收/恢复证据须单独完成，不能以此restore row-hash结果代替。

## 独立NAS只读 postcheck

我通过SSH进入staging API容器，以`file:///app/packages/backend/src/db.ts`打开PostgreSQL连接，在单个`REPEATABLE READ READ ONLY`事务中查询。私有审计脚本与完整机器结果未跟踪，分别为 `.data/fiscal-qa/pending-body-batch-20261023-b4/independent-readonly-db-postcheck-b4.mjs` SHA-256 `f34bba07286140de05b087cd2fef47231d8a899d900b6b519a340ef75ca8cb24`、`independent-readonly-db-postcheck-b4-result.json` SHA-256 `5976d81b1eaeb0f42eaf9ab89b5698c2ced63a66e19292b3c72dea94ea17878c`。结果`PASS_INDEPENDENT_READ_ONLY_DB_QA`，数据库`fiscalhot_staging`。

| 核验项 | 结果 | SHA-256 / 说明 |
|---|---:|---|
| `body_status` | ok 91 / pending 321 / unconfirmed 6 | 总计418 |
| current articles / revisions / discoveries | 418 / 509 / 418 | articles `446aaf9b23e58993d606834ffa5677d4de7f998f1f6b80127bf5e8bc619ca574`; revisions `ddaf10c9900b3b6a8d3ace068239684a455363d864ae8c2d408b6bf5da8d9f9f` |
| 19 target article rows | 19/19精确等于summary manifest冻结row text及SHA | source row也19/19精确匹配；每条proposal body/hash与冻结summary输入本地Grounding一致 |
| articles CAS前重建 | 恢复19条CAS前row text后仍418行 | `206812c4af7e44ad9680719e69850827da06a5f4d3c7b715536c0d5e8a31dd68`，与before基线一致 |
| revisions CAS前重建 | 排除19条目标revision 2后490行 | `0044adedf6c1871663126067c503df9fbacb231f6fcdbbd71eff0d417fb7d152`，与before基线一致 |
| source safety | 48 total；enabled/fulltext/syndicated均0 | sources rowset `8d017180f9fdaa0aa101a9c1c3b24a0666ade2ba9adda3c64e905db7f1edcb98` |
| publication / override / audit | 40 / 40 / 225 | publications `525bb9bcc875cdd5c13dd45105e521c4a03959d4c54cd442a5d14c83f4791f55`; overrides `714958050c11864a9264f8de20c7305e30e86adab4fb630e08d535b4b23fcbc9`; audit `f31371152c0aead30429a06b3a61cdeddba4194e91a54c8f0d6b5158bbaddb16` |
| Gold200 / protected rowsets | count200，Gold case hash unchanged；所有非articles/revisions rowset均无漂移 | Gold cases `fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`；`protectedDrift=[]`、`goldDrift=[]` |

CAS后只变更`articles`与`revisions`两个rowset；19条targets全部命中，旧版本中的冻结版本可精确重建，未发现超范围写入。该独立只读postcheck证明的是body状态与数据隔离，不证明历史GET cadence或对外发布。

## b4 native-summary 独立 grounding QA

Native summary draft为`.data/fiscal-qa/pending-body-batch-20261023-b4/native-summary-draft-b4.json`，SHA-256 `a78e12b9201f376a8f8e4aac8721132f588e01f6b46c272eba33ffdd553ade06`；冻结输入manifest为`native-summary-manifest-b4.json`，SHA-256 `96d7a5baffc4a7b474c747c804574bfd6b1cc41641b1fba7a177246281202ffc`。19行body/input hash、每行prefilter/summary prompt hash及native output hash逐一校验；session provenance为`/root/luna_native_summary_b4`、`gpt-6-luna`、`native-offline-not-runtime-provider`，provider receipt为null、provider pipeline未运行、`isGold=false`。draft原件没有被覆盖。

独立grounding先以`validateNativeSummaryQa`和taxonomy验证schema、标签/类别/词表与输入输出SHA，然后逐条对照manifest正文审查标题、摘要和预筛理由。原draft为16 PASS/3 BLOCK；QA将第5项`hq493di5ckywdbhox0h13hlgo`和第9项`pah2zdavwzd90w4upp0ej6aq3`的PASS更正为BLOCK：前者是党支部会议/集中学习，债务、超长期特别国债和零基预算只作为一般履职表态；后者仅传达宏观财政科学管理会议部署，未报告江苏本地具体行动、方法、问题发现或执行结果。两项原摘要已从validator-ready QA对象移除，原draft保持原样可追溯。第8项`l6m7r5a1q3gtf2j4a2y86gdjc`保留PASS：正文明确陈述新修改《注册会计师法》对财会监督制度和审计责任的作用，摘要对应原文，不是仅因机构或关键词放行。另3个原BLOCK（民族法规学习、民族共同体学习、党建会议）维持BLOCK。其余13条PASS逐条匹配正文所写预算绩效/内控方法、调研和反馈、数字应用、转移支付监管、债券观察、预算监控、廉洁检查措施、财会监督/智能监管计划、预算审核以及贴息政策变化；没有把人工选择或摘要质量等同于相关性PASS。

Validator-ready最终QA为`.data/fiscal-qa/pending-body-batch-20261023-b4/native-summary-qa-independent-b4.json`，SHA-256 `61ce939dd8a77ba98863f2a883729df29dc413196b21ec85a27385af1151f353`，含19项（14 PASS、5 BLOCK、0 UNKNOWN），`independent=true`、`isGold=false`，summary字段仅保留14 PASS项。逐条审查依据与状态审计为`native-summary-grounding-audit-b4.json`，SHA-256 `db80fa17112ab052c8d8cfbb4d1c88f1c590ad5fc96c69b62030adc6ab01d634`。本地validator重跑输出`VALIDATED`并核验manifest/QA/audit三个hash互相绑定；无NAS连接或数据库写入。QA文件只供Root审核，不是apply批准或发布证明。

| 最终预筛 | Article ID |
|---|---|
| PASS（14） | `bnd590yqdi06l943j0u5rpd8d`, `e07gvm9szktt0su1ce1s8hj8a`, `fj8lfgmwid7aiof8bmgqs3wsr`, `i0a69hk4dit7uqvcilmf4uu0w`, `kzeup7shspzgebxtgmhudmon7`, `l6m7r5a1q3gtf2j4a2y86gdjc`, `pxvll00g5vnq3ycjzqimu21nd`, `rffb05m65jm3dpo9duxd9oyog`, `s7jgce0otx66vlv8yqogzxc0e`, `sve1yujjiipsmy184a4m8fv1o`, `tki60a1i96r6ee5pb3ok6rjz0`, `vigl8s5px81btzzaq50jwnn5h`, `yzgghiy11zhpipjivq5fv4edb`, `zo5hiiyxy5adtiet4h3ufx5yj` |
| BLOCK（5） | `djvn1jenz68jhyq9hvxfwarve`, `hq493di5ckywdbhox0h13hlgo`, `pah2zdavwzd90w4upp0ej6aq3`, `q1xyyodrivno3vcmtz41yhima`, `zjle7vwpm6lnuz3tvj3m1sl0d` |

## exact14 summary import independent postcheck

Root approved only the 14 rows marked PASS in the independent QA artifact; the 5 BLOCK rows were excluded. The exact scope was bound to manifest `96d7a5baffc4a7b474c747c804574bfd6b1cc41641b1fba7a177246281202ffc` and independent QA `61ce939dd8a77ba98863f2a883729df29dc413196b21ec85a27385af1151f353`. Writer apply result SHA is `59953ae27b5c3568d4e594ee810aced85e34d9b339169a6a99c367cc2136f3f2`; writer postcheck SHA is `586f498bde4c8695815853d2a422b8bbca31af04eb592a5b9f0add17ffe21c15`.

I independently checked the 19 target rows in `fiscalhot_staging` using a read-only repeatable-read transaction. Target QA SHA `4c5b6374e33d8fac38aea8c3d6f15a5ef38dce2d93fe45a11c945106a8e76b4d` and final DB QA SHA `1897c8010d1d2abdbaba82cc0a3bacce29baa0c5b74010949b8b3ed92581ded1` report 19/19 exact target/provenance matches. The 14 PASS rows have matching summary/body/source hashes and summary-only publication state (`eligible=true`, `selected=false`, score/reason null, `body_mode=summary`, `indexable=false`, `syndicate=false`); the 5 BLOCK rows have no summary provenance, publication, override, or pool row. Live counts are 418 articles / 509 revisions / 418 discoveries; body status 91 `ok` / 321 `pending` / 6 `unconfirmed`; 48 sources with collection/fulltext flags off; 54 publications / 54 overrides / 239 audit rows; no analyses, receipts, or job runs; Gold200 count/hash unchanged (`fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`).

Read-only public staging check SHA `ecc8fff36f8ffc9cc8d980de14bc32a07b1aa6bb9b23952da5379ad7d7e99a7e` used only `http://192.168.3.100:3221`. Health, `/all`, pool API, detail API/page and RSS returned 200 with noindex. The sample item's summary matched, it remained unselected with null score and non-indexable, and the detail API body was null. The 7-day feed did not contain the Oct 7 item because it was outside its window. No other hostname is acceptance evidence.

The applicable user preference is recorded verbatim: “国家级重大民生政策也纳入，即使没有明确财政金融安排；央行日常公告放全部动态，重要操作/政策变化才精选。” The preference informed minimal prompt wording updates; it did not change thresholds, labels, or holdout-based tuning.

## Gate 5 post-summary restore row-hash subitem

Independent read-only QA is recorded in ignored `.data/fiscal-qa/gate5-restore-rehearsal-20261023/independent-qa.json` SHA `71434911a24d14c45ea14c8865bb73d349180233b5c9f2558ab7883469a1c58c`. Source/target saved snapshot manifests and inventories match for 64/64 public tables; dump SHA is `8d6619cd7741ee6b300c823e81a842dc4d363dd281507a015fda6d30da243f1e`, restore-list SHA `3d08411eb44b26d33a099bef5db864300c3e8cf7b53961bc6477c4b7b32feccf`, and direct remote mode check found evidence directory `700`, all files `600`. Target `fiscalhot_staging_restore_20261023_postsummary_test` is healthy and has the expected 418/509/418 articles/revisions/discoveries and 200 Gold rows. A read-only query compared all 16 sequence `last_value/is_called` pairs without calling `nextval`; source and target matched.

A second live-source read happened after the exported snapshot: 63/64 current table hashes still match the restored target; the sole later difference is `settings.heartbeat.api:3001`. Only its `value` and `updated_at` fields differ; its `key` and `updated_by` are unchanged. The live API heartbeat advanced after the snapshot, while the restored target retains its frozen value/timestamp. The target matches the frozen source/restore row-hash manifest, which remains 64/64 exact. This establishes only the specified restore row-hash subitem, not overall Gate 5 completion; no full DDL fingerprint was computed.

## Full-suite execution status

Earlier unconfigured runs are not counted as code results: the first had `DATABASE_URL` unset and tests stopped at the test-write guard; another explicitly set `MODEL_CALLS_ENABLED=false`, which disabled local provider stubs and caused stub-dependent suites to fail. One correctly secured but misrouted suite attempt used `DATABASE_URL` for both the general DB and `NAS_CANDIDATE_TEST_DATABASE_URL`. Its three failures were `tests/fiscal-nas-candidate-batch.test.ts` / “known identity lookup binds a typed SQL array on disposable PostgreSQL”, `tests/fiscal-nas-candidate-body-cas.test.ts` / “candidate body CAS validates and appends one or multiple native revisions inside transaction”, and `tests/fiscal-nas-pending-body-batch.test.ts` / “loopback *_test DB: exact fresh snapshot, CAS stale-second-row rollback, then body-only commit”. The first two hit wrong-DB fixture guards; the third found active/fulltext test-source rows left by earlier suites in the shared general DB. The original full log was overwritten during a later attempt, so its byte-level output is unavailable; this history records the contemporaneous observed names and causes, not a passing result. A second attempt was stopped at Root's request before Node summary/exit; its partial log SHA was `BDB82E774F86D68F55F7A1D477E35821A7A9C3265C6513BEB31AFBD8B2BD34DE` and is not counted.

D then ran the frozen working tree with separate loopback test DBs. Focused regressions passed 3/3 (log SHA `e5a15d535de33130951085834664cb9ac1425c7a333244594a88124f900e75be`); full suite passed 472/472 with 0 failures and 2 skips (log SHA `5048445c9fe974cb552b0ba4a7f456164dbbbdc39dd3b466dc6ea6d7b89ffbd7`). Skip causes: native-summary test-specific DB was not configured, and execute-captures is explicitly skipped by its own test. The sanitized two-DB preflight showed MODEL_CALLS_ENABLED true for local test stubs, provider credentials/endpoints and proxies blank, side effects disabled, 36 migrations in each DB, exact `fiscalhot_nas_candidate_test` with 48 sources all flags off and known identity fixture present; preflight SHA `467af625e3c8166f8d8c659d9edab8b2daf0b72f3029c7f82d79e60a1c772b9e` (focused preflight `eda39288d608525485092924c0d853f5605c8ee3ba2b81f91b5180ea2e406701`). Typecheck exit 0 (log `80e9b5f69d57a03112ce811aee78ddb8a975714083f921747f61ca080ae99b2e`), Web build exit 0 (`b1dbe95efef2b39ace0d85c657284c514e448dd0b09bdc2d336bc7b94f248ffa`), and Web tests passed 22/22 (`da4d61dfd80389148321f02904d7155a9f31d0e9ca38f365fd6cc346ad97dea4`). All logs and harness scripts are in `.data/fiscal-qa/harness-run-20261023-2030-correct-route/`.

Frozen sibling file SHA-256 values at test time: body wrapper `scripts/fiscal/nas-pending-body-batch.ts` `d33f21976629d806760854142117c96fc8732b3bf21690f351e1c28f7cfd96df`; body regression `tests/fiscal-nas-pending-body-batch.test.ts` `0ab2da4a64202c7f922385c31262410367b66bc7ed58bea912e31315ace66cd9`; prefilter prompt `ae25e4ebdb0fe800d13db01b05e4143342a1d842d57c91b33ec9f0d2c11aff0d`; score prompt `3159b562c56d14cf9d5438ee20c6fa663b49904df39d6afa825c01ab8bf0d18c`; prompt policy test `1f6baad1bbef76b1cd09ec5b3d03cdae92ed0172bbb7a9efd3a467ffd4871d12`. Body changes are committed as `eb55f12d7634cceec85dbd8695c8e62e6b1d170e`; user-preference prompt changes and tests as `8a05b471eb45c0035440b112ab6bd212da190542`. These exact bytes were the tree used for D's final suite and Web/typecheck checks.
