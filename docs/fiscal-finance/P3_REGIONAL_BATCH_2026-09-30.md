# 财政部监管局区域双来源 P3 全首页批次验证

验证日期：2026-09-30（Asia/Shanghai）
验证库：`fiscalhot_regional_batch_test`，`127.0.0.1:5432`
来源配置文件 SHA-256：`11ea2a11d8a761ab592ac86b4428be7e730bab8bad86fed56ded4f09b1813dab`
来源配置 Git blob：`22161855165e59bcfbbd04fd690a81d5595c2dcc`
执行时 HEAD：`df34819a4d41c01238daddc6270dd7b53e2e2f6b`
结论：两来源实际完整配置下各完成两轮首页 collector；首轮新增 18 篇，18 篇均经正文 helper 成功写为 `ok/rev2`。**总 HTTP 跳数上限 28 未能审计证明，因此本批不能记作预算通过；Gate 2 仍未通过。**

## 隔离、安全与执行范围

新建专用 `*_test` 数据库 `fiscalhot_regional_batch_test`，应用 35 项迁移。只播种两条目标来源，并逐字段核对其数据库 `config` 与 `industry/sources.json` 完全一致；没有把 URL allowlist 收窄到样本。两条 source 在库中全程为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。真实 collector 通过 `collectSource(id, { force: true })` 在隔离库运行；没有临时改 enabled，也未改行业配置。

