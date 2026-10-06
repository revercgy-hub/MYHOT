# P3 下一来源小规模 Collector 请求包（2026-10-06）

## 状态与结论

**状态：`EXECUTED_ONCE / PARTIAL_LIMITED_SAMPLE / NOT_ADMITTED`。** 2026-10-06 root 核销后，对福建监管局工作动态 `mof-fujian-supervision-dynamics` 执行了唯一一次有界 legacy collector。样本仅一张列表和两篇详情；两条实际写入 URL 符合精确 allowlist，但本次 live listing 是 gzip HTML，实际运行使用的临时 guard 未解压后验证所有候选再交给 collector parser。因此 listing parser 边界在 live 中未完全证明，整体结果记 `PARTIAL`。本文件记录有限证据，不是来源准入、90日覆盖、pagination opt-in 或 Gate 2 通过。

推荐福建的理由是既有该源真实 collector 有 1 个列表页加 10 个详情页成功，另有独立 cap=1 的重复列表读取成功（10 个候选、0 新建、0 修订），并且有 9/10 正文样本为 `ok`。一个待确认正文随后被单独诊断为只有标题的 HTML 容器并邻接 PDF；这证明本源存在必须保留的正文缺口，不能请求附件或将该行算作正文通过。

上海被认真比较但不优先：它有已保存 page 0/page 1 及 2026-07-31 详情的 source-bound 证据，旧首轮 collector 的十条正文都为 `ok`；然而其旧重复列表请求超时，整体仍 `PARTIAL / NOT_PASSED`。page 1 有一个 PDF，3/10 列表日与 URL 日期不一致；一条详情的可见发布日期和列表日为 7/31、`PubDate` 为 08:17 +08、URL token 为 7/28，这不能证明全源 `PubDate` 等于原始发布日期。北京旧重复 collector 成功，但所举详情权威日期为 9/30、列表日为 9/24，首轮十条正文均 `pending`，之后只对一篇显式抽取为 `ok`。因此福建对本次少量实际 HTML/body 行为检查的历史证据相对合适，但并未通过准入。

## 已核验证据与日期边界

- 仓库在 `feat/fiscal-finance-hot`，起始 HEAD `0f14bc4014270205ce6f982ca4bf277a9d957162`，工作树干净。OCR 状态为用户决定的 `OCR_DEFERRED_NOT_GATE2_BLOCKER`；本工作没有重开 OCR。
- 19 个 production source 均 disabled、全文关闭、无 pagination opt-in。Phase B 只批准工程实现，不批准任一来源或复用未获批的 opt-in。
- 福建旧 collector 记录：列表 10 项，来源配置日期规则读 `PubDate`，一个业务样本列表日 `2026-09-22`、详情时刻 `2026-09-22 08:21 +08`；保存库用列表日午夜。十项中的发布日期在 2026-08-10 至 2026-09-23，均落在当时运行窗口内，但单页/样本不能证明栏目全量90日历史、全源日期权威或排序契约。
- 福建一条 `2026-08-17` 列表记录对应页面仅有标题容器，页面外另有 PDF。既有诊断没有下载 PDF，并确认 body 为 `unconfirmed`。本候选不能以该行的日期推断 PDF 正文可用。
- 上海 Phase C 保存的 page 0、page 1 和 July 31 详情原始证据继续有效且有限；page 1 的边界可见日期是 `2026-07-24`，但这不能充当真实末页或90日覆盖证明。
- 日期处理只接受 collector 解析到的列表日或本次配置规则返回的详情发布日期，保存原始观测值与其来源字段；不以 URL 日期、抓取时间、运行日或人工推算替代发布日期。目标样本若无可解析日期、日期冲突、异常未来时间或超出按运行时点计算的90日窗口，须保留为未决并停止该候选，不得用旧报告的日期为本次 response 背书。

## Collector/config 只读检查及关键阻塞

现有 legacy `collectSource()` 能从配置中只抓一个 `web_list` 列表页，再按 `detail.maxFetches` 对新文章请求详情；当前福建设定为 10，列表无 pagination。内容配置只含 `.my_doccontent`，没有 `pdfDirect`、附件 selector 或附件模式，因此 HTML 正文解析不会因页面出现 PDF 链接而自动下载它。应将详情 URL 解析与 HTML 正文读取分开记账，任何非 HTML Content-Type、跨源跳转、未知 API/XHR 或附件 URL 都应在 dispatch 前拒绝。

