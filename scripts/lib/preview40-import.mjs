// Fixed AD-012 forty-summary input and transaction guards. No DB/provider imports here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../../packages/backend/src/lib/url.ts';
import { isLocalPreviewArticleId } from '../../apps/web/app/lib/local-preview.server.ts';
import * as taxonomy from '../../industry/taxonomy.ts';

export const TARGET = 'postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test';
export const PLAN = ".data/fiscal-qa/final-preview40-v4r2-20261015/import-plan-40-v4r2.json";
export const PLAN_SHA = "c473b89f0bb07d8af04a082f985802e9640a549a3166d0106724647545ca4898";
export const REVIEW_SHA = "20ff84ad28aea5bd2053bfdcdee05fa50fee7b8f3aa1e3dcb2bd9e23d1b20030";
export const QA_SHA = "145aa2be05dcb328b00855574487f551f8a98394d9acf13c91d3721757c89ab3";
export const ACTOR = 'fiscal-preview40-import';
const OWNERS = ['local-preview-seed', 'luna-agent-review-import', ACTOR];
export const sha = x => crypto.createHash('sha256').update(x).digest('hex');
export const safeJson = x => JSON.parse(JSON.stringify(x));
const stable = x => x === null || typeof x !== 'object' ? JSON.stringify(x) : Array.isArray(x)
  ? `[${x.map(stable).join(',')}]` : `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
// Same sorted-key serialization as original driver, explicitly JSON-normalize Dates first.
export const canonical = x => stable(safeJson(x));
export const fingerprint = x => sha(canonical(x));
export const writeNew = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const readPinned = (file, hash) => { assert.match(hash ?? '', /^[a-f0-9]{64}$/); const bytes = fs.readFileSync(file); assert.equal(sha(bytes), hash, `file drift: ${file}`); return JSON.parse(bytes); };
const category = { policy_release: 'fiscal-policy', regulatory_rule: 'fiscal-policy', fiscal_data: 'fiscal-policy', financial_data: 'monetary-finance', debt_event: 'government-debt', regulatory_action: 'financial-regulation', local_practice: 'local-practice', research_analysis: 'research' };

export function loadBundle(root, planPath = PLAN) {
  const plan = readPinned(path.resolve(root, planPath), PLAN_SHA);
  assert.equal(plan.targetDatabase, 'fiscalhot_preview_test');
  assert.equal(plan.schema, 'fiscal.ad012.fixed40.plan.v4r2');
  assert.equal(plan.executionStarted, false);
  assert.equal(plan.currentDatabase.executionAllowed, false);
  for (const k of ['baseline','urlDedupe','casPreflight']) assert.equal(plan.currentDatabase[k], null);
  for (const k of ['existingUrlUpdates','newUrlRecords','previewBefore','previewAfter']) assert.equal(plan.counts[k], null);
  for (const k of ['noAnalysisRows','noReceipts','noProviderCalls','noWorker','noScore','noGold','oldPreviewIdsPreservedForUrlMatches','unknownExistingEditorialFieldsPreserved']) assert.equal(plan.policy[k], true);
  for (const k of ['selected','bodyStored','sourceAndSyndicateFullText','indexable','syndicate']) assert.equal(plan.policy[k], false);
  const master = readPinned(path.resolve(root, plan.inputs.masterReview.path), REVIEW_SHA);
  assert.equal(plan.inputs.masterReview.sha256, REVIEW_SHA);
  const candidates = [];
  for (const input of plan.inputs.revisedReviews) {
    const review = readPinned(path.resolve(root, input.path), input.sha256);
    const frozen = readPinned(path.resolve(root, review.frozenCandidatePath), review.frozenCandidateSha256);
    assert.equal(input.freezeSha256, review.frozenCandidateSha256);
    assert.equal(input.freezePath, review.frozenCandidatePath);
    assert.equal(review.candidates.length, 20);
    for (const a of review.candidates) {
      const f = frozen.candidates.find(x => x.articleId === a.articleId); assert.ok(f);
      for (const k of Object.keys(f)) assert.deepEqual(a[k], f[k], `frozen drift ${a.articleId}.${k}`);
      assert.equal(sha(a.bodyText), a.bodyTextSha256); assert.equal(sha(a.bodyHtml), a.bodyHtmlSha256);
      assert.equal(a.bodyStatus, 'ok'); assert.ok(a.bodyText && a.bodyHtml);
      assert.ok(a.bodyText.replace(/\s/g,'').includes(a.evidenceQuote.replace(/\s/g,'')));
      assert.equal([...a.summaryZh].length, a.summaryCharCount); assert.ok(a.summaryCharCount >= 120 && a.summaryCharCount <= 220);
      assert.equal(a.isGold,false); assert.equal(a.selected,false); assert.equal(a.score,null); assert.equal(a.providerReceipt,null);
      assert.ok(taxonomy.ITEM_TYPES.includes(a.itemType)); assert.ok(taxonomy.CATEGORY_TAGS.includes(a.tags[0]));
      for (const t of a.tags) assert.ok([...taxonomy.CATEGORY_TAGS,...taxonomy.TOPIC_TAGS,...taxonomy.ENTITY_TAGS].includes(t));
      for (const t of a.topic) assert.ok(taxonomy.TOPIC_TAGS.includes(t));
      for (const t of a.entity) assert.ok(taxonomy.ENTITY_TAGS.includes(t));
      candidates.push(a);
    }
  }
  assert.deepEqual(candidates, master.candidates); assert.equal(candidates.length,40); assert.equal(plan.rows.length,40);
  const urls = new Set(), ids = new Set();
  for (const r of plan.rows) {
    const a = candidates.find(x => x.articleId === r.sourceArticle.id); assert.ok(a);
    assert.ok(!ids.has(a.articleId)); ids.add(a.articleId);
    const normalized = normalizeUrl(a.url); assert.ok(normalized); assert.ok(!urls.has(normalized)); urls.add(normalized);
    for (const k of Object.keys(r.sourceArticle)) assert.equal(r.sourceArticle[k], k === 'id' ? a.articleId : a[k]);
    assert.deepEqual(r.editorial, {displayTitle:a.titleZh,summary:`【开发预览·辅助摘要；未经正式模型精选】${a.summaryZh}`,category:category[a.itemType],tags:[...new Set([...a.tags,...a.topic,...a.entity.map(e=>`entity:${e}`)])],topic:a.topic,entities:a.entity,evidenceQuote:a.evidenceQuote,uncertainties:a.uncertainties,businessRelevance:a.businessRelevance,editorialJudgment:a.editorialJudgment,itemType:a.itemType,authorRole:a.authorRole,isGold:false,selected:false,score:null,reason:null,providerReceipt:null,reviewMode:a.reviewMode});
    assert.equal(r.targetId,`local-preview-luna-${a.articleId}`); assert.equal(r.targetSourceId,`local-preview-luna-${a.articleId}-source`);
    assert.ok(isLocalPreviewArticleId(r.targetId),'fixed target lacks exact development label allowlist');
    assert.equal(r.disposition,'pending_live_url_dedupe'); assert.equal(r.existingPreview,null);
  }
  return { plan, candidates, planSha256: PLAN_SHA, reviewSha256: REVIEW_SHA };
}

export function verifyQa(proof, bundle) {
  assert.equal(proof.schema, 'fiscal.preview40.independent-content-qa.v1');
  assert.equal(proof.result, 'PASS_OFFLINE_CONTENT_REVIEW'); assert.equal(proof.independent, true); assert.equal(proof.isGold,false);
  assert.equal(proof.planSha256, bundle.planSha256); assert.equal(proof.masterSha256,bundle.reviewSha256);
  assert.equal(proof.articleIds.length,40);
  assert.deepEqual([...proof.articleIds].sort(),bundle.candidates.map(x=>x.articleId).sort());
  assert.equal(new Set(proof.articleIds).size,40);
  assert.equal(proof.items.length,40); assert.deepEqual(proof.items.map(x=>x.articleId).sort(), [...proof.articleIds].sort()); assert.ok(proof.items.every(x=>x.verdict==='PASS'));
  assert.ok(typeof proof.reviewer === 'string' && proof.reviewer.trim());
  assert.ok(Number.isFinite(Date.parse(proof.reviewedAtUtc)));
  assert.ok(Date.parse(proof.reviewedAtUtc) <= Date.now()+60000);
  return proof;
}

export function assertDatabaseIdentity(identity) {
  assert.equal(identity.database,'fiscalhot_preview_test'); assert.equal(String(identity.address).split('/')[0],'127.0.0.1'); assert.equal(Number(identity.port),5432);
}
export function assertPreviewState(state) {
  for (const k of ['analyses','receipts','job_runs','selected_ledger','selected_state','fetch_runs']) assert.equal(state.counts[k],0, `forbidden ${k}`);
  assert.equal(state.counts.articles,state.articles.length); assert.equal(state.counts.sources,state.sources.length);
  assert.equal(state.counts.publications,state.publications.length); assert.equal(state.counts.overrides,state.overrides.length); assert.equal(state.counts.pool_search,state.pool.length);
  for (const a of state.articles) assert.ok(a.id.startsWith('local-preview-'),`foreign article ${a.id}`);
  for (const s of state.sources) { assert.equal(s.enabled,false); assert.equal(s.site_fulltext,false); assert.equal(s.syndicate_fulltext,false); }
}
const iso = x => x instanceof Date ? x.toISOString() : x;
function safeExisting(a,r,state) {
  const s=state.sources.find(x=>x.id===a.source_id),o=state.overrides.find(x=>x.article_id===a.id),p=state.publications.find(x=>x.article_id===a.id);
  return isLocalPreviewArticleId(a.id) && a.id.startsWith('local-preview-') && a.source_id.startsWith('local-preview-') && a.title===r.sourceArticle.title && iso(a.published_at)===r.sourceArticle.publishedAt
    && a.body_text===null && a.body_html===null && a.body_status==='none' && Number(a.revision)===1 && a.processing_queued_at===null
    && !!s && s.config?.localPreviewSample===true && s.enabled===false && s.site_fulltext===false && s.syndicate_fulltext===false
    && !!o && OWNERS.includes(o.updated_by) && o.visibility==='public' && Number.isInteger(Number(o.version)) && Number(o.version)>0
    && state.audit.some(x=>x.subject===`content:${a.id}` && OWNERS.includes(x.actor) && x.action==='content.override')
    && !!p && p.eligible===true && p.selected===false && p.score===null && p.reason===null && p.analysis_id===null && p.body_mode==='summary' && p.indexable===false && p.syndicate===false
    && p.url===a.url && iso(p.published_at)===iso(a.published_at);
}
export function bindLiveRows(plan,state) {
  assertPreviewState(state);
  return plan.rows.map(r=>{
    const key=normalizeUrl(r.sourceArticle.url),matches=state.articles.filter(a=>normalizeUrl(a.url??'')===key);
    assert.ok(matches.length<=1,`ambiguous normalized URL ${key}`);
    if(matches.length){const a=matches[0];return {...r,targetId:a.id,targetSourceId:a.source_id,existingPreview:{id:a.id,source_id:a.source_id,url:a.url,title:a.title,published_at:iso(a.published_at)},disposition:safeExisting(a,r,state)?'update_existing_url_keep_id':'skip_conflict',conflict:safeExisting(a,r,state)?null:'existing_preview_identity_ownership_or_safety_conflict'};}
    const collision=state.articles.some(a=>a.id===r.targetId||a.identity_key===`url:${key}`)||state.sources.some(s=>s.id===r.targetSourceId)||state.overrides.some(o=>o.article_id===r.targetId)||state.publications.some(p=>p.article_id===r.targetId);
    return {...r,disposition:collision?'skip_conflict':'create_new_preview_id',conflict:collision?'new_id_or_identity_collision':null};
  });
}
export const overlay = (old,editorial) => ({...old,title:editorial.displayTitle,summary:editorial.summary,category:editorial.category,tags:editorial.tags,relevance:'pass',selected:false,score:null});
export function assertFreshBaseline(baseline,bundle,driverSha,now=Date.now()) {
  assert.equal(baseline.schema,'fiscal.preview40.live-baseline.v1'); assert.equal(baseline.result,'LIVE_READONLY_PREFLIGHT_PASS');
  assert.equal(baseline.planSha256,bundle.planSha256); assert.equal(baseline.reviewSha256,bundle.reviewSha256); assert.equal(baseline.driverSha256,driverSha);
  assertDatabaseIdentity(baseline.snapshot.database); assertPreviewState(baseline.snapshot);
  assert.equal(fingerprint(baseline.snapshot),baseline.baselineSha256);
  assert.deepEqual(bindLiveRows(bundle.plan,baseline.snapshot),baseline.boundRows);
  const age=now-Date.parse(baseline.createdAtUtc); assert.ok(age>=-60000&&age<=15*60*1000,'baseline must be fresh within15min');
}
export function assertPostState(before,post,rows) {
  assertPreviewState(post);
  const updated=new Set(rows.filter(r=>r.disposition==='update_existing_url_keep_id').map(r=>r.targetId)),created=new Set(rows.filter(r=>r.disposition==='create_new_preview_id').map(r=>r.targetId)),targets=new Set([...updated,...created]);
  for(const group of ['articles','sources','overrides','publications','pool']){
    const key=['overrides','publications','pool'].includes(group)?'article_id':'id';
    const allowed=group==='sources'?new Set(rows.filter(r=>created.has(r.targetId)).map(r=>r.targetSourceId)):targets;
    for(const old of before[group]){const next=post[group].find(x=>x[key]===old[key]);assert.ok(next,`deleted ${group}`);if(!allowed.has(old[key]))assert.equal(canonical(old),canonical(next),`non-target ${group} drift`);}
    for(const next of post[group])if(!before[group].some(x=>x[key]===next[key]))assert.ok(allowed.has(next[key]),`unexpected ${group} insert`);
  }
  assert.equal(canonical(before.jobs),canonical(post.jobs),'queue changed');
  const oldAudit=new Map(before.audit.map(a=>[canonical(a),(before.audit.filter(b=>canonical(b)===canonical(a))).length]));
  for(const [item,n] of oldAudit)assert.ok(post.audit.filter(a=>canonical(a)===item).length>=n,'old audit removed');
  const newAudit=post.audit.filter(a=>!before.audit.some(b=>canonical(a)===canonical(b)));
  assert.equal(newAudit.length,targets.size);for(const a of newAudit)assert.ok(a.actor===ACTOR&&a.action==='content.override'&&targets.has(a.subject.replace(/^content:/,'')));
  assert.equal(post.articles.length,before.articles.length+created.size);assert.equal(post.sources.length,before.sources.length+created.size);
  for(const r of rows.filter(r=>targets.has(r.targetId))){const a=post.articles.find(a=>a.id===r.targetId),p=post.publications.find(p=>p.article_id===r.targetId),o=post.overrides.find(o=>o.article_id===r.targetId);assert.ok(a&&p&&o);assert.equal(a.title,r.sourceArticle.title);assert.equal(iso(a.published_at),r.sourceArticle.publishedAt);assert.equal(a.url,r.existingPreview?.url??r.sourceArticle.url);assert.equal(a.body_text,null);assert.equal(a.body_html,null);assert.equal(a.body_status,'none');assert.equal(Number(a.revision),1);assert.equal(a.processing_queued_at,null);for(const [k,v] of Object.entries({eligible:true,selected:false,score:null,reason:null,indexable:false,syndicate:false,body_mode:'summary',analysis_id:null}))assert.equal(p[k],v);assert.equal(p.published_at,iso(a.published_at));assert.equal(p.url,a.url);assert.equal(p.summary,r.editorial.summary);const poolRows=post.pool.filter(x=>x.article_id===r.targetId);assert.equal(poolRows.length,1);assert.equal(poolRows[0].body,'');assert.equal(poolRows[0].direct,p.search_text);assert.deepEqual(o.fields,overlay(before.overrides.find(x=>x.article_id===r.targetId)?.fields??{},r.editorial));}
}

export function offlineGuardFixtures(bundle) {
  const passed=[];const run=(name,fn)=>{fn();passed.push({name,result:'PASS_FAKE_FIXTURE_ONLY'});};
  const r=bundle.plan.rows[0];
  const source={id:'local-preview-fixture-source',config:{localPreviewSample:true},enabled:false,site_fulltext:false,syndicate_fulltext:false};
  const a={id:'local-preview-pboc-omo-191',source_id:source.id,url:r.sourceArticle.url,title:r.sourceArticle.title,published_at:r.sourceArticle.publishedAt,revision:1,body_status:'none',body_text:null,body_html:null,processing_queued_at:null};
  const o={article_id:a.id,fields:{unknownEditorField:{keep:'yes'},title:'old'},visibility:'public',updated_by:'local-preview-seed',version:1};
  const pub={article_id:a.id,url:a.url,published_at:a.published_at,eligible:true,selected:false,score:null,reason:null,analysis_id:null,body_mode:'summary',indexable:false,syndicate:false};
  const state={pool:[{article_id:a.id,direct:'fixture',body:''}],counts:{articles:1,sources:1,publications:1,overrides:1,pool_search:1,analyses:0,receipts:0,job_runs:0,selected_ledger:0,selected_state:0,fetch_runs:0},articles:[a],sources:[source],overrides:[o],publications:[pub],jobs:[],audit:[{actor:'local-preview-seed',action:'content.override',subject:`content:${a.id}`}]};
  run('matching URL preserves original ID and original date',()=>{const b=bindLiveRows(bundle.plan,state)[0];assert.equal(b.disposition,'update_existing_url_keep_id');assert.equal(b.targetId,a.id);assert.equal(b.existingPreview.published_at,a.published_at);});
  run('overlay preserves unknown editor fields',()=>{assert.deepEqual(overlay(o.fields,r.editorial).unknownEditorField,o.fields.unknownEditorField);assert.equal(overlay(o.fields,r.editorial).selected,false);});
  run('unknown editor owner skipped',()=>{let s=structuredClone(state);s.overrides[0].updated_by='human-other';assert.equal(bindLiveRows(bundle.plan,s)[0].disposition,'skip_conflict');});
  run('date conflict skipped',()=>{let s=structuredClone(state);s.articles[0].published_at='2000-01-01T00:00:00.000Z';assert.equal(bindLiveRows(bundle.plan,s)[0].disposition,'skip_conflict');});
  run('normalized HTTP/HTTPS match preserves stored URL',()=>{let s=structuredClone(state);s.articles[0].url=s.articles[0].url.replace('https:','http:')+'#tracking';s.publications[0].url=s.articles[0].url;const b=bindLiveRows(bundle.plan,s)[0];assert.equal(b.targetId,a.id);assert.equal(b.existingPreview.url,s.articles[0].url);});
  run('ambiguous normalized matches refuse',()=>{let s=structuredClone(state);s.articles.push({...a,id:'local-preview-duplicate'});s.counts.articles++;assert.throws(()=>bindLiveRows(bundle.plan,s));});
  run('foreign preview DB article refuses',()=>{let s=structuredClone(state);s.articles[0].id='production-item';assert.throws(()=>bindLiveRows(bundle.plan,s));});
  run('allowlist-external existing ID skipped despite valid preview provenance',()=>{let s=structuredClone(state),id='local-preview-not-reviewed';s.articles[0].id=id;s.overrides[0].article_id=id;s.publications[0].article_id=id;s.audit[0].subject='content:'+id;assert.equal(bindLiveRows(bundle.plan,s)[0].disposition,'skip_conflict');});
  run('downstream rows refuse',()=>{let s=structuredClone(state);s.counts.analyses=1;assert.throws(()=>bindLiveRows(bundle.plan,s));});
  run('enabled source refuses',()=>{let s=structuredClone(state);s.sources[0].enabled=true;assert.throws(()=>bindLiveRows(bundle.plan,s));});
  run('alternate database identity refuses',()=>assert.throws(()=>assertDatabaseIdentity({database:'production',address:'127.0.0.1',port:5432})));
  run('Dates remain in canonical CAS fingerprint',()=>{assert.notEqual(fingerprint({date:new Date('2026-01-01')}),fingerprint({date:new Date('2026-01-02')}));assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));});
  run('partial or mismatched independent QA refuses',()=>{assert.throws(()=>verifyQa({schema:'fiscal.preview40.independent-content-qa.v1',result:'PASS_OFFLINE_CONTENT_REVIEW',independent:true,isGold:false,planSha256:bundle.planSha256,masterSha256:bundle.reviewSha256,articleIds:[r.sourceArticle.id],items:[],reviewer:'fixture',reviewedAtUtc:new Date().toISOString()},bundle));});
  run('stale baseline refuses',()=>{let snapshot={database:{database:'fiscalhot_preview_test',address:'127.0.0.1/32',port:5432},...state};let b={schema:'fiscal.preview40.live-baseline.v1',result:'LIVE_READONLY_PREFLIGHT_PASS',planSha256:bundle.planSha256,reviewSha256:bundle.reviewSha256,driverSha256:'fixture',snapshot,baselineSha256:fingerprint(snapshot),boundRows:bindLiveRows(bundle.plan,state),createdAtUtc:new Date(Date.now()-16*60*1000).toISOString()};assert.throws(()=>assertFreshBaseline(b,bundle,'fixture'));});
  return passed;
}

  // Additional meaningful mutation fixtures are exported separately for the test runner.
export function postStateGuardFixture(bundle) {
  const r={...bundle.plan.rows[0],disposition:'update_existing_url_keep_id',targetId:'local-preview-old',targetSourceId:'local-preview-old-source',existingPreview:{url:bundle.plan.rows[0].sourceArticle.url}};
  const a={id:r.targetId,source_id:r.targetSourceId,url:r.sourceArticle.url,title:r.sourceArticle.title,published_at:r.sourceArticle.publishedAt,body_text:null,body_html:null,body_status:'none',revision:1,processing_queued_at:null};
  const s={id:r.targetSourceId,enabled:false,site_fulltext:false,syndicate_fulltext:false};
  const p={article_id:a.id,url:a.url,published_at:a.published_at,summary:'old',eligible:true,search_text:'fixture',selected:false,score:null,reason:null,indexable:false,syndicate:false,body_mode:'summary',analysis_id:null};
  const o={article_id:a.id,fields:{unknownFlag:'preserve'}};
  const before={pool:[{article_id:a.id,direct:'fixture',body:''}],counts:{articles:1,sources:1,publications:1,overrides:1,pool_search:1,analyses:0,receipts:0,job_runs:0,selected_ledger:0,selected_state:0,fetch_runs:0},articles:[a],sources:[s],publications:[p],overrides:[o],jobs:[],audit:[]};
  const post=structuredClone(before);post.publications[0].summary=r.editorial.summary;post.overrides[0].fields=overlay(o.fields,r.editorial);post.audit.push({actor:ACTOR,action:'content.override',subject:`content:${a.id}`});
  return {r,before,post};
}
