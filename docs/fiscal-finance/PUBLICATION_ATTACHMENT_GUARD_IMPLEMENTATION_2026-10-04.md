# S1 附件待解析 publication guard 实现记录（2026-10-04）

TASK=S1 发布与读取层最小实现；不是 Gate 2 核销或来源通过结论。

BASE_HEAD=ea5d3af0d8241772ea6fac0abcc26386d81c6d36（Lead 指定本轮基线）。

## 实现

- `publish.ts` 从文章当前 revision 与原始诊断标记读取状态。自动精选遇到 `pending_parse` 时关闭，显式 `editorial_overrides.fields.selected` JSON boolean `true` 可按原有 pool/tier/visibility 条件通过；`false`、字符串 `"true"` 和其他字段覆盖不会放行。待解析时清空推荐理由、正文模式设为摘要，并不排入首次精选通知或媒体准备。只使用与文章当前 revision 相等的分析结果，防止成功解析后重用旧 analysis。
- `items.ts` 在统一 publication 读取投影中重新检查当前 marker 与精确人工布尔覆盖。SQL 与 helper 共用 marker/provenance key 检查，pipeline provenance 必须是 JSON boolean `true`；列表、pool、timeline、feed、detail 与 v1 items 不会因旧 publication 缓存继续显示自动精选；待读时现有 summary 字段显示“正文待解析”，自动分数/理由不泄漏，正文模式退为摘要。
- `detail.ts` 使用现有 body projection 显示“正文待解析，请访问原文查看。”，保持原 `readingMode` 与公开 schema，不输出内部 reason/raw，也不把提示伪装为抓取正文。
- `v1.ts` 的 snapshot 联查当前文章状态，排除当前被 marker 阻断的历史 upsert。changes 保留原 ledger 序号、limit、cursor 与 watermark；marker 阻断或 `selected_state.in_set=false` 时将旧 upsert 映射为同序 remove（payload 为空），原 remove 行仍按原序返回。当前精选历史 upsert 仍正常返回；普通撤下历史用例证明同步返回旧序号 remove 与原 remove。快照与变化读取不改写 ledger 或 `schemaVersion`。
- Marker 成功清除后，publisher 只接受新文章 revision 对应的 analysis；在新 analysis 出现前维持非精选状态，snapshot 也因 `selected_state.in_set=false` 不会恢复旧精选。

## 验证

使用新建隔离 PostgreSQL 库 `fiscalhot_oct04_publication_test`，由 `scripts/migrate.ts` 应用 35 个迁移；没有使用 preview/production 数据库。进程级 `DATABASE_URL` 仅指向该测试库，COLLECT、MODEL、JINA、Feishu push 与 IndexNow 开关关闭，未运行 worker/provider。

- `node --test --test-concurrency=1 tests/publication.test.ts`：17/17 通过。新增用例覆盖自动精选撤下、详情/pool/v1/snapshot/changes 默认和 minimal 读取、limit=1 分页继续消费旧 upsert 与真实 remove、清 marker 后旧 revision analysis 不复用、当前精选历史上推保留及普通撤下保护，以及人工标题/摘要、字符串 true、false 与布尔 true 的区别。Helper companion provenance key 接入后复跑仍为 17/17。
- `npm exec -- tsc -p packages/backend`：通过。
- `npm exec -- tsc -p tests`：通过。
- `git diff --check`（本次五个 owned 文件）：通过。

FILES_CHANGED=本任务 owned：`packages/backend/src/publication/publish.ts`、`items.ts`、`v1.ts`、`detail.ts`、`tests/publication.test.ts`、本报告。共享区其他并行改动不属于本任务。

TESTS_RUN=上述 publication tests、backend 与 tests TypeScript checks、owned diff-check。无生产 DB、网络、worker 或真实模型调用。

RESULT=publication implementation focused checks pass；等待独立 QA。此实现不代表 Gate 2 通过。

RISKS=changes 对被当前状态撤下的历史 upsert 会重复发出同序 remove 及 ledger 的真实 remove；remove 对客户端是幂等的，原序号与分页边界保留。待解析标签复用 summary/detail body 字段，未扩展 apps/API schema。

BLOCKERS=需 QA 审查完整并行 diff 与 fresh 全套验证；本轮不自行 stage/commit。

NEXT=QA 核对后按 Root 的独立核销计划执行区域监管局 batch 2；只调查天津、河北、山西、内蒙古，不编辑 source config，不判来源通过。
