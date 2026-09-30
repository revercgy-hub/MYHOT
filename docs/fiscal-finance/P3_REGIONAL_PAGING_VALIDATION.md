# 财政部监管局动态来源 P3 历史分页有限核验

核验日期：2026-09-30（Asia/Shanghai）

验证范围：财政部“财政新闻”监管局选登列表及财政部厦门监管局“工作动态”栏目首页和 `index_1.htm` 历史页；每源另选一篇历史业务稿，仅作只读详情与正文核验。

状态：两源历史页均可由现有 parser 读取候选，所核的两个历史详情正文均可解析。该结果不代表现有 collector 会自动翻页、全页采集、来源长期稳定或 Gate 2 通过。

## 安全与请求边界

请求使用项目现有 `guardedFetch()`，每次 `maxRedirects=0`、20 秒超时、最多 6 MiB；列表与详情均串行执行且不重试。所有本轮开关为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`。没有数据库读写、collector、worker、模型、Jina、通知、发布或在线 preview 操作。

总预算最多 10 次 guarded fetch；实际执行 6 次：两源各取当前首页和历史 `index_1.htm` 共 4 次，再各取一篇历史详情共 2 次。所有 6 次均 HTTP 200、`text/html`、没有重定向，最终 URL 与请求 URL 一致。实际原始响应 HTML 均保存在被忽略的 `.data/fiscal-regional-paging-validation/`，完整机器记录及解析结果见 `final-evidence.json`。本轮没有使用余下请求预算。

| 用途 | 请求 URL | 状态/大小 | 原始响应 SHA-256 |
|---|---|---:|---|
| 财政部中央首页 | `https://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/index.htm` | 200 / 21,016 B | `ac298b4276f40cafe091baeb7cccc2f21e19d5c8a331ee3efaf8f3f3f1b55f91` |
| 财政部中央历史页 | `https://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/index_1.htm` | 200 / 20,556 B | `330cbfba018ab4dd43fe17435f466255c4bb17e2d4b9fe87f3d2b73d142700a4` |
| 厦门监管局首页 | `https://xm.mof.gov.cn/caizhengjiancha/index.htm` | 200 / 12,797 B | `927b4f055efb98202737d410dd65be029ab21e57d866c9e4ff744a537e07f89e` |
| 厦门监管局历史页 | `https://xm.mof.gov.cn/caizhengjiancha/index_1.htm` | 200 / 12,701 B | `8364f521d3ab93dbbe6a6d83e26cfaf621e437d39426d50328d2a1107a7fcb1c` |
| 北京监管局历史业务稿 | `http://bj.mof.gov.cn/caizhengjiancha/202609/t20260910_3997188.htm` | 200 / 19,600 B | `94533a57ae16d5c04eb89f1cb5458e03b53c47318c2e07af3079aa63ce1041ba` |
| 厦门监管局历史业务稿 | `https://xm.mof.gov.cn/caizhengjiancha/202609/t20260901_3996426.htm` | 200 / 19,888 B | `d07ed45848a2aa9a4c16f7ce42f3fb66e7dfb6790948625e71a59a0fa15ac4a3` |

每项完整请求证据还记录了请求/最终 URL、响应 MIME、Location、抓取时间、字节数、hash 和原始文件路径。对应原始响应文件名为 `mof-regional-supervision-dynamics-page-0.html`、`mof-regional-supervision-dynamics-page-1.html`、`mof-xiamen-supervision-dynamics-page-0.html`、`mof-xiamen-supervision-dynamics-page-1.html` 和两个 `*-historic-article.html`；均在忽略目录，不进入 Git。

## 分页结构、候选与相邻页

用仓库现有 `packages/backend/src/sources/web-list.ts#fromHtml()` 对保存的每个列表原始 HTML 离线解析；没有新建分页 collector 能力，也没有修改任何来源配置。

| 来源 | 页面 | 配置 selector 命中 | parser found/accepted | URL 重复 | 页面脚本页数声明 |
|---|---:|---:|---:|---:|---:|
| 财政部中央选登 | 当前首页 | 8 | 8 | 0 | `countPage=20` |
| 财政部中央选登 | `index_1.htm` | 7 | 7 | 0 | `countPage=20` |
| 厦门监管局 | 当前首页 | 10 | 10 | 0 | `countPage=10` |
| 厦门监管局 | `index_1.htm` | 10 | 10 | 0 | `countPage=10` |

四页均保留栏目标题和动态分页相关脚本；保存的 HTML 中没有页码直达锚点，脚本声明页数。相邻两页以候选精确 URL 比较，中央选登重复 0 条（首页 8、历史页 7），厦门重复 0 条（首页 10、历史页 10）。解析候选全部命中配置的文章 selector 与允许 URL 前缀；没有分页、反馈或其他导航链接被 parser 接受为文章。历史页标题、日期、URL 的完整候选清单在机器证据中，列表摘要日按 `+08:00` 解析。

此相邻页比较只能说明这两份页面快照间的重复情况。它不证明其他历史页没有重复，也不证明采集流程会访问这些页面。`web_list` 当前通过来源配置里的单一 `config.url` 获取首页；现有 collector 未添加 `index_1.htm` 或自动分页逻辑。

## 历史文章正文核验

