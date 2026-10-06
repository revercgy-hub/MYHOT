# S1 Web-list Phase B 直接 HTML metadata 续跑范围裁定 — 2026-10-06

TASK=S1 新增 Phase B 架构范围裁定；只审查，不实现、不测试。
MODEL=GPT6.1SolMedium；未调用项目 provider。
RESULT=APPROVED_SCOPE（仅本报告限定的 metadata 详情续做；提案中的裸 `<24h` 日期升级不获批准）。
GATE2=NOT_PASSED。

本报告是对 [Phase B 提案](WEB_LIST_PAGINATION_PHASE_B_PROPOSAL_2026-10-06.md) 的独立范围裁定，不是 Phase A 复审或 Gate 2 验收。Lead 交接的最新 fresh 35 migrations、276/276、typecheck、Web build / 15 tests 为交接信息，本人没有重新运行；最终 Phase A smoke/code commit/CI 仍由 QA 核销。本文批准 Luna 实现可在离线/合成 transport/loopback 中验证的直接 HTML title/date 续跑，不授权真实请求、来源 opt-in、worker 或模型运行。19 个 source 仍 disabled、两种全文均 false；Gold、S4、receipt、调度、apps、数据库 schema 和公开发布层冻结。

## 审阅证据与具体修正

只读审阅 AGENTS.md、README、docs/sources.md、docs/deploy.md、PROJECT_PLAN、STATUS、原 S1 分页裁定、Phase B 提案及实际 config-keys、web-list、collect、web-list-pagination、http-fetch、URL identity、materials、queue、content jobs、body-readiness 代码。没有 Git、DB、HTTP 操作。

当前 `fetchDetail` 的 HTML metadata 路径可以复用 selector/regex；但 options 只有 fetcher、非 200 返回空字段、普通日期允许泛化 meta 回退，不能直接当严格权威完成。`need.body=false` 确实不会进入 PDF/Readability/selected-body helper，但必须把这个约束封装在 Stage B 显式入口，不能只依靠调用方习惯。当前 budget 只准入 listing identity，必须扩展为 source-local 的 list/detail target admission，不能仅把同一 signal 传下去。

旧 collector 的 `storedTitles` 只按 URL 读 title，既不读真实 identity，也不证明 title/date 的详情 provenance。旧 `<24h` 比较可接受跨日值，不能作为同日一致性依据。`upsertMaterial` 插入时保存 `published_at` / `published_at_claim`，既存行的 content revision 不修正它们；Stage B 不能声称一次 title revision 已修好历史日期。这些问题按下列保守契约处理，禁止为解决它们修改冻结模块。

原 S1 的“19 个有必要 detail 规则”应理解为禁止迁就分页而削弱这 19 个来源的保护范围，并非 19 个都有显式 detail。实际 manifest 本次只读核得 19 entries、11 个带 detail、8 个不带，全部 disabled/fulltext=false、0 个 pagination；本报告纠正这一数量表述而不缩小保护范围。

## 1. 最小显式 schema

保留 Phase A 的 `pagination.mode=mof_index_v1`、`maxPagesPerRun=1..2`、`maxDispatches=1..12`、`maxPageIndex=1..100`；只增可选 `pagination.detailMode="direct_html_metadata_v1"`。该值必须显式出现，其他值、null、array、未知键、字符串数字、非整数等拒绝。缺 detailMode 完全沿用 Phase A；缺 pagination 完全沿用 legacy，不对 legacy 的 maxFetches 或日期算法增加全局限制。

本 mode 必须有 object `detail`、显式 integer `detail.maxFetches=1..10`，及至少一项实际使用的 title/date selector 或 regex。authority / upgradeDatePrecision 若出现须为 boolean；titleAuthoritative=true 必须有非空 title rule，publishedAtAuthoritative=true 必须有非空 date rule，upgradeDatePrecision=true 必须有 date rule。selector/regex 必须按已有 config 规则验证，日期 offset 必须合法。权威规则返回空/无效结果不能回退列表或泛化 meta 成功；无权威声明时也只把已配置的发布日期规则作为本 mode 的详情证据，不把页面其他 time/update/related timestamp 自动当原发布日期。

