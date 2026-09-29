# 本地页面内容预览

日期：2026-09-29。此页说明独立开发预览库里的人工样本，不能视为模型精选、Gate 2 通过或正式发布内容。

## 页面入口与样本

本地 Web 在 `http://127.0.0.1:3000` 提供预览；全站顶部显示“开发样本预览 · 人工摘要 · 未经模型精选”，并链接已有 `/all`。三个样本位于 `/all`，各 item 详情保留真实官方标题、机构、发布日期和原文链接。主页精选仍走原有 selected-only 读取条件，因此为空是预期结果；它没有被改成展示未精选内容。

| 内容 | 来源日期（上海时间） | 官方原文 |
|---|---|---|
| 公开市场业务交易公告 [2026]第191号 | 2026-09-29 | [中国人民银行原文](https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html) |
| 财政部有关负责人就2026年中央预算公开答记者问 | 2026-03-26 | [财政部预算司原文](https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm) |
| 人民银行厦门市分行：支付护航投洽会 便利服务迎嘉宾 | 2026-09-14 | [人民银行厦门市分行原文](https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html) |

这些条目的摘要根据此前逐篇核实的官方详情撰写，并以前缀“开发预览·人工摘要；未经模型精选”标识。OMO摘要按来源原句记录“同时，开展了6985亿元隔夜逆回购操作。”未添加政策影响判断。三篇原文正文未写入预览库，也没有伪造分析、评分、精选理由或讨论数据。

## 写入方式与隔离

`scripts/seed-local-preview.ts` 仅接受无密码 `postgres@127.0.0.1:5432/fiscalhot_preview_test`、显式 `SITE_URL=http://127.0.0.1:3000`、loopback API/Web 地址与 `LOCAL_PREVIEW_ENABLED=true`。它拒绝 Production、开发登录绕过、启用的采集/模型/Jina/IndexNow/飞书/私网访问开关，以及固定样本 ID allow-list 以外的任何数据库身份。入库使用 `upsertMaterial`、现有 editorial override 与 `publishArticle`；数据库中每个来源仍为 `enabled=false`、`site_fulltext=false`、`syndicate_fulltext=false`。

归档的验证库 `fiscalhot_preview_test` 有 35 项 migration 与 34 个主题。seed 首轮创建 3 个来源、3 篇文章和 3 个合格 publication；第二轮三篇均报告 `unchanged`。SQL核验每篇 article/publication/override 版本均为 1、文章 revision 行各 1、每条人工审计记录各 1；`eligible=3`、`selected=0`、`score/reason=null`、`body_mode=summary`、`indexable=false`。数据库中没有正文、analysis、receipt、job run、pg-boss job 或 selected ledger/state；采集、模型、Jina、IndexNow、Feishu 与私网访问 flags 全 false。seed 未调用 collector、worker、provider 或网络源。

## 页面和公开出口核验

- `/`、`/all` 与样本详情 SSR 均返回 200；首页含开发样本 banner/`/all` 链接且精选列表为空，`/all` 显示三个已核标题。
- item 页显示“人工摘要 · 开发样本”及未模型精选说明。Web 响应带 `X-Robots-Tag: noindex, nofollow`；预览 root/item meta 也设置 noindex。生成的 API 与全量 RSS 摘要保留人工预览前缀，不能被误认作模型摘要；精选 snapshot 与精选 RSS 均不含这三个条目。
- `/api/site/pool` 返回三篇，`score=null`、`reason=null`、`selected=false`，发布日期对应原始上海日期（UTC分别为 `2026-09-28T16:00:00Z`、`2026-03-25T16:00:00Z`、`2026-09-13T16:00:00Z`）。`/api/site/timeline` 的精选 cards 为空。
- 开关默认关闭；Focused guards 4/4、全量 typecheck、Web build、Web 测试 15/15 与 loopback smoke 30/30通过。fresh `fiscalhot_content_preview_test` 35 migrations 后完整 `npm test` 156/156 通过。Web 当前以 `NODE_ENV=development` 在 `127.0.0.1:3000` 提供构建版页面，preview flag 只在该 Web 进程开启；API 与 PostgreSQL 均为 loopback，其他安全开关 false。

本地页面预览仅用于查看固定人工样本。生产、NAS、真实模型、采集任务和来源配置仍保持关闭；所有来源稳定性、正文质量和栏目覆盖须按 P3/Gate 2 规则单独验收。
