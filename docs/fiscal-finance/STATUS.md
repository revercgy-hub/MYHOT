# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=0ec0704c0e60a88d84bc99d558eb569c56731c79
CI_TESTED_SHA=dafe9386838f6423dba8e080c51cd9114066992f
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3小范围collector/正文验证、AD-010单篇PDF集成、OMO及七源固定URL两轮样本完成；新增财政部全国汇总选登与厦门监管局两条disabled来源，35局目录核对、中央7条及厦门10条离线候选检查完成；AD-012本地人工样本预览运行中；Gate 2尚未通过
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集
REVIEW=Sol Gate 1 Review已由Lead核销修复并通过；AD-008日期/titleAttribute、AD-009短正文与PDF PoC、AD-010附件envelope、AD-011 route文案及AD-012本地人工样本预览均按批准范围实施。fresh fiscalhot_content_preview_test 35 migrations后 npm test 156/156；AD-012 focused guard 4/4、typecheck、web build、web tests 15/15、smoke 30/30通过。Ubuntu Check run [36589569943](https://github.com/revercgy-hub/MYHOT/actions/runs/36589569943) 对 tested SHA `dafe9386838f6423dba8e080c51cd9114066992f` 全绿；验证通用 Linux 测试/构建，不含真实官方PDF解析。厦门第十六期PDF完成一次受限 GET，解析状态 `pdf_page_no_text`；未得到页数/字段，也未保存原始 bytes。Gate 2未通过。
CURRENT_TURN=新增 `mof-regional-supervision-dynamics` 与 `mof-xiamen-supervision-dynamics` 两条 T1 `web_list` 来源；当前共12源，全部 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。财政部中央选登列表快照经实际 parser 筛出7条；厦门监管局工作动态首页快照解析10条。仅作静态候选与链接/日期结构检查，无 collector 写库、正文队列、模型或 worker。福建局独立栏目本机有界请求两次均502，不配置；35局目录只作为官方域名/中央链接 allowlist 依据，未逐局核验动态栏目。fresh `fiscalhot_regional_sources_test` 已完成35 migrations，`npm test` 156/156、typecheck、来源 allowlist/selector focused 审计、web build、web tests 15/15、smoke 30/30通过。本地 `/all` 返回200且有noindex/预览标识及3条原样本标题；pool恰有3条，均selected=false、score/reason=null，selected snapshot 0条。PostgreSQL/API/Web仅绑定127.0.0.1，Web以 `NODE_ENV=development` 启动且仅Web进程 `LOCAL_PREVIEW_ENABLED=true`，其他安全flags关闭、无worker，预览库未改。本轮不改变历史 `CI_TESTED_SHA` 与 Gate 证据，也不代表 Gate 2 通过。
BLOCKERS=三源30篇批次最新SQL为29 ok/1 unconfirmed/0 pending，30个content.extract-body jobs仍未消费；金融司历史失败原因unknown，快报25版含RAR仍unconfirmed。OMO第191号限一条URL两轮样本，留1个未消费content.analyze job。预算司、人行厦门各一条固定URL两轮正文可读；厦门财政205字初始Readability结果经DB复核为标题/日期、扫码提示及页尾，无招标结果，source-only `.Custom_UnionStyle` helper fail-closed拒绝未处理附件。第十六期PDF一次 guarded GET 为 HTTP 200、application/pdf、457111字节、无重定向；strict parser返回 `pdf_page_no_text`，无页数/layout/业务字段输出，原始bytes未保存，不能据此推断整份PDF均为扫描件，附件正文仍未验证。福建厅、会计司、厦门证监本轮各完成一个固定URL两轮：福建正文虽629字可读但为领域噪声，现金管理扫描件仍 `pdf_page_no_text`；会计司列表9/21、详情PubDate9/22、正文落款9/17不一致；CSRC列表9/15与详情meta9/23冲突且原始found=20经精确URL allowlist只写一条。三源页面批量、分页与跨周期稳定性未验证；真实官方PDF尚未Linux解析；NAS硬RSS/隔离待验。

COMPLETED=P0接管；财政金融静态改造和Gate 1；原10源disabled配置与preview；P3三源30篇列表两轮和正文验证（29 ok/1 unconfirmed）；AD-009/AD-010单篇隔离提取；OMO第191号、预算司、人行厦门、厦门财政、福建厅、会计司、厦门证监各一个固定URL的两轮样本；厦门债第十六期PDF单次受限诊断（pdf_page_no_text，页数和业务字段未知）；AD-012在独立 `fiscalhot_preview_test` 加入34主题及3条人工样本（source/articles/publication/override均3，stories/reports 0）。新增财政部各地监管局来源：中央官网选登与厦门局工作动态两源加入配置，35局官方目录域名清单核对；项目parser在离线快照中筛出中央7条、厦门10条候选（合计17条，未入库）。福建监管局独立列表两次请求均502，未配置。seed首轮3 created、后续均 unchanged，article/publication/override版本各1，score/reason null、selected0、正文/analysis/selected ledger/state/receipts/jobs为0。页面 `/all` 展示真实标题，首页精选保持空并显示开发预览入口；API与全量RSS摘要带人工样本前缀，精选snapshot/RSS不含样本。原10源完整 npm test 156/156、typecheck、Web build、Web测试15/15、smoke30/30和seed SQL/SSR证据通过。厦门财政附件正文、福建扫描PDF及日期口径冲突保持阻塞。Ubuntu Check run 36589569943对 `CI_TESTED_SHA=dafe9386838f6423dba8e080c51cd9114066992f` 通过通用检查，未在Linux解析真实官方PDF。
IN_PROGRESS=本地人工内容预览继续供用户检查；新增监管局来源目前只有离线parser候选验证，无collector写库、逐篇正文质量、跨周期freshness/重复或全35局栏目覆盖证据。财政部中央源是选登汇总而非全量实时；厦门局独立源仅验证首页及有限历史样本；福建局独立源因两次HTTP 502待验。fresh `fiscalhot_regional_sources_test` 与loopback smoke复测通过。Web `127.0.0.1:3000`、API `127.0.0.1:3001`、共享PostgreSQL `127.0.0.1:5432` 均仅绑定loopback；Web以 `NODE_ENV=development` 启动且仅Web进程 `LOCAL_PREVIEW_ENABLED=true`，其他采集/模型/Jina/IndexNow/Feishu/私网安全开关保持关闭，无应用worker、DEV_AUTH未设置。
NEXT=在Gate 2条件下按逐源计划验证新增来源的详情正文、分页、日期口径、噪声、重复与跨周期freshness；继续处理厦门财政附件正文/字段缺口、福建扫描件及真实官方PDF/Linux/NAS边界。Gate 2前不扩大采集、不部署Production。

`CURRENT_SHA` 是本轮来源配置代码HEAD；`CI_TESTED_SHA` 是最近 Ubuntu 通用CI的旧 tested HEAD，本轮没有新CI。后续纯文档提交不改变来源代码HEAD。

## 安全和验证环境

- `.env.example` 的COLLECT、MODEL、JINA、INDEXNOW及两项FEISHU开关均为false；本地无持久.env。十个source持续enabled=false且全文开关关闭。Check workflow显式关闭采集/Jina/IndexNow/Feishu。
- 完整npm test的provider集成测试仅在测试子进程设置MODEL_CALLS_ENABLED=true，并指向本地127.0.0.1假服务、使用test key；这不调用真实provider。第一次错误保持MODEL=false导致25个stub测试失败，该尝试无效；fresh重跑按隔离stub约定通过156/156。
- Windows测试使用官方EDB PostgreSQL 17.11-3，数据位于忽略的.data/test-pg。fresh `fiscalhot_content_preview_test` 完成35项migration，`npm test` 156/156；typecheck通过。Web build与`apps/web/tests/*.test.ts` 15/15、loopback smoke 30/30通过。seed在独立 `fiscalhot_preview_test` 双轮执行：首轮3 created，次轮3 unchanged；每篇article/publication/override版本各1。SQL核验score/reason null、selected/analysis/fulltext/selected-ledger/state/receipt/job均0；API pool 3条、选中snapshot0条、RSS全量摘要带人工标记。预览仍在线：Web `127.0.0.1:3000`（`NODE_ENV=development`且仅Web预览flag开启）、API `127.0.0.1:3001`、共享 PostgreSQL `127.0.0.1:5432`；source enabled/fulltext均false，其他安全flag false。GitHub Ubuntu Check run [36589569943](https://github.com/revercgy-hub/MYHOT/actions/runs/36589569943) 对 `CURRENT_SHA` 的通用测试、构建和 Docker smoke 通过；真实官方PDF未在Linux解析，NAS RSS未验证。厦门债第十六期PDF仅一次受限请求：200、`application/pdf`、457111字节、无重定向；parser `pdf_page_no_text`，无页数或字段返回，失败摘要保存在 ignored 目录，原始bytes未保存，也不据此推断所有页面皆扫描件。不要提交.data或凭证。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
