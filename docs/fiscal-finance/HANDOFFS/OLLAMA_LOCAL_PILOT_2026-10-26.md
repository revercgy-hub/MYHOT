# 2026-10-26 局域网 Ollama 小批量开发评测交接

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：对 12 条 development 样本运行一次有界的本地 Ollama 集成试验，并对冻结输出、receipt/attempt provenance、标签隔离、评测计数、摘要事实依据及隔离数据库状态作独立QA。此项不是fresh holdout、Gold整体评测或Gate验收。

**MODEL**：Luna High。实际推理由唯一operator通过局域网 Ollama `qwen3.5:9b` 执行；没有调用付费provider。独立QA没有发起模型请求、应用业务写入或NAS部署。最终独立QA摘要保存在`.data/fiscal-qa/development150-local-pilot-20261026/independent-postqa-r1.json`，SHA-256 `E93B5370AA229F12B9984BCC7438D8831219898480A0993F5E02B7F7AFD85590`。

```text
CURRENT_BRANCH=feat/fiscal-finance-hot
CURRENT_SHA=36f6bce8e38e27d79ac70b2c1b9ce6dbb39d4716 (code/test HEAD before docs commit)
BASE_SHA=589f79eff09470b31ba8a7f1d9eb62d36ff2be6c
WORKSPACE=D:\AI-work\MYHOT\AIHOT
NAS_RUNTIME=d45f0d93f5374b7c72cdf0efb64ada6a03b84404 (unchanged)
```
**FILES_CHANGED**：新增有界runner/guard/测试4文件，commit `6abccf861ec50d8469771fd407098444aa00057e`（`test(fiscal): add guarded local Ollama pilot`）；修复共享测试库translation候选排序竞态的测试fixture 2文件，commit `36f6bce8e38e27d79ac70b2c1b9ce6dbb39d4716`（`test: isolate translation fixtures by publication order`）。首次交接与`STATUS.md`、`PROJECT_PLAN.md`已在`5e77105`提交；本次只追加运行清理与集成范围更正。`.data`中的inputs、labels、predictions、raw receipt和QA artifact不纳入Git。

**TESTS_RUN**：pilot guard focused tests 10/10通过；`npm run typecheck`通过；修复前整套`npm test`为495项中488 pass/2 fail/5 skip，失败定位为共享测试库候选排序竞态；两处fixture改为读取当前最大`publications.discovered_at`并在调用前断言自身为队首后，定向translation suite 5/5、`npx tsc -p tests`通过，随后整套`npm test`为495项中490 pass/0 fail/5 skip（143.7秒）。full-suite使用隔离测试库及本地stub，provider凭据/URL/proxy均清除。5个skip分别要求专用`NAS_NATIVE_SUMMARY_TEST_DATABASE_URL`、`P3_PAGE_CONTINUATION_TEST_DATABASE_URL`或`NAS_CANDIDATE_TEST_DATABASE_URL`，所以这些DB集成分支仍未在这轮运行。没有为本轮再运行其它完整套件。

**RESULT**：冻结样本manifest为12条（4条人工select、8条人工reject），全部development split；推理仅读取request-only输入，labels私有文件在predictions冻结并哈希后才用于独立join。request-only SHA-256 `95370FAA035D9322D4BDABB7E109A99BF3F9AE7ACDD411F9F98B233651271517`；冻结预测 `.data/fiscal-qa/development150-local-pilot-20261026/predictions-r1.json` SHA-256 `3AC4047DB4C193F7AF31F1057BAB5DB89D08D2DED934632591A49CCFA18DCBEF`。输入manifest SHA `7A3A6F0C0E1059C7E6B6AB9FB13A0DA035E981D638FAFC81664A699E2578B801`；私有label文件SHA `222CC34E056C41FAA18638EF4C7DBC61E111FAEDA697554B79EC1BDEA835F7CB`。

实际API执行总时长7m50.813s。30次请求，无重试：12次prefilter、7条通过prefilter样本各双评2次（14次score）、4条单独summary请求。共有30条`llm` receipt，状态均`completed`；30条`receipt_attempts`状态均`received`，一条一次尝试；prompt/version、输入hash、模型、参数、HTTP响应与receipt绑定复核通过。receipt QA artifact `.data/fiscal-qa/development150-local-pilot-20261026/receipt-attempts-r1.json` SHA-256 `5C4205B46EB4ABBB6E2AFBDA7A3E4705A0B9DA1BD68444D8150C8DCE00DD4E2B`；更正后的operator metadata SHA-256 `94A900CA58EFBAB798CA2CE6E8FBAA61C444CBB365C859AD9428D1A4E8911B39`。

Prefilter把5条人工reject挡为BLOCK，另7条继续双评分；这12条的prefilter结果不能当作精选准确率。仅在7条实际双评分样本上，按现有阈值60计算均值候选：TP=3、FP=1、FN=1、TN=2；候选precision/recall均75%。FP是“财政部关于中国福利彩票发行管理中心停止销售‘联合销售15选5’等9款游戏的审批意见”（两分82/68、均值75，Gold reject）；FN是“福建省财政厅 中国人民银行福建省分行关于2026年第十一期福建省省级国库现金管理商业银行定期存款招标结果的公告”（18/18、均值18，Gold select）。这是小样本development阈值候选观察，不是全站准确率、泛化结论、调参依据或Gate 3通过；阈值和Gold未改。

