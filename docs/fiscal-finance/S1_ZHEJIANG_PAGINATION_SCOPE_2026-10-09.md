# S1 浙江监管工作分页配置最小范围裁定

**RESULT=APPROVED_SCOPE**。仅批准 `mof-zhejiang-supervision-dynamics` 的 disabled 配置追加现有 HTML pagination opt-in，并以保存 fixture 做离线验证。无需修改 packages、apps、schema 或已有分页实现；不授权 collector、真实新 HTTP、数据库写入、服务操作、worker、模型或付费调用。本轮不重审 Gate 2。

静态基线 `2cb5610ed16098d104821173632fa68066ebcde6`。已读 AGENTS、README、PROJECT_PLAN、STATUS、既有 [Phase A S1](S1_WEB_LIST_PAGINATION_SCOPE_REVIEW_2026-10-06.md)、[Phase B metadata S1](S1_WEB_LIST_DETAIL_METADATA_SCOPE_REVIEW_2026-10-06.md)，以及实际 `web-list-pagination.ts`、`config-keys.ts`、浙江 source 和分页 policy/transport/metadata/preview/collector tests。源码中的 Phase B 模式已有严格 validator、单页 pending snapshot、共享预算和保守日期契约；本裁定只选择已有模式，不重写这些行为。

## 来源证据与范围

用户已选首期浙江主栏目“监管工作”，图片新闻后续。当前配置目录为 `https://zj.mof.gov.cn/caizhengjiancha/`，allow-prefix 只有同一精确目录；列表 selector、+08:00、详情 `h2.title_con` / PubDate regex / `.my_doccontent` 与保存页面匹配。`detail.maxFetches=10`、三个月窗口、requirePublishedAt 与 strict body-ready flag 均已存在；source disabled、两种 fulltext false。

保存相邻页 packet `.data/fiscal-qa/source-next-20261009/zhejiang-page2/manifest.json` 与 `one-get-verification.json` 记录 page 0 和 `index_1.htm` 各10候选，URL material identity 交集0；列表显示日分别为2026-08-17至09-30、2026-06-16至08-11。唯一新 GET 已返回200、12,469 B，SHA-256 `f0346a5b9c5e2a721f2d092b3683cdc0f324ca73a3385b67eddc0b8bed48e704`，attempted/dispatched/rejected=1/1/0。审查只读这些保存账目，没有自行再次请求或独立重跑 raw hash/parser 验证。

page 1 有5/10 URL 日期 token 与列表日不同，token 不是原发布日期来源，不能替换列表日，也不能自动把该差异当作已证实的 list/detail conflict。列表日期仍是候选元数据；这些观察不能证明真实日期权威、全局排序或完整近90日覆盖。旧单篇详情仅证明2026-09-30可见日与列表同日；PubDate=11:13 与列表日午夜不是 exact timestamp equality，不能由此批准精度升级。已知日期疑点和真实 list/detail 日期冲突仍 hold，不能借配置审查解除。

## 精确批准配置

仅在该 entry 的 config 增加：

```json
"pagination": {
  "mode": "mof_index_v1",
  "maxPagesPerRun": 2,
  "maxDispatches": 12,
  "maxPageIndex": 15,
  "detailMode": "direct_html_metadata_v1"
}
```

现有 schema 接受此对象：maxPagesPerRun=1..2、maxDispatches=1..12、maxPageIndex=1..100；page 0 为配置目录，page n 为 index_n.htm。`maxPageIndex=15` 是零基、包含该编号的安全上限，允许编号0..15，不是已证实16页或末页。保存 JS 的16页只作 telemetry；上限碰到必须保守 blocked/needs-review，不能写 complete/initializedAt 或 coverage proven。

保留原 detail 对象及所有 authority/precision 的缺省，不增加 publishedAtAuthoritative、titleAuthoritative、upgradeDatePrecision，不删除 bodySelector，不增 adapter/baseUrl/rewrite/PDF/附件规则。无 detailMode 的 Phase A 拒绝当前 maxFetches=10，因此必须显式选 Phase B；不允许把 detail cap 改0以迁就 Phase A。

`maxDispatches=12` 是每运行列表、详情和每次 redirect 的共同总派发上限，`detail.maxFetches=10` 是整个运行独立详情目标上限，不按页重置。“2列表+10详情=12”只是不含 redirect 的最大组合，并非必须执行的次数；redirect 或失败请求也耗总额度。现有120秒 deadline不变。当前配置没有 date authority/precision，合法列表题名和日期可能直接 resolved，详情不会因 maxFetches=10 自动全部请求；不得把 metadata-only 描述为逐篇详情已核或 body-ready。

