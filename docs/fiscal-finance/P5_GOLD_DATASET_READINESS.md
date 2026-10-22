# P5 Gold Dataset readiness（2026-10-03）

> 本页以下早期段落按原日期保留；当前状态以2026-10-22这一节为准。

## 2026-10-22 人工标签与事件核验完成；Gate 3留出评测仍待新样本

用户已在NAS私有人审队列提交全部130项：新增部分为13 `select`、117 `reject`、0 `either`；与原20项13/7合并后，150项均为`user_confirmed`，总计26 `select`、124 `reject`、0 `either`。原15个显式preference seed仍保持确认且不在holdout；这15项和此前用于熟悉偏好的原20项只能作为development，不可充当独立holdout。新50条native screening（23/22/5）是辅助建议，全部`needsHumanReview=true`，不属于本次人工标签。

独立核验的标签overlay为`.data/fiscal-qa/review-batches-20261022/review-overlay-20261022T125439+0800.json`（SHA-256 `e6250b35f8781774a87fdc14071380b85ccc9e5f27020113361293da5700c0df`）；合并清单为`.data/fiscal-qa/review-batches-20261022/reviewed-manifest-20261022T125439+0800.json`（SHA-256 `2f8e2ef7182127eaf4bd3d9c7df86dde3b3861290d845ff992c32bc9c2a140a6`），证据文件SHA-256 `364772c5bd04d1eda7799da335f533582421e5db30463784968ec237ce0ba585`。原tracked 100项与150项候选proposal一致；合并只改`humanAnnotation`，旧20项注释、来源证据、proposal、event group与split均保持；冻结payload的150个正文快照SHA与对应candidate body SHA全部相符。NAS review只记录私有人工标签，没有新增文章、公开发布、analysis或provider调用。正文快照和导出payload留在`.data/`，不进入Git。

标签完成后，Gold CLI验证结果为`DRAFT_INCOMPLETE`、0 schema issue、150 confirmed/0 pending、15 seeds checked（exit 3）。这是预期结果：label-only合并manifest不含正文，且event group与split仍为`needs_review`；它不是可直接评测的数据集或Gate通过证据。

事件分组和development/holdout是技术隔离字段，不等同人工Gold标签。依据本轮validator合同，候选可用`eventGroupVerification`和`samplingContext.splitVerification`记录`agent_verified`，每项须包含`reviewer`、`method`、`verifiedAt`和绑定依据的`evidenceSha256`；歧义事件仍保留`needs_review`。用户标签仍只能以真实`user_confirmed`记录。分组应基于材料事实，将同事件转载/后续报道放入同组；再按事件组使用冻结的确定性规则分配split并独立检查泄漏。不得把Luna/native筛选一致率当成模型评测成绩，也不得将seed或已参与偏好归纳的样本分入holdout。

对event/split sidecar的独立QA核验了150个唯一ID、sourceArticleId、normalized URL、body SHA与contentHash；精确重复为0，重算39个标题相似flag并逐项核对来源、日期和标题后，没有发现同一地方实际事件。新metadata-only版本为`.data/fiscal-qa/review-batches-20261022/reviewed-manifest-agent-verified-20261022.json`（SHA-256 `a79839b1e27a368a3cdee65b36b38b9d075933cd39dc7d99c95839d3e74199dc`）；独立QA证据为`.data/fiscal-qa/review-batches-20261022/independent-event-group-qa-20261022.json`（SHA-256 `9a2e73c412df98e53bb95b3905ea4d338a28fdfb08730448fe36500fa5937b71`）。150条各自成为单例event group并有独立provenance；split统一agent_verified为development，holdout=0。所有标签、proposal、source evidence和原100 tracked条目保持。该批全部标签及两份native分歧分析均已查看，所以不将这批重新包装成未触碰holdout。

Native分歧分析仅为描述性人工建议一致度：new50为50项（23 select、22 reject、5 either），决定性45项的TP/FP/FN/TN为6/17/1/21，决定性准确率0.600、precision 0.261、recall 0.857；old80为80项（79决定、1 abstention），TP/FP/FN/TN为5/24/0/50，决定性准确率0.696、precision 0.172、recall 1.000。分析已看完标签和建议，old80建议还使用既有seed偏好语境；无评分值、threshold sweep或正式provider评测。结果不得表述为模型准确率、独立holdout或Gate3通过。详情及限制见ignored `.data/fiscal-qa/review-batches-20261022/native-calibration-analysis-20261022.json`（SHA-256 `51ccd41bc8613f002667bec9122d7adb26e9f26cefbddcf341ae661ba81af9fc`）。

