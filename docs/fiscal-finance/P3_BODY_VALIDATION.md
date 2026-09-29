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

- 三个源仍为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`；30 篇总状态为 5 `ok`、1 `unconfirmed`、24 `pending`。
- 5 篇成功文章各从 revision 1 到 2，产生 5 条正文 revision；未确认文章仍是 revision 1。6 篇 DB 标题字段均未变化；6 篇 `processing_state` 均为 `new`。
- 调用前后 pg-boss 队列计数完全不变：只有 30 个未消费 `content.extract-body` jobs，没有 `content.analyze` jobs。`receipts=0`，`lb_models=0`。正文 helper 不消费这 30 个既有 job，也不安排模型分析。
- SQL 汇总保存在 Git 忽略目录 `.data/fiscal-qa/body-evidence.txt`；复跑脚本 `.data/fiscal-qa/extract-body-check.ts` 固定这 6 个 article ID，且会在状态不是 pending 时停止，防止重复请求。额外诊断只请求上述一篇的单个 URL，原始结果保留于 `.data/fiscal-qa/`；没有再次尝试 extraction 或 PDF。

本轮没有降低 200 字阈值、改动生产 parser/schema 或 source 配置。OMO 公告近阈值短正文、金融司首次失败原因的历史不确定性、剩余 24 篇正文、分页和长期稳定性仍需在后续 P3 分别处理；Gate 2 仍未通过。
