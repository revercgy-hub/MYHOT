# 2026-10-29 白天一次性摘要草稿试运行

## 范围与授权

用户明确批准今天进行一次最多10篇的本地模型摘要生成，生成内容仅供管理员审阅，不自动批准、精选或公开。该运行是带独立短期审批文件的手工 one-off，不是 cron 成功记录；03:30 夜间默认窗口、night operator 与既有 once marker 保持原样。Gate 3 仍为 `CHANGES_REQUIRED`，Gate 4/5 未通过。

按既有用户偏好，对当日最新 roster 做了人工相关性筛选。只读候选查询固定沿用20个已批准来源，时间窗为 roster anchor 前7天，且要求 body 状态为 ok、无 analyses、无 editorial override/publication、来源关闭且为 first-party editorial。整库48个来源的 enabled/site_fulltext/syndicate_fulltext 均为0；20个批准来源属性全部匹配。严格条件下共18项候选，未见已存在的同文章/正文 attempt；没有按来源传播度或流量降低排序。

最终只选9项，未为凑满10项纳入纯党建、学习、干部培训或泛化会务内容。原10项自动 roster 仍保留为单独 plan，不被覆盖；新的 immutable roster 为 `summary-daytime-20261029-1019-curated`，anchor `2026-10-29T02:20:11.836Z`，SHA-256 `cbdc9bb091d3957f4173ac21fe9db4f91e81d0a5f8904ad17580bbc225588321`。

| Article ID | 日期 / 来源 | 文章 | 业务相关性 |
| --- | --- | --- | --- |
| `tle2h9dij7kxc13vdpeq7bhyw` | 10/28 四川 | 2027年中央驻藏预算单位“一上”审核 | 预算审核、零基预算、支出核验与后续执行监管。 |
| `o8ggqulfyzr604lqdx4ntgzh3` | 10/28 上海 | 财税政策评估 | 评估政策执行、资金效能、堵点及整改闭环。 |
| `pn7pzqajns4i3bjk3zln25mia` | 10/28 湖南 | 财政收入监管 | 收入月报、风险线索、44个县市区71笔核验及16项指标分析。 |
| `qkt26sc3okp103xmnsg5pgjsw` | 10/28 湖北 | 服务代表委员与财政监管 | 涉及文保专项资金、经费保障和绩效管控；比一般代表走访有具体财政业务内容。 |
| `bjbcagwc04cx0rs5eriwh4rko` | 10/27 北京 | 财政科学管理落地 | 一般预算、专项债、零基预算和预算单位全周期监管。 |
| `x1dmqlr5ruztwqva9yybq8ujj` | 10/27 浙江 | 预算执行分级监管 | 转移支付风险清单、穿透核验、违规拨付和预警处置。 |
| `txpc2n8eqj3kns8hagr93f8b3` | 10/26 北京 | 彩票市场调控资金管理 | 资金分配、用途、申请、绩效与发行销售机构监管要求。 |
| `e55qmbo77l9a4elfovpgtrvy9` | 10/23 江苏 | 民航发展基金审核 | 投资补助及贷款贴息项目的预算、凭证、绩效和合规审核。 |
| `mc2760mttgnw99v0hap7yi4im` | 10/23 江苏 | 以旧换新绩效评价 | 超长期特别国债资金分配、现场核验和资金使用绩效。 |

未选的9项为：`nhtqew1vrsx5eup8km93zu2jc`（青年理论学习）、`sllmhmpyt20ngoficyak0tt19`（干部蹲点学习交流）、`xtfy1jodyxg24o8hc0bimzswd`（党建专题学习）、`wmv5ra95f6m2fhftw07dks8ng`（代表工委联系服务机制，缺少具体预算监管事实）、`o3ep44c5d80nvcbsdd80a1vm1`（党课）、`jlnu79o7z8z20sw0hya6ccc3a`（党日学习）、`wvpbav055hi1aq0hjffmh4jhi`（注册会计师法专题学习会，缺少具体监管行动）、`xvi2hho5okcwmk2datw04f1yk`（座谈会精神学习，业务细节有限）、`phtnsuw3a6dkh2mgq8g2etqfv`（党性学习）。

## 授权与运行

