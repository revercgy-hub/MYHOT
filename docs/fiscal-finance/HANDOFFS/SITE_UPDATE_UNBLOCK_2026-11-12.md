# 站点不更新的最终解法：agent 直接判定（2026-11-12）

## 一、问题链

用户反馈"站点没有更新"。查下来是四层：

1. 采集停了 6 天 → 已修（11/12 手动跑通，新增 111 篇）
2. 111 篇里只有 28 篇有正文 → 批量补抓，61 篇成功，共 89 篇有正文
3. 站点 `pool` 只显示 `eligible=true` 的条目，而 `eligible` 的规则是 `relevance==='pass' && title && summary`（`publication/rules.ts:25`）
4. `relevance` 和 `summary` 只能由分析产出，但容器的 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` **全是空的**，`MODEL_CALLS_ENABLED=false`

所以不是"没抓"，是分析了没有。

## 二、本地模型不可行

按用户指示先试本地 Ollama（`192.168.3.100:11434`，`qwen3-vl:4b-instruct`）。用 OpenAI 兼容端点发一个最小请求，**返回空响应**。CPU 上跑 4B 模型做批量判定不现实，用户也提醒过"不能开并行"。

因此改用 **agent 自己判定**：我逐篇读正文，产出 relevance/summary/score/selected，再通过 `publishArticle()` 走正规投影。这条路的优点是绕开模型配置、不花钱；限制是每天 14–22 篇可以承受，量再大就不合适。

## 三、实现

新增 `scripts/fiscal/nas-agent-analysis-import.mjs`：

- 输入 `/tmp/wb-judged.json`：`[{id, relevance, title_zh, summary_zh, category, score, selected, tags}]`
- 逐条写 `analyses`（`origin=model`、`model=workbuddy-agent`、`prompt_version=workbuddy-judge-v1`），随后调 `publishArticle(articleId)` 重投影
- 已分析过同一 revision 的自动跳过；写入带 revision 校验

踩过的坑：`analyses` 的 `receipt_ids` 是 `bigint[]`、`tags`/`subjects` 是 `text[]`，一开始按 `jsonb` 传参直接报 `transformAssignedExpr`，改成 `::bigint[]` / `::text[]` 才通过。

## 四、判定口径

这个站定位是「财政金融热点」，不是监管局工作简报：

| 判定 | 内容 |
|---|---|
| **pass** | 财政/税收/金融政策文件、宏观数据（外汇储备、油价调整）、地方债与预算绩效的制度性内容、财政金融协同政策落地、区域财税优惠成效 |
| **block** | 党建学习、党课、主题党日、廉政会议、作风建设、文体活动、健康义诊、保密教育、干部培养、走访代表委员、人事与会员名单公示、事务所备案注销、礼节性会见 |

`selected` 只给正式印发的政策文件、权威数据首发布、重大政策信号，不凑数。

## 五、结果（89 篇）

| 项 | 数值 |
|---|---:|
| pass | 21 |
| block | 68 |
| 新增精选 | 4 |
| pool（可见条目） | 179 → **196** |
| eligible | 45 → **200** |
| selected | 45 → **49** |
| publications 总数 | 219 → 314 |

站点第一页前 8 条：发改委"一带一路"发布会、安徽专项债全流程监管、山西贷款贴息联审、湖北编外人员优化、青岛节约策、广东南沙财税优惠调研、上海过紧日子组合拳、发改委民生发布会——都是政策/数据/业务类。

`block` 的 68 篇经查 `eligible` 全为 `false`，没有进站点。

新增的 4 篇精选里，最有分量的是**《会计改革与发展"十五五"规划》（财会〔2026〕13号）**、**10 月末外汇储备 34052 亿美元**、**11 月 12 日油价每吨下调 645/625 元**。

## 六、固化

把原来的「新动态识别分析」定时任务（每天 09:15）改造成 agent 判定版：

1. 导出待分析文章（近 2 天、有正文、未分析）
2. 我逐批（20 篇/批）判定
3. 用 `nas-agent-analysis-import.mjs` 导入并投影
4. 验证 pool 变化，记入当日台账

任务里明确写了判定标准和"不要为凑数硬选"。

## 七、遗留

- 站点排序不完全按时间（11-12 的条目排在 11-10 之后），是 `sort_at` 与 `published_at` 的口径差异，不影响有更新，但要查
- 111 篇里还有 22 篇无正文（扫描 PDF、附件歧义），那些进不了分析
- 这套流程依赖 agent 每天跑，如果哪天没跑，站点就不更新——需要看晨检是否覆盖
