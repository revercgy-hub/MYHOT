# 项目状态

CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=7aa8b33078fbb3ce54dd73d3fe3a8435bce16db7
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT

STAGE=P3小范围collector/正文验证、AD-010单篇PDF集成及OMO第191号单篇两轮验证完成；fresh本地回归通过；P0/P1/Gate 1完成，P2首批来源配置与preview完成
GATE=Gate 1 PASSED；Gate 2 尚未通过，不能开始大规模采集
REVIEW=Sol Gate 1 Review已由Lead核销修复并通过；日期/titleAttribute修复按AD-008；Sol AD-009/AD-010批准共享正文selector、PDF PoC与附件envelope契约。AD-010单篇隔离HTML+PDF经SQL核验；OMO第191号单篇在独立库完成受限两轮collector验证。fresh fiscalhot_ad010b_test本地回归通过。首次MODEL=false的测试尝试导致25个stub测试失败，属于无效环境设置；正确fresh重跑156/156通过。既有GitHub Check workflow_dispatch run 36556441810在Ubuntu上check和docker jobs均成功，head SHA与feature同步；Linux CI仅证明通用测试/构建兼容，没有解析真实官方PDF；Gate 2未审查。
BLOCKERS=三源30篇最新正文SQL为29 ok/1 unconfirmed/0 pending；30个content.extract-body:created job仍未消费，无analysis job、receipts=0、lb_models=0。金融司绩效公示经单篇HTML+PDF从rev1/0字/unconfirmed更新为rev2/1,454字/ok；首次失败原因仍unknown，不能倒推。金融企业财务快报系统25版仍unconfirmed、原失败原因unknown，页面含RAR不可冒正文。OMO第191号已完成一个指定URL的隔离两轮小样（首轮创建、次轮判重），但不代表首页20项或长期稳定性；source仍disabled，留有1个未消费content.analyze:created job，无extract-body job、receipts=0、lb_models=0。会计司列表09-21/详情PubDate09-22差一天；厦门证监局正文09-15/meta09-23口径未判定。福建厅扫描PDF四页文本层为0。真实官方PDF尚未在Linux解析；NAS硬RSS与运行隔离待验。12个重点入口3个未配置；其他源分页/freshness/长期去重待补。隐私与使用条款模板需正式上线前确认。

COMPLETED=P0接管；财政金融静态改造和Gate 1；10源disabled配置与preview；collector日期/titleAttribute修复；P3三源30篇入库/判重和正文验证（29 ok/1 unconfirmed）；AD-009共享正文selector SQL路径及本地helper验证；OMO第191号隔离库两轮真实collector小样（found/created/revised=1/1/0、1/0/0；正文174字、1表、日期+08:00正确）；PDF.js 6.3.289 Windows离线PoC复核金融司表格及福建扫描件fail-closed；AD-010单篇HTML+PDF真实隔离提取、厦门市跨span坐标恢复。fresh本地回归：fiscalhot_ad010b_test 35 migrations、npm test 156/156、typecheck、web build、web tests 11/11、loopback smoke 30/30。Ubuntu GitHub Check run 36556441810：两job全绿，backend tests 156/156、web tests 11/11，check/Docker各30条smoke通过；Linux通用CI已过但真实官方PDF Linux解析未验证。
IN_PROGRESS=四组实现变更已推送至origin/feat/fiscal-finance-hot，代码测试SHA为7aa8b33078fbb3ce54dd73d3fe3a8435bce16db7；既有Check成功。已完成并记录OMO第191号单篇受控P3，隔离库配置已恢复且PostgreSQL已停止。所有配置源disabled、全文开关false；无应用worker或真实模型调用。本轮文档同步后不重跑已通过的Check。
NEXT=继续Gate 2其余六源受控证据；评估OMO来源首页其他候选与跨周期freshness，补真实官方PDF Linux验证、NAS RSS/隔离证据及剩余分页/去重证据。Gate 2前不大规模采集、不部署Production。

`CURRENT_SHA` 是本状态记录时的代码 HEAD。提交状态文档后，最新文档 HEAD 以 `git rev-parse HEAD` 为准。

## 安全和验证环境

- `.env.example` 的COLLECT、MODEL、JINA、INDEXNOW及两项FEISHU开关均为false；本地无持久.env。十个source持续enabled=false且全文开关关闭。Check workflow显式关闭采集/Jina/IndexNow/Feishu。
- 完整npm test的provider集成测试仅在测试子进程设置MODEL_CALLS_ENABLED=true，并指向本地127.0.0.1假服务、使用test key；这不调用真实provider。第一次错误保持MODEL=false导致25个stub测试失败，该尝试无效；fresh重跑按隔离stub约定通过156/156。
- Windows测试使用官方EDB PostgreSQL 17.11-3，数据位于忽略的.data/test-pg。fresh fiscalhot_ad010b_test完成35项migration；156测试、typecheck、web build、web tests 11/11、loopback smoke 30/30通过。GitHub Ubuntu CI通用构建/测试也通过，但未解析真实PDF样本，NAS RSS仍待验。P3原30篇证据仍留在隔离库；所有source disabled。Lead确认应用临时服务已停且端口3000/3001/3300/3301/5432全部无监听。不要提交.data或凭证。
- 审查品牌资源时确认 `logo.svg` 和各尺寸图标已替换为 MyHOT 的临时 M 占位符，没有创建正式财政金融 Logo。日报、周报、月报、合订本名称牌由仓库 `scripts/nameplates.ts` 与 Noto Sans SC 轮廓字生成。
- 财政金融政策与监管主题、测试模板、开发日志已不含原 AIHOT 行业示例。隐私与使用条款仍是上游模板，正式上线前由负责人确认。