**Gate 3当前缺口**：任务书§32的150–200规模和人工标签目标现已达到；本批150全部为development且没有holdout。不能把已参与标签/建议分析的50条重新称为未触碰holdout。下一步收集50条与现有150在材料及事件上均不同、正文合格的新样本；对冻结prompt先运行两次隔离的native评分并冻结预测，再请用户盲审。之后使用既有`eval-selection.ts`评估合同，完成开发集/留出集评测、指标/阈值比较与错例审阅。当前没有运行正式评测或校准，selection阈值保持原值。任何需要付费provider的评测须遵守用户免费优先决定，不在此处默认触发。验证器的静态ready状态只表示字段、人工标签、正文和技术provenance满足数据完整性要求；不表示存在holdout、评测结果或Gate 3通过。

**Gate 4/5当前缺口**：本地测试与NAS隔离运行已有实测，正式Gate审查仍未签核。来源/覆盖证据仍有限；PBOC page1–5观察100个唯一URL、其中63个落在观察90日窗内，不等于全源90日完成。Gate 5还需Staging稳定运行和实际恢复演练；现有备份仅验证可读取，没有restore rehearsal。Staging中内容库为空，Gold审核数据为私有队列，不会自动展示为公开内容。阶段证据见[2026-10-22人审队列部署交接](HANDOFFS/GOLD_REVIEW_QUEUE_STAGING_2026-10-22.md)。

## 2026-10-21 seed隔离校验与新增用户标注

离线validator现在要求显式传入preference seed清单：`node scripts/fiscal/gold-dataset.ts validate <manifest.json> --seed-case-ids <seed-case-ids.json>`。清单必须是JSON字符串数组，元素为manifest `caseId`；没有seed时显式传`[]`。输出报告记录`seedCheck.status`、数量和原始文件SHA-256。漏传、空白/重复/未知ID、holdout seed均失败关闭；旧API调用兼容但报告`not_run`并保持`DRAFT_INCOMPLETE`，不能据此当作ready。实现未改标签、event group、split或阈值。

对仍为100项的tracked manifest做了只读rehearsal，seed来源为batch-01至batch-03既有人类决定审计，按原编号顺序重建固定15个caseId。Ignored seed清单SHA-256为`f2b3272c3bfd774dba2dc8761fe1737f066d56e1561a9ef0b3cc4e7e3d4f33d5`；100候选manifest当时SHA为`3918ec45f0d28ff451c44b60159ecb0233db79c398e949781ace64b4642a7189`。CLI报告15/15 seed checked、0 seed issue，整体仍为`DRAFT_INCOMPLETE`、15 confirmed / 85 pending、exit 3；报告与来源SHA见ignored `.data/fiscal-qa/p5-seed-leakage-20261021/rehearsal.json`。seed身份完全匹配原15条用户标签，不包含batch-04新增标签，也不代表Gold评测或holdout。

2026-10-21用户对冻结batch-04编号16–20回复“16不，17-20可以”，审计映射为16 `reject`、17–20 `select`，无理由。独立QA确认tracked manifest只改这5项的`humanAnnotation`，原15项保持，event group、split及Luna `proposal`均不动。批次审计SHA为`182555c7bfe482d9824a2bf25d66b504121f6f96d272f58ede43233a02498fcc`；当前100候选manifest SHA为`96c2e0914e08e22080cf91e05a6c4f419533356459406d262f81dd19ff6e2051`。当前是20 confirmed（13 select、7 reject）/80 pending；既有固定seed仍是原15条。

规模目标需要区分：任务书§32要求150–200条Gold资料；`docs/selection.md`的100–200条是说明性建议。当前tracked 100候选仍低于任务书目标。Gate 3没有规定development/holdout各自的数字下限或独立质量分数线；正式条件仍是完成两集评测、错例审阅及门槛确认。新增候选草案不能当作人工Gold或正式拆分。

