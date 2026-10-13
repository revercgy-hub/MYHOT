# 全量待正文与历史采集恢复交接

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_HEAD=ef69c97c7fa5de4d19754b17c65a57cba920aa5d（本次文档更新前代码HEAD；docs-only提交SHA由Git事后读取）
CURRENT_WORKTREE=代码已提交并推送；本交接与STATUS为本轮唯一tracked改动，运行证据留在ignored `.data/`
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
STAGE=P3待正文积压处理与48源首次90日窗口分页准备
GATE=Gate 2 `PASSED_FOR_BOUNDED_P4_PILOT`；不表示source admission或完整历史覆盖
MODEL=requested `Luna High`；用户已同意恢复额度并临时调整model配比；实际执行模型未独立验证，本轮未调用project provider/model

## 本轮已完成

目标隔离库为`fiscalhot_catalog_sweep_20261013_test`，35 migrations。所有source/global collect、fulltext、worker、provider、model、Jina、OCR与附件开关保持关闭；测试采集通过一次性受限脚本显式调用，未启动worker。

先对49条严格匹配的旧正文样本用原有`extractArticleBody(id, false)`和一次性MockAgent进行离线重放：3条pilot加46条余项全部通过独立QA。MockAgent只返回冻结的旧响应wire bytes，禁止未命中URL及真实网络；旧raw捕获时间只按原run窗口溯源，另记replay时间。数据库正文仍通过现有extractor/revision路径写入，没有直接SQL拷贝正文。计数由54 ok/345 pending/14 unconfirmed变为103/296/14，实际外部HTTP为0。46条结果与revision/body hash匹配，jobs及处理队列未动。

后续冻结226条本次可提取HTML候选：191条历史body-ok身份匹配但缺严格raw/revision链的pending，另加37条新detail来源HTML候选；按两条重复文章ID去重。排除两条direct PDF及Treasury来源三条附件风险文章。六个数据库source配置与当前catalog不同，runner逐source临时应用冻结的catalog config，随后finally恢复每个source原数据库config；source enable/fulltext flags保持false。

一次有界正文运行执行了213次HTTP dispatch（上限400、包含redirect；本次0 redirect），得209 ok和4 unconfirmed。四个来源在第一个non-ok后停止，其他来源继续；13个冻结ID因此未尝试。没有重试或抓列表。独立QA确认213/213响应raw的字节数、SHA、EOF正确，当前parser重放与SQL状态/body hash完全对应；36个source配置均恢复、406个jobs前后相同（28 analyze cancelled、378 extract-body created），没有analysis、receipt、selection、job_runs或pool_search写入。190条存在publication投影的候选均保持summary-only、未精选、不可索引。

六条NFRA人工附件复核事务完成后，测试库共413条：318 body ok、83 pending、12 unconfirmed。该统计包含此前49条离线raw重放、213次实际HTTP正文dispatch及本节所述六条人工review resolution。`ok`仅表示正文提取/人工复核写入完成，不代表内容业务质量、source admission或正式发布。

## 226条正文批次证据

- Frozen scope：`.data/fiscal-qa/pending-body-full-20261013/http-body-batch-freeze-v2.json`，文件SHA `c5567045ec8aeb704449ad55f0e3fe665e9c27860dc79cac6e1c2ce3846fad53`；226候选ID SHA `0f803d666b9f9122650db1fa7d1456bfd523cee35782b9d865d086f08e1a8ab4`。
- Runner：`.data/fiscal-qa/pending-body-full-20261013/http-body-run-once.mjs`，执行前SHA `48ff582ac02e12766ca5e05a2a5cb699827715bafa6697cd64be083bb4c53a30`；`node --check`和无DB/网络/marker的`--preflight-only`通过。Scope READY为`READY_PENDING_BODY_HTTP_226_20261013`。
- Manifest：`.data/fiscal-qa/pending-body-full-20261013/http-body-evidence/manifest.json`，SHA `d0065e5afca39d70a548d0173fa2c6cfb49fa098220df4d7b2ef170f790ed6a6`；SQL导出SHA `5a42e3e03233f07c583b3dcfc0551a437757f5405215dbe64a2050c118c7df03`。
- 独立QA：`.data/fiscal-qa/qa-luna-expansion-followup-20261013/http-body-batch-audit.json`，SHA `226a9b1c0050a8546a291b6065412c52586ec6a6c139da8ad10b92eb038b2301`，结论PASS。

