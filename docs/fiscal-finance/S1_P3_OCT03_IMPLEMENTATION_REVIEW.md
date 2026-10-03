# S1：10月3日正文策略与固定 Git Blob 准备范围

DATE=2026-10-03（Asia/Shanghai）
REVIEWER=gpt-6.1-sol / medium
REVIEW_HEAD=08492e0443b68dbffbe036f6b64ea9b6426655f8（只读实测；不是新实现的 tested SHA）
BODY_POLICY_IMPLEMENTATION=APPROVED（scope only，按以下约束核销）
OCR_API_PREPARE_IMPLEMENTATION=APPROVED（scope only，先离线验证，再由 Lead 核销一次准备）
OCR_EXECUTION=CHANGES_REQUIRED（本轮不新增 OCR 基线执行许可）
GATE_2=NOT_PASSED

## 依据与裁定

只读检查 AGENTS、README、PROJECT_PLAN、STATUS、10/2 S1、10/2 会计司正文报告、进程验证报告、两份10/3提案与真实 helper/config/调用门控。10/2 CSS union 加全局 allowShortBody 已观测到身份正确的短多段落及装饰表格误收；纯 CSS 收窄不能表达不同分支的最小正文长度及完整业务行。允许必要的通用 packages 兼容点，财政字段仍在 industry。原有配置行为保持不变。本文件不重做 Luna 研究、不运行网络/测试、不代替实现验收。

### 正文策略：APPROVED（scope only）

允许可选 `detail.bodyPolicies`：每项 `selector`、独立 `minTextChars`，可选 `table.requiredHeaderCells` 与 `table.minCompleteDataRows`。阈值必须有限、正整数；列表非空且有明确合理上限；selector 为非空字符串；表头为非空、无重复的字符串列表；完整行数为正整数。拒绝未知嵌套 key、数组/对象形状错误及非法值，禁止静默忽略。仅支持 web_list；json_list、rss 等声明此项必须被配置校验拒绝。

policy 分支与旧 bodySelector/allowShortBody 以及 articleSelector/attachmentSelector/attachmentMode/pdfDirect 组合本轮互斥并显式拒绝；不扩展旧 PDF envelope。这样避免全局短文开关、PDF notice provisional 语义或旧 selector 被误用成备用策略。未声明 policy 的旧配置走原路径。

逐一计算所有 policy 的 selector 命中：必须恰有一条匹配恰有一个 container。任何非唯一命中、歧义、无匹配、非法 selector、身份不符、结构不符或验证失败均返回拒绝，不择优、重试另一 policy、回退旧 selector/Readability/Jina。保留既有标题、当地日期、非空正文、导航与未处理 PDF 的保护。

表格检查在 sanitize/trim 后的候选内进行，要求唯一明确表格；表头单元格在同一行按配置顺序精确匹配（允许现有 whitespace normalization）；数据行必须在该行之后，与表头同列数且每格非空，至少达到配置行数。按行直接子 cell 关联，不用递归 find 把嵌套表格 cell 混进同一行；嵌套表格、rowspan/colspan 等本轮无法明确支持的结构拒绝。文字数使用清洗后正文。表格通过仅确认此 HTML 的配置结构，不能声明全表记录齐全、附件已处理或业务语义认证。24 字题名+XLSX 必须继续拒绝；不新增附件下载。

最小实现文件：`packages/backend/src/content/selected-body.ts`、`packages/backend/src/sources/config-keys.ts`、`packages/backend/src/sources/web-list.ts`、`packages/backend/src/content/extract.ts`，以及 `packages/backend/src/sources/collect.ts` 详情预取门控的一处兼容。真实 collect.ts 原门控仅识别 d.bodySelector，即使另两入口传递 policy，policy-only 来源也会被跳过；批准改为识别显式 policy，不扩大采集范围。`PdfSourceBodyConfig` 已继承 SelectedBodyConfig，通常无需修改 pdf-body.ts；若发现该共享 driver 会遗漏/降级，仅允许必要 policy 配置存在性判定与传递，不能改 PDF parser/envelope 的验收语义。无 apps、DB schema/migration、评分逻辑或门槛改动。

最小离线验收：复用缓存 180 字完整五列表、473 字嵌套 TRS 征求函与24字 XLSX题名页，同一组 policy 同时接受前两者、拒绝第三者；覆盖错表头/错序、缺列、空数据格、空数据行、装饰表、短 p+p、重叠策略、重复 container、身份/日期错误，以及旧配置默认行为。配置测试覆盖畸形声明、未知 key、阈值非法、互斥组合和 json_list 声明拒绝。入口测试证明详情预取及正文 job 走相同 driver，policy-only 触发受预算限制的详情门控，失败不触发 Readability/Jina。可使用 tests/fiscal-accounting-body.test.ts、selected-body.test.ts、source-rules.test.ts、sources.test.ts 的相关位置及最小必要新测试；不要求机械重复旧6项研究。

行业源配置需在上述离线核销后单独由 Lead 核销精确 policy 值；这项批准本身不授权启用来源、改机器 body 状态或运行 collector。实现所需测试必须在新实现上重跑；旧184项测试结果不能充当新 policy 验收。

### GitHub API 准备：APPROVED（scope only）