10月21日随后生成的150条metadata-only proposal只存在于ignored `.data/fiscal-qa/p5-gold-150-20261021/`，包含原tracked 100条和50条新的人工审阅候选。对新增50条的独立QA确认原100项deep-equal、正文/current revision证据关联和body SHA逐项匹配；新增项仍全为`needs_review`、proposal decision null、event/split未确认。候选来源28个且均为T1；按明确谓词得到的strict eligible unique pool为323，选择分层10/12/12/16。它是候选提案，不是已完成Gold或合格评测样本，不能据150条总数宣称达到Gold硬目标。详见[10月21日交接](HANDOFFS/P5_SEED_GUARD_AND_COVERAGE_2026-10-21.md)。

新代码fresh QA：后端418 pass、0 fail、1 skip；typecheck、Web build及Web tests 17/17通过。该代码SHA与历史CI SHA不同；不据旧CI run主张当前代码的远端CI通过。

## 2026-10-19 batch-02人工决定与batch-03准备

用户对batch-02编号6–10回复“都精选”，五项记为`select`；batch-03编号11–15原文“11精选 12不 13精选 14精选 15精选”按固定编号映射为select、reject、select、select、select。两批均由`user-in-this-chat`确认，未提供理由；审计与批次hash见ignored `.data/fiscal-qa/gold-review-batches-20261018/human-decisions-batch-02.json`及`human-decisions-batch-03.json`。batch-03审计SHA-256为`E074AC050EA82213A8774BA049887CF5A95197706A5CF7373B46B3D31E3B6BF6`，确认观察时间`2026-10-19T12:18:04Z`。独立资料QA汇总见`.data/fiscal-qa/luna-gold-record-qa-20261019/independent-qa.json`。

版本化metadata仅更新batch-02及batch-03共10项annotation：100条中15 confirmed（9 select、6 reject）、85 pending；batch-01五项reject未变，全部eventGroup/split仍`needs_review`。既有Gold validator结果为`DRAFT_INCOMPLETE`、0 issues（预期exit 3）。这没有完成P5评测/校准，Gate 3仍未通过，阈值保持60/65/76/floor50。

batch-03编号11–15已完成用户标签和决定审计；batch-04编号16–20经独立QA核对来源身份、URL、UTC时间、北京时间、hash、正文引用与摘要均通过。独立QA报告见`.data/fiscal-qa/luna-gold-record-qa-20261019/batch04-independent-qa.json`，详细状态见[10月19日Gold检查点](HANDOFFS/P5_GOLD_BATCH02_REVIEW_2026-10-19.md)。材料与正文仍只保存在ignored目录，不将正文复制到Git。

### 用户偏好观察：15条人工样本仅用于辅助初判

此次15条人标（9 `select`、6 `reject`）既是后续自动建议的seed，也已经参与偏好归纳；它们不是独立holdout，不能据此宣称模型准确率或Gate 3完成。正式产品内容边界仍见[用户决定表](GATE2_USER_DECISIONS.md)中的已确认规则。辅助判断与prompt文字均不能把其余85条机器建议算成人工Gold，也不证明模型效果。

**明确观察**：用户选了中央预算公开、会计准则征求意见、彩票资金管理规则/分配数据、地方国库现金管理招标结果、安徽专项债发行现场观察，以及青海超长期特别国债联合监管会（正文有上半年问题整改通报和后续项目核查）。用户拒了证书领取、党支部学习、节前廉政提醒等活动通知。用户也拒了内容带多项业务数字的厦门蓝色金融稿和详述零基预算/财政统筹改革的青岛综合试点稿。

**谨慎推断**：具体制度变化、财政资金安排、可核验执行结果或实质监管发现/动作可能是正向信号；只复述“召开会议”“贯彻落实”、内部学习或事务通知可能是负向信号。但决定取决于正文事实与用户价值判断，不是题材或格式公式：青海会议入选，深圳/青岛落实稿和厦门蓝色金融稿被拒。财经关键词、官方身份、数字密度、地方实践或正式文种都不能单独决定标签；当前样本尚不能解释全部取舍边界，自动建议应保守。

