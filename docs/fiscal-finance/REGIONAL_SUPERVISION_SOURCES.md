# 财政部各地监管局动态来源

核验日期：2026-09-29。本文针对**财政部各地监管局**，不包含国家金融监督管理总局地方监管局。财政部官网目录将35个派出监管局分两页列出：[目录首页](https://www.mof.gov.cn/znjg/jgsz/czbzdfzyb/)（18个）和[目录第2页](https://www.mof.gov.cn/znjg/jgsz/czbzdfzyb/index_1.htm)（17个）。目录只证明机构名称和官网域名，不代表每个局的动态栏目已核验或已采集。

## 已配置来源

`industry/sources.json` 在原10个来源基础上新增两项；两项均 `enabled=false`，站内及 RSS 全文均关闭。来源频率暂设为每6小时一次，供 Gate 2 后逐源验收时使用。没有给各地监管局补造机构实体，也没有把中央汇总项的来源归属伪装成地方发布者。

| 来源 | 真实栏目与解析规则 | 本次证据 | 限制 |
|---|---|---|---|
| `mof-regional-supervision-dynamics` | 财政部网站“财政新闻”列表；从实际 HTML 中按 `ul.xwfb_listbox > li:has(a[title*='监管局'])` 选择条目，链接标题读 `a[title]`，日期读同一列表项的 `span`。另用财政部目录确认的35个官网域名前缀过滤链接，并保留列表里的原始 HTTP URL。 | 本地保存的原始列表页显示25个列表项；项目 `fromHtml()` 解析配置后命中7项，分别署名广西、云南、吉林、福建、重庆、安徽、山东监管局，7个链接互不重复。样本标题、列表日期和原局官网文章 URL 均可从列表项读取。CSS `:has()` 已由项目实际解析器在此快照上验证。 | 这是财政部官网的选登列表，不是35局逐条全量源。中央列表只取配置首页，采集器不会自动翻页；真实页脚脚本标记共20页，本轮没有抓取历史页。当前目录与列表证据中监管局文章 URL 使用 HTTP，所以配置只允许目录中核验的35个 HTTP 主机；若官网今后切换为 HTTPS，条目会被拒收，需要有新页面证据后再扩充。每条链接的中央列表日期与原局详情发布日期尚未逐条对照。 |
| `mof-xiamen-supervision-dynamics` | 财政部厦门监管局“工作动态”栏目：`ul.liBox > li`，标题使用链接 `title` 属性（无值时解析器回退可见文本），日期读列表项内 `span`，只允许 `https://xm.mof.gov.cn/caizhengjiancha/` 下的文章 URL。 | 原始列表页快照命中10条；首条为“财政部厦门监管局：办公室党支部深学细悟财政科学管理试点座谈会精神”，列表日期2026-09-29，URL为 `https://xm.mof.gov.cn/caizhengjiancha/202609/t20260929_3998338.htm`。分页脚本声明共10页；官网旧页 `index_1.htm`、`index_2.htm` 也可见较早条目，但本轮 collector 配置仅读首页。另有官方详情样本[《组织召开2025年上半年厦门市财政运行情况座谈会》](https://xm.mof.gov.cn/caizhengjiancha/202507/t20250729_3968931.htm)，可核对标题、正文、发布日期2025-07-29和文章URL。 | 最新列表首条详情页本轮未成功直取；详情样本只证明一篇历史文章可读。列表首页以外没有纳入采集配置，历史页的重复率、跨周期 freshness 和所有详情页正文尚未批量核验。 |

## 官方目录核验清单

以下35个名称及首页域名来自财政部官网目录两页。仅福建、厦门在本轮进一步检查了工作动态栏目；其余33个标记为“目录已收录、栏目待核验”，不能据此视作可采集源。

| 序号 | 财政部监管局 | 官网目录域名 | 工作动态栏目状态 |
|---:|---|---|---|
| 1 | 北京 | [bj.mof.gov.cn](http://bj.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 2 | 天津 | [tj.mof.gov.cn](http://tj.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 3 | 河北 | [he.mof.gov.cn](http://he.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 4 | 山西 | [sn.mof.gov.cn](http://sn.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 5 | 内蒙古 | [nmg.mof.gov.cn](http://nmg.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 6 | 辽宁 | [ln.mof.gov.cn](http://ln.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 7 | 大连 | [dl.mof.gov.cn](http://dl.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 8 | 吉林 | [jl.mof.gov.cn](http://jl.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 9 | 黑龙江 | [hlj.mof.gov.cn](http://hlj.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 10 | 上海 | [sh.mof.gov.cn](http://sh.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 11 | 江苏 | [jsz.mof.gov.cn](http://jsz.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 12 | 浙江 | [zj.mof.gov.cn](http://zj.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 13 | 宁波 | [nb.mof.gov.cn](http://nb.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 14 | 安徽 | [ah.mof.gov.cn](http://ah.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 15 | 福建 | [fj.mof.gov.cn](http://fj.mof.gov.cn/) | 官方“工作动态”栏目和详情可查；原始列表 HTML、selector、历史分页及重复待核验，暂不单独配置 |
| 16 | 厦门 | [xm.mof.gov.cn](http://xm.mof.gov.cn/) | “工作动态”首页已核验并配置为 disabled 来源；历史分页及详情质量待逐源验证 |
| 17 | 江西 | [jx.mof.gov.cn](http://jx.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 18 | 山东 | [sd.mof.gov.cn](http://sd.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 19 | 青岛 | [qd.mof.gov.cn](http://qd.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 20 | 河南 | [ha.mof.gov.cn](http://ha.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 21 | 湖北 | [hb.mof.gov.cn](http://hb.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 22 | 湖南 | [hn.mof.gov.cn](http://hn.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 23 | 广东 | [gd.mof.gov.cn](http://gd.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 24 | 深圳 | [sz.mof.gov.cn](http://sz.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 25 | 广西 | [gx.mof.gov.cn](http://gx.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 26 | 海南 | [hq.mof.gov.cn](http://hq.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 27 | 重庆 | [cq.mof.gov.cn](http://cq.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 28 | 四川 | [sc.mof.gov.cn](http://sc.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 29 | 贵州 | [gz.mof.gov.cn](http://gz.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 30 | 云南 | [yn.mof.gov.cn](http://yn.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 31 | 陕西 | [sx.mof.gov.cn](http://sx.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 32 | 甘肃 | [gs.mof.gov.cn](http://gs.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 33 | 青海 | [qh.mof.gov.cn](http://qh.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 34 | 宁夏 | [nx.mof.gov.cn](http://nx.mof.gov.cn/) | 目录已收录；栏目待核验 |
| 35 | 新疆 | [xj.mof.gov.cn](http://xj.mof.gov.cn/) | 目录已收录；栏目待核验 |

“财政新闻”页本次7条筛选项的发布单位中，广西、云南、吉林、福建、重庆、安徽、山东均保留在标题中。页面首页只提供一段选登样本，不足以证明未出现的局没有动态，也不代表该页完整收录目录里的35局。

## 汇总入口筛选与未采用入口

`/zhengwuxinxi/caizhengxinwen/index.htm` 是持续更新的混合新闻列表，原始快照中可同时看到监管局动态、财政政策发布、司局稿件和地方财政新闻。CSS 列表项筛选和35个目录域名前缀共同将配置限制到可见标题带“监管局”且文章链接位于目录官方域名下的内容；因此这是一条有明确边界的低请求选登源，仍须观察实际覆盖与来源日期口径。本轮筛出的7条里没有厦门域名，与厦门首页10条候选没有相同 URL；这只描述两份样本，不能证明两来源在其他采集周期不会重叠。

另一个名称看起来更专用的“全国财政新闻联播 > 财政部”入口 `/zhengwuxinxi/xinwenlianbo/caizhengbu/` 在本轮实际快照中仅有2024-02-22附近的条目，虽有历史分页脚本，但显著陈旧，不配置为动态来源。中央目录页及两个列表快照保存在被忽略的 `.data/fiscal-regional-audit/`，用于本地解析器复核；这些文件不是代码或运行采集结果。

## 当前边界

- 目录核对覆盖35个局；本次只有中央选登源和厦门独立栏目进入配置。目录核验不能写成35局栏目验证或已采集。
- 福建官方局域和“工作动态”栏目、正文样本、历史列表页可由财政部及福建监管局网页查到；本机对该局列表/详情的有界请求返回502，缺少原始 HTML 快照。因此本轮不猜 selector，也不单独配置福建栏目。中央选登页实际包含一条福建监管局来源文章。
- 未对35个局逐一发请求、未做跨页/跨周期重复率或freshness测试、未跑 collector 写库、未启用 worker、模型或全文发布。两条新增来源保持停用；Gate 2 仍未通过。
- 如果某局文章同时出现在中央选登与其独立来源，URL去重需在未来隔离库 collector 验收中核对；当前只确认中央样本自身无重复 URL。
