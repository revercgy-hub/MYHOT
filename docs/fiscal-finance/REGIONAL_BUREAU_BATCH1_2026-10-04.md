# 财政部监管局栏目结构调查：福建、北京、上海

日期：2026-10-04（北京时间）。本批仅依财政部目录已核实域名，对福建、北京、上海做获批的只读HTML观察。六次request dispatch全部用backend Undici 8.11.2经`guardedFetch` direct route；总上限6、每局首页与首页实际显示的一个“工作动态”栏目各一次，`maxRedirects=0`、无retry、每次20秒/6 MiB。每阶段都有请求前one-shot marker。只保存公开HTML及散列/DOM摘要于ignored目录`.data/fiscal-qa/regional-batch1-20261004/`，不请求详情、附件、分页/历史页；无collector、DB、extract、job、OCR、模型或source配置写入。

## 请求与页面结果

| 监管局 | 首页观察 | 首页中实际可见的栏目链接 | 栏目页观察 | 列表候选与窗口 |
|---|---|---|---|---|
| 福建 | `https://fj.mof.gov.cn/`：200 `text/html`，17,964 bytes，SHA-256 `4937e237a97e2ef622ce02a97717d103bab71ba3ccf6ebb3a391474d3ad201f3`；title `福建监管局`，57个anchor。 | 首页主内容“工作动态”标题链接：`https://fj.mof.gov.cn/gzdt/caizhengjiancha/`，实际anchor path `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`。另有左侧“工作动态”指向父级`/gzdt/`；本次据主内容标题的精确href取样。 | 200 `text/html`，12,434 bytes，SHA-256 `2e559c476d16de6b9e0c2424f474b23e4358e8dee7234ec713e6685bfa3361bd`；title `工作动态`，24个anchor。观察到10个本局文章候选、10个唯一href；页面显示日期范围2026-08-10至2026-09-23。 | 首条《厚植机关文化底蕴 涵养向上向善机关风尚》，2026-09-23，`https://fj.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998020.htm`。另一条《“三个度”做深做实服务代表委员工作》列表日2026-09-18，URL路径日期为9/17。 |
| 北京 | `https://bj.mof.gov.cn/`：200 `text/html`，15,422 bytes，SHA-256 `2914ef03454529e2dae2f642e5e0537f697a5a599db79f1e93c5a6a1465f37ef`；title `北京监管局`，42个anchor。 | 首页侧栏与主内容“工作动态”均指向`https://bj.mof.gov.cn/caizhengjiancha/`；主内容anchor path `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`。 | 200 `text/html`，12,992 bytes，SHA-256 `aab710ff07f9dbf56a43cdea2b2a20bd88170a671850b7a231182cbdd6f4fdf8`；title `工作动态`，26个anchor。10个本局文章候选、10个唯一href；页面显示日期范围2026-09-15至2026-09-28。 | 《坚持“四个进阶”提升属地中央预算单位预算编制审核质效》，2026-09-24，`https://bj.mof.gov.cn/caizhengjiancha/202609/t20260924_3998098.htm`。中央选登曾见《聚焦四个强化 推动民生领域资金监管与服务走深走实》；本列表日期2026-09-16而URL路径含9/10，详情日期未在本批请求。 |
| 上海 | `https://sh.mof.gov.cn/`：200 `text/html`，15,355 bytes，SHA-256 `73ab1a1ae2ecaa24d8b6a8c5f90db871f4dfdacdb396cc56ef4637049e09edf5`；title `上海监管局`，40个anchor。 | 首页主内容“工作动态”标题链接：`https://sh.mof.gov.cn/gzdt/caizhengjiancha/`，实际anchor path `div.mainboxerji > div.zzright > div.gzdtbox > div.gzdtlist > h2 > a`。另有左侧“工作动态”父栏目链接`/gzdt/`。 | 200 `text/html`，12,617 bytes，SHA-256 `cbbd59f4ac4dea453140f497543ed156c2324dee336366a430d57ab97a1eebce`；title `工作动态`，24个anchor。10个本局文章候选、10个唯一href；页面显示日期范围2026-08-28至2026-09-28。 | 《四维靶向施策 扎实推进增值税留抵退税抽审提质增效》，2026-09-23，`https://sh.mof.gov.cn/gzdt/caizhengjiancha/202609/t20260923_3998015.htm`。另一条《立柱架梁 夯基固本 稳步推进会计师事务所日常监督工作》显示9/11，URL路径含9/4；详情日期未知。 |

三页均观察到列表文章锚点实际位于`div.mainboxerji > div.zzright > div.listBox > ul.liBox > li > a`，其最近`li`同时含标题与形如`YYYY-MM-DD`的列表日期。此为本次DOM观察路径，不是已验证的稳定collector selector，也未用项目collector/parser处理这三页。三页列表共各10个文章href，无列表内精确重复；不能从单页推断发布完整度、分页或跨周期重复。