**已确认的新增偏好（2026-10-19）**：有具体措施/成效、但无新制度或财政资金安排的地方金融服务稿放入“全部动态”，精选优先政策、资金和监管重点。决定审计见ignored `.data/fiscal-qa/experience-assisted-review-20261019/user-preference-decision-20261019.json`（SHA-256 `271f2034a2408905e9496fe4334dc2f4a3bcbbb1bd87997301f65d36460bf570`）；observedAt UTC `2026-10-19T14:26:07Z`。三个示例的建议仍为机器推断，不转为人工Gold；v2其他82条与原建议一致。之后6个原null建议经正文/既有规则复核，5项形成机器推断、北京财青论坛保留null。v3 SHA-256 `e1a3e1bc1f80a20676459d4712c0f9bc901b6389d47cc907c79b1483127ad993`，30 select、54 reject、1未分类；仅6条相对v2变化，其余79条一致。85项均不是人工Gold；此前蓝色金融和青岛改革等样本取舍仍不能由此偏好解释。

QA依据仍是[用户已确认的内容边界](GATE2_USER_DECISIONS.md)：无实质业务事实的内部活动排除，新政策、问题发现、监管措施和调研成果纳入；这不是新增硬阈值。85条首轮机器建议为29 select、50 reject、6未分类。原始分片有30条`needsHumanReview`标志，已由QA按正文与既有边界复核；其中27条无需用户另行定标签，3篇地方金融服务稿的优先级已获用户原则确认。A/B分片与合并QA文件仅在ignored目录`.data/fiscal-qa/experience-assisted-review-20261019/`，具体索引见当前handoff。用户抽查材料隐藏建议标签、置信度和理由，自动建议另存供QA查看。15条seed已参与归纳，不能作为独立holdout；未来holdout须在读者看不到建议时盲审并按事件组隔离，本轮不自动分配split。完整Gate 3仍需按计划完成development/holdout评估、错例审阅和门槛确认；本轮经验归纳不等于Gate通过或校准。

## 2026-10-18 当前状态补充

本页后续旧段落按各自日期保留。尤其是原始“Gate 2仍未通过”只代表2026-10-03时点；正式当前结论以[Gate 2 review](GATE_2_REVIEW.md)为准：`PASSED_FOR_BOUNDED_P4_PILOT`，不表示Gate 3通过。

8条现有DRAFT中，7条有可读非空正文且通过身份与内容证据比对，另1条附件失败候选只有DOM观察、无正文/内容hash/canonical Article ID，继续作为hold，不加入可评测样本。7条分为4条中央政策/财政监管业务候选和3条内部活动噪声候选；都仍待人工标注，未确认选择、事件组或开发/留出划分。清单验证仍为`DRAFT_INCOMPLETE`（8 candidates、0 confirmed、8 pending、0 schema issues）。2026-10-18本地只读核验按article ID、URL、source ID、日期、content hash、body SHA和非空状态逐项匹配7篇；厦门养老财政监督候选的错误title已按source artifact及同ID数据库字段修正，before/after与证据定位见本地完整性报告。审阅包与正文仅保存在忽略目录`.data/fiscal-qa/p5-gold-review-20261018/review-packet.md`；不得将正文复制进Git。每例提供既有schema所需`humanAnnotation.confirmedBy/confirmedAt`、event group与split确认栏；这些是留空待标注，不是预填值。该7篇可启动人工审阅，但远少于100–200条评估目标，不能做质量/校准结论。

`scripts/eval-selection.ts`及原有gold review packet validator继续作为现成工具；在真实人工labels、event groups、split确认落定前不运行评测，也不新建导入/评测框架。付费provider route及OCR维持用户延期决定。

### 2026-10-18 100条分层候选更新

本轮基于现有主隔离库只读快照生成了100条可供人工审阅的metadata-only候选，版本化清单为[`gold/candidates-2026-10-18.json`](gold/candidates-2026-10-18.json)，正文和本地review packet仍只在忽略目录`.data/fiscal-qa/gold-candidates-20261018/`。独立核验100个case/article/URL唯一、40个来源，100个body文本SHA与逐篇source snapshot一致，原8模板中7个可读正文候选均保持同article/hash/标题，附件失败hold被排除；当前validator为`DRAFT_INCOMPLETE`、0 issues、5 confirmed、95 pending。分层为financial-debt 31、regional-fiscal-supervision-business 34、internal-activity-noise 20、policy-and-institutional-updates 15；宽泛的政策与机构动态桶不表示其中每条都是中央材料，真正中央机构候选仅7条（mof-policy-release 4、mof-accounting-notices 2、mof-budget-work 1）。

