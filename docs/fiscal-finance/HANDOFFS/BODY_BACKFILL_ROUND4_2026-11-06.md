# 第四轮：汇总页 15 篇补齐 + nfra 取正文固化（2026-11-06）

用户批准两件事：汇总页那 15 篇要做，nfra 的 JSON 取正文要固化。

## 一、汇总页 15 篇：我上一轮的判断是错的

上一轮我写"汇总页需列表→详情二次跳转，功能级改动"。**这个判断不成立。**

实测 15 条 URL 全部直指地方站详情页（`*.mof.gov.cn/…/t2026xxxx_xxxx.htm`），列表页在 `www.mof.gov.cn` 只是索引入口，最终 URL 已经落到了文章本身，根本不需要二次跳转。

真正的阻塞点是配置少了一个字段：

```
detail: { maxFetches: 10, bodySelector: ".my_doccontent > .TRS_Editor",
          titleRegex: "<title>…</title>", publishedAtUtcOffset: "+08:00" }
```

有 `titleRegex`，**没有 `publishedAtRegex` 或 `publishedAtSelector`**，而 `detailConfigIsDirectHtml` 要求两者至少有一个，于是整个来源在抓取阶段就被判为"不在允许的 direct-HTML 范围"。

补一行即可：

```diff
+"publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=\"([^\"]+)",
```

补完后 `detailConfigIsDirectHtml => true`。

### 选择器本身没问题

对 15 个页面逐个测过 `.my_doccontent > .TRS_Editor`：

```
sz 2471 | ln 2489 | sn 2723 | gs 3069 | tj 2861 | jl 3717 | hlj 2959 | gd 3176
gs 2237 | tj 3696 | sn 2289 | zj 4255 | he 3673 | qd 3776 | bj 3043   （字符数）
```

全部命中，没有一页落空。所以不是"容器不匹配"，纯粹是日期字段缺了。

### 跑批时撞到的第二个限制

首次 prepare 报 `per-source target cap exceeds configured direct-detail budget`：该源 `maxFetches: 10`，一次最多 10 个目标。15 篇拆成 10 + 5 两批跑通，没动 `maxFetches`（那是采集期的实际预算，不该为了补数据抬高）。

| 批次 | 目标 | 抓取 | 官方解析通过 | 拒收 | 写入 |
|---|---:|---:|---:|---:|---:|
| r3a | 10 | 10 | 7 | 3 | 10（含我补 3） |
| r3b | 5 | 5 | 4 | 1 | 5（含我补 1） |

15/15 写入，全部 `revision 1→2`、`body_status=ok`，正文 1563–2950 字。

## 二、nfra：docId 从 URL 回退

`nfra_json_v1` 模式其实早就存在（`nfra-json-detail.ts`，走 `/cbircweb/DocInfo/SelectByDocId`）。那 7 篇为什么会是 `unconfirmed`？查到了：

```ts
const rawExternalId = a.raw?.externalId;            // 这 7 篇全是 null
... nfra: { docId: Number.isSafeInteger(rawExternalId) ? rawExternalId : -1 }
```

`docId = -1` → `fetchNfraJsonDetail` 里的 `docId !== canonicalDocId(articleUrl)` 直接抛"identity invalid" → 记 `unconfirmed`。

而 URL 里本来就带着 `?docId=1277211`，那才是详情接口的身份。所以改的是这一行：

```diff
+  const urlDocId = (() => {
+    try {
+      const raw = new URL(a.url).searchParams.get("docId");
+      return raw && /^\d+$/u.test(raw) ? Number(raw) : NaN;
+    } catch { return NaN; }
+  })();
   ... nfra: { docId: Number.isSafeInteger(rawExternalId) ? rawExternalId
+              : (Number.isSafeInteger(urlDocId) ? urlDocId : -1), ... }
```

### 验证结果：过了一道门，撞上第二道

拿一篇更早的 nfra 待处理文章真跑 `extractArticleBody`：

```
before: { body_status: "unconfirmed", ext: null, docId=1275468 }
warn:   source body selector declined, reason: "attachments_unprocessed"
after:  { body_status: "unconfirmed", revision: 1, chars: 0 }
```

**docId 修补生效了**——不再报 identity invalid，已经走到正文抽取逻辑。但被 `attachments_unprocessed` 挡住。

继续查：这篇文档的 JSON 里 `attachmentInfoVOList` 是 **0 条**，`docClob` 有 44 KB。说明拦截依据不是详情接口的附件列表，而是**采集时存在文章 `raw` 里的附件诊断标记**（`readAttachmentDiagnostic(a.raw)`），要靠附件解析作业清掉。

而附件解析作业在 `prepareMedia` 队列里，需要 worker 消费——就是我们一直没启动的那个。

**所以 nfra 要真正闭环，还差"附件解析"这一步，不是文档抓取问题。**

## 三、测试与验证

| 项 | 结果 |
|---|---|
| `npm run typecheck` | 通过 |
| `tests/regional-bureau-config.test.ts` | 通过（补配置后福建能解析标题，期望值由 `null` 改为实际标题） |
| `tests/nfra-json-detail.test.ts` | 通过 |
| `tests/nfra-json-detail-persistence.test.ts` | 未通过，原因是缺 `DATABASE_URL`（要求指向 `*_test`/`*_ci` 库），与本次改动无关 |

## 四、累计进展

| 节点 | 有正文（>200 字） | 无正文 |
|---|---:|---:|
| 起步 | 202 | 64 |
| 第一轮 | 213 | 53 |
| 第二轮 | 224 | 42 |
| 第三轮 | 229 | 35 |
| **本轮** | **244** | **20** |

## 五、剩余 20 篇

| 来源 | 篇数 | 阻塞 |
|---|---:|---|
| 中国政府网·部门政策文件 | 11 | 多为 PDF/分页；catalog 哈希变更后 GovCN 已批准哈希失效，须重批 |
| 财政部陕西监管局 | 4 | `bodyPolicies` 死选择器 + 1500 字地板 + operator 不接受，需改代码 |
| 厦门市财政局·地方政府债务 | 3 | 含 `attachmentMode`/`articleSelector`，走附件通道 |
| 福建省财政厅·通知公告 | 2 | 详情页是 PDF |

## 六、证据与备份

| 项 | 位置 |
|---|---|
| 抓取证据 | `.data/fiscal-qa/since1027-20261106/captured-r3a/`、`captured-r3b/` |
| 官方提案 | 同上目录 `wb-gap-proposals-r3a.json`、`r3b.json` |
| 抽取结果 | `extracted-r3a.json`、`extracted-r3b.json` |
| 回写前备份 | `fiscalhot-pre-prov-20261106.dump`，SHA256 `f518bffc…` |
| catalog 哈希 | `27af3250…` → `63ee27bd…` → `64dcaf07…`（本轮再改一次，GovCN 批准哈希依旧失效） |
