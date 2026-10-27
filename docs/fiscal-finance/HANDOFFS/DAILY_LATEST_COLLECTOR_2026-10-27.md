# NAS近7天轻量采集调度（2026-10-27）

**TASK**：依据用户持续采集、改善时效的授权，Root S1批准固定20个已验证来源的有界独立operator调度：NAS原生user cron，上海时间每日06:00、12:00、18:00。新cron已安装并通过独立只读后验；首个计划触发为2026-10-28 06:00，未补跑已过的今日18:00。

**CODE_SHA**：`fe482eaa7861cf8f95dacc91b0b60c0e18756b60`（本轮5个代码/测试文件提交；本交接文档另行提交）。

**MODEL**：开发实现与测试、NAS部署由两名 Luna High 执行，Sol Medium 负责独立审查，Root 负责架构裁定；项目运行时 provider 调用为0。每天02:00的既有understand诊断仍为独立范围；新采集任务不消耗其8次计划structure→understand调用。安装/预检实际官方GET与模型调用均0，未触发worker、摘要生成或发布；今日已经完成的32次官方GET、21篇新增及6篇公开摘要不重跑。

**FILES_CHANGED**：`scripts/fiscal/nas-candidate-batch.ts`及其测试增加`daily-latest`预设；新增launcher、prepare与prepare-only installer。非显式近期天数的旧采集行为保留source配置的回溯期，通常3×30=90天。新增catalog override仅作为daily operator输入隔离，`AIHOT_APP_ROOT=/app`继续使用可信镜像内backend；不更新应用架构、不替换镜像内source catalog、不重启主API进程。

**TESTS_RUN**：core owner focused 16项（15 pass、0 fail、1个既有DB配置skip）及typecheck通过。独立QA读取冻结源码、测试与底层material新建分支，核实固定scope、日期边界、catalog与DB配置/旗标、请求预算及无publication写入；独立重算operator/test文件hash相符，`git diff --check`通过，未重复无关全套。NAS真实plan-only已通过，输出20源/7天/10新增/30详情/50GET及两类catalog hash；独立读取remote operator/launcher/entrypoint hashes相符，workspace/source/tools均700。独立持原night lock再调用launcher plan-only得到`SKIPPED_LOCK_BUSY`；只读事务导出48条source后，exact20配置/kind/name全部匹配批准输入，48来源旗标全false。未重新做真实采集；最终cron安装后验PASS。core另完成隔离PG17.11/36迁移的全npm524项（519 pass、0 fail、5个明确DB配置skip）、Web build与Web22/22；stub测试期间MODEL_CALLS_ENABLED=true，真实provider keys/base/proxy均清除，未访问外部服务。

**RESULT**：预设仅用固定20源、滚动近7天、发布日期必需且不得晚于本次固定anchor；每源最多10篇新增，整轮最多30个详情、50次GET，串行、无重试/重定向，不处理队列。输入catalog SHA-256为`27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f`；可信API镜像内catalog独立保持`b5287d7f66ab91ed535d23128796f284f39c7c2c60f126082a820e891d5b252a`。只允许对现有API容器执行独立one-shot，并将自有operator/catalog暂存于`/tmp`，不替换`/app`文件。

执行前20条DB source的kind/name/config必须与批准输入相符，enabled/site_fulltext/syndicate_fulltext均为false；不采集两条已知配置差异源`mof-treasury-debt-data`与`pboc-open-market`。每个source写入前还须锁定并比对整行，防配置、cursor或旗标漂移。只新增采集材料及其revision/discovery，公开摘要与publication继续经既有独立QA/授权流程。因此安装采集定时任务不表示首页或全部动态自动出现新摘要。

新cron只可增加独立owned marker内的短入口，入口小于512B并校验SHA；须保持原night owned block五行逐字节不变，不在marker外新增SHELL/PATH等全局变量。执行与02:00理解任务共用原night lock，互斥忙时skip。Root确认最终冻结/预检前不得安装新cron。

| 核心冻结文件 | SHA-256 |
|---|---|
| operator | `3ae90e31a08da2db5b77b8a08eb3eea05726210efeea3fde37765a424fc4f7bf` |
| tests | `89cf548ba4d747fdf1e5e90edb87787da4dad15c5436ea8ffc7266799d956a0d` |

独立审查发现并由owner修复：launcher误将镜像catalog与operator输入catalog使用同一pin；非preset统一90天覆盖source自定义回溯期；detail同日较晚时间通过日级匹配后可能越过固定anchor。当前分别使用双pin、source配置回落、替换日期前再次校验窗口。

**RISKS**：固定20源是本次有界operator范围，不能表述为Gate 2整源准入通过；来源仍disabled，global安全旗标不变。Gold200、评分阈值、prompt不变，Gate 3仍`CHANGES_REQUIRED`，Gate 4/5未通过。旧来源准入/运行稳定性问题不因本任务消失。

**BLOCKERS**：本阶段安装与独立后验无阻塞。首轮真实采集尚未发生；自动摘要生成和公开未完成，仍走独立QA与授权流程。

**NEXT**：2026-10-28 06:00首次计划触发后，核验实际GET、raw完整性、DB新增范围及公开行集未变，不以plan-only或已安装代替真实运行证明。


## 安装前独立证据

真实plan-only头两次启动在container暂存文件权限及文件扩展名处失败，均未进入HTTP/DB路径；owner修复为API用户可读0600自有临时文件、`.pid.ts`扩展名后第三次通过。临时文件仅在`/tmp`，不修改`/app`。入口SHA为`f41c295f7abab04a52086e1a63925a0002da0e785c55dc1257c8e1c2745db921`，launcher为`2f0fbe671bf955b2f0433de6d6034d794859676557b8081b9b3421c824b419ac`；plan-only结果SHA为`d66f8bea90f44777c4f7fa7b1939b8aef835fca391b52b2b0a91227236ec3922`，NAS该结果文件后验0600。

独立预检sidecar位于`.data/fiscal-qa/nas-latest-collector-candidate-20261027/independent-preinstall-qa.json`，SHA `58c9df5efbc49bdc4d3fa2b0a117cb3ba044a69f34c13f7d8d125d28222e15f5`；独立只读source导出`independent-db-sources.json` SHA `5f4070df35e550d47f11c70a5db7f13a92aff71692d80347b064ae6a0a054f48`。这些ignored artifact不提交。

## 最终安装后验

独立只读核验实际crontab为两个owned block共10行，新增daily job为322B；全cron SHA `aa62799ea5304fd9f742cf97518ea181dbf969b1a5a648a6ac234e4499afd6c8`。原night五行525B与preinstall备份逐字节`cmp`为0，SHA仍`46f015b00139d567391c77174c55182233dd73c2818452ead09cbf1ef2e07f86`；新五行与冻结candidate block逐字节一致，marker外新增全局变量/非owned行均0。备份`crontab.preinstall.20261027T115704Z.2635220.txt`最终0600。入口、launcher、operator hash与上表/预检记录一致。

本次独立观察state为空、API `/tmp/codex-latest-*`暂存残留0；READ ONLY事务确认article/revision/discovery仍439/681/439、publication/override仍137/137。这是计数及安装路径核验，不能称为全protected rowsets哈希审计。最终sidecar `independent-final-qa.json` SHA `8a0376f7ae4f310b412f6c12f0079bd5045716168e0e695468b3de8c762cbe6a`。全套本机测试summary SHA `b8219223e7d56b1e4720020a5de64dfaed121dbc1eb9fc5dda02f619ec5ee433`，日志位于`.data/test-pg/fiscal-collector-core-20261027/`。