该次快照中100/100 sourceTier为T1；不能据此声称T1.5/T2门槛已校准、样本代表性已证明、8种ITEM_TYPES都已覆盖，或NFRA、中国政府网/未来来源覆盖完成。用户已对首批5条确认decision均为reject，并提供共同理由“不是需要关注的重点工作”，只存入ignored理由审计；现有`humanAnnotation`不包含reason字段，未扩展候选schema。其余95条decision仍pending。全部eventGroup与split仍待确认，完整可评测数据集尚未就绪，真实provider评测未运行。`eval-selection.ts`及既有validator保留为后续人工完成后的工具，当前selection thresholds 60/65/76/floor50不变。

## 范围与结论

截至2026-10-22，150项人审标签和event/split技术核验已完成，均分配为development；独立holdoutCount=0。正式模型评测/校准仍`NOT_RUN`，Gate 3未通过。Gate 2当前正式结论为`PASSED_FOR_BOUNDED_P4_PILOT`；下方旧文字中“Gate 2仍未通过”是本页2026-10-03历史时点，按页面首段所指的正式review更新。下一项Gate 3数据依赖是50条全新、事件不重叠的正文合格样本，先冻结预测再盲审；不把已有150条或15个seed重用为holdout。选择标准、提示词和真实阈值未改。

仓库已有 `docs/selection.md` 和 `scripts/eval-selection.ts` 规定的Gold JSONL合同：每行含`caseId`、`material`、`sourceFacts`、`samplingContext`及人工`gold.decision`，并带可评测正文；决定值为`select`、`reject`、`either`。示例`industry/gold.example.jsonl`明确是虚构示例，不能当作真实金标。新文件`gold/metadata-template.json`是有意标注为`p5.gold-metadata-draft/v1`的**准备清单**，沿用现有字段名/含义并补充证据引用、事件组、建议和确认状态；不复制受忽略目录中的正文，因此它不是`.data/gold.jsonl`，也不能直接传给`eval-selection.ts`。确认人工标签后仍需经单独授权的整理步骤，把正文填入既有合同并将人工决策映射到`gold.decision`。

原`gold/metadata-template.json`仍含8条可追溯候选，覆盖中央预算、福建监管、厦门监管业务、内部活动噪声和附件保护失败；另有metadata-only 100候选清单供人工扩展审阅，详见本页2026-10-18最新段落及`gold/candidates-2026-10-18.json`。原8条及新100条`humanAnnotation`均为`decision=null/status=needs_review`；Luna建议独立存于`proposal`，任何候选判断都不被计作人工真值。事件组和开发/留出分配也都待人工确认，避免未经审阅的分组被误当成无泄漏划分。

## 候选及证据引用

