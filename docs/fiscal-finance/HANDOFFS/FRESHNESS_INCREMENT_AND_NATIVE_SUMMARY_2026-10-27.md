# 最新官方资料增量与原生摘要交接（2026-10-27）

**TASK**：落实“继续安排采集，现在时效性不足”，对官方来源分两波执行固定近7天有界增量，再对严格正文中的6篇生成并独立审核原生摘要。采集与摘要发布分开验收，不因article入库就声称公开页已更新。

**MODEL**：采集operator实际providerCalls=0。原result保留旧硬编码Luna标签，另以provenance correction说明本轮collector owner为Sol fallback，未把该标签当模型执行证据。6篇摘要由`gpt-6-luna high`原生会话生成，Sol独立逐句grounding及prefilter/taxonomy/canonical QA；不是runtime provider流程、无receipt。

**FILES_CHANGED**：本范围只有本交接与STATUS/PLAN文档；operator的7天anchor差异、执行意图、raw响应、原生草稿和QA均留在ignored`.data/fiscal-qa/freshness-20261027/`。未修改通用采集器、source配置、Gold、prompt、admission flags或发布代码。

**TESTS_RUN / RESULT**：两波均使用private operator SHA`64af5445f3260a5bf1d78ec29ce97a6287f6a22e3c6362bcc69cfe53e9f1d2fe`、catalog SHA`27af3250bbc472ed20019983093b43336cc1967b9ae3193e6b202da4df27ad3f`。每波以开始时间固定7天窗口，拒无日期及future候选；串行、最小1100ms、redirect/retry均0，只允许articles/revisions/discoveries写入。

| 实际执行 | 波1 | 波2 |
|---|---:|---:|
| source数 | 12 | 8 |
| 总GET（上限） | 16（42） | 16（28） |
| list/detail GET | 12/4 | 8/8 |
| 新article | 13 | 8 |
| 正文ok/pending | 4/9 | 8/0 |
| 失败来源 | 0 | 0 |

合计32 GET、21篇新article（12正文ok、9pending）。独立QA逐份核验raw bytes/SHA/EOF/gzip decoded hash，并以新ID对照真实RRRO行：发布日期全部在对应anchor近7天内且非future，body hash一致，每篇恰1 revision和1 discovery、0 publication，无identity重复。数据库从418/660/418变为439/681/439（article/revision/discovery），body为254ok/179pending/6unconfirmed。最新article发布日期为2026-10-27 01:35Z；近24小时article从0到6。

采集后publication仍131，最新公开发布日期仍2026-10-21 16:00Z（上海10/22），不能把采集最新日期冒充公开内容最新日期。48 source的完整配置/关闭状态与本轮before exact一致；Gold200 hash仍`fbd469d962cbdf123953ec4236cdd1a53b8c6beeb62a7be24214e47bb7da4076`。相对于此前已验收131-publication完整快照，除允许的3张表外，其余21个rowsets hash全部相同，含Gold、source、publication、override、receipt和job等。此次before只存counts与source exact；完整protected比较使用历史accepted快照，未虚构本轮before hash。raw未存逐GET时间戳，cadence仅有代码serial sleep/early-dispatch guard及成功执行证据，不声称已测出每次间隔。

独立sidecar：`independent-wave1-qa.json`、`independent-wave2-qa.json`及两份`independent-*-postqa-raw.json`。6篇原生摘要已完成12句逐句grounding，初审纠正重庆“资料清单”时点外推及河南特别国债范围；final draft SHA`f810638d427d6339e8e9748e473b2938109df1f77812469e6e1c9b8a32b54a8d`，manifest SHA`53e746840a860268ab36c022193ed249e7669d11ab0dc2e0f7f81f2ae1e83229`，grounding QA SHA`b739b107024e14f6abb8231cf3e04108f5358f7d4d60d3a383cbcd0a179edbea`。独立canonical QA SHA`6634124aaa85115a73824cd292bf23158ae35bcc2fa81495ab8fd9c5185e49fb`经当前f60 `validateNativeSummaryQa`真实调用通过，6篇均selected=false、score/reason=null，prefilter理由和taxonomy合法。

PG17 backup与protected snapshot使用同一exported MVCC snapshot。独立核NAS dump最终0600、1,858,656B、SHA`abdbbaa147c8e0b787750141424f31781f1a3764e77f8df7123d3994483816ce`，其24个rowsets与独立wave2 RRRO完全相同。只读f60 preflight为6eligible/0excluded、0write、无row/advisory lock。备份proof SHA`0dd9635738c6cca281e34c14d7c3f5969d8592eb375dfd231bda92b0981d8f75`，preflight report SHA`d228fb16615e78f2d46eca16f919df483a6792a3b733595b58b13d9a94d30763`，独立backup/preflight QA SHA`b45543e9e0d6b8e00adf4127ca5e1f8068e53efb0688c7f534f78ee1daa53987`。本段仅描述写入前证据，实际apply及公开后验另记。

**RISKS / BLOCKERS / NEXT**：原生草稿通过不等于已发布。仍需Root精确SHA授权后走canonical CAS，随后独立核实际6项/版本/摘要/selected=false、保护表与公开LAN可见性。pending正文仍不能编造摘要或外推全文；未通过本轮即宣称source admission、严格90天覆盖、每日自动采集或Gate 3/4/5。Gate 2仍仅bounded P4；Gate 3 `CHANGES_REQUIRED`，Gate 4/5未通过。

## exact6 canonical导入与独立公开后验

Root精确授权后，f60于2026-10-27 05:38:55Z一次提交6篇，无重试。receipt/output SHA为`066eaea6f42976bfffa08e5ab47f9bd360a785df71a54146f84fee2df9b4f6b4`。独立RRRO确认article/revision/discovery仍439/681/439，publication/override从131到137、audit316到322；24个rowsets仅article/override/publication/audit变化。以manifest原始rowtext替换6条article并剔除6条新override/publication/audit后，四张表before hash全部精确还原，证明没有附带别行修改。每条article仅raw provenance与updated_at变化，正文、原日期、content hash与revision1保持不变，override为version1。

六篇公开summary/tags/category与已审核QA精确一致，selected=false、score/reason=null、body_mode=summary、indexable=false。独立7次LAN GET检查6个original API与/all，6份摘要精确匹配、body均null、响应noindex，/all同时包含6个新标题；collector另行24GET页面/API/pool后验亦通过。readingMode=full单独如实记录，不能据此声称已公开全文。当前公开最新发布日期为2026-10-27 01:35Z（上海09:35），eligible近7天17、近24小时3；与采集库近24小时6篇区分。Gold200、48source关闭状态及其它20个protected rowsets未变。

独立后验artifact `independent-summary-apply-postqa.json` SHA为`58109c5d22b19b1f8ef4430a2f6e1a573956245f29138a62806d1edb9762a8df`，附独立RRRO raw、四表重建及7次LAN证据。此次6篇为原生辅助摘要、非人工精选、非Gold、未执行runtime provider pipeline；Gate状态不变。
