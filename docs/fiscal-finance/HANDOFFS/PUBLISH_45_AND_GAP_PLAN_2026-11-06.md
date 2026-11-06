# 45 篇候选发布记录与 64 篇补正文计划（2026-11-06）

用户 2026-11-06 批准："可以进站，流水线可以开，64 篇补进来"。本文记录实际执行了什么、没做什么、以及补正文为何停在审批闸门前。

## 一、先说没做的：没有开无界 worker

`apps/worker` 的 `content.sweep` 每 5 分钟扫未处理文章入队。当前库里 669 篇里绝大多数没有 analysis，一旦起 worker，第一轮就会把几百篇全部入队，按每篇 1 次预筛 + 最多 2 次评分算，是近两千次模型调用，全部压在 NAS 的本地 qwen3.5:9b 上。

而 NAS 现在 `MemAvailable` 只有 6.7 GB（qemu 虚机常驻 25.2 GB），模型本身要 6.3 GB。真跑起来最可能的结局是 OOM，连带影响同机的 wenshu 生产、komga、jellyfin。**这属于"能开但不该这样开"**，所以没有执行。

替代做法：走发布层本来就支持的编辑判定路径。`publish.ts` 开头写明"Rebuilding only re-reads stored results; it never calls a model"，即从已存判定重建公开投影不调模型。45 篇的判定来自本次 WorkBuddy 盲判，作为编辑决定写入 `editorial_overrides`，再由 `publishArticle()` 生成公开投影。

副作用说明：`publishArticle` 会向 pg-boss 投递 `notifySelected` 与 `prepareMedia` 两个队列任务（每篇各一条，共 90 条）。因为 worker 未启动，这些任务只会排队不会执行；且 `FEISHU_CONTENT_PUSH_ENABLED`、`INDEXNOW_SUBMIT_ENABLED` 均为 false，即使日后启动也不会外发。

## 二、发布前的保护动作

| 项 | 值 |
|---|---|
| 一致性备份 | `/vol2/1000/docker/fiscalhot-pre-publish-20261106.dump` |
| 大小 / 权限 | 2,603,122 字节 / mode 600 |
| SHA256 | `388f4a2d134a4ed550f5dc35ac71e0c652e5829618c1f6d4bd20f248afdb3e` |
| 零写入预检 | 45 个目标全部 `participation_mode=editorial`、`tier=T1`、`blocked=0`，其中 3 篇已有 10/27 的摘要覆盖 |
| 单篇试跑 | 先只发 1 篇，确认 override + publication 落库且可见性正确，再跑全量 |
| 幂等复核 | 全量跑完后再干跑一次：45 个目标全部识别为"已有覆盖"，无重复插入 |

三篇已有覆盖（`cecl8scgll8ud4uwcb042kojz`、`fng7z112s0h0550lrxvxob2x0`、`xeoad9i348buo96jgbukm5g7x`）来自 10/27 的 `fiscal-native-summary-import`，其摘要保留不动，只把 `selected` 提升为 true 并递增 version。

## 三、发布结果（DB 实测）

| 项 | 值 |
|---|---:|
| publications 中 selected | **45** |
| 45 篇中 selected + eligible + public | **45 / 45** |
| indexable | 45（有摘要且被选中，进入 sitemap） |
| editorial_overrides（本次写入） | 45（42 新增 + 3 提升） |
| selected_ledger 记录 | 45 |
| 释放闸门 | `visible_after` 按发布时刻 + 180 秒生效，已过闸 |

站点侧验证：

- `/api/site/pool` 返回的第 1 条即本次新发布的《广西监管局：立足监管职责定位 护航保障财政科学管理工作落地见效》，`selected=true`。
- 首页第 1 页 40 条中 **35 条为精选**，页面已不是原来的空列表。
- 全部动态总量 135（该接口按时间窗过滤，历史条目里的 8 月稿件不会因为本次发布而回到列表）。

## 四、64 篇缺正文：停在审批闸门前

