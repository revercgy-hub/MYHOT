// Seed fixed, verified editorial summaries into the isolated local preview database.
// Run only with LOCAL_PREVIEW_ENABLED=true and the exact preview DB; this script never fetches,
// enqueues collection/model jobs, or stores source article bodies.
import { assertLocalPreviewIds, prepareLocalPreviewSeedEnvironment } from "./lib/local-preview-safety.ts";
import { resolveLocalPreviewEnabled } from "../apps/web/app/lib/local-preview.server.ts";
import { isDeepStrictEqual } from "node:util";

const safe = prepareLocalPreviewSeedEnvironment(process.env);
if (!resolveLocalPreviewEnabled(process.env) || process.env.SITE_URL !== "http://127.0.0.1:3000"
  || process.env.API_BASE_URL !== "http://127.0.0.1:3001" || process.env.WEB_HOST !== "127.0.0.1") {
  throw new Error("local preview seed requires LOCAL_PREVIEW_ENABLED=true and SITE_URL=http://127.0.0.1:3000");
}

const { sql, closeDb } = await import("@aihot/backend/db");
const { identityKeyFor, upsertMaterial } = await import("@aihot/backend/content/materials");
const { publishArticleTx } = await import("@aihot/backend/publication/publish");

const previewActor = "local-preview-seed";
const samples = [
  {
    id: "local-preview-pboc-omo-191",
    source: { id: "local-preview-pboc", name: "中国人民银行" },
    title: "公开市场业务交易公告 [2026]第191号",
    publishedAt: new Date("2026-09-29T00:00:00+08:00"),
    url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026092908461628271/index.html",
    category: "monetary-finance",
    tags: ["公开市场", "利率", "货币政策"],
    summary: "【开发预览·人工摘要；未经模型精选】公开市场业务公告列出7天期逆回购利率1.40%，投标量和中标量各905亿元；原文写明：“同时，开展了6985亿元隔夜逆回购操作。”详情以原公告为准。",
  },
  {
    id: "local-preview-mof-budget-qa",
    source: { id: "local-preview-mof-budget", name: "财政部预算司" },
    title: "财政部有关负责人就2026年中央预算公开答记者问",
    publishedAt: new Date("2026-03-26T00:00:00+08:00"),
    url: "https://yss.mof.gov.cn/gongzuodongtai/202603/t20260326_3986132.htm",
    category: "fiscal-policy",
    tags: ["预算管理", "中央预算", "政策解读"],
    summary: "【开发预览·人工摘要；未经模型精选】财政部有关负责人围绕2026年中央预算公开回应媒体提问，具体内容与数据见官方答记者问。",
  },
  {
    id: "local-preview-pboc-xiamen-payment",
    source: { id: "local-preview-pboc-xiamen", name: "人民银行厦门市分行" },
    title: "人民银行厦门市分行：支付护航投洽会 便利服务迎嘉宾",
    publishedAt: new Date("2026-09-14T00:00:00+08:00"),
    url: "https://xiamen.pbc.gov.cn/xiamen/127699/2026091714532820798/index.html",
    category: "local-practice",
    tags: ["厦门"],
    summary: "【开发预览·人工摘要；未经模型精选】人民银行厦门市分行介绍投洽会期间支付便利服务，具体安排见官方原文。",
  },
  {
    id: "local-preview-pboc-omo-192",
    source: { id: "local-preview-pboc-omo-192-source", name: "中国人民银行" },
    originalSourceId: "pboc-open-market",
    title: "公开市场业务交易公告 [2026]第192号",
    publishedAt: new Date("2026-09-30T00:00:00+08:00"),
    url: "https://www.pbc.gov.cn/zhengcehuobisi/125207/125213/125431/125475/2026093008493852899/index.html",
    category: "monetary-finance",
    tags: ["金融数据", "公开市场", "中国人民银行"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】根据公开市场业务一级交易商需求，2026年9月30日7天期逆回购操作量为零；人民银行同时开展8335亿元隔夜逆回购操作。",
    luna: {
      inputArtifactSha256: "d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c",
      articleContentHash: "a1bcfc5973a0fba355317c42893e3ba5cb2f9934327943509700b2027313adaa",
      officialBodySha256: "599c4c9affa6edfb28b8c5a59994fa211cbe1fb9b77d94eac493fbf952a5b8d0",
      inputRecordId: "p4prep_omo192_20261008",
    },
  },
  {
    id: "local-preview-mof-debt-202608",
    source: { id: "local-preview-mof-debt-202608-source", name: "财政部国库司" },
    originalSourceId: "mof-treasury-debt-data",
    title: "2026年8月地方政府债券发行和债务余额情况",
    publishedAt: new Date("2026-09-24T00:00:00+08:00"),
    url: "https://zwgls.mof.gov.cn/tjsj/202609/t20260924_3998108.htm",
    category: "government-debt",
    tags: ["财政数据", "政府债务", "再融资债", "财政部"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】财政部披露，2026年8月全国发行地方政府债券11945亿元，1—8月发行合计78034亿元；截至8月末地方政府债务余额598955亿元。8月发行平均利率为1.83%，1—8月到期偿还本金27311亿元、支付利息10594亿元。",
    luna: {
      inputArtifactSha256: "d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c",
      articleContentHash: "88017464a38e35078e6b4ef1843255a1f50a63952d685aa354489cee76700c11",
      officialBodySha256: "23bfafada31d74d8fff225a99d068922417af476b5616571d8dd4fe8e7728183",
      inputRecordId: "p4prep_treasury_20261008",
    },
  },
  {
    id: "local-preview-mof-xiamen-capital-review",
    source: { id: "local-preview-mof-xiamen-capital-review-source", name: "财政部厦门监管局" },
    originalSourceId: "mof-xiamen-supervision-dynamics",
    title: "财政部厦门监管局：扎实开展中央企业国有资本收益审核工作",
    publishedAt: new Date("2026-09-24T00:00:00+08:00"),
    url: "https://xm.mof.gov.cn/caizhengjiancha/202609/t20260924_3998128.htm",
    category: "local-practice",
    tags: ["地方实践", "厦门", "财政部"],
    summary: "【开发预览·Luna辅助摘要；未经正式模型精选】厦门监管局介绍，2026年中央企业国有资本收益审核中，指导企业规范填报申报表并提交佐证材料，重点核对合并净利润、以前年度损益调整、亏损弥补和利润分配，对疑点事项开展延伸核查。",
    luna: {
      inputArtifactSha256: "d7d872208e029dda9108c684a183b148e57da18f825d9dd26677efe6821e585c",
      articleContentHash: "7ba26b30b4a826bc2646ed75c020db8c43d2796c587a7d681b2cefd97e7b2a2b",
      officialBodySha256: "118df61e3573d20911a10abe3b13196d4ae3c45283e57c20ba06bc1ff5b1fe9c",
      inputRecordId: "tlssno3ict5uydo34hfjo23tx",
    },
  },
] as const;
const previewArticleIds = samples.map((sample) => sample.id);
const previewSourceIds = samples.map((sample) => sample.source.id);
const previewAuditSubjects = previewArticleIds.map((id) => `content:${id}`);

async function assertPreviewDatabaseIsSafe() {
  const checks = await sql.begin(async (tx) => {
    const identities = await tx<{ id: string }[]>`
      SELECT id FROM sources
      UNION ALL SELECT id FROM articles
      UNION ALL SELECT article_id AS id FROM article_revisions
      UNION ALL SELECT article_id AS id FROM article_discoveries
      UNION ALL SELECT source_id AS id FROM fetch_runs
      UNION ALL SELECT article_id AS id FROM publications
      UNION ALL SELECT article_id AS id FROM editorial_overrides
      UNION ALL SELECT article_id AS id FROM pool_search
      UNION ALL SELECT article_id AS id FROM selected_ledger
      UNION ALL SELECT article_id AS id FROM selected_state`;
    const audit = await tx<{ count: number }[]>`
      SELECT count(*)::int AS count FROM audit_log
      WHERE actor <> ${previewActor} OR NOT (subject = ANY(${previewAuditSubjects}))`;
    const unsafeTables = await tx<{ table_name: string; count: number }[]>`
      SELECT 'analyses' AS table_name, count(*)::int AS count FROM analyses
      UNION ALL SELECT 'facts', count(*)::int FROM facts
      UNION ALL SELECT 'stories', count(*)::int FROM stories
      UNION ALL SELECT 'receipts', count(*)::int FROM receipts
      UNION ALL SELECT 'lb_models', count(*)::int FROM lb_models
      UNION ALL SELECT 'reports', count(*)::int FROM reports
      UNION ALL SELECT 'report_revisions', count(*)::int FROM report_revisions
      UNION ALL SELECT 'job_runs', count(*)::int FROM job_runs
      UNION ALL SELECT 'fetch_runs', count(*)::int FROM fetch_runs
      UNION ALL SELECT 'selected_ledger', count(*)::int FROM selected_ledger
      UNION ALL SELECT 'selected_state', count(*)::int FROM selected_state`;
    const [hasBossJobs] = await tx<{ exists: boolean }[]>`SELECT to_regclass('pgboss.job') IS NOT NULL AS exists`;
    const queueJobs = hasBossJobs!.exists
      ? await tx.unsafe<{ count: number }[]>("SELECT count(*)::int AS count FROM pgboss.job")
      : [{ count: 0 }];
    return {
      identities: identities.map((row) => row.id), auditRows: audit[0]!.count,
      unsafeTables: [...unsafeTables, { table_name: "pgboss.job", count: queueJobs[0]!.count }],
    };
  });
  assertLocalPreviewIds(checks.identities, [...previewSourceIds, ...previewArticleIds]);
  if (checks.auditRows !== 0) throw new Error("preview DB contains non-preview audit rows; refusing to seed");
  const populated = checks.unsafeTables.filter((row) => row.count !== 0);
  if (populated.length) throw new Error(`preview DB must have no ${populated.map((row) => row.table_name).join(", ")}`);
}

try {
  await assertPreviewDatabaseIsSafe();
  const changed: string[] = [];
  for (const sample of samples) {
    await sql.begin(async (tx) => {
      const originalSourceId = "originalSourceId" in sample ? sample.originalSourceId : undefined;
      const luna = "luna" in sample ? sample.luna : undefined;
      const sourceConfig = originalSourceId
        ? { localPreviewSample: true, referenceSourceId: originalSourceId }
        : { localPreviewSample: true };
      const [existingSource] = await tx<{ id: string; name: string; kind: string; config: Record<string, unknown>; tier: string; participation_mode: string; first_party: boolean; interval_minutes: number; enabled: boolean; site_fulltext: boolean; syndicate_fulltext: boolean }[]>`
        SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes, enabled, site_fulltext, syndicate_fulltext
        FROM sources WHERE id = ${sample.source.id}`;
      if (existingSource && (!isDeepStrictEqual(existingSource, {
        id: sample.source.id, name: sample.source.name, kind: "web_list", config: sourceConfig, tier: "T1",
        participation_mode: "editorial", first_party: true, interval_minutes: 1440, enabled: false,
        site_fulltext: false, syndicate_fulltext: false,
      }))) {
        throw new Error(`preview source ${sample.source.id} exists with unexpected identity or safety flags`);
      }
      await tx`
        INSERT INTO sources (id, name, kind, config, tier, participation_mode, first_party, interval_minutes,
          site_fulltext, syndicate_fulltext, enabled, next_fetch_at)
        VALUES (${sample.source.id}, ${sample.source.name}, 'web_list', ${tx.json(sourceConfig)}, 'T1', 'editorial', true, 1440,
          false, false, false, 'infinity')
        ON CONFLICT (id) DO NOTHING`;

      const material = {
        id: sample.id,
        sourceId: sample.source.id,
        url: sample.url,
        title: sample.title,
        language: "zh",
        publishedAt: sample.publishedAt,
        bodyStatus: "none",
        raw: luna ? {
          provenance: "AD-012 local development sample",
          summaryOrigin: "luna_agent_assisted",
          originalBodyStored: false,
          referenceSourceId: originalSourceId,
          inputArtifactSha256: luna.inputArtifactSha256,
          articleContentHash: luna.articleContentHash,
          officialBodySha256: luna.officialBodySha256,
          inputRecordId: luna.inputRecordId,
          model: "gpt-6-luna/high",
          mode: "codex_agent_assisted",
          providerPipelineExecuted: false,
          providerReceipts: 0,
        } : { provenance: "AD-012 local development sample", summaryOrigin: "manual", originalBodyStored: false },
        via: "import",
      } as const;
      const expectedIdentityKey = identityKeyFor(material);
      const priorRows = await tx<{
        id: string; source_id: string; identity_key: string; url: string; title: string; published_at: Date;
        body_text: string | null; body_html: string | null; body_status: string; raw: unknown; revision: number;
      }[]>`
        SELECT id, source_id, identity_key, url, title, published_at, body_text, body_html, body_status, raw, revision
        FROM articles WHERE id = ${sample.id} OR identity_key = ${expectedIdentityKey}`;
      if (priorRows.some((prior) => prior.id !== sample.id || prior.source_id !== sample.source.id || prior.identity_key !== expectedIdentityKey
        || prior.url !== sample.url || prior.title !== sample.title || prior.published_at?.getTime() !== sample.publishedAt.getTime()
        || prior.body_text !== null || prior.body_html !== null || prior.body_status !== "none" || prior.revision !== 1
        || !isDeepStrictEqual(prior.raw, material.raw))) {
        throw new Error(`preview article ${sample.id} already exists with unapproved identity, content, body, revision, or provenance`);
      }
      const result = await upsertMaterial(material, tx);
      if (result.articleId !== sample.id) throw new Error(`sample identity collision for ${sample.id}`);
      const [article] = await tx<{ source_id: string; url: string; title: string; published_at: Date; body_text: string | null; body_html: string | null; body_status: string }[]>`
        SELECT source_id, url, title, published_at, body_text, body_html, body_status FROM articles WHERE id = ${sample.id}`;
      if (!article || article.source_id !== sample.source.id || article.url !== sample.url || article.title !== sample.title
        || article.published_at?.getTime() !== sample.publishedAt.getTime() || article.body_text !== null || article.body_html !== null || article.body_status !== "none") {
        throw new Error(`preview article ${sample.id} has unexpected provenance, date, or stored body`);
      }

      const fields = {
        title: sample.title,
        summary: sample.summary,
        category: sample.category,
        tags: [...sample.tags],
        relevance: "pass",
        selected: false,
      };
      const overrideReason = luna
        ? "AD-012 local preview; Luna-assisted editorial summary; not human Gold or formal P4 model selection"
        : "AD-012 local preview; manually written summary";
      const auditReason = luna
        ? "AD-012 local development sample; Luna-assisted editorial summary; not human Gold or formal P4 model selection"
        : "AD-012 local development sample; manual summary; not model selected";
      const [override] = await tx<{ fields: Record<string, unknown>; visibility: string | null; reason: string | null; version: number; updated_by: string | null }[]>`
        SELECT fields, visibility, reason, version, updated_by FROM editorial_overrides WHERE article_id = ${sample.id}`;
      if (override) {
        if (!isDeepStrictEqual(override.fields, fields) || override.visibility !== "public" || override.reason !== overrideReason
          || override.version !== 1 || override.updated_by !== previewActor) {
          throw new Error(`preview override ${sample.id} differs from the reviewed seed; refusing to overwrite`);
        }
      } else {
        await tx`
          INSERT INTO editorial_overrides (article_id, fields, visibility, reason, version, updated_by)
          VALUES (${sample.id}, ${tx.json(fields as never)}, 'public', ${overrideReason}, 1, ${previewActor})`;
      }

      const [previousProjection] = await tx<{
        revision: number; visibility: string; eligible: boolean; selected: boolean; title: string; original_title: string | null; summary: string | null;
        reason: string | null; category: string | null; tags: string[]; score: number | null; source_id: string; url: string;
        published_at: Date; body_mode: string; syndicate: boolean; indexable: boolean; analysis_id: number | null;
      }[]>`
        SELECT revision, visibility, eligible, selected, title, original_title, summary, reason, category, tags, score, source_id,
          url, published_at, body_mode, syndicate, indexable, analysis_id
        FROM publications WHERE article_id = ${sample.id}`;
      if (previousProjection) {
        const matches = previousProjection.revision === 1 && previousProjection.visibility === "public" && previousProjection.eligible && !previousProjection.selected
          && previousProjection.title === sample.title && previousProjection.original_title === null && previousProjection.summary === sample.summary
          && previousProjection.reason === null && previousProjection.category === sample.category && isDeepStrictEqual(previousProjection.tags, [...sample.tags])
          && previousProjection.score === null && previousProjection.source_id === sample.source.id && previousProjection.url === sample.url
          && previousProjection.published_at.getTime() === sample.publishedAt.getTime() && previousProjection.body_mode === "summary"
          && !previousProjection.syndicate && !previousProjection.indexable && previousProjection.analysis_id === null;
        if (!matches) throw new Error(`preview publication ${sample.id} differs from its approved scoreless sample projection`);
      } else {
        const published = await publishArticleTx(tx, sample.id, { now: new Date() });
        if (!published || published.selected || published.visibility !== "public") throw new Error(`unexpected publication state for ${sample.id}`);
      }
      await tx`
        INSERT INTO audit_log (actor, action, subject, reason, after)
        SELECT ${previewActor}, 'content.override', ${`content:${sample.id}`}, ${auditReason}, ${tx.json(luna
          ? { preview: true, selected: false, summaryOrigin: "luna_agent_assisted" }
          : { preview: true, selected: false })}
        WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE actor = ${previewActor} AND subject = ${`content:${sample.id}`} AND action = 'content.override')`;
      changed.push(`${sample.id}:${result.created ? "created" : result.revised ? "revised" : "unchanged"}`);
    });
  }

  const summary = await sql<{ sources: number; articles: number; publications: number; overrides: number; audit_rows: number; eligible: number; selected: number; analyses: number; body_texts: number; score_values: number }[]>`
    SELECT (SELECT count(*)::int FROM sources WHERE id = ANY(${previewSourceIds})) AS sources,
           (SELECT count(*)::int FROM articles WHERE id = ANY(${previewArticleIds})) AS articles,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds})) AS publications,
           (SELECT count(*)::int FROM editorial_overrides WHERE article_id = ANY(${previewArticleIds})) AS overrides,
           (SELECT count(*)::int FROM audit_log WHERE actor = ${previewActor} AND subject = ANY(${previewAuditSubjects})) AS audit_rows,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds}) AND eligible) AS eligible,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds}) AND selected) AS selected,
           (SELECT count(*)::int FROM analyses WHERE article_id = ANY(${previewArticleIds})) AS analyses,
           (SELECT count(*)::int FROM articles WHERE id = ANY(${previewArticleIds}) AND body_text IS NOT NULL) AS body_texts,
           (SELECT count(*)::int FROM publications WHERE article_id = ANY(${previewArticleIds}) AND score IS NOT NULL) AS score_values`;
  const result = summary[0]!;
  if (result.sources !== samples.length || result.articles !== samples.length || result.publications !== samples.length
    || result.overrides !== samples.length || result.audit_rows !== samples.length || result.eligible !== samples.length
    || result.selected !== 0 || result.analyses !== 0 || result.body_texts !== 0 || result.score_values !== 0) {
    throw new Error(`post-seed invariant failed; expected exactly ${samples.length} eligible, unselected, scoreless summary-only records and no analyses/full text`);
  }
  console.log(JSON.stringify({ database: safe.database, samples: changed, ...result, safetyFlags: safe.safetyFlags }));
} finally {
  await closeDb();
}
