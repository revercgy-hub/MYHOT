# 上海监管局 page 1 单次只读探测（2026-10-06）

## 核销范围与结果

Lead 核销的是对上海现有 `mof-shanghai-supervision-dynamics` 的一次离线证据补全请求，不是 source opt-in 或 collector 许可。唯一目标：`https://sh.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm`。使用仓库 `guardedFetch`、pinned Undici 8.11.2 和 P3 实际 dispatch budget；请求前验证上海 config/list prefix 与两个已保存 page 0 manifest/raw/hash，并持久化 one-shot marker。

请求返回 HTTP 200、`text/html`，final URL 与请求 URL 一致；响应 12,816 bytes，SHA-256 `b8c5ec2033bbadd10d48b43a29c3e2b9d32a3e9648fe342e2eb9d3bd473adcdc`。真实 budget 为 attempted/dispatched/rejected `1/1/0`，三个 Undici 事件（create、sendHeaders、response headers），无 redirect、retry、详情或附件请求。原始响应、runner、marker 和详细 manifest 均保存在 ignored `.data/fiscal-qa/shanghai-page2-probe-20261006/`。

## 原始分页字段与 page 0 对照

10/04 与 10/05 保存的 page 0 是两份相同字节：每份 12,617 bytes，SHA-256 `cbbd59f4ac4dea453140f497543ed156c2324dee336366a430d57ab97a1eebce`；各自 manifest 的 URL、HTTP 200 和 hash 均匹配。离线 raw 检查显示 page 0 `currentPage=0`、`countPage=50`，脚本表达 `nextPage=currentPage+1` 并把下一项路径写作 `index_<nextPage>.htm`。page 0 静态呈现的分页 anchor 只有“首页”；脚本没有在本次离线检查中执行。

本次真实 `/index_1.htm` raw 对应 `currentPage=1`、`countPage=50`，下一页变量表达仍为 `currentPage+1`。因此只确认这个已实际请求的 sibling URL 是页 1 身份；`countPage=50` 是页面自报值，不代表已经确认 50 页都存在。

ignored manifest 中的一次性辅助布尔字段 `indexNextPageTemplatePresent` 为 false；这是其正则没有识别分段拼接的脚本字符串，不是站点没有 URL 公式。raw 的原始脚本行直接写作 `href=\"index\" + \"_\" + nextPage + \".\" + \"htm\"`；本报告按原始行复核后记录模板。不要把该辅助布尔字段单独当作来源事实。

两页都按本 source selector `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li` 读取 10 行，页内精确 URL 重复均为 0，跨页 URL 交集为 0。page 0 展示日期降序从 2026-09-28 到 2026-08-28；page 1 从 2026-08-27 到 2026-07-24，边界日期相邻。该观察符合这两页的页码和日期顺序，不证明深页或跨周期稳定。

page 0 的 4/10、page 1 的 3/10 行显示日期与标题 URL 中的日期 token 不同。日期 token 只记录作诊断，不可替代列表/详情发布日期字段。page 1 第四行是 `财政部上海监管局2025年度单位决算`，链接为同目录内 `.pdf`；没有对它或任何候选发详情请求。

## 日期和 source path 复核

原配置的详情规则为 `<meta name="PubDate" content="…">` regex，offset `+08:00`，`maxFetches=10`；`publishedAtAuthoritative`、`titleAuthoritative` 和 `upgradeDatePrecision` 均未配置。`upgradeDatePrecision` 未设置与 `false` 等价。普通 collector 在 [`collect.ts`](../../packages/backend/src/sources/collect.ts) 令 `need.date = !c.publishedAt || d.upgradeDatePrecision === true`；分页 metadata 在 [`web-list-pagination.ts`](../../packages/backend/src/sources/web-list-pagination.ts) 仅在日期 authoritative、列表日期缺失或 precision upgrade 显式为 true 时设置 `needsDate`。所以已有列表日时，上海详情 `PubDate` 默认不会被抓取用作 metadata 替代。

已保存的配对详情 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm` 标题与列表相同，列表日期是 2026-09-23 date-only，详情 `PubDate=2026-09-23 15:09:00`。日期日相同但时间并不精确相等；`+08:00` 下详情比列表午夜晚 15 小时 9 分。保存的真实 collector 结果使用列表午夜。由于 source 没声明详情日期权威，也没有升级时间精度，这个样本不能证明详情字段的普遍原始发布日期含义。不得将它写作 Phase B 精确日期 equality pass。

`config.url`、唯一 `allowUrlPrefixes` 精确都是 `https://sh.mof.gov.cn/gzdt/caizhengjiancha/`。所有 page 1 行都在该 origin/prefix 内，但目录内同时存在 HTML、PDF 和 `index_1.htm` 列表页身份；allow-prefix 本身不能区分三类目标。metadata detail 的 direct HTML response requirement 会保守拒绝 PDF MIME；当前 `.my_doccontent` body selector 无 `pdfDirect`/attachment 配置，页 1 PDF 的 body/S4 仍需单独处理。

## 边界

此次只读取一个 listing page，不写数据库，不运行 collector、worker、模型、正文 helper 或附件下载。结果仅供首个 Phase C source evidence packet 审阅；没有批准 source 配置、页 2 以上、历史 complete、reset/incremental 或 Gate 2 变更。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按 Lead 单页核销读取上海 page 1，离线比较本源 page 0 与 page 1 列表和分页字段。

**MODEL**：GPT-6 Luna High；未调用项目 provider/model。

**FILES_CHANGED**：仅新增本报告。ignored 目录中新增一次性 runner、request-started marker、`manifest.json` 与 `shanghai-page1.html`；未改 Git index、config、backend 或 DB。

**TESTS_RUN**：`node --check` 一次性 runner 通过；真实请求通过 guarded transport/P3 budget，1/1 dispatch。离线从保存 raw 提取列表字段、候选重复、页间交集、日期范围与 path-date 诊断；没有运行项目软件测试。

**RESULT**：成功得到上海 `currentPage=1`、10 个候选、0 个重复 URL，并与保存 page 0 相邻接续且没有 URL overlap。此结果不支持更广覆盖声明。

**RISKS**：`countPage=50` 未逐页验证；日期/URL token 不同；详情 `PubDate` 与日期型列表值在精确时间上冲突；页内含 PDF，正文 S4 未通过该样本。

**BLOCKERS**：没有来源级 original-date 语义与精度裁定、PDF正文边界、末页/历史完整性或跨周期稳定性证明。

**NEXT**：保留该 probe manifest/raw 供 QA 离线核验；本次 dispatch 上限用尽，不重试。后续配置、source admission 或新的真实请求须另有明确 Lead/S1 核销。