触发stop-on-first-non-ok的页面：福建财政厅`h3ukv5l6m8swe5xt6rvby26zo`（`attachments_unprocessed`）；财政部陕西监管局`v6rqknx5r102n2xc971cw2ixs`（`identity_mismatch`）；人民银行厦门市分行`bk6bfigo44bphu0sqsf0ocj17`（`attachments_unprocessed`）；厦门证监局`egr22ura65nvwhhtpx13ub44x`（`identity_mismatch`）。未尝试ID为：`tgeiy876jupck9vsd9nq6d827`, `v9c75ydzrcpg5zgdl81hsl3b3`, `w7en8477hjx7xvkyejupx3urj`, `zl9sn4vy945g4r4gm4u4ea3za`, `bkognkpvwnll5l30pe12dhd9d`, `dl6ni808ga8hizqh1598778mj`, `oigcp5jfk0xr0fhmblks32ruw`, `okiokyqweer6d72d930r5j5xl`, `swxb3xd289r7nnpulb7axcv9l`, `vgo9e87wdx411i668gacky8r6`, `kbi5t1llimbjnf7vucjfx3og3`, `xl21pndo86vajqshpmkbqufin`, `zladq5qp5epof6z3suhm6nrgj`。本轮未重试失败页面。

## 其他附件与处理范围

此前独立附件观察解析了7份PDF共35页、43,521字符；6份NFRA DOC与严格身份核验的HTML正文逐条比对。仅对以下六个固定ID获批人工reviewed附件正文resolution：`dagdza493y1v13n90a7tems92`、`ficr7efv3jc7tpc39mo052xwd`、`zrr0uonnygnc8vgxvdpdl8xvr`、`jhv8po9fs8t9a6qusl3vsksfu`、`o2b9tj279fx225t8rnzy0uzbr`、`v2tqr196fqpb0fs91p8jvd2a3`。冻结resolution manifest为`.data/fiscal-qa/nfra-six-manual-resolution-20261013/evidence/v1/resolution-manifest.json`，SHA `5f7386679c50b613d5a3ece41013dba768643aac0f1a0e96db8a01d24def7c0f`，绑定原DB快照SHA `200a739962c3d22bbe0b14faaf7e75078506545612b472d3ce3deadb702dd111`。通过一个serializable全有或全无事务，按现有`contentHash`、`article_revisions`、`syncArticlePublication`路径提交六条新revision，revision 1→2、body_status `unconfirmed`→`ok`；只清除这六条已验证的附件诊断marker。没有新HTTP/DOC/PDF请求、worker或模型调用，没有新增运行时DOC依赖。其余附件hold不变；六条publication保持summary-only、未精选、不可索引。runner `.data/fiscal-qa/nfra-six-manual-resolution-20261013/runner/run-once.mjs` SHA `b637362252d70eaa83e6a1dd1ae8422458d2a1939c6326d6831e869ec4538a28`；执行结果`.data/fiscal-qa/nfra-six-manual-resolution-20261013/evidence/v1/execution/execution-result.json` SHA `65c6820dd710abf8a6c5561d0e87b3dbe28cafa1063fd00fb005d26ab6fc7362`；独立只读QA报告`.data/fiscal-qa/qa-luna-expansion-followup-20261013/nfra-six-live-audit.json` SHA `ce2c31370e7bdb1139a5bb7d9f54b1ecd3354b9eef403321f55f791d37788aa5`。这仅验证六篇固定样本，不表示NFRA整源或DOC/PDF通用adapter通过。

Counts在六条resolution事务前导出全部open-body状态：`.data/fiscal-qa/pending-body-full-20261013/open-body-state-after-http.json`，SHA `200a739962c3d22bbe0b14faaf7e75078506545612b472d3ce3deadb702dd111`；当时含83 pending、18 unconfirmed及94条关联job。六条人工resolution仅减少unconfirmed至12，pending仍为83；未将其他行批量改成held。HTTP批次之前的296 pending精确分组为191历史ok缺完整重放链、14来源配置漂移、14旧held、66旧pending、11无历史记录；之后实际scope变更为213条尝试后83 pending，具体remaining行以该冻结导出/后续分类为准，不沿用旧比例推断。

## 48源历史窗口分页能力（续跑执行前快照）

当前48个catalog sources均设置`initialBackfillMonths=3`和`initialBackfillRequirePublishedAt=true`。现有已配置分页driver只有三源：GovCN `govcn_query_v1`（每run最多2页、7 dispatch）；福建与浙江`mof_index_v1`（每run最多2页、12 dispatch，分页索引上限分别3和15，metadata-only detail）。这只是能力配置，不表示真实90日覆盖。其他来源没有可用分页driver，不能猜测`index_N`等URL。

