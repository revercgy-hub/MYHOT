import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {SELECTION} from '../../industry/selection.ts';
import {readScoreWeights,dimensionAttentionScore} from '../../packages/backend/src/editorial/dimension-score.ts';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const ratio=(n,d)=>d?n/d:null;
function metrics(c){return {...c,accuracy:ratio(c.tp+c.tn,c.tp+c.fp+c.fn+c.tn),precision:ratio(c.tp,c.tp+c.fp),recall:ratio(c.tp,c.tp+c.fn),f1:ratio(2*c.tp,2*c.tp+c.fp+c.fn)};}

/** Offline development-only assessment. Never consumes holdout, selects a threshold or writes to DB. */
export function evaluateDimensionSelection(predictions,gold,prompt){
 if(predictions.format!=='fiscal.dimension-selection.predictions/v1'||predictions.split!=='development'||predictions.errors!==0||predictions.systemSha256!==sha(prompt))throw Error('complete frozen development predictions and exact prompt required');
 const development=gold.candidates.filter(c=>c.samplingContext?.benchmarkSplit==='development');
 if(!Array.isArray(predictions.cases)||predictions.cases.length!==development.length||new Set(development.map(c=>c.caseId)).size!==development.length)throw Error('complete unique development scope required');
 const byId=new Map(development.map(c=>[c.caseId,c])),seen=new Set(),weights=readScoreWeights(prompt),counts={tp:0,fp:0,fn:0,tn:0},cases=[];
 for(const row of predictions.cases){
  const c=byId.get(row.caseId);
  if(!c||seen.has(row.caseId)||row.bodySha256!==c.evidence?.bodySha256||row.sourceTier!==c.sourceFacts?.sourceTier)throw Error('development identity/body/tier mismatch; holdout is forbidden');
  seen.add(row.caseId);
  if(c.humanAnnotation?.status!=='user_confirmed'||!['select','reject'].includes(c.humanAnnotation.decision))throw Error('decisive human labels required');
  const label=row.prefilter?.label;if(!['PASS','UNKNOWN','BLOCK'].includes(label))throw Error('invalid prefilter');
  if(!Array.isArray(row.rounds)||(label==='BLOCK'?row.rounds.length!==0:row.rounds.length!==2))throw Error('invalid independent score count');
  const values=row.rounds.map(r=>{const value=dimensionAttentionScore(r.data,weights);if(value!==r.computedScore)throw Error('weighted total mismatch');return value;});
  const sum=values.length===2?values[0]+values[1]:null,threshold=SELECTION.thresholds[row.sourceTier]??null;
  const selected=label!=='BLOCK'&&sum!==null&&threshold!==null&&sum>=2*threshold,score=sum===null?null:Math.floor(sum/2),relevance=label==='BLOCK'?'block':'pass';
  if(row.selected!==selected||row.score!==score||row.relevance!==relevance)throw Error('canonical selection aggregation mismatch');
  const truth=c.humanAnnotation.decision,outcome=truth==='select'?(selected?'tp':'fn'):(selected?'fp':'tn');counts[outcome]++;
  cases.push({caseId:row.caseId,bodySha256:row.bodySha256,sourceTier:row.sourceTier,stratum:c.samplingContext.samplingStratum??'unspecified',gold:truth,decision:selected?'select':'reject',outcome,prefilter:label,score,values,threshold});
 }
 const sweep=[];for(let threshold=40;threshold<=90;threshold+=5){const c={tp:0,fp:0,fn:0,tn:0};for(const r of cases){const selected=r.prefilter!=='BLOCK'&&r.score!==null&&r.score>=threshold;c[r.gold==='select'?(selected?'tp':'fn'):(selected?'fp':'tn')]++;}sweep.push({threshold,...metrics(c)});}
 const strata=[...new Set(cases.map(c=>c.stratum))].map(stratum=>{const c={tp:0,fp:0,fn:0,tn:0};for(const r of cases.filter(r=>r.stratum===stratum))c[r.outcome]++;return {stratum,...metrics(c)};});
 return {format:'fiscal.dimension-selection.evaluation/v1',split:'development',n:cases.length,...metrics(counts),cases,strata,sweep,sweepStatus:'development-only hypothetical common threshold; no applied threshold changes',verdict:'CALIBRATION_REVIEW_REQUIRED',limitations:['Known development material, not an independent test','Software correctness does not establish selection quality','Current source-tier thresholds are unchanged']};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [predictionFile,goldFile,promptFile,out]=process.argv.slice(2);
 if(!out)throw Error('usage: node evaluate-dimension-selection.mjs predictions.json gold.json prompt.md output.json');
 const p=fs.readFileSync(predictionFile),g=fs.readFileSync(goldFile),s=fs.readFileSync(promptFile);
 const result={...evaluateDimensionSelection(JSON.parse(p),JSON.parse(g),s.toString()),predictionsSha256:sha(p),goldSha256:sha(g),systemSha256:sha(s)};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({n:result.n,tp:result.tp,fp:result.fp,fn:result.fn,tn:result.tn,precision:result.precision,recall:result.recall,verdict:result.verdict}));
}
