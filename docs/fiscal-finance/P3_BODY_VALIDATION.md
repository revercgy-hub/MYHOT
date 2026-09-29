# P3 本地受控正文提取验证

日期：2026-09-29。复用此前隔离数据库 `fiscalhot_ingest_test` 中的 30 条财政部列表材料，按 3 个源每源选最新 2 篇，共 6 篇。此轮只验证正文获取与已有数据库存储路径；不启动 worker、不消费 pg-boss 队列、不调用模型或付费 Reader，也不代表 Gate 2 已通过。

## 安全确认与执行方式

选取前从数据库核实 6 篇均来自 `web_list`，source 持续 disabled、全文许可关闭，候选 URL 落在各自 `allowUrlPrefixes` 下，且 `x_post IS NULL`。排除了正文函数中特殊的 X Article / SocialData 分支。

使用既有 `extractArticleBody(articleId, false)` 逐篇顺序执行。代码路径读取条目后调用 `extractFromUrl()` 和 SSRF 防护 `guardedFetch()` 请求官方详情 HTML，再用本地 Readability；成功时更新 body、内容哈希与 revision，失败时只将状态写为 `unconfirmed`。传入 `false` 后 `extractFromUrl()` 在 Readability 未得到合格正文时直接返回，不会调用 Jina。该函数不启动模型、不 enqueue、不自动调用 `queueProcessing`；本文临时助手脚本只固定这 6 个 ID，数据库环境与安全开关不匹配或记录状态不再是 pending 时即停止。

执行环境明确设置 `COLLECT_ENABLED=false`、`MODEL_CALLS_ENABLED=false`、`JINA_BODY_FALLBACK=false`、`INDEXNOW_SUBMIT_ENABLED=false`、`FEISHU_CONTENT_PUSH_ENABLED=false`、`FEISHU_INTERNAL_ENABLED=false`、`ALLOW_PRIVATE_NETWORK_FETCH=false`。没有启动 API 或 worker。对 6 个已选详情 URL 各调用正文入口一次；不因未确认而重试。Lead 随后批准对未确认的金融司详情单独增加 1 次只读诊断 GET，不再调用正文存储函数、不改数据库。

## 结果

| Source ID | 数据库标题 | 详情 URL | 结果 | 正文字符 | revision |
|---|---|---|---|---:|---:|
| `mof-finance-notices` | 关于公布2026年中央财政支持普惠金融发展示范区名单等有关事项的通知 | `https://jrs.mof.gov.cn/gongzuotongzhi/202607/t20260716_3993671.htm` | `ok` | 1,493 | 1 → 2 |
| `mof-finance-notices` | 2026年中央财政支持普惠金融发展示范区绩效考核情况的公示 | `https://jrs.mof.gov.cn/gongzuotongzhi/202606/t20260608_3991316.htm` | `unconfirmed` | 0 | 1 → 1 |
| `mof-policy-release` | 中华人民共和国财政部公告2026年第24号 | `https://zhs.mof.gov.cn/zhengcefabu/202608/t20260826_3996112.htm` | `ok` | 4,024 | 1 → 2 |
| `mof-policy-release` | 财政部关于印发《彩票市场调控资金管理办法》的通知 | `https://zhs.mof.gov.cn/zhengcefabu/202608/t20260814_3995456.htm` | `ok` | 4,563 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年8月地方政府债券发行和债务余额情况 | `https://zwgls.mof.gov.cn/tjsj/202609/t20260924_3998108.htm` | `ok` | 1,021 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年7月地方政府债券发行和债务余额情况 | `https://zwgls.mof.gov.cn/tjsj/202609/t20260909_3997013.htm` | `ok` | 1,028 | 1 → 2 |

5/6 条正文读取成功，1/6 未确认。成功内容已写入既有 article/body 与 revision 字段；该函数不解析或覆盖文章标题，因此验证结论仅为“数据库标题字段前后不变”，没有独立比较详情 `ArticleTitle`。

未确认条目是金融司《2026年中央财政支持普惠金融发展示范区绩效考核情况的公示》。首次调用时 `extractFromUrl()` 的具体失败原因没有保存；它会将网络异常、非 200/HTML 响应和 Readability 未达到 200 字阈值统一返回为 `null`，`extractArticleBody()` 只保存 `body_status=unconfirmed`。首次失败当时的原因仍为 **unknown**。