| 候选 | 来源、日期和已有证据 | 待人工查看的侧重 | 当前状态 |
|---|---|---|---|
| `fiscal-budget-qa-20260326` | 预算司；2026-03-26；正文结果`ok`/2272字；article `h7rei2mhmazonk5k4gzc8v0sg`；body hash `b1d0a0…33fe08` | 中央预算公开政策问答；判定其新增性与面向读者的价值 | needs_review；Luna `select`提案 |
| `fiscal-fujian-tax-refund-review-20260922` | 财政部监管局汇总选登福建监管局稿；列表日2026-09-22；正文`ok`/1659字；article `ezr1be73mfw81fptbt5ht1zom`；body hash `8293e1…bceb6e09` | 增值税即征即退复查、违规退税风险与整改动作；源名按汇总栏目记录，不误称福建源已配置 | needs_review；Luna `select`提案 |
| `fiscal-xiamen-performance-review-20260911` | 厦门监管局；2026-09-11；正文`ok`/233字；article `g508u1u2h9se3q8s24jnc5e5j`；body hash `d9fc3a…7ab68e2` | 消费品以旧换新绩效评价调研及资金/项目核查范围；短文也需看实际业务事实 | needs_review；Luna `select`提案 |
| `fiscal-xiamen-internal-lecture-20260901` | 厦门监管局；2026-09-01；正文`ok`/379字；article `hno9ui8zm9zpkrul3dk06xpab`；body hash `5cedb0…745031e5` | 公共机构绿色低碳讲堂和内部倡议；作为业务相关性噪声候选 | needs_review；Luna `reject`提案 |
| `fiscal-xiamen-elderly-budget-supervision-20260918` | 厦门监管局；2026-09-18；正文`ok`/223字；article `zb3fipqqz448d9np18nmtbb5m`；body hash `7a8a5f…27769bd8` | 农村养老服务财政保障调研及补助资金绩效跟踪；摘要性事实是否足以纳入由标注者判断 | needs_review；Luna `select`提案 |
| `fiscal-accounting-consultation-attachment-failure-20260715` | 会计司；2026-07-15；详情HTTP 200；direct extract `unconfirmed/attachments_unprocessed`；无正文/content hash；DOM观察raw SHA `eeb3c8…c1868e313` | 作为抽取失败边界样本；不能因为标题像征求意见函就猜正文标签。`sourceArticleId=null`，显式保留synthetic `diagnosticId`，不冒充canonical文章ID | needs_review；提案为空 |
| `fiscal-xiamen-research-fund-theme-day-20260911` | 厦门监管局；2026-09-11；正文`ok`/342字；article `kgfp0wwi0qdicori1i54da9ev`；body hash `ec94e0…a08f51f` | 科研经费监督作为活动主题，但正文以参观/主题党日为主，检查是否报告真实监管结果 | needs_review；Luna `reject`提案 |
| `fiscal-xiamen-party-study-20260918` | 厦门监管局；2026-09-18；正文`ok`/258字；article `oqa76t33ohjnh062u79g3jb9f`；body hash `db480d…843b87` | 党支部理论学习会议稿，作为内部活动噪声候选 | needs_review；Luna `reject`提案 |

URL、完整hash与Ignored evidence artifact位置都保存在JSON清单中。正文仍在先前隔离结果/只读证据中，报告和模板只保留引用。P3人工短文复核曾作出的内容判断只作为待审建议，不等于产品使用者确认的Gold标签。

## 验证器与准入约束

新增命令：

```bash
node scripts/fiscal/gold-dataset.ts validate docs/fiscal-finance/gold/candidates-2026-10-18.json --seed-case-ids path/to/audited-seed-case-ids.json
```

它只读取manifest和显式seed清单，并检查字段、decision词表、HTTP(S)引用、SHA-256格式、文章/诊断身份、确认信息，同一`eventGroupId`不得分到development和holdout，以及任何preference seed不得进入holdout。`--seed-case-ids`必须指向JSON字符串数组，数组项是manifest的`caseId`；没有seed时也必须传显式空数组`[]`。漏传参数、无效清单、空/重复/未知ID或seed分入holdout均失败关闭。报告带`seedCheck.status`、条目数和seed文件原始字节SHA-256；旧的程序化`validateManifest(input)`调用仍可用，但seed检查显示`not_run`，不得据此把数据集视为ready。既有15条人工决定的seed身份仍以原有用户决定/审计记录为准；本次没有重建、替换或提交seed清单。

`READY_FOR_EVALUATION`还要求真实人工标签、已确认或带完整provenance的agent_verified事件组与split、已确认文章身份、`bodyStatus=ok`、有效`contentHash`与`bodySha256`，并有非空正文；附件失败或无body hash的记录永远留在`DRAFT_INCOMPLETE`。验证器不请求网络、不读写DB、不运行模型、不触发`eval-selection.ts`，也没有任何校准/阈值写入命令。退出状态可区分结构无效（`SCHEMA_ERROR`，exit 2）、schema正确但尚未完备（`DRAFT_INCOMPLETE`，exit 3）和准备内容可送入单独评测整理流程（`READY_FOR_EVALUATION`，exit 0）。后一状态仅代表静态字段/确认/正文条件满足，绝不表示模型已评测或阈值已校准。

