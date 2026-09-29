# Collector 解析边界与验证记录

日期：2026-09-29。此审计追踪四源 preview 暴露的标题、日期、PDF 与短正文行为，以及 Sol 批准的最小 parser 修复。实现限于已批准的通用 `sources/` parser 能力、测试、`docs/sources.md` 和安全示例环境；没有超出批准范围修改 apps/packages、数据库 schema、worker、正文提取阈值或 PDF 解析。Gate 2 尚未通过。

## 已核实的来源边界

- 人民银行公开市场第191号公告正文容器约 162 字，低于 Readability 的 200 字阈值，因此提取为 `null`、preview 显示 **0 字符**；页面本身有短正文。相邻第190号公告正文容器约 204 字、Readability 210，说明例行公告长度在阈值附近波动。保持过滤/待确认行为，不降低阈值。
- 财政部会计司代表文章列表日期为 2026-09-21，详情 `PubDate` 为 2026-09-22，相差 **1 天**。时间口径需要 P3 核查，不能通过 parser 把一方强行覆盖。
- 福建财政厅首屏 5 项中有 2 项是 PDF。HTML 正文提取器没有 PDF parser；安全示例将 `JINA_BODY_FALLBACK=false`，此设置不会自动跳过附件。当前附件仍待 P3 处置。
- 12 个重点入口中仍有 3 个未进入来源配置：国务院政策文件库/中国政府网、地方债信息公开平台、金融监管总局。阻塞依据和每个已配置源的一次性证据以 `SOURCE_MATRIX.md` 为准。
- 本地厦门财政详情正文为 205 字，刚高于通用 200 字门槛且包含站点尾部文字；预算司一次 preview 有一篇低于门槛。短正文仍需 P3 样本核验，不新增 source 级门槛。
- 一次性 source preview 和 `fetchJsonList()` 验证不等于稳定采集验收。十个来源全部 `enabled=false`、站点全文和 RSS 全文转发关闭。

## 已批准并实现的最小修复

1. `web_list` 可选 `titleAttribute` 白名单。显式配置时，parser 优先使用所选标题元素的该属性；属性缺失/为空时沿用可见文本，再沿用旧 link title 回退。未配置时保持旧行为。厦门人民银行源可用它取回被截断的完整标题。
2. 日期 parser 移到纯模块 `sources/date.ts` 并由 `web-list.ts` 继续导出以兼容现有导入。无时区的严格 ISO、斜线及中文日历日期按 source offset 解析，web list 默认 `+08:00`；严格校验真实日历日、闰年、时间和偏移。带 `Z` 或数值时区的日期保留其绝对瞬间，其他旧格式保留原有兼容解析。
3. `json_list` 增加可选 `publishedAtUtcOffset`。仅在明确配置、值为字符串且没有 `publishedAtUnit` 时用于无时区日期；显式带时区日期保留原瞬间，epoch 和 `yyyymmdd` 单位处理优先且不受 offset 改写，未配置时维持旧 `Date.parse` 行为。
4. `.env.example` 将 `JINA_BODY_FALLBACK=false` 作为安全默认，`docs/sources.md` 记录上述配置和日期语义。没有加入 PDF parser、`minBodyChars`、新迁移或 apps/packages 变更。

## 验证

- 离线 parser tests 覆盖标题属性优先/回退、严格日历与非法日期、显式时区、非默认 offset、不同进程 `TZ`、JSON epoch/`yyyymmdd` 优先级及未配置兼容行为。
- 完整 `npm test` 在隔离 `fiscalhot_collector_test` 数据库上通过 132/132；35 项迁移通过。仅测试子进程启用 `MODEL_CALLS_ENABLED=true` 并使用本机 mock provider；没有运行 worker 或真实模型调用。
- `npm run typecheck`、`npm run build -w @aihot/web`、`node --test apps/web/tests/*.test.ts`（11/11）通过。
- 本地 loopback smoke 通过 30 项。API 绑定 `127.0.0.1:3301`，Web 绑定 `127.0.0.1:3300`；独立 smoke DB，采集、模型、Jina、IndexNow 与飞书通知均关闭，无 worker。API/Web 和本地 PostgreSQL 已停止。
- 本文记录 P3 的事实和最小改动，不代表 Gate 2 批准，也不代表分页、去重、正文完整性或长期稳定性已通过。
