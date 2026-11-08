# 加源执行记录：天津、陕西财政厅（2026-11-08）

用户批准加源。本轮新增 2 个源，并把 11-06 起遗留的 catalog/DB 不一致一并清理。

## 一、先处置了拦路的不一致

12:00 窗口报的不再是 `API_SOURCE_CATALOG_DRIFT`（昨天的容器覆盖已还原），而是新的一条：

```
source config or safety flags differ from fixed catalog: fujian-finance-notices
```

原因：我在 11-06/11-07 改过 DB 里 5 个源的 config（补 titleSelector / publishedAtRegex / pdfDirect），而线上 catalog 还是旧版，两者对不上。

处置：把这 5 个源的 DB config **回滚到旧 catalog 值**，让 DB 与线上 catalog 立刻一致。回滚干跑确认 `changedKeys` 全空、只有 `droppedKeys`，说明只删了新增字段、没动原有配置。回滚后重新比对：**diff = 0**。

回滚前备份：`fiscalhot-pre-rollback-20261108.dump`，SHA256 `342b8508…`。

## 二、新增的 2 个源

| id | 名称 | 列表 | 正文容器 |
|---|---|---|---|
| `tj-finance-notices` | 天津市财政局·通知公告 | `#commonListUl > ul > li` | `.content` |
| `sx-finance-notices` | 陕西省财政厅·通知公告 | `ul.cm-news-list.gl-news-list > li` | `.content` |

两个源的标题与日期都从详情页 `<meta name="ArticleTitle">` 与 `<meta name="PubDate">` 取。**天津的 PubDate 用单引号**（`content='2026-10-30 17:06'`），所以正则写成兼容双引号：

```json
"publishedAtRegex": "<meta\\s+name=\"PubDate\"\\s+content=[\"']([^\"']+)"
```

### 北京为什么没加

北京市财政局（`#ul-back > ul`）列表标题是这样的：

```html
<a href="./202610/..." title="<font color=&quot;#ff0000&quot;>关于办理...的通知</a>
```

标题里带 `<font>` 转义标签和【置顶】前缀，直接入库会污染标题。需要先有标题清洗能力，故本轮不加。

## 三、改动清单（4 处，不是 7 步）

关键发现：launcher 会把 NAS 上的 catalog 拷到 `/tmp`，通过 `AIHOT_SOURCE_CATALOG_PATH` 传给 operator。**镜像内的 `/app/industry/sources.json` 只是完整性校验**，所以：

| 改动 | 内容 |
|---|---|
| `scripts/fiscal/nas-candidate-batch.ts` | 源清单 +2；`maxDispatches` 76→78；`MAX_SOURCES` 48→52；`catalogSha256` → 新值 |
| `industry/sources.json` | +2 个源，48→50 |
| NAS `source/industry/sources.json` + `tools/catalog.sha256` | `f859bcf4…` |
| NAS `source/scripts/…/nas-candidate-batch.ts` + `tools/operator.sha256` | `4046cad6…` |
| DB `sources` | 2 行 insert + 5 行 config 更新 |

**`appCatalogSha256` 保持 `27af3250…` 不动** —— 它校验的是镜像内文件，镜像没换，所以 launcher、entrypoint、crontab 三层 pin 全都不用碰。这把改动面从"7 步发布链"压到"4 处同步"。

## 四、验证

| 项 | 结果 |
|---|---|
| typecheck | 通过 |
| `fiscal-nas-candidate-batch` 测试 | 16 通过 / 1 跳过（需测试库）/ 0 失败 |
| NAS catalog 哈希 vs pin | 一致 |
| NAS operator 哈希 vs pin | 一致 |
| DB `sources` 行数 vs catalog | 50 / 50 |
| DB config vs catalog | **mismatch 0** |
| operator plan 模式 | `PLAN_ONLY_NO_DATABASE_NO_HTTP_NO_WRITES` 成功，两个新源都进入 plan |

测试同步更新了 4 处计数断言（46→48、45→47、76→78、48→50），并把硬编码的 catalog 哈希断言改成引用 `DAILY_LATEST_PRESET.appCatalogSha256`，以后改 pin 不用再动测试。

## 五、回退路径

| 层级 | 回退动作 |
|---|---|
| NAS 文件 | `fiscalhot-latest-collector-20261028/backup-20261108/` 下有 4 个原始文件 |
| pin | 同上目录的 `catalog.sha256`、`operator.sha256` |
| DB | `fiscalhot-pre-addsources-20261108.dump`（SHA256 `f5cbaeb0…`） |
| 代码 | 回退 `nas-candidate-batch.ts` 与 `sources.json` 两个文件即可 |

## 六、待验证

18:00 窗口是首次带新源采集。已配一次性任务在 18:15 核对：窗口是否成功、两个新源各自 `dispatches` 与 `listObservations`、当日入库总数。

**预期**：源数 46→48，日增从 14–22 篇提到 20–28 篇。但这只是估算，得看真实数据。

若 18:00 仍失败，回退用第五节的路径，不需要再猜。
