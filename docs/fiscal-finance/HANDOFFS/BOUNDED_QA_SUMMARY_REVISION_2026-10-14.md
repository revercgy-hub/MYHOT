# 有界正文QA与摘要修订交接（2026-10-14）

本检查点更新本日早前的 [预览交接](LOCAL_PREVIEW_REVIEW_2026-10-14.md)。旧结果保留为历史；保存的执行结果与当前数据库健康状态分开描述。

隔离采集库 `fiscalhot_catalog_sweep_20261013_test` 最近保存的结果是442篇：367 `ok`、64 `pending`、11 `unconfirmed`。其中12条HTML执行保存的前后统计为355/76/11 → 367/64/11，文章总量442不变。该统计来自保存SQL export，不是PostgreSQL停机后的实时查询。预览库最近核实的总量仍为65条无正文摘要；batch2、batch3的新增40条未导入。

12条HTML的独立离线核验通过：raw长度/hash、gzip解码、精确URL绑定、配置parser重放、正文与HTML、contentHash和revision增量均一致；保存的427条队列前后不变，两个来源的配置前后完全恢复。manifest SHA `f06b41524254dbfd4c5286eef4605f386800aaacfc352d175e99af353ec3f500`，SQL export SHA `bd1b6ee7067bc2a2dea44bfa71d2d35ea071e5b4c71363826a0720b56c20cafd`。QA文件 `.data/fiscal-qa/fallback-qa-20261014/html12-qa.json` 的结果为 `PASS_OFFLINE_12_HTML_CURRENT_SQL_BLOCKED`：当前SQL和cursor核验因127.0.0.1:5432拒绝连接未完成，且执行export没有完整非目标文章逐行前后指纹。不能用总量不变代替非目标逐行证明。

25篇未知HTML/附件壳诊断共23次单次GET、2份旧raw复用，均HTTP200，未请求任何附件。每份保存raw长度/hash与精确URL均核实。目录 `.data/fiscal-qa/attachment-html-pending-20261014/evidence/`；manifest SHA `fd2acb01526f3b387a73aa23bfcd1967f4438b8abbc6c52b2156b437b616edfd`。PBOC五篇存在长HTML正文，一篇手册为329字说明和图片；Treasury三篇存在859–863字HTML债务数据及未读PDF附表；Accounting包含通知、短表和征求意见附件稿函；厦门债八篇只有21–32字标题壳及5个PDF、3个ZIP链接。离线helper的被禁止附件fetch stub不是真实下载失败。正文/附件候选观察未改变DB的pending状态，也不代表整源准入。

该诊断runner按请求调用起点控制750ms，DNS预检造成4处实际dispatch间隔为728/724/724/748ms，未满足实际750ms间隔。`cadence-audit.json`明确记为 `CADENCE_REQUIREMENT_NOT_MET`，保留执行不合规记录，不重发。Root裁定字节与URL身份真实性不受此偏差影响，可附执行缺陷用于离线正文事实审阅；不外推稳定性或准入。后续runner须在每次请求完成后等待至少750ms，并审计实际dispatch间隔和原请求cap。

batch2先前内容QA PASS被本次事实复审发现的错误部分取代：内贸险原摘要错误否认保费支持安排；康复护理原摘要错误称正文缺少床位/人员目标；内贸险topic将信用保险误归政府性融资担保。batch3两项专项债topic缺乏正文依据。旧文件和旧QA完整保留，新修订包在 `.data/fiscal-qa/fallback-review-v2-20261014/`，仅修改上述五个内容字段并重算摘要字符数、记录fallback provenance。原文身份、日期、revision、正文hash及引文不改。

batch2修订 SHA `e9a30dc9bfc78d9bb62cabc9b33a28d7ecf3bd9d63545b2237a421d3fbf9b87c`；batch3修订 SHA `af6d5990d61c9b6c21a1ff35805ed7a07d65e68fb71946b3f17e23d5348aa3a2`；唯一40条 `import-plan-40.json` SHA `fce8b40b0533401deade1f05ef62ed0588bb3e2c462acac87611b5d1a2640444`。修订作者不是其独立QA，文件明确 `independentQa=false`，Root已独立阅读五字段变更及对应冻结正文，裁定五处修订 `APPROVED_FOR_LOCAL_SUMMARY`。这不等于全40条独立复审、当前SQL核验或Gold。40条ID/URL内部唯一；batch2保存的65条预览URL核对结果未发现匹配，batch3仍需当前SQL独立去重。105仅是全部成功新建后的预期值，不是已入库总量。

导入仍沿AD-012既有人工override与publisher路径：精确 `fiscalhot_preview_test`、local-preview IDs、原始题名/发布日期/来源保留、bodyless/summary-only、selected=false、score/reason=NULL、不写analysis/receipt/job、source及全文关闭。现有19条runner的旧hash/count/baseline不能直接用于新40计划；服务恢复后先做只读去重、baseline和CAS预检，冻结适配runner，再导入并独立核对DB/页面。本阶段未改运行代码，也未重启服务或绕过自动审批拒绝。

Gate 2仍只为 `PASSED_FOR_BOUNDED_P4_PILOT`。其他Gate、首次90日完整覆盖、人工Gold和正式模型评估没有新增通过结论。所有普通采集/模型/provider/worker/OCR及外部推送开关保持关闭。

MODEL：requested GPT-6.1 Sol Medium；实际模型执行未独立核验；临时quota fallback。新稿不是Human Gold或正式模型精选。本阶段修订作者仅作自检，Root已独立核销上述五处修订，未核销全40条导入预检。

