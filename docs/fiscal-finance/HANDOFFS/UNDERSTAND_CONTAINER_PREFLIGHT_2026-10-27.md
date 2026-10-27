# NAS容器内understand链路预检交接（2026-10-27）

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：准备在NAS上以隔离client容器验证当前应用代码的`runStructure`与`runUnderstand`组件及其`chatJson`/receipt链。此次完成了离线代码/护栏QA和只读资源预检；因资源门槛不满足，没有创建容器、初始化NAS测试库或发出模型请求。

**MODEL**：计划使用局域网Ollama `qwen3.5:9b`，`reasoning_effort=none`。本次实际调用为0；只读Ollama进程清单显示该模型原本已加载。不能据此认定本试验产生了推理或其实际GPU执行状态。

```text
BRANCH=feat/fiscal-finance-hot
CODE_COMMIT=d2d49e97097518de45ec65234c283ef07b6fac30
BASE_SHA=1290ad86c4532b6465ae16337d3c29a545e782dc
NAS_APP_CODE=d45f0d93f5374b7c72cdf0efb64ada6a03b84404 (未启动/未改动)
GATE=Gate 2仍仅PASSED_FOR_BOUNDED_P4_PILOT；Gate 3 CHANGES_REQUIRED；Gate 4/5未通过
PILOT=预期4个固定development输入，每个串行调用structure→understand，共8次；HTTP硬上限12；实际0次
NAS_ENV=容器0；NAS临时测试库0；migrations 0；NAS业务写入0
BLOCKER=最新只读MemAvailable为1,335,720 kB（约1.27 GiB），低于创建容器前要求的4 GiB；SwapFree为48 kB
```

**FILES_CHANGED**：代码提交`d2d49e9`仅新增guarded pilot runner/护栏/测试，并只把`runStructure`、`runUnderstand`两个现有组件函数导出；没有改函数实现、提示词或业务规则。文件SHA-256：

| 文件 | SHA-256 |
|---|---|
| `packages/backend/src/editorial/analyze.ts` | `DA1CA23D07D82A8E10263F4C22ACBEB76D409708B790DD87A15A6DDD10E40EF8` |
| `scripts/fiscal/ollama-understand-container-pilot.ts` | `38056529998F2897636279F1363B58FB54E80BE227726D0E9F588C61B11DA5E7` |
| `scripts/fiscal/ollama-understand-pilot-guard.mjs` | `C12CF408F6F04BB79EAD95C8AABD195D9964388F774FCC36565544C56EFCFD64` |
| `scripts/fiscal/ollama-understand-pilot-guard.d.mts` | `05170EBE3095591D7A8F177F2DFCFA1993F839805809A49C413E9B0281AE822A` |
| `tests/ollama-understand-pilot-guard.test.ts` | `2D9504CC063CA34DA0F72B2C6F28390BA0723A27CD60CAF85D5424C657F5B844` |

**TESTS_RUN**：B在该最终代码树上报告并提供以下离线结果：护栏定向测试7/7；`npm run typecheck`通过；pilot单文件严格`tsc`及runner/guard的`node --check`通过；完整`npm test` 502项中497通过、0失败、5个既有数据库配置skip；Web build通过、Web tests 22/22；`git diff --check`通过。完整套件使用本机隔离PostgreSQL cluster/database `fiscalhot_ollama_understand_qa_20261027_test`（loopback 55432，36 migrations），测试后`pg_ctl -m fast -w stop` exit 0且无监听，cluster/database/log保留；cleanup sidecar SHA-256 `34FEA2FA49030BE06685D6DD45D4864B4488454C0696D6643038E6D5B7128E24`，PostgreSQL log SHA-256 `D2F57BEACD74ABD2FE5682D0AD1003EE580DD96A7516EB37E37264ECC0EE85BE`。测试未访问真实provider，未执行本pilot runner。五个全套skip与既有专用DB环境配置相关，见[10/26局域网Ollama交接](OLLAMA_LOCAL_PILOT_2026-10-26.md)。

**RESULT**：四个request-only输入固定为：

