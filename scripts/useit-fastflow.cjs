'use strict';

// Pure, opt-in R8 renderer. No data loading, builder mutation, app calls or publication.
// render({report, runtime, cost, attempts, startupAttempts, manifest, baseline, evidenceUrl, sourceInvestigation})
// A runtime chart requires {disjoint:true,local_total_ms,items:[{key,milliseconds,...}]}.
// Images need public `src`; raw local_copy paths are deliberately not published implicitly.
const {describeObservation}=require('./useit-observation-labels.cjs');
const useitNavigation=require('./useit-navigation.cjs');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seconds=ms=>finite(ms)?`${(ms/1000).toFixed(3)} 秒`:'未记录';
const money=value=>finite(value)?`$${value.toFixed(6)}`:'尚未取得完整费用';
const clock=value=>{
 if(!finite(value))return '待完整复测';
 const rounded=Math.round(value),minutes=Math.floor(rounded/60);
 return minutes?`${minutes} 分 ${rounded%60} 秒`:`${rounded} 秒`;
};
function safeUrl(value,{external=false}={}){
 if(typeof value!=='string'||!value.trim()||/[\u0000-\u0020<>"']/u.test(value))return '';
 if(/^https:\/\//i.test(value))return value;
 if(external||/^(?:[a-z]+:|\/\/|[A-Za-z]:\\)/i.test(value))return '';
 return value;
}
function externalLink(url,label){const href=safeUrl(url,{external:true});return href?`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`:'';}
function table(headings,rows){return `<div class="table-wrap" tabindex="0"><table><thead><tr>${headings.map(x=>`<th scope="col">${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function date(value){if(!value)return '未记录';const parsed=new Date(value);return Number.isNaN(parsed.valueOf())?escape(value):escape(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'medium',hour12:false}).format(parsed));}
function completeRun(report){return !!report&&report.summary_available===true&&finite(report.agent_seconds)&&Array.isArray(report.execution_runs)&&report.execution_runs.length>0&&report.execution_runs.every(run=>run.final_state==='done')&&!String(report.run_outcome||'').includes('interrupted');}
function verifiedFaces(report){return report?.post_run_verification?.success===true&&report.saved_image_count===3&&report.saved_placement_count===3;}
function validRuntime(report,runtime){
 if(!completeRun(report)||runtime?.disjoint!==true||!finite(runtime.local_total_ms)||!Array.isArray(runtime.items)||!runtime.items.length)return false;
 const keys=runtime.items.map(item=>item.key);
 return new Set(keys).size===keys.length&&runtime.items.every(item=>finite(item.milliseconds)&&item.milliseconds>=0)&&Math.abs(runtime.items.reduce((sum,item)=>sum+item.milliseconds,0)-runtime.local_total_ms)<=1&&Math.abs(runtime.local_total_ms-report.agent_seconds*1000)<=1;
}

const CSS=`.fastflow{--ff-ink:#173b42;--ff-muted:#547078;--ff-accent:#247d81;--ff-warn:#956225}.fastflow .ff-status{display:inline-block;padding:.35rem .7rem;border-radius:99px;background:#edf4f2;color:var(--ff-ink);font-size:.85rem}.fastflow .ff-status.pending{background:#fff1da;color:#775114}.fastflow .ff-lead{padding:1.4rem;border:1px solid #d9e2de;border-radius:12px;background:#f2f7f4}.fastflow .ff-lead h2{margin:.35rem 0;font-size:1rem}.fastflow .ff-lead h2 strong{display:block;font-size:clamp(2rem,5vw,2.8rem);white-space:nowrap}.fastflow .ff-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.7rem;margin:.8rem 0}.fastflow .ff-quick span{font-size:.85rem;color:var(--ff-muted)}.fastflow .ff-quick strong{display:block;font-size:1.3rem;color:var(--ff-ink)}@media(max-width:760px){.fastflow .ff-quick{grid-template-columns:repeat(2,minmax(0,1fr))}}.fastflow .ff-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.8rem;margin:1.1rem 0}.fastflow .ff-metrics div{padding:.8rem;background:#fff;border:1px solid #dce4df;border-radius:8px}.fastflow .ff-metrics small,.fastflow td small{display:block;color:var(--ff-muted)}.fastflow .ff-metrics strong{display:block;margin-top:.3rem;font-size:1.2rem}.fastflow section{margin-top:2rem}.fastflow .ff-bar{display:flex;min-height:18px;overflow:hidden;border-radius:8px;margin:1rem 0}.fastflow .ff-bar span{min-width:0;background:var(--segment)}.fastflow .ff-breakdown{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.7rem 1rem}.fastflow .ff-breakdown dt{font-weight:700}.fastflow .ff-breakdown dt small{display:block;font-weight:400;color:var(--ff-muted)}.fastflow .ff-breakdown dd{margin:0;white-space:nowrap}.fastflow .ff-note{padding:.8rem 1rem;border-left:3px solid #c8a368;background:#fff8ec}.fastflow .ff-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.fastflow figure{margin:0}.fastflow figure img{display:block;width:100%;height:320px;object-fit:contain;background:#f2f2ec;border:1px solid #dde0d9;border-radius:8px}.fastflow figcaption{margin-top:.5rem}.fastflow .ff-image-pending{min-height:180px;display:grid;place-items:center;padding:1rem;background:#f0f3ee;border-radius:8px;text-align:center;color:var(--ff-muted)}.fastflow .ff-attempt{border:1px solid #e2ded3;border-radius:10px;padding:1.1rem;margin-top:1rem}.fastflow .ff-attempt h3{margin-top:0}.fastflow .ff-search{display:flex;gap:1rem;flex-wrap:wrap;margin:1rem 0}.fastflow .ff-search input[type=search]{padding:.5rem;border:1px solid #c5d4cc;border-radius:6px}.fastflow td{vertical-align:top}.fastflow .ff-steps td:last-child{min-width:230px;max-width:430px;line-height:1.7}.fastflow .ff-meta{margin-top:.4rem;font-size:.82rem;color:var(--ff-muted)}.fastflow .ff-meta code{overflow-wrap:anywhere}.fastflow pre{white-space:pre-wrap;overflow-wrap:anywhere}.fastflow .ff-source{color:var(--ff-muted);font-size:.85rem}.fastflow .ff-nav{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}.fastflow .ff-nav a{padding:.5rem .75rem;border:1px solid #cdd8d0;border-radius:7px}.fastflow .ff-nav [aria-current=page]{background:var(--ff-ink);color:#fff}@media(max-width:760px){.fastflow .ff-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.fastflow .ff-grid{grid-template-columns:1fr}.fastflow figure img{height:auto;max-height:520px}.fastflow .ff-lead{padding:1rem}}`;
const DARK_CSS=`.fastflow .ff-history{line-height:1.9}.fastflow .ff-test-date{font-size:.9rem;color:var(--ff-muted)}[data-theme="dark"] .fastflow{--ff-ink:#dcebe8;--ff-muted:#a9c1bf;--ff-accent:#8bd5d1}[data-theme="dark"] .fastflow .ff-lead,[data-theme="dark"] .fastflow .ff-metrics div,[data-theme="dark"] .fastflow .ff-image-pending{background:#172e32;border-color:#3d5558;color:var(--ff-ink)}[data-theme="dark"] .fastflow .ff-status{background:#244348}[data-theme="dark"] .fastflow .ff-note,[data-theme="dark"] .fastflow .ff-status.pending{background:#372f22;color:#f0d7aa}[data-theme="dark"] .fastflow .ff-attempt,[data-theme="dark"] .fastflow figure img{border-color:#3d5558}[data-theme="dark"] .fastflow .ff-search input{background:#172e32;color:#dcebe8;border-color:#587174}[data-theme="dark"] .fastflow a{color:#8bd5d1}`;
const FILTER_SCRIPT=`(()=>{for(const box of document.querySelectorAll('[data-ff-chain]')){const input=box.querySelector('[data-ff-search]'),errors=box.querySelector('[data-ff-errors]'),rows=[...box.querySelectorAll('tbody tr')],count=box.querySelector('[data-ff-count]');const filter=()=>{let n=0;const q=input.value.trim().toLocaleLowerCase();for(const row of rows){row.hidden=!(row.dataset.search.toLocaleLowerCase().includes(q)&&(!errors.checked||row.dataset.failed==='true'));if(!row.hidden)n++}count.textContent=n+' 条';box.querySelector('[data-ff-empty]').hidden=n!==0};input.addEventListener('input',filter);errors.addEventListener('change',filter)}})();`;

module.exports=function createFastflowUI(){
 function quickBreakdown(report,runtime){
  if(!validRuntime(report,runtime))return '';
  const primary=['planning','generation','placement'],labels=['模型等待','生成画稿','装配保存'];
  const values=primary.map(key=>runtime.items.find(item=>item.key===key)?.milliseconds||0);
  const other=runtime.items.filter(item=>!primary.includes(item.key)).reduce((sum,item)=>sum+item.milliseconds,0);
  return `<div class="ff-quick" aria-label="耗时组成一览">${[...values,other].map((value,index)=>`<span>${labels[index]||'代码准备与衔接'}<strong>${(value/1000).toFixed(1)} 秒</strong></span>`).join('')}</div>`;
 }
 function navigation(latestView=false){return useitNavigation(latestView?'B10-latest':'B10-R8');}
 function history(report){
  if(!completeRun(report))return '';
  return `<p class="ff-history"><a href="B10-R1.html">原始 R1：<strong>15 分 01 秒</strong></a> → <a href="B10-R7.html">修改前 R7：<strong>5 分 10 秒</strong></a> → 本轮 R8：<strong>${clock(report.agent_seconds)}</strong></p><p class="ff-source">统一采用 Agent 执行时间。R1 还尝试了三维；R7、R8只做生图和装配。其间主题、代码、网络和图片服务条件也有变化，不能把全部差值算成某一项修改的收益。</p>`;
 }
 function toolFailureCount(report){
  if(!completeRun(report)||!Array.isArray(report.langfuse?.observations))return null;
  const failed=new Set(report.langfuse.observations.filter(item=>item.level==='ERROR'&&String(item.name).startsWith('tool.')).map(item=>item.tool_call_id||item.id));
  for(const call of report.calls||[])if(call.success===false||call.result?.status==='error')failed.add(call.tool_call_id||call.action_name);
  return failed.size;
 }
 function breakdown(report,runtime){
  if(!validRuntime(report,runtime))return `<p class="ff-note"><strong>时间组成待核验。</strong>${completeRun(report)?'已有完整总耗时，但尚未取得与总计一致、排除重叠的分段记录。':'还没有完整、未中断的正式复测总计。'}不会把嵌套阶段或并行的三张图直接相加，也不会把缺失时间写成 0 秒。</p>`;
  const colors=['#287c80','#93b8a1','#d6a65f','#a4bacb','#8993b3','#b6b6a0'];
  const titles={planning:'模型请求与等待',rewrite:'后台整理提示词',generation:'生成三张画稿',placement:'装配、保存与等待回执',verification:'检查保存结果',setup:'读取资料与准备默认计划',other:'流程衔接与其他'};
  return `<div class="ff-bar" role="img" aria-label="${escape(runtime.items.map(item=>(titles[item.key]||item.title)+' '+seconds(item.milliseconds)).join('；'))}">${runtime.items.map((item,index)=>`<span style="width:${runtime.local_total_ms?item.milliseconds/runtime.local_total_ms*100:0}%;--segment:${colors[index%colors.length]}"></span>`).join('')}</div><dl class="ff-breakdown">${runtime.items.map(item=>`<dt>${escape(titles[item.key]||item.title||'执行阶段')}<small>${escape(item.description||'以本次实测分段为准。')}</small></dt><dd>${seconds(item.milliseconds)}</dd>`).join('')}</dl><p class="ff-source">这些项目相加为 ${(runtime.local_total_ms/1000).toFixed(3)} 秒。模型时间包含请求、等待和响应；生图按实际重叠去重，内部阶段已包含在上层。</p>`;
 }
 function measurement(evidence){
  if(!evidence)return '待正式复测核验';
  if(typeof evidence.detail==='string')return escape(evidence.detail);
  if(typeof evidence.summary==='string')return escape(evidence.summary);
  return '已有阶段记录，尚需核对实际结果';
 }
 function changes(report){
  const e=report?.acceptance_evidence||{};
  const rows=[
   ['<strong>模型逐次读取资料</strong>，每次都要等一轮响应。','代码<strong>提前加载必要资料</strong>，交给模型直接使用。',measurement(e.model_file_reads)],
   ['用户选择默认规格后，仍由模型<strong>逐步写产品计划和清单</strong>。','代码<strong>准备默认规格、产品计划和任务清单</strong>。',measurement(e.default_plan)],
   ['用户已要求制作，仍会<strong>再问一次是否开始</strong>。','识别明确制作授权后继续；<strong>查看、询问和否定制作</strong>的请求仍保留边界。',measurement(e.confirmation)],
   ['模型<strong>逐面安排装配</strong>，额外等待多轮。','三图就绪后由代码<strong>批量派发与跟踪原任务</strong>。素材并行准备，同一母版仍依次保存。',measurement(e.batch_dispatch)],
   ['做完后还要<strong>再请求模型总结</strong>。','代码根据实际保存结果<strong>直接汇报完成或失败</strong>，不靠承诺文字判成功。',measurement(e.final_summary)]
  ];
  return `<section id="r8-changes"><h2>已经改了什么，取得了什么结果？</h2>${table(['以前的痛点','现在的代码方案','本次实际结果'],rows)}<p class="ff-note"><strong>批量派发不等于一次保存。</strong>目前同一母版的 A 面、B 面、背面仍分别保存和记录版本；一次原子保存尚未在本轮实现。减少模型调用也不等于本地处理时间为零。</p></section>`;
 }
 function concurrency(evidence,report,cost){
  if(evidence?.status!=='verified_two_project_runs_completed'||!completeRun(report)||evidence.b07?.final_state!=='done')return '';
  const b=evidence.b07,overlap=evidence.overlap?.approximate_overlap_seconds;
  const rows=[['R8 · GTA6 光栅卡',clock(report.agent_seconds),`${report.model_calls?.length??'未记录'} 次`,money(cost.reference_total_usd),'3 面回执成功；独立检查与磁盘哈希核验一致'],
   ['B07 · 普通双面卡牌',clock(b.agent_seconds),`${b.steps?.length??'未记录'} 次`,money(b.reference_cost?.reference_total_usd),'2 面回执成功；磁盘中正背两面与源图一致']];
  return `<section id="r8-concurrency"><h2>并发验证：两个项目各自完成</h2><p>在当前界面保持不变时，分别向两个项目聊天提交制作任务。${finite(overlap)?`日志确认执行区间约有 <strong>${Math.round(overlap)} 秒重叠</strong>。`:''}两个项目均取得完成汇总和真实保存结果。</p>${table(['任务','Agent 执行时间','决策模型请求','参考费用 USD','保存核验'],rows)}<p class="ff-source">B07 是普通双面卡牌，保留其实际 ${b.steps?.length??'多'} 轮模型流程；不能把 R8 的 1 轮流程当作所有品类均已实现。这里验证两个项目聊天的后台并发，未声称两个独立系统窗口同时输入。</p><h3>侧栏状态也有实际记录</h3><p>状态快照记录了 <strong>B07 正在运行、R8 已完成且未读</strong>。${evidence.sidebar?.completed_unread_dom_verified?'真实页面 DOM 已确认“完成未读”的蓝点提示。':''}运行中显示转圈、失败不冒充完成、查看后清除未读提示的规则已通过单元测试；本轮没有点击查看后再验收消点，也没有逐帧验收旋转动画。</p><p class="ff-source">15:43:04 的快照发生在 R8 完成之后；两任务重叠由运行日志确认，不拿该快照冒充两个任务都在运行。</p></section>`;
 }
 function sourceInvestigation(evidence,catalogEvidence){
  const faces=Array.isArray(evidence?.faces)?evidence.faces:[];
  const catalog=evidence?.catalog||catalogEvidence;
  if(!faces.length&&!catalog)return '';
  const names={A:'A 面',B:'B 面',back:'背面','frame-a':'A 面','frame-b':'B 面'};
  const disk=face=>finite(face.download?.disk_backpressure_ms)&&finite(face.download?.commit_ms)?face.download.disk_backpressure_ms+face.download.commit_ms:null;
  const rows=faces.map(face=>[escape(names[face.face]||face.face),finite(face.bytes)?`${(face.bytes/1e6).toFixed(2)} MB`:'未记录',seconds(face.host_read_ms),seconds(face.download?.body_wait_ms),seconds(disk(face))]);
  const allDisk=faces.map(disk),maxDisk=allDisk.length&&allDisk.every(finite)?Math.max(...allDisk):null;
  const proxy=evidence?.comparison?.proxy_results||[];
  const proxyRows=proxy.map(row=>{
   const original=faces.find(face=>face.face===row.face);
   const matched=original?.sha256&&original.sha256===row.sha256&&original.bytes===row.bytes;
   return [escape(names[row.face]||row.face),seconds(row.total_ms),matched?'已完整下载，哈希与原图一致':'完整性对应关系待核验'];
  });
  const native=evidence?.comparison?.native_fetch?.results||[];
  const nativeRows=native.map(row=>[escape(row.electron?`应用 Electron / Node ${row.node}`:`Node ${row.node||'未记录'}`),seconds(row.total_ms),finite(row.bytes)?`${(row.bytes/1e6).toFixed(2)} MB`:'未记录',['TimeoutError','AbortError'].includes(row.error)?'到期停止，未收完整图片':row.error?'读取失败，未完整通过':'以完整性记录为准']);
  const validation=evidence?.fix?.validation||(finite(evidence?.fix?.unit_tests)?`下载通道改动的 ${evidence.fix.unit_tests} 项单元测试通过；应用内真实传输与产品保存需另看本轮验收，不把独立测速当成整项制作通过。`:'下载通道改动的验证记录尚待接入；不把独立测速当成整项制作通过。');
  const catalogRows=catalog?[
   ['问题',escape(catalog.problem||'品类目录读取失败后，原流程可能把缺少目录数据当成该产品不受支持。')],
   ['原因',escape(catalog.cause||'加载目录与判断品类能力共用了一条失败路径，网络失败没有单独向上报告。')],
   ['修改',escape(catalog.fix||'在有效期内复用已成功读取的目录缓存；仍需重新读取而失败时，明确返回目录加载失败，不能误报 unsupported。')],
   ['验收',escape(catalog.validation||'修复后的真实保存结果待核验。')]
  ]:[];
  return `<section id="r8-extra-findings"><h2>追加发现：慢下载与目录误判</h2>${faces.length?`<h3>图片不大，时间花在从云端拿数据</h3><p><strong>问题：</strong>装配显示“读取素材”很久，看起来像本机读取图片太慢。</p><p><strong>原因：</strong>图片当时还没有完整落到本机。“读取素材”的内部会补做云端下载；前面的“等待已登记下载”是 0，也不能证明本地已经就绪。</p>${table(['位置','图片大小','读取素材整体','等待网络图片数据','磁盘写入与落盘'],rows)}${finite(maxDisk)?`<p>这几次磁盘写入与落盘最多 <strong>${seconds(maxDisk)}</strong>；主要等待来自下载通道。表内阶段互相包含，不能再次相加成总耗时。</p>`:''}<p><strong>修改：</strong>桌面下载改用 <code>Electron net.fetch</code>，遵守系统代理等网络设置；继续流式写入、检查完整长度，确认完整后才替换文件。选定通道失败时报告失败，不悄悄退回慢的直接连接。</p><p class="ff-source">${escape(validation)}</p>${proxyRows.length||nativeRows.length?`<details><summary>同一原图的网络通道对照</summary>${proxyRows.length?`<h4>使用本机已配置的代理</h4>${table(['位置','完整下载耗时','核验'],proxyRows)}`:''}${nativeRows.length?`<h4>直接连接，设置截止时间</h4>${table(['运行时','已等待','已收到','状态'],nativeRows)}`:''}<p>这是原运行结束后的独立测速，不是新的产品制作测试。不同时间的网络条件会变化；这些数字不计入上方最终一轮的总耗时，也不用于承诺固定提速。</p></details>`:''}`:''}${catalogRows.length?`<h3>目录没读到，不能说这个品类不支持</h3>${table(['问题定位','说明'],catalogRows)}`:'<h3>品类目录的修复与验收</h3><p>目录缓存复用和失败分类的本轮证据尚未接入。</p>'}<p><a href="#r8-attempts">查看旧失败试次的独立记录 ↓</a></p></section>`;
 }
 function images(report,{heading='实际画稿',id='r8-images'}={}){
  const list=Array.isArray(report?.images)?report.images:[];
  const cards=list.map((item,index)=>{
   const src=safeUrl(item.src),label=item.caption||({'frame-a':'A 面 · 白天','frame-b':'B 面 · 夜景',back:'背面 · 同主题设计'}[item.face])||`已采集画稿 ${index+1}（面片归属待核对）`;
   const original=safeUrl(item.original_src)||src;
   return `<figure>${src?`<a href="${escape(original)}"><img src="${escape(src)}" alt="${escape(label)}" loading="lazy"></a>`:'<div class="ff-image-pending">图片文件已采集，尚未接入此页面</div>'}<figcaption><strong>${escape(label)}</strong></figcaption></figure>`;
  }).join('');
  const review=report?.visual_review;
  return `<section id="${escape(id)}"><h2>${escape(heading)}</h2>${list.length?`<div class="ff-grid">${cards}</div>`:'<p>正式复测图片尚未提供；不会拿早期试跑图片冒充本轮结果。</p>'}${review?`<p><strong>二维目视检查：</strong>${escape(typeof review==='string'?review:review.summary||'尚未记录结论')}</p>`:'<p>二维目视检查尚未记录。</p>'}<p class="ff-source">这里只展示二维画稿；A/B 变图效果与三维预览不属于本次验收。</p></section>`;
 }
 function fee(cost,{heading='这次花了多少美元？',id='cost'}={}){
  const total=cost?.reference_total_usd,known=cost?.known_reference_subtotal_usd;
  const rows=(cost?.tasks||[]).flatMap((task,index)=>[
   ...(task.model_lines||[]).map(item=>[`任务 ${index+1} · ${String(item.model).includes('flash-lite')?(id==='cost'?'图片命名辅助':'轻量模型辅助'):'决策模型请求'}`,escape(item.model||'模型'),money(item.reference_usd)]),
   ...(task.service_lines||[]).map(item=>[`任务 ${index+1} · 图片服务`,escape(item.variant==='edit'?'参考已有图编辑新画稿':item.variant==='generate'?'生成新画稿':item.service||'图片服务')+(finite(item.units)?` · ${item.units} 张`:''),money(item.reference_usd)])
  ]);
  return `<section id="${escape(id)}">${id==='cost'?'<span id="r8-cost"></span>':''}<h2>${escape(heading)}</h2><p><strong>${finite(total)?`参考总费用 ${money(total)}`:'参考总费用尚未确认'}</strong>${!finite(total)&&finite(known)?`；已记录部分小计 ${money(known)}，不能当作完整总价。`:''}</p>${rows.length?table(['花在哪里','做了什么','参考费用 USD'],rows):'<p>缺少用量或计价记录时保留未知，不按 $0 处理。</p>'}<p class="ff-source">按记录用量和配置费率计算，<strong>不是供应商实际扣款账单</strong>。每个任务只取最后一份累计用量；辅助模型费用已包含在总计中，不再重复相加。“1 次决策模型请求”不等于所有辅助模型一共只调用 1 次。</p></section>`;
 }
 function chain(report,{id='r8-chain',heading='每一步具体做了什么？'}={}){
  const observations=report?.langfuse?.observations||[],notes={...(report?.observation_notes||{})};
  const hostLabels={project_plan_write:['代码保存默认产品计划','程序准备并保存默认规格与产品计划；这是宿主步骤，不是额外的模型请求。'],plan_write:['代码更新制作进度','程序记录当前制作步骤及其状态，不需要为清单更新单独等待模型。'],canvas_product_add_batch:['代码派发三面装配任务','三图就绪后由程序发起装配；素材并行准备，同一母版的三面依次保存，完成状态仍以回执为准。'],canvas_product_add_status:['代码跟踪原装配任务','继续查询原任务的阶段或保存结果；查询进度不等于再做一次装配。'],respond_to_user:['代码返回实际制作结果','程序根据实际保存结果向用户汇报，不重新生图，不凭承诺文字宣称完成。']};
  for(const action of report?.host_actions||[]){const label=hostLabels[action.name];if(label&&action.tool_call_id&&!notes[action.tool_call_id])notes[action.tool_call_id]={title:label[0],description:label[1]};}
  if(report?.summary_available===false)for(const observation of observations)if(observation.name==='agent.run')notes[observation.id]=report.functional_outcome==='placement_failed'?{title:'装配失败试跑的云端记录',description:'这轮已出现装配失败且缺少最终汇总；此记录不是完整成功耗时，不能再与子步骤相加。'}:{title:'Agent 中断前的云端记录',description:'这条云端记录截至服务中断，包含内部步骤；它不是完整成功耗时，不能再与子步骤相加。'};
  if(!observations.length)return `<section id="${escape(id)}"><h2>${escape(heading)}</h2><p>正式复测链路尚未采集。</p></section>`;
  const sessionUrl=report.langfuse_url||report.langfuse.url,baseUrl=typeof sessionUrl==='string'?sessionUrl.split('/sessions/')[0]:'';
  const rows=[...observations].sort((a,b)=>String(a.startTime).localeCompare(String(b.startTime))).map((observation,index)=>{
   const label=describeObservation(observation,observations,notes),failed=observation.level==='ERROR';
   const nested=label.kind==='aggregate'?'包含子步骤，不重复相加':String(observation.name).startsWith('stage.')?'已包含在上层操作中':'';
   const trace=observation.traceId?externalLink(baseUrl+'/traces/'+encodeURIComponent(observation.traceId),'查看 Trace'):'';
   return `<tr data-search="${escape(label.title+' '+label.description+' '+observation.name+' '+(failed?'报错 失败':''))}" data-failed="${failed}"><td><strong>${index+1}. ${escape(label.title)}</strong>${failed?'<small>此记录标记 ERROR</small>':''}<details class="ff-meta"><summary>展开原始名称与定位编号</summary><code>${escape(observation.name)}<br>ID ${escape(observation.id)}${observation.tool_call_id?'<br>Call '+escape(observation.tool_call_id):''}</code><p>${trace}</p></details></td><td>${date(observation.startTime)}</td><td>${seconds(observation.duration_ms)}${nested?`<small>${nested}</small>`:''}</td><td>${escape(label.description)}</td></tr>`;
  }).join('');
  return `<section id="${escape(id)}" data-ff-chain><h2>${escape(heading)}</h2><p>${externalLink(sessionUrl,'打开 Langfuse Session')}。右侧直接说明工作内容；定位编号默认折叠。总计、轮次与内部步骤有包含关系，不能把所有行相加。</p><div class="ff-search"><label>搜索中文步骤 <input type="search" data-ff-search placeholder="例如：生图、保存、计划"></label><label><input type="checkbox" data-ff-errors> 仅看 ERROR</label><span data-ff-count aria-live="polite">${observations.length} 条</span></div><div class="table-wrap ff-steps" tabindex="0"><table><thead><tr><th scope="col">执行步骤</th><th scope="col">开始时间（北京时间）</th><th scope="col">耗时</th><th scope="col">这一步做了什么</th></tr></thead><tbody>${rows}</tbody></table></div><p data-ff-empty hidden>没有符合条件的步骤。</p></section>`;
 }
 function attemptsSection(attempts,startupAttempts){
  const startup=(startupAttempts||[]).filter(item=>item.status==='startup_connection_failure');
  const startupHtml=startup.length?`<div class="ff-attempt"><h3>启动故障 ${startup.length} 次</h3><p>本机 Agent 服务未能连接，请求没有进入真实执行。归档中没有模型调用或工具操作；这属于启动故障，单独披露，不冒充生图工具失败。</p></div>`:'';
  const cards=(attempts||[]).map((entry,index)=>{
   const r=entry.report||entry,summary=entry.summary||{};
   const failed=summary.outcome==='failed_incomplete'||r.functional_outcome==='placement_failed'||(Array.isArray(r.failed_placements)&&r.failed_placements.length>0);
   const incomplete=r.run_outcome==='interrupted_no_final_summary'||r.summary_available===false||summary.summary_available===false;
   const interrupted=incomplete&&!failed;
   const saved=verifiedFaces(r),cost=r.cost||entry.cost||{},known=cost.known_reference_subtotal_usd;
   const savedText=failed?`已收到装配失败回执，生成图片不等于产品已保存。${finite(summary.generated_sources)&&finite(summary.successful_saved_faces)?`本次生成 ${summary.generated_sources} 张素材，成功保存 ${summary.successful_saved_faces} 面。`:''}`:saved?'三张新图已生成，独立母版检查确认三面均已保存。':'已保存范围以本次独立核验为准。';
   const finalNote=failed&&incomplete?'本轮同时缺少最终汇总；完整耗时和完整费用仍未知。':interrupted?'Agent 在等待回执期间中断，缺少最终汇总；不能将这轮标为完整成功。':'';
   return `<article class="ff-attempt"><h3>${escape(entry.label||`试跑 ${index+1}`)} · ${failed?'装配失败，未完整通过':interrupted?'服务中断，未完整通过':'结果需单独核验'}</h3><p>${savedText}${finalNote}</p>${summary.public_note?`<p>${escape(summary.public_note)}</p>`:''}<p><strong>完整 Agent 总耗时：${incomplete?'未知':clock(r.agent_seconds)}。</strong>${finite(r.model_wait_ms)?`已记录模型请求与等待 ${seconds(r.model_wait_ms)}；`:''}${finite(r.phase_totals_ms?.['orch.plan.run_action'])?`工具外层操作 ${seconds(r.phase_totals_ms['orch.plan.run_action'])}。`:''}这些片段不能直接拼成完整总计。</p><p>已记录费用小计：<strong>${finite(known)?money(known):'未知'}</strong>；缺最终结算时，完整总费用仍为未知。</p>${incomplete&&finite(r.interruption?.trace_error_window_ms)?`<p class="ff-source">Langfuse 的 ${seconds(r.interruption.trace_error_window_ms)} 只覆盖到中断时刻，不是完整成功耗时。</p>`:''}<details><summary>查看这次试跑的图片、费用与链路证据</summary>${images(r,{heading:'本次试跑的实际图片',id:`r8-attempt-${index}-images`})}${fee(cost,{heading:'本次试跑的已记录费用',id:`r8-attempt-${index}-cost`})}${chain(r,{id:`r8-attempt-${index}-chain`,heading:'本次试跑的中文调用说明'})}</details></article>`;
  }).join('');
  return `<section id="r8-attempts"><h2>此前试跑与启动问题，单独保留</h2>${startupHtml}${cards||'<p>尚未接入试跑记录；正式页面应保留首次失败与中断证据。</p>'}<p class="ff-source">这些试次与后续正式复测分别计时、分别列费用。多个窗口共用本机服务的干扰需要单独消除或验证，不能把重启造成的中断误认成模型或生图失败。</p></section>`;
 }
 function version(report,manifest){
  const v=manifest||report?.implementation_version||{},repos=v.repositories||{};
  const rows=Object.entries(repos).map(([name,value])=>[escape(name==='frontend'?'前端本机修改版':name==='agent'?'Agent 本机修改版':name),escape(String(value.commit||'未记录').slice(0,12)),`${Object.keys(value.source_sha256||{}).length} 个源文件指纹`]);
  return `<section id="r8-version"><h2>测试日期与修改版本</h2><p>测试日期：<strong>${escape(report?.test_date||'待正式复测')}</strong>；版本记录时间：${date(v.captured_at)}。这是本机修改版的实验记录，不等于已发布安装包。</p>${rows.length?table(['程序','基础提交','改动记录'],rows):'<p>尚未接入本次发送前的代码版本指纹。</p>'}<details><summary>查看代码版本与源文件指纹</summary><pre>${escape(JSON.stringify(v,null,2))}</pre></details></section>`;
 }
 function rewriteSetting(report,manifest){
  const settings=report?.experiment_settings||manifest?.experiment_settings||report?.implementation_version?.experiment_settings||{},event=report?.prompt_rewrite||report?.rewrite_events?.[0];
  const observation=report?.rewrite_observation;
  if(observation?.observed_event_count===0&&observation.observed_duration_ms===0)return '<p><strong>本轮没有实际执行提示词改写：</strong>记录中为 0 个改写事件、0 秒改写耗时。环境开关状态未确认，因此不把“没有执行”写成“开关已关闭”。R7执行过改写；本轮还加入五项流程修改及下载、目录修复，不是严格只改一个变量的实验。</p>';
  if(settings.prompt_rewrite_enabled===false||event?.enabled===false||event?.status==='disabled')return '<p><strong>本次提示词整理关闭，直接使用原文。</strong>R7 开启过整理，因此对比同时包含开关变化，不能将总时间差全部归因五项代码改动。</p>';
  if(event)return `<p><strong>本次记录到后台提示词整理：</strong>${event.status==='success'||event.status==='applied'?'返回成功；是否实际应用以本次审计为准。':'回退或结果待核验。'}${finite(event.duration_ms)?`耗时 ${seconds(event.duration_ms)}，已包含在本次总时长中。`:''}</p>`;
  return '<p>本次提示词整理开关与实际执行结果尚待核验；不会沿用上一轮设置。</p>';
 }
 function render(input={}){
  const {report=null,runtime=null,attempts=[],manifest=null,baseline=null,evidenceUrl=''}=input;
  const cost=input.cost||report?.cost||{},complete=completeRun(report),saved=verifiedFaces(report),label=complete?(saved?'运行完成，三面保存已核查':'运行完成，保存核查待完成'):'待完成正式复测';
  const modelCount=Array.isArray(report?.model_calls)?report.model_calls.length:null;
  const prior=baseline?.agent_seconds,latestView=input.latestView===true,failures=toolFailureCount(report);
  const pageLabel=latestView?'最新成果':'B10-R8',pageTitle=latestView?'光栅卡最新成果':'光栅卡优化复测';
  const prompt=report?.prompt||input.prompt||'做一张 GTA6 游戏主题的双图光栅卡：正面从海滨城市白天切换到霓虹夜景，人物和跑车构图保持一致；背面做同主题设计。用默认规格，做好画稿并装到卡里，先不用三维预览。';
  const startup=input.startupAttempts||report?.startup_attempts||attempts.flatMap(entry=>(entry.report||entry).startup_attempts||[]);
  const uniqueStartup=[...new Map(startup.map(item=>[item.attempt||item.project_id,item])).values()];
  const evidence=safeUrl(evidenceUrl);
  return `<div class="fastflow"><style>${CSS}${DARK_CSS}</style>
<nav class="crumb"><a href="../../index.html">USEIT</a><span>/</span><a href="index.html">全品类测试</a><span>/</span>${pageLabel}</nav>
<p class="eyebrow">${latestView?'最新成果 / ':''}B10-R8 / GTA6 光栅卡 / 五项改动复测</p><h1>${pageTitle}</h1>
<section class="ff-lead" id="r8-runtime"><span class="ff-status ${complete?'':'pending'}">${label}</span>
<p class="ff-test-date">测试日期：<strong>${escape(report?.test_date||'待正式复测')}</strong>${complete&&finite(failures)?` · 本轮 <strong>${failures} 个工具失败</strong>`:''}</p>
<h2>Agent 本地执行：<strong>${complete?clock(report.agent_seconds):'待完整复测'}</strong></h2>
${quickBreakdown(report,runtime)}
<p>${complete?`精确记录 ${report.agent_seconds.toFixed(3)} 秒；时间花在哪里，直接看下面。`:'代码方案与中断试跑的证据先保留。未取得完整的正式运行记录前，不给出成功耗时或提速百分比。'}</p>
<div class="ff-metrics"><div><small>首次提交至完成（墙钟）</small><strong>${complete&&finite(report.submitted_to_local_completion_seconds)?clock(report.submitted_to_local_completion_seconds):'待完整记录'}</strong></div><div><small>Agent 决策模型请求</small><strong>${complete&&finite(modelCount)?`${modelCount} 次`:'待复测'}</strong></div><div><small>独立核查保存结果</small><strong>${complete&&saved?'3 图 / 3 面':'待正式核查'}</strong></div><div><small>本轮参考总费用</small><strong>${complete?money(cost.reference_total_usd):'待完整记录'}</strong></div></div>
${breakdown(report,runtime)}${history(report)}${complete&&finite(prior)?`<p class="ff-source">R7 的模型请求与等待为 222.308 秒，本轮为 ${seconds(report.model_wait_ms)}；这是不同条件下的实测样本比较，不是固定提速保证。</p>`:''}</section>
${navigation(latestView)}<section id="r8-request"><h2>用户仍然只说这一句话</h2><blockquote><p>${escape(prompt)}</p></blockquote><p>原话没有工具名、参数字段或并行要求；默认流程是否生效，由本次调用和保存结果验证。</p>${rewriteSetting(report,manifest)}</section>
${changes(complete?report:null)}${concurrency(input.concurrency,report,cost)}${sourceInvestigation(input.sourceInvestigation||report?.source_investigation,report?.catalog_investigation)}${images(complete?report:null)}${fee(complete?cost:null)}${attemptsSection(attempts,uniqueStartup)}${chain(complete?report:null)}${version(report,manifest)}
${evidence?`<p><a href="${escape(evidence)}" download>下载本次脱敏计时与回执依据</a></p>`:''}<p class="ff-note">对比范围为生图和装配，不含三维。本轮同时包含多项代码修改与新的图片生成；只报告实测样本，不承诺固定耗时。</p><a class="back-link" href="B10-R7.html">← 返回 R7 修改前记录</a><script>${FILTER_SCRIPT}</script></div>`;
 }
 return {render,styles:CSS+DARK_CSS,completeRun,validRuntime};
};
