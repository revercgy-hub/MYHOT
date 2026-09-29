# 福建、厦门来源只读结构复核

核验时间：2026-09-29。方式：对官方列表、单篇详情和明确的分页/API 地址作直接只读 HTTP 请求并在本地解析返回内容；未运行 worker，未调用 Jina 或模型。来源负责人随后将厦门证监局 JSON 源加入矩阵并以项目 `fetchJsonList()` 验证 20 条；当前源仍 disabled。矩阵记录最终配置状态。

## 结果概览

| 来源 | 列表与详情 | 分页/覆盖 | 正文与风险 |
|---|---|---|---|
| 福建省财政厅通知公告 | 列表 200；当前配置 selector 命中静态第一页 5 条，最新 2026-09-29。文章详情 200，`meta[name=PubDate]` 与 `span.article_time` 可用。 | HTML 内含 22 个 `div.list_base_date_01` 区块、共 108 个条目；区块以 `ms-visible="$showStatic(1/6/11… )"` 分页组形式预渲染。当前配置锁定 `$showStatic(1)`，不会读到后续存档。不要删掉分页组条件扩大成全部 `div.list_base_date_01 li`：存档混有会计考试、采购、网站报表等非财政金融事项。 | 两个当前第一页项目链接为 PDF；Range 请求返回 `206 application/pdf`。没有本地 PDF 提取依赖；`JINA_BODY_FALLBACK=false` 时应保留未确认正文，不触发付费 Reader。泛用 `denyUrlPrefixes` 只有 `startsWith`，无法按 `.pdf` 后缀匹配所有附件；若要彻底排除附件需加明确的通用规则或逐条已知前缀，不能假设现有字段支持 glob。HTML 样本 Readability 正文 629 字；处罚告知样本 421 字。 |
| 厦门市财政局地方政府债务 | 列表 200，`div.list_base_date_01 li` 命中 15 条；最新 2026-09-11，最旧 2026-05-08。详情 200，标题/链接吻合，`span.article_time` 为 `2026-09-11 16:02`。 | 页面内未发现分页链接或分页脚本；当前静态页仅覆盖 15 条，是否还有更旧存档入口需另查。 | 抽取样本正文长度 205 字，刚超过统一 200 字门槛；末尾仍带站点兼容性文字，近阈值短文应列入验收样本。列表标题与 `title` 属性目前均完整。 |
| 人民银行厦门市分行工作动态 | 首页 200，`td:has(> span.newslist_style)` 命中 20 条；样本详情 200，`meta[name=ArticleTitle]`、`meta[name=PubDate]` 和正文一致。 | 首页显示共 663 条、34 页。下一页控件无可直接 `href`，其 `onclick` 调用 `queryArticleByCondition` 并给出 `/xiamen/127699/17318-2.html`；直接请求该静态 URL 返回 200、相同 selector 命中 20 条。当前 `web_list` 配置只抓第一页。 | 列表确有标题截断：2026-09-11 手册条目的可见文本在“正式发…”处省略，但链接 `title` 属性为完整“正式发布”。可用新接口 `titleAttribute: "title"` 修复。样本详情 Readability 518 字；正文内也链接 DOC/PDF 附件，但列表候选 URL 是 HTML 文章，不会将附件当成单独候选。 |
| 厦门证监局监管工作 | 首页 `https://www.csrc.gov.cn/xiamen/` 返回 200，`div.szyw-lists li` 命中 7 项，首页最新日期只到 2026-09-15；“加载更多”链接进入 JS 列表壳。该壳 200/约 9.7 KB，但没有文章条目。`/xiamen/xhtml/js/common_list.js` 指向官方 JSON 搜索 API；来源负责人通过项目 `fetchJsonList()` 验证已配置的 JSON 源。 | API 第 1、2 页都返回 200 JSON。第 1 页 `data.total=399`、20 条，含 2026-09-28 最新项；来源负责人复核第 2 页回溯至 2024-12-09。API 是可用的列表源；collector 当前不自动翻页，配置 page 1 只能持续读最新 20 条。 | API 项有 `title`、`url`、`publishedTime`（epoch 毫秒）、`publishedTimeStr`、`content`、`contentHtml`。epoch 字段换成 UTC 后比字符串墙钟时间早 8 小时；项目 `fetchJsonList()` 使用 `publishedTimeStr` + `publishedAtUtcOffset=+08:00` 验证解析 20 条。最新详情 200，Readability 951 字。另一条 API 时间为 2026-09-15 12:43，详情 meta `PubDate` 却是 2026-09-23 17:33，正文/首页/API 字符串日期均为 09-15；矩阵选择列表公布日作候选日期并保留冲突记录。 |

## 厦门证监局 json_list 核验配置

以下是当前已加入 `industry/sources.json` 的配置摘要。它保持 `enabled=false`，见 `SOURCE_MATRIX.md` 的正式字段记录。

```json
{
  "id": "xiamen-csrc-regulatory-work",
  "name": "厦门证监局·监管工作",
  "kind": "json_list",
  "config": {
    "url": "https://www.csrc.gov.cn/searchList/ffe0f9a9de42484cb218be2fd18116d0?_isAgg=false&_isJson=true&_pageSize=20&_template=index&_rangeTimeGte=&_channelName=&page=1",
    "itemsPath": "data.results",
    "titlePaths": ["title"],
    "summaryPaths": ["content"],
    "publishedAtPath": "publishedTimeStr",
    "publishedAtUtcOffset": "+08:00",
    "urlTemplate": "https:{raw:url}",
    "allowUrlPrefixes": ["https://www.csrc.gov.cn/xiamen/c101757/"]
  }
}
```

API 详情字段检查：`data.results[0]` 标题“政策引领创新突破 厦门辖区债券市场融资呈现新亮点”，`publishedTime=1790548212000`（`2026-09-27T22:30:12.000Z`），`publishedTimeStr="2026-09-28 14:30:12"`（解释为 `+08:00` 后为 `2026-09-28T06:30:12.000Z`，相差 8 小时），`content` 为约 944 字文本，URL 为 `//www.csrc.gov.cn/xiamen/c101757/c7661505/content.shtml`。配置读取 `publishedTimeStr` 并显式设 `publishedAtUtcOffset`；归一化模板保持 `https:` 前缀，allow 前缀只收监管工作栏目文章。API 页面参数固定为 `page=1`；当前通用 JSON collector 没有 cursor/pagination 配置，因此仅覆盖最新 20 条，P3 需评估两次采集间隙是否可能超过 20 条。

## 对应 parser 修正

- 列表配置现可选 `titleAttribute: "title"`；仅显式设置时属性优先，否则保持过去的可见文本优先顺序。
- `web_list` 无时区日期默认按 `+08:00` 严格解析。`json_list` 现可显式设 `publishedAtUtcOffset`，仅用于未指定 `publishedAtUnit` 的字符串；显式 `Z`/offset 保留原瞬间，配置 epoch 或 `yyyymmdd` 单位时 offset 不改时间。未设 offset 的 JSON 来源继续使用旧解析行为。
- 安全示例配置将 `JINA_BODY_FALLBACK=false`，避免 PDF 等无法直接识别的正文请求外部 Reader。
