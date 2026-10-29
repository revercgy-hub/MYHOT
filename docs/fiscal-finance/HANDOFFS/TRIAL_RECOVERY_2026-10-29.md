# 2026-10-29 NAS Staging恢复与独立QA交接

## 当前状态

```text
STATUS=TRIAL_RUNNING
AS_OF=2026-10-29 09:49 Asia/Shanghai
STAGE=仅现有NAS Staging有界试运行；没有Production操作
GATE=Gate 2 PASSED_FOR_BOUNDED_P4_PILOT；Gate 3 CHANGES_REQUIRED；Gate 4/5未通过
API_CODE_SHA=8973827402b621445ea2d0546932da737a6223d6
API_IMAGE=sha256:ee9ead66eb33d557bbc6206c975ed9649b87973a6de15b4049b4f18543ec54ba
HOST_FIX_COMMIT=9f1f74423f760ea0c2b2c23f1f251e9080d3fd0a
OPERATOR_SHA256=03fcf23cef20aaedef0b41e950a1c0ed70337170f3cfb3fa2977dc23ba2c3704
LAUNCHER_SHA256=f7012eaea54d15516c307172a7dbccfbdbbd753d21e8dcad8a8b523e2efd146d
ENTRYPOINT_SHA256=a411682f409b6bfae99de253a16b64cfead1620178a37f0705fc90f61642c2d3
```

## 故障链与已确认的原因

- 10/29 02:00 understand job状态文件记录`REVIEW_REQUIRED`、`LAUNCHER_FAILED_OR_INTERRUPTED`，SHA-256 `6fab48981d7c9f49538594cc6f9badf771464b0a42521e0494e80cd4bcd1464b`。它是独立失败事实，但不是持有共享锁约6小时的进程。
- 03:30 summary cron entrypoint实际传入了`--execute`。日志中的`PLAN_ONLY`是execute前预检；真实execute子进程已经启动。因此故障不是漏传`--execute`。
- 根因为summary operator将业务连接池限制为`DATABASE_POOL_MAX=1`，又用该共享池的`sql.reserve()`独占唯一连接来持有PG advisory lock。随后第一个业务SQL必须向同一池取连接，永久等待；容器API主服务健康时没有活跃SQL/model工作。
- Root在09:40+08对容器内独立Node PID 1281发送`SIGTERM`。只结束该Node，不重启API容器。termination sidecar `/vol2/1000/docker/fiscalhot-summary-draft-nightly-20261028/state/summary-draft-20261029-0330.termination.json` SHA-256 `8f77aaddbed6c6d8da5cdcd728627e24f8d4ede24daec4db155e3d22aeeceeaf`、mode0600；03:30执行日志SHA-256 `f258c44e099df0f739a4b392ad6f7983d137d6353735ec0ae9b5416e2b0bc005`。
- 06:00 collector cron明确记录`LATEST_COLLECTOR=SKIPPED_LOCK_BUSY runId=daily-latest-20261029-0600`。原因是03:30 summary execute进程仍持共享锁，不是02:00 understand持锁。
- 锁文件保留原device/inode `76:161641`、mode0600/0字节；终止后holder为0，前台acquire/release PASS。10/29一次性summary marker仍保留，防止当天重试。没有summary draft、intent或provider receipt，providerCalls=0。

## 修复与安装读回

operator将PG advisory lock移到专用postgres client session，业务pool仍保持max=1；锁竞争失败会关闭专用client，释放时显式unlock并结束session。隔离PG17.11数据库`summary_lock_20261029_test`上focused test 7/7通过，包含“持锁时业务`SELECT 42`完成、第二锁被拒、释放后可重取”；`npm run typecheck`通过。API image没有重建。

launcher在容器内用GNU coreutils 9.7 `/usr/bin/timeout --foreground`监督execute：上限为25分钟与距上海时间06:00剩余时间中的较小值；先TERM，10秒后KILL。夜窗仍为02:00–05:59，once marker保留，摘要源仍20项、每夜至多10篇/10次provider、仅本地模型、无重试。Core执行回报：TERM路径exit124且容器PID 2147不存在；忽略TERM后KILL路径exit137且PID 2116不存在；边界03:30=1500秒、05:59=60秒、06:00拒绝。未提供独立原始smoke文件，本交接只标注为Core执行回报。首轮未加`--foreground`的KILL smoke留有一个已退出zombie PID 2072，无活跃资源或锁；按Root决定不重启API处理测试遗迹。

r6 bound candidate外层manifest SHA-256 `c2076a2e17335e2b55d8c7e34f5f59f3e0cb3a776e5c2cc03696186cdfe5bd2b`，绑定API image ee9及operator/launcher/manifest/entrypoint。实际NAS workspace逐文件readback与候选一致：operator `03fcf23c…2c3704`，launcher `f7012eae…e2efd146d`，runtime manifest `729d0b69…965ee311`，entrypoint `a411682f…1642c2d3`。安装器输出`SUMMARY_DRAFT_INSTALL=INSTALLED`。实际API容器image ee9、running、restartCount=0。

最终cron readback有四个owned markers：daily-latest 06/12/18、understand 02、PG17 backup 01、summary 03:30。整表SHA-256 `274649597fe358a92894df0ebc5b76385953ce5c701340f177517e86b656e338`、1900B。summary owned block 483B/SHA `e64809e20807bcbbff948d9495e057019c2fec53355a72b17e52be60673c7be1`，绑定entrypoint a411…42c2d3。对比r6安装前备份（1899B/SHA `3f6cbfe6c5c29156e8b9e961b45989f260b80b3450c9f10992a47c4c7c9cdffe`），非summary部分仅出现一个额外LF；其余三个job命令和marker未变。记录为`PASS_WITH_DOCUMENTED_FORMATTING_DELTA`，不声称全crontab逐字节相同。没有再改或回滚crontab。共享锁再次确认同inode、无holder，短暂前台flock smoke PASS。

