# P3 福建分页观察（2026-10-07）

## 结论

经 root 分两批核准，对福建监管局工作动态精确读取第 2–4 页候选。`index_1.htm`、`index_2.htm`、`index_3.htm` 均返回 HTTP 200、原 URL，无重定向；各页按当前 selector 解析到 10 条唯一候选。页面脚本继续生成后续页路径，显示 `countPage=50`。四页日期顺序均不单调，当前窗口候选只在第 0–2 页样本中出现，第 3 页已早于 90 日边界；抽样不能证明 90 日覆盖完整。来源仍 disabled，`Gate 2=NOT_PASSED`、source admission 未通过。

## 请求与原始证据

- 精确请求：`https://fj.mof.gov.cn/gzdt/caizhengjiancha/index_1.htm`；单次直连 HTTPS GET，返回 HTTP 200，最终 URL 与请求一致。
- Undici 8.11.2 dispatch budget：上限 1，attempted/dispatched/rejected 为 `1/1/0`；create/sendHeaders/headers/error 事件为 `1/1/1/0`。未发生 redirect 或 retry。
- 请求限制：20 秒、6 MiB、`maxRedirects=0`，direct route；完整批次上限 120 秒。响应以 `identity` 编码到达，读取至 EOF。
- 响应 HTML 为 12,408 字节，SHA-256 `6185ddd4c56efee0cbaf7ff4b5521f69deb0ad9ae093c53f7e988af34f70cab3`。原始响应和完整 dispatch/DOM manifest 在 ignored `.data/fiscal-qa/oct07-accelerate-pagination/`；`run.native-exit.txt` 为 `0`。
- 后续单独核准的顺序批次只请求 `index_2.htm`、`index_3.htm`：两个 GET 均 HTTP 200、exact final URL，budget `2/2/0` dispatched、无 redirect/retry，原始 body 均读至 EOF。`index_2.htm` 为 12,506 字节，SHA-256 `b4ce8192a7264b48ffcd822c455b98562a054b4c4d8196a213a9821cd527f40a`；`index_3.htm` 为 12,476 字节，SHA-256 `cb1efe13108a8ba8c26d8fbcfe07674e5534a7e7033eae9088bb44ed74025469`。此批运行用时 336 ms，`pages3-4/run.native-exit.txt` 为 `0`。
- 请求前离线核对了已保存的第 1 页 gzip 原始字节：4,399 字节，SHA-256 `fe899365992feb4b51a9cbbbee6fd73b14411eb5b599296b42c81e22f9cbbdea`；用仓库现有 bounded decoder 解压后为 12,434 字节，SHA-256 `2e559c476d16de6b9e0c2424f474b23e4358e8dee7234ec713e6685bfa3361bd`。原始 manifest URL、EOF、状态和 hash 一致。当前来源配置 hash 与本地 `industry/sources.json` 核验一致，source 与全文开关均关闭。

本报告记录的 live 请求仅为上述三个分页 HTML GET。没有请求详情或附件，没有运行 collector、worker、模型、OCR，也没有连接或写数据库。采集、模型、Jina、IndexNow、Feishu、私网和 OCR 开关均显式关闭；provider credential 环境变量已清除。

## 列表与分页观察

福建配置 selector `div.mainboxerji > div.zzright > div.listBox > ul.liBox > li` 命中 10 行；10 行均有标题、可见日期及栏目内 HTTPS `.htm` URL，候选 URL 10 个且无页内重复。与已保存第 1 页比较，跨页 URL 交集为 0。

第 2 页日期按页面行序为：8/12、7/31、7/24、7/23、7/10、7/9、7/8、7/28、7/16、6/17。顺序不是严格新到旧：7/28 排在 7/8 后，且最旧日期 6/17 位于末行。因此不能用首个旧日期或列表顺序推定分页终点。

3 条的 URL 日期 token 与可见日期不同：列表日 8/12 对应路径 8/05；7/28 对应 6/26；7/16 对应 6/25。其他 7 条一致。列表日期是页面可见字段，路径 token 不应代替发布日期；本轮没有请求详情来核实差异。

分页脚本标记 `currentPage=1`、`countPage=50`，并含 `nextPage=currentPage+1` 和按页码生成 `index_<n>.htm` 的链接脚本。基于该保存脚本，root 随后单独核准了精确 `index_2.htm`、`index_3.htm` 两次顺序请求；两页也各返回 10 个符合 selector 的栏目候选。静态的 50 页数值不能证明其他页面仍可访问、没有重复或覆盖完整。

四页的静态候选观察如下。每页都是 10 条；`90 日内`按含 2026-07-09 起始日计算。顺序列为非单调的页面包括日期倒序破坏或行序跳跃；它直接说明不能用首个旧日期作为停止条件。

| 页码 | 精确页面 | 可见日期范围（最旧–最新） | 90 日内 / 更早 | 可见日/路径日不一致 | 日期顺序 |
|---:|---|---|---:|---:|---|
| 0 | 栏目首页 | 2026-08-10–2026-09-23 | 10 / 0 | 4 | 非单调 |
| 1 | `index_1.htm` | 2026-06-17–2026-08-12 | 8 / 2 | 3 | 非单调 |
| 2 | `index_2.htm` | 2026-05-27–2026-08-28 | 2 / 8 | 5 | 非单调 |
| 3 | `index_3.htm` | 2026-05-15–2026-05-28 | 0 / 10 | 2 | 非单调 |

四页共 40 条候选，没有相同 URL，也没有相同可见日期；但各页最早与最晚日期构成的区间有交叠（例如页 0/1 的区间相交于 8/10–8/12，页 2/3 相交于 5/27–5/28）。因此，仅比较区间不足以推断按页严格分段；逐行日期顺序确实不单调。页面 1、2 都越过 90 日起始边界，页面 2 仍有 2 条窗口内项目；页面 3 的样本早于边界。这里的日期范围和候选数来自四张已保存页面，不代表请求其余静态声明 50 页后会得到何种覆盖。具体原始 body hash、dispatch 清单、行级标题/日期/URL及 pager 元数据保存在 ignored `.data/fiscal-qa/oct07-accelerate-pagination/manifest.json` 与 `.data/fiscal-qa/oct07-accelerate-pagination/pages3-4/manifest.json`。

标题词审阅在第 0–3 页共提示若干可能的内部组织、学习或培训类题名（行级条目在 manifest 中）；这是供人工业务审阅的提示，不是噪声判定或过滤规则。其余标题与内容质量、正文可用性、详情日期一致性尚未验证。

## 对准入的影响

此页补足福建列表分页存在且 exact `index_1.htm` 可读取的一个现场观察，并给出一次跨页 URL 去重结果。它同时显示日期顺序非单调、日期路径冲突和栏目混合题材，故后续 90 日回填必须逐页核验，不能靠页面声明页数或遇到某日期即停止。来源保持 `enabled=false`、站内/RSS 全文关闭；本观察不构成 source pass、90 日覆盖证明或 Gate 2 通过，也不授权再请求其他页。
