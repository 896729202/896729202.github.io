const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const runtimes=read('content/useit/runtime-breakdown-2026-11-14.json');
for(const r of runtimes.cases){
 const report=read(`content/useit/${r.case==='B10-R2'?'placement-fix':'placement-fire'}-2026-11-14.json`);
 assert.equal(r.local_total_ms,Math.round(report.agent_seconds*1000));
 assert.equal(r.items.reduce((sum,x)=>sum+x.milliseconds,0),r.local_total_ms);
 assert.equal(r.generation_steps.reduce((sum,x)=>sum+x.milliseconds,0),r.items.find(x=>x.key==='generation').milliseconds);
 assert(r.items.every(i=>i.milliseconds>=0));
 for(const step of r.generation_steps)assert(report.langfuse.observations.some(o=>o.tool_call_id===step.tool_call_id));
 const html=fs.readFileSync(path.join(root,`useit/tests/2026-11-13/${r.case}.html`),'utf8');
 assert(html.indexOf('id="runtime-overview"')<html.indexOf('class="verdict"'));
 assert(html.includes('这一步做了什么'));
 assert.equal((html.match(/class="trace-meta"/g)||[]).length,report.observations);
 assert(html.includes('data-span-search'));
}
const {describeObservation}=require('./useit-observation-labels.cjs');
const reports=read('content/useit/2026-11-13.json').cases.map(c=>c.observations);
reports.push(read('content/useit/placement-fix-2026-11-14.json').langfuse.observations,read('content/useit/placement-fire-2026-11-14.json').langfuse.observations);
for(const observations of reports)for(const o of observations){
 const label=describeObservation(o,observations);
 assert.notEqual(label.kind,'unknown',o.name);assert(label.title&&label.description);
}
console.log(`PASS: both local runtime totals reconcile; no nested generation double count; ${reports.flat().length} observations have explanations; IDs fold and breakdown precedes technical detail.`);