| case ID | request input SHA-256 | 原文body SHA-256 |
|---|---|---|
| `body-xkm1grgd10aj3ua4nwg5gfofd` | `8BF8AB8815F43EF674BBC463296FBC3AA636A048F7DABBE38E42AC26604CCE1B` | `2FF690CBE17DC2F480F9A0FD3FB14441FA6EB8C5AFDA50339ACAE1D756C7155B` |
| `body-ebtwbnudqgmlkzj60wviji165` | `3F97D5522F2057B3AE52D2E0EE6E08F270C41D7BFE5BD2CAF8833E9E5C245993` | `13D0315D40C9BC690A3C47D7BBF155CBDBAC7FC6DF49753C76F51592AF334452` |
| `body-fn6rshoxnk425y3ui1cxr6mpp` | `2668AD3C5865B169F22D34853F4600EC437A8B6F9B9DB8038570D3F1B9C251D3` | `C45CF48DA8FB58E95D1765E8D9D88388731270717D63C83B6125CBBE09A8A339` |
| `body-j33dctglguvwqfa4ksqsdlwdf` | `059E3C2D4607FCD0E7A0A8365BCAB7BD2A42191619E430DD8E1E183350221466` | `2EB40BBC46DF54E9B0548BD64E033EAF9616BE6147F1232DF3A56555B6275EAB` |

四例均属于既有development集，不是fresh样本。runner只读取冻结的`inputs-request-only.json`，核对整文件SHA、case级input/body SHA及`sourceSplit=development`；不读私有labels/manifest。只计划依次调用项目现有`runStructure`和`runUnderstand`，不运行prefilter、score、`runAnalysis`、`normalizeAnalysis`、精选判定或发布。结构请求使用800 max tokens和默认120秒超时；理解请求使用16,384 max tokens和180秒超时；两者串行、每案各一次，不自动重试。理解输入不含标签；固定文本材料media为空，且视觉关闭。成功后预计8个真实`llm` receipts和8个attempts；独立数据库仅允许预算行初始化/设为12、receipt及attempt写入，不允许sources、articles、analyses、publications、translations或job数据变化。以上是尚未执行的runner契约，不是结果。

**RISKS**：隔离client预案会复用NAS现有API镜像并共享其network namespace，但在独立文件系统/cgroup运行，因此即使以后执行也只能证明该隔离进程用当前复制源码及镜像依赖访问了本地provider和隔离receipt库，不能宣称在线API进程已接入。由于环境预检未达门槛，当前未检查或证明client镜像/依赖、容器namespace、55433端口与新数据库状态。测试输出与Receipt/grounding均不存在。

只读资源artifact为`.data/fiscal-qa/development-understand-container-20261027/resource-snapshots-r1.json`，SHA-256 `AE145C7FF80E52FEE3AD3B4FDED635DDF6F6E708710B208F5341E4BF08F5194E`。三次procfs/进程快照间隔约57秒，MemAvailable依次为3,094,584、2,133,144、1,335,720 kB，折算约2.95、2.03、1.27 GiB；SwapFree依次28、36、48 kB。一次只读Ollama `/api/ps` GET为HTTP 200，记录`qwen3.5:9b`的`size_vram=14,604,325,354`字节；该字段不代表本任务推理，也不足以证明实际GPU计算。采样期间模型调用和资源变更均记为0。

本次另修正了10/26交接中operator metadata SHA-256的手工转录。现值`94A900CA58EFBAB798CA2CE8E6FBAA61C444CBB365C859AD9428D1A4E8911B39`与artifact实际hash一致；没有改动artifact或旧预测。

**BLOCKERS**：最近一次MemAvailable低于4 GiB创建门槛且三个快照持续下降；NAS运行的`llama-server`占用也在采样期间增长。没有创建任何容器或测试库。Gate 3仍`CHANGES_REQUIRED`，Gate 4/5仍未通过；本轮不提供这些Gate的证据。

**NEXT**：资源恢复后重新做只读快照，并且先确认内存达到至少4 GiB及55433未占用；再审API镜像身份、Node/依赖版本、容器无port/volume、独立cgroup/文件系统与同network namespace、测试库名和迁移/业务表空状态。完成代码和4个input hash freeze后，须再由Root明确授权才运行8次计划调用。成功或失败后冻结output与receipt证据，做独立schema、grounding及业务表计数后验；不得把此预检写成understand通过或Gate通过。