限现有开发工具和离线测试。固定仓库 tesseract-ocr/tessdata_fast，commit `87416418657359cb625c412a48b6e1d6d41c29bd`。一次根目录请求精确 URL：`https://api.github.com/repos/tesseract-ocr/tessdata_fast/contents?ref=87416418657359cb625c412a48b6e1d6d41c29bd`。完整目录数组中 chi_sim.traineddata 与 LICENSE 各仅有一个精确 name/path 的普通文件，完整40位 Git blob SHA 与合法 size；两者验证完才发后续请求。后两 URL 只能由这两个 SHA 构造为 `https://api.github.com/repos/tesseract-ocr/tessdata_fast/git/blobs/{sha}`。不信任 download_url/git_url 字段作请求目标；不追加 commit/tree/version 请求。

新独立 ignored 批次总最多3次 request admission、串行、每 URL 一次；120秒每请求、240秒总墙钟，从本批开始包含读取/校验/保存，剩余时间不足不再请求。redirect manual、3xx拒绝、follow0、retry0、fallback0；任何错误立即终止。保留旧两次失败目录与记录；one-shot marker 在联网前独占创建，重复调用及越界路径在联网前拒绝。不追认旧 hop budget，也不归因旧 terminated 为服务器、代理、TLS 或本地 deadline。

目录 JSON ≤1MiB；模型 decoded ≤32MiB、许可 decoded ≤1MiB，总 decoded ≤33MiB。模型 blob **线上 JSON** 必须另设有效 cap，不能复用32MiB decoded cap或只依赖 Content-Length；按 metadata 的 `4*ceil(size/3)` Base64 长度加明确有界 JSON/换行转义开销计算并独立限制。可采用 `2*base64Length+64KiB` 作为严格线上上限（JSON 对 Base64 slash/换行转义的有界余量）；实际 Base64 字符数仍必须等于理论值，解码 size 仍严格等于 metadata。所有流完整EOF、实际线上字节限额和可用长度一致性均核验。

blob JSON 的 sha/size/encoding=base64 与根目录元数据一致；Base64 先严格验证 alphabet/padding/允许的格式换行，再用重新编码比对规范内容，不能依赖 Buffer.from 静默容错。解码后计算 `SHA1("blob "+byteLength+NUL+bytes)` 与 API SHA 对比，再计算 SHA256。许可证核对 Apache-2.0 名称/正文并保存 hash。两文件全部验证通过才写最终文件及 complete manifest；独占临时文件和最后 manifest 原子落盘，以 manifest 最后标记批次完整，失败路径不能留下 runnable 状态。请求日志记录开始/结束、状态、长度、实际bytes、EOF、累计期限和白名单 error name/message/cause code/errno/syscall；不序列化任意 error、header 或环境值，不泄露凭证。

最小文件：scripts/fiscal/ocr-scan-poc.ts 与 tests/fiscal-ocr-scan-poc.test.ts；若三请求路线分为独立小开发脚本，可新增专用脚本及测试，但不引入业务依赖框架。新 manifest 明确 transport/root URL、commit、两路径/blob SHA/size/SHA256/license/request时序。旧 raw manifest 校验不得接受不匹配的 API 身份；run-side 类型兼容仍先校验身份，不自动改变执行锁。

离线假响应验收必须覆盖正确三请求、错误 commit/ref/路径/重复项/文件type/sha/size、畸形目录/blob、非法 Base64、短读/流异常/错误EOF/尺寸/SHA、redirect、encoded/decoded cap、许可证错误、总deadline、失败后停止及重复批次拒绝。确认没有第四请求、错误路径没有请求、失败没有 complete/runnable。Lead 核销新 tested 工具与离线结果后可执行本文件限定的一次三请求准备并保留结果；失败不重试，成功只接受数据身份。

### OCR 执行：CHANGES_REQUIRED

17项 fake-child 与本机短 normal 的72ms首样本、162ms gap及 kill/wait 故障路径是有效有限证据。它不证明 native Tesseract 在实际持续负载下的 cadence/首尾覆盖可靠，也不是硬RSS或进程树隔离证据。本轮仅准备可先做；保持 OCR_RUN_ENABLED=false，不把数据完整当成自动解锁，不新增一次五页基线许可。后续需单独的监控前置方案/真实持续 cadence证据及 Lead 核销，避免把“必须先跑 OCR 才能证明监控”循环当作默认运行授权。五图输入/gold/OCR本轮不运行；业务采集/付费模型/DB/publication 均未获此审查授权。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：一次高价值 S1 范围裁定，限定通用 selector policy 与一次新固定 Git Blob 传输准备。

**MODEL**：gpt-6.1-sol / medium；实现及测试交由 Luna High；未调用仓库运行时模型。

**FILES_CHANGED**：仅新增本文；不碰 QA index、共享 STATUS/交接或实现。

**TESTS_RUN**：只读真实代码/规约/报告及 git rev-parse HEAD；未执行测试、网络、下载、OCR 或数据库。旧测试记录不是新实现验收。

**RESULT**：两项实施 APPROVED(scope only)，须按以上离线及 Lead 核销顺序落地；OCR执行 CHANGES_REQUIRED，Gate2 NOT_PASSED。

**RISKS**：DOM结构规则不能证明业务全集；Git对象hash不是上游签名/模型质量验证；API仍可能中断且Base64增加内存；native持续监控未证。

**BLOCKERS**：新实现离线核销尚缺；OCR监控前置及有效数据尚缺；P3全来源与长期稳定性及历史hop审计仍不完整。

**NEXT**：Luna按独占文件分工实现两项最小改动及新测试，Lead核销后记录一次准备结果和精确工具版本；业务状态/来源配置与OCR放行分别裁定。本文件不是正式 Gate2，也不追认旧预算。