- Approval 文件 SHA-256 `eb7d221ef4123d2495c02dd23ffcca470179e5789fb69919255b023bf32e3dc6`，绑定 run/sourceRun `summary-daytime-20261029-1019-curated`、上述 roster SHA、operator SHA `b61d81a3454de4b93b9db55c0ed3e5c8a98dd928a5d27ba8537db6e80a24208f`、模型 `qwen3.5:9b`、本地 endpoint `http://192.168.3.100:11435/v1`，审批有效期截至 `2026-10-29T02:50:35.226Z`，上限10篇/10次。
- 单日 claim `oneoff-2026-10-29.claim.json` SHA-256 `62dbcd5160890955d907d9d08090ee6bf550ce32a5d9caf6fe5ca8423f49cef7`，mode 0600，approval SHA 与 runId 一致并保留在私有 intent 目录。
- one-off operator 只在 `/vol2/1000/docker/fiscalhot-summary-daytime-20261029-1018/operator.ts` 私有临时副本执行，SHA 与 approval 一致。夜间源仍为 `03fcf23cef20aaedef0b41e950a1c0ed70337170f3cfb3fa2977dc23ba2c3704`，未被覆盖。
- 执行由 API 容器内 `/usr/bin/timeout --foreground --signal=TERM --kill-after=10s` 包住整个 Node operator，限时1500秒。10:23:19+08 开始，9个 provider attempt 从 `02:23:19.423Z` 至 `02:26:17.761Z` 串行完成，约178.3秒；审批到期时间比运行起点晚约27分钟，因此本次实际 wall-clock 上限为1500秒。runner exit 0。
- Ops 执行前只读检查本地 Ollama `/api/tags` 和 `/api/ps` 均 HTTP 200；唯一 `qwen3.5:9b` digest 为 `6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7`，运行前未加载。operator 本身固定相同模型/endpoint并限制 fetch 到本地地址；未请求官方来源或其他模型。

## 独立只读验收

Luna 对完成后的 Staging 文件与数据库作只读核验：9篇均为合法 `summary-draft.v1`，draftId、receipt、prompt/user/system hash 互相绑定；每个 receipt 仅1条 `live/received` attempt，receipt 最终均 `completed`，9次之间没有重叠或重试。9篇正文、revision、article/source row SHA 均与当前数据库相符，analysis/override/publication 均为0。所有草稿仍在私有文件中，`selected=false`；9篇的 `category=null`、`tags=[]`，本次没有自动分类或精选。

运行后关键计数为510 articles / 804 revisions / 510 discoveries；publications 137、editorial overrides 137、Gold review cases 200；9 receipts / 9 attempts；全局 selected publication 0；48来源启用、全文、联播flags均0。9个目标均无 publication 或 override。原共享锁 inode `76:161641` mode 0600，fuser为空且前台 flock 获取/释放通过；数据库 advisory lock 为0，其他非idle backend为0。

Luna 对9篇摘要逐条对照原始正文作了事实抽核，未见明显无来源的数字或实体。消费品以旧换新摘要提到“向消费者发放千余份问卷”，原文同时包括消费者和参与商家；这是省略部分对象而非错误事实，人工审核时可补齐。具体摘要内容和判断均不替代管理员审核。

独立核验侧车：`.data/fiscal-qa/daytime-summary-20261029-independent-qa.json`，SHA-256 `5b78b25fe94ac8d3d99acbeb8b10e19f6d126d9a470e113938beb528bbf4f289`。执行 stdout：`/vol2/1000/docker/fiscalhot-summary-draft-nightly-20261028/logs/summary-daytime-20261029-1019-curated-execute.log`，SHA-256 `f5fe2640e0cc53695693ef76e5e44a4f78584b350aa603881377600635320460`。

## 后续

这次是一次手工受限草稿生成，不是计划任务、稳定周期、公开发布或人工审核通过。9篇须由管理员逐篇核查后，才可另行决定是否审批；本次没有 approve/reject、publication、Gold、精选或来源设置变更。默认下一次夜间 summary 仍为10/30 03:30 Asia/Shanghai。来源覆盖、长期稳定性及Gate 3/4/5状态都不因本次运行而改变。