Lead 批准的额外单次只读诊断 GET 当前返回 HTTP 200，`Content-Type=text/html`，14,704 字节，URL 无重定向；HTML 的 `title` 与 `ArticleTitle` 均与数据库标题相同，`PubDate=2026-06-08 16:29:00`。使用相同本地 `readable()` 得到 `null`。页面正文容器中可见的正文段落共约 158 字（111+32+6+9），另有“附件下载”链接，指向 `https://jrs.mof.gov.cn/gongzuotongzhi/202606/P020260608599408762517.pdf`。因此当前 HTML 响应的短正文低于 200 字阈值；页面另提供考核结果 PDF 附件，其内容尚未核验，诊断未请求 PDF。它提供了本次不可提取的直接证据，但不能追溯证明首次未确认时收到完全相同的响应，故原始失败原因仍如实标为 unknown。诊断 HTML 保存在忽略目录 `.data/fiscal-qa/unconfirmed-article.html`；诊断摘要由 `.data/fiscal-qa/diagnose-finance-unconfirmed.ts` 输出，不包含正文文本。

## 数据库交叉核验

- 这 6 篇首批样本当时为 5 `ok`、1 `unconfirmed`；后续 24 篇结果见下节，当前 30 篇累计为 28 `ok`、2 `unconfirmed`、0 `pending`。5 篇首批成功文章由 revision 1 到 2，首批 6 篇 DB 标题字段均未变化、`processing_state` 均为 `new`。
- 首批 6 篇调用前后 pg-boss 队列计数完全不变；第二批 24 篇执行前后亦相同。当前只有 30 个未消费 `content.extract-body` jobs，没有 `content.analyze` jobs。`receipts=0`、`lb_models=0`。正文 helper 不消费队列，也不安排模型分析。
- 首批 SQL 汇总保存在 Git 忽略目录 `.data/fiscal-qa/body-evidence.txt`；首批脚本 `.data/fiscal-qa/extract-body-check.ts` 固定 6 个 article ID 并在状态不是 pending 时停止。额外诊断只请求首批一篇的单个 URL，原始结果保留于 `.data/fiscal-qa/`；没有再次尝试该 extraction 或 PDF。

## 剩余 24 篇正文验证（2026-09-29）

在同一隔离库中，对原先仍为 `pending` 的 24 篇（每源 8 篇）逐篇调用现有 `extractArticleBody(id, false)` 一次。预检确认全部为 `web_list`，source 保持 disabled、全文开关关闭，`x_post IS NULL`，URL 均匹配对应官方 HTTPS `allowUrlPrefixes`。未处理前 6 篇已完成项，没有重试；无 API、worker、模型、Jina 或通知。调用前后 30 个 `content.extract-body` job 均为 `created`，计数未变化；没有 `content.analyze`，`receipts=0`、`lb_models=0`。

