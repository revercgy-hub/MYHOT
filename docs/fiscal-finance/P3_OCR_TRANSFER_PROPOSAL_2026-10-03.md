# OCR 训练数据传输中断定位与最小替代提案 — 2026-10-03

## 结论

两次受限准备都失败在 `chi_sim.traineddata` 响应未完成，现有材料不能把原因归到上游服务器、代理、Node、TLS 或本地超时中的任何一项。10/2 的 fetch 在设定的 120 秒期限前约 49 秒以 `TypeError: terminated` 结束，且错误日志没有 `cause`、错误码或 socket 字段。单纯加长 deadline 缺少证据支持。

本机限定检查没有发现可复用的 `chi_sim.traineddata`：仓库文件搜索没有匹配项；Tesseract 在 `C:\Program Files\Tesseract-OCR\tessdata` 只列出 `eng` 和 `osd`。因此当前没有已验证的相同训练文件可离线复用。

建议在 Lead 另行批准后，评估 GitHub 官方 REST Git Blob API 作为一次新的、有上限的传输方式：一次 pinned-ref 根目录 Contents 元数据请求，再分别按元数据给出的模型和 LICENSE blob SHA 各取一个 Git blob，共 3 个请求；每个响应均需满足 EOF、长度和 Git blob SHA 校验，再计算本地 SHA-256。此文只是离线提案：没有调用 GitHub API、下载模型/许可证、运行 OCR、改旧脚本或更换 OCR 引擎。

## 已有失败证据

9/30 `.data/fiscal-qa/scan-ocr-poc/prepare-failure.json` 记录：

- 第 1 个请求是官方 `tessdata_fast` `commits/main` 元数据，HTTP 200，4,358 字节，SHA-256 为 `8B63053AD3BDD7B131B45C8364D6C289ECE15972678DAB4392EE11C76DD42706`。这是该 JSON 响应的 SHA-256，不是 commit-object SHA 或训练数据 hash。
- 日志记录的完整 pinned commit 为 `87416418657359cb625c412a48b6e1d6d41c29bd`。模型请求 HTTP 200 后在原 30 秒 Abort 边界失败；9/30 日志未保存响应字节数、Content-Length、逐块信息或数据 hash。未请求 LICENSE。

10/2 `.data/fiscal-qa/scan-ocr-poc-20261002/prepare-failure.json` 记录：

- 只有固定 commit 下的模型请求一次；HTTP 200，`Content-Length=2,469,156`，累计接收计数 16,384 字节，`eofComplete=false`，70,722ms 后记录 `TypeError: terminated`。
- 请求尚未达到 120 秒设置的 deadline。错误被序列化为 `String(error)`；日志未保留 `error.cause`、`code`、`errno`、`syscall`、`address`、`port`、socket/连接状态或最后一次 chunk 时间，因此无法判断是连接被关闭、代理/中间设备终止、读取层错误还是其他原因。日志证明的是 HTTP 状态和累计计数，不是已保存 16KB 文件；响应 chunk 没有落盘。
- LICENSE 请求没有发出，模型未完整保存、无模型 Git blob SHA 或 SHA-256；新 manifest 是 `incomplete` 且 `runnable=false`。9/30 目录仍保留。

