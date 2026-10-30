import test from "node:test";
import assert from "node:assert/strict";
import { buildPrefilterRequest, boundedPrefilterLabel, PREFILTER_BODY_WINDOW } from "../packages/backend/src/editorial/prefilter-input.ts";
import { prefilterUser } from "../packages/backend/src/editorial/writing.ts";
import { buildScoreInput, type AnalyzeInputArticle } from "../packages/backend/src/editorial/analyze.ts";
const article=(bodyText:string):AnalyzeInputArticle=>({id:"long-fixture",revision:1,author:null,title:"会计准则意见征询",url:"https://example.org/article",bodyStatus:"ok",bodyText,excerpt:null,publishedAt:new Date("2026-10-01"),media:[],xPost:null,source:{name:"fixture",kind:"web_list",tier:"T1",firstParty:true}});

test("only long non-post prefilter material is bounded; the stored body and full score input remain intact",()=>{
 const original="甲".repeat(PREFILTER_BODY_WINDOW)+"尾部独有事实";
 const a=article(original),request=buildPrefilterRequest(a,"system","prefilter@base");
 assert.equal(request.partial,true);assert.ok(!request.user.includes("尾部独有事实"));
 assert.match(request.system,/未展示完整正文/u);assert.equal(request.promptVersion,"prefilter@base+body-window12000-v1");
 assert.equal(a.bodyText,original);assert.ok(buildScoreInput(a).includes("尾部独有事实"));
 assert.equal(boundedPrefilterLabel("BLOCK",true),"UNKNOWN");assert.equal(boundedPrefilterLabel("PASS",true),"PASS");assert.equal(boundedPrefilterLabel("BLOCK",false),"BLOCK");
});

test("ordinary inputs preserve the exact existing prompt and PDF layout cleanup precedes window sizing",()=>{
 const a=article("完整正文"),request=buildPrefilterRequest(a,"system","version");
 assert.equal(request.partial,false);assert.equal(request.user,prefilterUser(a));assert.equal(request.system,"system");assert.equal(request.promptVersion,"version");
 const pdf=article(Array.from({length:100},(_,i)=>`[page=${i+1} y=123.4] [x=20] 正文`).join("\n"));
 assert.equal(buildPrefilterRequest(pdf,"system","version").partial,false);
});
