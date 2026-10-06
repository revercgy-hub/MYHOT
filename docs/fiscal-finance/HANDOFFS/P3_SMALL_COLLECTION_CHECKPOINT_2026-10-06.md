# P3 福建单源小规模采集检查点（进行中，2026-10-06）

STATUS=IN_PROGRESS；本次有限collector结果=`PARTIAL_LIMITED_SAMPLE`
STAGE=P3 source evidence / Phase C
GATE=Gate 2 NOT_PASSED；source admission NOT_ADMITTED；coverage unproven
BRANCH=feat/fiscal-finance-hot
HANDOFF_HEAD=0f14bc4014270205ce6f982ca4bf277a9d957162（本轮文档提交前起点）
STAGE_CODE_SHA=N/A（未修改代码；最近已测试代码SHA仍为c7a027491b809f91edec42c3abeaee017e901ba9）
BASE_SHA=0f14bc4014270205ce6f982ca4bf277a9d957162
WORKTREE=本handoff负责人维护STATUS、HANDOFFS/README、本文件及请求包；Sol新增范围裁定。最终文档变更仅限这五个文档文件；未修改source config、共享代码或runner。

## 结论与范围

Sol范围裁定允许在新的disposable `_test`库保留legacy `initializedAt`、`lastOkAt`、health和fetch状态；这些只表示单次执行，不证明回填覆盖或准入。root随后核销了唯一一次最多12次dispatch的运行。实际只执行一次，结果保留 `PARTIAL_LIMITED_SAMPLE`，绝不写作source pass、90日完成或Gate 2通过。范围裁定见[Sol有限legacy collector裁定](../S1_P3_LIMITED_LEGACY_COLLECTION_SCOPE_2026-10-06.md)，完整证据与版本边界见[本次请求包及结果](../P3_NEXT_SMALL_COLLECTION_PACKET_2026-10-06.md)。

## 单次运行与独立QA

- 候选源 `mof-fujian-supervision-dynamics`；fresh `fiscalhot_oct06_fujian_small_test`，loopback PostgreSQL，35 migrations。仅一条source，仍disabled、site/syndicate fulltext关闭，无pagination；`initialBackfillLimit=2`、`detail.maxFetches=2`仅在隔离fixture中收窄。实际runner使用正常enqueue-only PgBoss client；没有应用 `.work()`、`.schedule()`或worker入口。
- 唯一实际调用 native exit 0。3/12次GET dispatch：精确列表URL及两条精确allowlist详情URL，全部HTTP 200、`text/html`、完整EOF；无redirect、retry、reject、附件或API请求。HTTP和DB事实来自ignored `.data/fiscal-qa/p3-fujian-small-20261006/live-run.manifest.json`及只读DB复核；本handoff未再次联网或重跑。
- 保存压缩raw响应字节数/SHA-256（独立重算匹配manifest）：list 4,399 / `fe899365992feb4b51a9cbbbee6fd73b14411eb5b599296b42c81e22f9cbbdea`；详情1 7,129 / `24a986f0b04552072b0c3b1b38fca92d017c55fde4b7b19b40af852d07a0bda0`；详情2 4,391 / `9ef4fad6dfe3e82b130222e41ededf5917a0adcbe9e655d0ccd9c9c5dd14a9c2`。清单body原件在ignored `live-responses/`。
- DB终态：articles=2，URL正好是两条批准详情；fetch_runs=1。第一篇标题“财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量”，list显示日和detail `PubDate`日均为2026-09-22（detail 08:21 +08），URL路径日2026-08-28；DB存list日午夜`2026-09-22 00:00 +08`。body `ok`、1,659 chars，SHA-256 `8293e165f849d4f7882ff519cbab2397ae269d59a14e8ccc2dbc0f37cceb6e09`。
- 第二篇标题“财政部福建监管局：2025年度单位决算”，list日、detail `PubDate`日与路径日均为2026-08-17（detail 12:56 +08）；DB存list日午夜`2026-08-17 00:00 +08`。正文`pending`，selector警告`non_article_container`，静态容器只有标题；附近PDF链接保留但未请求。不能计为正文成功。
- 独立只读DB核验：source仍disabled/fulltext关闭，health `ok`，`initializedAt`/`lastOkAt`均为`2026-10-06T12:04:16.131Z`；coverage字段仍unproven。analyses/receipts/publications/selected_ledger/job_runs均0。队列 `content.analyze`和`content.extract-body`各1条`created`，started/completed均0；无应用worker消费。
- preview在采集前基线与最后复核均只读。最后SQL使用`BEGIN TRANSACTION READ ONLY`并`ROLLBACK`；`fiscalhot_preview_test`仍35 migrations、3 sources（enabled/fulltext=0/0）、3 articles均body_status none且body空、3 publications、fetch_runs/analyses/receipts/selected_ledger/job_runs均0。preview没有queue表，preview队列计数未知。未触及其他数据库。

## PARTIAL原因与证据版本边界

实际listing响应是gzip HTML。本次live runner SHA-256 `F580FDD55EC9BF82FD8DA713897D783704AAB878892C8F9633A8C2942CA4C0B1`、guard SHA-256 `671FEB2169631520D8DCA4E7EFDFF7C00BC4D04755A65120211519F0DDE973BC`；该guard没有证明解压后所有候选在collector parser返回前均通过精确URL检查。因此listing候选parser边界在live中未完全证明，尽管独立核对的两条写库URL均为批准目标，实际dispatch也仅为精确3 URL。后来guard `ACFA269027463E3409DE26095FF4D9EC7756F81088CF5A268DAE0922694BF4E0`和runner `703E2521296B7C0D2A4856C7901DD8E29817CD9906B3AA5D9F781B419F29FD04`通过gzip listing loopback canary（`.htm.evil`候选在parser前拒绝、两条精确详情接受）及其他离线安全canary；它们没有用于live，不能追溯补足此证据缺口。没有二次真实请求。

此前`fiscalhot_preview_test`只读基线和本次after查询相同；after SQL输出在本轮工具结果中，未另存ignored日志。`preview_after=RECHECKED_READ_ONLY`。迁移日志、manifest、live raw、preflight以及队列审计均留在被git忽略的`.data/fiscal-qa/p3-fujian-small-20261006/`；本次文档提交不包含它们。

## P3剩余项、风险与下一步

本样本不证明全栏目完整性、排序、权威日期、90日覆盖、跨周期重复或正文业务质量。live gzip listing parser边界仍未证实；第二篇正文pending。Gate 2仍`NOT_PASSED`，来源`NOT_ADMITTED`，coverage `unproven`，pagination opt-in未发生。后续来源评估须另行核定范围；不可重跑本次授权、不可把测试cursor复制到preview/production。OCR继续按用户决定`OCR_DEFERRED_NOT_GATE2_BLOCKER`，本轮未做OCR、模型/provider、Jina、附件、推送或全套测试。

本轮只读Git确认分支`feat/fiscal-finance-hot`，起点HEAD和`origin/feat/fiscal-finance-hot`均为`0f14bc4014270205ce6f982ca4bf277a9d957162`，origin为`https://github.com/revercgy-hub/MYHOT.git`。本轮只做文档校订，无需重跑软件测试或CI；代码验证仍仅引用先前tested SHA `c7a027491b809f91edec42c3abeaee017e901ba9`，不得说本轮重新通过。

## 声明

只陈述本文件与所链接的实际证据支持的结果。`collector=ok`不覆盖gzip listing边界缺口或pending正文；本有限样本及该文档未提及的行为均不构成Gate通过或source admission。
