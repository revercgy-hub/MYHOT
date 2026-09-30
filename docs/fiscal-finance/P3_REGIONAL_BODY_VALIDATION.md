# 财政部各地监管局来源 P3 正文提取复核

验证日期：2026-09-30（Asia/Shanghai）

隔离数据库：`fiscalhot_regional_p3_test`

状态：两条固定官方文章均经现有 `extractArticleBody(id, false)` 成功提取并写入隔离库；这只确认本轮两个样本，不代表 Gate 2 通过或来源可上线。

## 安全边界与执行范围

执行前只读检查确认数据库恰有两个目标来源和各一篇固定文章；来源均为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。两篇文章均为 `body_status=pending`、`revision=1`，正文为空。所有运行安全旗标明确为 false：`COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`、`JINA_BODY_FALLBACK`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED`、`ALLOW_PRIVATE_NETWORK_FETCH`；Jina key/base URL 为空，凭据目录指向不存在的 `.data/no-real-credentials`。未启动 worker、collector、模型、Jina 或发布/推送流程。

代码核查确认每次目标调用经 `extractArticleBody(id, false)` 到 `extractFromUrl()` 的普通 HTML 分支只发起一次 `guardedFetch`，限制为 20 秒、6 MiB；`allowJina=false`，没有 selector、PDF 或附件配置。`guardedFetch` 在初始请求以及每个 3xx 的下一个 URL 上都重新执行公网 URL 和 DNS 检查；最多 5 次重定向，即最多 6 个 HTTP hop/次调用。此前严格的“新增最多 2 个 HTTP 请求”无法在调用前保证，故本轮按已批准修订口径：两次调用合计最多 12 个新 HTTP hops；连同前一验证报告记载的 9 次请求口径，预算上限为 21。实际 hop 数由 Undici diagnostics 逐请求观察，不能把 helper 调用数等同于 hop 数。

本次只调用两次，每篇一次，不重试。Undici diagnostics 实际记录 2 个 GET hop：两个原始 URL 各一个，均 HTTP 200、无 Location、无重定向、无请求错误；未超时。每篇实际 332ms / 248ms，均低于 20 秒。没有额外访问网络。前一 collector 验证报告将 8 次 fetch 机器记录与另 1 次中央预检人工计数合计为 9；其中 collector 请求没有逐跳日志，因而历史重定向 hop 数不能从该报告独立还原。本次观察不补作历史 hop 断言。按原报告计数加本次实测计数，本轮记录口径合计 11/21。

## 正文和数据库结果

| 来源与样本 | HTTP | 正文状态变化 | 正文字数 | 正文 SHA-256 | 内容抽样判断 |
|---|---:|---|---:|---|---|
| 广西监管局“‘四个聚焦’推进国有金融资本产权登记监管提质增效” | 200，1 hop | `pending/rev1` → `ok/rev2` | 1,720 | `36b00746d87361f5706f6f3be5a9eee0200e3e380a93417fd4cd549fddff55d0` | 首尾均为国有金融资本产权登记监督、制度落实、穿透核查、问题闭环等连续业务段落；无菜单/页脚噪声。 |
| 厦门监管局“强化财金协同 深化精准监管 助力普惠金融高质量发展” | 200，1 hop | `pending/rev1` → `ok/rev2` | 1,935 | `fce18a043f7159dc4a03bf80553906e628a612022d93985b8214760f4b905f24` | 首尾均为普惠金融、财政金融运行分析、贴息审核、政策效果与经营主体等连续业务段落；无菜单/页脚噪声。 |

写入后两条文章均新增 revision 2，其 revision hash 与当前文章 `content_hash` 一致；前后 `published_at` 未变化。正文首尾各抽样 400 字，完整可检查文本长度、SHA-256、修订记录和真实 hop 信息保存在忽略文件 `.data/fiscal-regional-collector-validation/body-validation.json`。未保存或写入任何原始响应正文到本跟踪文档。

数据库前后 source/article 数均为 2，fetch_runs 均为 4；analyses、receipts、publications、reports、stories 均保持 0。两个 `content.extract-body` jobs 均保持 `created`、`retry_count=0`、未启动且未完成；这两次正文提取由直接函数调用完成，没有消费 job。来源的停用和全文许可关闭状态保持不变。

## 运行器异常与范围

首次尝试用 `pnpm exec tsx` 启动时，pnpm 警告仓库只声明 npm workspaces，并自行将一些 npm 安装的依赖移入 `node_modules/.ignored`，随后因未找到 `tsx` 退出；该次在 runner 执行前结束，没有访问数据库或发出网络请求。自动生成的未跟踪 `pnpm-lock.yaml` 已删除。之后使用仓库 Node 24 的原生 TS 类型剥离功能执行同一有预检的 runner，才发出上述两次已授权的正文请求。检查后 Git 工作区没有残留 pnpm lock 文件；`node_modules` 属忽略目录，未纳入变更。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：在隔离 P3 库中，对两个固定官方文章各执行一次现有 `extractArticleBody(id, false)`，确认真实正文写入和内容质量。

**MODEL**：gpt-6-luna / high；运行时模型、采集、Jina、推送及私网开关均关闭。

**FILES_CHANGED**：新增本文；新增忽略的 `.data/fiscal-regional-collector-validation/body-validation.json`。未改 collector 报告、STATUS、PROJECT_PLAN、来源配置、应用包或在线 preview。

**TESTS_RUN**：只读安全预检、代码路径/逐跳 URL-DNS guard 检查、两篇一次性正文提取、Undici HTTP-hop 记录、数据库前后 SQL 核验及正文首尾抽样。没有运行 worker、collector、模型或全量测试。

**RESULT**：两篇均通过一次 GET（各 HTTP 200、无重定向）并写入真实正文，状态 `ok`，修订号 2；正文分别 1,720 / 1,935 字，抽样内容与标题主题一致且无明显导航噪声。两源仍 disabled/fulltext=false，分析、收据、发布和精选等表无新增记录。

**RISKS**：这只覆盖两篇固定 URL。正文原始 HTML 未留存；可审计证据包括实际 hop 元数据、数据库中的正文哈希/长度/修订记录及首尾片段。此前 9 次请求口径包含一笔人工计数，且旧 collector 记录没有逐跳日志，历史真实 hop 数不能被本轮倒推。初次 `pnpm exec` 造成被 pnpm 管理的忽略依赖目录调整；命令未执行 runner，未发网络请求或数据库写入，生成 lock 已清除。

**BLOCKERS**：无本轮提取阻塞；Gate 2 所需的更多来源/文章、历史分页、重复率和跨周期稳定性证据仍未完成。

**NEXT**：handover agent 可据此更新 P3 checkpoint/STATUS，保留“两个样本正文确认、Gate 2 未通过”的边界；不要消费遗留两个 job 或在在线 preview 库验证本结果。
