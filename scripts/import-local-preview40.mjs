// Bounded AD-012 import driver for the pinned forty summaries. Does not start services.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TARGET, PLAN, PLAN_SHA, REVIEW_SHA, QA_SHA, ACTOR, sha, safeJson, canonical, fingerprint, writeNew, readPinned, loadBundle, verifyQa, assertDatabaseIdentity, bindLiveRows, overlay, assertFreshBaseline, assertPostState, offlineGuardFixtures } from './lib/preview40-import.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=process.argv[2];
assert.ok(['--offline-check','--preflight-only','--execute'].includes(mode),'Use --offline-check | --preflight-only | --execute');
const flags={};for(let i=3;i<process.argv.length;i+=2){assert.ok(['--out-dir','--qa-file','--qa-sha','--baseline-file','--baseline-sha'].includes(process.argv[i]),'unknown option');assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'missing option value');assert.ok(!flags[process.argv[i]],'duplicate option');flags[process.argv[i]]=process.argv[i+1];}
const bundle=loadBundle(root);
const driverSha256=fingerprint({driver:sha(fs.readFileSync(fileURLToPath(import.meta.url))),guards:sha(fs.readFileSync(path.join(root,'scripts/lib/preview40-import.mjs')))});
const out=path.resolve(root,flags['--out-dir']??`.data/fiscal-qa/preview40-driver-20261015/${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}`);
assert.ok(out.startsWith(path.join(root,'.data','fiscal-qa')+path.sep),'evidence path must stay in ignored fiscal-qa');fs.mkdirSync(out,{recursive:true});
const reportBase={mode,driverSha256,planSha256:PLAN_SHA,reviewSha256:REVIEW_SHA,createdAtUtc:new Date().toISOString()};
let qa=null,qaSha256=null;
if(flags['--qa-file']||flags['--qa-sha']){assert.ok(flags['--qa-file']&&flags['--qa-sha'],'QA requires path and physical SHA');assert.equal(flags['--qa-sha'],QA_SHA,'only the frozen independent Root full40 proof is accepted');qa=verifyQa(readPinned(path.resolve(root,flags['--qa-file']),flags['--qa-sha']),bundle);qaSha256=flags['--qa-sha'];}
if(mode==='--offline-check'){
  const cases=offlineGuardFixtures(bundle);
  writeNew(path.join(out,'offline-check.json'),{...reportBase,result:'OFFLINE_INPUT_AND_FAKE_GUARD_FIXTURES_PASS',candidateCount:40,guardFixtures:cases,databaseConnections:0,databaseWrites:0,externalHttp:0,providerCalls:0,executionAllowed:false,fullIndependentQaProvided:!!qa});
  console.log(JSON.stringify({result:'OFFLINE_PASS',out,guardFixtures:cases.length,executionAllowed:false}));
}else{
  if(mode==='--execute'){assert.ok(qa,'execute requires independently authored full40 QA proof');assert.ok(flags['--baseline-file']&&flags['--baseline-sha'],'execute requires explicit fresh baseline file plus SHA');}
  if(process.env.DATABASE_URL)assert.equal(process.env.DATABASE_URL,TARGET,'refuse alternate database URL');
  assert.notEqual(process.env.NODE_ENV,'production');
  assert.ok(!Object.keys(process.env).some(k=>k.startsWith('DEV_AUTH_')&&process.env[k]),'refuse auth bypass');
  const {prepareLocalPreviewSeedEnvironment}=await import('./lib/local-preview-safety.ts');
  process.env.DATABASE_URL=TARGET;prepareLocalPreviewSeedEnvironment(process.env);
  for(const k of Object.keys(process.env))if(/^(DEEPSEEK|OPENAI|ANTHROPIC|GEMINI|JINA_|SOCIALDATA|DAJIALA|FEISHU_|INDEXNOW_|RESEND|SMTP|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|EGRESS_PROXY_URL)/i.test(k))delete process.env[k];
  for(const k of ['COLLECT_ENABLED','MODEL_CALLS_ENABLED','JINA_BODY_FALLBACK','FEISHU_CONTENT_PUSH_ENABLED','FEISHU_INTERNAL_ENABLED','INDEXNOW_SUBMIT_ENABLED','ALLOW_PRIVATE_NETWORK_FETCH','EMBEDDINGS_ENABLED'])process.env[k]='false';
  process.env.AIHOT_CREDENTIALS_DIR=path.join(out,'credentials-not-present');process.env.NODE_ENV='development';process.env.LOCAL_PREVIEW_ENABLED='true';process.env.LOCAL_PREVIEW_LAN_ENABLED='false';process.env.SITE_URL='http://127.0.0.1:3000';process.env.API_BASE_URL='http://127.0.0.1:3001';process.env.WEB_HOST='127.0.0.1';
  const {resolveLocalPreviewEnabled}=await import('../apps/web/app/lib/local-preview.server.ts');assert.equal(resolveLocalPreviewEnabled(process.env),true);
  const {sql}=await import('@aihot/backend/db');
  const catalogBytes=fs.readFileSync(path.join(root,'industry/sources.json')),catalogJson=JSON.parse(catalogBytes),catalog=new Map((Array.isArray(catalogJson)?catalogJson:catalogJson.sources).map(s=>[s.id,s]));
  for(const r of bundle.plan.rows)assert.ok(catalog.has(r.sourceArticle.sourceId),'catalog source missing');
  try{
    if(mode==='--preflight-only'){
      const snapshot=await sql.begin(async tx=>{await tx`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`;return readSnapshot(tx);});
      const boundRows=bindLiveRows(bundle.plan,snapshot);
      const baseline={...reportBase,schema:'fiscal.preview40.live-baseline.v1',result:'LIVE_READONLY_PREFLIGHT_PASS',catalogSha256:sha(catalogBytes),canonicalVersion:'sorted-keys-json-safe-v1; original readBaseline SQL plus full pool_search projection',qaSha256,snapshot,baselineSha256:fingerprint(snapshot),boundRows,counts:{updates:boundRows.filter(r=>r.disposition==='update_existing_url_keep_id').length,creates:boundRows.filter(r=>r.disposition==='create_new_preview_id').length,skips:boundRows.filter(r=>r.disposition==='skip_conflict').length},databaseWrites:0,executionAllowed:false,requiredNext:'execute must supply this physical baseline SHA plus independent full40 QA proof; live CAS checked again'};
      writeNew(path.join(out,'live-baseline.json'),baseline);console.log(JSON.stringify({result:baseline.result,path:path.join(out,'live-baseline.json'),sha256:sha(fs.readFileSync(path.join(out,'live-baseline.json'))),counts:baseline.counts,executionAllowed:false}));
    }else{
      const baseline=readPinned(path.resolve(root,flags['--baseline-file']),flags['--baseline-sha']);assertFreshBaseline(baseline,bundle,driverSha256);assert.equal(baseline.catalogSha256,sha(catalogBytes));if(baseline.qaSha256)assert.equal(baseline.qaSha256,qaSha256);
      const marker=path.join(out,'execution-started.json');
      // A baseline is one-shot even if a later transaction fails; preserve marker and use a fresh preflight after diagnosis.
      fs.writeFileSync(path.resolve(root,flags['--baseline-file'])+'.execution-claim',JSON.stringify({out,driverSha256,qaSha256,startedAtUtc:new Date().toISOString()})+'\n',{flag:'wx'});
      writeNew(marker,{...reportBase,qaSha256,baselineFileSha256:flags['--baseline-sha'],targetIds:baseline.boundRows.map(r=>r.targetId)});
      const {upsertMaterial}=await import('@aihot/backend/content/materials');
      const {publishArticleTx}=await import('@aihot/backend/publication/publish');
      const report={...reportBase,result:'ROLLED_BACK_OR_FAILED',qaSha256,baselineFileSha256:flags['--baseline-sha'],updates:[],creates:[],skips:baseline.boundRows.filter(r=>r.disposition==='skip_conflict').map(r=>({articleId:r.sourceArticle.id,reason:r.conflict})),failure:null};
      try{
        await sql.begin(async tx=>{
          await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
          await tx`SELECT id FROM articles ORDER BY id FOR UPDATE`;await tx`SELECT id FROM sources ORDER BY id FOR UPDATE`;
          await tx`SELECT article_id FROM editorial_overrides ORDER BY article_id FOR UPDATE`;await tx`SELECT article_id FROM publications ORDER BY article_id FOR UPDATE`;
          const locked=await readSnapshot(tx);assert.equal(fingerprint(locked),baseline.baselineSha256,'fresh complete state CAS failed');
          assert.equal(sha(fs.readFileSync(path.join(root,PLAN))),PLAN_SHA);loadBundle(root);verifyQa(readPinned(path.resolve(root,flags['--qa-file']),qaSha256),bundle);assertFreshBaseline(baseline,bundle,driverSha256);
          for(const r of baseline.boundRows){if(r.disposition==='skip_conflict')continue;
            const provenance={sourceArticleId:r.sourceArticle.id,sourceId:r.sourceArticle.sourceId,url:r.sourceArticle.url,sourceArticleTitle:r.sourceArticle.title,publishedAt:r.sourceArticle.publishedAt,sourceArticleRevision:r.sourceArticle.revision,sourceArticleContentHash:r.sourceArticle.contentHash,sourceBodyTextSha256:r.sourceArticle.bodyTextSha256,sourceBodyHtmlSha256:r.sourceArticle.bodyHtmlSha256,reviewArtifactSha256:REVIEW_SHA,planSha256:PLAN_SHA,qaSha256,reviewMode:r.editorial.reviewMode,isGold:false,selected:false,score:null,providerReceipt:null,providerPipelineExecuted:false};
            if(r.disposition==='update_existing_url_keep_id'){
              const old=locked.articles.find(a=>a.id===r.targetId),override=locked.overrides.find(o=>o.article_id===r.targetId);
              const raw={...(old.raw&&typeof old.raw==='object'&&!Array.isArray(old.raw)?old.raw:{}),fiscalPreview40Review:provenance};
              const changed=await tx`UPDATE articles SET raw=${tx.json(raw)},updated_at=now() WHERE id=${old.id} AND source_id=${old.source_id} AND url=${old.url} AND title=${old.title} AND revision=${old.revision} AND content_hash=${old.content_hash} AND published_at=${old.published_at} AND body_status='none' AND body_text IS NULL AND body_html IS NULL`;
              assert.equal(changed.count,1,'article CAS');
              const fields=overlay(override.fields,r.editorial);
              const updated=await tx`UPDATE editorial_overrides SET fields=${tx.json(fields)},reason='AD-012 fixed40 local summary preview; non-Gold; no provider pipeline',version=version+1,updated_by=${ACTOR} WHERE article_id=${old.id} AND updated_by=${override.updated_by} AND visibility='public' AND version=${override.version}`;
              assert.equal(updated.count,1,'override CAS');report.updates.push({articleId:r.sourceArticle.id,previewId:old.id});
            }else{
              assert.equal(r.disposition,'create_new_preview_id');const source=catalog.get(r.sourceArticle.sourceId);
              await tx`INSERT INTO sources (id,name,kind,config,tier,participation_mode,first_party,interval_minutes,site_fulltext,syndicate_fulltext,enabled,next_fetch_at) VALUES (${r.targetSourceId},${source.name},'web_list',${tx.json({localPreviewSample:true,referenceSourceId:r.sourceArticle.sourceId})},'T1','editorial',true,1440,false,false,false,'infinity')`;
              const material={id:r.targetId,sourceId:r.targetSourceId,url:r.sourceArticle.url,title:r.sourceArticle.title,language:'zh',publishedAt:new Date(r.sourceArticle.publishedAt),bodyStatus:'none',raw:{provenance:'AD-012 local preview',originalBodyStored:false,referenceSourceId:r.sourceArticle.sourceId,fiscalPreview40Review:provenance},via:'import'};
              const result=await upsertMaterial(material,tx);assert.equal(result.created,true);assert.equal(result.articleId,r.targetId);
              await tx`INSERT INTO editorial_overrides (article_id,fields,visibility,reason,version,updated_by) VALUES (${r.targetId},${tx.json(overlay({},r.editorial))},'public','AD-012 fixed40 local summary preview; non-Gold; no provider pipeline',1,${ACTOR})`;
              report.creates.push({articleId:r.sourceArticle.id,previewId:r.targetId,sourceId:r.targetSourceId});
            }
            await publishArticleTx(tx,r.targetId,{now:new Date()});
            await tx`INSERT INTO audit_log (actor,action,subject,reason,after) VALUES (${ACTOR},'content.override',${`content:${r.targetId}`},'AD-012 fixed40 local summary preview; non-Gold; no provider pipeline',${tx.json(provenance)})`;
          }
          const post=await readSnapshot(tx);assertPostState(locked,post,baseline.boundRows);report.after=post;report.result='PREVIEW40_IMPORT_COMMITTED';
        });
      }catch(error){report.result='ROLLED_BACK_OR_FAILED';report.failure=String(error?.stack??error);report.updates=[];report.creates=[];delete report.after;}
      writeNew(path.join(out,'execution-result.json'),report);console.log(JSON.stringify({result:report.result,updates:report.updates.length,creates:report.creates.length,skips:report.skips.length,out}));if(report.result!=='PREVIEW40_IMPORT_COMMITTED')process.exitCode=1;
    }
  }catch(error){writeNew(path.join(out,'failure.json'),{...reportBase,result:'FAILED_NOT_READY',message:String(error?.stack??error),databaseWrites:'none outside an explicitly executed transaction',executionAllowed:false});throw error;}finally{await sql.end({timeout:5});}
}

