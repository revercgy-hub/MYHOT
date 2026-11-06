# 第五轮：查证"附件解析和 PDF 这条"，顺手补回 6 篇（2026-11-06）

用户要求：把附件解析和 PDF 这条打开。查证结果与预期不同，先给结论。

## 一、结论：不存在可以"打开"的附件解析子系统

三个候选入口逐个查了：

| 入口 | 实际是什么 |
|---|---|
| `media.prepare` 队列 | **图片件**（OG 分享图渲染，`prepareArticleMedia` → `produceImage`），与附件无关 |
| `OCR_RUN_ENABLED` | 只出现在 fiscal 脚本的环境变量白名单里，**代码中没有任何 OCR 实现**，是空阀门 |
| 附件解析作业 | **不存在**。没有任何队列或 job 处理"已落盘的附件" |

附件真正被处理的地方只有一处，是**配置驱动**的：`attachmentSelector` + `attachmentMode`（厦门债务这个源就配了），走 `pdf-body.ts` 下载并解析 PDF。

而 `attachments_unprocessed` 的产生条件写死在 `selected-body.ts:395-396`：

```ts
const attachments = options.pdfAttachmentsPrevalidated && !divBlockPolicy ? [] : scanAttachments();
if ((!options.pdfAttachmentsPrevalidated || divBlockPolicy) && attachments.length > 0)
  return { body: null, reason: "attachments_unprocessed", attachments };
```

**只要页面里有 PDF 附件链接，抽取器就拒绝拿通知正文交差。** 这是有意的：带附件的政策文件不能只摘要通知部分。所以这个状态不是"待处理"，是"缺 driver 就别过"。

## 二、nfra 更明确：硬拦，开什么都没用

`nfra-json-detail.ts` 第 114–117 行：

```ts
// Even an empty JSON attachment list cannot rebut the non-empty list-side DOC/PDF fields.
// Keep the selector result private; this source is not body-ready until attachment semantics are known.
return { body: null, attachmentDiagnostic: diagnostic, reason: "attachments_unprocessed" };
```

无条件返回，不看配置、不看开关。上一轮我判断"还差附件解析"是不完整的——**这里根本没有解析路径，是设计上不让它成为正文就绪**。

唯一能让 nfra 出正文的做法，是我第三轮做的那件事：直接调 JSON 接口取 `docClob` 并 CAS 写库。那 7 篇是这么补上的。

## 三、真正拿到的战果：政府网 6 篇

放弃"开作业"的思路之后，改用**运行时抽取器**（`extractArticleBody`）直接跑剩余 20 篇——它能处理 PDF、附件、bodyPolicies，而 CAS operator 只认 HTML。

政府网 11 篇结果：

| 结果 | 篇数 | 说明 |
|---|---:|---|
| 成功 | **6** | 正文 1810–8384 字 |
| `attachments_unprocessed` | 5 | 页面带 PDF 附件，无 attachmentSelector |

成功的 6 篇包括：《关于进一步提高海关…》《特殊困难老年人探访关爱》《完善设施农用地管理》《加强消费基础设施建设》等，都是实质政策文件。

## 四、PDF 这条：开了，但撞上扫描件

给 `fujian-finance-notices` 补了 `pdfDirect: true` / `pdfDirectUrlSuffix` / `pdfMaxBytes` 之后：

| 状态 | 结果 |
|---|---|
| 改之前 | `article_not_html`（拿 HTML 解析器去读 PDF） |
| 改之后 | **`pdf_page_no_text`** |

配置是对的，但这 2 篇是**扫描版 PDF，没有文字层**。同样问题也出现在厦门债务的 1 篇（`pdf_page_no_text`）。

要处理扫描件只能上 OCR，而**代码里没有 OCR 实现**。这条路到此为止，不是配置问题。

## 五、累计

| 节点 | 有正文（>200 字） | 无正文 |
|---|---:|---:|
| 起步 | 202 | 64 |
| 第一轮 | 213 | 53 |
| 第二轮 | 224 | 42 |
| 第三轮 | 229 | 35 |
| 第四轮 | 244 | 20 |
| **本轮** | **250** | **16** |

## 六、剩余 16 篇的真实性质

| 来源 | 篇数 | 性质 | 可行路径 |
|---|---:|---|---|
| 中国政府网 | 5 | 页面带 PDF 附件，源无 `attachmentSelector` | 给该源配附件 driver（页面结构多变，需逐页确认） |
| 财政部陕西监管局 | 4 | `bodyPolicies` 死选择器 + 1500 字地板 | 改抽取器代码 |
| 厦门财政局债务 | 3 | 1 篇扫描 PDF、1 篇 `attachment_unsupported`、1 篇已 ok 但短 | OCR / 附件类型支持 |
| 福建省财政厅 | 2 | 扫描版 PDF | OCR |
| 金融监管总局 | 2 | 已 `ok`，正文 108/142 字的简讯 | 无需处理，仅按 >200 字口径计为缺口 |

**真正需要写代码才能解决的是 4 篇（陕西）**；其余要么需要 OCR（4 篇），要么需要给政府网配附件 driver（5 篇），要么已经完成（2 篇简讯）。

## 七、边界

- 未启动 worker，未注册任何 schedule，未触发模型调用。
- 本轮写入全部经由运行时抽取器 `extractArticleBody`，它自带 identity 校验、body 策略与 revision 递增；没有裸 SQL。
- 配置改动两处：`fujian-finance-notices` 加 `pdfDirect` 三字段（已同步 DB）；其余未动。
- 未对扫描 PDF 做任何 OCR 尝试——没有实现，不假装有。
