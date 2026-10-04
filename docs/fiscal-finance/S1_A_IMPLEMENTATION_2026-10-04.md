# S1 A 实现交接（2026-10-04）

TASK=实现 S1 批准的首次严格日期窗口及附件待解析自动门禁；不代表 Gate 2 已通过。

MODEL=Luna High。

## 实现

首次导入使用 `_aihot.initialBackfillRequirePublishedAt` 严格布尔 opt-in。现有 12 个行业 disabled source 配置为 `true`，保留 3 个月窗口、每日 1440 分钟轮询及原有禁用状态。首次导入只在固定 run 时点计算滚动 90 天 cutoff；权威详情日期配置会让有界候选进入既有详情预算，最终在写入前使用 `decideTimeline` 验证实际发布日期并执行窗口门禁。缺省/false 和后续增量路径保持原逻辑。

新增 `packages/backend/src/content/attachment-diagnostics.ts`，将白名单诊断保存在 `articles.raw._aihotBodyExtraction`。附件链接仅来自 extractor 实际返回的 HTTP(S) 证据；`attachments_unprocessed` 表示已有可信提取器拒绝的实际文件证据，不宣称该链接必然是业务附件。原始 `null`、object、array、scalar 和 reserved-key collision 均通过 ingress escaping 保留。内部 `_aihotBodyExtractionPipelineMarker: true` companion 让读取端只接受受控写入的诊断；set 可更新同一条诊断，clear 会移除两个内部状态并在需要时保留已 escape 的原始值，不会让上游伪 marker 重新成为 pipeline 状态。

web-list detail 与单篇抽取共享诊断构造和 PDF/附件证据。材料入口在同一事务保存 marker 并同步 publisher 投影；同 hash 的 marker 变化不会因“内容未变”提前丢失。只有可信、已配置附件 driver 的完整正文成功才清除已有 marker；普通重抓失败、无附件 driver 的 Readability/Jina 成功或普通材料更新不会解除它。清除会强制 revision +1 并写入实际正文历史，令旧分析 revision 失效。

自动队列路由、直接 analyze/process、已有 analyze job、sweeper、failed-job requeue 和 groupArticle 直接入口均检查附件 hold。sweeper/requeue SQL 同时核对 companion、version、state、kind，并用 `COALESCE` 让普通 `raw IS NULL` 记录维持原有 eligibility。groupArticle 检查仅读并以 `skipped` 返回，不写聚类状态。未知附件 reason 不入诊断白名单；人工 `attemptTag` 不绕过门禁。

FILES_CHANGED（A-owned）：

- `industry/sources.json`
- `packages/backend/src/sources/config-keys.ts`, `collect.ts`, `web-list.ts`
- `packages/backend/src/content/attachment-diagnostics.ts`, `materials.ts`, `selected-body.ts`, `pdf-body.ts`, `extract.ts`
- `packages/backend/src/editorial/input.ts`, `analyze.ts`
- `packages/backend/src/jobs/content.ts`, `packages/backend/src/events/group.ts`
- `tests/attachment-diagnostics.test.ts`, `content-jobs-attachment-gate.test.ts`, `materials.test.ts`, `analyze.test.ts`, `events.test.ts`, `pdf-body.test.ts`

行业 sources 配置只增加批准的 strict flag；没有启用 sources，也没有修改行业业务选择规则。没有新增 migration、apps/API/UI、公开合同、OCR、模型、下载格式或调度器。Git index 和 commit 未改动。

## 验证

TESTS_RUN=`npm run typecheck`，通过。

TESTS_RUN=`node --test tests/attachment-diagnostics.test.ts`，通过 4/4，覆盖白名单、unsafe URL 拒绝、原始 JSON 类型 round-trip、reserved marker/companion forged input、重复 set 后 clear，以及无附件证据不造诊断。

TESTS_RUN=`DATABASE_URL=postgres://postgres@127.0.0.1:5432/fiscalhot_s1_attachment_final_test node --test --test-concurrency=1 --test-timeout=120000 tests/attachment-diagnostics.test.ts tests/materials.test.ts tests/analyze.test.ts tests/events.test.ts tests/content-jobs-attachment-gate.test.ts tests/fiscal-extract-diagnostics.test.ts tests/selected-body.test.ts tests/pdf-body.test.ts`，通过 53/53。测试 DB 为本机 `postgres@127.0.0.1:5432` 上新建的 `_test` 数据库；应用迁移为仓库既有 35 项，无新增 migration。模型测试均由本地假 provider 应答；extract 测试仅使用本地 fixture/loopback，并在 finally 中恢复私网设置。无真实模型、官方网络或生产 DB 请求。

QA 附加 focused 检查：90-day collector/source-config cases 12/12 通过；publication attachment guard/read cases 17/17 通过。二者分别覆盖 bounded authoritative detail 日期规则与 companion-aware read SQL；仍不等同 full-suite 核销。

QA 正确环境的首次 full run 暴露 `tests/x-shards.test.ts` 一项顺序断言失败：测试期望按传入 `IDS` 顺序组成 query，而 `collectXShard` 的 `WHERE id IN (...)` 查询未规定 SQL 返回顺序。该路径与本次日期筛选无关，之前实现 diff 未改此 query；失败由既有的无序 DB 结果与顺序敏感断言共同触发。按 Lead 批准，在成员 SELECT 增加 `ORDER BY id`，与 `planXShards` 的稳定 id 顺序一致，不改分片策略或测试期望。fresh `_test` DB 的 `tests/x-shards.test.ts` 6/6 通过；根 typecheck 通过。QA 需在最终共享工作树重新跑 full suite。

测试证实：raw-null 普通记录仍可被 sweeper/requeue；pending marker 在这些入口保持阻断；direct analyze、attemptTag/process、groupArticle 不产生 provider 请求；相同 hash 的 marker 会落库，普通更新不会清除，可信成功以新 revision 清除。既有 PDF/selected-body 分类矩阵通过。

RESULT=A 实现及 focused 检查完成，代码交 QA 做全套 fresh regression；来源未运行，Gate 2 未核销/未通过。

RISKS=尚无真实行业源运行证据。PDF 区域关系不明时，诊断保守记录实际提取器观察到的链接并阻止自动精选，但不把链接描述为已确认业务附件。当前 focused tests 分别验证提取证据、材料事务和自动入口；不把它们表述成真实 source end-to-end 验收。

BLOCKERS=没有已知 S1 A 实现 blocker。x-shard 顺序修复后 QA fresh full regression 待重跑；须等结果完成集成核销。

NEXT=等待 QA 对最终共享工作树执行 typecheck、fresh migrations、full tests/build 与发布读路径回归；由 Root/QA 核销 S1。不要启用 source 或运行 worker/model。
