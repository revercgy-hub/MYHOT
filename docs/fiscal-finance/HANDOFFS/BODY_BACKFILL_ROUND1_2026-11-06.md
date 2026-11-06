# 正文补全第一轮：11 篇回写完成，53 篇卡在来源配置（2026-11-06）

用户口径：不跑 NAS 本地模型，由 WorkBuddy 直接处理；稳定后再改成定时任务。

## 一、结果

| 项 | 回写前 | 回写后 |
|---|---:|---:|
| 10/27 以来有完整正文 | 202 | **213** |
| 缺正文 | 64（pending 57 + unconfirmed 7） | **53（pending 46 + unconfirmed 7）** |
| publications / selected | 179 / 45 | 179 / 45（不变） |

11 篇全部 `revision 1→2`、`body_status=ok`，正文长度 297–1805 字。走的是官方 CAS 写入口径 `applyCandidateBodyCas`（校验整行快照、revision、content_hash、body 长度与双哈希，不符即整批回滚），不是裸 SQL。

回写前备份：`/vol2/1000/docker/fiscalhot-pre-bodycas-20261106.dump`，2,694,696 字节，SHA256 `aed9afa481fc4f1dc1a003accb4475e07a11208818b698466dc4b8c5ff974bde`，mode 600。

## 二、链路实测：每一步都被挡，挡的原因各不相同

```
64 篇缺口
 └─ 11 篇通过来源闸门（其余 53 篇连抓取都进不去）
     └─ 抓取 11 个详情页，11/11 成功
         └─ 官方解析器：4 proposals + 7 holds（选择器拒收）
             └─ 我直接读原始 HTML 抽正文：11/11 成功
                 └─ CAS 回写：11/11 成功
```

关键事实：**抓取全部成功，官方解析器只认了 4 篇**。7 篇被拒的理由是 `non_article_container`、`short_body_not_allowed`、`identity_mismatch`——页面本身没问题，是配置里的正文容器选择器对不上。

我逐篇核对过抽出来的文本：11 篇都是对的文章（标题里被面包屑拆开导致我第一版身份探针误判了 3 篇，实际内容都对得上）。这反证了**不是来源失效，不是网络问题，是选择器问题**。

## 三、53 篇为什么补不了：来源配置硬条件

`nas-pending-body-batch.ts` 的 `validatePendingTarget` 要求来源同时满足：`enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`、DB 配置与 catalog 完全一致、且 `detailConfigIsDirectHtml` 为真。最后一条要求：

- `kind === "web_list"`
- 有 `bodySelector` 和正整数 `maxFetches`
- **不能有** `mode`、`pdfDirect`、`attachmentSelector`、`attachmentScopeSelector`、`attachmentMode`、`articleSelector`、`bodyPolicies`
- **必须有** `titleSelector` 或 `titleRegex`，**且** 有 `publishedAtSelector` 或 `publishedAtRegex`

逐个核对 13 个相关来源：

| 来源 | 缺口 | 结论 | 具体缺什么 |
|---|---:|---|---|
| 财政部广西/海南/深圳/安徽监管局、财政部政策发布 | 11 | **已补** | — |
| 财政部福建监管局 | 4 | 阻塞 | 缺 `titleSelector` / `titleRegex` |
| 财政部厦门监管局 | 6 | 阻塞 | 缺 `titleSelector` 与 `publishedAt` 选择器 |
| 财政部陕西监管局 | 4 | 阻塞 | 配置含 `bodyPolicies`，不在允许范围 |
| 财政部·各地监管局动态（汇总） | 15 | 阻塞 | 汇总页无正文容器，需二次跳转策略 |
| 中国政府网·部门政策文件 | 11 | 阻塞 | 走 GovCN 专用判定，要求已批准的 catalog 哈希匹配，当前不匹配 |
| 福建省财政厅·通知公告 | 2 | 阻塞 | 缺 `publishedAt` 选择器 |
| 人民银行厦门市分行 | 1 | 阻塞 | 缺 `titleSelector` 与 `publishedAt` 选择器 |
| 厦门市财政局·地方政府债务 | 3 | 阻塞 | 含 `attachmentMode` / `articleSelector` |
| 其余（7 篇 unconfirmed） | 7 | 阻塞 | 状态不是 pending，`validatePendingTarget` 直接拒 |

**所以 53 篇里，真正只差"补两个选择器"的是 17 篇（福建 4 + 厦门 6 + 福建财政厅 2 + 人行厦门 1 + 陕西 4）**；15 篇汇总页和 11 篇政府网属结构性，需要单独策略；7 篇 unconfirmed 要先查清状态来源。

## 四、下一步（按性价比排序）

1. **给 5 个来源补 `titleSelector` / `publishedAtRegex`**（17 篇受益）。这是配置改动，不碰代码逻辑，改完跑 `detailConfigIsDirectHtml` 单测即可验证，然后再走一次同样的 prepare→capture→解析→CAS。这是最快的 17 篇。
2. **厦门财政局债务 3 篇**：移除 `attachmentMode`/`articleSelector` 或走附件通道，单独定。
3. **汇总页 15 篇**：需要"列表→详情二次跳转"策略，属功能级改动，要新写采集分支。
4. **政府网 11 篇**：catalog 哈希不匹配，需重新走一次已批准流程，且多为 PDF/分页，属独立课题。
5. **7 篇 unconfirmed**：先查清为什么不是 pending，再决定补正文还是标记放弃。

## 五、定时任务暂不启用补正文

原因：今天这条链只有 11/64 走通，算不上稳定。把真实 GET 放进每日任务，在来源配置还没修好的情况下，每天只会重复撞同样的闸门，白白产生请求。

建议顺序：先做完第 1 步（17 篇），再观察一到两轮，确认 prepare→capture→CAS 全通且无 hold，再把"增量补正文"并入 09:15 的识别分析任务。

现有三个每日任务维持不变（08:40 晨检 / 09:15 识别分析 / 18:40 日结），识别分析仍然只产候选、不自动发布。

## 六、证据位置

| 文件 | 说明 |
|---|---|
| `.data/fiscal-qa/since1027-20261106/captured-r1/responses/` | 11 个原始响应（含 gzip 解码后字节，共 200 KB） |
| `.data/fiscal-qa/since1027-20261106/extracted-r1.json` | 11 篇抽取结果（正文、原文 sha256、长度） |
| `.data/fiscal-qa/extract-captured-bodies-20261106.mjs` | 抽取脚本（去 script/style、取 `<p>` 段落） |
| `.data/fiscal-qa/write-bodies-cas-20261106.mjs` | CAS 回写脚本 |
| NAS `/vol2/1000/docker/fiscalhot-pre-bodycas-20261106.dump` | 回写前备份 |
| NAS `/tmp/wb-gap-r1.json`、`/tmp/wb-gap-cap-r1/` | prepare 清单与抓取证据（容器内，重启即失） |
