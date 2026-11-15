'use strict';
// Fixture build exercises the real R8 entry point in an isolated temp site.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {build,normalizeInput,parseArgs,PAGE,EVIDENCE,DEFAULT_INPUT}=require('./build-useit-fastflow.cjs');
const navigation=require('./useit-navigation.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'useit-r8-build-'));
const write=(file,value)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
try{
 write('index.html','<!doctype html><html><header class="site-header"><a href="./useit/index.html">USEIT</a></header></html>');
 write('useit/tests/2026-11-13/B01.html','other product must remain unchanged');
 write('content/useit/placement-gta-2026-11-14.json',JSON.stringify({case:'B10-R7',agent_seconds:300}));
 const report={case:'B10-R8',test_date:'2026-11-15',summary_available:true,agent_seconds:40,execution_runs:[{final_state:'done'}],saved_image_count:3,saved_placement_count:3,post_run_verification:{success:true},model_calls:[{step:1}],prompt:'fixture <img src=x onerror=alert(1)>',cost:{reference_total_usd:0.2}};
 const runtime={disjoint:true,local_total_ms:40000,items:[{key:'generation',milliseconds:30000},{key:'placement',milliseconds:10000}]};
 const input={report,runtime,attempts:[],manifest:{captured_at:'2026-11-15T06:00:00Z'}};

 // Absent evidence never silently becomes a completed or zero-dollar result.
 assert.throws(()=>build({root}),/R8 evidence is missing/);
 assert(!fs.existsSync(path.join(root,PAGE)));
 const pending=build({root,allowPending:true});
 assert.equal(pending.complete,false);
 const pendingHTML=fs.readFileSync(pending.pageFile,'utf8');
 assert(pendingHTML.includes('待完成正式复测'));
 assert(!pendingHTML.includes('$0.000000'));
 assert(!pendingHTML.includes('两个项目均取得完成汇总和真实保存结果'));
 assert.throws(()=>build({root,inputFile:'typo.json',allowPending:true}),/R8 evidence is missing/);

 // Completed fixture uses the same shell, preserves the public evidence, and only writes R8.
 write(DEFAULT_INPUT,JSON.stringify(input));
 const sourceBefore=fs.readFileSync(path.join(root,DEFAULT_INPUT),'utf8');
 const result=build({root});
 assert.equal(result.complete,true);
 const html=fs.readFileSync(result.pageFile,'utf8');
 assert(html.startsWith('<!doctype html>'));
 assert(html.includes('href="../../../assets/site.css"'));
 assert(html.includes('href="../../../useit/index.html"'));
 assert(html.includes('运行完成，三面保存已核查'));
 assert(html.includes('40.000 秒'));
 assert(html.includes('width:75%'));
 assert(html.includes('fixture &lt;img'));
 assert(!html.includes('<img src=x'));
 assert(html.includes('href="evidence/B10-R8-placement.json" download'));
 const copied=JSON.parse(fs.readFileSync(path.join(root,EVIDENCE),'utf8'));
 assert.deepEqual(copied.report,report);
 assert.deepEqual(copied.runtime,runtime);
 assert.equal(copied.baseline.agent_seconds,300);
 assert.equal(fs.readFileSync(path.join(root,DEFAULT_INPUT),'utf8'),sourceBefore);
 assert.equal(fs.readFileSync(path.join(root,'useit/tests/2026-11-13/B01.html'),'utf8'),'other product must remain unchanged');
 assert.deepEqual(fs.readdirSync(path.join(root,'useit/tests/2026-11-13')).sort(),['B01.html','B10-R8.html','evidence']);

 // Direct report inputs remain supported; another case must not overwrite R8.
 assert.deepEqual(normalizeInput({...report,runtime}).runtime,runtime);
 assert.deepEqual(normalizeInput({...report,runtime}).report,{...report,runtime});
 assert.throws(()=>normalizeInput({case:'B10-R7'}),/different test case/);
 assert.throws(()=>normalizeInput([]),/must be a report/);
 assert.throws(()=>normalizeInput({report:[]}),/report must be an object/);
 write(DEFAULT_INPUT,JSON.stringify({case:'B01'}));
 assert.throws(()=>build({root}),/different test case/);
 assert.equal(fs.readFileSync(result.pageFile,'utf8'),html);

 const nav=navigation('B10-R8');
 assert(nav.includes('href="B10-R8.html" aria-current="page"'));
 assert(!nav.includes('target='));
 assert.deepEqual(parseArgs(['--input','curated.json','--pending']),{inputFile:'curated.json',allowPending:true});
 assert.throws(()=>parseArgs(['--input']),/requires/);
 assert.throws(()=>parseArgs(['--output','B01.html']),/Unknown argument/);
 console.log('PASS: isolated R8 build; evidence required unless explicitly pending; completed fixture and exact timing; direct report/bundle inputs; shared header; same-tab R8 navigation; other pages and input unchanged. No website files were built.');
}finally{
 const resolved=path.resolve(root);
 assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));
 assert(path.basename(resolved).startsWith('useit-r8-build-'));
 fs.rmSync(resolved,{recursive:true,force:true});
}
