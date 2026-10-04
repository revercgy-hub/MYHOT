# Batch 1 来源配置准备：福建、北京、上海（2026-10-04）

## TASK
对已保存的福建、北京、上海首页、列表页、详情页 HTML 做离线配置准备。用现有 `fromHtml`、`fetchDetail`（注入只读 fixture fetcher）和 `extractSelectedBody` 检验实际 DOM 是否能被现有配置接口表达，重点审查北京列表/详情标题前缀与发布日期差异。本文是 disabled source 配置草案和 parser compatibility review，不改 `industry/sources.json` 或其他共享配置。

## MODEL
Luna High 离线整理；证据只来自保存的公开 HTML、manifest 和当前源码。纯解析调用只读本地 fixture；`fetchDetail` 测试使用返回 saved HTML 的本地 fake fetcher。未调用 `guardedFetch`、collector、数据库、worker、附件、OCR、模型或真实 HTTP。

## FILES_CHANGED
新增本报告。离线小脚本 `offline-parser-audit.mjs`、`verify-config-only.mjs` 写在 ignored `.data/fiscal-qa/regional-batch1-20261004/`，不跟踪；未改源配置、core/app、shared docs、source matrix 或 Git index。

## TESTS_RUN
在保存的三张列表 HTML 上运行当前 `fromHtml`：使用实测主列表容器，均解析出 10 条候选；三条已保存详情 URL 均命中相应候选。以 fake fetcher 运行 `fetchDetail` 的现有标题/日期解析，再用 `extractSelectedBody` 离线检查 list identity 与 detail identity。未跑软件测试、真实 collector 或数据库流程。

## RESULT

### 现有 HTML 列表配置可解析

三页保存的列表 DOM 都显示文章行位于 `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li`，列表日期在行内 `span`，链接文字/`title` 属性位于行内 `a[href]`。以以下配置调用 `fromHtml`，每页 10 项、全页 10 项 `a[title]`；抽样候选的标题和日期均可读：

```json
{
  "itemSelector": "div.mainboxerji > div.zzright > div.listBox > ul.liBox > li",
  "linkSelector": "a[href]",
  "titleSelector": "a",
  "titleAttribute": "title",
  "publishedAtSelector": "span",
  "publishedAtUtcOffset": "+08:00",
  "allowUrlPrefixes": ["<该局实际栏目 URL 前缀>"]
}
```

建议三个来源分别使用实际观察的 HTTPS 栏目 URL 作为 `url` 和对应域/栏目 `allowUrlPrefixes`，不额外设置 `denyUrlPrefixes`。此 selector 来自单一保存页面的实际 DOM 路径；还没有跨周期或分页兼容证据。

| 来源草案 ID | 列表 URL / URL 前缀 | fromHtml 抽样结果 |
|---|---|---|
| `mof-fujian-supervision-dynamics`（提议 ID） | `https://fj.mof.gov.cn/gzdt/caizhengjiancha/` | 10 条；候选 `https://fj.mof.gov.cn/gzdt/caizhengjiancha/202608/t20260828_3996275.htm` 标题“财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量”，列表日 2026-09-22 |
| `mof-beijing-supervision-dynamics`（提议 ID） | `https://bj.mof.gov.cn/caizhengjiancha/` | 10 条；候选 `https://bj.mof.gov.cn/caizhengjiancha/202609/t20260924_3998098.htm` 标题“财政部北京监管局：坚持‘四个进阶’提升属地中央预算单位预算编制审核质效”，列表日 2026-09-24 |
| `mof-shanghai-supervision-dynamics`（提议 ID） | `https://sh.mof.gov.cn/gzdt/caizhengjiancha/` | 10 条；候选 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm` 标题“财政部上海监管局四维靶向施策 扎实推进增值税留抵退税抽审提质增效”，列表日 2026-09-23 |

以上是 config id 提议，不是已经注册或配置的 sources。建议完整 source 元数据沿行业现有官方来源约定；在本报告中不定稿 owner/entity 字段。若按现有财政来源首次回填约定编写草案，保留 `_aihot.initialBackfillMonths=3`、`initialBackfillRequirePublishedAt=true`，并令三个 source 均 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`，但这不表示本次导入、启用或已通过 Gate 2。

### 详情页字段及 identity 校验

三张 detail fixture 都有单一 `h2.title_con`，现有 `fetchDetail.titleSelector` 读取其 text；`meta[name="PubDate"]` 的 `content` 属性存在且以页面实际顺序呈现 `name` 后接 `content`。`fetchDetail` 的日期解析支持 `publishedAtRegex` 捕获 HTML 分组，但 `publishedAtSelector` 只读取 `datetime`、`title` 或元素 text，不读取 meta 的 `content`。因此日期草案应使用能按现有样本结构匹配的 `publishedAtRegex`，不应把 meta content 误配置成日期 selector：

```json
{
  "publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",
  "publishedAtUtcOffset": "+08:00"
}
```

现有 `fromHtml` 返回列表日期（+08:00 当地日零点）；`fetchDetail` 加载 `h2.title_con` 和上述日期 regex 后，离线 fake-fetcher 得到下表结果：