初版 packet 曾将 legacy 首次成功时写入 `cursor.initializedAt` 视为所有测试库的硬阻塞。Sol 已于 2026-10-06 在 [有限 legacy collector 范围裁定](S1_P3_LIMITED_LEGACY_COLLECTION_SCOPE_2026-10-06.md) 澄清：fresh、可丢弃的 `_test` 库可保留这项实现行为及相关 `lastOkAt`、health/fetch 状态；它们只记录这次有限运行，不证明90日回填、完整历史、来源准入或 Gate 2。该裁定不要求核心代码/source config/pagination 改动，也不允许将测试 cursor 导入正式或 preview 库。原先“零 initializedAt”要求已被此范围裁定取代；运行报告仍须逐项记录 cursor 字段，并明确 `coverage=unproven`、`sourceAdmission=NOT_ADMITTED`。

因此 `initializedAt` 不阻止本次 disposable legacy 测试。真实运行已由 root 单独核销一次。详细运行结果、限制和证据版本边界见本文末尾。

## 批准范围与唯一一次实际运行

候选源：`mof-fujian-supervision-dynamics`。隔离数据库建议名：`fiscalhot_oct06_fujian_small_test`（新建、35 migrations、无生产/preview 连接）。仅创建单条测试 source，`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`，使用 `industry/sources.json` 当前福建 HTML selector/date/body 配置的隔离副本；按 Sol 裁定仅在隔离 fixture 中设 `_aihot.initialBackfillLimit=2`、`detail.maxFetches=2` 并配置两条精确详情 URL，不回写来源配置。不得启动 worker、schedule、preview 服务、model/provider、OCR、Jina、embedding 或推送。collector 以一次性 direct runner 调用，不能依赖全局 `COLLECT_ENABLED` 开关作为预算。

请求总量拟设硬上限 **12 actual dispatches（含 redirect hop）**、1 个栏目页面、最多 2 个 HTML 详情；每条请求只能是 GET，固定 HTTPS origin `fj.mof.gov.cn`、目录 `/gzdt/caizhengjiancha/`、无 query/fragment/credentials，禁跨 origin redirect、重试、并发和所有附件/API 请求。预期在无 redirect 情况下最多3次 dispatch；第4至12仅作为同一请求链的有限 redirect/harness 计数空间，不是扩张内容数量的额度。任何预算外请求在派发前拒绝，超时/失败也消耗已派发额度。需要明确的 instrumented dispatch observer 对每次 `undiciFetch` 计数；若 legacy collector 路径无法以可靠 observer 约束所有详情 dispatch 与 redirect，整轮不得开始。

现有 saved evidence 中可绑定的确切福建 URL：

1. 列表：`https://fj.mof.gov.cn/gzdt/caizhengjiancha/`
2. 已验业务 HTML 详情：`https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm`（旧保存样本的列表日 2026-09-22，正文 1,659 字符；本次日期必须重新解析，不沿用旧值）
3. 已确认 pending/PDF 邻接的 HTML 详情：`https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260817_3995605.htm`（只准 HTML URL；发现或跳转到 PDF 时不发起附件请求，标 `unconfirmed` 并保留原始附件链接）

collector 会从本次列表解析新候选；仅当上述已批准详情 URL仍出现在本次返回的首批候选且确切 URL 完全匹配，才允许对其发详情请求。新列表若不含这些 URL，则仅记录列表解析观察并立即停止；不得临时把新 href 加入 allowlist。候选超过2篇时只处理这两条固定 URL；其余不得触发详情 dispatch。若当前 legacy collector 无法在不改共享代码的前提下按固定 URL 集限流，则需在 Sol 审查后的隔离 runner 中先做防护实现和 loopback 预检，不能放宽至整个10条列表。

正文只用现有配置 `.my_doccontent` 执行静态 HTML extraction/identity checks；不执行脚本，不打开未知附件，不调用 PDF parser、OCR、外部 API 或模型。无正文/标题型容器/身份不符时记 `pending` 或 `unconfirmed`，不自动精选。只读终检需核实一条 disabled source、全文关闭、最多两篇材料、原始日期、URL/hash/HTTP 与 dispatch manifest、零附件 dispatch、cursor 全字段、以及零 coverage/complete声明和零 analysis/receipt/publication/selected/job_run。允许记录本次 legacy `initializedAt`/`lastOkAt`/health 结果，但只能称为 disposable 单次运行状态。创建 collector 的分析队列项但不消费时，必须明确记录 queue 计数，并保证不存在 worker/job_run。

## 需要的审查与准入

