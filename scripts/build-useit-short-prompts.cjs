'use strict';

// Build only the short-prompt report and its curated evidence snapshot.
const fs=require('node:fs'),path=require('node:path');
const navigation=require('./useit-navigation.cjs');
const renderTimeBar=require('./useit-time-bar.cjs');
const {describeObservation}=require('./useit-observation-labels.cjs');
const PAGE='useit/tests/2026-11-13/B10-short-prompts.html';
const EVIDENCE='useit/tests/2026-11-13/evidence/B10-short-prompts.json';
const DEFAULT_INPUT='content/useit/short-prompts-2026-11-15.json';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seconds=n=>finite(n)?`${n.toFixed(1)} 秒`:'未取得完整记录';
const duration=n=>finite(n)?`${Math.floor(Math.round(n)/60)}分${Math.round(n)%60}秒`:'尚未完成计时';
const money=n=>finite(n)?`$${n.toFixed(6)}`:'完整费用未知';
const count=n=>Number.isInteger(n)&&n>=0?`${n} 次`:'待核验';
const url=value=>typeof value==='string'&&value&&!/[\u0000-\u0020<>"']/u.test(value)&&! /^(?:[a-z]+:|\/\/)/i.test(value)?value:typeof value==='string'&&/^https:\/\//i.test(value)&&!/[\u0000-\u0020<>"']/u.test(value)?value:'';
const external=(href,label)=>url(href)&&/^https:/.test(href)?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'尚未取得链路';
const table=(heads,rows)=>`<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(heads.join(' / '))}"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
function normalizeCase(value){
 const r=value.report||value;
 const observations=Array.isArray(r.langfuse?.observations)?r.langfuse.observations:Array.isArray(r.observations)?r.observations:[];
 const modelCalls=Array.isArray(r.model_calls)?r.model_calls.length:r.model_calls;
 const failures=Number.isInteger(r.tool_failure_count)?r.tool_failure_count:Array.isArray(r.failure_observations)?new Set(r.failure_observations.map(x=>x.tool_call_id||x.id)).size:null;
 return {...r,case:r.case||value.case,runtime:value.runtime||r.runtime,cost:value.cost||r.cost||{},modelCallCount:modelCalls,
  failureCount:failures,observations,wall_seconds:r.wall_seconds??r.submitted_to_local_completion_seconds,
  saved_face_count:r.saved_face_count??r.saved_placement_count,generated_image_count:r.generated_image_count??r.images?.length,
  save_verified:r.save_verified===true||r.post_run_verification?.success===true,
  langfuse_url:r.langfuse_url||r.langfuse?.url};
}
function normalizeInput(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.cases)||value.cases.length===0)throw new Error('Short-prompt evidence must contain a nonempty cases array.');
 const cases=value.cases.map(normalizeCase);
 if(cases.some(r=>!/^B10-R\d+$/.test(r.case)||typeof r.prompt!=='string'||!r.prompt.trim()))throw new Error('Each short-prompt case needs its B10-R number and actual original user prompt.');
 if(new Set(cases.map(r=>r.case)).size!==cases.length)throw new Error('Repeated case identity in short-prompt report.');
 return {...value,cases};
}
function completedExecution(r){
 if(r.summary_available===false||!finite(r.agent_seconds))return false;
 if(Array.isArray(r.execution_runs))return r.execution_runs.length>0&&r.execution_runs.every(run=>['done','failed','cancelled'].includes(run.final_state));
 return r.summary_available===true||['done','failed','cancelled','waiting_confirmation','completed','saved'].includes(r.status);
}
function status(r){
 if(r.status_label)return r.status_label;
 if(r.confirmation_required===true||r.pending_question===true||r.status==='waiting_confirmation')return '仍需确认，未自动做完';
 if(r.save_verified&&r.saved_face_count>0)return `已核验保存 ${r.saved_face_count} 面`;
 if(r.saved_face_count>0)return `回执保存 ${r.saved_face_count} 面，独立核验待完成`;
 if(r.generated_image_count>0)return '已有图片，完整保存待核验';
 if(r.status==='failed')return '本轮失败';
 if(r.status==='cancelled')return '本轮已取消';
 return completedExecution(r)?'本轮执行结束，制作结果见下方':'尚在执行或等待结果';
}
function breakdown(r){
 const runtime=r.runtime;
 if(runtime?.disjoint!==true||!finite(runtime.local_total_ms)||!Array.isArray(runtime.items)||runtime.items.length===0||!finite(r.agent_seconds))return null;
 if(!runtime.items.every(item=>finite(item.milliseconds)&&item.milliseconds>=0))return null;
 if(new Set(runtime.items.map(item=>item.key)).size!==runtime.items.length)return null;
 const sum=runtime.items.reduce((total,item)=>total+item.milliseconds,0);
 if(Math.abs(sum-runtime.local_total_ms)>1||Math.abs(sum-r.agent_seconds*1000)>1)return null;
 const keys=['planning','generation','placement'];
 return [...keys.map(key=>runtime.items.filter(item=>item.key===key).reduce((n,item)=>n+item.milliseconds,0)),runtime.items.filter(item=>!keys.includes(item.key)).reduce((n,item)=>n+item.milliseconds,0)].map(n=>n/1000);
}
const CSS=`.short-prompts{--sp-muted:#596e64;--sp-paper:#f1f6f3;--sp-border:#d6e1d9;--sp-ink:#244b3b}.short-prompts h1{font-size:clamp(1.8rem,4vw,2.7rem)}.short-prompts section{margin-top:2rem}.sp-lead{padding:1.2rem;border:1px solid var(--sp-border);background:var(--sp-paper);border-radius:12px}.sp-overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.sp-card{padding:1rem;border:1px solid var(--sp-border);background:var(--u-paper,#fff);border-radius:10px}.sp-card h2{margin:0;font-size:1.15rem}.sp-card .sp-time{display:block;margin:.5rem 0;color:var(--sp-ink);font-size:2rem;line-height:1.2}.sp-card blockquote{margin:.5rem 0;padding:0;border:0}.sp-card blockquote p{margin:.4rem 0;font-size:1rem}.sp-status{font-weight:700}.sp-parts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin:.9rem 0}.sp-parts small{display:block;color:var(--sp-muted);font-size:.8rem}.sp-parts strong{font-size:1.1rem}.sp-note{padding:.8rem 1rem;border-left:3px solid #b58d4b;background:#fff7e9}.sp-meta{font-size:.85rem;color:var(--sp-muted)}.sp-case{border-top:1px solid var(--sp-border);padding-top:1rem}.sp-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.sp-gallery figure{margin:0}.sp-gallery img{width:100%;height:320px;object-fit:contain;background:var(--sp-paper);border-radius:8px}.sp-gallery figcaption{font-size:.85rem;margin-top:.5rem}.short-prompts pre{white-space:pre-wrap;overflow-wrap:anywhere}.short-prompts code{overflow-wrap:anywhere}.sp-chain td:last-child{min-width:220px;line-height:1.7}.short-prompts td{vertical-align:top}.short-prompts details{margin:.8rem 0}.short-prompts summary{cursor:pointer}.sp-nav{display:flex;gap:.8rem;flex-wrap:wrap}.sp-nav a{padding:.5rem .7rem;border:1px solid var(--sp-border);border-radius:7px}.sp-nav a[aria-current=page]{background:var(--sp-ink);color:#fff}[data-theme=dark] .short-prompts{--sp-muted:#b3c9be;--sp-paper:#1e342c;--sp-border:#405c4d;--sp-ink:#a9dfbd}[data-theme=dark] .sp-card{background:#192a22}[data-theme=dark] .sp-note{background:#392e1e;color:#ead6b4}[data-theme=dark] .short-prompts a{color:#a9dfbd}@media(max-width:680px){.sp-overview,.sp-gallery{grid-template-columns:1fr}.sp-lead{padding:.8rem}.sp-card{padding:.9rem}.sp-gallery img{height:auto;max-height:500px}}`;
function navigationWithCurrent(latestView=false){
 return navigation(latestView?'B10-latest':'B10-short-prompts');
}
function topCard(r){
 const parts=breakdown(r);
 return `<article class="sp-card"><h2><a href="#${esc(r.case)}">${esc(r.case)}</a></h2><blockquote><p>“${esc(r.prompt)}”</p></blockquote><small class="sp-meta">${Array.from(r.prompt).length} 字（含标点）</small><strong class="sp-time">${completedExecution(r)?duration(r.agent_seconds):'待完整记录'}</strong><span class="sp-meta">Agent 已执行时间</span><p class="sp-status">${esc(status(r))}</p>${parts?renderTimeBar(parts):'<p class="sp-meta">时间组成尚未完成核对，不将缺失项记为零。</p>'}<p class="sp-meta">模型 ${count(r.modelCallCount)} · 工具失败 ${count(r.failureCount)}<br>参考费用 ${money(r.cost.reference_total_usd)}</p></article>`;
}
function chain(r){
 if(!r.observations.length)return '<p>尚未取得完整 Langfuse 观测；不补猜缺失步骤。</p>';
 const rows=[...r.observations].sort((a,b)=>String(a.startTime).localeCompare(String(b.startTime))).map(o=>{
  const label=describeObservation(o,r.observations,r.observation_notes||{});
  return [`<strong>${esc(label.title)}</strong><details><summary>原始名称与定位编号</summary><code>${esc(o.name)}<br>${esc(o.id)}</code></details>`,finite(o.duration_ms)?seconds(o.duration_ms/1000):'未记录',`${o.level==='ERROR'?'<strong>此记录标记 ERROR。</strong> ':''}${esc(label.description)}`];
 });
 return `<div class="sp-chain">${table(['步骤','耗时','这一步做了什么'],rows)}</div><p class="sp-meta">总计、轮次与内部步骤互相包含，不能把所有行相加。这里只按公开操作说明步骤。</p>`;
}
function cost(r){
 const c=r.cost,rows=(c.tasks||[]).flatMap((task,index)=>[
  ...(task.model_lines||[]).map(m=>[`任务 ${index+1} · ${m.model?.includes('flash-lite')?'辅助模型':'决策模型'}`,esc(m.model),money(m.reference_usd)]),
  ...(task.service_lines||[]).map(s=>[`任务 ${index+1} · 图片服务`,`${esc(s.variant==='edit'?'参考图编辑':s.variant==='generate'?'生成新画稿':s.service)}${finite(s.units)?` · ${s.units} 张`:''}`,money(s.reference_usd)])
 ]);
 return `<h3>参考费用 ${money(c.reference_total_usd)}</h3>${!finite(c.reference_total_usd)&&finite(c.known_reference_subtotal_usd)?`<p>已记录部分为 ${money(c.known_reference_subtotal_usd)}，不能当作完整总价。</p>`:''}${rows.length?table(['任务','用途','参考 USD'],rows):'<p>用量记录尚未核对。</p>'}<p class="sp-meta">依据已记录用量与配置费率，<strong>不是供应商实际扣款账单</strong>。每个任务只取最后一份累计用量；缺失费用保留未知。</p>`;
}
function detail(r){
 const rows=[['原始输入',esc(r.prompt)],['执行结果',`<strong>${esc(status(r))}</strong>`],['Agent 执行',completedExecution(r)?seconds(r.agent_seconds):'尚未取得完整总计'],['提交到本轮结束',seconds(r.wall_seconds)],['模型请求次数',count(r.modelCallCount)],['工具失败次数',count(r.failureCount)],['是否追加确认',r.confirmation_required===true?'是；这句短需求没有一轮自动做完':r.confirmation_required===false?'没有追加确认':'待核验'],['已生成图片',Number.isInteger(r.generated_image_count)?`${r.generated_image_count} 张`:'待核验'],['已保存面片',Number.isInteger(r.saved_face_count)?`${r.saved_face_count} 面${r.save_verified?'，已独立核验':'；是否完整保存以回执和独立检查为准'}`:'尚未取得可靠保存记录']];
 const imgs=(r.images||[]).filter(im=>url(im.src));
 const gallery=imgs.length?`<div class="sp-gallery">${imgs.map(im=>`<figure><a href="${esc(url(im.original_src)||url(im.src))}"><img src="${esc(url(im.src))}" alt="${esc(im.caption||im.face||'本次实际画稿')}" loading="lazy"></a><figcaption>${esc(im.caption||im.face||'本次实际画稿')}</figcaption></figure>`).join('')}</div>`:'<p>目前没有可展示的本轮实际画稿；方案文字不当作已生成图片。</p>';
 const rt=r.runtime?.items||[],failures=Array.isArray(r.failures)?r.failures:Array.isArray(r.failure_observations)?r.failure_observations:[];
 const failureRows=failures.map(f=>[esc(f.tool||f.action_name||f.name||'未记录工具名'),finite(f.duration_seconds)?seconds(f.duration_seconds):finite(f.duration_ms)?seconds(f.duration_ms/1000):'未记录',esc(f.reason||f.diagnosis_reason||f.error||f.statusMessage||'回执标记失败，具体原因见本轮记录。')]);
 return `<section class="sp-case" id="${esc(r.case)}"><h2>${esc(r.case)} / 这句话实际跑成了什么</h2>${table(['项目','实际记录'],rows)}${r.notes?.length?`<ul>${r.notes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`:''}${r.final_reply?`<details><summary>查看软件本轮最后的用户可见回复</summary><blockquote><p>${esc(r.final_reply).replaceAll('\n','<br>')}</p></blockquote></details>`:''}${rt.length?`<details><summary>每一项时间包含什么</summary>${table(['阶段','耗时','说明'],rt.map(item=>[esc(item.title||{planning:'模型请求与等待',generation:'生图',placement:'装配与保存',rewrite:'提示词整理',verification:'结果检查',setup:'默认资料与计划',host_reply:'程序返回结果',other:'其他衔接'}[item.key]||item.key),seconds(item.milliseconds/1000),esc(item.description||'以计时依据为准')]))}<p class="sp-meta">各阶段只有在排除嵌套、并行重叠并与 Agent 总计一致后，才在上方展示组成。</p></details>`:''}${failureRows.length?`<h3>报错发生在哪里</h3>${table(['工具','耗时','原因与影响'],failureRows)}`:''}<h3>本轮实际图片</h3>${gallery}${r.visual_review?`<p><strong>二维目视核验：</strong>${esc(typeof r.visual_review==='string'?r.visual_review:r.visual_review.summary)}</p>`:''}${cost(r)}<details><summary>查看 Langfuse 与每一步工作说明</summary><p>${external(r.langfuse_url,'打开本轮 Langfuse Session')}</p>${chain(r)}</details>${r.verification?`<details><summary>独立保存核验</summary><pre>${esc(JSON.stringify(r.verification,null,2))}</pre></details>`:''}</section>`;
}
function renderBody(input,{latestView=false}={}){
 const data=normalizeInput(input),date=data.test_date||'2026-11-15';
 return `<div class="short-prompts"><style>${CSS}</style><nav class="crumb"><a href="../../index.html">USEIT</a><span>/</span><a href="index.html">全品类测试</a><span>/</span>短提示词复测</nav><p class="eyebrow">B10 / 真实短句 / ${esc(date)}</p><h1>短句实测：普通用户能多快完成？</h1><section class="sp-lead"><p>不在用户输入里补规格、背面或工具指令，直接记录软件的真实执行结果。</p><div class="sp-overview">${data.cases.map(topCard).join('')}</div><p class="sp-meta">Agent 执行结束不等于产品制作完成。需要确认、只有方案、已生图和已保存，分别按证据记录。</p></section>${data.conclusion?`<p class="sp-note"><strong>${esc(data.conclusion)}</strong></p>`:''}${navigationWithCurrent(latestView)}<section id="short-prompt-cause"><h2>为什么短句值得单独测？</h2>${data.cause_analysis?`<p>${esc(typeof data.cause_analysis==='string'?data.cause_analysis:data.cause_analysis.summary)}</p>`:'<p>当前快速流程的识别条件很窄：原话需要同时明确双图卡、默认规格、装进卡片和背面。没有写这些细节的短句，会回到原来的模型安排流程。“光栅卡”这个简称也没有被原识别规则完整覆盖。</p>'}<p><strong>R8 的 1分32秒，不能直接当作普通短句的普遍速度。</strong>本页将检验短输入能否直接完成、请求模型多少次，以及时间实际花在哪里；不会给短句补上技术要求后再声称它自动成功。</p><p>固定默认项适合交给代码补齐，但用户明确的规格、留白、只看方案和不制作等要求仍应保留。这次先记录现状；修复后的结果应另开一轮，不覆盖本页。</p></section>${data.cases.map(detail).join('')}<section><h2>记录口径</h2><p>测试日期：${esc(date)}，北京时间。新项目与新素材分别记录，不将旧画稿充作新成果。参考费用含已记录的辅助模型与图片服务；独立检查在制作结束后进行时，不计入 Agent 时间。</p><p>这两句没有要求三维预览；是否实际调用三维工具，以各轮链路为准，不从二维图片推断三维已通过。</p><p><a href="evidence/B10-short-prompts.json" download>下载本次脱敏证据 JSON</a> · <a href="B10-R8.html">查看 R8 五项改动复测</a></p></section></div>`;
}
function renderPage(home,input){
 const header=home.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
 if(!header)throw new Error('Existing site header unavailable.');
 const prefix='../'.repeat(PAGE.split('/').length-1);
 return `<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="description" content="USEIT 光栅卡短提示词复测：记录两句自然输入的真实耗时、费用、确认与保存结果。"><title>短提示词复测 · USEIT</title><link rel="canonical" href="https://896729202.github.io/${PAGE}"><link rel="stylesheet" href="${prefix}assets/site.css"><link rel="stylesheet" href="${prefix}assets/useit.css?v=20261115-4"><script>try{document.documentElement.dataset.theme=localStorage.getItem('notebook-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){}</script><script defer src="${prefix}assets/site.js"></script><script defer src="${prefix}assets/useit.js"></script></head><body class="useit"><a class="skip-link" href="#main">跳到主要内容</a>${header.replaceAll('href="./',`href="${prefix}`)}<main class="u-main" id="main">${renderBody(input)}</main><footer class="u-footer">USEIT / 实验档案 · 2026　<span>北京时间 UTC+8 · 结果与原因按实际证据记录</span></footer></body></html>`;
}
function validatePublicInput(input){
 const json=JSON.stringify(input);
 if(/Bearer\s|sk-[a-zA-Z0-9]{20}|X-Amz-Signature|api_key=|(?:^|[^A-Za-z0-9+.-])[A-Za-z]:[\\/]/i.test(json))throw new Error('Evidence contains an apparent secret, signed URL, or local absolute path; curate it before building.');
}
function build({root=path.resolve(__dirname,'..'),inputFile=DEFAULT_INPUT}={}){
 root=path.resolve(root);const source=path.resolve(root,inputFile);
 if(!fs.existsSync(source))throw new Error('Short-prompt evidence is missing; no page was written.');
 const raw=JSON.parse(fs.readFileSync(source,'utf8').replace(/^\uFEFF/,''));
 normalizeInput(raw);validatePublicInput(raw);
 const html=renderPage(fs.readFileSync(path.join(root,'index.html'),'utf8'),raw);
 const pageFile=path.join(root,PAGE),evidenceFile=path.join(root,EVIDENCE);
 fs.mkdirSync(path.dirname(evidenceFile),{recursive:true});
 fs.writeFileSync(pageFile,html);fs.writeFileSync(evidenceFile,JSON.stringify(raw,null,2)+'\n');
 return {pageFile,evidenceFile,cases:raw.cases.length};
}
if(require.main===module){
 try{if(process.argv.length>2)throw new Error('This builder accepts no CLI arguments; call build({inputFile}) for an explicit alternate curated source.');const result=build();console.log(`Built short-prompt report for ${result.cases} cases; not published.`);}
 catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={build,renderBody,renderPage,normalizeInput,normalizeCase,completedExecution,breakdown,validatePublicInput,PAGE,EVIDENCE,DEFAULT_INPUT};
