// Accounting estimate, not a prediction of a successful regenerated product.
const round=n=>Math.round(n*1000)/1000;
function union(intervals){
 const out=[];
 for(const [start,end] of intervals.filter(([s,e])=>Number.isFinite(s)&&Number.isFinite(e)&&e>=s).sort((a,b)=>a[0]-b[0])){
  const last=out.at(-1);
  if(last&&start<=last[1])last[1]=Math.max(last[1],end);else out.push([start,end]);
 }
 return out;
}
function total(intervals){return round(union(intervals).reduce((n,[s,e])=>n+e-s,0)/1000);}
function estimate(c){
 const start=Date.parse(c.sent_at),end=Date.parse(c.finished_at);
 const timed=c.failures.filter(f=>Number.isFinite(Date.parse(f.start))&&Number.isFinite(Date.parse(f.end))&&Date.parse(f.end)>=Date.parse(f.start));
 const windows=union(timed.map(f=>[Math.max(start,Date.parse(f.start)),Math.min(end,Date.parse(f.end))]));
 const removed=total(windows),roots=c.observations.filter(o=>o.name==='agent.run').map(o=>[Date.parse(o.startTime),Date.parse(o.endTime)]);
 const agentRemoved=total(windows.flatMap(([s,e])=>roots.map(([a,b])=>[Math.max(s,a),Math.min(e,b)])));
 const cancelled=c.local_runs.some(r=>r.final_state==='cancelled');
 if(c.estimate_invalid_reason)return {failed_calls:c.failures.length,timed_failed_calls:timed.length,unmeasured_failed_calls:c.failures.length-timed.length,failed_seconds:removed,observed_net_seconds:null,agent_net_seconds:null,complete_run:false,invalid_reason:c.estimate_invalid_reason,windows:[]};
 return {method:'wall-clock minus union of measured failed-tool intervals; successful retries and replanning retained',failed_calls:c.failures.length,timed_failed_calls:timed.length,unmeasured_failed_calls:c.failures.length-timed.length,failed_seconds:removed,failed_agent_seconds:agentRemoved,observed_net_seconds:c.submitted_to_finish_seconds==null?null:round(Math.max(0,c.submitted_to_finish_seconds-removed)),agent_net_seconds:c.agent_seconds==null?null:round(Math.max(0,c.agent_seconds-agentRemoved)),cancelled,complete_run:!cancelled&&!c.root_timing_anomaly,windows:windows.map(([s,e])=>({start:new Date(s).toISOString(),end:new Date(e).toISOString(),seconds:round((e-s)/1000)}))};
}
module.exports={estimate,union,total};
