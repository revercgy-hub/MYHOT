# 第二次同类事故：漏改 launcher 常量，采集连停 6 个窗口（2026-11-08 → 11-11）

## 一、结论

又是我。11-08 加源时我只改了 `tools/catalog.sha256` 这个 pin 文件，**漏改 launcher 第 14 行 `readonly CATALOG_SHA256` 常量**。

launcher 第 59 行的判断是双重条件：

```sh
[ "$catalog_sha" = "$expected_catalog_sha" ] && [ "$catalog_sha" = "$CATALOG_SHA256" ] || fail CATALOG_HASH_MISMATCH
```

`$expected_catalog_sha` 来自 pin 文件（我改了，`d49cf603`），`$CATALOG_SHA256` 是 launcher 里的硬编码（我没改，还是 `27af3250`）。两者恒不相等 → 每窗口必挂。

- 断点：2026-11-08 18:00
- 影响：11-08 18:00、11-09 06/12/18、11-10 06/12/18、11-11 06:00，共 **6 个窗口**
- 失败码：`LATEST_COLLECTOR_FAILED=CATALOG_HASH_MISMATCH`
- 数据后果：articles 总数 3 天卡在 **684**，`max(discovered_at)` 停在 **11-06 06:00**，一条新文章没进来

## 二、为什么我上次判断错了

11-08 我说过"launcher、entrypoint、crontab 三层全都不用碰，改动面从 7 步压到 4 处"。这个判断**只对了一半**：

- 当时我查的是 `APP_CATALOG_SHA256`（第 10 行，钉镜像内文件）——它确实不用改，镜像没换。
- 但我没注意到第 14 行还有一个 `CATALOG_SHA256`（钉 NAS 工作副本），它必须跟着 catalog 变。
- 而且我当时只 grep 了 `APP_CATALOG_SHA256=`，输出里第 14 行被我看漏了。

**根因是检查不完整，不是运气不好。**

## 三、修复：四级 pin 链一次改齐

| 级别 | 文件 | 期望值 | 实测 |
|---|---|---|---|
| 1 | crontab 里对 entrypoint 的断言 | `5648c339…` | 一致 |
| 2 | `latest-entrypoint.sh` 里对 launcher 的断言 | `2f99f508…` | 一致 |
| 3 | launcher 第 14 行 `CATALOG_SHA256` | `d49cf603…` | 一致（NAS 源与 pin 也是它） |
| 4 | launcher 第 10 行 `APP_CATALOG_SHA256` | `27af3250…` | 一致（容器内文件未动） |

另外核对：`tools/operator.sha256` 与 operator 实测一致；manifest 哈希一致；`sh -n` 语法检查两个脚本都通过。

改动顺序（先内后外，避免中间态被 cron 撞上）：改 launcher → 算新哈希 → 改 entrypoint 断言 → 算新哈希 → 改 crontab 断言。

备份：`backup-20261111/`（launcher、entrypoint、crontab.bak 三份原件）。

## 四、晨检为什么没提前定位

晨检确实连报 3 天（11-10、11-11 台账里都有首行告警），但它给的诊断是"NAS 源与 `app-catalog.sha256` 不一致，需拍板采纳新 catalog 还是回滚"。

这个诊断**方向错了**：`app-catalog.sha256`（镜像内）与 `catalog.sha256`（NAS 工作副本）本来就允许不同，这不是故障。真正断的是 launcher 里那个常量，而晨检没查它。

已把晨检的第 0 项重写成**四级链逐条实测**，并明确写出"两个 pin 文件允许不同、真正故障是 launcher 常量不符"，同时记上这次事故。下次同类问题会在首行报出来。

## 五、这两天半其他任务的状态

| 任务 | 状态 |
|---|---|
| 01:00 备份 | 正常（VERIFIED，体积日增 3 B） |
| 02:00 理解 | NOOP（设计如此） |
| 03:30 摘要 | 停摆（同因，catalog 门禁） |
| 每日晨检 | **正常执行**，11-09/10/11 三份台账都在 |
| 采集 | 6 个窗口全挂 —— 本节事故 |

也就是说：**监控本身是好的，是我没看台账。** 11-09 那份就已经报了，到 11-11 才发现，中间隔了两天。

## 六、这次真正该记住的

1. 改 catalog 必须动**四处**：NAS 源文件、`tools/catalog.sha256`、**launcher 第 14 行常量**、以及跟着变的两级脚本断言。
2. 判断"某处不用改"之前，必须把那个文件里所有相关常量都 grep 出来看一遍，不能只 grep 自己记得的那个名字。
3. 部署完不能只看"plan 模式通过"就收工——plan 模式不经过 launcher 的 shell 预检，所以它通过不代表定时任务能跑。**真正的验证只有在窗口时点跑一次。**
4. 晨检台账每天要人看。自动化报告了但没人读，等于没报。

## 七、当前状态

已修完、六项预检全 PASS、语法通过。12:00 窗口是首次验证点，已配 12:10 一次性核对任务。

因为采集窗口是 7 天，12:00 成功后会一次性补回 11-06 以来的全部漏采，`newArticles` 可能明显高于平日（平日 14–22 篇）。
