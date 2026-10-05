# 财政部地方监管局新闻栏目观察：第四批（2026-10-05）

## TASK
从矩阵候选中观察江苏、浙江、安徽、江西四局：每局最多请求一次官方首页，并只从已保存首页DOM中的实际导航锚点选择列表页；整批硬上限8次 dispatcher。没有请求详情或附件，也没有运行 collector、数据库、worker 或模型。

## MODEL
Luna High。8次请求均使用后端固定 Undici 8.11.2 `p3-http-budget` admission hook，direct HTTPS、每次最多20秒、6 MiB、`maxRedirects=0`，无重试。首页批次 dispatches=4；栏目观察3次，浙江授权补充1次；合计8。hook记录 attempted/dispatched/rejected 合计均为8/8/0，事件共24次：8 create、8 sendHeaders、8 response headers、0 request error、0 observer callback error。所有8响应均HTTP 200且final URL等于请求URL。浙江栏目响应自身含JavaScript redirect，但没有再请求该脚本目标。

## FILES_CHANGED
- ignored evidence/scripts：`.data/fiscal-qa/regional-batch4-20261005/`，包括 one-shot 脚本、开始标记、3个请求manifest和8份 raw HTML；每个响应的UTC时间、字节数、SHA-256与DOM锚点均记录在相应manifest。没有改源配置、源矩阵、数据库或共享采集代码。
- 新增本报告。

## TESTS_RUN
- `node --check`：首页与栏目 one-shot 脚本语法检查通过；浙江额外请求脚本在发出请求前通过语法检查。
- 每阶段的 Undici budget snapshot 均记录在 manifest；初始四份首页raw在第二阶段发请求前按SHA-256/字节数复核一致，浙江首页raw在其补充请求前再次复核一致。浙江补充响应写入后离线按字节数和SHA-256复核一致。
- 未运行软件测试；未访问详情页。

## RESULT

四个官方首页在 `2026-10-05T07:51:39Z` 至 `07:51:41Z` 请求，均保存HTTP 200 HTML。首页证据显示江苏、安徽、江西各有一条主内容区域内、精确标为“工作动态”的标题锚点；浙江没有“工作动态”或“新闻动态”主内容标题锚点。首页原始文件、时间、大小和SHA在 `homes.json` 中。

| 监管局 | 首页HTML bytes / SHA-256 | 从首页观察到的栏目锚点 | 栏目页请求与候选 |
|---|---|---|---|
| 江苏 | 16,195 / `ccebd453515aa57fdfb64962409e9fc4dba3377fe30b0fb062a46c54c08bfaea` | `工作动态`；主内容标题锚点 `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`；href `./caizhengjiancha/` | `https://jsz.mof.gov.cn/caizhengjiancha/` HTTP 200；12,494 bytes；10个唯一同域 `.htm` 文本链接；可见日期范围 2026-08-14—2026-09-30；SHA-256 `ebb0f43fe261d6c6014c73db0cb5c8e9f5cb4375322a37e67d186aaf46aad341` |
| 浙江 | 17,000 / `ae82791a9537af0b697fa48281e5699fdccf7ed84b651201dfe07e05b188a0fd` | 没有字面为“工作动态”/“新闻动态”的主内容标题锚点。Lead另行批准一次已观察到的同域 HTTPS 导航锚点：`动态简讯`；href `./dtjx/`，anchor path `div.mainboxerji > div.zzleft > ul > li#16436 > a` | `https://zj.mof.gov.cn/dtjx/` HTTP 200；379 bytes；响应只有 `<title><a href="./">动态简讯</a></title>` 与脚本 `location.replace("./tupianbaodao_1/")`，0个内容锚点/列表候选。脚本目标未请求；不把该页当作已确认列表。SHA-256 `8a86eb22f95e97b01c37a4fd479e5d6a890b6c0d60df3e84491e487c9aef4187` |
| 安徽 | 19,599 / `d33b9be28c05f7394d6580c421951dc47d058a36376421424335e2d9166896d8` | `工作动态`；主内容标题锚点 `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`；href `./caizhengjiancha/` | `https://ah.mof.gov.cn/caizhengjiancha/` HTTP 200；12,841 bytes；10个唯一同域 `.htm` 文本链接；可见日期范围 2026-09-15—2026-09-30；SHA-256 `620782726627e8fe14d3de2d46e62ecc733776a608dd463ec9d284da44c2c2f4` |
| 江西 | 20,408 / `54dbb976a4d296d6b34452adf637e2fb6dcc9a44271a865a8de3b9099d40682d` | `工作动态`；主内容标题锚点 `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`；href `./gzdt/caizhengjiancha/` | `https://jx.mof.gov.cn/gzdt/caizhengjiancha/` HTTP 200；12,837 bytes；10个唯一同域 `.htm` 文本链接；可见日期范围 2026-09-04—2026-09-30；SHA-256 `59b5fff1baefdab41c8af9e3eb96ce797aada8c43ea967c9f4fee6ab9de329d8` |

所有时间是页面列表附近的可见日期，不代表详情页 `PubDate`。候选计数统计单个当前列表HTML中可见且去重后的同域 `.htm` 文本链接；没有沿栏目页翻页，也没有逐项判定业务噪声。浙江追加栏目响应是动态简讯入口的重定向包装页，不证明它符合目标新闻动态范围。

## RISKS
- 每局仅一个首页样本；三张列表仅一个当前页面。没有验证栏目长期稳定、发布时间语义、详情题名和正文、分页/历史窗口、重复或业务质量。
- 浙江观察到的 `动态简讯` 入口不是字面“工作动态”或“新闻动态”；目标返回JavaScript跳转包装，未检查后续页面。首页主内容仍可见名为“监管工作”的其他栏目，但未请求或替换目标。
- 一次观察与10项可见候选不表示来源已配置或验收。所有source config按指令保持不变。

## BLOCKERS
江苏、安徽、江西只有首页和单页列表观察；浙江尚无已观察的列表页。四局均未source-pass；Gate 2仍 `NOT_PASSED`。

## NEXT
QA离线核对本目录的manifest、响应SHA/大小及原始DOM，将四局状态更新到共享矩阵。任何后续浙江脚本目标请求、详情访问或来源配置应作为独立工作范围审查。
