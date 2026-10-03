# S1：P3 HTML 附件检查范围裁定

DATE=2026-10-03（Asia/Shanghai）
REVIEWER=gpt-6.1-sol / medium
DECISION=APPROVED（scope only：通用可选 scope、离线 fixture 与必要传递）
INDUSTRY_SCOPE_VALUE=CHANGES_REQUIRED（先核销 DOM 证据，不在本批准中写入行业配置）
GATE_2=NOT_PASSED

本次唯一 S1 静态审查读取 AGENTS、README、PROJECT_PLAN、STATUS、最新 P3_DIAGNOSTIC_CHECKPOINT、附件 guard characterization、S1_P3_OCT03_IMPLEMENTATION_REVIEW，以及 selected-body/pdf-body/config-keys/web-list/extract/collect 的实际代码、相关 tests/fixtures 和 ignored 会计司缓存。未运行测试、网络、数据库、模型或 OCR；不重做实现调查。实现与验收由 Luna 完成，Lead 按本文最小条件核销，无需重复 Sol。

## 证据与最小选择

`pdfLinks()` 当前扫描整个 document 的 `a[href]`。helper 选中非空正文后先拒绝 PDF 外观链接，之后才检查身份、表格及最小文字数。新增 characterization 报告记录 5/5：正文外 footer/nav 也能触发拒绝，query/fragment 中的 `.pdf` 本身不触发；这是离线分类事实，不证明真实附件 MIME 或业务关联。

可读的三份会计详情缓存分别为 `.data/fiscal-central-audit/html/mof-accounting-detail.html` 与 `.data/fiscal-source-checkpoint-20261002/detail-t20260904_3996714.htm.html`、`detail-t20260920_3997803.htm.html`。这些文件没有 `.pdf`/`application/pdf` anchor。原始 HTML 中正文 `.my_doccontent` 与附件 `div.gu-download:has(> p#down-tit1):has(> ul#down1)` 是 `.my_conboxzw` 内的兄弟区域，再由 `.box_content` 包围；另有一个用于相关文章的 `.gu-download`。征求函真实链接为两条 DOCX，9/4表格与9/20题名页各有 XLSX。现有精简正文 fixtures 没有保留完整文章外壳，不能用它们单独证明附件区域覆盖。

这支持“正文祖先可能包围真实附件”的结构方向，却不证明 July14 响应的 PDF 在哪里。July14 single extract 未保存 HTML，9/4新 policy live verify 同样未留 raw；旧缓存不能补写新响应的原因。本轮禁止把 `attachments_unprocessed` 改称导航误拒或真实 PDF 附件。

批准一个可选 `detail.attachmentScopeSelector` 字符串，声明 HTML 文章范围。它只限定 PDF 候选扫描，不解析附件、不缩短正文、不添加 fallback。无声明时继续整页扫描，既有 bodySelector/bodyPolicies 的接受条件不变。无需全局 nav/footer 排除规则，也无需每条 policy 的范围数组、排除 selector、附件分类框架或新的信息抽象。

## Shape、运行行为与配置校验

- 支持 `web_list` 的显式 `bodySelector` 或 `bodyPolicies` 路径；scope 必须依附其中一种有效正文配置，不能单独启用抽取。字符串 trim 后非空且长度最多500；非字符串、null、数组、对象及空值均拒绝，不静默忽略。
- 与 `articleSelector`、`attachmentSelector`、`attachmentMode`、`pdfDirect` 的任何显式声明互斥；既有 bodyPolicies 与 legacy/PDF 的互斥规则保留。source 配置校验和直接 helper/共享 driver 调用均须 fail-closed，不能依赖仅管理入口校验。
- 在原 HTML 的同一个 Cheerio DOM 选择 scope，必须恰有一个 element，且为最终唯一正文 container 的严格祖先；拒绝无命中、多命中、非法 CSS、与正文相同、正文外兄弟区域或其他不包含正文的范围。拒绝 document/html/body 和已禁止的导航类 container 作所谓文章范围。允许普通文章祖先中的附件区域，无需修改正文 selector 去包入附件。
- 验证失败统一可用 `attachment_scope_invalid`，body=null。scope 内扫描全部 anchor，不跳过其 nav/footer，不按名称或样式猜业务关联。正文内和正文外但 scope 内的 PDF 外观链接均继续 `attachments_unprocessed`；识别、相对 URL 解析、协议、pathname/type 规则沿用原 helper。scope 外链接只在明确 opt-in 时不参与保护。
- 单凭包含正文不能自动证明包含真实附件。因此行业值必须由完整 DOM 证据核销；不能将 `.my_doccontent`、`.TRS_Editor` 或“仅正文扫描”作为快捷修复。`.my_conboxzw`/`.box_content` 目前仅是待验证候选，本审查不直接批准任何具体行业值。
- 现有 PDF envelope 使用自己的 article/attachment contract 和 `pdfAttachmentsPrevalidated` 内部选项，不接受新 scope；不把新 scope 当作附件已经处理。`extractConfiguredHtmlBody` 继续统一驱动详情预取与正文 job，失败不能回退 Readability/Jina。