**只要有任一待确认标签、未确认且未独立核验的事件组/切分，或正文尚未按现有评测合同整理，数据集就不完整，不得开始校准或改阈值。** `proposal`永远不能填充或推导`humanAnnotation`。即使之后验证为`READY_FOR_EVALUATION`，也不能代替开发集和留出集模型评估、人工审阅错例、样本量/代表性判断或Gate 3审批。现有门槛仍为T1=60、T1.5=65、T2=76，`understandFloor=50`；本轮未改。

事件分组必须按真实事件而不是单篇文章切分：同事件不同源、转述和后续报道要先归入同一event group，再整体放入development或holdout。若跨split复用eventGroupId，验证失败；证据不足的分组/切分状态保持`needs_review`，不能由唯一URL自动推断事件独立。明确事件可由agent独立核验，但必须留下完整provenance并通过独立QA。`either`仅沿用既有合同表示两可，不能被当作决定性准确率样本。

## 验证与状态

- 历史focused tests（seed guard加入前）：`node --test tests/fiscal-gold-dataset.test.ts`，6/6通过；历史8候选模板验证为`DRAFT_INCOMPLETE`、0 confirmed、8 pending、exit 3。当前CLI已要求`--seed-case-ids`，这条旧命令记录不再是当前可执行语法。
- 2026-10-21 focused tests：`node --test tests/fiscal-gold-dataset.test.ts`，9/9通过，覆盖显式空seed、holdout防泄漏、缺参兼容API不冒充ready、空白/重复/未知ID拒绝及SHA审计。100候选seed rehearsal为`DRAFT_INCOMPLETE`、15 confirmed、85 pending、seed checked 15、0 seed issues、exit 3。
- “可评测”测试使用仅存在于测试内的合成正文，不引用或复制任何存档原文；不调用模型。
- 本轮没有运行`eval-selection.ts`、没有数据库或网络访问、没有实际阈值校准。

## 风险、阻塞与下一步

当前8条只是带有可复核出处的小型候选集，不满足文档建议的100–200条样本规模，也不能支撑统计性阈值校准；holdout只有候选分配且未获人工确认。部分候选是围绕厦门监管源的短文对照，分层有意用于判断会议/培训噪声，但不能代表全部12源，更不能代表35个地方监管局。汇总选登是财政部汇总栏目，不等同35局全覆盖。

附件失败样本只有列表/DOM诊断证据，没有可评正文；应保留为抽取状态/拒绝边界样本，不能用它虚构新闻内容。其诊断ID为合成诊断标识，canonical文章ID未知。保存摘要不包含正文原文，hash只是去重/证据指针，不证明标签正确。

**唯一所需人工输入**：请指定谁作为未来读者代表确认每条候选的`select/reject/either`、事件分组及development/holdout切分；在确认人、标签和分组规则提供前，Gold校准继续`NOT_STARTED`，阈值保持原值。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：准备P5 Gold Dataset的安全元数据清单及离线验证器，不开始评测/校准。

**MODEL**：Luna High；没有向项目provider调用模型。

**FILES_CHANGED**：新增`[gold-dataset.ts](../../scripts/fiscal/gold-dataset.ts)`、`[fiscal-gold-dataset.test.ts](../../tests/fiscal-gold-dataset.test.ts)`、`[metadata-template.json](gold/metadata-template.json)`及本报告；未修改P4/A文件、source config、共享STATUS、正文、数据库或Git index。

**TESTS_RUN**：`node --test tests/fiscal-gold-dataset.test.ts`（6/6）；`node scripts/fiscal/gold-dataset.ts validate docs/fiscal-finance/gold/metadata-template.json`（预期DRAFT_INCOMPLETE/exit 3）；`npm run typecheck`通过；`git diff --check`退出0。未运行全仓test或评测。

**RESULT**：校验器能挡住结构错误和同事件跨开发/留出集泄漏；8条真实候选均没有用户确认标签，模板保持DRAFT_INCOMPLETE。P5准备工具已具备，Gold校准仍未开始。

**RISKS**：清单样本量和来源覆盖都不足；厦门监管活动噪声候选偏多；标签提案不是用户真值；附件失败样本正文未知；元数据准备清单不等于现有评测器可直接消费的Gold JSONL。