现状：`pending` 57 篇 + `unconfirmed` 7 篇。

补正文必须走既有受控链路 `scripts/fiscal/nas-pending-body-batch.ts`，它的模式是：

```
prepare → capture → offline-parse → execute(CAS)
```

各阶段强制要求：

| 阶段 | 强制参数 | 作用 |
|---|---|---|
| prepare | `--article-ids`、`--run-id`、`--exclude-evidence`、`--out` | 生成抓取清单，排除已抓过/已失败的 URL |
| capture | `--manifest`、`--capture-dir`、`--approval-sha256` | 真实 GET，1.1 秒/次限速，需要**人工审批过的 manifest 哈希** |
| offline-parse | `--manifest`、`--captures`、`--capture-dir`、`--out` | 离线解析，不发请求 |
| execute | `--proposals`、`--backup-proof`、`--approval-sha256` | 在备份保护下按 CAS 回写 |

我已执行 `--mode=prepare`，被 `--exclude-evidence` 拦住——它要求一份既有抓取证据清单（防止重复 GET 已捕获或已失败的 URL）。这个参数不能填空白糊弄，否则就是绕过"不重复抓取"的保护。

**所以停在这里是故意的**：下一步需要先生成 64 篇的排除证据清单（从 `.data/fiscal-qa/*/http-body-evidence/manifest.json` 汇总历史 URL），再由你确认 manifest 后给出 `--approval-sha256`，才能进入真实 GET。

预期难度分层（按来源）：

| 来源 | 缺正文 | 判断 |
|---|---:|---|
| 各地监管局动态（汇总页） | 15 | **结构性**：列表页无正文容器，需二次跳转规则 |
| 中国政府网·政策文件 | 11 | **结构性**：多 PDF/分页正文，`detailConfigIsDirectHtml` 不成立 |
| 金融监管总局·监管动态 | 7 | **结构性**：来源"待准入"，正文策略未开 |
| 财政部厦门监管局 | 6 | 可尝试，地方子站容器可能不匹配 |
| 财政部福建监管局 | 4 | 可尝试 |
| 财政部陕西监管局 | 4 | 可尝试 |
| 财政部广西监管局 | 4 | 可尝试 |
| 其余长尾（海南/山东/大连/宁夏等） | 13 | 可尝试 |

即使 64 篇全部补齐，其中 33 篇属结构性缺口，现有规则不动的话补不下来——**这批需要单独定来源策略，不是跑一次 operator 能解决的**。

## 五、每日任务的调整

已配置的三个任务不变：

| 时间 | 任务 | 备注 |
|---|---|---|
| 08:40 | 每日晨检 | 只读，含备份实测 hash |
| 09:15 | 新动态识别分析 | 30 小时增量，产出候选清单与页面 |
| 18:40 | 每日日结 | 12:00/18:00 采集 + 当日增量 |

但**发布不再自动进行**：09:15 的识别分析只产候选，是否发布仍需人工确认。要改成自动发布的话，需要你明确授权"自动发布"这一动作本身。

## 六、回退方式

若需撤销本次发布：

```sql
-- 只撤选中，保留内容（推荐）
UPDATE editorial_overrides
SET fields = fields || '{"selected": false}'::jsonb, version = version + 1, updated_at = now()
WHERE updated_by = 'workbuddy-selection-20261106';
```

然后对 45 个 article_id 逐个调用 `publishArticle()` 重建投影；或直接用备份 `fiscalhot-pre-publish-20261106.dump` 整体还原（2.6 MB，已验证可读）。

## 七、边界

- 未启动 worker，未让队列自动跑，未做任何模型调用。
- 未伪造 `analyses` 记录（该表仍为 0 行），判定来源如实记录在 `editorial_overrides.updated_by`。
- 64 篇仍缺正文，其中 33 篇属结构性来源缺口，Gate 4 未因此通过。
- 45 篇虽已上线，但这是编辑判定发布，不等于 Gate 3 验收通过。