1. Sol 已批准一次 fresh disposable legacy `_test` 运行保留首次 `initializedAt`，并已澄清它仅为实现状态，不是覆盖/准入证据。该裁定没有批准实时请求。
2. Sol/QA 核准 collector 路径能以 pre-dispatch instrumentation 硬限制总计12次实际 dispatch、最多3个固定 URL（列表+两个详情）、零重试和零未知 URL；完成全部 host/path/method/redirect/attachment/API/Content-Type canary 以及 fixture 生效证明。仅有一个低层计数 hook 不能替代目标 admission。
3. root 单独核销一次 run 预算。该核销不得被解释为来源准入、90日覆盖声明、90日完成或 Gate 2 通过。
4. 运行只使用上文所列福建精确 URL；若现场列表变化，按上述 abort 条件保存 partial/失败原态，不补请求。

## RESULT / RISKS / BLOCKERS / NEXT

**RESULT**：2026-10-06 在新建的 `fiscalhot_oct06_fujian_small_test`（`127.0.0.1:5432`，35 migrations）执行了唯一一次 direct `collectSource(..., {force:true})`。源为 disabled，site/syndicate fulltext 关闭；fixture 仅设 `initialBackfillLimit=2`、`detail.maxFetches=2`，无 pagination。实际 HTTP 总数为3/12（1 listing + 2 detail），全为 GET、HTTP 200 `text/html`、完整 EOF；没有重定向、重试或拒绝请求。collector 返回 `ok`，found/created=2/2。独立读取 fresh test DB 确认写入文章 URL 正好是两条批准详情 URL；但实际 list body gzip 压缩，live runner 当时的临时 guard 对wire bytes执行列表候选检查，无法证明解压后所有列表候选均经过 exact candidate 边界检查，所以总体QA结论保留 `PARTIAL`。

请求目标严格为：`https://fj.mof.gov.cn/gzdt/caizhengjiancha/`、`.../202608/t20260828_3996275.htm`、`.../202608/t20260817_3995605.htm`。两篇结果分别为：

- `202608/t20260828_3996275.htm`，标题“财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量”。列表显示日为 `2026-09-22`，detail `PubDate` 为 `2026-09-22 08:21:00 +08`，URL路径日为 `2026-08-28`；数据库保存列表日午夜 `2026-09-22 00:00 +08`（UTC `2026-09-21T16:00:00Z`），没有保存detail时刻。正文 `ok`、1659 字符，body SHA-256 `8293e165f849d4f7882ff519cbab2397ae269d59a14e8ccc2dbc0f37cceb6e09`。
- `202608/t20260817_3995605.htm`，标题“财政部福建监管局：2025年度单位决算”。列表显示日、detail `PubDate` 中国日均为 `2026-08-17`（detail时刻12:56 +08），URL路径日为 `2026-08-17`；数据库保存列表日午夜 `2026-08-17 00:00 +08`（UTC `2026-08-16T16:00:00Z`）。正文 `pending`、无正文；collector stderr 记录 `source body selector declined` / `non_article_container`。保存HTML `.my_doccontent` 只有16字符标题，页面其他位置提供相邻PDF链接；没有派发PDF请求，不抓附件。

独立解压并解析保存的列表raw确认10个列表项，其中恰有两条候选URL与上述固定详情allowlist精确匹配；原始列表压缩body为4,399 bytes。两篇detail raw分别为7,129和4,391 bytes，SHA经QA本地重算均与manifest一致。detail selector静态观察需去除style后解释；容器原始DOM文本长度可能包含CSS，不能以原始DOM长度代替正文长度。

数据库终态（manifest与独立只读查询）：sources 1、articles 2、fetch_runs 1；analyses、receipts、publications、selected_ledger、job_runs 均为0。QA独立读取 `pgboss.job` 确认 `content.analyze` 与 `content.extract-body` 各1条且都为 `created`，started/completed 均0；没有 worker 消费。source 仍 disabled、全文关闭、health `ok`；`lastOkAt` 与 `initializedAt` 均记录这次运行时间 `2026-10-06T12:04:16.131Z`。它们只表示一次 disposable 测试运行。`coverage=unproven`、`sourceAdmission=NOT_ADMITTED`、`Gate2=NOT_PASSED`。此前 `fiscalhot_preview_test`只读基线为3篇空body样本、3 publications、无enabled/fulltext sources及零fetch_run/analysis/receipt/selected/job_run；最后另在`BEGIN TRANSACTION READ ONLY`中复核并ROLLBACK，35 migrations、3 disabled/fulltext-off sources、3篇空body articles、3 publications，fetch_run/analysis/receipt/selected/job_run仍为0；`preview_after=RECHECKED_READ_ONLY`。