| 监管局 | 列表标题与日期 | detail selector/regex 得到标题与 `PubDate` | 当前 list identity 的 body helper | 使用 detail identity 的 body helper |
|---|---|---|---|---|
| 福建 | “财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量”；2026-09-22 | 标题完全相同；2026-09-22 08:21 (+08:00) | `extractSelectedBody(.my_doccontent)` 成功，1,659 字符 | 成功，1,659 字符 |
| 北京 | “财政部北京监管局：坚持‘四个进阶’提升属地中央预算单位预算编制审核质效”；2026-09-24 | 详情标题“北京监管局：坚持‘四个进阶’提升属地中央预算单位预算编制审核质效”（省略列表标题前缀“财政部”）；2026-09-30 08:39 (+08:00) | 失败 `identity_mismatch` | 成功，1,696 字符 |
| 上海 | “财政部上海监管局四维靶向施策 扎实推进增值税留抵退税抽审提质增效”；2026-09-23 | 标题完全相同；2026-09-23 15:09 (+08:00) | 成功，2,078 字符 | 成功，2,078 字符 |

`.my_doccontent` 在三个 fixture 均唯一；无附件链接被 `extractSelectedBody` 观察到。正文数是当前 sanitizer/identity helper 返回值，不是抓取、模型评估或发布质量判定。

### 北京的最小配置修正及边界

北京详情页原始 DOM 的 `meta[name="ArticleTitle"]` 与 `h2.title_con` 都给出无“财政部”前缀的详情标题；`meta[name="PubDate"]` 为 `2026-09-30 08:39:00`。现有 `collect.ts` 仅在 `detail.publishedAtAuthoritative=true` 时允许详情日期替换一个与列表相差超过一天的日期。普通模式下北京 9/24 列表日与 9/30 详情日相差六天，集合逻辑会保留列表日，无法仅靠 `publishedAtRegex` 改正。对三个保存 fixture，标题/日期解析本身均已由纯 helper + fake fetcher 验证。

对未来的 disabled source 草案，北京可用现有配置项把持久化 metadata 调整为详情页显示值，不需要改 selector 算法或 identity 算法：

```json
{
  "detail": {
    "maxFetches": 10,
    "titleSelector": "h2.title_con",
    "titleAuthoritative": true,
    "publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",
    "publishedAtUtcOffset": "+08:00",
    "publishedAtAuthoritative": true,
    "bodySelector": ".my_doccontent"
  }
}
```

这利用现有行为：权威日期标记会先清除列表候选日期以请求详情；权威标题规则要求读取详情标题；列表显示本页 10 条，故 `maxFetches:10` 才能覆盖本页首轮全部候选。未验证未来页仍是十项，因此 budget 必须依后续实页重新核定。两个正则/选择器仅与保存 HTML 的当前结构匹配，不代表站点稳定或日期字段未来不变。

有一个需要明确的首次顺序边界：同一次 `fetchDetail` 的 body 身份比对使用读取详情字段之前传入的列表标题/日期。若不把列表日期清空，北京实际 fixture 的列表 identity 结果是 `identity_mismatch`；按上面的 `publishedAtAuthoritative:true` 草案，`collect.ts` 会先把候选日期清空，因此首轮 body identity 预期的日期为 null，具体结果将是 `identity_missing`。两种情况下首轮都不能通过，不是可由 selector 改写 identity 比较规则。之后 `collect.ts` 用 detail rules 更新 candidate 标题/日期、入库并调用 `queueProcessing`；pending web-list 文章的现有队列路由进入 `extract`，而 `extractArticleBody` 使用已存标题/发布日期作为下一次正文身份预期。纯 helper 用详情身份重跑本地 fixture 得到 1,696 字符正文，说明现有第二次抽取能接受其身份。这个两阶段衔接是代码路径与 saved fixture 的静态/纯函数证据，尚未经过数据库、collector 或 worker 集成运行；配置兼容不等于 Gate 2 通过。

福建和上海的列表日与详情 `PubDate` 在 +08:00 当地日相同，时差分别为 8 小时 21 分、15 小时 9 分；现有 collector 接受同一日内 `<24h` 的详情时间替换。因此不需要 `publishedAtAuthoritative`。若希望存下页面时间，可在这两局详情规则加 `upgradeDatePrecision:true` 与同一 `publishedAtRegex`；若仅以列表当地日作为发布日，省略它也不影响已保存 fixture 的 body identity 检查。两局 `detail.titleSelector/titleAuthoritative` 没必要设置，因为列表标题与详情标题已匹配。

## RISKS
- 只用三页列表与三页详情的单时点 HTML；不能证明 selector、正则、栏目 path 或详情题名稳定。
- 北京首轮读取正文会遇到 pre-detail identity mismatch；两阶段 metadata→queued extraction 的实际 DB/worker 连贯运行未验证。应在未来受控配置 QA 中覆盖该状态路径，不能把纯函数 body pass 等同生产抓取通过。
- Regex 假设保存页中 meta attribute 的 name/content 次序与双引号保持；页面换写法时 authoritative 日期将解析缺失，安全地无法以详情日期确认，不应静默退回六天前列表日。
- 不含分页/历史页、重复 article、坏详情、附件变化或跨周期样本；厦门独立来源及全国35局目标不在本审查内。

## BLOCKERS
若要落实 source JSON，仍需 Lead/QA 审查三条提议 source IDs、detail budget 与首次抓取正文身份的两阶段行为；本任务没有 source config 或数据库权限要求，也没有启用任何源。日期和标题配置已在 saved fixtures 上离线可表达，但生产/collector 结果未知。

## NEXT
建立独立的配置/单元测试任务：在 disabled fixture source objects 中应用三个精确列表 selector 和 allow prefix；断言 `fromHtml` 输出标题、当地列表日、详情 URL；用北京回归验证详情 authoritative title/date 被保存后，下一次 body extraction 使用新 identity 可通过，同时首个 `fetchDetail` body mismatch 不会丢失 detail metadata。QA 通过后再考虑写入 disabled source JSON；任何真实请求、collector 或 source enablement 必须另行授权并有受限预算。Gate 2 仍未通过。
