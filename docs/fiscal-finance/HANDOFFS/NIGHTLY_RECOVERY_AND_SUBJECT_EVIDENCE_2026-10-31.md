# 2026-10-31 夜间取证恢复与机构依据检查

Gate 3–5仍未整体通过。本轮没有追加付费请求、重跑凌晨模型、修改Gold、权重或60/65/76门槛，也没有新增公开发布。

## 实际夜间结果

- 01:00 PG17计划备份成功：2,413,567字节，SHA256 `a8fe9ae7bd45e806ed2d12c3e6fbd6bcc14285a8c98088b0ca19bf980ebf33a0`。已逐项复核dump与DDL字节/hash，并在本机独立库实际恢复，得到604文章/987修订、137 publication/137 override、18 receipts、Gold200、来源开关全关闭。
- 02:00理解任务实际完成8次调用、8个单次attempt、8个completed回执，业务表全0；随后导出回执证据失败，原r3状态仍为REVIEW_REQUIRED。隔离PG监听127.0.0.1:55433，而3处导出/计数命令遗漏了显式连接参数。
- 03:30摘要r10正常结束，roster为0、providerCalls0，无新增草稿。这次验证了空队列流程，不能证明摘要生成质量通过。
- 10/30 18:00采集44/46成功，福建、四川列表超时，新增12；10/31 06:00采集45/46成功，贵州列表超时，新增6。102次dispatch中99份完整响应逐份校验原始及解码hash，3次超时均保留，不重试，provider0。两轮仍为部分来源失败。

10:29只读快照：610文章/993修订/610发现，正文434 ok/163 pending/13 unconfirmed，36来源有ok样本；pub/override137/137、receipts/attempts18/18、Gold200，来源开关全关闭。样本数不代表90日完整覆盖或来源准入。

## 恢复与r4修复

从保留的隔离PG按正确端点只读导出，保留原失败的0字节文件及原state；恢复预测、脱敏回执证据、PG17 custom dump。原artifact verifier通过，dump在本机独立库实际恢复并确认8 completed，无新增模型调用。恢复dump SHA256 `a928715fe2386d28d1ddcac9c1829f531ed91f9cd594af8e3ce8cd0694142aaf`。

源码3处命令均补充`-h 127.0.0.1 -p 55433`。从修正后的真实launcher抽取导出阶段，在保留PG上执行，验证三个实际命令、私有文件、hash及8:8:8:0计数；没有执行模型阶段。首次复验脚本漏带launcher的is_sha辅助函数，导出后在hash检查处失败；原复验保留，补齐辅助函数后另建r2复验通过，未重发模型。

r4安装保留原r3状态与回退材料，仅更换launcher、状态路径和原02:00 cron的入口hash：

- launcher SHA256 `73fabcb9229da6d59031c6984ff8f03117f8abc6c0fbac11b4b972511d823a80`。
- entrypoint SHA256 `4eeaa27638058c37e7c258a815dbeb14a323b0992e0db6f3b1e0dabc408f1cbb`。
- cron SHA256 `1028d5bbbe162c0e12e7634c14ccc5eaaeb4a566fb9fd180c018cb8708411051`。
- 228文件与冻结输入验证通过，新code manifest `9E4B9D9CEB8AED07E526F6FF8638022F5ADA0997E42212783E83F6481B19A074`。
- 使用真实继承的共享锁描述符执行入口，返回NOOP_OUTSIDE_WINDOW，新r4 state未创建。首次安装探针因未继承锁描述符被FLOCK_REQUIRED拒绝；修正探针后通过，没有绕过锁检查。
- 回退目录`/vol2/1000/docker/fiscalhot-understand-nightly/backups/understand-r4-20261031`。下一次既有02:00计划为11/1，尚不能计成功。

预测中的runtimeContainerId、hostname、镜像与PG共享网络归属均复核；在证据私有备份和本机恢复验证后，仅清理该夜间任务的两个精确容器ID。Staging API未重启，其他工作负载不动。