安装后仅跑plan-only smoke：`summary-draft-plan-20261029-0945-308008`，roster 10项，providerCalls=0、draft/intent JSON=0；原once marker存在。run log SHA-256 `cfb839e21e78a609e8f212d1199cffb0e147333f9287fbac20324227d3453d55`，roster SHA-256 `38d7d28cb4831a5746f359647aeb01126870ec3dc1f3bdc9bb894a324fa6a0e2`。这证明修复后的计划路径，不证明真实摘要生成。

r6最终候选、安装文件hash、once/lock/cron读回及formatting delta汇总在本机private sidecar `.data/fiscal-qa/summary-draft-r6-independent-qa-20261029.json`，SHA-256 `b7d135ec496a9b74a008b20598af2d908a02ae27372a71c2dd05fe12adf5aef1`。其中timeout进程退出码和时窗数值明确标为Core执行回报；未收到Core原始smoke文件，因此不把该部分称为本Agent独立复测。

## 06:00缺口的有界手工补采

Root批准Ops仅补跑一次fixed46 list采集；它是manual recovery，不能改记为06:00 cron成功。run `manual-recovery-20261029-0942`在01:41:38.792Z开始、01:42:32.870Z完成：46/46 source ok、49 GET（46 list + 3 detail）、5新增、0失败、模型/provider 0。Scope SHA-256 `27766197321218289006b8cb97af1796349332eb8c22eb9a394c9e0020f180fd`；result SHA-256 `3dae752b093a490c25d1373b2966ea653153589c34bee149c9b6bb724067ec9b`。49份response body的字节数、raw SHA、decoded SHA、HTTP200、EOF、无redirect/error已逐一复核通过。计划文件SHA `fe874df6d22f559057fc4436b0dff1152ad8fb54f61189c4e75a034718684a99`；执行log SHA `6f5dc276e49ad63719ca4dd7f5853ba6100b417682f40be783edc6372e9532df`。所有collector/model/worker/publication相关flags为false，无重试/redirect，固定source catalog SHA `27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f`。

独立只读SQL确认五个新增ID各有一行article、revision=1及一条discovery；均无publication或editorial override：`sog114aw69a549i5q58nx8rc6` (Fujian, pending)，`e55qmbo77l9a4elfovpgtrvy9` (Jiangsu, ok)，`mc2760mttgnw99v0hap7yi4im` (Jiangsu, ok)，`i758oqu7el8o048ktmhec6qeu` (GovCN, pending)，`x2ejcqlyq4xouo9zahgdqkxsn` (Heilongjiang, ok)。

补采后全库为510 articles / 804 revisions / 510 discoveries；body 319 ok / 182 pending / 9 unconfirmed；publications/editorial overrides 137/137，Gold review cases 200，receipts 0，48来源中启用或全文flag非零者0。最新采集文章发布时间为10/29 09:11+08；新入库不等于发布。

## `/all`条目少的独立核验

`apps/web/app/routes/all.tsx`没有解析或传递`window`；它调用`/api/site/pool`。`packages/backend/src/publication/pool.ts`对eligible且可见的public items按timeline分页，每页40项、最多50页，没有滚动7日过滤。滚动7天的默认值属于不同的`/api/v1/items`接口，不是`/all`。

NAS直接SQL和no-proxy HTTP读回一致：`/all`与`/api/site/pool`均HTTP200；pool返回137条、每页40、共4页。最新`published_at`为10/27 09:35+08，最新`timeline_at`为10/27 13:32+08。5篇手工补采新文均未发布，因此没有出现在/all；不是缓存、分页遗漏或默认7天窗口。Root最初通过工作站proxy观察到的502/connreset不代表NAS Web/API故障；直连no-proxy路径200，API容器健康且未重启。

独立补采及终止证据侧车：`.data/fiscal-qa/manual-recovery-20261029-independent-qa.json`，SHA-256 `175e470abedf5d8a4f802a90b1fe7c483ccd333fc82f261a8854640f426aa82b`。这个本地private evidence file未提交到Git。

## 下一步与限制

- 今天的摘要夜窗已经错过，且10/29 once marker仍在；用户对白天临时生成10条摘要的可选授权尚未答复，因此没有白天模型执行。若未获用户明确答复，下一次摘要计划触发是10/30 03:30 Asia/Shanghai。
- 今天仍待观察的collector计划触发为12:00、18:00；backup首个计划运行是10/30 01:00。manual补采不补记06:00计划结果。
- 新入库条目维持未发布状态；不批准摘要、不操作Gold、不启用自动精选。Gold200和筛选阈值不变。
- 需要实际夜间草稿运行、摘要逐篇人工审核、来源90日/分页覆盖和多个稳定周期证据。Gate 3仍`CHANGES_REQUIRED`，Gate 4/5未通过；Staging试运行不代表Production资格。

### 后续增量：白天one-off摘要草稿

以上记录反映09:56前后的状态。当日稍后用户明确批准最多10篇的本地模型草稿运行；实际只运行9篇，全部生成私有`summary-draft.v1`并经独立QA确认。9篇仍待管理员人工审核，不代表approve、publication或cron成功；夜间默认03:30安排未改。完整候选筛选、授权、执行与逐篇核对见[白天摘要草稿交接](DAYTIME_SUMMARY_2026-10-29.md)，独立QA sidecar SHA-256为`5b78b25fe94ac8d3d99acbeb8b10e19f6d126d9a470e113938beb528bbf4f289`。
