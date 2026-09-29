# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=9d617d19d5e9356d06fb9b95b10886f8c163e131
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3 小范围真实 collector 验证进行中；P0、P1、Gate 1 完成，P2 首批来源配置与一次性 preview 完成
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集
REVIEW=Sol Gate 1 Review 已由 Lead 核销修复并通过；日期/titleAttribute修复按 AD-008；Sol AD-009 批准共享selector与离线PDF PoC范围。Lead已核验最终回归和四组提交；四个提交已推送至 https://github.com/revercgy-hub/MYHOT 的 feat/fiscal-finance-hot，远端SHA与代码HEAD一致；main未改动、未推送上游。本轮不是重复Gate 1/AD-008审查，也没有Gate 2 Sol Review。
BLOCKERS=OMO第191号约162字，Readability 200字门槛过滤；共享selector helper对本地#zoom快照验证通过，source仍disabled。会计司列表09-21/详情PubDate09-22差一天；厦门证监局正文09-15/meta09-23口径未知。既有30篇正文尝试为28 ok/2 unconfirmed；首次原因留档缺失，两条unknown，其中一条当前HTML约158字并提供PDF附件，另一条未诊断；福建厅扫描PDF为4页、Node PDF.js文本层为0，不能正文确认。PDF.js offline PoC尚未接生产附件获取/存储链；Linux/NAS与硬RSS限制未验证。12个重点入口3个因动态列表/详情能力证据不足未配置。MOF综合、金融司、国库司一次性最新日分别2026-08-26、2026-07-16、2026-09-24，需结合发布节奏复核freshness；分页和长期去重仍需完整验证。隐私与使用条款模板需正式发布前确认。

COMPLETED=P0接管审计；财政金融静态改造和Gate 1；10源 disabled 配置与 preview；collector 日期/titleAttribute修复；P3三源30篇受控入库、二轮判重与正文尝试（28 ok/2 unconfirmed）；AD-009共享严格正文selector已在离线单测、collector/detail预取和extractArticleBody SQL路径验证；OMO本地快照正确保留标题、日期、表格列和值；PDF.js 6.3.289 Windows离线PoC以每页19个坐标行及X列锚点复核财政部金融司PDF四个业务行×四列，福建厅扫描件fail-closed；具体见`P3_BODY_VALIDATION.md`及`SOURCE_MATRIX.md`。最终本地回归：fresh `fiscalhot_ad009b_test` 35迁移，`npm run typecheck`、`npm test` 144/144、`npm run build -w @aihot/web`、web tests 11/11、loopback smoke 30/30通过。
IN_PROGRESS=P3后续详情、分页、freshness和生产PDF覆盖评估；所有配置源保持disabled，OMO selector仅静态opt-in/本地快照验证；PDF parser只处理调用方提供的bytes，不接生产网络或存储链。
NEXT=完成生产PDF与HTML组合正文的安全集成设计和实现，保留精确附件区域、附件URL/标题及页面坐标语义；验证Linux/NAS兼容、真实RSS上限和短正文/附件拒绝边界，再补齐Gate 2所需的信源稳定性与端到端证据。Gate 2未通过，不得大规模采集或部署。

`CURRENT_SHA` 是本状态记录时的代码 HEAD。提交状态文档后，最新文档 HEAD 以 `git rev-parse HEAD` 为准。

## 安全和验证环境

- `.env.example` 的采集、模型、IndexNow、飞书内容推送和飞书内部通知开关均为 `false`；Jina body fallback 也默认为 false。本地没有持久 `.env`。本轮 P3 列表验证为6次列表入口调用；对既有30篇分别只调用一次 `extractArticleBody(id,false)`，并对一条早先未确认页执行一次已批准的只读诊断GET。全程不运行worker、真实模型、付费fallback或通知。
- 全套 `npm test` 在测试子进程中临时设置 `MODEL_CALLS_ENABLED=true`，因为被测分析路径需要通过 provider 接口；每个相关 provider 都指向测试文件创建的 `127.0.0.1` HTTP stub，使用假 key。`COLLECT_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED` 均显式为 `false`。这只覆盖测试 mock，不打开真实模型调用。
- Windows 测试使用官方 EDB PostgreSQL 17.11-3 二进制，在被 Git 忽略的 `.data/test-pg/` 中的集群绑定 `127.0.0.1:5432`。本轮全套 `npm test` 使用新建的空隔离库 `fiscalhot_ad009b_test`，35项迁移成功；测试总数144，全部通过。P3入库/正文证据另保存在原有隔离库，不清理。所有 source 仍 disabled。API/Web smoke 监听仅 `127.0.0.1`，模型/Jina/采集/通知/IndexNow关闭，未启动应用worker；临时API/Web与PostgreSQL进程均已停止。不要提交忽略数据或数据库二进制。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