恢复及清理完成归档SHA256 `24172e25764efb7eec0275f148746f0db4d44a6b3fdeaa70ce2e69f938551e64`；夜间周期、原始采集及真实备份恢复证据归档 `047860543f2e7333af6feb039c879ec90bb427b40d53dea011545bbc20566584`。均本机/NAS一致，NAS mode600。修复代码`016bae2`的[Check41160318042](https://github.com/revercgy-hub/MYHOT/actions/runs/41160318042)全部成功。

## 结构化机构名单不能只凭白名单

保存预测中的福建省国库现金招标稿返回机构列表mof、pboc、fujian-finance、pboc-xiamen；原文及确认来源仅支持pboc与fujian-finance。原逻辑只检查是否在机构词表，没有检查机构是否有原始身份依据。

开发源码新增filterSupportedSubjects，复用现有标题/摘要身份上下文，保留原文、明确发布域或已确认来源主体支持的机构；runStructure在白名单检查后应用该保护，并将结构化版本标记为subject-evidence@1。无新模型请求，不回写原始回执。集成stub回归确认业务结果移除无依据分行、原回执仍保留原模型机构名单。正例覆盖原文明确的厦门分行与已验证会计司发布域，负例覆盖模型名单不能自证。

本机完整601项594通过/7条件跳过，typecheck、Web构建/Web25与NAS既有镜像smoke通过；随后加入候选提示词后补跑18项分析/机构/提示词回归全通过。该机构修复尚未安装到NAS整体API或228文件冻结源，不能把本机修复说成NAS运行已应用；本次NAS安装的r4仅修复导出连接。

## 精选说明候选：免费20次完成，仍不采用

新开发候选selection-score-dimensions-work-value-candidate.md把重复尺度说明整合成一张表，区分“明确业务信息”和“方法首次创新”，保留八类、五轴原权重、噪声压制和安全边界。仅system说明改变，10篇输入hash不变；qwen3.5:9b、temperature0、reasoning none，每篇2次，本机独立库20 received/20单次attempt，业务表全0，付费请求0。

| 同一已知开发压力样本 | 原本地v2 | 新本地候选 | 上次DeepSeek原v2 |
|---|---:|---:|---:|
| TP | 3 | 5 | 3 |
| FP | 3 | 3 | 0 |
| FN | 4 | 2 | 4 |
| TN | 0 | 0 | 3 |

内蒙古金融企业监管与中央预算公开稿恢复入选，新疆20、大连56仍漏；彩票游戏停销63、普通会计检查77、服务中心80仍误选。候选只匹配5/10，不能凭减少漏选忽略误选；不切正式提示词，不扩大完整150，也不消费旧holdout。

候选system SHA256 `b64216905b2649aac70a6a5ea1288dbc699da3736173374ae21be07cda6b8381`；独立复核请求hash、原始五轴、加权和双轮汇总、单次回执全部通过。含源码快照和回执库归档SHA256 `51f4a370885375005e037672159da0b0883995bfbfbcff7e98b20e3a87079a2f`，本机/NAS一致、NAS mode600。

第二轮付费方案已冻结：同模型、同10篇、同采样，仅换本候选system，新增最多20次、不重试、不发布；请求数累计20→40，费用累计上限仍5元。按10/31重新核验的[官方高峰价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)，本轮保守预留0.878568元，连同上一轮完整保守预留0.871568元累计1.750136元。原授权只有20次且已用完，必须用户另行明确批准新增请求数，不能以剩余金额代替批准。未执行第二轮付费请求。

后续：Gate 3先决定是否进行上述有界对照，任何候选仍需完整development及新的独立事件验收；Gate 4继续原始证据与来源边界核验；Gate 5等待11/1 r4实际触发、非空摘要及人工审阅、多周期稳定性与端到端验收。不得将取证恢复或单项代码CI通过当成Gate整体通过。
