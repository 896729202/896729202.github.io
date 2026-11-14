const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const runtimes=read('content/useit/runtime-breakdown-2026-11-14.json');
const sources={'B10-R2':'placement-fix','B10-R3':'placement-fire','B10-R4':'placement-speed','B10-R5':'placement-natural','B10-R6':'placement-rewrite','B10-R7':'placement-gta'};
for(const r of runtimes.cases){
 const report=read(`content/useit/${sources[r.case]}-2026-11-14.json`);
 assert.equal(r.local_total_ms,Math.round(report.agent_seconds*1000));
 assert.equal(r.items.reduce((sum,x)=>sum+x.milliseconds,0),r.local_total_ms);
 if(r.generation_groups){
  assert.equal(r.generation_groups.reduce((sum,x)=>sum+x.milliseconds,0),r.items.find(x=>x.key==='generation').milliseconds);
  assert.equal(r.generation_critical_path_ms,r.items.find(x=>x.key==='generation').milliseconds);
  for(const group of r.generation_groups){
   const members=r.generation_steps.filter(x=>x.source_step===group.source_step);
   assert(members.length>0);assert(group.milliseconds>=Math.max(...members.map(x=>x.milliseconds)));
  }
 }else assert.equal(r.generation_steps.reduce((sum,x)=>sum+x.milliseconds,0),r.items.find(x=>x.key==='generation').milliseconds);
 assert(r.items.every(i=>i.milliseconds>=0));
 if(r.case==='B10-R7'){
  assert.equal(report.placement_mode,'serial');
  assert.equal(report.task_ids.length,2);
  assert.deepEqual(r.source_task_ids,report.task_ids);
  assert.equal(r.items.find(i=>i.key==='placement').count,3);
  assert.equal(r.cloud_total_ms,Math.round(report.langfuse.observations.filter(o=>o.name==='agent.run').reduce((sum,o)=>sum+o.duration_ms,0)));
 }
 for(const step of r.generation_steps)assert(report.langfuse.observations.some(o=>o.tool_call_id===step.tool_call_id));
 const html=fs.readFileSync(path.join(root,`useit/tests/2026-11-13/${r.case}.html`),'utf8');
 assert(html.indexOf('id="runtime-overview"')<html.indexOf('class="verdict"'));
 assert(html.includes('这一步做了什么'));
 assert.equal((html.match(/class="trace-meta"/g)||[]).length,report.observations);
 assert(html.includes('data-span-search'));
}
const {describeObservation}=require('./useit-observation-labels.cjs');
const reports=read('content/useit/2026-11-13.json').cases.map(c=>c.observations);
for(const r of runtimes.cases)reports.push(read(`content/useit/${sources[r.case]}-2026-11-14.json`).langfuse.observations);
for(const observations of reports)for(const o of observations){
 const label=describeObservation(o,observations);
 assert.notEqual(label.kind,'unknown',o.name);assert(label.title&&label.description);
}
console.log(`PASS: ${runtimes.cases.length} local runtime totals reconcile; no nested or parallel generation double count; ${reports.flat().length} observations have explanations; IDs fold and breakdown precedes technical detail.`);