| 来源 | 列表候选与详情 | 列表日期与详情 PubDate | 正文结果 |
|---|---|---|---|
| 财政部中央选登 | 北京监管局《聚焦四个强化 推动民生领域资金监管与服务走深走实》；列表链接 `http://bj.mof.gov.cn/caizhengjiancha/202609/t20260910_3997188.htm`；详情 HTTP 200，`ArticleTitle` 为同题（清理 HTML 中的不换行空格后精确一致）。 | 列表日期北京时间 2026-09-16；详情 `PubDate=2026-09-16 08:25:00`，同日。 | 现有 `readable()` 得到 1,832 字；SHA-256 `ec0faaba6ab6f069edeb2a9b57d181265dcce6dfdb89f8df53ca439f90867c24`。首尾片段均为民生资金监管、政策指导与服务内容，无显著导航文本。 |
| 厦门监管局 | 《以审促改 以效为纲 扎实做好安居工程绩效评价审核》；列表链接 `https://xm.mof.gov.cn/caizhengjiancha/202609/t20260901_3996426.htm`；详情 HTTP 200，`ArticleTitle` 与列表标题一致。 | 列表日期北京时间 2026-09-04；详情 `PubDate=2026-09-04 08:31:00`，同日。 | 现有 `readable()` 得到 1,979 字；SHA-256 `b8f4a00b29d168a7ed1b0b8823cc980390341c38f073c785f05478c0c7078f07`。首尾片段均为安居工程补助资金、绩效审核与整改跟踪内容，无显著导航文本。 |

正文仅在忽略目录中的 JSON 机器证据保留完整提取文本、首尾样本和 hash；详情 HTML 也原样留存，可离线重复运行同一个 `readable()` parser。本轮只核验每源一篇历史稿，不能外推其余候选的正文覆盖率。

## 快照差异与解释边界

相对上一份保存在 `.data/fiscal-regional-audit/` 的首页 HTML，本次离线用同一 parser 复算：中央选登从 7 条变为 8 条，原有 7 条的 URL、标题和日期均未变，增加一条厦门监管局《激活财政科学管理“源动力”跑出预算监管提质“加速度”》；无移除项。厦门首页仍为 10 条，10/10 URL、标题和日期均与保存快照相同。这是两份快照间可观测到的变化与相同项，不代表长期 freshness 或稳定性。中央汇总仍是选登，不代表覆盖财政部 35 个监管局的全部动态。

该新增厦门稿的中央候选 URL 是 `http://xm.mof.gov.cn/caizhengjiancha/202609/t20260922_3997966.htm`。与本轮厦门首页 10 条候选离线逐项比较，**精确 URL 匹配为 0，同 pathname 匹配也为 0**，其中没有同题条目；因此当前证据只证明中央选登列表新增了这条厦门稿，不能声称两份本轮列表已重复收录它。协议差异方面，仓库 `normalizeUrl()` 将 HTTP 统一成 HTTPS；该中央 URL 会得到 `https://xm.mof.gov.cn/caizhengjiancha/202609/t20260922_3997966.htm`，其 `identityKey` 为 `url:https://xm.mof.gov.cn/caizhengjiancha/202609/t20260922_3997966.htm`。若厦门独立栏目以后也以 HTTPS 列出同一 host/path，现有 identity-key 唯一约束会把它视为同一文章，并通过 `article_discoveries` 记录另一来源；本轮没有数据库写入或跨来源 collector 验证。

现有列表 parser 将列表时间按 `+08:00` 转成 UTC 时间，故 JSON ISO 日期小时为前一天 16:00；本报告比较发布日期时换回北京时间自然日。厦门历史页候选日期并非严格按发布日期递减，采集方应保留来源时间戳，不根据 DOM 顺序推断精确发布时间。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：在最多 10 次 guarded fetch 的限制下，对财政部中央监管局选登和厦门监管局栏目各验证当前首页与一页真实历史分页，并各取一篇历史业务详情验证原文标题、日期和正文，同时保留原始 HTML 供复查。

**MODEL**：GPT-6.1 SOL 执行本阶段；运行时模型相关、采集、Jina、推送及私网开关全部 false。没有调用模型服务。

**FILES_CHANGED**：新增本报告。忽略目录 `.data/fiscal-regional-paging-validation/` 保存 6 份原始 HTTP 响应、两个执行脚本、列表页 JSON 与完整 `final-evidence.json`；未改已有 docs、sources 配置、应用/包、迁移、测试库或在线 preview。

**TESTS_RUN**：4 次真实只读列表 fetch、2 次真实只读详情 fetch；用现有 `fromHtml()` 对四份原始列表做离线解析及相邻页 URL 重复核对；用现有 `readable()` 对两份原始详情 HTML 解析正文；对已保存首页快照与当前首页做离线候选比较。没有运行 collector 或应用测试套件。

**RESULT**：6/10 次请求预算已使用；6 次均 HTTP 200、无重定向。found/accepted 为中央首页 8、中央历史页 7、厦门首页 10、厦门历史页 10；各页内无重复，成对相邻页跨页重复均为 0。两个历史详情标题经空白规范后与候选匹配，列表日和详情发布日期北京时间同日；现有 `readable()` 分别返回 1,832 / 1,979 字正文。结果仅为只读临时解析，没有数据库写入。历史页面证据不改变现有 collector 的“只取首页”能力。

**RISKS**：仅一张历史页/源、一个正文/源，不能证明 20 页/10 页完整覆盖、跨页长期重复率、跨周期 freshness 或所有正文可读。中央选登并非 35 局全量来源。中央首页新发现一条厦门稿；它没有出现在当前所取厦门首页，但未来若以 HTTPS 同 host/path 从厦门源再次出现，现有 URL identity 逻辑会合并记录。没有数据库 collector 实证。本轮没有为这条新增 URL 再发请求。厦门 `index_1` 样本日期顺序并不单调。

**BLOCKERS**：无本轮网络或解析阻塞；分页没有进入自动 collector，Gate 2 仍未通过；其余历史页和正文质量未核验。

**NEXT**：由阶段负责人复核原始 HTML 和 `final-evidence.json`，决定是否另行设计显式分页支持与隔离 collector 验证；本报告证据不授权开启两个来源、采集开关、模型或 Gate 2。
