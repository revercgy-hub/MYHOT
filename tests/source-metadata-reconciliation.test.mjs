import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareSourceMetadataReconciliation } from '../scripts/fiscal/source-metadata-reconciliation.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../industry/sources.json',import.meta.url))).sources;
const fields={ 'mof-treasury-debt-data':['titleSelector','publishedAtRegex'], 'pboc-open-market':['titleSelector','titleAuthoritative','publishedAtRegex','publishedAtAuthoritative'] };
function fixture(id){const canonical=structuredClone(catalog.find(x=>x.id===id)),live=structuredClone(canonical);for(const field of fields[id])delete live.config.detail[field];return {canonical,live};}

test('only missing metadata is added, canonical body scope and disabled flags are preserved',()=>{
 for(const id of Object.keys(fields)){
  const {canonical,live}=fixture(id),before=structuredClone(live);
  const result=prepareSourceMetadataReconciliation(live,canonical);
  assert.equal(result.status,'CANDIDATE');assert.equal(result.addedFields.length,fields[id].length);
  assert.deepEqual(result.candidateConfig,canonical.config);assert.deepEqual(live,before);
  assert.equal(prepareSourceMetadataReconciliation(canonical,canonical).status,'UNCHANGED');
 }
});

test('reconciliation rejects source additions, flags, URL/body/budget drift and existing metadata replacements',()=>{
 const {canonical,live}=fixture('pboc-open-market');
 for(const change of [
  x=>x.enabled=true, x=>x.site_fulltext=true, x=>x.syndicate_fulltext=true,
  x=>x.id='new-source',x=>x.name='different',x=>x.config.url='https://other.example/',
  x=>x.config.detail.bodySelector='article',x=>x.config.detail.maxFetches=100,
  x=>x.config.detail.titleSelector='unreviewed h1',
 ]){const bad=structuredClone(live);change(bad);assert.throws(()=>prepareSourceMetadataReconciliation(bad,canonical));}
});
