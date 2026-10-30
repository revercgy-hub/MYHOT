import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {evaluateDimensionSelection} from '../scripts/fiscal/evaluate-dimension-selection.mjs';
const prompt=fs.readFileSync(new URL('../industry/prompts/selection-score-dimensions-candidate.md',import.meta.url),'utf8');
function fixture(){
 const annotation=(id,decision,split='development')=>({caseId:id,evidence:{bodySha256:'hash-'+id},sourceFacts:{sourceTier:'T1'},samplingContext:{benchmarkSplit:split},humanAnnotation:{status:'user_confirmed',decision}});
 const row=(id,value)=>({caseId:id,bodySha256:'hash-'+id,sourceTier:'T1',prefilter:{label:'PASS'},rounds:[0,1].map(()=>({data:{itemType:'local_practice',dimensions:{sig:value,nov:value,cred:value,reson:value,act:value}},computedScore:10*value})),selected:value>=6,score:value*10,relevance:'pass'});
 return {gold:{candidates:[annotation('a','select'),annotation('b','reject'),annotation('c','select','holdout')]},predictions:{format:'fiscal.dimension-selection.predictions/v1',split:'development',errors:0,systemSha256:crypto.createHash('sha256').update(prompt).digest('hex'),cases:[row('a',6),row('b',4)]}};
}
test('offline assessment verifies arithmetic and canonical aggregation before joining development labels',()=>{
 const {gold,predictions}=fixture(),result=evaluateDimensionSelection(predictions,gold,prompt);
 assert.deepEqual([result.tp,result.fp,result.fn,result.tn],[1,0,0,1]);assert.equal(result.precision,1);assert.equal(result.n,2);assert.equal(result.verdict,'CALIBRATION_REVIEW_REQUIRED');
 const blocked=fixture();blocked.predictions.cases[0]={...blocked.predictions.cases[0],prefilter:{label:'BLOCK'},rounds:[],selected:false,score:null,relevance:'block'};
 assert.equal(evaluateDimensionSelection(blocked.predictions,blocked.gold,prompt).fn,1);
});
test('offline assessment rejects holdout, incomplete/duplicate scope, changed bodies, totals and decisions',()=>{
 for(const change of [
  f=>f.predictions.split='holdout', f=>f.predictions.cases.pop(), f=>f.predictions.cases[1]=f.predictions.cases[0],
  f=>f.predictions.cases[0].caseId='c',f=>f.predictions.cases[0].bodySha256='changed',
  f=>f.predictions.cases[0].rounds[0].computedScore=6,f=>f.predictions.cases[0].selected=false,
  f=>f.gold.candidates[0].humanAnnotation.status='machine_proposed',
 ]){const f=fixture();change(f);assert.throws(()=>evaluateDimensionSelection(f.predictions,f.gold,prompt));}
});
