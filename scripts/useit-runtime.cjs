'use strict';
const {describeObservation}=require('./useit-observation-labels.cjs');
module.exports=function({esc,date,dur,external,runtimes}){
 const seconds=ms=>`${(ms/1000).toFixed(ms<1000?2:1)} 秒`;
 const clock=s=>date(s).split(' ').at(-1);
 function breakdown(id){
  const r=runtimes.cases.find(x=>x.case===id);if(!r)return '';
  const spent=key=>r.items.find(x=>x.key===key).milliseconds;
  const share=Math.round((spent('planning')+spent('generation'))/r.local_total_ms*100);
  const bars=r.items.map(i=>`<span class="runtime-color-${i.key}" style="width:${i.milliseconds/r.local_total_ms*100}%" title="${esc(i.title)} ${seconds(i.milliseconds)}"></span>`).join('');
  const rows=r.items.map(i=>`<div class="runtime-row runtime-color-${i.key}"><span class="runtime-dot" aria-hidden="true"></span><div><strong>${esc(i.title)}</strong><p>${esc(i.description)}</p></div><div class="runtime-value"><b>${seconds(i.milliseconds)}</b><small>${(i.milliseconds/r.local_total_ms*100).toFixed(1)}%</small></div></div>`).join('');
  return `<section class="runtime-overview" id="runtime-overview"><div class="runtime-heading"><div><p class="eyebrow">先看时间花在哪里</p><h2>Agent 本地执行 <strong>${dur(r.local_total_ms/1000)}</strong></h2></div><a href="#chain">逐步查看做了什么 ↓</a></div><p class="runtime-takeaway"><strong>约 ${share}% 的时间用于等待模型响应和生成图片。</strong>三面装配约 ${Math.round(spent('placement')/1000)} 秒。</p><div class="runtime-stack" role="img" aria-label="${esc(r.items.map(i=>i.title+' '+seconds(i.milliseconds)).join('；'))}">${bars}</div><div class="runtime-list">${rows}</div><details class="runtime-method"><summary>计时口径：这五项相加就是本地执行总时间</summary><p>合计 ${(r.local_total_ms/1000).toFixed(3)} 秒。模型、生成、装配与核验采用本地记录的执行时长，其他时间为剩余差额。生图内部调用、前端保存步骤等已包含在上层操作中，不重复相加。</p><p>这是一张时间分布图，不是精确的起止时间线。Langfuse 全程记录为 ${(r.cloud_total_ms/1000).toFixed(3)} 秒，计时边界不同；下面的云端记录不能拿来直接凑这个本地总计。其他时间不能全部归因为网络等待。</p><p><a href="evidence/runtime-breakdown-2026-11-14.json" download>下载本地分段计时依据 ↓</a></p></details></section>`;
 }
 function rows(observations,{notes={},failures=[],baseUrl=''}={}){
  return [...observations].sort((a,b)=>String(a.startTime).localeCompare(String(b.startTime))).map((o,index)=>{
   const label=describeObservation(o,observations,notes);
   const searchWords={planning:'模型 思考 规划',generation:'生图 图片生成',placement:'装配 保存',verification:'检查 核验',aggregate:'总计 汇总',render:'预览 渲染',setup:'准备 资料'}[label.kind]||'';
   const fi=failures.findIndex(f=>f.observation_id===o.id||(o.tool_call_id&&f.tool_call_id===o.tool_call_id));
   const failed=fi>=0||o.level==='ERROR';
   const trace=o.traceId?external(baseUrl+'/traces/'+o.traceId,'查看 Trace'):'';
   return `<tr data-span="${esc(o.type+' '+o.name+' '+label.title+' '+label.description+' '+searchWords)}" data-failed="${failed}" class="trace-${label.kind}"><td><span class="step-no">${String(index+1).padStart(2,'0')}</span><strong>${esc(label.title)}</strong>${failed?'<span class="badge bad">本步报错</span>':''}<details class="trace-meta"><summary>原始名称与定位信息</summary><code>${esc(o.name)}<br>ID ${esc(o.id)}${o.tool_call_id?'<br>Call '+esc(o.tool_call_id):''}<br>父记录 ${esc(o.parentObservationId||'无')}</code><p>${trace}${fi>=0?' · <a href="#error-'+fi+'">错误分析</a>':''}</p></details></td><td><time datetime="${esc(o.startTime)}" title="${esc(date(o.startTime))}">${esc(clock(o.startTime))}</time></td><td class="trace-duration">${o.duration_ms==null?'无记录':seconds(o.duration_ms)}${label.kind==='aggregate'?'<small>包含子步骤</small>':o.name.startsWith('stage.')?'<small>已计入上层</small>':''}</td><td class="trace-explanation">${esc(label.description)}</td></tr>`;
  }).join('');
 }
 function chain(observations,options={}){
  return `<p class="sub">右侧用中文说明每一步做了什么。整段总计、轮次小计、生图内部记录有包含关系，不能把所有行相加；定位编号只在展开后显示。</p><div class="filters"><label>搜索步骤 <input data-span-search type="search" placeholder="例如：生图、A 面、保存"></label><label><input type="checkbox" data-errors-only> 仅看失败调用</label><span data-span-count aria-live="polite">${observations.length} 条</span></div><div class="table-wrap chain readable-chain" tabindex="0" role="region" aria-label="逐步操作说明"><table><thead><tr><th scope="col">执行步骤</th><th scope="col">开始时间</th><th scope="col">耗时</th><th scope="col">这一步做了什么</th></tr></thead><tbody>${rows(observations,options)}</tbody></table></div><p data-span-empty hidden>没有符合条件的步骤。</p>`;
 }
 return {breakdown,rows,chain};
};
