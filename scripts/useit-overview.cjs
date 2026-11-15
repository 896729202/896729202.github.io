'use strict';
const boxRetest=require('../content/useit/box-v1-2026-11-15.json');
module.exports=function({cases,latestReport:r,esc,table,dur,costLabel}){
 const latestErrors=Array.isArray(r.failure_observations)?r.failure_observations.length:null;
 const errorLabel=latestErrors===null?'失败次数待核验':`${latestErrors} 次失败`;
 const round=String(r.case||'最新复测').replace(/^B10-/,'');
 const detailPage=`${r.case||'B10-latest'}.html`;
 const placements=Array.isArray(r.placements)?r.placements:[];
 const completed=r.batch_status==='completed'&&r.saved_image_count===3&&r.saved_placement_count===3&&placements.length===3&&placements.every(p=>p.success===true)
  &&['frame-a','frame-b','back'].every(face=>placements.some(p=>p.face===face));
 const modelCount=Array.isArray(r.model_calls)?r.model_calls.length:null;
 const batchCount=r.call_counts?.canvas_product_add_batch,statusCount=r.call_counts?.canvas_product_add_status;
 const hasCodeFlow=Number.isInteger(modelCount)&&Number.isInteger(batchCount)&&Number.isInteger(statusCount);
 const flowText=hasCodeFlow?`${modelCount} 次模型请求；代码批量派发 ${batchCount} 次，查询原装配任务 ${statusCount} 次。`:'调用安排与等待组成见本轮完整记录。';
 const tick=completed?'<span class="case-check" role="img" aria-label="画稿与装配已验证">√</span> ':'';
 function comparison(){
  const rows=cases.filter(c=>!c.case.includes('-')).map(c=>{
   const first=c.case==='B10'?cases.find(x=>x.case==='B10-R1'):c;
   const cancelled=first.local_runs.some(x=>x.final_state==='cancelled');
   let before=`<a href="${first.case}.html"><strong>${dur(first.agent_seconds)}</strong>（${first.failures.length} 次失败）</a>`;
   if(c.case==='B10')before+='<small>R1 早期基线；原 B10 中断且计时异常</small>';
   else if(cancelled)before+='<small>已取消，仅已执行时间，未完成整次制作</small>';
   let after='<span class="comparison-pending">—（待优化复测）</span>';
   if(c.case==='B10')after=`<a class="optimized-result" href="B10-latest.html"><strong>${dur(r.agent_seconds)}</strong><span>（${errorLabel}）</span></a><small>${esc(round)} · ${completed?'画稿与装配已验证':'保存结果待核验'}，三维未验收</small>`;
   else if(c.case==='B01')after=`<a class="optimized-result result-failed" href="B01-V1.html"><strong>${dur(boxRetest.agent_seconds)}</strong><span>（${boxRetest.failures.length} 次失败）</span></a><small>V1 完整流程复测未通过；新图未装配，三维为白模</small>`;
   else if(['B08','B09'].includes(c.case))after+=`<small><a href="${c.case}-R1.html">已有原任务补测，非优化对照</a></small>`;
   return [`<a href="${c.case==='B10'?'B10-latest':c.case}.html">${c.case==='B10'?tick:''}<strong>${esc(c.category)}</strong></a><small>${c.case}</small>`,before,after];
  });
  return `<section id="optimization-overview" class="optimization-overview"><div class="section-heading"><div><p class="eyebrow">优化进展 / 更新于 ${esc(r.test_date||'待记录')}</p><h2>各品类：最初耗时 → 当前优化结果</h2></div></div><p class="sub"><strong>统一展示 Agent 执行时间，括号内为工具调用失败次数。</strong>“—”表示尚无完整的优化后复测，不代表零耗时或零错误。√ 表示对应阶段已验证。</p>${table(['品类','最初耗时（工具失败次数）','目前优化后耗时（工具失败次数）'],rows)}<p class="sub">光栅卡以 R1 为早期基线；R1 曾尝试三维，${esc(round)} 只做画稿与装配，题材也不同，不能把时间差当成严格同条件的提速比例。最新 ${esc(round)} 的 Agent 执行共 <strong>${dur(r.agent_seconds)}</strong>；提交至完成共 <strong>${dur(r.submitted_to_local_completion_seconds)}</strong>。${esc(flowText)}</p></section>`;
 }
 function latestCard(category){
  const images=Array.isArray(r.images)?r.images:[],im=images.find(image=>image.face==='frame-a')||images[0];
  const cover=im?.src?`<img src="${esc(im.src)}" alt="${esc(category+' · '+(im.caption||'本轮画稿'))}" loading="lazy" width="600" height="440">`:'<span>本轮画稿待接入</span>';
  return `<article class="case-card${completed?' case-card-verified':''}" data-case="B10 ${esc(category)}"><a class="case-cover" href="B10-latest.html">${cover}<span>最新复测 · 二维画稿</span></a><div class="case-body"><p class="case-number">B10 / 最新 ${esc(round)} · ${esc(r.test_date)}</p><h2><a href="B10-latest.html">${tick}${esc(category)}</a></h2><p class="case-status${completed?' status-verified':''}">${completed?'画稿与装配已验证':'保存结果待核验'} · ${errorLabel}</p><p class="case-summary">${completed?'A、B、背面均生成并保存，独立核验 3 张图、3 条装配记录。':'生成图片与成功装配分别核验，以实际保存回执为准。'}${esc(flowText)}三维变图与印刷效果尚未验收。</p><div class="case-time"><span>最新 Agent 执行</span><strong>${dur(r.agent_seconds)}</strong></div><div class="case-time"><span>提交至完成</span><strong>${dur(r.submitted_to_local_completion_seconds)}</strong></div><div class="case-time"><span>参考费用（USD）</span><strong>${costLabel(r.case)}</strong></div><div class="case-links"><a href="B10-latest.html"><strong>最新成果 →</strong></a><a href="${esc(detailPage)}">${esc(round)} 完整记录 · ${errorLabel} →</a><a href="B10-R1.html">早期 R1 · 4 次失败 →</a></div></div></article>`;
 }
 return {comparison,latestCard};
};
