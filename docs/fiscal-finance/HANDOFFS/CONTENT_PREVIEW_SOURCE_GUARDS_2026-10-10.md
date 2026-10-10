# 2026-10-10 内容预览与来源护栏交接

## 本轮结果

用户授权的开发交付覆盖三项：本机预览的 robots 元数据、厦门地方债详情身份与附件待解析判断、浙江“监管工作”page 2 的四条列表/URL 日期差异。全部 source 仍 disabled，`site_fulltext=false`、`syndicate_fulltext=false`；Gate 2 与 P4 权限未改变。

预览根布局现在从 root loader 取 `localPreview`，并在 `<head>` 始终保留 `noindex, nofollow`。这能让 `/all` 的叶路由 metadata 以及 root metadata API fallback 失败时继续带 noindex。QA 在冻结工作树完成 focused cache 10/10、Web tests 16/16、typecheck 与 Web build；日志位于 ignored `.data/fiscal-qa/local-preview-noindex-qa-20261010/`。最新只读监听检查显示 `127.0.0.1:3000` 与 `127.0.0.1:3001` 都没有 listener；本轮没有启动服务或发起 live 页面 GET，因此本机 HTTP header 仍未核验。

`xiamen-finance-debt` 的配置现在用已保存详情中实际标题和日期位置核对列表身份，并将附件扫描限制在 `.article_component`。独立 QA 对 `.data/fiscal-source-audit/details/xiamen-finance-debt.html`（15,640 B，SHA-256 `19a2f94d976ad7a077c7c1789e0fbb40159bb8d9d35ec843c521b713b3468a08`）复核：标题和 `2026-09-11 16:02` 日期可识别，组件内有一个 PDF。helper 因 `attachments_unprocessed` 返回 body null，`requiresBodyReadinessHold=true`；source 仍 disabled。旧 205 字符假正文未改，没有请求 PDF，也没有 database、collector、worker 或模型操作。focused `tests/selected-body.test.ts` 为 9/9，typecheck 与 `git diff --check` 通过。

浙江保存 page 2 的四条新增详情 GET 均为一次直连请求，attempted/dispatched/rejected=`4/4/0`，无 redirect、retry、附件请求。列表日期、详情 `PubDate` 与页面可见日期分别一致：

| URL 日期 token | 列表与详情中国日期 | 正文抽取 | 响应 SHA-256 |
|---|---|---:|---|
| 2026-07-23 | 2026-07-29 | 1,390 字 | `56f6847c2579ca240ed180c8f981e6bdb02df05395d319f0b553dd42d2b06917` |
| 2026-07-07 | 2026-07-21 | 1,264 字 | `f193ebdf351bd587b624a29c3920edcbb8c7e8db5e949f00e75dd8ce1ce890d3` |
| 2026-06-23 | 2026-07-09 | 2,312 字 | `47a55704e3189dd36984f473d43abd170f9e74b8d7f109d634f2dbdad44629eb` |
| 2026-02-02 | 2026-06-30 | 1,203 字 | `85828f965ae831ea08d82afed4f5ef4274f0ecc47d86fd445c1e1c35c9603586` |

四份 raw 与 manifest 核对通过；独立离线 QA 从保存 page 2 重解析10行，确认四个目标URL、题名、列表日期以及详情 `PubDate`/可见日期对应。历史已保存的第五个疑点是 2026-08-04 URL token、列表/详情日 2026-08-11，证据仍属于 10/09 的旧批 `.data/fiscal-qa/zhejiang-date-detail-20261009/`；本轮新增 HTTP 只有以上四次，未覆盖旧材料。不能由五条配对推断全源日期规则、完整历史/90日覆盖、跨周期稳定性或来源准入。四条本轮详情 manifest 在 `.data/fiscal-qa/zhejiang-date-detail-20261010/` 与 `.data/fiscal-qa/zhejiang-date-details-20261010/`。

## Git 与 CI

预览代码提交 `79ec9ed165e868f19de951d1606a5b19f06e8021` 仅含 `apps/web/app/root.tsx` 与 `apps/web/tests/cache.test.ts`；来源提交 `3de96df641b08c817ba2dfea032ca9254399e66d` 仅含 `industry/sources.json` 与 `tests/selected-body.test.ts`。组合 SHA 已推送到 `origin/feat/fiscal-finance-hot`。Check workflow 仅 push `main` 自动触发，因此对组合 SHA 单次 dispatch run `38036049523`；精确 `headSha=3de96df641b08c817ba2dfea032ca9254399e66d`，Check 与 Docker 均 completed/success。Check涵盖install、typecheck、Web build/tests、migrate/seed、built-site smoke和backend tests；Docker涵盖compose build与smoke。CI built-site smoke不替代本机live页面GET。

### TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：保护本机预览 noindex；修正厦门债务正文身份/附件 hold；核对浙江 page 2 四条日期差异。

**MODEL**：派发使用 GPT-6 Luna/high；未调用项目 provider、receipt 或付费模型。

**FILES_CHANGED**：代码仅上述四文件；文档为本 handoff、`STATUS.md`、`SOURCE_MATRIX.md`、`REGIONAL_BUREAU_COVERAGE_MATRIX.md`、`P3_LOCAL_PREVIEW.md`。没有 schema、数据库或source enable/full-text变更。

**TESTS_RUN**：cache focused 10/10、Web 16/16、typecheck、Web build；selected-body 9/9、typecheck、diff-check；浙江 raw/hash、列表候选及详情日期/标题/正文离线独立 QA。GitHub run `38036049523` 对精确组合SHA的Check与Docker均成功。

**RESULT**：四条 page 2 URL-date token 差异经详情核对后都以列表/详情页面日期一致收敛；厦门附件没有被写成正文 ready；preview 根布局在 leaf metadata/fallback 时保留 noindex。

**RISKS**：单条或分页样本不证明源级日期权威、内容质量、完整覆盖或 source admission；本机 live noindex 尚未通过 HTTP 观察。

**BLOCKERS**：API 和 Web 当前均未监听；实际 provider 按用户选择 deferred；人工 Gold 标签和事件分组/切分待领域人员。

**NEXT**：本阶段代码、QA、CI与交接已完成。后续live页面验证需用户手动分别启动API与Web；不自行操作服务。