当前 Node 为 `v24.16.0`。本机 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY` 环境变量存在且类型为 HTTP proxy URL，`NO_PROXY` 存在；`NODE_USE_ENV_PROXY` 和 `NODE_OPTIONS` 未设置，OCR 脚本也未显式配置 Undici dispatcher。Node v24 文档说明环境代理需 `NODE_USE_ENV_PROXY=1` 或 `--use-env-proxy`；基于可见配置，不能断言原生 `fetch()` 走了这些环境代理，也不能排除透明网络层或其他系统配置。检查过程中没有输出环境变量值、凭证、URL 查询值或认证信息。结论仍是传输根因未知。

## 官方 API 路径与不可变身份绑定

GitHub 官方 REST 文档说明：Contents API 可针对给定 `ref` 返回仓库路径内容；目录响应列出各文件对象。Git Blob API 按 blob SHA 读取 Git blob，JSON 表示中的内容使用 Base64，并包含 `sha` 和 `size`。Git commit 指向 tree，tree 项又指向 blob。Git 文档定义 blob SHA-1 为 `blob <byte-size>\0<bytes>` 的散列。参见 [Repository Contents API](https://docs.github.com/en/rest/repos/contents#get-repository-content)、[Get a blob](https://docs.github.com/en/rest/git/blobs#get-a-blob)、[Git commits](https://docs.github.com/en/rest/git/commits#get-a-commit-object)、[Git trees](https://docs.github.com/en/rest/git/trees#get-a-tree) 和 [Git objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)。

最小的 3 请求候选，不再额外请求 commit 解析或 tree 查询：

1. `GET https://api.github.com/repos/tesseract-ocr/tessdata_fast/contents?ref=87416418657359cb625c412a48b6e1d6d41c29bd`。只接受 GitHub JSON、HTTP 200、未截断的目录数组，并从该固定 commit 的根目录中精确找到 `chi_sim.traineddata` 与 `LICENSE`。必须检查两条记录均为普通文件、名称/路径精确、`sha` 为完整 Git blob ID、`size` 在限制内；仅记录这两个所需条目的 SHA/尺寸。其他结果不作跟随。
2. `GET https://api.github.com/repos/tesseract-ocr/tessdata_fast/git/blobs/{model_blob_sha}`。
3. `GET https://api.github.com/repos/tesseract-ocr/tessdata_fast/git/blobs/{license_blob_sha}`。

第 1 个请求的 `ref` 使用已批准的**完整 commit SHA**，把两个精确路径映射到该快照内的 blob SHA 和 size；后两次只按这两个 SHA 请求，不用分支名、下载 URL、可变 ref 或另一个仓库。每个 blob 响应的 `sha`、`size`、`encoding=base64` 必须分别与第 1 个响应吻合。解码后，按 Git blob 对象规则计算 `SHA1("blob " + byteLength + NUL + bytes)` 并与 API blob SHA 比较，再计算/记录本地 SHA-256；这可核对响应字节就是 commit-root listing 指出的 Git blob。此校验依赖 GitHub REST 响应的官方来源，不构成上游签名验证。

该路线比 raw 文件端点多一层 commit-ref 到 blob 的身份关联，避免把 HTTP 200 当作完整性证明。Base64 JSON 会增加线上字节和内存占用；GitHub 文档虽说明该 API 返回 Base64 blob，本机尚未用该 2.47MB 文件验证响应时延、响应体完整性或该路径的实用性。若元数据或 Blob API 不支持、响应不匹配或传输仍被中断，本批立即失败，不回退 raw、不换端点重试。

## 建议的单批边界（需要 Lead 重新批准后才可执行）

- 仅对固定 repo `tesseract-ocr/tessdata_fast`、commit `87416418657359cb625c412a48b6e1d6d41c29bd`、文件 `chi_sim.traineddata` 与同 commit `LICENSE` 执行。新独立 ignored 目录，保留两次旧失败；不修改或删除旧材料。
- 总计最多 3 个 HTTP 请求：一次 Contents 根目录元数据、一次模型 blob、一次 license blob；串行；每 URL 一次；redirect manual 且 3xx 即拒绝；无 retry、无备用 URL、无其他语言。若目录元数据缺少任一文件，则结束，不发 blob 请求。
- 保持单请求最多 120 秒、全批最多 240 秒的墙钟上限；总时钟从第一请求开始，后续请求只能使用剩余时间。时间沿用此前已审查的上限，但不将其宣称为修复网络故障的办法。每请求应记录开始、结束、总耗时、状态、响应头中可见的长度、累计收到的线上字节、EOF 完成情况以及错误类型/`cause` 字段；发生读取失败即终止本批。日志中禁止写代理凭证、认证头或环境变量值。
- 容量限制：元数据 JSON ≤1MiB；模型解码后 ≤32MiB，license ≤1MiB；各自的 Base64 JSON 响应设置与理论编码大小相称且有界的线上 cap（按 metadata size 计算 `4*ceil(size/3)` 再加固定小 JSON 包络余量）；累计解码文件 ≤33MiB。对每个 response 必须完整读至 EOF、校验解码长度等于 metadata 与 blob response 的 size；不能只靠 Content-Length。超上限、短读、额外数据、Base64 错误或 SHA 不一致均 fail closed，禁止写 runnable 文件。
- 只有两份字节都校验通过后才独占写入新目录；先临时文件、完整 hash 和 Apache-2.0 文本/名称校验，再原子落盘模型、许可证和 manifest。失败证据保留请求/字节计数/error 元数据，不能保留未验证 chunk 当成模型；完整 manifest 保存 commit、两路径、两 blob SHA、size、SHA-256、许可证原文的文件 hash、请求数/时序和验证算法。先前两个失败批次保持不变。
- 不在本批运行 Tesseract；不改 `OCR_RUN_ENABLED=false`；不下载/执行脚本或改变业务来源配置。

