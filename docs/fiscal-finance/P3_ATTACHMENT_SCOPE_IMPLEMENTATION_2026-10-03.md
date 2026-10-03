# P3 HTML 附件范围实现（离线）

DATE=2026-10-03（Asia/Shanghai）
BASE_HEAD=4ba0f8bb333121a8ee3f1a9ce4ded6113ee0dee7（实现开始时实测；变更未提交）
S1=APPROVED（仅通用scope及离线验证）
GATE_2=NOT_PASSED

## 实现

按 [S1 范围裁定](S1_P3_ATTACHMENT_SCOPE_REVIEW_2026-10-03.md) 增加可选 `detail.attachmentScopeSelector`。helper 要求 scope 为 trim 后非空、最多500字符，依附 bodySelector 或 bodyPolicies，且不与 articleSelector、attachmentSelector、attachmentMode、pdfDirect 显式配置并用。scope 在同一 Cheerio DOM 中必须唯一、是最终正文 container 的严格祖先；拒绝无匹配、重复、非法 CSS、相等/兄弟选择器及 html/body/blocked navigation 元素。所有scope错误返回 `attachment_scope_invalid` 并不扫描全页。

显式scope仅扫描其全部后代 anchor；不排除scope内 nav/footer。正文或正文外 sibling 的PDF样式链接仍为 `attachments_unprocessed`；scope外PDF不参与本次保护。无scope时保持文档级扫描。链接识别和相对URL解析规则未改变，未新增格式或附件解析。身份检查现在先于附件拒绝；唯一正文选择、非空正文及已有表格布局检查仍按原顺序，最小字数检查仍在附件拒绝之后。PDF envelope/direct路径拒绝scope；web-list详情预取与extractFromUrl共享body driver并传递scope，配置错误在extractFromUrl发请求前拒绝。collector/body配置门控未扩展，scope单独声明不触发抓取。`industry/sources.json`没有改动，具体行业scope值仍待完整DOM证据核销。

## 离线证据

新完整HTML外壳 fixture `tests/fixtures/fiscal-attachment-guard/scoped-article-shell.html` 在文章祖先scope外放置页脚PDF；原有footer/nav/body/type/query-fragment fixtures保留。

Focused测试证明无scope时页脚/nav PDF仍拒绝，给同一文章范围 opt-in 后页脚PDF可排除；scope内正文PDF、正文外下载区sibling PDF和scope内nav PDF仍拒绝。另覆盖相对PDF路径、`application/pdf`、query/fragment假后缀、scope零/多匹配、非法CSS、空/错误类型/超长值、html/body/nav、正文同一元素、兄弟scope、web_list组合与其他source kind拒绝、PDF冲突、详情预取与extractFromUrl传递、畸形driver配置在fetch前拒绝。错身份加PDF返回 `identity_mismatch`；identity匹配时PDF仍为 `attachments_unprocessed`；短正文仍由附件拒绝优先于长度reason。

实际命令：

```powershell
node --test tests/fiscal-attachment-guard.test.ts tests/fiscal-accounting-body-policy.test.ts tests/selected-body.test.ts tests/pdf-body.test.ts
npm run typecheck
```

结果：focused tests 34/34通过，typecheck退出0。没有运行数据库迁移、全套测试、web build、网络请求、模型或OCR。Git index保持空；QA可在本轮实现稳定后运行全套回归。工作树当前HEAD仍为 `BASE_HEAD`，代码是未提交工作区变更，不能将该HEAD称为本实现tested code SHA。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：按已批准S1实现最小可选HTML附件扫描scope与identity优先级，并做离线验证。
**MODEL**：Luna High；未调用项目运行时模型。
**FILES_CHANGED**：`packages/backend/src/content/selected-body.ts`、`packages/backend/src/content/pdf-body.ts`、`packages/backend/src/sources/config-keys.ts`、`packages/backend/src/sources/web-list.ts`、`packages/backend/src/content/extract.ts`、`tests/fiscal-attachment-guard.test.ts`、新fixture `tests/fixtures/fiscal-attachment-guard/scoped-article-shell.html`、本文。未改QA文档/Index、行业来源配置、apps、migration或Git index。
**TESTS_RUN**：上述四组focused Node tests（34/34）及 `npm run typecheck`（通过）。
**RESULT**：通用scope实现与driver/config边界通过focused离线测试；无scope旧行为与附件保护保持。
**RISKS**：scope包含正文不证明覆盖所有真实业务附件；HTTP href/type信号也不证明远端文件真实MIME。行业配置值未核销，不能据此重试或解释此前真实页面。identity-first仅改变身份与附件同时失败时reason优先级。
**BLOCKERS**：QA全套回归未运行；真实来源scope值仍须按S1另行核验完整DOM。
**NEXT**：交QA复核并跑全套回归；由Lead单独核销后再做任何真实页面GET或行业配置更改。
