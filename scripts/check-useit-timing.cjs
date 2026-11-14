const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {estimate,total}=require('./useit-timing.cjs');
// Nested and overlapping retries must never be deducted twice.
assert.equal(total([[0,10000],[2000,5000],[9000,12000],[15000,17000]]),14);
assert.equal(total([[2,1],[NaN,10]]),0);
const cases=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/useit/2026-11-13.json'))).cases;
for(const c of cases){const e=estimate(c);assert.equal(e.unmeasured_failed_calls,0);assert(e.failed_seconds<=c.submitted_to_finish_seconds);assert(e.observed_net_seconds>=0);if(c.agent_seconds!==null)assert(e.agent_net_seconds>=0);}
const mug=estimate(cases.find(c=>c.case==='B09-R1'));
assert.equal(mug.failed_seconds,249.14);assert.equal(mug.observed_net_seconds,399.952);assert.equal(mug.agent_net_seconds,366.533);
const interrupted=estimate(cases.find(c=>c.case==='B10'));
assert.equal(interrupted.complete_run,false);assert.equal(interrupted.agent_net_seconds,null);
const noErrors=cases.find(c=>c.case==='B08-R1');assert.equal(estimate(noErrors).observed_net_seconds,noErrors.submitted_to_finish_seconds);
const missing=estimate({...noErrors,failures:[{tool:'unknown'}]});assert.equal(missing.unmeasured_failed_calls,1);assert.equal(missing.failed_seconds,0);
console.log('PASS: overlapping intervals, all 15 source cases, missing timings, cancelled runs, successful-retry retention and mug 649.092 - 249.140 = 399.952 seconds.');
