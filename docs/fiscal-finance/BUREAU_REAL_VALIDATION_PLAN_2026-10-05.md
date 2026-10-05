# 福建、北京、上海三局真实来源小规模验收方案（2026-10-05）

## TASK

为三条新增 disabled 来源规划下一阶段受控的真实 collector 与显式正文抽取验收。本文只依据仓库代码、配置和已有保存证据编写，不执行外网请求、数据库操作、collector、worker 或模型调用。执行此方案仍需 Lead 对真实请求阶段单独批准。

## MODEL

Luna High B；仅离线检查当前配置、项目计划、Gate 2 remediation handoff、既有详情 manifest/报告及 collector、extract、队列代码。没有连接来源或数据库。

## FILES_CHANGED

仅新增本 owned 计划文档。未改行业配置、运行时代码、schema/migration、共享矩阵、Git index 或既有 QA 报告。

## TESTS_RUN

没有运行测试、应用 migration、查询数据库或执行真实请求。只读到的既有软件证据：

- Node 24.16、新建 loopback PostgreSQL `_test` 库、35 migrations：`tests/regional-bureau-integration.test.ts` 1/1，`tests/source-rules.test.ts` 12/12，`npm run typecheck` 通过。
- 最新 QA fresh full suite 252/252、typecheck 通过；CI run 37281829324 已成功。
- 上述是软件测试，不是三局真实 collector 验收。集成测试用 loopback HTML fixtures；`.my_doccontent` 正文是清楚标记的 synthetic text。实际网站只出现在离线保存的 DOM/metadata 观察中。

## RESULT

Gate 2 仍为 `NOT_PASSED`。三条当前配置均 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`，类型 `web_list`、T1、first-party、editorial、1440 分钟；首次回填窗口为 3 个月且要求可信发布日期。配置及 selector 在已保存 HTML 上通过 parser/config/integration 软件检查，但没有任何真实来源 collector/数据库结果。

| 来源 ID | 列表入口（本轮候选 URL） | 已观察候选 / 详情日期 | 当前详情配置与特别风险 |
|---|---|---|---|
| `mof-fujian-supervision-dynamics` | `https://fj.mof.gov.cn/gzdt/caizhengjiancha/` | `https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm`；列表日和 `PubDate` 均为 2026-09-22（详情 08:21 +08） | `maxFetches:10`；`.my_doccontent`。标题与日期同日。 |
| `mof-beijing-supervision-dynamics` | `https://bj.mof.gov.cn/caizhengjiancha/` | `https://bj.mof.gov.cn/caizhengjiancha/202609/t20260924_3998098.htm`；列表日 2026-09-24，详情 `PubDate` 为 2026-09-30 08:39 +08 | `maxFetches:10`；详情 `h2.title_con` 与 `PubDate` 为权威值。详情标题省略列表标题的“财政部”前缀；首轮正文 identity 因详情字段读取前缺发布日期而预计为 `identity_missing`，metadata 仍应保存，之后显式抽取才用持久化身份。 |
| `mof-shanghai-supervision-dynamics` | `https://sh.mof.gov.cn/gzdt/caizhengjiancha/` | `https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm`；列表日和 `PubDate` 均为 2026-09-23（详情 15:09 +08） | `maxFetches:10`；`.my_doccontent`。标题与日期同日。 |

这三篇已有样本日期距 2026-10-05 运行日在约 5 周内，落在配置目标的近 90 日窗口内；真实执行应按实际 `runAt` 和 collector 的 `initialBackfillMonths * 30` 天边界复算，不能硬编码上表日期作为持续有效的候选。北京窗口归属以详情权威 `PubDate` 检查，不能以 9/24 列表日替代。

已有详情 manifest `.data/fiscal-qa/regional-batch1-details-20261004/details.json` 记录：从已观察列表链接各直取 1 个 detail，HTTP 200，direct、无重定向、无重试、20 秒、6 MiB；共 `attempted/dispatched/rejected=3/3/0`。这是保存页面观察，不是 collector/extractor。它记录 `.my_doccontent` 每页可见内容与 `PubDate`；没有观察到附件链接，也没有发现显式分页，但单页扫描不能证明站点没有附件或后续历史页。2026-10-05 follow-up 又对三条栏目 URL 各请求一次；与 10-04 的三份列表原始字节及 10 条候选逐条相同，相隔 32 小时 22 分。它只是一对人工快照，未验证调度稳定性、每日发布延迟或跨周/月覆盖。

