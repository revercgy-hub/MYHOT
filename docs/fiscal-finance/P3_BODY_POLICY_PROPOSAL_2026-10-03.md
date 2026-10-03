# P3 正文策略提案：按 selector 验证短表格与普通正文（2026-10-03）

STATUS=提案；未实现、未配置、未批准为实施范围。
STAGE=P3 正文质量验证。
GATE=Gate 2 NOT_PASSED。

## TASK

为会计司缓存页面提出一项最小、可审查的通用正文抽取扩展：既接受有明确表头和完整业务行的 180 字短表格，又保留 473 字无表格正文，同时拒绝短多段通知和身份字段正确但结构为装饰内容的五列表格。本提案只描述下一步范围；实施前须由 Lead 另行取得新的 S1。没有改源配置、helper、schema、fixtures 或共享状态文件。

## EVIDENCE

- [10/2 会计司离线核验](P3_ACCOUNTING_BODY_FIX_2026-10-02.md) 用真实 `extractSelectedBody()` helper 检查了 180 字注销名单、题名加 XLSX 页和 473 字嵌套 TRS 征求意见正文。原 CSS union 对三类缓存正例均能抽取，但也接受短多段通知和装饰表格这两个标题、发布日期均正确的负例。
- 同一报告记录的纯 CSS 收窄尝试仍接受五格装饰表格。故再换 selector 不能可靠表达正文内容策略。
- [10/2 S1 范围审查](S1_P3_OCT02_SCOPE_REVIEW.md) 说明现有 `bodySelector` 是一个选择器字符串，`allowShortBody` 是作用于整篇正文的单一开关；原批准只覆盖离线候选与最小行业配置验证，不是通用 helper 实施批准。
- 现有 helper 为 [selected-body.ts](../../packages/backend/src/content/selected-body.ts)。它会要求 selector 唯一、结构化子项、非空正文、未处理 PDF 附件拒绝、标题及日期一致，再清洗正文；最终短正文判断固定为 200 字或全局 `allowShortBody`。
- 详情预取入口 [web-list.ts](../../packages/backend/src/sources/web-list.ts) 和存量正文入口 [extract.ts](../../packages/backend/src/content/extract.ts) 各自从 `detail` 字段构造 helper 配置。配置白名单在 [config-keys.ts](../../packages/backend/src/sources/config-keys.ts)。新增可选配置必须通过两条入口使用同一 helper 策略，并由白名单拒绝未知或畸形字段。

## PROPOSAL

在现有 `detail.bodySelector` / `detail.allowShortBody` 之外增加一个**可选的 selector policy 列表**。每项独立声明 selector、最小清洗后字符数；可选的 table 验证配置声明需要匹配的表头单元格，以及至少一行完整数据的要求。策略列表只在显式配置时使用；未配置的来源完全沿用原来的 selector、200 字门槛和 `allowShortBody` 语义。

形状仅作下一轮设计输入，不是可直接启用的来源配置：

```json
{
  "detail": {
    "bodyPolicies": [
      {
        "selector": ".my_doccontent > .TRS_Editor:has(table)",
        "minTextChars": 1,
        "table": {
          "requiredHeaderCells": ["序号", "会计师事务所名称", "统一社会信用代码", "注销备案公告日期", "注销备案情形"],
          "minCompleteDataRows": 1
        }
      },
      {
        "selector": ".my_doccontent > .TRS_Editor:has(p + p)",
        "minTextChars": 200
      }
    ]
  }
}
```

表头字段名留在行业配置中；后端只实现通用的 DOM 表格检查，不硬编码财政或会计业务含义。通用检查应在清洗后的候选 container 内定位一个明确表格：指定表头必须全部在同一表头行匹配；数据行须位于该表头之后，列数与表头一致且每格均非空；至少有配置数量的完整数据行。字段按单元格行列位置验证，不能通过在整页文本中搜索关键词或数字来替代行关联。表格策略的 `minTextChars` 仍显式存在，避免另一个隐式短正文例外。

策略解析应 fail-closed：恰有一条 selector 匹配唯一 container 时才应用该条策略；无策略命中、多条策略命中、container 不唯一、身份不匹配、表头缺失、没有完整数据行或长度未达该策略下限都拒绝正文，不尝试回退到较宽松的另一条策略。表格结构校验只确认配置要求的表头及至少一行完整数据，不证明整张表所有记录齐全，也不确认附件已处理。已有 PDF/XLSX fail-closed 路径和标题/日期身份校验保持原样。