保持现有 MOF 单子域、HTTPS、精确单目录 allow-prefix、HTML、列表 selector、固定 backfill 日期规则；不放宽 URL formula/prefix、不猜 next-link、不支持 adapter/Jina/baseUrl/rewrite/fragment identity。允许保留已有 bodySelector/allowShortBody/bodyPolicies 供原内容 job 使用，但本 mode 不调用它们。拒绝 pdfDirect=true、articleSelector、attachmentSelector、attachmentMode、attachmentScopeSelector 及 PDF/envelope 组合，配置本身保留；不能删除它们以迁入 Stage B。summarySelector 可保留而不执行，`need.summary=false`；摘要续做未批准。

## 2. 一次 run 的网络、时间与候选额度

每次正常 run 只有一个 source-local budget，包含 listing、detail 和每一实际 redirect dispatch，硬上界为配置值且至多 12；一份 120 秒 deadline/signal 覆盖网络、读取、解析、DB checkpoint。逐请求 timeout ≤原单请求上界且≤剩余 deadline；解析后、事务前、COMMIT 前都复核。到期 abort 在途读取，不提交未完整读取/验证的 metadata。清理/失败记账可以在到期后进行，不能借此继续处理候选或推进页。

详情文章数独立计数：每个 run 最多 detail.maxFetches 个不同 pending article targets，总计≤10，不因换页重置；实际发出失败请求也占一次，redirect 仅再占 HTTP dispatch，不再占文章额度。没有重试/fallback/自 enqueue。每次新 run 可取得新额度，但 fixed generation/anchor 不改变。

candidate URL 入 snapshot、恢复、发请求和 redirect 使用同一 admission：合法 HTTPS、无 credentials、无异常 port/query/hash、精确 source origin 与目录 allow/deny 校验，拒绝目录及 index_N listing aliases；identity 使用现有 `identityKeyFor` 的 URL identity，不能另造标题 identity 或跨域 canonical。拒绝本 run 已派发 URL、同 identity 的重复详情尝试、redirect 回环/换 article/换 list/越 prefix/跨 origin。每跳必须同当前 pending row identity、遵守现有 redirect cap；即使 normalizeUrl 把两个 URL 判同 identity，也不能跳过 origin/prefix/语法检查。详情返回的 final URL 再次校验，不采用 HTML canonical 改身份。

先做本地 target admission，合法 target 仍走现有 SSRF/DNS guard；transport 在实际 Undici dispatch 前同步 consume 同一 budget。拒绝派发不计数，已派发网络失败计数。不要引入全局 dispatcher monkey-patch 或用 paid receipts 代替此预算。Jina/PDF 此轮不准入，因此不要求改 frozen provider/body helper 来接预算。

## 3. 有界、严格、可恢复的单页 metadata snapshot

在 `sources.cursor.webListBackfill` 增可选单个 pendingPage；复用 JSON，无 migration。页码必须等于 nextPageIndex，绑定现有 generationId/configHash；继续保留 fixed anchorAt/cutoffAt、coverage=unproven、active/blocked/config_changed。恢复前完整验证 cursor 与 pendingPage 的类型、未知键、有限范围和不变量，不能 TypeScript cast 后直接信任 DB JSON。

最小 pendingPage 保存 pageIndex、snapshotAt、identity fingerprint、metadata snapshot hash、candidates。candidates 只保存 identityHash、url、listTitle、listPublishedAt（ISO/null）、有限 row state/outcome、resolvedTitle / resolvedPublishedAt 和有限 title/date 来源枚举。可以用现有 generation/config 父字段而不重复存；state 仅 pending/resolved/excluded，outcome 使用固定代码（如 outside_window、noise），不得保存任意异常 message 或响应。snapshotAt 仅作发现/恢复事实，绝不能填 publishedAt。正文/HTML/response/raw/cookies/media/摘要、无界 URL 集与 provider 内容均禁止入 cursor/run detail。

硬上界：完整 parser page candidates≤min(initialBackfillLimit,60)，pending≤60 rows，URL≤2048字符，list/resolved title≤1000字符，整份 UTF-8 JSON≤256 KiB。标准化只允许既有 whitespace normalization；超长拒绝，不截断 URL/title 后制造不同身份或假标题。hash 必须 SHA-256，identityHash 从真实 URL identity 重算，metadata hash 覆盖有序原始 metadata snapshot，identity fingerprint 与已有重复页比较逻辑兼容；不能靠 mutable resolution 变化避开重复页 guard。恢复复算并验证 pending/resolved/excluded 的字段组合、日期、顺序和重复身份；相同 identity 多次出现仅在 metadata 一致且有明确 duplicate 分类时可合并，metadata 冲突阻塞。不能 slice 后跳页，也不能因持久化忽略未知字段而隐式丢正文。

