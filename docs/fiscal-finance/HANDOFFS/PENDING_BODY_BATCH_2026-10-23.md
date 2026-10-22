# 2026-10-23 pending正文受控批次交接

## 结果

对NAS Staging里一批50个pending目标做了有界离线正文恢复。工具只复用已存response bytes，没有发起详情请求；其中45篇满足正文身份和解析条件并经批准CAS，5篇保持pending/hold。执行前的manifest与目标集合由operator准备，独立QA完成本地原始证据重算和NAS只读数据库后验。

当前Staging为418篇articles、490条revisions、418条discoveries；正文状态为72 `ok`、340 `pending`、6 `unconfirmed`。原有445条revision全部保留，新增45条revision。48个source仍全部disabled，`site_fulltext`及`syndicate_fulltext`均为false。公开publication仍18条；Gold review仍200项。分析、receipts、receipt attempts、job runs、fetch runs、translation、grouping及selection表没有新增副作用；`pgboss.job`关系不存在。5个hold目标的行、空正文和revision均未改变。

本次直接只读后验重算了postcheck列出的23个表行集hash，全部与postcheck artifact一致。除批准的`articles`和`article_revisions`变化外，其他保护表hash与执行前快照一致。逐项复核50个目标：45个成功项的bodyText、bodyHTML、content、title、source、article row和revision hash均与proposal/postcheck相符；其余445条旧revision组成的行集hash仍为执行前值。此项独立QA只读NAS，没有改业务库。

## 输入、备份与执行证据

- 本地operator源码 `scripts/fiscal/nas-pending-body-batch.ts` SHA-256：`113689cf00fab3ddab2d613f29776e5ba2045dafeb96fb8a0d1512d39478db4b`。该本地工具未部署到NAS；Staging app仍为SHA `21ca4d4`。
- 冻结manifest `.data/fiscal-qa/pending-body-batch-20261022/manifest-b3.json` SHA-256：`2e39a3f2511aedbcdd035ebf6ee676fe3b854ff9431a690b041b0eafdd1ff116`，50个唯一目标、25个source。原始采集inventory SHA-256：`a67f047a2e4b90afc7cbcd0b9abe66b9f470dbcaa5da702189b8e5fa06367ee2`。
- 本地legacy capture index `.data/fiscal-qa/pending-body-batch-20261022/legacy-index-b3.json` SHA-256：`48584db1bd186213ae6e00bdf7db11810c053cfc0b3f08b783bbd29a9f9f936b`；50份原始body bytes逐一与inventory dispatch核对，capture集合SHA-256：`5985a75e800d06218751064839572ca0887b26045fd432c0d10c8b985204a485`。
- Proposal `.data/fiscal-qa/pending-body-batch-20261022/proposals-b3.json` SHA-256：`8df24420ce7487913049e0634dff149509cb116d64a7b205bb8a91a74e65cd01`，绑定proposal input SHA-256 `be308cefbf4cdc3cc2e5c7125302600b59273435ecdaea36fbb9dd684aaf0c30`，45 proposals、5 holds、`freshDispatchCount=0`、`legacyOfflineCaptureCount=50`。历史cadence标记为`UNPROVEN_HISTORICAL_CADENCE`，不追认采集时间间隔或历史网络合规。
- 执行前零写preflight `.data/fiscal-qa/pending-body-batch-20261022/preflight-b3.json` SHA-256：`23bc0ccdaa6e5b221f75aa8212052e194d26dae095817e2355ab5343f65c7dce`，45/5，writes=0。
- Fresh backup proof `.data/fiscal-qa/pending-body-batch-20261022/backup-proof-b3.json` SHA-256：`bc26099729636f0639ae8c04287c77258f2dd3eeea0ebd1a2a05195d422a89f9`。NAS dump为PostgreSQL 17.11、mode 600，SHA-256 `b0674aa36ac8d457fb8e00c84adbe5f34b16ecc25ba1119502231f465fcfaca5`；restore list SHA-256 `a5cc6d21b8fa43e853e9a43b8821d4ec22842e9cd32300a5af0a436589a11c70`。
- NAS执行结果SHA-256：`8b125a3676386da8db7cbdbb8477a74d5471a9272bf3d167eec8020dcf668965`。只读postcheck `.data/fiscal-qa/pending-body-batch-20261022/postcheck-b3.json` SHA-256：`7c2bf49f85458c432f7573402868d0a955cc5dbe5017471a449d4d9fa06f469a`。

初始b2只读prepare因一个历史manifest task family不在旧适配白名单而安全中止，无输出、无网络请求、无业务写入。wrapper只增加了对该精确历史catalog-sweep任务族的识别后，以新SHA绑定的b3重复prepare及完整流程。后来的一次测试fullsuite也暴露测试子进程继承了`MODEL_CALLS_ENABLED=true`；测试harness现在显式将该离线CLI子进程设为false，运行时守卫没有放宽。

## 摘要后续与边界

operator已只读准备45项native summary manifest：`native-summary-manifest-45a.json` SHA-256 `f9f7eacd26ee79966d68b71a18e234f008f787ddf30fe5ddf9cdafdeafdc2ea0`（30项）及`native-summary-manifest-45b.json` SHA-256 `ede704c88b34364bcf0b7b0502962f838df1603e72dd05bf1c8fa2f6c99852c2`（15项），两批目标唯一且不重叠。独立grounding后22条PASS、23条BLOCK；复核产物分别为`.data/fiscal-qa/pending-body-batch-20261022/native-summary-qa-independent-45a.json` SHA-256 `7b5bb6907f847554eed77447dcb721e5d4842523d2672b5fb0424419150655a8`和`native-summary-qa-independent-45b.json` SHA-256 `8d3399f5b58d6e983f1032ee1c83d03d987372ecedfe351ccf5a641b9a8ecd7c`，均绑定原manifest、原body hash和原native output。原draft未覆盖；QA修订sidecar `native-summary-qa-review-45.json` SHA-256 `897412215b4540234fe3133ff9d6ec854e2061bf382f12e2751971dd93a26a54`记录两处改动：删除大连稿中原文未支持的具体问题“已查实”描述，并将浙江稿“拟借助”改为原文实际已借助系统开展监督。23个BLOCK含一篇隐性债务案例学习稿；经Root裁定该文只有一般学习/共性问题内容、无具体案例事实/对象/整改结果，保留BLOCK。当前仍待Root批准exact22 apply，不把QA PASS等同于发布或精选。

执行前基线 `.data/fiscal-qa/pending-body-batch-20261022/native-summary-preapply-safety.json` SHA-256 `5337e76124a4ebb1ac1c8c55f9e626a055679365f42a99c1e996ad56ec796707`，并另有mode-600 PostgreSQL 17.11备份，dump SHA-256 `dadc42b0cbb538997cac41e3fb9318704e863f57ab739dd514c4eef540fc1f1d`。机器草稿生成者没有自签独立QA；QA artifact的`selected=false`、score/reason/provider receipt为null，provider pipeline为false。

本轮最终软件检查在fresh 36-migration `_test`数据库上通过：470 tests、469 pass、0 fail、1 skip；typecheck通过；Web build通过，Web tests 22/22。全suite的单个skip保留记录。逻辑提交为`e3d2b9c`；文档提交另行记录。未部署本地wrapper、未启用采集或provider、未改变source flags、Gold标签或Gate阈值。Gate 2仍只表示`PASSED_FOR_BOUNDED_P4_PILOT`；Gate 3/4/5均未通过。
