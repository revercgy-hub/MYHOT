# S1 GovCN JSON query pagination 窄范围裁定

**RESULT=APPROVED_SCOPE**，限下述每运行从 p=1 开始的有界扫描；若方案声称跨运行续页或90日完整，则 **CHANGES_REQUIRED**。这是实现范围批准，不是代码通过、来源准入、分页实测或运行授权。

静态基线：`feat/fiscal-finance-hot` / `b9e62d7e1b9e89859954c4c38a16c22e84302488`。已读 AGENTS、README、PROJECT_PLAN、STATUS、CORE_SOURCE_IMPLEMENTATION_NEXT_2026-10-08、SOURCE_MATRIX、GovCN identity S1、NFRA JSON detail S1，以及实际 json-list/config-keys/collect/web-list-pagination/http-fetch/types 与候选配置。STATUS 内旧 SHA 与旧“NFRA 未实现”段是历史记录；当前实际 NFRA 已有固定 adapter。本裁定不重审 Gate 2，provider 付费继续 DEFERRED。

## 已有能力与最小选择

`fetchJsonList()` 已接受 `runBudget/timeoutMs/assertActive`，但 URL 固定取 config.url，没有 JSON 分页。`collectSource()` 只为 NFRA 创建共享预算，普通 JSON 列表与详情没有该总预算；其日期窗口只在 `!cursor.initializedAt` 的首次导入应用。HTML 的 `createWebListPaginationBudget()` 把请求限定到列表目录且拒绝 search query，不能直接套用或为 GovCN 放宽现有 HTML admission。HTML cursor 已有 `coverage=unproven` 和 partial run detail，但包含 HTML 页索引、事务与 metadata checkpoint，整套转成通用 JSON backend 超出最小范围。

已保存 `tests/fixtures/govcn-detail-identity/policy-search-response.json` 是唯一真实 query page：p=1/n=5，映射 `searchVO.catMap.bumenfile.listVO`。保存 JS 的 p+1 参数证明 query 翻页方式，没有证明第二页内容、稳定排序、terminal、快照一致性或90日覆盖。`sort=score` 不可视为发布日期倒序；旧条目、整页旧日期、短页、返回 total/count 均不能当作已完成证明。

因此本轮选择每次运行最多两页、从 p=1 重放，不新增持久分页 cursor。不将某次页码/nextPage 写成可恢复进度，也不沿用 HTML 的 webListBackfill cursor。下一运行重放允许已有 material identity 去重；这会限制深历史推进，须明确记为后续真实续页阶段，不能把本范围包装成90日回填完成。

## Exact options 与固定 admission

只给 `json_list` 增加显式 `pagination` 对象：`mode="govcn_query_v1"`、`maxPagesPerRun` 为安全整数1..2、`maxDispatches` 为安全整数1..12。其它 pagination 字段，包括 HTML 的 detailMode/maxPageIndex，均拒绝。候选建议 `maxPagesPerRun=2,maxDispatches=7`，`detail.maxFetches=5` 为整个运行总详情目标上限；详情 cap 对本模式强制安全整数1..5，不允许0、负数、NaN、Infinity、字符串或缺省无限。总 deadline 固定120秒，单请求最多25秒且不超过 remainingMs；无需新增 deadline 配置。总页数就是 maxPagesPerRun，页号依次1、2，预算耗尽可更早停止。

本模式仅接受现有 exact GovCN config URL：`https://sousuo.www.gov.cn/search-gov/data?q=&sort=score&sortType=1&searchfield=title&p=1&n=5&type=gwyzcwjk`。仅 GET；禁止 headers/bodyJson/embedded HTML/categorySelection/NFRA mode/Jina/authoritative metadata/date upgrade/URL rewrite。保留固定 itemsPath、映射字段、summaryIsBody=false、+08:00、现有 detail regex/bodySelector 与 allowUrlPrefixes。实际请求使用 URL API，仅改变恰好一个 `p` 为当前安全整数；host、scheme、port、path、其它 query 键和值及次数不变，无 credentials/hash。不能提供任意 query key、URL template、next-link 或 list 返回 endpoint。

新模式直接入口和配置入口均 fail closed。列表请求拒绝 redirect（maxRedirects=0），响应必须 HTTP200、exact requested/final URL、JSON MIME、严格UTF-8和正确 array path；复用 mapper，禁止给所有 legacy JSON 强加新契约。本模式单页最多5个原始 row，最多两页10个；不只检查 mapped 长度以掩盖畸形或超量原始 rows。详情请求仅允许原列表已通过 allowUrlPrefixes 的 HTTPS `www.gov.cn/zhengce/zhengceku/` 原文章 URL，保留既有正文身份检查；本模式拒绝详情 redirects，不能自动跟随新 host/path。每次实际列表或详情 dispatch 共用一次预算，预算拒绝发生在派发前；不重试、不请求脚本/附件。deadline abort 必须覆盖 response body 与 detail，dispose timer 必須 finally 执行。

