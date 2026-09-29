# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=d443310480a16d26d86e53c581cacdcca99c1013
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3小范围collector/正文验证、AD-010单篇PDF集成、OMO及四源单URL两轮样本完成；本地页面预览运行中；Gate 2尚未通过
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集
REVIEW=Sol Gate 1 Review已由Lead核销修复并通过；AD-008日期/titleAttribute、AD-009短正文与PDF PoC、AD-010附件envelope及AD-011 route文案裁决按批准范围实施。厦门财政新增正文selector保持 disabled，QA fresh fiscalhot_pagecopy_test 35 migrations后 npm test 156/156、typecheck及source whitelist/saved HTML focused检查通过。页面route文案的typecheck、web build、web tests 11/11、smoke 30/30通过。Ubuntu Check run 36556441810（tested SHA 7aa8b33）通用测试/构建通过但未解析真实官方PDF；此次Windows变更没有新的Linux CI结果。Gate 2未审查。
BLOCKERS=三源30篇批次最新SQL为29 ok/1 unconfirmed/0 pending，30个content.extract-body jobs仍未消费；金融司历史失败原因unknown，快报25版含RAR仍unconfirmed。OMO第191号为限一条URL两轮样本，留1个未消费content.analyze job。预算司、人行厦门、厦门财政各有一条固定URL两轮样本：预算司2272字、人行厦门1745字正文ok；厦门财政初始205字Readability结果经DB复核为标题/日期、扫码提示及页尾，无招标结果，属于假阳性，正文完整性阻塞Gate 2。disabled config仅增加实测 .Custom_UnionStyle selector，helper以attachments_unprocessed拒绝26字intro，PDF未读取。福建厅、会计司、厦门证监JSON仍缺两轮collector证据；真实官方PDF尚未Linux解析；NAS硬RSS/隔离、分页和跨周期freshness待验。

COMPLETED=P0接管；财政金融静态改造和Gate 1；10源disabled配置与preview；P3三源30篇列表两轮和正文验证（29 ok/1 unconfirmed）；AD-009/AD-010单篇隔离提取；OMO第191号及预算司、人行厦门、厦门财政各一条固定URL完成两轮小样；本地页面预览（34主题、sources/articles/stories/reports均0）。厦门财政205字Readability假阳性已由source-only `.Custom_UnionStyle` selector fail-closed，附件未读取。最新 fresh fiscalhot_pagecopy_test：35 migrations、npm test 156/156、typecheck、whitelist/saved-HTML focused检查通过；页面文案修改后web build、web tests 11/11、loopback smoke 30/30通过。PDF.js Windows离线PoC通过。既有Ubuntu Check run 36556441810在tested SHA 7aa8b33通过通用检查，未验证真实官方PDF。
IN_PROGRESS=本地页面预览保持运行供检查；P3剩余工作是扩大有限来源证据并处理扫描PDF/Linux/NAS边界，不扩大采集。API/Web预览运行于127.0.0.1:3001/3000；独立 `fiscalhot_preview_test` 完成35 migrations并仅seed 34 topics，sources/articles/stories/reports=0。共享PostgreSQL在127.0.0.1:5432运行。全部来源disabled/全文false，运行安全flags false，无worker、DEV_AUTH未设置。最新代码SHA为本文件记录时的d443310480a16d26d86e53c581cacdcca99c1013；文档提交后的完整SHA以 `git rev-parse HEAD` 为准。
NEXT=继续厦门财政正文/PDF处置，验证福建、会计司、厦门证监JSON受限路径，以及Linux真实PDF、NAS RSS/运行隔离、分页与跨周期freshness。保持预览供本地查看；Gate 2前不扩大采集、不部署Production。

`CURRENT_SHA` 是本状态记录时的代码 HEAD。提交状态文档后，最新文档 HEAD 以 `git rev-parse HEAD` 为准。

## 安全和验证环境

- `.env.example` 的COLLECT、MODEL、JINA、INDEXNOW及两项FEISHU开关均为false；本地无持久.env。十个source持续enabled=false且全文开关关闭。Check workflow显式关闭采集/Jina/IndexNow/Feishu。
- 完整npm test的provider集成测试仅在测试子进程设置MODEL_CALLS_ENABLED=true，并指向本地127.0.0.1假服务、使用test key；这不调用真实provider。第一次错误保持MODEL=false导致25个stub测试失败，该尝试无效；fresh重跑按隔离stub约定通过156/156。
- Windows测试使用官方EDB PostgreSQL 17.11-3，数据位于忽略的.data/test-pg。最新 `fiscalhot_pagecopy_test` 完成35项migration；npm test 156/156、typecheck及 source whitelist/saved-HTML focused检查通过。页面文案后的 web build、web tests 11/11、loopback smoke 30/30通过。预览仍在线：Web `127.0.0.1:3000`、API `127.0.0.1:3001`、共享 PostgreSQL `127.0.0.1:5432`；隔离 preview DB仅34主题。GitHub Ubuntu run 36556441810仅针对旧 tested SHA 7aa8b33，通用测试/构建通过，真实官方PDF和NAS RSS未验证。所有source disabled。Lead已确认本轮测试子进程退出且PG、API、Web预览保持运行；不要提交.data或凭证。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