这项未来准备需 Lead 新批准，因为 10/2 的 two-request 单次额度已消耗。即使成功，也只提供离线模型身份，不放行五页 OCR；原 10/2 进程监控报告所列真实 Tesseract cadence、资源与 OCR/gold 检查仍是后续独立门槛。

## 停止与风险

- 直接把 30 秒改成更长没有定位 10/2 中断原因；不建议只改 deadline 再重复 raw 下载。
- REST API 仍经同一台机器的网络栈；API 域名或 Base64 不保证不会被代理/中间链路中断。单批一次机会、无 retry；必须在 Lead 重新裁定后才实际尝试。
- GitHub Blob API 为 JSON/Base64，模型响应近似 4/3 膨胀，可能有内存/时延成本；本提案是官方文档可行性推导，不是本机可用性实测。
- 如果未来实施，最小诊断改动应只结构化记录 `name/message/cause.name/cause.code/cause.errno/cause.syscall` 及响应/字节时序，不记录任意 Headers、URL 认证参数或代理凭证。不要把 error 的任意对象 JSON 化后直接落日志。
- Gate 2 不通过；没有正文/采集/数据库/模型服务/发布行为，也没有更换 OCR 引擎。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：离线定位固定 commit 的 OCR 训练数据响应中断，提出最小官方传输候选。

**MODEL**：Luna High。仅浏览 GitHub 与 Node.js 官方技术文档；无训练数据 API 请求、无数据下载、无业务网络请求。

**FILES_CHANGED**：仅新增本文档。旧工具、测试、共享状态文档、apps/packages/schema 均未改。

**TESTS_RUN**：只读检查 9/30、10/2 忽略目录错误日志、manifest、工具 fetch 配置、Tesseract 安装语言列表与仓库文件名；Node `v24.16.0`。未运行 OCR 或安装数据。`HTTP(S)_PROXY`/`ALL_PROXY` 类型与相关 Node proxy 开关仅检查存在性，不记录变量值或凭证。

**RESULT**：9/30 HTTP200模型流在30秒Abort时字节数未知；10/2 HTTP200声明2,469,156字节、累计16,384字节后于70,722ms terminated。记录无底层cause/socket字段，不能归因。没有本地 chi_sim 文件。提出最多三请求的官方 Contents pinned-ref 元数据 + 两个 Git blob API 数据流，以 blob SHA 与本地Git blob SHA1核对 commit 内容，再校验文件 size/EOF/SHA-256/license。

**RISKS**：API路径尚未由真实文件验证；Base64扩容且仍经过同一网络链路；hash一致是对象内容校验，不是上游签名或训练内容质量验证。

**BLOCKERS**：旧批次已耗尽；运行需 Lead 另行批准。模型未完整、许可证未取得，OCR锁继续关闭。

**NEXT**：Lead/Sol 对本提案及诊断边界评审后，再明确是否授权一次最多3请求的新批次；批准前不请求训练数据、不改实现、不运行 OCR。
