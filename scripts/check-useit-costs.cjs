const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'content/useit/costs-2026-11-14.json'),'utf8'));
const eq=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
assert.equal(data.cases.length,17);
const seen=new Set();
for(const c of data.cases){
 assert.equal(c.invoice_verified,false);
 let modelSum=0,serviceSum=0;
 for(const task of c.tasks){
  assert(!seen.has(task.task_id),'task counted in two cases');seen.add(task.task_id);
  for(const m of task.model_lines||[]){
   const r=data.model_rates_usd_per_million[m.model];assert(r);
   eq(m.fresh_input_tokens+(m.cache_read_tokens||0)+(m.cache_creation_tokens||0),m.input_tokens);
   const dollars=(m.fresh_input_tokens*r.input+(m.cache_read_tokens||0)*r.input*r.cache_read_multiplier+(m.cache_creation_tokens||0)*r.input*r.cache_creation_multiplier+m.output_tokens*r.output)/1e6;
   eq(dollars,m.reference_usd);modelSum+=dollars;
  }
  for(const s of task.service_lines||[]){
   const r=data.service_rates_usd_per_unit[s.service+(s.variant?':'+s.variant:'')];assert(r);
   eq(s.units*r.usd_per_unit,s.reference_usd);serviceSum+=s.reference_usd;
   assert.equal(s.invoice_verified,false);
  }
 }
 eq(c.model_reference_usd,modelSum);eq(c.service_reference_usd,serviceSum);
 if(c.reference_total_usd!==null)eq(c.reference_total_usd,modelSum+serviceSum);
 const html=fs.readFileSync(path.join(root,`useit/tests/2026-11-13/${c.case}.html`),'utf8');
 assert(html.includes('id="cost"'));assert(html.includes('不是供应商实际扣款账单'));
}
const r3=data.cases.find(c=>c.case==='B10-R3');
const serviceLines=r3.tasks.flatMap(t=>t.service_lines||[]);
assert.equal(serviceLines.find(s=>s.variant==='generate').units,2);
assert.equal(serviceLines.find(s=>s.variant==='edit').units,1);
console.log(`PASS: 17 cases / ${seen.size} unique tasks; inclusive cache pricing, service units, sums and visible invoice qualifications verified.`);