### 获批后建议的执行顺序与首批预算

1. **预检与隔离。** 只在已有 loopback PostgreSQL 服务上新建本轮唯一的 `*_test` 数据库，检查空库后应用全部 35 个 migrations；显式连接 `postgres://postgres@127.0.0.1:5432/<unique_name>_test`。只把上述三条 JSON 配置导入该测试库，保留它们 disabled；不连接 `fiscalhot_preview_test` 或任何其他应用/预览库，不跑正式 source import。将进程环境的所有安全阀明确设为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`、所有 `FEISHU_*_ENABLED`、Jina fallback/skip、private-network fetch、OCR、embeddings；清除真实 provider key/base URL、代理凭据和 `.env` 注入。不开 scheduler、worker、API 服务或任何队列消费者。启动前检查来源 ID、HTTPS host/path allowlist、运行时开关及数据库名并保存脱敏快照；检查不符即停。

2. **首轮只验北京一局。** 先选择北京是为了优先实测唯一已知的列表/详情 title 与日期不一致路径。运行前复核本地已有 P3 one-shot HTTP budget wrapper/runner 的固定 host/path allowlist、每次 Undici dispatch 计数、redirect-hop 计数和超限请求在原 dispatch 前拒绝；沿用已有通过 localhost/canary 的 budget 实现，不新增 backend/schema 行为。一个 fresh `_test` 库只放这一个 disabled source。运行 Node 24/npm 的真实 `collectSource("mof-beijing-supervision-dynamics", { force: true })`，`force` 只绕过测试库 disabled 行。第一阶段硬 cap 建议 **11 次总 dispatch**（一条列表请求加最多十条详情请求）；每个 redirect hop、任何意外 host/path 都计数并由 wrapper 拒绝超限请求。全阶段直接 GET、不重试，目标仅 `bj.mof.gov.cn/caizhengjiancha/` 前缀。留档完整列表候选和逐项请求事件。若 cap 被触发、出现 redirect/host/path 意外、selector/date/metadata 异常、详情 budget 统计不符、响应越限或数据库目标异常，立即停；保留已发生的响应、DB 行和队列作为 **partial / NOT_PASSED**，不清理、不继续抓，也不把 collector 的 `status=ok` 单独当 pass。11 是请求前硬限，`maxFetches:10` 仍只是 detail call 上限，不会扩大该 dispatch cap。

3. **北京 metadata 与显式 body 分阶段。** 首轮结束后只读北京 article、fetch run、revision 与队列路由记录；选定已入库且发布日期落在实际窗口的确切 article ID。确认权威详情 title/日期先持久化，首轮 `body_status` 仍安全 pending/unconfirmed、且进入 `content.extract-body`；正文身份拒绝不得回滚 metadata。之后需 lead 对显式提取阶段单独核销，复用同一 P3 wrapper 并将总 dispatch cap 设为 **1**、只允许北京来源 host/path、无 retry。只对预先记录的 article ID 显式调用一次 `extractArticleBody(articleId, false)`（关闭 Jina），不消费队列；遇到重定向需第二 dispatch 时 wrapper 拒绝并保留 partial/unconfirmed，不追加请求。抽取用 `.my_doccontent`，不下载附件。不要在同一首批把福建、上海 collector 与北京混跑。

4. **重复项与后续源。** 在第一阶段离线终检中，核验北京列表中相同 normalized URL 仅一条 article identity、不会因页面内重复候选产生多份 material，并记录 title/date/marker/revision。不得自动追加同源第二轮 collector。只有首轮与显式抽取结果经 review 后，才另批一轮北京 idempotency collector（独立 fresh `_test` 或已审阅的测试库状态、独立小 dispatch cap）；随后福建、上海各自另批单局，不与已批准的一局同批。每次重复/新源阶段复用同一 hardcap wrapper，cap 触发即记录 partial/non-pass，不为了凑全候选重试。

5. **终检与清理。** 确认 `articles` 的 URL identity 唯一；成功显式抽取只应为正文内容带来预期的 revision 增量和 revision row，失败抽取保持 pending/unconfirmed 与既有 metadata/revision，附件 marker 不被错误清除或置为正文成功。查询并记录 `selected`/publication 状态、analysis、provider receipts、worker/job-run 计数；这些数据不得出现模型/发布结果，队列可有 collector 新增的待处理 job，但没有任何 consumer 处理。记录 response status/final URL、日期、body decision、dispatch/redirect 统计与每阶段候选/新建/修订数。测试库保留供 review，来源仍 disabled；不要清理或触碰已有 cluster/preview DB。

### 预算解释与当前执行边界

`detail.maxFetches:10` **只限制每轮每源调用详情 fetcher 的次数，不是 HTTP 网络全局请求 cap**；列表页请求、显式抽取以及第二轮都会另计。当前 `guardedFetch` 默认每个页面调用允许最多 5 次手动重定向（即最多 6 个 HTTP dispatch）；collector 本身没有跨列表/详情/多来源的 run-wide cap，所以调用时必须复用已有 P3 one-shot budget wrapper，在 Undici 原 dispatch 前硬拒绝预算外 hop，并逐条核验 wrapper 对固定来源 host/path 的约束。dispatch 监控/拦截已有 localhost/canary 证据；该工作不需要 backend 或 schema 改动。

**本计划推荐首批只有北京一局、collector 阶段总 dispatch cap=11，显式 body 阶段另行核销且 cap=1**；命中任一 cap、意外 redirect/host/path 或身份/日期异常都停止并留存 partial 结果，标为 NOT_PASSED。福建和上海必须在首批数据经 review 后分别另批。绝不把理论最大请求数作为默认额度。

仅作跨批理论计算：若将来三源各跑两轮 collector、每轮每源最多 1 listing + 10 detail、每局另显式抽取一次，共 69 次 `guardedFetch` 调用；按现有单次最多 5 个 redirect hop，代码路径推导出的理论上限为 69 × 6 = **414 dispatches**。如果页面未变且第二轮所有候选都已知，则通常只增加 3 次列表调用，实际可能远低于该数；若新候选或首轮详情失败则第二轮可能重新使用详情预算。这个 414 只用于说明多个阶段累计风险，不能作为建议或已批准预算。

- `guardedFetch` 调用上界：3 × 2 × (1 list + 10 detail) + 3 explicit extract = **69**。
- 依当前代码每次最多 5 redirect，理论 HTTP dispatch 上界为 69 × 6 = **414**；实际 old manifests 均为零 redirect，但不能把观察到零重定向当未来保证。
- 如果同一页面上第二轮全部 URL 已知，通常不会再次访问详情；只有 3 个列表 fetch，实际总调用最多 39、dispatch 最多 234。若页面变更或首轮详情失败未入库，第二轮最多再触发 30 次详情调用，须仍计入 414 最大值。
- 每次显式抽取仅一次，body selector 会关闭 Jina；如果 `body_status=ok` helper 会返回 `skipped` 且不发请求。运行不重试不确定正文。模型、附件及 worker 均无请求预算，因为它们必须关闭。

实际每次首批运行仍需 Lead 在执行前核销单局 cap 与 allowlist；使用既有 P3 budget runner/wrapper 生成请求前 marker、配置硬 cap，并保存 attempted/dispatched/rejected、origin/path、状态码、final URL 和字节统计。wrapper 拦截超限 dispatch 时，collector 可能仍完成 best-effort 写入，所以只要 `rejected > 0`、预算到顶、发生未核销 redirect/host/path，结果必须标为 partial/non-pass 并停止后续源。样本目前约 12–22 KB，但 collector `guardedFetch` 默认响应上限为 8 MiB；历史实测 6 MiB 只属于手工 manifest，二者不可混为一谈。

### 接受条件及尚未覆盖的来源问题

- **候选边界和日期：** 只接收精确允许前缀下可解析的文章链接；首轮 article 必须有可靠发布日期，落在真实运行时近 90 日 cutoff 内。北京采用详情权威 title/`PubDate`，并逐条核对列表日不同于详情日时的结果；若权威日期不匹配或无法解析，安全地不保存为近 90 日已验收材料。
- **正文身份和 marker：** 对首轮被拒的正文明确记录 `identity_missing` / `identity_mismatch` 等实际结果；即使 body 被拒，核验北京详情 metadata 仍持久化、article 保持 pending/unconfirmed、未写成功正文或错误清除 marker。随后显式 extract 只按数据库持久化 title/date 身份验证；`ok` 时 body/revision 有真实变化并有对应 `article_revisions` 行；失败时 title/date/body/revision 保持安全状态。不存在“detail=HTTP 200 即 body=ok”的推断。
- **重复与公开/模型边界：** URL identity/唯一性、重复 collector 不回滚权威 metadata、不制造 revision/no-op 行；检查 publication/selected 内容仍空或未选择，`analyses`/receipts/provider 调用计数为零。Queue 由 collector 经 `queueProcessing` 写入：body 不完整可进 `content.extract-body`，body 已可用时也可能排出后续 editorial 处理 job。**queueing 不是执行**；此验收绝不开 worker，不运行 `processArticle`/`processBodyJob`，也不以真实模型作为 Gate 2 条件。显式 `extractArticleBody` 是被动队列外的单篇程序调用，不应宣称消费或完成了队列。
- **分页和周期缺口：** 当前 `fetchWebList` 仅读取配置的栏目第一页；旧静态页可见 10 项，没有证明有/没有下一页、滚动加载、archive、90 天历史索引或列表窗口完全覆盖近 90 日。此轮仅代表第一页和选样，不因候选日期都在 90 日内便声称 90 日覆盖通过。真实验收需要另行检查实际分页/历史入口和更早候选详情，至少跨多个发布日期周期重复观察列表、详情 metadata、重复/更新行为；若来源无可见翻页，只记录“未发现入口”，不能推断完整。
- **现场观察边界：** 福建/上海已有一篇同日详情；北京已有一篇六天差异详情。当前 HTML 静态观察没有附件，但没有覆盖所有候选，不足以接受附件行为。选择的三篇历史样本均处于 90 日范围，不能代表更旧页。

## RISKS

现有证据尚不能确定现场页面当前结构/内容仍一致、列表/详情的重定向与字节大小、90 日历史分页方式、重复候选或详情失败频率。重定向可能增加真实 dispatch；单次 `maxFetches` 不约束跨轮预算。首轮会由 collector 写队列 job，但在无 worker 状态下它们保持待处理；即使模型调用开关误设 false，也必须用“无 worker/无 provider keys/无 provider endpoint”共同防止处理。北京第一阶段的预期身份拒绝需要在真实 metadata/detail 变动时按实际结果重新判断，不能把本地合成 identity 流程当真实正文证据。

## BLOCKERS

- Gate 2 没有通过；本方案不是来源验收或采集许可。
- 执行真实 collector 前需要 Lead 核销当次 source、dispatch/字节额度和固定 host/path allowlist。复用已有 P3 one-shot request budget wrapper，未核销 host、超 cap dispatch 在原 dispatch 前拒绝；不新增 backend/schema 改动。
- 分页、跨周期、90 日历史覆盖及来源重复/更新稳定性尚未被观察；即使本次代表样本全绿，这些证据仍是后续 Gate 2 条件。

## NEXT

Lead/QA 审阅本计划后，下一真实请求阶段推荐先只核销北京：fresh `_test` 库、单源 disabled、collector cap=11；通过 review 后，再为显式抽取单独核销 cap=1。保留 cap 触发时的数据库/队列 partial 现场并标 NOT_PASSED。福建、上海各自另批。保持所有源 disabled、真实模型/worker关闭；完整 Gate 2 审查仍须补齐分页/历史与跨周期证据。