保存的 snapshot 固定当时该页候选，不跨 run 重取该 listing、不重取已保存 resolved detail；顺序续做余下 rows，不饿死尾部。它不证明后续页/之前页稳定，不能声称解决首页前插或跨页漂移。

## 4. 日期、权威字段与已存文章

标题/日期必须来自原 source 的实际列表或明确详情发布规则，禁止 URL 日期、页号、抓取时间补发布日期。权威字段缺失、日期非法/未来而被 decideTimeline 拒绝、字段超过边界、详情身份不符时，该 row 未完成，generation blocked；不算 window 外、不跳过、不推进。权威日期声明为 unreliable 的列表日期只作观察 metadata，不能先按列表 cutoff 排除或把它当可信冲突基准。

**本最小阶段采用 fail-closed 日期一致性：**可信列表与详情原发布日期都是有效值时，完全相同才自动通过；不同则 `date_conflict_require_review`。不准沿用 `<24h`，例如 23:30→次日00:15仍为冲突。upgradeDatePrecision=true 可以请求日期，但不能据布尔开关推断返回值是同日原发布日期；未有另行批准、保存证据的 source 规则，任何不相同的精度补全都阻塞。本轮不新增精度/日期推测 schema，legacy 默认算法不变。权威 detail 替换明确不可信列表日期不属于“两个可信日期冲突”；仍必须是该 source 已配置的原发布日期规则，而非更新时间。

只有最终可信日期严格早于 fixed cutoff 才分类 outside_window，等于 cutoff 保留。所有分类复用现有 decideTimeline；发现时间保持真实 snapshot/discovery 时间，fixed anchor 只用于固定日期窗与信任检查，不拿未来 scheduled run 时刻扩大窗。整页旧日期依然不产生 complete。

existing article 按真实 identity/source 查询并在最终页事务重读：列表不能回退既存 title/date；不能因为 storedTitles 命中就标为“权威详情已完成”。当前 schema 没有足够 provenance，权威字段须以本 generation 已保存详情 resolution 或新受限详情证据验证；跨源 discovery 沿用现有 materials 行为，不夺取原 source 字段。已有 title/date 与待写权威结果不一致、日期缺失需补写或 published_at_claim / trusted 日期不一致时，用 `stored_metadata_requires_review` 阻塞，保留存量，禁止直接 UPDATE articles 或称 materials 已修日期。无权威要求的列表 replay 保留现有字段，不能把保留存量宣传为重新核验权威成功。若 content job 在网络期间改变既存字段，事务必须按当前值重新裁定；pending resolution 是证据而非强制覆盖命令。不新增 originalDate、第二发布日期、article raw provenance/body marker。

## 5. checkpoint、crash 与停止机制

沿用同 source reserved connection 的 session advisory lock，包括 force/direct/job；network 期间无 source row lock。postgres.js 3.4.9 的 reserved runtime 无 begin，继续用现有同连接短 BEGIN/COMMIT/ROLLBACK helper、finally dispose/unlock/release，不改为伪继承类型上的 reserved.begin。

