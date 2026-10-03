# P5 Gold Dataset readiness（2026-10-03）

## 范围与结论

P5目前仅完成元数据准备与离线校验工具，`P5=NOT_STARTED`、实际模型评测/校准=`NOT_RUN`、Gate 3未通过。Gate 2仍未通过；本工作不打开采集、worker、模型或OCR，不写业务数据库，不改来源配置、选择标准、提示词或真实阈值。

仓库已有 `docs/selection.md` 和 `scripts/eval-selection.ts` 规定的Gold JSONL合同：每行含`caseId`、`material`、`sourceFacts`、`samplingContext`及人工`gold.decision`，并带可评测正文；决定值为`select`、`reject`、`either`。示例`industry/gold.example.jsonl`明确是虚构示例，不能当作真实金标。新文件`gold/metadata-template.json`是有意标注为`p5.gold-metadata-draft/v1`的**准备清单**，沿用现有字段名/含义并补充证据引用、事件组、建议和确认状态；不复制受忽略目录中的正文，因此它不是`.data/gold.jsonl`，也不能直接传给`eval-selection.ts`。确认人工标签后仍需经单独授权的整理步骤，把正文填入既有合同并将人工决策映射到`gold.decision`。

当前清单含8条可追溯候选，覆盖中央预算、福建监管、厦门监管业务、内部活动噪声和附件保护失败。8条`humanAnnotation`均为`decision=null/status=needs_review`；Luna建议独立存于`proposal`，任何候选判断都不被计作人工真值。事件组和开发/留出分配也都待人工确认，避免未经审阅的分组被误当成无泄漏划分。

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
node scripts/fiscal/gold-dataset.ts validate docs/fiscal-finance/gold/metadata-template.json
```

它只读取manifest并检查字段、decision词表、HTTP(S)引用、SHA-256格式、文章/诊断身份、确认信息，以及同一`eventGroupId`不得分到development和holdout。`READY_FOR_EVALUATION`还要求人工标签、事件组和split均已确认，存在已确认文章ID、`bodyStatus=ok`、有效`contentHash`与`bodySha256`，并有非空正文；附件失败或无body hash的记录永远留在`DRAFT_INCOMPLETE`。验证器不请求网络、不读写DB、不运行模型、不触发`eval-selection.ts`，也没有任何校准/阈值写入命令。退出状态可区分结构无效（`SCHEMA_ERROR`，exit 2）、schema正确但尚未完备（`DRAFT_INCOMPLETE`，exit 3）和准备内容可送入单独评测整理流程（`READY_FOR_EVALUATION`，exit 0）。后一状态仅代表静态字段/确认/正文条件满足，绝不表示模型已评测或阈值已校准。

**只要有任一待确认标签、未确认事件组/切分，或正文尚未按现有评测合同整理，数据集就不完整，不得开始校准或改阈值。** `proposal`永远不能填充或推导`humanAnnotation`。即使之后验证为`READY_FOR_EVALUATION`，也不能代替开发集和留出集模型评估、人工审阅错例、样本量/代表性判断或Gate 3审批。现有门槛仍为T1=60、T1.5=65、T2=76，`understandFloor=50`；本轮未改。

事件分组必须按真实事件而不是单篇文章切分：同事件不同源、转述和后续报道要先归入同一event group，再整体放入development或holdout。若跨split复用eventGroupId，验证失败；人工尚未审阅的分组/切分状态保持`needs_review`，不能由唯一URL自动推断事件独立。`either`仅沿用既有合同表示两可，不能被当作决定性准确率样本。

## 验证与状态

- Focused tests：`node --test tests/fiscal-gold-dataset.test.ts`，6/6通过；覆盖DRAFT不完备、提案不升级人工标签、schema错误与退出码区分、同事件跨集泄漏拒绝、完整合成样本的就绪状态、正文未确认/缺hash不得就绪。
- Template validator：返回`DRAFT_INCOMPLETE`、8 candidates、0 confirmed、8 pending、无schema issue，exit 3（预期）。
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