全程显式关闭 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`。没有启动 worker、模型、Jina、OCR、通知或发布任务；只对新建的文章逐篇直接调用 `extractArticleBody(id, false)`。隔离库之外未读写 preview/旧 P3 库，没有停止共享 PostgreSQL。

## 首页原始候选、过滤、排序和窗口

每源另用一次无重定向 guarded fetch 保存当前首页原始 HTML，原始文件与 hash 在忽略目录 `.data/fiscal-regional-batch-20260930/`。这是候选离线复算材料；它不替代之后两轮 collector 自己发出的首页请求。

| 来源 | selector 命中 | parser `found` | allow/noise/首导入窗口后 `accepted` | 候选 URL 重复 | 页数声明 | 当前列表发布日期窗口 | 首页 HTML SHA-256 |
|---|---:|---:|---:|---:|---:|---|---|
| `mof-regional-supervision-dynamics` | 8 | 8 | 8 | 0 | 20 页 | 最新 2026-09-29，最旧 2026-09-18 | `ac298b4276f40cafe091baeb7cccc2f21e19d5c8a331ee3efaf8f3f3f1b55f91` |
| `mof-xiamen-supervision-dynamics` | 10 | 10 | 10 | 0 | 10 页 | 最新 2026-09-29，最旧 2026-09-01 | `927b4f055efb98202737d410dd65be029ab21e57d866c9e4ff744a537e07f89e` |

中央页 8 个 selector 条目全部由 parser 接受；按源配置的 35 个财政部局域名 allowlist 后没有额外拒绝项，噪声规则拒绝 0 条，12 个月首导入窗口和 30 条上限未再裁掉条目。中央以“标题含监管局”筛选，页面其他财政新闻没有进入这 8 条；这只说明 selector 结果，不把所有未选新闻定性为噪声。厦门页 10/10 selector 条目均被接受，噪声规则拒绝 0 条。两页候选日期都齐全，无缺日期。parser 接受 URL 均为详情页，分页脚本声明分别 20/10 页；首页 HTML 没有可供本 collector 跟随的分页流程，本轮 collector 仍只抓首页，没有声称抓完栏目历史。

当前中央首页顺序为：厦门 9/29、广西 9/28、云南 9/24、吉林 9/24、福建 9/22、重庆 9/21、安徽 9/20、山东 9/18。厦门首页顺序为：办公室党支部 9/29、网安宣传周 9/29、国有资本收益审核 9/24、节前廉政提醒 9/24、普惠金融 9/24、农村养老调研 9/18、党支部学习 9/18、绩效评价调研 9/11、科研经费主题活动 9/11、绿色低碳讲堂 9/1。厦门栏目首屏同时有业务监管、内部学习和一般工作动态，10 条都属于配置的“工作动态”栏目；P3 接收不代表这些题材均应进入后续精选。

快照比较：中央旧首页 7 条到已保存的后续首页 8 条时，新增厦门稿《激活财政科学管理“源动力”跑出预算监管提质“加速度”》；本次当前首页与后续 8 条快照 URL/标题/日期完全相同，无新增、消失或改日。厦门旧的两份 10 条首页快照与本次当前页也完全一致。这里记录的是旧快照到本次读取的窗口排序、最旧日期与出入项；重复快照或同日复读不能证明长期稳定或更新频率。

## 两轮实际 collector 和逐篇正文

| 来源 | 第 1 轮 `found/accepted/created/revised` | 第 2 轮 `found/accepted/created/revised` | fetch_runs |
|---|---|---|---|
| 财政部中央选登 | `8 / 8 / 8 / 0` | `8 / 8 / 0 / 0` | 两轮 `ok`，`found_count=8`，`new_count=8→0` |
| 财政部厦门工作动态 | `10 / 10 / 10 / 0` | `10 / 10 / 0 / 0` | 两轮 `ok`，`found_count=10`，`new_count=10→0` |

下面列出全部 18 篇首轮创建的文章。日期列左侧为列表解析并写入库的北京时间自然日；“正文可见日期”只从已提取正文文本开头检查，没出现则记“正文未载明”，不拿 URL 路径日期补值。18 篇皆为 `body_status=ok`、`revision=2`，正文 SHA-256 对应数据库当前正文文本。

| 来源 | 列表日 | 标题 | 正文可见日期 | 字数 | 正文 SHA-256 |
|---|---|---|---|---:|---|
| 中央选登 | 9/20 | 财政部安徽监管局：以正确政绩观为引领 持续锻造财政监管“红色引擎” | 9/20 | 2,562 | `f225e32bd27e025f80ccca5e6875c0dd842e20178215d0c58c345af638d46254` |
| 中央选登 | 9/21 | 财政部重庆监管局：构建“四维工作法”筑牢地方财政运行安全底线 | 9/21 | 1,689 | `536605a2d0cdd12fab320c87cd9df30e89225af516b5f990dd278938f855a884` |
| 中央选登 | 9/22 | 财政部福建监管局：“三强化”提升资源综合利用增值税即征即退政策复查工作质量 | 9/22 | 1,659 | `8293e165f849d4f7882ff519cbab2397ae269d59a14e8ccc2dbc0f37cceb6e09` |
| 中央选登 | 9/28 | 财政部广西监管局：“四个聚焦”推进国有金融资本产权登记监管提质增效 | 9/28 | 1,720 | `36b00746d87361f5706f6f3be5a9eee0200e3e380a93417fd4cd549fddff55d0` |
| 中央选登 | 9/24 | 财政部吉林监管局：“四维发力”持续巩固属地中央预算单位过紧日子监管成效 | 9/24 | 2,213 | `3593955eefdea7507802dfc6bb12b35ce6968f63347b0eaab51e4dfa4772fbc5` |
| 中央选登 | 9/18 | 财政部山东监管局：抓实绩效评价推动超长期特别国债支持消费品以旧换新资金提质增效 | 9/18 | 1,490 | `ff943bca716fc7f802e6dbb19df8700dd99ecc5d1d96c93f788407c182fbc9c9` |
| 中央选登 | 9/29 | 财政部厦门监管局：激活财政科学管理“源动力”跑出预算监管提质“加速度” | 9/29 | 2,651 | `f196619e9e94e00e91726c0661d38fdf016776454d7bcc077d5cdf404113aef6` |
| 中央选登 | 9/24 | 财政部云南监管局：下好“三步棋”织密财政收入监管“一张网” | 9/24 | 1,704 | `3a9abd7d51971ed8819daec943a5a15c77e61f90bfbcd45033f4db485a20801e` |
| 厦门 | 9/1 | 财政部厦门监管局：组织干部职工收看公共机构绿色低碳讲堂 | 正文未载明 | 379 | `5cedb03ddd230164f260480d1a837348f4aba3fab306b72cd784a134745031e5` |
| 厦门 | 9/11 | 财政部厦门监管局：临时党支部加强联创联建，开展“管好用好科研经费 促进科技自主创新”主题党日活动 | 正文未载明 | 342 | `ec94e02b4efd00c77a0ba857961a530effa2926269f829dd9ab2a2eead08f51f` |
| 厦门 | 9/11 | 财政部厦门监管局：监管一处开展财政重点绩效评价工作调研 | 正文未载明 | 233 | `d9fc3af991cea2eb9afb5c5d880c340422a963edc31cec674b5bb9e7d3ab68e2` |
| 厦门 | 9/18 | 财政部厦门监管局：监管二处党支部组织《习近平党建文选》专题学习研讨 | 正文未载明 | 258 | `db480d9d480833cd2b6229d48b107e91f6e17ae1b0acdfca42f520123d843b87` |
| 厦门 | 9/18 | 财政部厦门监管局：办公室组织开展厦门市农村养老保障情况专项调研 | 正文未载明 | 223 | `7a8a5fd98f155ab3b38094114a4a0625f20ad1effa3838d1833f940b52769bd8` |
| 厦门 | 9/24 | 厦门监管局：强化财金协同 深化精准监管 助力普惠金融高质量发展 | 正文未载明 | 1,935 | `fce18a043f7159dc4a03bf80553906e628a612022d93985b8214760f4b905f24` |
| 厦门 | 9/24 | 财政部厦门监管局：召开“中秋”“国庆”节前廉政提醒会 | 正文未载明 | 224 | `4ec2fd5517cb68edfa31b250b9a0c2fc25c8c44ec223077ae40621c60600b726` |
| 厦门 | 9/24 | 财政部厦门监管局：扎实开展中央企业国有资本收益审核工作 | 正文未载明 | 259 | `118df61e3573d20911a10abe3b13196d4ae3c45283e57c20ba06bc1ff5b1fe9c` |
| 厦门 | 9/29 | 财政部厦门监管局：组织开展2026年度国家网络安全宣传周活动 | 正文未载明 | 600 | `df6638c6583cfb74e3cc09ee334c2e99589a708c2c173a1332b39f6689e5de5f` |
| 厦门 | 9/29 | 财政部厦门监管局：办公室党支部深学细悟财政科学管理试点座谈会精神 | 正文未载明 | 296 | `aca113405c49974eee794ebadcb2e76c14da0c7a628c5ed20cf05cd560d7f70d` |

中央 8 篇的正文开头均出现与列表日相同的明确日期，且首尾抽样为相应监管业务内容。厦门列表日均完整；其正文开头没有抽取出明确发布日期，因而本批只确认列表日期解析与正文可读，不声称 10 篇的列表日都已与详情 PubDate 独立对齐。厦门五篇正文较短（223–379 字），内容开头/结尾样本仍对应题名事项，但只凭 Readability 的 `ok` 阈值不能证明页面完整；应把短正文保留作逐篇人工复核候选。原有历史固定样本的详情日期核验见既有 P3 报告，本批不重抓、不借用为新增 18 篇的详情日期证据。

## 跨源身份、数据库与 job 审计

对两个本次真实首页候选集按项目 `identityKeyFor()` 比较，中央 8 条与厦门 10 条之间没有相同 identityKey。中央新增的厦门稿也不在厦门当前首页窗口。数据库因此实际没有产生跨来源同一候选，`article_discoveries` 每篇只有各自的 source 发现记录，跨源运行时去重结果为 **unknown**；代码对同一 normalized URL 使用相同 identity key 的路径规则不等同于本批实测。

隔离库最终审计：`sources=2` 且两条 disabled/fulltext=false；`articles=18`，同 identity 组 0，重复 URL 组 0；`article_discoveries=18` 条 source discovery。18 个 `content.extract-body` jobs 均为 `created`、`retry_count=0`，没有消费；没有分析、收据或发布：`analyses=0`、`receipts=0`、`publications=0`。没有启动 worker，因此未消费队列是预期的 P3 隔离状态。

## HTTP 预算审计限制

本批预定 HTTP hop 硬上限为 28，未重试。实际 `guardedFetch` 调用数为：保存两份首页快照 2 次、两源各两轮 collector 4 次、18 篇正文各 1 次，共 24 次；在发现计数器失效后另发 1 次无重定向的只读首页仪器探针。因此整个验证过程至少有 25 次 guarded fetch 调用/HTTP hop。两份预检首页和单独仪器探针均有 HTTP 200、最终 URL 等于请求 URL、无 Location，确认这 3 跳各为 1；collector 和正文调用没有保留每跳日志，实际总 hop 数无法回溯。

本轮临时计数器覆写 `Agent.prototype.dispatch`，但未观察到 dispatch；离线诊断显示 `Agent.prototype.dispatch` 原本继承自 `DispatcherBase`，库和 backend 解析到同一 `undici` 路径，配置也没有代理且私网开关为 false。现有证据不足以断言它为何未命中。因此结果文件里原先为零的 hop 字段不得当作实际网络数；本报告明确纠正为 unknown。不能证明实际 hop 总数不超过 28，也不能排除存在多于 3 个额外重定向跳数。所有剩余网络请求均已停止，没有重跑或补抓。

下次最小计数方案：在任何采集前订阅已验证可收到事件的 `undici:request:create`、`undici:client:sendHeaders` 和 `undici:request:headers`，按请求对象记录 origin/path、发送数、响应 status/location；先用一个零重定向首页请求确认三种事件恰好对应一个 hop，再启动批次。要把“限额”变成硬停止，下一次应在验证后的 dispatcher 入口上计数并于第 29 个发送前拒绝，或将 collector/body 调用通过支持注入 `maxRedirects=0` 的有界 fetcher 执行；先用安全 canary 验证拦截本身有效，再运行真实批次。当前报告不把这项建议当成本次预算通过证据。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：使用实际完整来源配置，在新的隔离测试库，对中央选登与厦门监管局来源各执行两轮真实首页 collector；最多创建 20 篇并抽取正文，验证候选窗口、列表/正文日期、正文状态、跨源身份和数据库 jobs。

**MODEL**：GPT-6 Luna / High 执行本阶段；运行环境模型开关 false，模型调用 0。未运行 worker。

**FILES_CHANGED**：只新增本文。忽略目录 `.data/fiscal-regional-batch-20260930/` 存放临时脚本、两份首页原始 HTML 和执行证据 JSON；未改 tracked code、source config、migration、preview 库或旧测试库。临时证据保留了原始候选 URL、标题、日期、selector 计数、列表 hash、正文 hash 与 SQL 审计。

**TESTS_RUN**：新建隔离库及 35 项 migration；实际完整配置两来源各两轮 `collectSource(force)`；保存首页原文并用现有 parser 离线复算；18 篇各执行一次 `extractArticleBody(id, false)`；逐条 SQL 核对 articles/revisions/article_discoveries/pg-boss jobs/analysis/receipts/publications；旧首页原始 HTML 快照离线比较。没有运行应用测试套件或重复联网验证。

**RESULT**：中央 `found/accepted/created/revised=8/8/8/0 → 8/8/0/0`；厦门 `10/10/10/0 → 10/10/0/0`。18/18 正文写入 `ok/rev2`，长度 223–2,651 字；中央 8 篇正文可见日期与列表日期逐篇同日，厦门 10 篇正文未载明明确发布日期。跨源候选 identityKey overlap 为 0、所以 `article_discoveries` 跨源去重 unknown。18 个提取 jobs 均 `created/retry0` 未消费；analysis/receipt/publication 均 0。**HTTP hop 实际总数 unknown，≤28 未经证明；不要标记预算 PASS。**

**RISKS**：厦门短正文仅凭 Readability 状态不能证明完整；厦门列表日期未与本批详情 PubDate 逐篇核对；collector 仅抓首页且中央选登并非 35 局全量；单日窗口相同不能说明长期稳定；本批没有匹配候选，未证明跨源重复入库路径；HTTP 计数 hook 未生效，不能证明 28 跳上限。

**BLOCKERS**：本批网络预算上限无法审计证明；跨源重复样本缺失；来源历史页、较长周期窗口与厦门短正文复核仍待补。Gate 2 继续 NOT_PASSED。

**NEXT**：先修正并 canary 验证 HTTP hop 计数/硬停止，再决定是否需要新的有界采集；由质量 Agent 审阅本报告和 ignored 原始证据。当前不要据此开启来源、worker、模型或 Gate 2。