**BLOCKERS**：缺少指定人工标注者及其标签、事件group和split确认；还需经单独授权整理出正文齐全的现有Gold JSONL格式，后续才可评测。

**NEXT**：Root/QA只读审查本工具和候选证据；由目标读者逐条确认当前8条是否作为样本及标签/group/split；再按用户认可的分层增补到足以支撑有意义评估的规模。所有pending labels清零并复核事件组泄漏前，不运行模型评测、校准或门槛修改。Gate 2未通过前本报告仅限P5安全准备，不开启P4生产模型或任何worker。

## 2026-10-09 Gold人工审阅packet导出准备

经Root单独授权，为既有8条metadata draft增加了一个离线Markdown packet导出器：`scripts/fiscal/gold-review-packet.ts`，测试在`tests/fiscal-gold-review-packet.test.ts`。冻结版V3代码提交为`2664e1fa817d9f1242fc9b227d3bbcde6b1b8d66`，已推送。实现由并行actor完成；本阶段调度metadata为GPT-6 Luna / high，未调用项目provider或读取正文。V3 ignored preview为`.data/fiscal-qa/p5-gold-review-packet-20261009-v3.md`。

packet列出标题、来源ID/类型、来源材料名、发布日期、文章ID或诊断ID、HTTP(S)原文链接、正文状态及已有hash；不会打开正文引用或复制正文，也不写回metadata。V3添加了与validator合同对应的`humanAnnotation.confirmedBy`和`confirmedAt`人工填写项。它还留空Gold decision（`select`/`reject`/`either`）、标注理由、event group确认/修订、development/holdout确认。V2曾显示proposal decision/rationale；冻结版V3保留input metadata中的proposal，但不显示其具体内容以减少锚定。缺正文候选继续保持不可评测状态。

独立owner报告冻结版V3专测6/6、`npm run typecheck`和`git diff --check`均通过；本报告owner没有重跑这些检查。V3复用validator、补全`confirmedBy`/`confirmedAt`人工输入，输出通过`wx`独占新建避免覆盖；测试临时目录位于`os.tmpdir()`且匹配专用前缀后才递归清理。V3不显示proposal decision/rationale，输入metadata保持不变。独立fresh full QA在`gold_packet_qa_corrected_20261009_test`完成35 migrations，backend 357/357、0 skip、exit 0；typecheck、Web build、Web tests 15/15通过。该轮preflight限定fake provider路径、无真实凭据/endpoint/proxy，P4 opt-in unset、副作用开关关闭；外部模型调用和source body extraction均0。首轮错误配置`MODEL_CALLS_ENABLED=false`导致25个model-disabled fixture failures；这是runner配置无效轮，保留原记录，不作产品失败。复用失败DB的中断轮输出不完整，日志被corrected同名输出覆盖，明确记录该历史缺口。单次GitHub Check run [37942455582](https://github.com/revercgy-hub/MYHOT/actions/runs/37942455582)对精确SHA `2664e1fa817d9f1242fc9b227d3bbcde6b1b8d66`成功，Check和Docker均pass；文档仍未包含在该CI中。8条`humanAnnotation`仍全部`decision=null/status=needs_review`；packet没有确认任何标签、事件组或split。因此P5仍`NOT_STARTED`，实际评测与校准仍`NOT_RUN`，Gate 3未通过，样本规模/覆盖不足的问题不变。任何标签或分组确认必须来自人工；不得从proposal推导Gold。

**MODEL**：GPT-6 Luna / high（按Root确认的spawn metadata记录）；未调用项目provider。

**FILES**：并行实现owner新增`gold-review-packet.ts`和`fiscal-gold-review-packet.test.ts`，提交`2664e1fa817d9f1242fc9b227d3bbcde6b1b8d66`已推送，并创建ignored V3 preview；本报告仅记录，不更改其文件。

**BLOCKERS**：仍需目标读者逐条确认8个候选是否纳入及decision、event group与split。此packet只是可填写的审阅材料，不扩充样本、不完成标注、不触发Gold JSONL assembly或模型评测。

**NEXT**：由目标读者确认8个候选的decision、event group、split、`confirmedBy`和`confirmedAt`；再依据认可分层补充样本。Gate 3评估、校准和门槛调整仍需另行授权，阈值保持不变。
