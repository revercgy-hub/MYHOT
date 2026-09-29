# 厦门市财政局地方债第十六期 PDF 单篇验证

日期：2026-09-29。此项只调用一次已批准的 `fetchAndParseOfficialPdf()`，没有调用 collector、正文 extraction、HTML 页面或数据库。目标官方 PDF：`https://cz.xm.gov.cn/zwxx/czsj/dfzxx/202609/P020260911578215495483.pdf`；只允许前缀 `https://cz.xm.gov.cn/zwxx/czsj/dfzxx/`。source 配置、正文 selector、短正文策略均未修改，正文全文开关仍关闭。

## 请求与解析结果

- PDF helper 返回底层请求状态 200；响应 `Content-Type: application/pdf`，最终 URL 与输入 URL 完全相同，响应体 457,111 字节。
- 单次请求通过既有 `fetchAndParseOfficialPdf` 安全路径：6 MiB 响应上限、20 秒 fetch deadline、`maxRedirects=0`、HTTPS allow-prefix、HTTP 状态/MIME 与 `%PDF-` 魔数验证均未放宽。未重试、未发生 HTML 二次请求。
- 隔离 PDF parser 返回 `pdf_page_no_text`。worker 在逐页处理时，只要任一页去空白后无文字层就终止整份文件并拒绝；此错误响应不提供总页数、已处理页数或局部 layout。因此本次不能报告完整页数、坐标、文本层覆盖程度或任何表格关键字段。
- 该结果只说明严格文本层解析器发现至少一页无可用文字；没有证据证明其余页面是否可解析，也没有视觉核查。本次不使用 OCR，不推测为整份 PDF 全扫描件，不把附件标作正文 `ok`。

摘要保存在忽略目录 `.data/fiscal-qa/xiamen-debt-round16-pdf-summary.json`。我没有保存原始 PDF bytes：helper 对失败结果只返回固定 reason，不返回响应体；本次单次请求的临时 fetch wrapper 仅捕获了状态、MIME、URL 和字节数。为了遵守单次请求预算，没有再次下载或重试。该限制本身已记录，未将正文或媒体文件写入 tracked 文件。

## 结论

厦门财政第十六期公告的 PDF 正文目前未被该解析路径确认，页数、文本坐标和招标结果字段均为 unknown。来源继续 disabled、全文输出继续关闭；该 PDF 不能作为已成功抓取全文的证据，也不能因此降低厦门地方债官方源优先级。后续可安排独立的小范围诊断并限定请求预算；不能用本次失败结果推断附件内容或覆盖完整性。