原始响应体均保留于 ignored `.data/fiscal-qa/p3-fujian-small-20261006/live-responses/`，每项有字节数、SHA-256、EOF、status、Content-Type；正文内容为 gzip 编码的 HTML。不可变 live-run manifest SHA-256 为 `CE414E13E6623822C0575DE17EE23B3849EA7EE15763218AA9D0A6A39B2D3351`；stdout SHA `6413BD802F53C5ED28D57B0CE53DFF63B225FA67237F7B764F4E306A84841489`、stderr SHA `AD9C0678CC372DAC219889733F66163F98AB777E02D4C29A8AE0DB25B7796231`、native exit `0`。应用迁移 native exit `0`，共35 migrations。

**证据版本边界**：单次 live run 使用的 runner SHA-256 为 `F580FDD55EC9BF82FD8DA713897D783704AAB878892C8F9633A8C2942CA4C0B1`，dispatch guard SHA-256 为 `671FEB2169631520D8DCA4E7EFDFF7C00BC4D04755A65120211519F0DDE973BC`。它使用 exact outbound dispatch allowlist 与 fixture `allowUrlPrefixes`，实际返回并保存的两条 detail URL 均与固定批准目标完全匹配。为覆盖 live 响应使用的 gzip HTML，之后给临时 guard 增加了 listing body 解压及 candidate exact-URL parser-boundary 校验；该更新未用于 live run，也没有再次请求外部站点。更新后的 offline loopback preflight native exit `0`，guard SHA `ACFA269027463E3409DE26095FF4D9EC7756F81088CF5A268DAE0922694BF4E0`，runner SHA `703E2521296B7C0D2A4856C7901DD8E29817CD9906B3AA5D9F781B419F29FD04`。它通过了压缩 listing 中 `.htm.evil` 候选在 parser 之前拒绝、两条精确 gzip detail 候选接受，以及 method/host/path/suffix/port/query/attachment/API、redirect、non-HTML、6 MiB body limit、dispatch cap、duplicate retry、fixture caps 等 loopback canaries。此前一次 `node --import tsx` 预检启动命令因本仓库未安装 `tsx` 而 exit 1，未启动 canary；原始日志和 exit 已保留。最终成功命令直接用当前 Node 运行 `.mjs`。

**RISKS**：这是一页栏目和两篇详情的单次样本；没有证明日期规则、排序、栏目完整性、连续90日覆盖或来源整体质量。第一篇显示/详情日期为9/22但URL日为8/28，第二篇正文缺失，不能计为通过。实际 live guard 版本尚未对压缩listing解码并在parser边界审查所有候选；不过独立只读数据库核对显示写入的两条URL均为批准目标，固定dispatch guard拒绝任何未知详情URL。后续offline canary验证了gzip candidate校验，但不替代live实测。

**BLOCKERS**：来源准入、90日覆盖、Gate 2 与 pagination opt-in 均未通过；live listing parser-boundary exactness未证明。无待执行的live runner请求；不允许将本次测试cursor复制到preview/production。

**NEXT**：若以后继续来源评估，应另行提出范围与授权；任何后续 live collector invocation 都是新的一次请求，不能复用本次 GO。保留 pending 正文缺口，不发起附件下载。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN

**TASK**：准备并执行一次有界 Fujian P3 legacy collector 样本，完成隔离库只读终检。

**MODEL**：GPT-6 Luna High。

**FILES_CHANGED**：本轮文档交接由负责人维护 `STATUS.md`、`HANDOFFS/README.md`、本packet与 `HANDOFFS/P3_SMALL_COLLECTION_CHECKPOINT_2026-10-06.md`；Sol另增其scope裁定。本轮没有修改source config或共享代码。执行器、临时dispatch guard、canaries、gzip raw响应、manifest、stdout/stderr/native exit、迁移日志与queue-audit均在ignored `.data/fiscal-qa/p3-fujian-small-20261006/`。

**TESTS_RUN**：最终离线 loopback preflight通过，8次实际loopback dispatch，无diagnostic callback errors；3个批准production URLs的政策准入检查及forbidden method/host/path/suffix/port/query/attachment/API拒绝检查通过；gzip listing candidate allow/reject检查通过。Live collector只运行一次，native exit 0，dispatch 3/12，数据库35 migrations，终态只读计数及queue states已核对。preview-after由QA使用`BEGIN TRANSACTION READ ONLY`复核后`ROLLBACK`，计数与baseline一致。没有运行worker、模型、OCR、provider、推送或repository-wide test suite。executor早期preflight因syntax/hash路径冲突失败的ignored日志仅作历史，不计为最终成功；最终成功preflight命令用当前Node直接运行 `.mjs`。
