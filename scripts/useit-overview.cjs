'use strict';
const boxRetest=require('../content/useit/box-v1-2026-11-15.json');
const flatCardUI=require('./useit-b07-optimization.cjs');
module.exports=function({cases,latestReport:r,latestVersionReports=[],flatCardReport=null,esc,table,dur,costLabel}){
 const reports=latestVersionReports.length?latestVersionReports:[r];
 const failureCount=report=>Number.isInteger(report.tool_failure_count)?report.tool_failure_count:Array.isArray(report.failure_observations)?report.failure_observations.length:null;
 const errorLabel=report=>failureCount(report)===null?'失败次数待核验':`${failureCount(report)} 次失败`;
 const sampleLabel=report=>({'B10-R8':'较完整需求 · R8','B10-R9':'猫咪短句 · R9','B10-R10':'海底短句 · R10'}[report.case]||report.case||'本轮实测');
 const saved=report=>report.batch_status==='completed'&&report.saved_image_count===3&&report.saved_placement_count===3
  &&Array.isArray(report.placements)&&report.placements.length===3&&report.placements.every(p=>p.success===true)
  &&['frame-a','frame-b','back'].every(face=>report.placements.some(p=>p.face===face));
 const completed=reports.every(saved);
 const tick=completed?'<span class="case-check" role="img" aria-label="画稿与装配已验证">√</span> ':'';
 const shortTests=reports.some(report=>report.bootstrap_fastpath_applied===false||report.fast_path_activated===false);
 const representative=reports.find(report=>report.case==='B10-R8');
 const versionCaveat=shortTests?`较完整需求触发快速流程；两句短需求仍走普通流程。${representative?dur(representative.agent_seconds):'单次实测'}不是通用完成时间。`:'每次实测分别记录，单次结果不是固定完成时间。';
 const stages=()=>`<a href="B10-R1.html">① 原始版</a><a href="B10-R7.html">② 第一轮优化</a><a href="B10-latest.html">③ 第二轮优化 · 多次实测</a>`;
 const earlierReports=reports.filter(report=>report.case!==r.case);
 const earlierResults=()=>earlierReports.map(report=>`<small><a href="B10-latest.html#latest-tests">${esc(sampleLabel(report))}：${dur(report.agent_seconds)}（${errorLabel(report)}）</a>${report.case==='B10-R9'?' · 三维入口报错，三面保存成功':''}</small>`).join('');
 function sampleResults(){
  return `<a class="optimized-result${failureCount(r)>0?' result-failed':''}" href="B10-latest.html#latest-tests"><strong>${dur(r.agent_seconds)}</strong><span>（${errorLabel(r)}）</span></a><small><b>最新实测 · ${esc(sampleLabel(r))}</b></small>${earlierReports.length?`<small>同版较早实测：</small>${earlierResults()}`:''}`;
 }
 function comparison(){
  const rows=cases.filter(c=>!c.case.includes('-')).map(c=>{
   const first=c.case==='B10'?cases.find(x=>x.case==='B10-R1'):c;
   const cancelled=first.local_runs.some(x=>x.final_state==='cancelled');
   let before=`<a href="${first.case}.html"><strong>${dur(first.agent_seconds)}</strong>（${first.failures.length} 次失败）</a>`;
   if(c.case==='B10')before+='<small>R1 早期基线；原 B10 中断且计时异常</small>';
   else if(cancelled)before+='<small>已取消，仅已执行时间，未完成整次制作</small>';
   let after='<span class="comparison-pending">—（待优化复测）</span>';
   if(c.case==='B10')after=sampleResults()+`<small>第三版 · ${reports.length} 次实测；${completed?'画稿与装配已验证':'保存范围见逐次记录'}，三维未验收</small>`;
   else if(c.case==='B07'&&flatCardReport)after=flatCardUI.overviewResult(flatCardReport);
   else if(c.case==='B01')after=`<a class="optimized-result result-failed" href="B01-V1.html"><strong>${dur(boxRetest.agent_seconds)}</strong><span>（${boxRetest.failures.length} 次失败）</span></a><small>V1 完整流程复测未通过；新图未装配，三维为白模</small>`;
   else if(['B08','B09'].includes(c.case))after+=`<small><a href="${c.case}-R1.html">已有原任务补测，非优化对照</a></small>`;
   const currentHref=c.case==='B10'?'B10-latest':c.case==='B07'&&flatCardReport?'B07-R1':c.case;
   const currentTick=c.case==='B10'?tick:c.case==='B07'&&flatCardReport?'<span class="case-check" role="img" aria-label="画稿与装配已验证">√</span> ':'';
   return [`<a href="${currentHref}.html">${currentTick}<strong>${esc(c.category)}</strong></a><small>${c.case}</small>`,before,after];
  });
  return `<section id="optimization-overview" class="optimization-overview"><div class="section-heading"><div><p class="eyebrow">优化进展 / 更新于 ${esc(flatCardReport?.test_date||r.test_date||'待记录')}</p><h2>各品类：最初耗时 → 当前优化结果</h2></div></div><p class="sub"><strong>统一展示 Agent 执行时间，括号内为工具调用失败次数。</strong>“—”表示尚无完整的优化后复测，不代表零耗时或零错误。√ 表示对应阶段已验证。</p>${table(['品类','最初耗时（工具失败次数）','目前优化后耗时（工具失败次数）'],rows)}<p class="sub">光栅卡只保留三个主版本：原始版 → 第一轮优化 → 第二轮优化。第三版的 ${reports.length} 次测试合并展示。${esc(versionCaveat)}R1 曾尝试三维，各轮主题和测试范围不同，不作严格同条件的提速比例。</p><div class="case-links">${stages()}</div></section>`;
 }
 function latestCard(category){
  const images=Array.isArray(r.images)?r.images:[],im=images.find(image=>image.face==='frame-a')||images[0];
  const cover=im?.src?`<img src="${esc(im.src)}" alt="${esc(category+' · '+(im.caption||'本轮画稿'))}" loading="lazy" width="600" height="440">`:'<span>本轮画稿待接入</span>';
  const times=`<div class="case-estimate"><span>最新实测 · ${esc(sampleLabel(r))}</span><strong>${dur(r.agent_seconds)}</strong><small>${errorLabel(r)} · Agent 执行时间</small></div>${earlierReports.length?`<p class="sub">同版较早实测：${earlierResults()}</p>`:''}`;
  return `<article class="case-card${completed?' case-card-verified':''}" data-case="B10 ${esc(category)}"><a class="case-cover" href="B10-latest.html">${cover}<span>第三版 · 多次实测</span></a><div class="case-body"><p class="case-number">B10 / 第二轮优化 · ${esc(r.test_date)}</p><h2><a href="B10-latest.html">${tick}${esc(category)}</a></h2><p class="case-status${completed?' status-verified':''}">${completed?`${reports.length} 次画稿与装配均已验证`:'保存结果见逐次记录'} · 三维未验收</p><p class="case-summary">${esc(versionCaveat)}</p>${times}<div class="case-links">${stages()}</div><p class="sub"><a href="B10-latest.html#latest-tests">查看每次输入、时间与参考费用 →</a></p></div></article>`;
 }
 return {comparison,latestCard};
};
