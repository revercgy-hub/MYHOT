# 第三次修复：采集门禁的五处硬编码（2026-11-12）

## 一、现状

采集自 **2026-11-06 06:00 之后再未成功**，连续 6 天零新增。articles 总数卡在 **684**，`max(discovered_at)` 停在 11/05 22:00 UTC。

站点本身正常（HTTP 200），只是没有新内容进来。

## 二、三次失败的连锁

我在这条链上连踩三次，每次都是"改了一部分、漏了另一部分"：

| 时间 | 失败码 | 漏掉的东西 |
|---|---|---|
| 11/06 | `API_SOURCE_CATALOG_DRIFT` | 直接覆盖容器内 catalog，没走 pin 流程 |
| 11/08 | `CATALOG_HASH_MISMATCH` | 只改了 pin 文件，漏改 launcher 第 14 行 `CATALOG_SHA256` 常量 |
| 11/08–11/12 | `IMAGE_MANIFEST_UNBOUND_OR_MISMATCHED` | 还漏了 launcher 第 79 行 `expected` 配额字典和 `candidate-manifest.json` 的哈希/配额 |

第三次最隐蔽：我 11/12 先改了 manifest 的 4 个哈希和 5 个配额数字，以为齐了；跑了一次还是失败，才发现 **launcher 第 79 行还硬编码着同一组配额**（`fixedSources: 46`、`totalGets: 76`、`maxNewTotal: 460`）。manifest 和 launcher 各存一份，必须同时改。

## 三、这条链到底有几处硬编码

改一次 catalog，要同步 **五处**：

```
1. crontab          → latest-entrypoint.sh 的 sha256
2. latest-entrypoint.sh
      ├─ candidate-manifest.json 的 sha256（断言 + export 各一处）
      └─ nas-latest-collector-launcher.sh 的 sha256
3. launcher 第 10 行  APP_CATALOG_SHA256   （钉镜像内文件，镜像没换就不用改）
4. launcher 第 14 行  CATALOG_SHA256       （钉 NAS 工作副本，必须改）
5. launcher 第 79 行  expected 配额字典     （与 manifest.guardrails 重复，必须同时改）
6. candidate-manifest.json 的 operatorSha256 / catalogSha256 / launcherSha256 / guardrails 五项
```

少一处就 `FAIL`，而且失败码各不相同，看不出是同一件事。

## 四、这次怎么做的

不再手动逐个替换（前两次就是手改漏的），改用 Python 脚本按依赖顺序一次算完：

1. 改 launcher 的 `expected` 配额 → 算新 launcher 哈希 L
2. 把 L 写进 manifest 的 `launcherSha256` → 算新 manifest 哈希 M
3. 用 M 和 L 重写 entrypoint 两处断言 → 算新 entrypoint 哈希 E
4. 把 E 写进 crontab

中间还踩了一个转义坑：用正则替换时把 `$(...)` 写成了 `\$(...)`，命令不执行、比较变字符串比较，永远失败。最后改成**整文件重写**（5 行，硬编码常量），才干净。

### 验证方式

不能再信 plan 模式——它不经过 launcher 的 shell 预检。这次直接手动跑 entrypoint：

```
LATEST_COLLECTOR_FAILED=OUTSIDE_SCHEDULED_SLOT
```

**这个结果是好的**：说明 manifest 断言、launcher 断言、catalog pin、launcher 常量、APP_CATALOG、operator pin、manifest 绑定、guardrails 配额，全部通过，只剩"不在 06/12/18 时点"这一条拦截。

这是这条链第一次真正跑通预检。

## 五、当前配平值

| 项 | 值 |
|---|---|
| catalog（53 源） | `d49cf603…` |
| operator | `bd931fd2…` |
| launcher | `121bd74e…` |
| manifest | `d5bfafbc…` |
| entrypoint | `88beaddf…` |
| 镜像 catalog | `27af3250…`（未动） |
| guardrails | 51 源 / 51 列表请求 / 30 详情 / 81 总请求 / 510 条上限 |

## 六、这个设计的问题

同一条约束（catalog 的哈希、源的配额）被复制在 **5 个地方**，改一处必须全改，且没脚本、没校验、没拓扑提示。这不是我能靠"下次仔细点"解决的问题——前两次我也以为自己仔细了。

**建议（待用户拍板）**：把 manifest 作为唯一真值来源，launcher 的 `expected` 从 manifest 读取而不是硬编码；entrypoint 的两处断言由部署脚本自动生成。这样改 catalog 只需动 manifest + catalog 两个文件。

在那之前，每次改 catalog 必须走脚本，不能手改。

## 七、影响与预期

- 6 天漏采：11/06 至 11/12
- 恢复后：采集窗口是 7 天，11/13 06:00 那次会把 11/06 以来的一次性补回，`newArticles` 会明显高于平日（14–22 篇）
- 已配 11/13 06:20 一次性核对任务

## 八、备份

`backup-20261111/`：launcher、entrypoint、crontab.bak、candidate-manifest.json 四份原件。
