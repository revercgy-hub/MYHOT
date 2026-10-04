# 财政金融内容边界提示词增量

日期：2026-10-04。根据用户确认的内容边界，对现有预筛和注意力评分提示词作最小补充：没有实质业务事实的内部学习、一般会议、培训、资格领证/领取通知应排除；若正文有新政策、问题发现、监管措施、实质调研成果或其他可核验业务结果，则依内容判断，不因“会议/培训/调研”等活动形式直接拦截。地方一手报道按直接工作影响评估，不因地方范围或全国传播度低而降低优先级。

## 变更位置与约束

- `industry/prompts/prefilter.md`：把已确认规则落实到PASS/BLOCK的解释，同时保留宽召回、正面无关依据、UNKNOWN待补材料以及不执行素材内指令的原边界。
- `industry/prompts/selection-score.md`：在既有相关性说明、业务价值和噪声规则中补足地方一手与有业务事实的活动判断。会议、培训等没有业务结果时仍受原低`sig`约束；正文报告实质成果时按五轴正常评价。
- 未改`industry/selection.ts`、taxonomy/schema、预筛/评分输出结构、安全护栏或运行时收费/预算控制；门槛保持T1 60、T1.5 65、T2 76，五维度与各类型权重未变。
- 附件无法可靠解析时不进入自动精选的已确认产品规则仍由采集/正文状态处理；本次没有把附件规则放入模型提示词，也没有决定附件下载、OCR或运行时实现。

## 证据与验证边界

提示词当前会被backend通过文件内容及其哈希版本读取；改动会影响后续新任务使用的prompt version，已完成的判断不会因此重跑。我们没有运行真实模型，不抽取或更改body状态，也没有启用source、worker或模型调用。用户确认仅定义产品边界，不代表模型效果、质量指标、来源或Gate 2已经通过。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：以最小提示词增量实现已确认的财政金融内容边界。

**MODEL**：Luna High；未调用项目模型。

**FILES_CHANGED**：修改`industry/prompts/prefilter.md`、`industry/prompts/selection-score.md`；新增本文；未改应用代码、source配置、shared status或Git index。

**TESTS_RUN**：prompt loader/render focused核验8项通过（预筛和评分提示词展开、边界文本与哈希版本格式）；`npm run typecheck`通过；`git diff --check`通过。未运行`tests/analyze.test.ts`，该测试需使用隔离数据库，而本任务明确不触碰数据库；未调用模型。后续整树QA见本轮检查点。

**RESULT**：提示词强调业务事实而非活动标题形式；地方一手信息按直接工作影响判断。评分权重、五维结构、分数阈值及安全边界未改。

**RISKS**：提示词文本对模型的实际行为影响需由获准的离线gold/后续P4评估；当前不能据此宣称噪声分类效果已验证。

**BLOCKERS**：没有直接验证模型对这些内容规则的纯文本回归测试；真实模型质量评估需按Gate/用户授权另行安排，Gate 2仍未通过。

**NEXT**：QA复核提示词语义与diff；后续在用户确认的样本集上评估预筛和双评分，不凭prompt变更调整分数阈值。