## Exact files 与 pipeline 约束

1. 新增 `packages/backend/src/sources/json-list-pagination.ts`：小型模式 validator、固定 query URL builder、source-local GuardedFetchRunBudget 和有界 page reader。复用现有 guardedFetch interface、identityKeyFor/decideTimeline 语义；不新建通用 pagination framework，不改 HTML budget admission。配置校验依赖保持单向，模块不得反向 import config-keys/collect。
2. `packages/backend/src/sources/json-list.ts`：仅为显式模式提供受验证的单页 URL/原始 row count 反馈，以及此模式的响应约束与 options 透传。无需改所有 mapper 日期行为或 Candidate schema。无模式时原返回数组、请求/解析行为保持原样。
3. `packages/backend/src/sources/config-keys.ts`：允许 json_list.pagination，按 kind/mode 分派对应 validator；现有 web_list validator 不能再无条件把合法新模式拒绝。NFRA 精确字段白名单仍拒绝 pagination。
4. `packages/backend/src/sources/collect.ts`：仅新模式调用 reader，把同一预算透传到现有 detail loop，详情 cap 计整个运行，派发前后 assertActive。预算/timeout 不得被现有 detail best-effort catch 吞后报告完整成功。新增模式在固定 run anchor 下始终逐条过滤可信90日窗口（现有三个月×30日），即使 initializedAt 已存在也不得跳过；未定/非法/未来不可信日期不得写成合格日期。窗口过滤不驱动停止翻页。继续原 allowed/noise/identity/store/严格正文处理；摘要不得变正文，expected identity 不替换。将 partial 诊断写入已有 fetch_runs.detail，失败路径也保留预算与 stop reason；不把 initializedAt/lastOkAt 解释为历史覆盖证明。普通源码路径保持既有行为。
5. `industry/sources.json`：只对 `govcn-policy-library` 增加上述 pagination，保留 disabled、fulltext-off、strict body-ready、固定 query/类别/正文规则；源名称可去除“单页试验”并明确“有界分页试验”。不新增来源，不启用/seed。48来源/42 strict exact IDs 不变。

准许新增 `tests/govcn-json-pagination.test.ts` 和必要 source config 断言；fixtures 限现有真实第一页与明确标注的合成/衍生后续页，不冒充真实第二页。SOURCE_MATRIX/CORE/STATUS 只追加实施与QA结果，不改历史证据。无需修改 apps、types schema、migration、provider、worker、publication、HTML pagination、NFRA adapter 或 delayed extraction。`fetchDetail()` 已能收 shared runBudget/remainingMs，先用该接口；若实际验证发现 direct HTML 传输未把剩余时间/禁redirect贯彻，仅允许 `web-list.ts` 增加可选请求限制透传，absent 时 legacy 不变，必须在实施handoff明确实际第六生产文件。

## 停止、去重与真假 resume

- 第一页或后续空 array：停止，`stopReason=empty_page`，coverage unproven/partial true；异常 shape/非空却无法映射仍是失败，不等同 terminal。
- 顺序变化的同页、完全重叠页：使用 material identity 归一去重与排序后的 identity fingerprint，停止为 duplicate_page/no_new_identities；不能只比较 row 顺序或外部ID。跨本次最多10行的 identity set 有界；同一文章只占一个 detail 目标。部分重叠仍处理新 identity。
- 日期未知、乱序、夹杂旧日期：计数并过滤每行，继续至下一页或真实预算；不在第一条旧日期、全旧页或短页提前声明完成。发布日期仍来源原 pubtime，details 身份不能自证替换。
- page/dispatch/detail cap：partial true，coverage unproven；detail cap 到达仅停止详情，剩余候选保持 pending 并保留缺口计数。无新请求在cap后派发。timeout、redirect拒绝、HTTP/schema失败：failed，诊断 partial/unproven，无后续请求。
- 本轮不实现 resume。report 可包含 lastPageFetched/pagesFetched，不能暴露声称持久已提交 nextPage 的 token。既有 initializedAt 或 lastOkAt 是普通采集成功状态，不能冒充分页 checkpoint。未来真正 resume 须先明确配置hash、固定窗口、逐页事务完成才推进、失败重放及漂移防护；既有 cursor JSON 可承载，但本轮无需 migration，也不批准新抽象。

