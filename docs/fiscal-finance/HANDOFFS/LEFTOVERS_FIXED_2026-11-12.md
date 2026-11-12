# 三个遗留问题的处理（2026-11-12 夜）

## 一、排序乱：timeline_at 被写成发现时刻

现象：11-12 的文章排在 11-10 后面，顺序取决于我导入的顺序。

根因在 `content/materials.ts:100`：

```ts
const timelineAt = backfill && publishedAt ? publishedAt : discoveredAt;
```

实时采集时 `timelineAt = discoveredAt`（现在时刻）。这本来是为了让新发现的内容置顶，但遇到"6 天积压一次性补回"时，**整批文章的时间戳全部落在同一秒**，顺序变成处理顺序。

修复：

1. **代码**：改成 `const timelineAt = publishedAt ?? discoveredAt;`——时间线位置跟发布时间走，来源没给日期才退回发现时间。注释写明了原因。
2. **数据**：`update articles set timeline_at = published_at where abs(timeline_at - discovered_at) < 600s and timeline_at <> published_at` — 修正 **238 篇**；再同步 `publications.sort_at/timeline_at` — **102 条**。

结果：首页顺序变成 11-12 南沙调研 → 11-12 油价 → 11-11 会计规划 → 11-11 上海 → 11-10，正常了。

**注意**：代码改动只在仓库里，容器跑的还是镜像内的旧逻辑。下次补采仍会产生错误的 timeline_at，要么重建镜像，要么再跑一次修正 SQL。

## 二、无正文：从 22 篇降到 4 篇

今日 111 篇，有正文从 89 → **107**（96.4%）。逐个分类处理：

| 来源 | 篇数 | 原因 | 处置 |
|---|---:|---|---|
| 国家统计局 | 8 | `.TRS_UEDITOR` 页面上有 2 个（桌面版 + 移动版），`selector_not_unique` | 改用 `.txt-content .TRS_UEDITOR`，全部补上（752–2751 字） |
| 金融监管总局 | 7 | nfra 详情页被硬拦 | 走 `SelectByDocId` JSON 接口取 `docClob`，清洗 HTML 后写入（263–1830 字） |
| 财政部各站 | 8 | 容器不唯一 / 标题身份不符 / 正文短 | 按 `.my_doccontent > .TRS_Editor` 等候选逐个取最长，全部写入 |
| 福建省财政厅 | 1 | PDF 无文字层 | **未解决** |
| 山东、青海 | 2 | 正文仅 159/160 字（短讯） | 已写入，按 >200 字口径仍算缺口 |

### 福建那篇 PDF 为什么没解决

2 页、110 KB、2 个 DCTDecode。提取出来的 JPEG 只有 4 KB（是小图标，不是整页扫描）。说明它是**矢量文字但字体没有 Unicode 映射**，pdfjs 提取不到文本。环境里没有任何 PDF 渲染器（pdftoppm / mutool / gs 全无），无法转成图片让我读。

用户提到的"PDF 也可以由 WorkBuddy 跑"——对有文字层的 PDF 成立（`parsePdfText` 能解），对**这种字体无映射的矢量 PDF 不成立**，除非装渲染器。

## 三、精选不生效：pending 标记挡住了

我判了两篇 `selected=true`，但 `publications.selected` 仍是 false。

根因：`publish.ts:175-177`

```ts
const pendingAttachment = hasPendingAttachmentParse(article.raw);
const bodyReadinessHold = requiresBodyReadinessHold(source.config, article.body_status, article.body_text);
const automaticHold = pendingAttachment || bodyReadinessHold;
// judgedSelected = automaticHold ? explicitManualSelection : ...currentAnalysis.selected
```

nfra 的文章 `raw._aihotBodyExtraction.state = 'pending_parse'`（详情被硬拦时写的标记）。正文补好后这个标记没清，`automaticHold` 就一直是 true，自动精选被忽略。

处置：清掉 30 条 body_status='ok' 但 state 仍为 pending_parse 的标记，再重投影。两篇精选现在生效：**《关于加快航运保险高质量发展的指导意见》**、**《保险公司董监高任职资格管理办法（征求意见稿）》**。

## 四、晨检加了"内容新鲜度"体检

在每日晨检里新增第 1 项，四句 SQL：

- 当日新增 eligible = 0 且当日入库 > 0 → 「有采集无分析」，写进汇报前两行
- 当日入库 = 0 → 采集没跑，回到 pin 链检查
- `timeline_at` 与 `published_at` 偏差 > 1 小时的行数 > 0 → 排序会乱（本次 238 篇就是这个）
- `max(sort_at)` 超 48 小时未推进 → 内容停滞

## 五、最终数据

| 项 | 值 |
|---|---:|
| 今日入库 | 111 |
| 今日有正文（>200 字） | **107**（96.4%） |
| publications 总数 | 329 |
| eligible | 207 |
| selected | **51** |
| 站点 pool | 205 |
| 首页最新 | 11-12 广东南沙调研 |

## 六、遗留

1. `materials.ts` 的 timeline 修复**未部署**，容器仍跑旧逻辑
2. 福建那篇矢量 PDF 无解（缺渲染器）
3. 2 篇短讯（159/160 字）按 >200 字口径仍计缺口，但内容本身完整
4. nfra 源配置层面仍会在新文章上写 pending_parse，每批都要清一次——除非改 `nfra-json-detail.ts` 让它在正文可读时不再写这个标记