| Source ID | 数据库标题 | Article ID | 结果 | 正文字符 | revision |
|---|---|---|---|---:|---:|
| `mof-finance-notices` | 财政部关于结算2024年度中央财政农业保险保费补贴资金和下达2025年第二笔中央财政保... | `orydrpmipm1u5jisvy6ege3eo` | `ok` | 1,321 | 1 → 2 |
| `mof-finance-notices` | 关于修订金融企业财务快报有关事项的通知 | `h8x0z9hr51yeylqz8uvj3wye6` | `ok` | 2,016 | 1 → 2 |
| `mof-finance-notices` | 财政部关于编报2025年度金融企业财务决算报表（证券类）的通知 | `dtcsyk344wcalnytqabpzbj17` | `ok` | 3,397 | 1 → 2 |
| `mof-finance-notices` | 财政部关于编报2025年度金融企业财务决算报表（金融资产管理公司类）的通知 | `kxqu5bcbs7eii5gq69xddmcz2` | `ok` | 4,046 | 1 → 2 |
| `mof-finance-notices` | 财政部关于编报2025年度金融企业财务决算报表（保险类）的通知 | `ncsqau30rghzhh6ad95ppwr6i` | `ok` | 3,934 | 1 → 2 |
| `mof-finance-notices` | 金融企业财务快报系统25版 | `sfz58qc6jd7t83eohtop1ihlg` | `unconfirmed` | 0 | 1 → 1 |
| `mof-finance-notices` | 财政部关于编报2025年度金融企业财务决算报表（担保类）的通知 | `tik0q1sv73gc0dmjx3dwqowvs` | `ok` | 3,680 | 1 → 2 |
| `mof-finance-notices` | 财政部关于编报2025年度金融企业财务决算报表（金融控股公司、金融投资运营公司及其他金... | `zxxrwq7v9hwwqa42wvt19r7ps` | `ok` | 4,373 | 1 → 2 |
| `mof-policy-release` | 财政部关于中国福利彩票发行管理中心停止销售“联合销售15选5”等9款游戏的审批意见 | `aenxikeolige8onh72oshzufp` | `ok` | 814 | 1 → 2 |
| `mof-policy-release` | 财政部关于中国福利彩票发行管理中心发行“四方有喜”等19款即开型福利彩票游戏的审批意见 | `ye515dk780ltkvvf2tv847993` | `ok` | 674 | 1 → 2 |
| `mof-policy-release` | 财政部 自然资源部 税务总局关于进一步完善矿业权出让收益征收有关工作的通知 | `aqdo8sedq43hcqzghd60ouled` | `ok` | 1,064 | 1 → 2 |
| `mof-policy-release` | 财政部关于下达2026年中央专项彩票公益金支持地方社会公益事业发展资金预算的通知 | `mcpgip4w6nw8n2gflizkl9mdn` | `ok` | 1,037 | 1 → 2 |
| `mof-policy-release` | 财政部关于国家体育总局体育彩票管理中心发行“体育力量 中国精神”等15款即开型体育彩票... | `fijzurvqkb1tmhgd1lsrc2ouk` | `ok` | 707 | 1 → 2 |
| `mof-policy-release` | 财政部关于印发《中央专项彩票公益金支持地方社会公益事业发展资金管理办法》的通知 | `qn1rp884fmgohbrgs7r578tni` | `ok` | 259 | 1 → 2 |
| `mof-policy-release` | 财政部关于中国福利彩票发行管理中心停止销售中国福利彩票东方6+1游戏的审批意见 | `mi4p7jzr6uh4r23q3zokug5g6` | `ok` | 671 | 1 → 2 |
| `mof-policy-release` | 财政部关于下达2026年彩票市场调控资金预算的通知 | `yp7404niw90fsxtt6rq34rbol` | `ok` | 897 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年6月地方政府债券发行和债务余额情况 | `mx0abmgij7cj4cpm9puvhk2hw` | `ok` | 1,002 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年5月地方政府债券发行和债务余额情况 | `eme94rn2t82kco6hapm2q6cj4` | `ok` | 1,258 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年4月地方政府债券发行和债务余额情况 | `prd2e2cm39r6385su9q00ahl6` | `ok` | 1,233 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年3月地方政府债券发行和债务余额情况 | `dykq4u85sghnzhdk7398pwj82` | `ok` | 1,223 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年2月地方政府债券发行和债务余额情况 | `hxo5e3yyqyfdp56tt609buxt7` | `ok` | 1,215 | 1 → 2 |
| `mof-treasury-debt-data` | 2026年1月地方政府债券发行和债务余额情况 | `bgb1chuad4prjkr9qje6rl04d` | `ok` | 851 | 1 → 2 |
| `mof-treasury-debt-data` | 2025年12月地方政府债券发行和债务余额情况 | `m8ub5roo12h5gdvbepraccfw6` | `ok` | 1,339 | 1 → 2 |
| `mof-treasury-debt-data` | 2025年11月地方政府债券发行和债务余额情况 | `iwbveeperf4p8etmwpfulh0ce` | `ok` | 1,141 | 1 → 2 |

这批 24 篇为 23 `ok`、1 `unconfirmed`。新的未确认项是金融司《金融企业财务快报系统25版》，详情 URL 为 `https://jrs.mof.gov.cn/gongzuotongzhi/202512/t20251212_3979075.htm`。和此前那篇金融司未确认一样，首次 extraction 没有持久化网络状态或失败原因；本轮没有额外诊断 GET，故其原因仍为 **unknown**，不能归因于 PDF 或短正文。

合并最初 6 篇后，30 篇最终状态为 28 `ok`、2 `unconfirmed`、0 `pending`：金融司 8 `ok`/2 `unconfirmed`，财政部综合政策 10 `ok`，国库司 10 `ok`。所有成功项 revision 从 1 到 2；两条未确认项保持 revision 1。30 篇仍为 `processing_state=new`，三个来源仍 disabled、全文开关关闭；30 个 extraction job 未消费，未排入 analysis job，receipt/model 记录均为 0。

