# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=386a8e83eb4774a9858191d8dfb082792183aabe
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3小范围collector/正文验证、AD-010单篇PDF集成、OMO及七源固定URL两轮样本完成；AD-012本地人工样本预览运行中；Gate 2尚未通过
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集
REVIEW=Sol Gate 1 Review已由Lead核销修复并通过；AD-008日期/titleAttribute、AD-009短正文与PDF PoC、AD-010附件envelope、AD-011 route文案及AD-012本地人工样本预览均按批准范围实施。fresh fiscalhot_content_preview_test 35 migrations后 npm test 156/156；AD-012 focused guard 4/4、typecheck、web build、web tests 15/15、smoke 30/30通过。Ubuntu Check run 36556441810（tested SHA 7aa8b33）通用测试/构建通过但未解析真实官方PDF；本轮AD-012 Windows代码尚无新Linux CI结果。Gate 2未审查。
BLOCKERS=三源30篇批次最新SQL为29 ok/1 unconfirmed/0 pending，30个content.extract-body jobs仍未消费；金融司历史失败原因unknown，快报25版含RAR仍unconfirmed。OMO第191号限一条URL两轮样本，留1个未消费content.analyze job。预算司、人行厦门各一条固定URL两轮正文可读；厦门财政205字初始Readability结果经DB复核为标题/日期、扫码提示及页尾，无招标结果，source-only `.Custom_UnionStyle` helper fail-closed拒绝未处理附件，PDF未读取。福建厅、会计司、厦门证监本轮各完成一个固定URL两轮：福建正文虽629字可读但为领域噪声，现金管理扫描件仍 `pdf_page_no_text`；会计司列表9/21、详情PubDate9/22、正文落款9/17不一致；CSRC列表9/15与详情meta9/23冲突且原始found=20经精确URL allowlist只写一条。三源页面批量、分页与跨周期稳定性未验证；真实官方PDF尚未Linux解析；NAS硬RSS/隔离待验。

COMPLETED=P0接管；财政金融静态改造和Gate 1；10源disabled配置与preview；P3三源30篇列表两轮和正文验证（29 ok/1 unconfirmed）；AD-009/AD-010单篇隔离提取；OMO第191号、预算司、人行厦门、厦门财政、福建厅、会计司、厦门证监各一个固定URL的两轮样本；AD-012在独立 `fiscalhot_preview_test` 加入34主题及3条人工样本（source/articles/publication/override均3，stories/reports 0）。seed首轮3 created、后续均 unchanged，article/publication/override版本各为1，score/reason null、selected0、正文/analysis/selected ledger/state/receipts/jobs为0。页面 `/all` 展示真实标题，首页精选保持空并显示开发预览入口；API与全量RSS摘要带人工样本前缀，精选snapshot/RSS不含样本。完整 npm test 156/156、typecheck、Web build、Web测试15/15、smoke30/30和seed SQL/SSR证据通过。厦门财政假阳性、福建扫描PDF及日期口径冲突保持阻塞。Ubuntu Check run 36556441810在tested SHA 7aa8b33通过通用检查，未验证真实官方PDF。
IN_PROGRESS=本地人工内容预览运行供用户检查；P3剩余任务为有限来源证据、正文质量、真实PDF/Linux/NAS边界，不扩大采集。Web `127.0.0.1:3000` 与API `127.0.0.1:3001`、共享PostgreSQL `127.0.0.1:5432` 均只绑定loopback；本地DB `fiscalhot_preview_test` 完成35 migrations、有34主题和3个人工样本。Web以构建产物和 `NODE_ENV=development` 运行，只有该Web进程 `LOCAL_PREVIEW_ENABLED=true`；其余采集/模型/Jina/IndexNow/Feishu/私网 flags 均 false，无应用worker、DEV_AUTH未设置。工作树含未提交AD-012实现和文档；`CURRENT_SHA` 是本次文档记录时的HEAD，修改将在后续提交。
NEXT=保持 `/all` 本地预览供用户查看；继续处理厦门财政正文/PDF缺口、福建扫描件和剩余栏目批量/分页/freshness证据，并完成Linux官方PDF与NAS RSS/隔离验证。Gate 2前不扩大采集、不部署Production。

`CURRENT_SHA` 是本状态记录时的代码 HEAD。提交状态文档后，最新文档 HEAD 以 `git rev-parse HEAD` 为准。

## 安全和验证环境

- `.env.example` 的COLLECT、MODEL、JINA、INDEXNOW及两项FEISHU开关均为false；本地无持久.env。十个source持续enabled=false且全文开关关闭。Check workflow显式关闭采集/Jina/IndexNow/Feishu。
- 完整npm test的provider集成测试仅在测试子进程设置MODEL_CALLS_ENABLED=true，并指向本地127.0.0.1假服务、使用test key；这不调用真实provider。第一次错误保持MODEL=false导致25个stub测试失败，该尝试无效；fresh重跑按隔离stub约定通过156/156。
- Windows测试使用官方EDB PostgreSQL 17.11-3，数据位于忽略的.data/test-pg。fresh `fiscalhot_content_preview_test` 完成35项migration，`npm test` 156/156；typecheck通过。Web build与`apps/web/tests/*.test.ts` 15/15、loopback smoke 30/30通过。seed在独立 `fiscalhot_preview_test` 双轮执行：首轮3 created，次轮3 unchanged；每篇article/publication/override版本各1。SQL核验score/reason null、selected/analysis/fulltext/selected-ledger/state/receipt/job均0；API pool 3条、选中snapshot0条、RSS全量摘要带人工标记。预览仍在线：Web `127.0.0.1:3000`（`NODE_ENV=development`且仅Web预览flag开启）、API `127.0.0.1:3001`、共享 PostgreSQL `127.0.0.1:5432`；source enabled/fulltext均false，其他安全flag false。GitHub Ubuntu run 36556441810仅针对旧 tested SHA 7aa8b33，通用测试/构建通过，真实官方PDF和NAS RSS未验证。不要提交.data或凭证。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