最低 run detail：mode、anchorAt/cutoffAt、pagesFetched、uniqueCandidates、dispatchesUsed/maxDispatches、detailTargetsUsed/maxDetailTargets、rowsUndated/rowsOutsideWindow、pendingDetails、stopReason、partial=true、coverage=unproven。如成功持久化有界材料可维持 ordinary status=ok，但此字段只表示软件运行成功；UI/API 不得据此宣称覆盖完成。

## 最低离线验证

MockAgent disableNetConnect；第一页 exact saved fixture 与 query 匹配，第二页明确 synthetic。验证 p=1→2 且其它参数完全不变、无额外请求；两页部分重叠只映射/详情一次；相同内容乱序仍发现重复；first-page empty、later empty、短页、错误path、超量raw row、malformed/非JSON/错误MIME/无效UTF8、redirect拒绝均保持正确计数与 partial。混合新旧/未知/非法/未来日期不提前停；第二页仍含窗口内 row 时保留，initializedAt 已存在仍应用窗口。

使用 fake clock 与已有 guardedFetch dispatch hooks 验证列表+详情共用7请求示例预算、1/2/12边界、5详情总cap、拒绝0/负数/小数/NaN/Infinity/字符串/未知key、deadline pre-dispatch 0请求与body/detail超时终止、不吞错误继续派发。详情 expected title/date 与现有正则正文 guards不变；cap未取详情仍 pending。验证模式 absent 的 legacy JSON、HTML分页、NFRA配置与其7-dispatch/120秒预算均不变，NFRA+pagination明确拒绝。

执行适用 typecheck、Gov identity/新分页/config、HTML分页budget/transport及NFRA离线回归。collector持久化/失败detail写入的DB回归本轮不运行，后续隔离 fresh `_test`/`_ci` 或CI独立QA；不能用Mock reader冒充事务/持久cursor验证。严禁任何本机API启动、停止或替代启动；允许离线测试子进程。本审查不执行HTTP/model/secret/DB写入/collector runtime/Git commit；后续HTTP仅限下方独立证据附录。

## 附录：软件QA后一次独立只读列表证据batch

Root补充确认用户此前已授权适时小规模官方抓取，当前延期的是付费模型；据此可批准软件QA通过后一次独立证据batch，不扩大产品pager配置或启用来源。本子审查不执行该batch。只允许 fresh 同期依次请求上述 exact GovCN API 的 p=1、2、3，n=5及其它query不变；三次GET为硬总dispatch cap，每请求20秒/6MiB，整个batch60秒/18MiB。无redirect/retry/detail/script/附件/collector/DB/model/worker，任一失败STOP且不重试。工具或policy拒绝必须停止，不得改用另一启动/网络方法绕过。

raw与manifest保存到新的ignored Oct9目录，记录每次requested/final URL、参数、状态、MIME、bytes/hash、EOF及attempted/dispatched/rejected账目，保存失败也停止；不可提交`.data/`。旧p1不能与fresh p2/p3混合当作同期page progression；fresh三页只验证有限翻页/重叠/日期观察，不能证明90日、terminal、全类别或长期稳定。source继续disabled/fulltext-off/unadmitted。产品本轮maxPagesPerRun仍最多2；第三页仅为这个独立证据batch。若Root不能确认上述既有用户授权适用于HTTP，该附录不执行，保留OFFLINE-only并交下一轮决定。

## 八字段交接

**TASK**：GovCN JSON query pagination 最小范围审查。

**MODEL**：S1静态源码/保存fixture审查；没有provider或外部模型调用。

**FILES_CHANGED**：仅本范围文档。

**TESTS_RUN**：未执行软件测试；只读源码、项目文档、fixture、HEAD/status。

**RESULT**：APPROVED_SCOPE，限每次p=1、最多两页的显式有界模式；完整续页/90日声明为CHANGES_REQUIRED。无需schema/apps/migration。

**RISKS**：单页证据未证明分页terminal或排序；stateless重复扫描不推进深历史；普通initializedAt不能证明覆盖；HTML预算不可直接复用query admission。

**BLOCKERS**：代码实现及离线QA尚未完成；来源仍NOT_ADMITTED，真实分页/完整覆盖证据仍缺。没有付费/provider用户选择待办。

**NEXT**：按exact范围实现并由独立QA验证，记录partial与无resume限制；未来深历史resume另立窄范围，不能以本轮通过永久延期来源主线。