1. 首次 page 完整读取、解析、admission、边界及重复页验证后，短事务锁 source，复核 current config/generation/state/nextPageIndex/initializedAt，持久化完整 pendingPage。此前零 detail、零 article/queue 写、零页推进。
2. 每次 metadata 成功或可安全分类后，短事务重核同一 generation/config/state、pending hash/page、预期 row 旧状态，保存该 row resolution。网络在事务外。crash 在请求后但保存前可在下一正常 run 再取一次；不宣称 HTTP exactly-once。保存后不得重取已 resolved row。DB 写失败保留上一次 durable snapshot，failed，不凭内存 resolution 提交页。
3. 预算/deadline 到顶且有 pending：保持 nextPageIndex，不丢 snapshot；正常有界未派发停止为 status=ok + partial=true + 明确 detail/dispatch/deadline stopReason。已派发请求中止/网络异常为 failed + partial，保持 active 供原下一正常入口续做；结构/语义/authority 缺失、非法状态、冲突为 failed + blocked。禁止 legacy best-effort catch 吞成 resolved。
4. config 变化在请求前、每条保存及页提交前复核；转 config_changed，保留 bounded pending，不在新配置下重放，不自动 reset。current state 已 blocked/config_changed、initializedAt 新出现、cursor/page/hash 不匹配时零后续 dispatch/页推进；不得用旧 expectedCursor 覆盖别人新 cursor 或其他 JSON namespaces。
5. 全部 rows resolved 或明确安全 excluded 后，一次短页事务重读 source 和有关 existing articles，复核 metadata/state，upsert 所有窗口内 rows、按原 created/revised 判定执行 queueProcessing(...,{db:tx})、清 pending、推进页码/指纹、写 fetch_runs 计数/detail。article+queue+cursor 同 commit；任何 fault 整页 rollback，已 durable resolutions 保留，下一 run 原样重放。unchanged replay 不构造新 revision/job，已由原原子事务提交的 queue 不会因 crash 丢失。

pagesCommittedPerRun≤maxPagesPerRun（即使恢复 pending 而本 run 未 fetch listing 也算一次页处理）；pagesFetched 单独记实际读取次数，不能用仅 fetched page counter 绕过两页额度。网络/候选 cap、maxPageIndex、重复/无新 identity、空页、404、countPage/末页声明都不能设置 initializedAt 或 complete；safety cap 仍 blocked/needs-review，日常 run cap 可 active partial。run detail 仅有限数字/enum：实际 fetched/committed、detail targets used、dispatches、pending rows、created/revised、stopReason、coverage=unproven；保留 fetch_runs 原 running/ok/failed/skipped，无新状态/调度/retry。

## 6. 正文与 preview 边界

Stage B 显式入口固定 need={date/title 按规则, summary:false, body:false}，只返回允许的 metadata；检测任何 body/attachment result 为契约失败而不传播。HTTP 200 且实际 HTML MIME 才解析，PDF/JSON/错误页不因含一个日期就完成。不调用 Jina/PDF/Readability/selected-body，不写 bodyText/bodyHtml/media/bodyStatus/clearAttachmentDiagnostic 或正文确认 markers。页面暂存字节只供解析，不能持久化 raw HTML。

页事务仍经原 queueProcessing/S4 hold。这可以入既有 extract 队列，但本 collector 不执行正文 job、不调用模型；tests 不启动 worker。原 body/attachment marker 与正文状态保持，严格 readiness 不被 metadata revision 解除。safe preview 对 Phase B 也始终 page0、零 detail、零 cursor/初始化/DB 写；独立 budget 含 redirects，解析后复核 deadline，保留 single_page/paginationExecuted=false/unproven。不得把预览当权威详情或完整回填验收，不需 apps 改动。

## 7. 来源事实与真实阶段边界

福建、北京、上海、河南、湖北、湖南、广东监管动态已有 maxFetches=10 和 direct HTML date rule，属于代码形态候选；北京带 title/date authority，需严格缺字段/冲突证据。这七条都缺本 mode 所需本 source 页码/页身份/排序/日期语义与跨周期证据，未获真实 opt-in。mof-finance-notices 的 envelope/attachment 不准入；mof-accounting-notices 保留 bodyPolicies，不由此推断详情日期可用；pboc-open-market 有 maxFetches=3/date/body但域名不匹配 mof_index_v1；xiamen-finance-debt 仅 bodySelector，无 metadata resolver/maxFetches，不适用。

广西、海南、重庆、四川的保存 page2 样本不是这 19 条 manifest 的来源；相似域名不能借证据。11/19 detail 数量、七条代码形态、四局分页观察都不能推出已适用、原发布日期一致、90 日覆盖或 Gate 2通过。首个真实 source 必须另报明确 id/已保存本栏目分页与详情事实、日期语义及准入裁定；本报告不选择/修改/启用来源。

## 可直接派 Luna 的文件范围与关键测试

