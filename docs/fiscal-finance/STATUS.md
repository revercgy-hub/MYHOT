# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=6d0401dfa79ec6cccc475d12367b085c3247837a
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3 小范围真实 collector 验证进行中；P0、P1、Gate 1 完成，P2 首批来源配置与一次性 preview 完成
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集
REVIEW=Sol Gate 1 Review 已由 Lead 核销修复并通过；本轮 collector 日期/标题范围获 Sol AD-008 批准；未进行 Gate 2 Sol review
BLOCKERS=人民银行 OMO 第191号官方正文约 162 字，Readability 200 字门槛将其过滤为 null/preview 0（不是页面无正文；相邻第190号正文约 204 字、Readability 210）；会计司代表文章列表与详情日期差 1 天；福建厅首屏 2 个 PDF 未验证正文；厦门债务正文 205 字、预算司存在弱正文。12 个首批重点入口尚有 3 个因列表/动态能力证据不足未配置。一次性列表最新日：MOF 综合 2026-08-26、金融司 2026-07-16、国库司 2026-09-24，需结合栏目发布节奏复核 freshness；分页、长期去重仍需 P3 完整核验。隐私与使用条款模板需在正式发布前确认。

COMPLETED=P0 接管审计；财政金融分类、topic slug、机构/身份词典和主题语义；prompt KnowHow、首页/About、行业开关与品牌基础改造；Gate 1 通过。首批 10 个 source 配置均 disabled、全文转发关闭，9 个 HTML source 各有一次性 preview，厦门证监局 JSON source 经 `fetchJsonList()` 验证 20 条，证据见 `SOURCE_MATRIX.md`。collector 最小日期/titleAttribute 修复及离线测试完成。3 个官方 HTML source 在全新隔离 `_test` DB 上各执行两轮 collector：首轮每源写入 10 条，第二轮每源 10/10 已见且 created=0、revised=0；见 `P3_INGEST_VALIDATION.md`。`npm run typecheck`、35 项 migration、`npm test`（132/132）、web build、web tests（11/11）通过；loopback smoke 30 项通过。
IN_PROGRESS=P3 其余来源/详情正文质量、PDF 与短正文、列表分页及 freshness 核验；已入库 30 篇仍为 `body_status=pending`，仅有 30 个未消费的 `content.extract-body` jobs，不代表正文流水线通过。最后一次 collector 小修后的 sources focused tests 14/14、typecheck 与完整测试 132/132 通过。
NEXT=继续有上限的 P3 collector/正文验证，处理 OMO 无正文、会计司日期口径、PDF 与近阈值正文并核对来源分页；不得启动 worker、打开真实模型或大规模采集。Gate 3 前不校准精选门槛，Gate 4 前不部署 NAS Production。

`CURRENT_SHA` 是本状态记录时的代码 HEAD。提交状态文档后，最新文档 HEAD 以 `git rev-parse HEAD` 为准。

## 安全和验证环境

- `.env.example` 的采集、模型、IndexNow、飞书内容推送和飞书内部通知开关均为 `false`；Jina body fallback 也默认为 false。本地没有持久 `.env`。本轮受控 P3 仅在隔离 `_test` DB 上运行 6 次免费官方 HTML GET，不运行 worker、真实模型、付费 fallback 或通知。
- 全套 `npm test` 在测试子进程中临时设置 `MODEL_CALLS_ENABLED=true`，因为被测分析路径需要通过 provider 接口；每个相关 provider 都指向测试文件创建的 `127.0.0.1` HTTP stub，使用假 key。`COLLECT_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED` 均显式为 `false`。这只覆盖测试 mock，不打开真实模型调用。
- Windows 测试使用官方 EDB PostgreSQL 17.11-3 二进制，在被 Git 忽略的 `.data/test-pg/` 中的集群绑定 `127.0.0.1:5432`。本轮新建 `fiscalhot_collector_test`、`fiscalhot_smoke_test`、`fiscalhot_ingest_test` 三个隔离测试库，各自仅作本轮验证；35 项迁移成功。P3 测试库保存 30 篇 backfill 文章并保持三个来源 disabled，body jobs 未消费。API/Web 和 PostgreSQL 均已停止；不要提交忽略数据或数据库二进制。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
