# 加源可行性预检（2026-11-08）

用户批准"加源"。本文是预检结果与加源的真实成本，**没有改动任何源配置**。

## 一、先说结论

**加源不是加一行 JSON。** `daily-latest` 采集器把源清单和 catalog 哈希都写死在代码常量里：

```ts
// scripts/fiscal/nas-candidate-batch.ts:45
const DAILY_LATEST_ADDITIONAL_SOURCE_IDS = Object.freeze([...26 个 id...]);

// :56
export const DAILY_LATEST_PRESET = Object.freeze({
  catalogSha256: "27af3250…",
  appCatalogSha256: "27af3250…",
  maxDispatches: 76,
  sourceIds: Object.freeze([...SUMMARY_DRAFT_SOURCE_IDS, ...DAILY_LATEST_ADDITIONAL_SOURCE_IDS]),
```

而且第 155 行明确禁止外部覆盖：`daily-latest preset does not accept scope overrides`。所以新源不加进这个常量，采集器根本不会抓。

## 二、预检方法（两步，因为猜 URL 全错）

第一轮直接猜栏目 URL，20 个里 **13 个 404**。原因是各省财政厅的栏目路径毫无规律。

第二轮改成：先打**首页**（域名规律稳定），从首页导航里找含"通知公告/政策文件/公告公示"的链接，再验证该栏目的列表。结果正常。

第三轮验证**详情页正文容器**——这一步不能省，否则加了源也抓不到正文（前几轮 8 篇的教训）。

## 三、验证到正文层、可直接加的源（5 个）

列表与正文都实测通过：

| 源 | 栏目 | 列表条目 | 正文容器 | 正文字数 | PubDate |
|---|---|---:|---|---:|---|
| 天津市财政局·通知公告 | `/zwgk_53713/tzggx/` | 24（20 带日期） | `.content` | 650 | 有 |
| 陕西省财政厅·通知公告 | `/sy/bmdt/tzgg/` | 21（20 带日期） | `.content` | 461 | 有 |
| 北京市财政局·通知公告 | `/zwxx/tztg/` | 12（12 带日期） | `.view` | 373 | 有 |
| 江苏省财政厅·公告公示 | `/col/col77314/` | 6 | `#zoom` | 1687 | 无 |
| 中国证监会·新闻发布 | `/csrc/c100028/` | 18（18 带日期） | `.content` | 1018 | 有 |

## 四、列表可用、正文容器待定的源（6 个）

列表能取到条目，但抽到的第一条不是文章页（多数是栏目导航），正文容器为 0：

| 源 | 问题 |
|---|---|
| 广东省财政厅·通知公告 | 首条链接指向 `/zdlyxxgk/index.html`（栏目页），需按 URL 日期模式筛选 |
| 广东省财政厅·政策文件 | 同上 |
| 河南省财政厅·通知公告 | 首条是 `2026/11-05/xxxx.html`，抽取逻辑未匹配 |
| 重庆市财政局·公告公示 | 同上 |
| 四川省财政厅·通知公告 | 列表无日期列，日期需从详情页取 |
| 湖北省财政厅·通知公告 | 首条跳到政务服务平台，非文章页 |

这 6 个不是不可行，是**列表页取链接的规则要按站点定制**，需要逐个调。

## 五、明确不可行（本轮不碰）

| 源 | 原因 |
|---|---|
| 国家金融监督管理总局·政策法规 | 页面是 JS 渲染壳，4012 字节、0 条目，须走 JSON 接口 |
| 国家税务总局·政策文件 | 猜的 URL 404，且返回体是首页 |
| 国家发展改革委·政策发布 | 返回 54 字节，反爬 |
| 审计署·审计公告 | 列表结构特殊，只识别出 2 条 |
| 央行货币政策司 / 统计司 | 列表能取（18 / 58 条）但**都没有日期**，日期可能在详情页，需另测 |
| 12 个省级财政厅 | 首页可达但导航里没有标准的"通知公告"入口，须逐站分析 |

## 六、加源的真实链路（7 步 + 3 个 pin）

| 步 | 动作 | 风险 |
|---|---|---|
| 1 | 改 `DAILY_LATEST_ADDITIONAL_SOURCE_IDS` 加新源 id | 需同步调 `maxDispatches`（当前 76，每源至少 +1） |
| 2 | 改 `industry/sources.json` 加源定义 | catalog 哈希变化 |
| 3 | 改 `DAILY_LATEST_PRESET.catalogSha256` 与 `appCatalogSha256` | 两个哈希都要重算 |
| 4 | DB 插入 `sources` 行（enabled=false、site_fulltext=false） | 配置必须与 catalog 完全一致 |
| 5 | 更新 NAS 三个 pin：`tools/catalog.sha256`、`tools/app-catalog.sha256`、`tools/operator.sha256` | operator 文件变了，哈希必变 |
| 6 | 重建镜像并部署（`DEPLOY_SHA`） | 容器内 catalog 要变成新版 |
| 7 | 跑一次采集验证新增源有产出 | 7 天窗口会重扫 |

**这正是 11-06 事故的同类风险点**：第 5-6 步任一漏做或顺序错，就是 `API_SOURCE_CATALOG_DRIFT` 或 `OPERATOR_HASH_MISMATCH`，采集直接停摆。所以这次必须整条走完，不能像上次那样只覆盖容器文件。

## 七、建议

**方案 A（推荐）**：先加已验证的 5 个源，走完整链路。预期每日新增从 14–22 篇提到 25–35 篇（按各栏目日均 2–4 篇估算）。

**方案 B**：先只加 3 个最稳的（天津、陕西、北京，正文容器都验证过且有 PubDate），降低单次发布风险。

**不建议**：跳过 operator 常量、用外部脚本单独抓这几个源。那样产出进不了统一管线，去重、证据链、发布投影全要重做，维护成本更高。

## 八、证据

| 文件 | 内容 |
|---|---|
| `.data/fiscal-qa/probe-candidates-20261108.mjs` | 第一轮：直猜栏目 URL（13 个 404） |
| `.data/fiscal-qa/probe-home-columns-20261108.mjs` | 第二轮：首页 → 导航 → 栏目 |
| `.data/fiscal-qa/probe-detail-selectors-20261108.mjs` | 第三轮：详情页正文容器 |