允许必要改动仅：`packages/backend/src/sources/config-keys.ts`、`web-list-pagination.ts`、`web-list.ts`（显式 metadata transport/字段边界，legacy 和正文 helper 判定不变）、`collect.ts`（仅确需接线）。`admin/sources.ts` 仅 Phase B preview 验证必需兼容，`lib/http-fetch.ts` 仅若现有可选预算接口确实不能满足本契约的最小兼容改动；优先复用而不改 transport 全局行为。`types.ts` 仅局部类型确需。对应 tests/web-list-pagination*.test.ts 可扩展；另可加独立 metadata contract test。docs/sources.md 精确行为说明交实施/QA owner 更新，本文 owner 不动 shared docs/index。

禁止 industry/sources.json、apps、migration/schema、materials、jobs/content/queue/sources、publication、S4/selected-body/PDF/OCR、providers/receipts、Gold、调度、真实 probe wrapper 改动。本阶段不实现 complete、增量切换、reset API、跨页完整性。

实施关键契约（合成 fixture/MockAgent 无 DNS 或官方 endpoints；DB 用 fresh `_test`，loopback 若必要仅本地）：

1. schema 非法组合请求前拒绝；缺 detailMode 保持 Phase A，缺 pagination 保持 legacy。Jina/PDF/envelope 不能被删配置后“通过”；200 非HTML、权威空字段/泛化日期 meta 不成功。
2. 两页和跨 pending resume 全 run≤12 dispatch、≤10 detail targets、≤120s；redirect/失败实际计数；无 retry，blocked/currentstate/config-change 下一请求前止；解析后与 commit前 deadline 校验。恢复 pending 也受两页提交上限。
3. >10 待详情候选续跑到尾部；成功 row 不重取、列表 snapshot 不重取，fixed anchor/cutoff 不漂移；完整候选/长 URL/title/256KiB cap fail-closed、不 truncate/slice；未知键、伪 hash/身份、重复冲突、非法状态、过界页码均拒绝。
4. 权威缺 date/title、未知/未来日期、跨日但<24h、同日不同可信时间、stored 日期 null/冲突均停页待审；authoritative unreliable list 不能预先 cutoff 丢行；exact-equal 和真实 detail 补缺的新行可以通过；禁止 URL/fetchAt 造日期。existing replay 保 title/date、同 identity/current article 漂移重新裁定，确认没有“title revision 修日期”的假成功。
5. fault 覆盖 snapshot保存前后、detail响应未保存、单row保存后、final upsert/queue/cursor/commit前：无漏行/漏队列、无半页推进，resolution与页事务恢复正确；同源两连接只有一个网络 run，异常清理锁/连接。cleanup 的 FK 删除顺序及 stopBoss 放 finally，避免复发 Phase A harness问题。
6. metadata-only 对现有正文/附件 marker、S4 hold、raw/receipt/model counters 无提升或泄漏；没有 body/PDF/Jina helper 调用；queue沿用事务合同，unchanged replay无重复业务 job。preview全程page0/detail0/cursor0，与legacy返回字段兼容。
7. 所有页cap/dispatchcap/旧日期/空页/404/countPage/重复页场景永远 unproven、无 initializedAt/complete；failed/ok partial计数对应实际 durable结果。focused通过后由 QA 按AGENTS对最终源码执行必要整体检查，一次最终CI，不由本S1重跑。

## 未批准的下一阶段

单页 snapshot 不能保证跨页/跨 run 前插、移页、删除导致的完整性。90 日 complete 所需排序/整页最终可信日期边界、真正末页、覆盖证据、initializedAt 原子写入、完成后增量、reset/config变更人工处理，仍需独立 S1 设计与来源实证。此轮只提供有限 metadata 续做和明确 fail-closed 停页；不把原阶段 B 的终止/完整覆盖问题改名后偷渡通过。

FILES_CHANGED=仅 docs/fiscal-finance/S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md。
TESTS_RUN=只读文件/代码与 manifest 字段核对；未运行测试、Git、DB、HTTP、collector、worker 或项目 provider。
RISKS=metadata缺失/变化会保守阻塞；既存日期修复、同日精度升级未批准；单页snapshot不证明跨页完整性。
BLOCKERS=本报告限定的离线/loopback实施无架构blocker；真实source准入、90日complete、reset/增量/跨页完整性仍阻塞；Gate2 NOT_PASSED。
NEXT=Lead 可派 Luna 按本报告范围实现 metadata续做并完成focused契约；QA持有shared docs/最终验证；真实provider调用仍0，约90% Luna执行/10% Sol范围审查，不重审PhaseA或Gold。