独立错例归因备忘 `.data/fiscal-qa/development150-local-pilot-20261026/two-case-score-error-attribution.json` SHA-256 `8BB1B5FD6E605E2E4661BF6F13BB45F0EAC652CB20DB997171F1DB73FBF15E52` 已将FP/FN解释为财政金融scope和重要性权重的待验证假设，不是模型提供的维度理由；只读request-only材料与现有prompt，没有调用模型、读取Gold或改规则。下一步可在development里成对比较彩票管理与国库现金操作边界例，由人工说明事件类型和各维度理由；不以这两条直接改prompt或threshold。

4条summary route输出的独立grounding artifact `.data/fiscal-qa/development150-local-pilot-20261026/summary-grounding-independent-qa.json` SHA-256 `281CFFCB909C7E36B2485638C753F7A9B6E2894FDD132168AB135F19E245663F`，绑定冻结predictions/input与来源正文hash，不含Gold标签。3条标题及句子有原文依据；初级会计证书通知的摘要省略邮寄选项，且将原文分别规定的`22301`福州市直与非`22310`前缀人群归并成“非福州考区”，属于局部地域过度推断，这一条摘要不得直接自动使用；省略邮寄选项是另一项信息遗漏，单独记录而非事实错误。此QA只审摘要事实，不判断选稿是否正确，也不代表understanding阶段。

本地隔离PostgreSQL数据库原始业务表为空，runner后sources/articles/analyses/publications/fetch_runs/job_runs/translations仍为空；只新增本次receipts/attempts等记录，业务行计数未变。`.data/test-pg`的隔离测试数据库数据保留。启动`pg_ctl`的client session因wait timeout/stale-PID warning报告exit1；但后台PG进程完成约206秒crash recovery，独立ready、36 migrations及后续SQL查询均成功。A随后核实PID/port并smart stop exit0；没有删除DB/cluster或`.data` artifact。具体运行/清理记录见A的cleanup sidecar `.data/test-pg/ollama-pilot-pg-20261026-55432-cleanup-r2.json`，SHA-256 `E4CA1AC63F5480B480D1F2F5E30EB8C43213120D983C38E6F96F90579ED5D6B7`；数据清理如有需要另行审核，本轮不删除、不覆盖artifact。NAS保持原`d45f0d9` api/web镜像，安全开关truthy值全false，未运行worker；本地试验未触及Staging业务。另有NAS API容器内一次只读`GET /v1/models`返回HTTP200、6个model IDs且含`qwen3.5:9b`，sidecar `.data/test-pg/ollama-gateway-models-get-20261026.json` SHA-256 `7BD2A1AFEE5658FDA4CC2BD683DA28F5C00795939E663B82DD88182240B30407`；该容器检查没有发起chat completion或模型调用，凭据只在内存中。本轮隔离PG上的本地chatJson/receipt真实调用链已完成30次且后验通过；待验的是NAS API容器内应用集成chatJson/receipt链。runner显式跳过understand、structure、normalize、publish；没有验证worker、全链自动选稿或正式调度。

**RISKS**：operator早期曾把attempt的`received`误写成receipt状态，独立只读SQL确认的真值为`receipts=completed:30`、`receipt_attempts=received:30`；预测文件SHA手工转录也曾有误，最终以独立文件hash `3AC4047DB4C193F7AF31F1057BAB5DB89D08D2DED934632591A49CCFA18DCBEF`为准。更正后的metadata保留在私有artifact，原始响应、预测和数据库未改。样本仅12条且从已标注development150中预先固定，不是holdout。7条进入双评分，样本很小；prefilter挡下的5条不进入分数阈值指标。4条summary只有3条无明显事实问题，不能据此估计整体摘要质量。测试套件中的5个DB集成skip依赖本轮未配置的专用数据库环境变量。Staging无worker的单时点状态不证明scheduler/cron配置不存在或关闭。

**BLOCKERS**：Gate 3仍`CHANGES_REQUIRED`（e82e开发150结果precision 37.21%，Root已裁定本轮不据小试验调整阈值/Gold/提示词）；Gate 4/5仍未通过。本次没有覆盖understanding、structure、worker调度和发布自动化。行业25–35个高质量信源与地方栏目覆盖、严格90天回填/日常周期、附件HOLD专属批量处置仍待独立验收。当前没有经验证的免费/本地provider生产配置；这次局域网Ollama是隔离开发试验，不意味着生产链已经接入或未来不会产生费用。

**NEXT**：两例离线归因已完成，属于假设而非模型解释；若继续，仅做小型匹配development诊断并收集人标维度理由，不扩Gold或fresh50。之后验证完整understanding链及NAS API容器内应用chatJson/receipt集成（容器GET `/v1/models`已通，但不是chat completion验收）。之后继续25–35个高质量来源和地方栏目、90天/每日调度实证、附件HOLD人工闭环、完整页面/自动化验收及Gate 4；持续稳定运行、重启与故障恢复完成后再申请Gate 5 review。保持fresh50已消费边界，不把本轮12条标为盲测。
