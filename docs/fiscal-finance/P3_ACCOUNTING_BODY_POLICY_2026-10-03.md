# P3 会计司正文策略实现核销（2026-10-03）

STATUS=实现与单篇详情验证完成；单篇正文保持 unconfirmed，具体 helper 拒绝原因未留存。
STAGE=P3 正文质量验证。
GATE=Gate 2 NOT_PASSED。
SOURCE=mof-accounting-notices 仍 disabled。

## TASK

依 [10/3 S1](S1_P3_OCT03_IMPLEMENTATION_REVIEW.md) 实施可选 `detail.bodyPolicies`，区分会计司 180 字短表格与普通正文长度规则。只核销离线实现与固定 HTML 集成；不运行官方来源请求、collector、worker、模型或 publication。

## APPROVED POLICY VALUES

Lead 已核销 `industry/sources.json` 中 `mof-accounting-notices` 的精确草案：

| 类型 | selector | 字符下限 | 表头/完整行规则 |
|---|---|---:|---|
| 短结构表格 | `.my_doccontent > .TRS_Editor:has(table)` | `minTextChars=1` | 表头按序为 `序号`、`会计师事务所名称`、`统一社会信用代码`、`注销备案公告日期`、`注销备案情形`；`minCompleteDataRows=1` |
| 普通多段正文 | `.my_doccontent > .TRS_Editor:has(p + p)` | `minTextChars=200` | 无表格策略 |

这组值只适用于本轮核验的缓存 HTML 结构，不代表所有会计司页面覆盖、所有行完整或附件已处理。表格字段名留在行业配置；backend 只实现通用 DOM 检查。来源在配置中仍为 `enabled=false`；没有改存量机器 body 状态。

## IMPLEMENTATION

- `selected-body.ts` 增加可选策略解析。所有 selector 均逐项核对，必须恰好一个策略匹配唯一 container；无匹配、重叠、非唯一、身份失败或验证失败都 fail-closed。表格表头在 sanitize/trim 后同一行、按配置顺序精确匹配；数据行使用该行的直接子 cell，列数一致且无空格，要求达到配置行数。嵌套表格及 rowspan/colspan 明确拒绝；短长度按清洗后正文计算。
- `config-keys.ts` 仅允许 `web_list` 使用该配置，校验对象形状、未知字段、selector/header 字符串、整数上下限与非空有限策略列表。与旧 `bodySelector`、`allowShortBody`、文章/PDF envelope selector 或 `pdfDirect` 组合都会报 unsupported config；JSON/RSS 等 kind 声明也拒绝。
- `web-list.ts`、`extract.ts` 和 `collect.ts` 让 policy-only 来源进入预算限制的详情预取门控，并向相同 `extractSelectedBody()` driver 传递配置。失败的 configured path 不回退 Readability/Jina。
- `pdf-body.ts` 新增必要的共享 driver 兼容拒绝：当 policy 和旧文章/附件/PDF 配置意外同时到达时，在 dispatch 到 PDF envelope 前返回 `body_policy_invalid`。未改变 PDF parser/envelope 的验收行为，也未把新策略加入 PDF envelope。
- 未声明 `bodyPolicies` 的来源沿用旧 selector、200 字门槛和既有 `allowShortBody` 行为。

## TESTS_RUN

- `node --test tests/fiscal-accounting-body-policy.test.ts`：**9/9**。覆盖真实 180 字表格、473 字段落、24 字题名+XLSX、短多段落和身份匹配装饰表，以及错表头/错序、缺列、空 cell/空行、rowspan/嵌套表、selector 重叠/重复 container、题名与日期错误、畸形/越界配置、未知 key、旧配置/PDF 互斥、非 web_list kind 拒绝和正文 job 失败不降级。
- `node --test tests/fiscal-accounting-body.test.ts`：**6/6**，既有 selector characterization 单独通过；这是旧行为/失败样本记录，不能替代新策略测试。两文件合并运行共 **15/15**（新策略 9 + 旧 characterization 6）。
- `tests/source-rules.test.ts`：**7/7**，在新建隔离库 `fiscalhot_oct03_policy_test` 上；其中新增 policy-only collect gate 使用一次本机固定 HTML detail fetch，之后将同一测试文章重置为 pending 并确认 article-body job 按源配置用同一 helper 读回 180 字。没有真实源请求。该库应用了 **35** 项迁移。
- `tests/sources.test.ts`：**14/14**，使用上述 `_test` 库。
- `npm run typecheck`：通过。
- `git diff --check`：通过。industry JSON 解析及 `unsupportedConfig()` 也通过。

旧 characterization 独立断言 union 会接受短多段落和装饰表；这不是新 policy 的通过结果。新策略测试用真实 helper 验证相同身份负例均被拒。

## SINGLE ARTICLE LIVE VALIDATION

QA fresh full suite/CI 通过且 Lead 核销后，执行了一次直接正文 job。目标为之前记录的注销名单 URL：

`https://kjs.mof.gov.cn/gongzuotongzhi/202609/t20260904_3996714.htm`

执行边界与证据：