必要文件只限 `packages/backend/src/content/selected-body.ts`、`packages/backend/src/sources/config-keys.ts`、`packages/backend/src/sources/web-list.ts`、`packages/backend/src/content/extract.ts`；`pdf-body.ts` 仅允许互斥校验的最小兼容。SelectedBodyConfig 增加字段后 PdfSourceBodyConfig 自然继承；两个实际配置构造入口显式传递字段。`collect.ts` 现有 bodySelector/bodyPolicies 门控已足够，scope 不触发新 fetch，无需修改。tests 使用现有 attachment/selected-body/source-rules/pdf-body/policy 测试及最少必要 fixtures。禁止 apps、schema、模型、OCR、评分阈值及新增附件格式变更。

身份先检查可作为同次小改动批准：把既有 identity 检查移到附件拒绝之前，仍在唯一有效正文选择后，不增加网络或降级路径。只改变多个失败条件同时成立时的 reason 优先级，未声明 scope 仍整页扫描；须更新相应 characterization 和明确记录新顺序。此项不是修复 scope 的必需前置；不顺势重排表格/长度检查或改阈值，也不为旧 live 响应补推身份结论。

## 最小离线核销

1. 相同完整 fixture 的无声明配置仍因 footer/nav PDF 拒绝；声明文章 scope 后正文成功，证明只改变 opt-in 行为。scope 内的正文 PDF及正文外真实附件 sibling PDF 必须均拒绝；scope 内 nav PDF 也拒绝。保留 relative URL、type=application/pdf、query/fragment 边界。
2. 无命中、重复 scope、非法 CSS、错误类型/空值/过长字符串、scope==正文、scope 只选附件 sibling、html/body/nav 范围全部拒绝。scope 无匹配时不能退回 document，也不能返回正文成功。
3. 配置测试覆盖 web_list 有效组合、缺正文配置、rss/json_list 声明拒绝、PDF envelope/direct 的全部互斥和旧配置默认通过。直接 helper/driver 的畸形配置也拒绝。
4. 假 fetcher 证明详情预取与 extractFromUrl 使用相同 scope、产生相同拒绝/正文，不追加附件请求、不落入 Readability/Jina；现有 collector 预算和 policy-only 门控不变。若实施 identity-first，PDF+错身份改得 identity_mismatch，正确身份+PDF仍 attachments_unprocessed，短正文加 scope 外 PDF仍拒绝于长度。
5. 复用既有180字完整表、473字通知、24字XLSX题名及 policy 负例，结果不回退。新增保留原始文章祖先与真实附件 sibling 的完整外壳 fixture；DOCX/XLSX不因本次scope被当PDF，也不宣称已处理。

Luna 在新实现上运行相关 focused tests 与 typecheck，并完成仓库规定的新实现回归；报告实际结果与 tested code SHA。已有5/5或旧CI不等于新scope通过。

## 行业值及真实页面后续核销

先实施通用 scope+fixture，暂不改 `industry/sources.json`。Lead 后续可按单独核销的精确URL做有限 read-only HTML GET，硬 dispatch cap、redirect=0、retry=0、不跟附件，保留响应HTML/hash、时间、最终URL、状态/MIME及预算。用同一实际parser列出scope命中数、正文匹配/祖先关系、所有PDF外观anchor及其scope内外位置，并核对可见真实附件区是否完整包含；缓存页面也须按同一解析DOM验证，避免源文件错误闭合造成文本层级误读。

只有完整证据证明文章范围同时包含正文与真实下载区、scope外被排除链接属于无关页面区域后，Lead 才核销一个具体行业值并以保存响应离线回放。若PDF在业务scope内，继续拒绝，不能缩scope或关闭guard求成功；范围/业务关联无法证明时保持行业默认全页规则。read-only证据本身不改DB body状态，也不授权collector、worker、model、OCR、publication或Gate2。未来真实extract须另核销，不重试旧请求来凑通过。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：唯一 S1 架构范围裁定，修复可证明的HTML附件检查范围问题。

**MODEL**：gpt-6.1-sol / medium；未调用仓库模型服务。

**FILES_CHANGED**：仅新增本文；不改代码、QA index、共享文档、行业配置或Git index。

**TESTS_RUN**：无；仅静态读取真实代码、规约、报告、fixtures、ignored HTML/执行记录和git status。引用5/5为既有报告结果。

**RESULT**：通用可选scope与必要测试/传递 APPROVED(scope)；具体行业值 CHANGES_REQUIRED；身份先检查可有限实施。Gate2仍NOT_PASSED。

**RISKS**：祖先包含正文不等于附件业务全集；href/type不能证明MIME；旧无raw响应原因不可追认；无声明仍可能因页面chrome误拒。

**BLOCKERS**：新实现及完整DOM离线核销未完成；July14真实PDF位置未知，行业值尚未核销。

**NEXT**：Luna按最小文件实现通用scope与fixture，Lead核销新测试，然后另行限定read-only精确实页与行业值；无需重复Sol，不默认关闭guard。