现有固定 generation anchor/cutoff 及三个月×30天的可信日期过滤继续适用；未知/非法/未来日期不得靠URL、页序或发现时间补齐。cutoff 相等保留，只有最终可信日严格早于 cutoff 才可 outside_window。列表排序、单条旧日、整页旧日、短页、空页、countPage、404 均不能日期早停并断言历史完成。cursor 和 fetch_runs 永远保持 coverage=unproven、partial=true；成功run/lastOkAt不是覆盖证据。

Phase B metadata 不抓正文、Readability、PDF、附件或OCR，不提升正文状态。现有严格正文 hold 不变；page 0 中PDF候选保留 pending/未就绪，不能删掉以提高通过率或借标题/日期升级为自动精选。OCR继续 deferred。真实 HTML 日期冲突按已有 date_conflict_require_review/stored_metadata_requires_review 保守停页；本次不批准任何日期修复或正文保护变更。

## 文件与必要离线 QA

后续实施允许文件仅：

- `industry/sources.json`：只改该 entry 的 pagination；所有其他 entry、disabled/fulltext/strict/body/date/PDF policy 原样。
- 新增 `tests/zhejiang-pagination-config.test.ts`：来源精确配置、URL构造、保存列表解析与预算断言。
- 新增 `tests/fixtures/zhejiang-pagination/page-0.html`、`page-1.html`、`manifest.json`：仅复制已保存真实raw/解码结果并记录hash、来源URL、保存时间与证据路径；不得冒充同期live快照或新增页面。详情可复用既存 `tests/fixtures/regional-bureaus/zhejiang-detail.html`，不修改它。

本审查独占本文件；STATUS、HANDOFF、SOURCE_MATRIX等共享记录归Root/QA owner，本裁定不修改。实施如需超出这三个范围，不可顺手扩成生产算法改造，须报告具体最小不兼容点。

最低QA：验证 unsupportedConfig 和 validateWebListPagination 均接受精确配置；移除 detailMode 时 maxFetches=10 被拒绝；URL为目录与index_1.htm，maxPageIndex15及非法字段被正确解释。对保存两页验bytes/hash和实际selectors解析，10+10、identity交集0、日期区间与5个token疑点精确复现；列表日期保持原值，不以URL改写。确保fixture provenance与旧单篇/旧9条列表观察分开。

在禁网 MockAgent 或纯离线 seam 核验共享12派发/10详情上限及metadata-only无正文/PDF调用；当前合法list metadata可零详情，不能在test中假定每条必须fetch。原有 pagination policy/transport/metadata contract、regional-bureau-config、source-rules、strict-body-readiness/PDF相关离线回归及typecheck须通过，验证disabled/fulltext/strict和其他source配置未漂移。日期冲突、混合新旧日期、无日期与无complete承诺复用已有契约，不另造早停逻辑。带DB的collector测试本轮不运行；其既有软件证据可引用但不能冒充本轮验证。完整DB/CI QA由独立QA在后续明确授权环境核销；不借测试启动preview/worker或导入来源。

## 八字段交接

**TASK**：一次浙江监管工作 source-specific pagination 最小架构范围审查。

**MODEL**：Sol 静态审查角色；没有项目provider、OCR或付费调用。

**FILES_CHANGED**：仅 `docs/fiscal-finance/S1_ZHEJIANG_PAGINATION_SCOPE_2026-10-09.md`。

**TESTS_RUN**：只读文档、源码、测试及保存manifest；未执行软件测试、HTTP、collector或DB写入。

**RESULT**：APPROVED_SCOPE，仅配置追加既有Phase B模式和上述离线fixture QA。schema/packages/apps修改或真实运行不获批准。

**RISKS**：列表候选日存在URLtoken疑点；单篇时刻精度未获批准；页码稳定性、真实日期排序、跨运行漂移及90日完整仍未证实；metadata不证明正文就绪。

**BLOCKERS**：配置实施与独立离线QA尚待完成；source admission、真实日期疑点、90日complete仍未解决。没有本范围配置schema不兼容点；无需新框架或Gate重审。

**NEXT**：Root按精确范围实施并交独立QA核销；记录partial与date hold，保留浙江来源后续覆盖工作。新HTTP、collector、DB写、服务、付费和OCR均不从本裁定获得授权。