1. 新建隔离库 `fiscalhot_oct03_accounting_live_test`，运行 35 项现有迁移；只写入一条 `enabled=false` 的 `web_list` source 与一条目标 URL 的 pending article。输入标题为缓存中的 `从事证券服务业务会计师事务所注销备案名单`，输入 `published_at=2026-09-04 07:31:00Z`（即 +08:00 的 15:31）。库中复核到唯一 article 的 `body_status=unconfirmed`、`revision=1`；source 仍 disabled。
2. 只调用一次 `extractArticleBody("mof-accounting-live-detail-oct03", false)`；没有调用 `collectSource()` 或排队 worker。模型、Jina fallback、来源启用及 publication 均关闭；本轮未触发任何附件请求。
3. `scripts/fiscal/p3-http-budget.ts` 对 backend Undici 安装 `maxRequests=1`。实际为 `attempted=1 / dispatched=1 / rejected=0`；`undici:request:create`、`undici:client:sendHeaders`、`undici:request:headers` 各1，`request:error=0`，status=200，诊断 callback errors=0。没有 redirect、重试或额外 dispatch。
4. `extractArticleBody()` 返回 `unconfirmed`，测试库没有正文、`content_hash` 或 revision 更新：`bodyTextLength=0`、`bodyTextSha256=null`、`revision=1`。ignored 结果文件保存了目标 URL、输入身份、最终状态及完整 budget/event snapshot。没有保存原始 HTML；本次没有可计算的正文 hash。
5. 结果 runner 没有把 `extractArticleBody()` 内部 `source body selector declined` 的 console reason 写入 manifest，捕获到的输出也未作为独立文件保存。因此**具体 helper 拒绝原因未知**；不能断言本次响应身份、selector、表头或数据行哪项不匹配。HTTP 200 与 seeded article 身份只证明一次请求完成及 job 的预置身份，不能替代页面 identity/helper 核验。

保存目录：`.data/fiscal-qa/accounting-policy-live-verify-20261003/`（`runner.mjs` 与 `result.json`，均被 `.data/` 忽略）。不再重跑或追加请求以追索失败原因；若之后确需诊断，应先单独审查如何持久化 helper reason/raw response，再核销新的一次请求范围。本次不能报告正文通过、来源 coverage、批次增量或 Gate 2 通过。

## REASON PERSISTENCE 静态诊断交接

原因丢失在 ignored runner 的观测层，不在新 helper reason 链：`extractSelectedBody()` 的 `reason` 由 `extractConfiguredHtmlBody()` 返回，再由 `extractFromUrl()` 调用 `onSelectedBodyFailure(reason)`；`extractArticleBody()` 将其收进局部 `selectedFailure` 并输出结构化 `console.warn`，但公开返回值只有 `ok | unconfirmed | skipped`。本次 `runner.mjs` 只保留了 `extractArticleBody()` 返回值和异常，并把预算/数据库结果写进 `result.json`；没有拦截、解析或保存该 warning。故 JSON 中只有 `unconfirmed`，不是 backend 没产生 helper reason 的证据。

最小后续方案无需改 backend：在新的 ignored runner 中临时包装 `console.warn`，只识别 JSON 字符串且 `msg === "source body selector declined"`、`article === 固定 articleId`；解析并保存 `reason` 和 `source`，随后仍将原参数交给原 `console.warn`。`finally` 无条件恢复 `console.warn`。写入前仍需 schema 限定字段，绝不将任意日志参数、响应 HTML、链接文本或其它日志序列化到结果中。

待新的本地诊断授权/测试：在新 `_test` 数据库与 localhost fixture 上分别驱动策略 helper 成功、标题/日期身份失败及短正文拒绝；断言捕获的 `failureReason` 分别为 `null`、`identity_mismatch`、`short_body_not_allowed`，普通 warning 仍透传，抛错时 console 也恢复，且没有原始 HTML/正文进入 reason manifest。该测试只验证 runner 的日志观察器与已有 `extractArticleBody()` reason 链，不请求官方 URL，不借此重跑本次文章。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按 10/3 S1 实现并离线核销可选正文策略；按另行核销范围执行一篇已知短表详情的 direct extract。

**MODEL**：Luna High；未调用仓库模型服务。

**FILES_CHANGED**：实现路径为 `packages/backend/src/content/selected-body.ts`、`pdf-body.ts`、`extract.ts`；`packages/backend/src/sources/config-keys.ts`、`web-list.ts`、`collect.ts`；`industry/sources.json` 仅 `mof-accounting-notices.detail`；`tests/fiscal-accounting-body-policy.test.ts`（新）、`tests/source-rules.test.ts`。代码已由本轮负责人提交在 `9719580`；本文为owner结果报告，随本轮10/3文档检查点提交。

**TESTS_RUN**：新策略 9/9，旧 characterization 6/6（合跑15/15）；source-rules 7/7；sources 14/14；新S1 fresh full suite 211/211、typecheck、Web build、Web tests 15/15、smoke 30/30通过；指定仓库CI run [37078956435](https://github.com/revercgy-hub/MYHOT/actions/runs/37078956435) 对代码SHA `9bfa0d1a91dcc765b9870ecf5cb25b9958c9f651` 全绿。测试数据库均为新建 `_test` 库。除了单独授权的一次固定详情提取，offline fixtures没有外网请求。

**RESULT**：实现符合本次正文 policy S1；Lead 已核销上述行业精确值。来源保持 disabled。离线结果为180字表格通过、473字段落通过、24字题名+XLSX/短多段落/装饰表拒绝。唯一一次 live GET 为 HTTP 200/1 dispatch，但 `extractArticleBody` 返回 unconfirmed，无正文/hash；helper reason 未留存，不推测原因。

**RISKS**：快照有限；完整数据行只验证配置要求的结构，不能证明名单全集或语义；真实站点可能版式漂移而 fail-closed。

**BLOCKERS**：本轮 live runner 未保留 helper decline reason；已静态定位为 runner 未观察 `extractArticleBody()` 输出的 structured warning，而非 helper reason 链没有返回值。不增加请求来追索。单篇结果未确认，Gate 2 保持 NOT_PASSED。

**NEXT**：QA 合并此静态诊断交接。以后如需保留拒绝原因，只在新的 ignored runner 捕获并筛选 `console.warn` 的结构化记录；用 localhost fixture 验证观察器后再考虑任何新的外网计划。本次不补发请求、不改已测试 backend、不 stage/commit。
