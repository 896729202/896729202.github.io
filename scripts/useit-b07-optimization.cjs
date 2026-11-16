'use strict';

// Pure rendering module: accepts curated evidence, never discovers logs, calls an
// API, writes a public page, or treats the two-planning-call goal as a test result.
const renderTimeBar=require('./useit-time-bar.cjs');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seconds=value=>Number.isFinite(value)?`${value.toFixed(1)} 秒`:'未取得记录';
const money=value=>Number.isFinite(value)?`$${value.toFixed(6)}`:'未取得记录';
const count=value=>Number.isInteger(value)&&value>=0?String(value):'未取得记录';
const duration=value=>Number.isFinite(value)?`${Math.floor(Math.round(value)/60)}分${Math.round(value)%60}秒`:'待复测';
const table=(heads,rows)=>`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const FACE_NAMES={front:'正面',back:'背面'};
const isChatScope=report=>['chat_full','chat_ui','normal_chat'].includes(report?.test_scope);
const scopeLabel=report=>isChatScope(report)?'正常聊天复测':'集成复测';
const scopeNote=report=>report?.test_scope_note||(isChatScope(report)?'经正常 ChatStore 发送，覆盖真实生图、素材下载、前端装配与保存；以本轮记录和独立核验为准，不代表所有请求的固定完成时间。':'独立 Agent 经诊断入口调用真实生图与前端装配、查询和保存；未覆盖正常 ChatStore 发送及素材下载 UI 完整路径。不能作为正常聊天全链路的通用完成时间。');
const RUNTIME_KEYS=['planning','generation','placement','other'];
const BASELINE_ROUNDS=[
 ['①','判断要读取哪些资料',15.137,'读取目录','先问模型“该读什么”，随后代码读取文件。15.1 秒主要是等待模型响应，不是读取目录花了 15 秒。'],
 ['②','继续查看具体规格',4.424,'读取规格','目录返回后再问一次模型；文件读取在模型响应之后执行。'],
 ['③','确定产品和制作计划',13.318,'保存计划','模型组织产品、规格和步骤；代码随后校验和保存。13.3 秒不是保存文件的耗时。'],
 ['④','编写正反面的创意提示词',17.104,'两张图并行生成，阶段耗时约 24.8 秒','17.1 秒是生成提示词的模型请求；后面的 24.8 秒才是生图阶段，两张图已并行。'],
 ['⑤','决定加载装配工具',6.192,'加载工具包','再次等待模型决定调用哪个工具包；加载代码本身不等于 6.2 秒。'],
 ['⑥','决定把两张图装进去',9.408,'批量装配，往返约 19.3 秒','9.4 秒是在等模型发装配指令；19.3 秒是素材准备、装配保存及回执往返。'],
 ['⑦','整理完成回复',8.818,'返回结果','保存已完成，再让模型组织回复；可以根据真实保存回执直接返回简短结果。']
];

function safeHref(value){
 const url=String(value||'');
 if(/^https:\/\/(?:us\.cloud\.langfuse\.com|896729202\.github\.io|github\.com)\//.test(url)&&!/[\s<>"'\\]/.test(url))return esc(url);
 if(/^(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+(?:#[a-zA-Z0-9_-]+)?$/.test(url)&&!url.split('/').includes('..'))return esc(url);
 return '';
}
function link(url,label){const href=safeHref(url);return href?`<a href="${href}">${esc(label)}</a>`:esc(label+'（链接待记录）');}
function costValue(report){return report?.cost?.reference_usd??report?.cost?.reference_total_usd??null;}
function faceVerified(face){
 const checks=face?.checks||{};
 return face?.success===true&&face.version_saved===true&&['saved','placed','source_intact','visible'].every(key=>checks[key]===true);
}
function isVerified(report){
 const needsIndependent=report?.case!=='B07-baseline-20261115'||report?.verification_required===true;
 return report?.final_state==='done'&&(!needsIndependent||report.inspection_verified===true)&&['front','back'].every(name=>faceVerified(report.faces?.find(face=>face.face===name)));
}
function validateReport(report){
 if(!report)return;
 if(!Number.isFinite(report.agent_seconds)||report.agent_seconds<=0)throw new Error('B07 report requires measured positive Agent seconds.');
 if(report.runtime){
  const parts=RUNTIME_KEYS.map(key=>report.runtime[key]);
  if(!parts.every(value=>Number.isFinite(value)&&value>=0))throw new Error('B07 runtime needs four non-negative exclusive phase values.');
  if(Math.abs(parts.reduce((sum,value)=>sum+value,0)-report.agent_seconds)>0.05)throw new Error('B07 runtime phases must sum to measured Agent seconds; do not add parallel child calls.');
 }
 if(report.case&&!/^B07(?:[-A-Za-z0-9]*)?$/.test(report.case))throw new Error('B07 renderer accepts only B07 evidence.');
}
function nav(active='B07-R1',pageId='B07-R1',report=null){
 if(!/^B07-R\d+$/.test(pageId))throw new Error('Invalid B07 page identifier.');
 return `<nav class="tabs siblings" aria-label="普通双面卡测试版本"><a href="B07.html"${active==='B07'?' aria-current="page"':''}>B07 原始测试</a><a href="${pageId}.html"${active===pageId?' aria-current="page"':''}>${pageId} ${scopeLabel(report)}</a></nav>`;
}
function runtime(report,id='runtime-overview'){
 if(!report?.runtime)return '<p class="empty">本轮分段计时尚未取得，不能用目标时间代替实测。</p>';
 return `<section class="runtime-overview" id="${esc(id)}"><div class="runtime-heading"><div><p class="eyebrow">先看时间花在哪里</p><h2>${report.test_scope?scopeLabel(report)+' · ':''}Agent 本地执行 <strong>${duration(report.agent_seconds)}</strong> <small>${report.agent_seconds.toFixed(3)} 秒</small></h2></div><a href="#chain">查看每一步做了什么 ↓</a></div>${renderTimeBar(RUNTIME_KEYS.map(key=>report.runtime[key]))}<details class="runtime-method"><summary>这四段怎样组成 ${seconds(report.agent_seconds)}？</summary><p>模型请求与等待：发起主规划请求至收到响应；不是纯思考时间。生图：并行阶段的实际经过时间，不能把正面和背面的时间再相加。装配与保存：按已记录的上层执行阶段计时，含素材准备、保存和回执。其他：从 Agent 总时间扣除前三段后的剩余时间，不能全部称为网络等待。</p><p>前端内部读取、排队、写入和版本保存已经包含在装配时间内；辅助模型若与生图并行，也不额外加到总时间。${Number.isFinite(report.wall_seconds)?`${report.wall_time_basis==='acknowledged_to_local_completed'?'发送受理回执至完成':'提交至完成'}约 ${seconds(report.wall_seconds)}，其计时边界与 Agent 执行不同。`:''}</p></details></section>`;
}
function baselinePanel(baseline){
 return `<section id="baseline"><h2>01 / 改之前：7 轮主模型在安排什么？</h2><p><strong>11 月 15 日这次基线：模型等待 74.4 秒，Agent 共 126.5 秒。</strong>正反两张图已经并行生成；本轮优化重点是减少固定步骤之间反复等待模型。</p>${table(['轮次','模型在安排什么','等模型耗时','随后执行'],BASELINE_ROUNDS.map(([n,what,time,next])=>[n,esc(what),`<strong>${seconds(time)}</strong>`,esc(next)]))}<details><summary>展开：哪些是在等模型，哪些是代码或生图耗时？</summary>${table(['轮次','具体含义'],BASELINE_ROUNDS.map(([n,,,,why])=>[n,esc(why)]))}<p><strong>这 7 轮是主规划模型调用。</strong>另有 2 次图片生成，以及 2 次轻模型辅助调用；后者发生在生图阶段，结合代码推断为图片命名，旧日志未记录独立用途字段。工具、查询和回执也会发生请求，因此这里不是所有 HTTP/API 请求的总数。</p></details>${baseline?runtime(baseline,'baseline-runtime'):''}<p class="method">11 月 13 日原始测试为 Agent 447.109 秒、3 次工具错误；11 月 15 日为 126.530 秒、0 次工具错误。主题、图像质量及是否尝试三维不同，不能把这两次时间差当作严格同条件优化比例。</p></section>`;
}
function changesPanel(report){
 const changes=report?.changes;
 const achieved=report?.automatic_workflow_completed&&report.model_calls===2&&report.image_calls===2;
 const rows=changes?.length?changes.map(row=>[esc(row.before),`<strong>${esc(row.after)}</strong>`,esc(row.result||'以本轮回执核验')]):[
  ['先让模型逐次决定读目录、读规格','选定品类和款式后，代码准备当前款的必要资料','避免为读固定资料反复请求模型'],
  ['模型填写默认规格和固定步骤','独立双面卡流程补齐缺省参数，继续做校验','保留用户指定值和创意要求'],
  ['模型分步安排图片生成','一次设计正反面，代码并行生成两张新素材','并行应由代码保证，用户不用写字段或工具名'],
  ['生图后再问模型加载工具和装配','代码确认两面素材完整后批量提交，查询同一个任务','运行中不重复装配；失败如实返回'],
  ['保存后再等模型组织完成回复','核验正反面已保存，再根据真实回执返回短结果','不能仅凭生图完成就宣布制作成功']
 ].map(([before,after,result])=>[esc(before),`<strong>${esc(after)}</strong>`,esc(result)]);
 return `<section id="changes"><h2>02 / ${changes?.length?'本轮具体改了什么':'优化方案与验收目标'}</h2><p>普通卡可以理解为一个 workflow。优化前虽然有独立入口，但 <code>execution="planner"</code> 仍让 Agent 一步步安排。${changes?.length?'本轮已把确定性的生产步骤交给普通卡自己的代码流程。':'目标是把确定性的生产步骤交给普通卡自己的代码流程。'}</p>${table(['原来的问题','现在改成什么','要达到的效果'],rows)}<ol class="flow"><li><strong>模型①</strong>理解需求，确定品类、款式和制作范围</li><li><strong>代码</strong>加载规格，补缺省参数，校验并准备任务</li><li><strong>模型②</strong>一次设计正反两面的内容与生图提示词</li><li><strong>代码</strong>并行生图 → 确认素材 → 批量装配 → 查询原任务 → 核验保存 → 返回真实结果</li></ol><p><strong>${achieved?'本轮已达成':'目标'}：7 次主规划＋2 次生图 → 2 次主规划＋2 次生图。</strong>${achieved?`另有 ${count(report.auxiliary_model_calls)} 次辅助模型调用，已计入费用。`:''}适用于普通、需求完整的新建双面卡；这不是所有辅助模型、轮询、保存等网络请求的总数。${achieved?'以上为本轮真实计数；复杂需求仍可回到普通规划流程。':'是否达到目标，由实测记录决定。'}</p></section>`;
}
function comparison(baseline,report){
 const status=report?(isVerified(report)?'已核验两面保存':'尚未满足两面保存验收'):'待实测';
 return table(['测试','Agent 时间','主规划 / 生图 / 辅助模型','工具失败','参考 USD','结果'],[
  ['11/15 优化前基线',`<strong>${duration(baseline?.agent_seconds??126.53)}</strong>`,`${count(baseline?.model_calls??7)} / ${count(baseline?.image_calls??2)} / ${count(baseline?.auxiliary_model_calls??2)}`,count(baseline?.tool_errors),money(costValue(baseline)),'两面装配回执通过；未测三维'],
  [`本轮自动流程 · ${scopeLabel(report)}`,`<strong style="color:var(--u-accent)">${duration(report?.agent_seconds)}</strong>`,`${count(report?.model_calls)} / ${count(report?.image_calls)} / ${count(report?.auxiliary_model_calls)}`,count(report?.tool_errors),money(costValue(report)),esc(status)]
 ]);
}
function runtimeComparison(baseline,report){
 if(!baseline?.runtime||!report?.runtime)return '';
 const difference=baseline.agent_seconds-report.agent_seconds;
 const titles=['模型请求与等待','并行生图阶段','装配、查询与保存','其他执行与衔接'];
 const rows=RUNTIME_KEYS.map((key,index)=>{
  const before=baseline.runtime[key],after=report.runtime[key],delta=after-before;
  return [titles[index],`${before.toFixed(3)} 秒`,`${after.toFixed(3)} 秒`,`<strong style="color:var(${delta>0?'--u-warm':'--u-accent'})">${delta>0?'增加':'减少'} ${Math.abs(delta).toFixed(3)} 秒</strong>`];
 });
 return `<p><strong>${baseline.agent_seconds.toFixed(2)} 秒 → ${report.agent_seconds.toFixed(2)} 秒，本轮${difference>=0?'减少':'增加'} ${Math.abs(difference).toFixed(2)} 秒（${Math.abs(difference/baseline.agent_seconds*100).toFixed(1)}%）。</strong>这是两次真实样本的差值，不是以后每次都能达到的保证。</p><details><summary>展开四段前后对照：哪些变快，哪些没有？</summary>${table(['时间组成','11/15 基线','本轮实测','差值'],rows)}<p>模型型号保持记录中的实际值。提示词长短、图片创作内容、服务响应和运行环境均可能影响结果；不是单因素实验。</p></details>`;
}
function placementDetails(report){
 if(!report)return '';
 const phases=[['load_source','准备素材'],['write_queue','等待同一母版写入'],['prepare_master','写入母版'],['save','保存画稿'],['record_version','保存版本']];
 const faceRows=(report.faces||[]).map(face=>[FACE_NAMES[face.face]||esc(face.face),...phases.map(([key])=>Number.isFinite(face.timing?.stages?.[key])?seconds(face.timing.stages[key]/1000):'未取得记录')]);
 const background=report.background_verification;
 return `<details><summary>展开：两面装配内部耗时与后台执行</summary>${table(['面',...phases.map(([,title])=>title)],faceRows)}<p>两面准备素材并行；写同一母版时依次保存。“等待写入”与另一面的工作有重叠，不能把两行相加作为任务耗时。</p>${background?`<h3>后台任务的执行保护</h3><p>${esc(background.description)}</p>${table(['观察项','中间 R2','最终 R3'],[['装配及查询往返',`${Number(background.previous_roundtrip_seconds).toFixed(3)} 秒`,`${Number(background.current_roundtrip_seconds).toFixed(3)} 秒`],['前端实际装配任务',`${Number(background.previous_task_seconds).toFixed(3)} 秒`,`${Number(background.current_task_seconds).toFixed(3)} 秒`],['主线程心跳最大间隔',`${background.previous_max_gap_ms} 毫秒`,`${background.current_max_gap_ms} 毫秒`]])}<p>${esc(background.note)}</p>`:''}</details>`;
}
function imagesPanel(report){
 const images=(report?.images||[]).filter(image=>safeHref(image.url));
 if(!images.length)return '<section id="images"><h2>04 / 本轮真实画稿</h2><p class="empty">尚未取得可公开的正反面图片。</p></section>';
 return `<section id="images"><h2>04 / 本轮真实画稿</h2><div class="gallery">${images.map(image=>`<figure><a href="${safeHref(image.url)}"><img src="${safeHref(image.url)}" alt="${esc(image.alt||FACE_NAMES[image.face]||'双面卡画稿')}" loading="lazy"></a><figcaption><strong>${esc(FACE_NAMES[image.face]||image.face)}</strong>${esc(image.caption||'本次任务生成的二维画稿；不代表三维已验收。')}</figcaption></figure>`).join('')}</div></section>`;
}
function receiptPanel(report){
 if(!report)return '';
 return `<section id="receipts"><h2>05 / 两面是否真的保存？</h2>${table(['面','保存','版本','原始素材完整','画稿可见','判定'],['front','back'].map(name=>{const face=report.faces?.find(row=>row.face===name);const yes=value=>value===true?'通过':value===false?'未通过':'未取得记录';return [FACE_NAMES[name],yes(face?.checks?.saved),yes(face?.version_saved),yes(face?.checks?.source_intact),yes(face?.checks?.visible),faceVerified(face)?'<strong>回执通过</strong>':'待核验'];}))}<p class="method">${esc(report.verification_note||'按实际保存和核验回执判断；没有执行的三维检查不计入验收。')}</p>${placementDetails(report)}</section>`;
}
function stepsPanel(report){
 const steps=report?.steps||[];
 return `<section id="chain"><h2>06 / 每一步做了什么？</h2>${steps.length?table(['步骤','这一步干了什么','执行者','耗时','说明'],steps.map((step,index)=>[esc(step.phase||String(index+1)),`<strong>${esc(step.description)}</strong>`,esc(step.kind||'待核验'),seconds(step.seconds),esc(step.note||'')])):'<p class="empty">逐步计时尚未取得；不从总时长反推各步骤。</p>'}<p class="method">此表保留各步真实记录。并行或嵌套子步骤不应直接相加；总耗时请看上方彩色条。</p></section>`;
}
function costsPanel(baseline,report){
 const modelRows=(report?.cost?.model_lines||[]).map(row=>[esc(row.model),count(row.call_count),count(row.input_tokens),count(row.cache_read_tokens),count(row.output_tokens),money(row.reference_usd)]);
 const serviceRows=(report?.cost?.service_lines||[]).map(row=>[esc(`${row.service} / ${row.variant||''}`),esc(row.units),money(row.reference_usd)]);
 return `<section id="cost"><h2>07 / 每个任务花了多少美元？</h2>${table(['任务','任务 ID','Agent 时间','参考费用'],[baseline,report].filter(Boolean).map(row=>[esc(row.case),`<code>${esc(row.task_id||'待记录')}</code>`,duration(row.agent_seconds),money(costValue(row))]))}<p class="method">费用采用每个任务最后一条累计用量 × 仓库配置费率，包含 Agent 任务日志已记录的模型、辅助调用和生图，不重复累加中间快照。未被任务日志记录的其他服务费用（如独立聊天标题请求）不在内；“记录完整”也只针对这个口径。<strong>这是参考成本，不是供应商实际账单。</strong>没有记录的费用显示“未取得记录”，不当作 $0。</p>${modelRows.length?`<details><summary>展开本轮模型与生图费用</summary>${table(['模型','次数','输入 token','缓存命中','输出 token','USD'],modelRows)}${table(['服务','计费单位数','USD'],serviceRows)}</details>`:''}</section>`;
}
function evidencePanel(baseline,report,evidenceUrl){
 const rows=[baseline,report].filter(Boolean).map(row=>[esc(row.case),row.langfuse?.session_url?link(row.langfuse.session_url,'Session ↗'):'未取得链接',(row.langfuse?.traces||[]).map((trace,index)=>link(trace.url,`Trace ${index+1} ↗`)).join(' · ')||'未取得链接',esc(row.code_version||'该记录未附 Git 版本')]);
 const errors=report?.errors||[];
 return `<section id="evidence"><h2>08 / 错误与定位证据</h2><p>${report?`本轮工具失败 <strong>${count(report.tool_errors)} 次</strong>。`:'本轮尚未取得最终结果。'}${errors.length?'失败记录保留在下表。':report?.tool_errors===0?'本轮没有记录到工具失败；这不等于所有品类和场景都不会失败。':''}</p>${errors.length?table(['报错位置','原因','本次处理'],errors.map(error=>[esc(error.where),esc(error.reason),esc(error.resolution||'未恢复')])):''}${table(['测试','Langfuse 会话','Trace','代码版本'],rows)}<p class="method">Langfuse 需要项目访问权限；旧基线链接由本地请求记录中的 ID 生成，本次整理未重新下载云端 Observations。${evidenceUrl?link(evidenceUrl,'下载脱敏计时与保存证据 ↓'):''}</p></section>`;
}
function debugPanel(attempts){
 if(!Array.isArray(attempts)||!attempts.length)return '';
 for(const attempt of attempts)validateReport(attempt);
 const label=attempt=>attempt.debug_label||attempt.measurement_id||attempt.case;
 const status=attempt=>attempt.automatic_workflow_completed?'自动流程完成；性能问题另记':isVerified(attempt)?'两面保存通过；自动流程未接管':'本轮未完成保存核验';
 const rows=attempts.map(attempt=>[esc(label(attempt)),`<strong>${duration(attempt.agent_seconds)}</strong><small>${seconds(attempt.agent_seconds)}</small>`,`${count(attempt.model_calls)} / ${count(attempt.image_calls)} / ${count(attempt.auxiliary_model_calls)}`,count(attempt.tool_errors),money(costValue(attempt)),esc(status(attempt))]);
 const details=attempts.map(attempt=>`<article><h3>${esc(label(attempt))} · ${esc(attempt.test_date)}</h3><p>${esc(attempt.debug_note||attempt.performance_note||'本轮具体问题见所附原始记录。')}</p>${attempt.debug_resolution?`<p><strong>后续处理：</strong>${esc(attempt.debug_resolution)}</p>`:''}${attempt.runtime?renderTimeBar(RUNTIME_KEYS.map(key=>attempt.runtime[key])):''}<p class="method">${attempt.langfuse?.session_url?link(attempt.langfuse.session_url,'本轮 Langfuse Session ↗'):''}${(attempt.langfuse?.traces||[]).map((trace,index)=>' · '+link(trace.url,`Trace ${index+1} ↗`)).join('')}</p></article>`).join('');
 return `<section id="debug-attempts"><details><summary>本次调试记录 · ${attempts.length} 次独立测试（展开）</summary><p><strong>这些是最终复测之前的独立任务，时间和费用没有并入最终单次结果。</strong>0 次工具报错只表示没有失败回执，不代表当时已命中新自动流程。</p>${table(['调试任务','Agent 耗时','主规划 / 生图 / 辅助模型','工具失败','本次参考 USD','实际结果'],rows)}${details}</details></section>`;
}
function render({baseline=null,report=null,pageId='B07-R1',evidenceUrl=null,debugAttempts=[]}={}){
 validateReport(baseline);validateReport(report);
 const verified=isVerified(report);
 return `<nav class="crumb" aria-label="当前位置"><a href="../../index.html">USEIT</a><span>/</span><a href="index.html">全品类测试</a><span>/</span><span>${esc(pageId)}</span></nav><header class="detail-title"><div><p class="eyebrow">CASE ${esc(pageId)} / 普通双面卡自动流程 · ${report?scopeLabel(report):'等待实测'}</p><h1>普通双面卡牌</h1><p class="sub">${esc(report?.test_date||'待复测')} · 北京时间 UTC+8 · 只核验画稿与装配保存</p></div></header>${nav(pageId,pageId,report)}${report?runtime(report):''}<div class="verdict"><span class="badge">${verified?'两面画稿保存已核验':report?'本轮仍需核验':'代码优化方案 · 等待真实测试'}</span><h2>${report?`${scopeLabel(report)}：Agent ${duration(report.agent_seconds)}，${count(report.model_calls)} 次主规划，${count(report.image_calls)} 次生图，${count(report.tool_errors)} 次工具失败。`:'把固定生产步骤交给代码，减少模型反复安排。'}</h2><p>${esc(report?.summary||'主模型负责理解需求和双面的创意；代码负责规格、并行生成、装配、查询与保存核验。目标不等于实测结果。')}</p>${report?`<p><strong>复测范围：</strong>${esc(scopeNote(report))}</p>`:''}</div>${report?`<section><h2>本轮真实输入</h2><blockquote>${esc(report.prompt)}</blockquote></section>`:''}<section><h2>${report?scopeLabel(report):'本轮'}与优化前基线</h2>${comparison(baseline,report)}${runtimeComparison(baseline,report)}<p class="method"><strong>${report?.test_scope==='integration'?'两次接入路径不同：本轮为集成复测，不能按正常聊天全链路直接比较。':'各次实测范围以原始记录为准。'}</strong>主题、提示词和服务响应也可能不同，时间差不能单独归因为某一项改动；画面质量请对照真实画稿。</p></section>${baselinePanel(baseline)}${changesPanel(report)}${imagesPanel(report)}${receiptPanel(report)}${stepsPanel(report)}${costsPanel(baseline,report)}${report?.automatic_workflow_completed?debugPanel(debugAttempts):''}${evidencePanel(baseline,report,evidenceUrl)}`;
}

function overviewResult(report){
 if(!isVerified(report))return '';
 return `<a class="optimized-result${report.tool_errors>0?' result-failed':''}" href="B07-R1.html"><strong>${duration(report.agent_seconds)}</strong><span>（${count(report.tool_errors)} 次失败）</span></a><small><strong>${scopeLabel(report)}</strong> · ${esc(report.test_date)} · ${count(report.model_calls)} 次主规划＋${count(report.image_calls)} 次生图</small><small>正反面画稿与保存已核验；三维未验收</small>${report.test_scope==='integration'?'<small>正常聊天完整链路尚未复测</small>':''}`;
}
function latestCard(report,category='普通双面卡牌'){
 if(!isVerified(report))return '';
 const image=report.images?.find(row=>row.face==='front');
 const cover=image&&safeHref(image.url)?`<img src="${safeHref(image.url)}" alt="${esc(image.alt||category+'正面画稿')}" loading="lazy" width="600" height="440">`:'';
 return `<article class="case-card case-card-verified" data-case="B07 ${esc(category)}"><a class="case-cover" href="B07-R1.html">${cover}<span>本轮二维画稿</span></a><div class="case-body"><p class="case-number">B07 / 自动流程${scopeLabel(report)} · ${esc(report.test_date)}</p><h2><a href="B07-R1.html"><span class="case-check" role="img" aria-label="画稿与装配已验证">√</span> ${esc(category)}</a></h2><p class="case-status status-verified">正反面画稿与保存已核验 · 三维未验收</p><p class="case-summary">${report.test_scope==='integration'?'独立服务与诊断入口的真实生图、装配保存已验证；正常聊天完整链路尚未复测。':'模型负责理解与创意；代码接续并行生图、批量装配、同任务查询和保存核验。'}${count(report.model_calls)} 次主规划、${count(report.image_calls)} 次生图；实际输入和结果单独记录。</p><div class="case-estimate"><span>${scopeLabel(report)} · Agent 实测</span><strong>${duration(report.agent_seconds)}</strong><small>${count(report.tool_errors)} 次工具失败；不使用扣减估算</small></div><div class="case-time"><span>参考费用（USD）</span><strong>${money(costValue(report))}</strong></div><div class="case-links"><a href="B07.html">原始测试 · 3 次错误 →</a><a href="B07-R1.html">${scopeLabel(report)} · 时间与画稿 →</a></div></div></article>`;
}
function homeNews(report){
 if(!isVerified(report))return '';
 return `<li><div class="home-news-meta"><time datetime="${esc(report.test_date)}">${esc(report.test_date?.slice(5).replace('-','.')||'待记录')}</time><span class="home-news-tag">双面卡优化</span></div><h3><a href="tests/2026-11-13/B07-R1.html">普通双面卡：自动流程${scopeLabel(report)} <span aria-hidden="true">↗</span></a></h3><p>${report.test_scope==='integration'?'真实生图、装配保存已验证；正常聊天完整链路尚未复测。':'正反面并行生成，装配与保存核验自动接续；原始失败记录保留。'}</p><p class="home-news-facts"><strong>${duration(report.agent_seconds)}</strong> · ${count(report.tool_errors)} 次工具失败<br>${count(report.model_calls)} 次主规划 · 参考费用 ${money(costValue(report))}</p></li>`;
}

module.exports={render,nav,isVerified,validateReport,overviewResult,latestCard,homeNews,scopeLabel,scopeNote,BASELINE_ROUNDS};
