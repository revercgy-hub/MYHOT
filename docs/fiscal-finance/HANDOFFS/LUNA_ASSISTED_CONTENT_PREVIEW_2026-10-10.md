# Luna辅助内容预览阶段检查点（2026-10-10；seed通过，live页面待API）

## 状态与范围

用户授权使用本会话Luna进行识别，并要求持续开发到需要其决策为止。本轮完成保存正文的模型辅助识别、本地预览软件QA及获批隔离seed；不是应用里的provider执行、正式P4模型精选或Gate变更。当前仍为`IN_PROGRESS`：预览代码`7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`已提交且精确SHA CI成功；API未监听，live页面核验未发起。

## 模型识别及可复核证据

- 模型：`gpt-6-luna/high`，`codex_agent_assisted`。对两个隔离`_test`库中4篇body作identity/contentHash只读复算，再读取保存内容识别；独立QA做body-blind second recognition。
- 输入：`.data/fiscal-qa/luna-content-20261010/input.json`，SHA-256 `d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c`。输出与metadata证据为同目录`luna-recognition.json`、`metadata-audit.json`、`second-recognition.json`；这些`.data`文件ignored，不进代码commit。
- 三条正例：`local-preview-pboc-omo-192`（OMO第192号）、`local-preview-mof-debt-202608`（2026年8月地方债）、`local-preview-mof-xiamen-capital-review`（厦门监管局中央企业国有资本收益审核）。另有网安宣传负例`BLOCK`，不加入样本或预览。
- 两次识别分数明确对应为OMO第192号69/69、2026年8月地方债81/85、厦门央企国资收益审核56/70、网安宣传28/32。厦门结果存在分歧，原样保留；不取均值，不用于模型校准、阈值修改或质量通过结论。
- `siteProviderCalls=0`、receipt=0、`humanGold=false`、system clustering=`NOT_RUN`。四条模型复核结果不是领域人员Gold标注，也不等价于P4 executor的真实provider调用。

## 本地预览准备与隔离

Root批准复用AD-012既有seed/publication边界：旧三篇保持不变，只增加上述三条正例。固定六个preview IDs为`local-preview-pboc-omo-191`、`local-preview-mof-budget-qa`、`local-preview-pboc-xiamen-payment`、`local-preview-pboc-omo-192`、`local-preview-mof-debt-202608`、`local-preview-mof-xiamen-capital-review`。新样本记录Luna provenance、source与body hash；body不写入preview DB。配置维持sources disabled、`site_fulltext=false`、`syndicate_fulltext=false`，所有样本unselected、scoreless、no analysis、无receipt，详情保持noindex。

`luna_visible_content_path`冻结工作树运行HEAD `199e857`，5个目标文件起止SHA稳定；fresh `luna_preview_20261010_test`从不存在状态创建、完成35 migrations且pre业务计数0。独立集中QA的typecheck、backend 370/370、Web build、Web tests 15/15均PASS，日志`.data/fiscal-qa/luna-preview-qa-20261010/`。fullMODEL仅fake路径；real keys/endpoints/proxies unset、P4 opt-in unset、其余flags false。只读预check初次误选不存在的`article_revisions.body_html`，未写入；修正查询通过，stderr已保留，不是生产问题。获批的精确`fiscalhot_preview_test` seed只运行一次且exit 0：旧3篇unchanged、新3篇created；post-check为6 sources/articles/revisions/discoveries/publications/overrides/audits/eligible，旧3条source/article/revision/publication/override/audit均与seed前baseline一致，输入hash与Luna provenance完整。selected/score/reason/analysis/receipt/jobs/fetch/body/queue为0，source/fulltext flags false。没有发起页面GET：Web监听`127.0.0.1:3000`但API `127.0.0.1:3001`未监听；未启动或重启服务。live页面可见性及HTTP noindex header未验证，后续须用户手动启动API。摘要标签由“人工摘要”调整为“编辑摘要 · 开发样本”，未精选说明保持。此次未改backend、schema、API或core taxonomy。

## Git、Gate与最近CI

本轮恢复时分支`feat/fiscal-finance-hot`、clean HEAD=`199e85717e1b9acaaa0888328a9cbfb62c6723d7`；基线`589f79eff09470b31ba8a7f1d9eb62d36ff2be6c`。预览代码提交为`7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`，其workflow run `38027644649`精确headSha匹配，Check/Docker均success；Check含typecheck、Web build/tests、migrate/seed、built-site smoke、backend tests，Docker compose build/smoke成功。该CI built-site smoke不等价于本机live页面核验。Gate 2仍仅限正式review定义的原三来源bounded小样。

QA在冻结工作树完成，运行HEAD为`199e857`；它验证的五文件内容当时SHA稳定，随后提交为`7bab896d029016f32d1ad3bf3c8bd7ac01eef3f2`并通过精确SHA CI run `38027644649`。文档owner未运行本机tests、HTTP、数据库或service；已按授权dispatch并读取精确SHA CI终态。seed已成功，但live page没有发出HTTP请求；未启动/重启服务，待用户手动启动API后核验root/item及noindex。source admission、全文开关、Gate、正式模型质量和Gold均未改变或完成；未知事实不推断。

## 下一步

唯一待办是用户手动启动API后，再对本机预览页面做有限loopback GET并核验root/item与noindex；当前不需要额外测试或CI。不得把Luna识别当成人工Gold，不据分歧调阈值。Source配置与运行服务操作依旧由Root明确授权。
