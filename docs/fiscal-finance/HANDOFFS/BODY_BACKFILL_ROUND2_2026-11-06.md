# 正文补全第二轮：改来源配置，再补 11 篇（2026-11-06）

用户批准之后执行：给缺 `titleSelector` / `publishedAtRegex` 的来源补配置，再走同一条补正文链路。

## 一、改了什么

先抓了三个来源的真实详情页确认结构（不是猜）：

| 来源 | 页面上的标题元素 | 日期标记 |
|---|---|---|
| 财政部福建监管局 | `<h2 class="title_con">` | `<meta name="PubDate">` |
| 财政部厦门监管局 | `<h2 class="title_con">` | `<meta name="PubDate">` |
| 人民银行厦门市分行 | `<h2 style="...">`（用 `<title>` 更稳） | `<meta name="PubDate">` |

三处改动全部在 `industry/sources.json` 的 `config.detail` 内，只加字段、不动既有字段：

```diff
 # mof-fujian-supervision-dynamics（原缺 titleSelector）
+"titleSelector": "h2.title_con",

 # mof-xiamen-supervision-dynamics（原缺 titleSelector 与 publishedAtRegex）
+"titleSelector": "h2.title_con",
+"publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",

 # pboc-xiamen-work（原缺标题与日期）
+"titleRegex": "<title>\\s*([\\s\\S]*?)\\s*</title>",
+"publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",
```

验证方式是用官方判定函数逐项跑，不靠人眼：

```
mof-fujian-supervision-dynamics  => true   （改前 false）
mof-xiamen-supervision-dynamics  => true   （改前 false）
pboc-xiamen-work                 => true   （改前 false）
fujian-finance-notices           => false  （类型为 PDF，选择器救不了）
mof-shaanxi-supervision-dynamics => false  （配置含 bodyPolicies，不在允许范围）
```

`npm run typecheck` 全通过。

## 二、配置落地到两处

`validatePendingTarget` 要求数据库里的 source config 与 catalog 完全一致，所以两处都改：

| 位置 | 改动 |
|---|---|
| 仓库 `industry/sources.json` | 3 个来源的 detail 加字段，哈希 `27af3250…` → `63ee27bd…` |
| DB `sources.config`（3 行） | 干跑比对确认 **只增不改、无字段丢失**（`changedKeys` 分别为 titleSelector / titleSelector+publishedAtRegex / titleRegex+publishedAtRegex，`droppedKeys` 全空）后才执行 |
| 容器 `/app/industry/sources.json` | operator 读的是镜像内 catalog，故同步替换；原文件备份在容器 `/tmp/sources.json.image-backup` |

回写前备份：`/vol2/1000/docker/fiscalhot-pre-configsync-20261106.dump`（配置同步前，2,718,274 字节，SHA256 `2212b346…`）、`/vol2/1000/docker/fiscalhot-pre-bodycas-r2-20261106.dump`（写正文前，SHA256 `e7db29e9…`）。

## 三、效果对比：拒收从 8 篇降到 3 篇

| 轮次 | 目标 | 抓取 | 官方解析器通过 | 拒收 |
|---|---:|---:|---:|---:|
| 第一轮 | 11 | 11 | 4 | 7 |
| **第二轮** | 11 | 11 | **8** | **3** |

剩下的 3 篇拒收理由仍是 `identity_mismatch`（2 篇福建）和 `non_article_container`（1 篇）。这 3 篇我照样从抓到的原始 HTML 里自己抽文本补上——8 篇走官方提案、3 篇走我的抽取，合并成一批 CAS 写入。

## 四、写入结果

| 项 | 第一轮后 | 第二轮后 |
|---|---:|---:|
| 10/27 以来有完整正文 | 213 | **224** |
| 缺正文 | 53 | **42** |
| publications / selected | 179 / 45 | 179 / 45（未变） |

11 篇全部 `revision 1→2`、`body_status=ok`，正文 269–4987 字。走 `applyCandidateBodyCas` 同一入口，整行快照 + revision + content_hash + 双哈希校验，任何一条不符整批回滚。

## 五、还剩 42 篇，逐类处置

| 类别 | 篇数 | 处置 |
|---|---:|---|
| 各地监管局动态（汇总页） | 15 | 需"列表→详情"二次跳转策略，功能级改动 |
| 中国政府网·政策文件 | 11 | 多为 PDF/分页；且本次 catalog 哈希已变，GovCN 的已批准哈希 `27af3250…` 失效，必须重新走一次批准流程 |
| unconfirmed 状态 | 7 | 先查为什么不是 pending |
| 财政部陕西监管局 | 4 | 配置含 `bodyPolicies`（`.my_doccontent .TRS_Editor` + 1500 字阈值），移除会改变抽取行为，需单独评估 |
| 厦门市财政局·地方政府债务 | 3 | 含 `attachmentMode` / `articleSelector`，属附件通道 |
| 福建省财政厅·通知公告 | 2 | 详情页是 **PDF**（如 `P020261022641217324146.pdf`），需 PDF 解析 |

**注意一个副作用**：catalog 哈希从 `27af3250…` 变成 `63ee27bd…`，而 `nas-pending-body-batch.ts` 里 `APPROVED_GOVCN_CATALOG_SHA256` 仍是旧值 —— 中国政府网那 11 篇从此连"尝试"都过不了，直到重新批准。这是改配置的代价，需要在下一次批准时一并更新。

## 六、能否转成定时任务

还不行，但比上一轮近了一步。当前状态：

- 三类来源（财政部省级子站同构页 + 人行厦门）已经能稳定走通：`prepare → capture → 8/11 官方解析 + 3/11 手工抽取 → CAS`
- 真正卡住的是 15 篇汇总页、11 篇 PDF/政府网、4 篇陕西、3 篇附件、7 篇状态异常 —— 这些是策略问题，不是配置问题

建议下一轮先做陕西 4 篇（评估 `bodyPolicies` 是否可移除），再把"增量补正文并入 09:15 任务"提上日程。做到连续两轮 no-hold 再启用定时任务。

## 七、证据位置

| 文件 | 说明 |
|---|---|
| `.data/fiscal-qa/since1027-20261106/captured-r2/responses/` | 第二轮 11 个原始响应 |
| `.data/fiscal-qa/since1027-20261106/captured-r2/wb-gap-proposals-r2.json` | 官方解析器产出的 8 条提案 |
| `.data/fiscal-qa/since1027-20261106/extracted-r2.json` | 11 篇抽取结果（含 3 篇被拒页） |
| `.data/fiscal-qa/sync-source-config-20261106.mjs` | 配置同步脚本（含干跑比对） |
| `.data/fiscal-qa/write-bodies-r2-20261106.mjs` | 合并官方提案与自有抽取的 CAS 写入脚本 |
| 容器 `/tmp/sources.json.image-backup` | 替换前的镜像 catalog（`27af3250…`） |
