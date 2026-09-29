# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=fe387306fe51dd50faea8e22a38aec8b2444e7bd
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P1 财政金融静态行业改造及 Gate 1 完成；P2 首批官方信源核验进行中
GATE=Gate 1 PASSED；Gate 2 尚未通过
REVIEW=Sol Gate 1 Review 原始结论为 CHANGES_REQUIRED；Lead 已核销三项修复并记录 FINAL_GATE_STATUS=PASSED
BLOCKERS=P2 首批 12 个重点源有 8 个因页面/日期/分页证据不足而未配置；四个已配置源的单次受控 live preview 已完成，但正文门槛、标题属性抽取、PDF、分页和 freshness 问题仍待处理或复核。用户需在正式发布前确认隐私与使用条款模板。

COMPLETED=P0 接管审计；财政金融分类、稳定 topic slug、机构/身份/已核验发布域名和主题页语义；prompt KnowHow 与 sources schema 配置；首页/About 文案；行业功能关闭；获批的 web 分类语义、publication v1/RSS 分类兼容及 Windows SSR 路径修复；临时 MyHOT M 占位图标和财政金融日报报头。4 个已验证来源保持 disabled 且全文转发关闭；Gate 1 通过；每源一次只读 preview 已完成并记录于 `SOURCE_MATRIX.md`。测试数据库 35 项迁移成功；`npm run typecheck`、`npm test`（129/129）、web build 和 web tests（11/11）通过。完整测试记录：`.data/npm-test-clean.log`。
IN_PROGRESS=P2 其余 8 个重点信源页面结构调查；复核四源 preview 暴露的分页、新鲜度、弱正文和标题属性抽取限制。
NEXT=逐项解决来源证据缺口并验证 collector 正常抓取，更新 `SOURCE_MATRIX.md`；Gate 2 前不做大规模采集或开启模型。Gate 3 前不校准精选门槛，Gate 4 前不部署 NAS Production。

`CURRENT_SHA` 是本状态记录时的代码 HEAD。提交状态文档后，最新文档 HEAD 以 `git rev-parse HEAD` 为准。

## 安全和验证环境

- `.env.example` 的采集、模型、IndexNow、飞书内容推送和飞书内部通知开关均为 `false`；本地没有持久 `.env`。不运行真实采集、付费模型请求或通知。
- 全套 `npm test` 在测试子进程中临时设置 `MODEL_CALLS_ENABLED=true`，因为被测分析路径需要通过 provider 接口；每个相关 provider 都指向测试文件创建的 `127.0.0.1` HTTP stub，使用假 key。`COLLECT_ENABLED`、`INDEXNOW_SUBMIT_ENABLED`、`FEISHU_CONTENT_PUSH_ENABLED`、`FEISHU_INTERNAL_ENABLED` 均显式为 `false`。这只覆盖测试 mock，不打开真实模型调用。
- Windows 测试使用官方 EDB PostgreSQL 17.11-3 二进制，在被 Git 忽略的 `.data/test-pg/` 中创建临时集群，绑定 `127.0.0.1:5432`，只新建和使用 `fiscalhot_test`。35 项迁移和测试已完成，实例已停止；不要提交数据库文件或二进制。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