在本次运行前，既有cursor快照见`.data/fiscal-qa/pending-body-full-20261013/pagination-source-state.json`，SHA `fac57617c6411be591fb084280e8b152df03245bcb77d504acf812e9d1cbcbed`。福建、浙江已有active cursor；GovCN没有可直接续用的backfill cursor。随后按下方新scope为三源建立隔离的明确90日generation并执行。该执行未证明完整90日覆盖，不能把generation或collector status等同于历史覆盖完成。

NEXT=执行前的计划项已由下方“后续实际运行”更新；仍需逐项分类剩余pending/unconfirmed，并基于已保存的真实列表raw验证其余45源是否有分页能力，不猜测分页URL、不绕过publication、评分、来源准入或Gate。

在前述正文与人工resolution执行时未重跑软件full suite/CI；随后source/core改动已提交为`ef69c97c7fa5de4d19754b17c65a57cba920aa5d`，该精确代码SHA的GitHub Actions run `38364737341`为SUCCESS。分页执行只使用ignored runner，未改运行时代码。所有采集/附件结果留在隔离库和`.data/` evidence，不与local preview 59条相加，也不代表正式发布。

## 三源分页续跑（后续实跑，2026-10-13）

对原计划的GovCN、福建、浙江分页scope已完成一次受限执行；测试数据库仍为`fiscalhot_catalog_sweep_20261013_test`，只改变这三个source的隔离库cursor/config，48个source的enabled/fulltext旗标均false。scope用支持的现有adapter：GovCN `govcn_query_resume_v1`；福建、浙江`mof_index_v1`，各按新建并冻结的90日cursor generation从page 0开始。所有新cursor的coverage均为`unproven`，本批不得表述为覆盖完整90日。

运行完成8次source runs、16页与31次实际HTTP dispatch（含redirect的预算上限100；本次0 redirect），捕获31个HTTP 200完整raw。共新增29篇、更新2篇既有文章revision，共31条revision；没有重试，所有来源配置/cursor保持在隔离测试库的冻结续跑状态。GovCN新增15篇，其中5篇正文提取ok、10篇因附件诊断为unconfirmed；福建新增8篇pending；浙江新增6篇pending。GovCN已采集的5篇正文涉及应急采购、罕见病服务、内河新能源船舶、铁路科技规划及智能家居消费政策；这是样本事实，不能泛化至来源整体。福建和浙江的14篇均为空正文；浙江一篇2025年度单位决算记录仍pending。附件/PDF未请求。

独立QA确认31/31 raw的SHA/长度/EOF正确，HTTP均为200且没有非预期重复；SQL确认29条新文章、31条revision、8次fetch runs。精确取消本批新建的5个`content.analyze` jobs；相关`content.extract-body`保持created/unstarted。没有analysis、receipt、selected、job_runs或pool_search记录，所有publication投影仍为summary-only、未精选、不可索引。当前隔离库442篇：323 body ok、97 pending、22 unconfirmed。整体run的collector status不能替代内容质量结论。

证据：scope `.data/fiscal-qa/pagination-continuation-20261013/scope-freeze.json` SHA `4bec9b339ff5e30cf2d4b754fdd7d82584e46b90f153d300946355f7072b9a66`；runner `runner/run-once.mjs` SHA `ad75806fc0a681fa90aa9b0b2be257a5179279de0258048fa7e5eb6f9fbbeb5c`；执行manifest `evidence/manifest.json` SHA `dc8b00aadcc7fcb288b239a4761d770f4d915821e18841f0e6c357dcb5ec783c`；只读SQL导出 `evidence/post-run-sql-export.json` SHA `c70dc0f8cde9268a8e99696dfe6ca5f616b189091e57c60789ab2e8c9331444c`；独立QA `evidence/independent-qa.json` SHA `6238aa2ba1b7ad32131b202b3b092364e371b47689e7c06c920d8f7e307fac13`。当时97条pending与22条unconfirmed的只读身份/config快照为`evidence/pending-inventory-after-pagination.json`，SHA `cd1e024e5dc5b56c5ea316b843a5da426d6e72b1c2f0628d8893ff6437902eb1`。本批不改tracked业务代码，精确代码HEAD `ef69c97c7fa5de4d19754b17c65a57cba920aa5d`的CI run `38364737341`成功；local software tests未因本次ignored runner重复执行。

下一步需用当前442篇数据库状态继续逐项检查97条pending与22条unconfirmed；首个non-ok stop的失败页不在同一run重试。其余来源分页需由已保存官方页面证据逐源判断，不能由标题或猜测URL推断覆盖。
