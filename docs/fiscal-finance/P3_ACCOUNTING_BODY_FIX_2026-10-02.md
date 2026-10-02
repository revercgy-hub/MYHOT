# P3 会计司正文 selector 跨类型离线验证（2026-10-02）

STATUS=selector 候选离线复核完成；行业配置未修改。
STAGE=P3 本地正文质量验证。
GATE=Gate 1 PASSED；Gate 2 NOT_PASSED。

## TASK

依据 [S1 范围审查](S1_P3_OCT02_SCOPE_REVIEW.md) 对会计司正文 selector 做有界离线核验。使用三类已有原始页面：180字注销名单表、题名加 XLSX 附件、473字嵌套 TRS 征求意见正文；加入有效题名/日期身份的短多段正文和装饰表格负例。全程只调用现有 `extractSelectedBody()`，不联网、不读写数据库、不改通用 helper。

## MODEL

Luna High；未调用模型服务。

## FILES_CHANGED

- 新增 [测试](../../tests/fiscal-accounting-body.test.ts) 和五份最小 HTML fixture：`tests/fixtures/fiscal-accounting-body/`。
- 新增本文。
- **未修改** `industry/sources.json`、`apps/`、`packages/`、schema、数据库或评分门槛。为避免误把既有正例绿测当作配置安全，测试文件明确标为 S1 selector 特性描述测试；其中两项断言记录候选错误接受负例这一事实。

## TESTS_RUN

`node --test tests/fiscal-accounting-body.test.ts`：6/6 通过。所有情况均通过真实 `extractSelectedBody()` helper 和相同题名/发布日期身份验证；未 mock helper 实现或以身份冲突代替正文噪声负例。

## RESULT

S1 提出的 union：

```css
.my_doccontent > .TRS_Editor:has(table),
.my_doccontent > .TRS_Editor:has(p + p)
```

对三个缓存正例都工作：注销表格唯一命中，输出180字，保留五列表头与完整一行；题名加 XLSX 页无候选，fail-closed；嵌套 TRS 正文唯一命中并输出原有473字，无表格遗漏。

同一候选也将两个 identity 完全匹配的负例返回 `body`：仅两段短通知（少于200字）和只有五格导航文字的装饰表格（少于200字）。因此 union 会把短噪声写成 `ok` 风险样本，未满足 S1 配置落地条件。

另离线试了较收窄的纯 CSS 方案：

```css
.my_doccontent > .TRS_Editor:has(table[border='1'] tr > td:nth-child(5)):not(:has(a)),
.my_doccontent > .TRS_Editor:has(p + p + p + p)
```

它保留三类缓存正例，且排除双段短通知；仍将无链接五格装饰表格选为正文。可见 CSS 的结构限制和 `allowShortBody` 单一布尔值不能表达“真实短表格可以短、普通正文必须至少200字，并且表格必须是业务表格”的差异。该备选也不用于行业配置。

## RISKS

- 两个负例是结构真实、身份字段有效的离线噪声 controls，不代表已经证明线上页面实际存在同形内容；但候选 selector 无法基于正文语义区分同形业务表和装饰表，也无法在短多段分支继续应用200字下限。
- 五个 fixture 只覆盖当前缓存的三个成功/失败类型和两个明确负例，不证明会计司全部栏目、附件形态或版式覆盖；全页 selector 上线的误收范围未知。
- 题名加 XLSX 仍只会保持 HTML 正文未确认。它的附件不进入 HTML 正文；不请求 XLSX，也不把该公告表述成完整正文。
- fixture 保留若干当前缓存结构和内容用于 helper 验证；测试不产生 collector、队列、数据库状态或来源通过结论。

## BLOCKERS

依据 S1 配置批准仍是条件性范围批准，三类缓存事实已通过，但 union 和已验证的结构收窄方案均错收至少一个有效身份噪声负例。故这轮**停止行业配置变更**。没有在 `sources.json` 设置 `.TRS_Editor:has(table)` 或任何 union；来源仍 disabled，正文旧状态不变，Gate 2 仍 NOT_PASSED。

若要继续自动正文，需新增另一项明确审查的机制（例如按正文形态区分短结构化表格与常规正文长度门槛，并对 XLSX 类型保持 fail-closed）；这超出本 S1 的行业 config-only 边界。本轮不改 helper，也不以更多 CSS 近似掩盖风险。

## NEXT

Lead 可核销当前测试证据及不改配置的决定。若业务仍要求收录 180 字表格正文，另提最小实现范围和独立审查；继续使用当前通用 Readability 对无 selector 的页面并保留失败状态，直到有能同时满足三真快照与噪声负例的已批准策略。保持采集、模型、发布关闭，不请求附件、不重写存量正文。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：对会计司经批准的 table/paragraph selector 候选以真实 helper 核对三类缓存页面和短正文/装饰表格负例。

**MODEL**：Luna High；未调用仓库模型服务。

**FILES_CHANGED**：新增本报告、离线候选行为测试及五个 fixture；未改源配置或业务代码。

**TESTS_RUN**：focused test 6/6通过；无网络、数据库、worker 或模型。

**RESULT**：union 对三类真页面有候选结果，也会误收短多段和装饰表；更保守结构 CSS 仍误收五格装饰表。依据条件批准，未改 `sources.json`。

**RISKS**：只覆盖有限快照；CSS 结构不能证明表格业务语义，`allowShortBody` 会影响两个分支。

**BLOCKERS**：配置落地条件没有满足，Gate 2继续 NOT_PASSED。

**NEXT**：由 Lead 核销不变更决定；如要短表格自动入库，需另审 helper/配置能力范围，严格拒绝未处理的 XLSX。