列表之外的导航确实存在：福建与上海左侧可见“工作动态”“图片报道”，北京左侧还含“关于我们”“机关党建”“通知通告”“办事指南”；三页面包屑含首页/工作动态。页面DOM没有语义`nav/header/footer`元素锚点（对应计数为0），但这不表示无导航噪声；后续解析若复用DOM路径，必须以实际列表容器分离侧栏与面包屑，而不能靠通用导航标签推断。保存列表页的锚点中只看到返回首页/栏目层级的面包屑，未观察到明确数字页码、“下一页”或历史分页链接；翻页及深页窗口仍未知。

列表显示日期与URL路径中的日期在部分条目不同（例如福建9/18列表日对`t20260917`、北京9/16对`t20260910`、上海9/11对`t20260904`）。本轮未请求详情，因此只记录各列表可见日期；详情`PubDate`、文章实际发布日期、标题一致性均未知。页面上也有党建学习、培训、一般会议/活动类标题；依用户确认的内容边界，活动形式本身不判定价值，而本轮不取详情，故不对正文业务事实或精选结果下结论。

## 预算与安全证据

`homes.json`阶段：backend Undici `8.11.2`，dispatch `attempted/dispatched/rejected=3/3/0`，9个事件（每次create、sendHeaders、headers各一），三个首页皆200且最终URL与原请求一致。`columns.json`阶段同版本，`3/3/0`、9个事件，三个栏目页皆200。合计6次dispatch，拒绝0；每个目标host恰两次，一次首页与一次其真实DOM所示栏目href。未跟随redirect、无fallback或重试。配置环境将采集/模型/推送/OCR及私网开关置false，direct route避免代理内部跳数不可审计。这里的budget仅覆盖本批backend Undici实例，不能回溯或替代旧批次unknown hop证据。

ignored证据包含`batch-started-once.json`、`columns-started-once.json`两个request前锁、两个runner、6份raw HTML与两个JSON manifest。QA可离线复核所有响应原文及SHA。raw HTML可作DOM审核，不代表已保存selector或实现collector。

## 结论与下一步

三局都成功发现首页主内容标为“工作动态”的栏目链接；三条栏目页面本次均稳定返回HTML并暴露10篇可读列表候选，适合进入下一步离线结构/日期复核。福建旧材料中“未留存原始列表DOM、请求502”的缺口仅被本批当前独立观察补充，不追认旧请求，也不表示福建来源已通过。列表可读也不等于详情正文、内容价值、分页、稳定性、source config或Gate 2验收。

本批没有详情预算；候选详情标题/发布日期匹配及正文质量保持unknown。建议QA先对保存HTML独立复核三组list DOM路径、日期文本和分页锚点，再单独申请最多三条详情的核销用于标题/日期/正文配对。QA通过且Lead另行授权前，不新增source config、不运行collector、不扩展其他局。35局逐局目标仍只完成3局的首页/栏目结构观察。

## TASK / MODEL / FILES_CHANGED / TESTS_RUN / RESULT / RISKS / BLOCKERS / NEXT

**TASK**：完成财政部福建、北京、上海监管局各自首页和首页实际标示的一个“工作动态”栏目页的有界HTML结构观察。

**MODEL**：Luna High；未调用项目模型或provider。

**FILES_CHANGED**：新增本文；另按QA复核将先前owned的`CONTENT_BOUNDARY_IMPLEMENTATION_2026-10-04.md` focused核验计数由7纠正为8，并明确analyze测试因本轮不触碰数据库而未运行。raw HTML、runner、one-shot marker与manifest保存在ignored `.data/fiscal-qa/regional-batch1-20261004/`；未改source配置、shared status、应用代码或Git index。

**TESTS_RUN**：本批6次只读GET且为上限；backend Undici budget `6/6/0` dispatch，HTTP均200、HTML hash与请求事件已保存；离线DOM统计每页10条候选、10个唯一列表href。无软件测试、collector、数据库或详情抽取。

**RESULT**：三局真实观察到同一可见列表DOM形态；列表标题/日期/href可从实际HTML读取，但未创建或验证parser selector。新证据仅覆盖三局各一页。

**RISKS**：仅单一时点首页候选；列表日与URL路径日期存在差异，详情发布日期未知；未验证跨周期、翻页、详细正文及候选业务事实。

**BLOCKERS**：三局详情配对、selector稳定性、分页/窗口和跨周期仍待证；剩余32局未逐局调查。Gate 2仍`NOT_PASSED`。

**NEXT**：先由QA离线复核raw DOM；若通过，再向Lead申请受限详情页观察。本批全部预算已用完，不自行补请求。