用会计司候选值演示预期分支：短注销名单仅在五个配置表头与至少一条五格完整数据行均对应时通过；473 字征求意见函走普通文本策略，满足 200 字下限；短两段正文虽然匹配文本 selector 仍因长度不足被拒；五格装饰表虽然有 table 和完整格子，但表头不匹配而被拒；题名加 XLSX 页不满足任一唯一策略或正文结构仍被拒。以上只是基于现有快照的待验证预期，不是通过结论。

## EXPECTED_SCOPE

新的 S1 如批准实施，限定于：

1. `packages/backend/src/content/selected-body.ts`：可选 policy 类型、唯一策略选择、字符数和通用表头/完整行校验；现有无 policy 路径逐字维持行为。
2. `packages/backend/src/sources/config-keys.ts`：只为 web_list 的 `detail.bodyPolicies` 增加嵌套白名单与类型/范围校验；无 schema 或数据库迁移。
3. `packages/backend/src/sources/web-list.ts`、`packages/backend/src/content/extract.ts`：把同一可选策略传至详情预取与正文 job，防止一条入口成功、另一条入口采用旧规则。
4. 离线测试：复用 `tests/fiscal-accounting-body.test.ts` 中已有缓存 fixture，不重做既有 6 项 characterization。新增同一 helper 路径的断言覆盖：短表格表头与完整行接受；缺列/空单元格/错表头拒绝；473 字段落保留；短多段落拒绝；正确身份的装饰五格表拒绝；题名加 XLSX 拒绝；策略 selector 多重命中拒绝；无 `bodyPolicies` 时原有行为不变；配置畸形和非法阈值被 validator 拒绝。还应在入口层验证预取与正文 job 使用同一配置。
5. 行业配置仍需独立审批；这项提案不授权改 `industry/sources.json`、启用来源或重跑采集。

无需改 `apps/`、评分门槛、数据库 schema、OCR、通用内容评分逻辑或来源状态。若实现发现这几处现有调用不足以传递策略，先更新 S1，不扩大范围。

## RISKS

- 当前 180 字 fixture 只有一条注销记录。完整行规则可排除已知装饰负例，却不能证明整页的其它行完整，也不能证明所有会计司栏目都有相同表头。
- 精确表头配置可能因官网改字、换序、合并单元格或 HTML 标签差异而 fail-closed；这是可见的未确认结果，需要新快照后再更新配置。
- 同一表格若含正确表头但只是示例/局部摘录，仍可能通过结构校验。规则降低已观测假阳性，不等同语义理解或来源质量认证。
- 选择器策略列表、配置校验和两条入口传递增加了代码面；若失败时回退策略、允许多项 selector 并用或悄悄保留全局 `allowShortBody`，会重新引入较宽分支误收风险。
- 既有 simple helper 对 PDF 链接 fail-closed；XLSX-only 公告仍未确认。表格策略不读取或下载附件，不应把 HTML 名单表述为附件完整正文。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：研究一项按 selector 分支的通用正文策略，解决会计司已观测的短表格/常规正文阈值冲突及装饰表格误收。

**MODEL**：Luna High；未调用仓库模型服务。

**FILES_CHANGED**：仅新增本文；未改 helper、行业配置、测试、fixture、schema、apps 或共享状态文件。

**TESTS_RUN**：只读检查 AGENTS、README、PROJECT_PLAN、STATUS、10/2 会计司报告、S1 与真实 helper/config 调用链；本轮未运行测试，也未联网、访问数据库、启动 worker 或模型。

**RESULT**：提出可选 `detail.bodyPolicies`：每个 selector 使用独立字符门槛，表格策略额外检查配置表头及至少一条同列数、无空格的完整数据行；匹配歧义、验证失败和无匹配一律拒绝。未声称策略已实现或 fixtures 已通过新策略。

**RISKS**：结构验证只能排除当前两个观察到的负例形状，不能保证业务语义或来源全量完整；表头漂移会使正文 fail-closed；需要同时验证两条抽取入口。

**BLOCKERS**：此能力超出 10/2 S1 对现有 helper 不作修改的边界；没有新的 S1 前不实施，也不改会计司源配置。Gate 2 保持 NOT_PASSED。

**NEXT**：Lead/QA 审核本提案并决定是否申请独立 S1。若获批，按 `EXPECTED_SCOPE` 实施最小 helper/白名单/入口传递改动，以现有 fixture 扩充真实 helper 测试；只有离线核销后再另行审查行业配置，仍保持来源关闭且不运行 collector。
