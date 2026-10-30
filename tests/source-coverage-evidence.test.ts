import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { declaredMofPages, reviewSourceCoverage, type CoverageCapture, type CoverageSource } from "../scripts/fiscal/source-coverage-evidence.ts";
const source:CoverageSource={id:"coverage-fixture",name:"fixture",kind:"web_list",tier:"T1",participation_mode:"editorial",first_party:true,interval_minutes:1440,cursor:null,fail_count:0,enabled:false,site_fulltext:false,syndicate_fulltext:false,config:{url:"https://example.org/column/",allowUrlPrefixes:["https://example.org/column/"],itemSelector:"ul > li",linkSelector:"a",titleSelector:"a",publishedAtSelector:"span",publishedAtUtcOffset:"+08:00",pagination:{mode:"mof_index_v1",maxPageIndex:1}}};
const anchorAt="2026-10-30T00:00:00Z";
function capture(pass:1|2,index:number,change=""):CoverageCapture {
 const html=`<ul><li><a href="./article${index}.htm">完整财政业务资料${index}${change}</a><span>${index?"2026-07-01":"2026-10-29"}</span></li></ul><script>// var countPage = 99;\nvar countPage=2;var currentPage=${index};</script>`;
 const body=gzipSync(html);
 return {pass,pageIndex:index,url:index?"https://example.org/column/index_1.htm":source.config.url as string,observedAt:"2026-10-30T00:00:01Z",status:200,contentType:"text/html",contentEncoding:"gzip",bytes:body.length,sha256:createHash("sha256").update(body).digest("hex"),eof:true,truncated:false,body};
}
const captures=()=>[capture(1,0),capture(1,1),capture(2,0),capture(2,1)];
test("stable full declared archive proves only its fixed-window listing snapshot",()=>{
 const r=reviewSourceCoverage({source,anchorAt,captures:captures()});
 assert.equal(r.status,"VERIFIED_ARCHIVE_WINDOW_SNAPSHOT");assert.equal(r.uniqueArticles,2);assert.equal(r.recentArticles,1);assert.equal(r.sourceAdmitted,false);assert.equal(r.gate4Passed,false);
});
test("a crossed cutoff, missing page, changed second pass or broken raw capture cannot imply coverage",()=>{
 for(const change of [
  (rows:CoverageCapture[])=>rows.pop(),(rows:CoverageCapture[])=>rows[2]=capture(2,0,"变化"),
  (rows:CoverageCapture[])=>rows[1]!.sha256="bad",(rows:CoverageCapture[])=>rows[1]!.eof=false,
  (rows:CoverageCapture[])=>rows[1]!.url=rows[0]!.url,
 ]){const rows=captures();change(rows);assert.throws(()=>reviewSourceCoverage({source,anchorAt,captures:rows}));}
});
test("publisher declarations are parsed without executing scripts, comments or strings",()=>{
 assert.deepEqual(declaredMofPages('<script>//var countPage=90;\nvar fake="var countPage=80";var countPage=2;var currentPage=0;throw new Error("must not execute");</script>'),{totalPages:2,currentPage:0});
 assert.throws(()=>declaredMofPages('<script>function x(){var countPage=2;var currentPage=0}</script>'));
 assert.throws(()=>declaredMofPages('<script>var countPage=2;var countPage=3;var currentPage=0</script>'));
});
