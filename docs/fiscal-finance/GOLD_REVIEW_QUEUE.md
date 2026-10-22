# Gold人工审核队列

后台 `/admin/review` 用于对冻结的Gold候选正文作人工判断。它与文章发布/精选编辑后台分离：审核动作只写私有Gold review表和审计记录，不改文章、revision、publication、analysis或任务队列，也不会触发模型、采集或外部provider。

## 候选与隐私

候选由本地审核CLI冻结并直接导入数据库；API没有公开上传接口。冻结时保存原始候选metadata、来源/内容hash、正文快照及manifest来源hash。导入到空Staging数据库时，原本地`sourceArticleId`和revision只作为私有metadata来源记录，不声明为NAS文章行绑定；审核仍会绑定不可变的batch hash、case ID和正文`contentHash`。

审核接口只返回中性展示字段、正文快照和已有人工标记，不返回模型proposal、评分、理由、seed、event group或split。正文接口默认每页25条，最大25条；列表与正文仅供已登录管理员查看。写操作继承后台session和CSRF校验。

## 人工判断

审核者先明确勾选候选，再对所选项统一提交`select`、`reject`或`either`。**未勾选表示尚未提交，不表示reject。** 每次POST最多50项；同批次按事务全有或全无。服务会校验batch hash、case ID、正文hash和Idempotency-Key。已确认项不可再改；内容hash变化或其它并发冲突会返回409，应刷新后重新确认。

当前API只能把`needs_review`推进到`user_confirmed`，不编辑seed、event group或benchmark split。既有20条人工确认和原15条seed随冻结输入保留；新确认不会自动成为seed或holdout，也不单独令Gold达到ready状态。只有完整Gold manifest经独立校验后，才可以进入后续人工校准评审。

## 导出与校验

`GET /api/admin/review-batches/:id/export`下载不含正文的`gold-review-annotation-overlay/v1`。它只包含case/hash和人工决定，不是完整Gold manifest。离线CLI使用该overlay与原始冻结manifest合并，保留模型建议与输入证据，然后再运行显式seed清单验证。

当前管理API包括：

- `GET /api/admin/review-batches`：批次和pending/confirmed计数。
- `GET /api/admin/review-batches/:id?status=pending|confirmed|all&limit=25&offset=0`：分页只读队列。
- `POST /api/admin/review-batches/:id/decisions`：显式提交所选case及内容hash；必须带`Idempotency-Key`和CSRF token。
- `GET /api/admin/review-batches/:id/export`：下载人工标记overlay。

增量表由`database/migrations/0039_gold_review_batches.sql`创建。迁移应用、payload导入及NAS运行验收状态以最新`STATUS.md`和handoff为准；代码测试或本地导入测试不代表NAS迁移或Gold Gate通过。