这一组结果显示 30 篇官方 HTML 样本中 28 篇达到现有正文门槛。它不能证明全来源正文质量、附件覆盖或分页稳定性；此前金融司绩效公示的单次诊断只证明当前响应中约 158 字的 HTML 被 200 字阈值过滤，并提供一个尚未读取的 PDF 链接，原首次失败原因依然 unknown。人民银行 OMO 第191号已知正文约 162 字，也低于同一阈值；福建厅列表已有两个 PDF 项目记录。上述都是 Gate 2 仍未解决的边界，不能据此推断所有短文都依赖 PDF，也没有在本轮下载或解析 PDF。

复核摘要和每篇进度保存在 Git 忽略目录 `.data/fiscal-qa/remaining-body-start.json`、`remaining-body-progress.jsonl`、`remaining-body-result.json`，一次性受限脚本为 `.data/fiscal-qa/extract-remaining-body-check.ts`。它固定本轮 24 个 ID，先验证安全开关、数据库名、状态、类型、source disabled、allow prefix 与 X 字段，再逐篇调用一次；若状态已变化会停止，避免重复请求。**这批直接存储验证**未改变生产代码、数据库 schema、来源配置或 200 字阈值，也没有下载或解析 PDF；随后 AD-009 另行实施了共享正文 helper 与离线 PDF PoC（见下节）。Gate 2 仍未通过。

## AD-009 共享正文 selector 与离线 PDF 文本 PoC

本节记录代码验证边界，不改变上面 30 篇的数据库结果。新增的 `detail.bodySelector` / `detail.allowShortBody` 是显式 source 配置；同一个严格 helper 被 `fetchDetail()` 与 `extractArticleBody()` 共用。配置前提为人工核验的唯一正文容器，以及详情 `ArticleTitle`、日期与列表/已存条目一致。导航/空容器、仅链接内容和含未解析 PDF 附件的正文候选会被拒绝；普通外链不会被自动跟随。选择器失败只记录 article/source ID 和固定原因，不写正文、headers 或原始响应。未配置 selector 的 source 仍走既有 Readability 路径，200 字阈值不变。当前人民银行 OMO 配置仍 disabled；本地 HTML 快照使用 `#zoom`、短正文显式 opt-in 离线通过，不代表运行 collector 或公开正文。

离线 PDF PoC 固定 `pdfjs-dist@6.3.289`（Apache-2.0），从 Node legacy API 读取**调用方已持有的字节**；模块不接收 URL、不下载附件、不启用 OCR，也不启动应用 worker。单次解析运行于独立子进程，使用 192 MiB V8 old-space 参数、10 秒墙钟时限、6 MiB 输入、40 页、120,000 字符、1 MiB stdout 上限，并在超时或输出超限时杀死子进程且等待 `close` 后释放串行槽。每页必须有文本；混合扫描页、扫描件、加密、坏 PDF 与超限输入均拒绝为未确认。返回文本按 PDF 视觉行序排列，同时保留每页的 x/y spans，避免仅扁平化全文后失去列的位置。

Windows 本地 Node 24 实测金融司官方 66,740 B、1 页 PDF，返回 314 字和 19 个坐标行；对照页面坐标/列锚点逐格复核了 4 个业务行的 4 列（东部、中部/东北、西部、计划单列市），福建省/厦门市等值落在预期档次列。福建厅官方 178,333 B、4 页代表扫描 PDF 返回 `pdf_page_no_text`；没有把下载成功当成正文成功。单元测试覆盖合成文本 PDF、加密/损坏/空页/混合扫描页、页/字节/文本/输出上限、超时杀进程、并发串行及超时后下一次解析恢复。PDF.js 官方 FAQ 对 Node 22+ legacy 路径的描述是 Mostly、自动测试 Limited；此处仅 Windows 本机验证，Linux/NAS、部署环境硬 RSS 限额仍未验证，V8 old-space 不是 RSS 上限。

当前 PDF helper 仍为离线独立模块，尚未把 PDF 附件正文接入 `fetchDetail()` / `extractArticleBody()` 的生产材料存储流程。还未完成生产组合中的 HTML 与 PDF 段落组织、附件标题/URL保存、部署 Linux 与容器内存限制验证，也未将全页 PDF 链接检测改为可跟随附件区域 selector。因此此项仅是有界 PoC，不是 Gate 2 验收或附件 coverage；所有来源仍 disabled，模型/Jina/通知/采集开关关闭。