async function readSnapshot(tx){const [identity]=await tx`SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port`;assertDatabaseIdentity(identity);const state=await readBaseline(tx);return {database:safeJson(identity),...state};}

// Exact baseline SELECT statements reused from the original 19-row AD-012 driver.
async function readBaseline(tx) {
  const articles = await tx`SELECT id, source_id, identity_key, url, title, author, language, published_at, published_at_claim,
    discovered_at, source_updated_at, timeline_at, backfill, backfill_reason, revision, content_hash, excerpt,
    body_text, body_html, body_status, media, x_post, raw, processing_state, processing_queued_at, processing_retry_at
    FROM articles ORDER BY id`;
  const sources = await tx`SELECT id, name, kind, config, tier, participation_mode, first_party, interval_minutes,
    enabled, site_fulltext, syndicate_fulltext FROM sources ORDER BY id`;
  const overrides = await tx`SELECT article_id, fields, visibility, reason, version, updated_by FROM editorial_overrides ORDER BY article_id`;
  const publications = await tx`SELECT article_id, analysis_id, revision, visibility, eligible, selected, title, original_title,
    summary, reason, category, tags, score, source_id, url, published_at, body_mode, syndicate, indexable, story_id,
    fact_id, search_text, sort_at FROM publications ORDER BY article_id`;
  const [counts] = await tx`SELECT (SELECT count(*)::int FROM articles) AS articles,
    (SELECT count(*)::int FROM sources) AS sources, (SELECT count(*)::int FROM publications) AS publications,
    (SELECT count(*)::int FROM editorial_overrides) AS overrides, (SELECT count(*)::int FROM analyses) AS analyses,
    (SELECT count(*)::int FROM receipts) AS receipts, (SELECT count(*)::int FROM job_runs) AS job_runs,
    (SELECT count(*)::int FROM selected_ledger) AS selected_ledger, (SELECT count(*)::int FROM selected_state) AS selected_state,
    (SELECT count(*)::int FROM pool_search) AS pool_search, (SELECT count(*)::int FROM fetch_runs) AS fetch_runs`;
  const [hasBoss] = await tx`SELECT to_regclass('pgboss.job') IS NOT NULL AS exists`;
  const jobs = hasBoss.exists ? await tx`SELECT id, name, state, data FROM pgboss.job ORDER BY id` : [];
  const audit = await tx`SELECT actor, action, subject, reason, after FROM audit_log ORDER BY actor, action, subject`;
  const pool = await tx`SELECT article_id, direct, body FROM pool_search ORDER BY article_id`;
  return safeJson({ counts, articles, sources, overrides, publications, jobs, pool, audit: [...audit].sort((a,b)=>canonical(a).localeCompare(canonical(b))) });
}
