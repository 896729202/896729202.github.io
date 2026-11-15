const modelCallAudit=require('../content/useit/model-call-audit-2026-11-14.json');
const fireRetest=require('../content/useit/placement-fire-2026-11-14.json');
const costEvidence=require('../content/useit/costs-2026-11-14.json');
const hasRewriteRetest=require('node:fs').existsSync(require('node:path').join(__dirname,'../content/useit/placement-rewrite-2026-11-14.json'));
const hasGtaRetest=require('node:fs').existsSync(require('node:path').join(__dirname,'../content/useit/placement-gta-2026-11-14.json'));
module.exports=function({esc,table,date,dur,sec,external,costPanel,runtimeUI,runtimes}){
 const names={'frame-a':'A 面','frame-b':'B 面',back:'背面'},ms=n=>sec(n/1000);
 const fix=`<div class="fix-summary"><h3>问题 → 原因 → 怎么解决</h3><p><strong>问题：</strong>后台报超时，前端还在执行；Agent 再次装配，造成重复操作。</p><p><strong>原因：</strong>后台约 120 秒停止等待并清理记录，前端没有随之停止；完成通知回来时已没有可接收它的等待记录。慢素材又让这个状态问题更容易触发。</p><ol><li><strong>继续跟踪原任务：</strong>超过 20 秒先返回任务编号，继续查询原任务，完成后取得保存结果。</li><li><strong>挡住重复装配：</strong>相同的运行中请求复用原任务，防止重复执行。</li><li><strong>三面并行准备：</strong>A 面、B 面、背面并行准备素材；写入同一画稿时依次保存，避免互相覆盖。</li></ol><p>素材慢的诱因单独调查：现有证据支持“等图片在本机完整就绪”，尚未证明历史低速究竟来自哪个网络或写入环节。新版本已增加分段计时。</p></div>`;
 function links(active=''){return require('./useit-navigation.cjs')(active);}
 function rewriteStatus(value){
  const labels={applied:'已应用整理结果',success:'整理返回成功',completed:'整理返回成功',rewritten:'已生成整理结果',timeout:'等待超时，回退原文',fallback_timeout:'等待超时，回退原文',failed:'整理失败，使用原文',fallback:'已回退原文',disabled:'未开启，使用原文',skipped:'跳过整理，使用原文',validated:'结构校验通过，仍需人工审阅'};
  return labels[value]||value||'未记录';
 }
 function visibleRewrite(rewritten){
  if(rewritten==null)return '<p>本次未取得可展示的整理结果；不能把回退当作改写成功。</p>';
  const body=typeof rewritten==='string'?rewritten:typeof rewritten.rewritten_prompt==='string'?rewritten.rewritten_prompt:'';
  const fields=typeof rewritten==='object'?Object.fromEntries(Object.entries(rewritten).filter(([key])=>key!=='rewritten_prompt')):{};
  return (body?`<p>${esc(body).replace(/\r?\n/g,'<br>')}</p>`:'<p>未记录可直接阅读的整理正文。</p>')+(Object.keys(fields).length?`<details><summary>查看原文引用与结构化校验字段</summary><pre>${esc(JSON.stringify(fields,null,2))}</pre></details>`:'');
 }
 function rewriteProbeSection(r){
  if(r.case!=='B10-R6'||!r.rewrite_probe)return '';
  const probe=r.rewrite_probe,attempts=Array.isArray(probe.attempts)?probe.attempts:[];
  const known=n=>typeof n==='number'&&Number.isFinite(n),notes=v=>Array.isArray(v)?v.map(String):typeof v==='string'&&v?[v]:[];
  const attemptLabel=(attempt,index)=>attempt.label||`第 ${attempt.attempt||index+1} 次文字测试`;
  const reviewResult=attempt=>attempt.manual_review?.status==='needs_revision'?'<strong>需修正／未采用</strong><small>'+esc(rewriteStatus(attempt.status))+'</small>':attempt.manual_review?.status==='usable_as_advisory_with_original_priority'?'<strong>可作辅助建议，原文优先</strong><small>未用于 R6</small>':esc(rewriteStatus(attempt.status));
  const rows=attempts.map((attempt,index)=>[
   esc(attemptLabel(attempt,index)),reviewResult(attempt),known(attempt.duration_ms)?ms(attempt.duration_ms):'未记录',known(attempt.reference_cost_usd)?'$'+attempt.reference_cost_usd.toFixed(6):'未记录，不按 $0 计',
   [...notes(attempt.error),...notes(attempt.manual_review?.issues),...notes(attempt.manual_review?.limitations),...notes(attempt.review_notes)].map(esc).join('<br>')||'尚未记录人工审阅意见'
  ]);
  const total=known(probe.total_duration_ms)||known(probe.total_reference_cost_usd)?`<p>独立文字测试合计：${known(probe.total_duration_ms)?ms(probe.total_duration_ms):'耗时未记录'}；参考费用 ${known(probe.total_reference_cost_usd)?'$'+probe.total_reference_cost_usd.toFixed(6):'未记录'}，不是供应商账单。</p>`:'';
  return `<section id="rewrite-probe"><div class="section-heading"><p class="eyebrow">R6 之后 / 独立文字测试</p><h2>整理器另测了什么？</h2></div><p><strong>以下只测试文字整理，不生图，也没有把结果应用到原 R6。</strong>这些试次的耗时和参考费用均不计入 R6 原来的 ${dur(r.agent_seconds)} 与任务总费用；原 R6 等待 2.838 秒后回退、未应用改写的记录保留。</p>${attempts.length?table(['文字试次','记录结果','独立耗时','独立参考费用 USD','失败或人工审阅问题'],rows):'<p>文字试次明细尚未记录。</p>'}${total}<p>首次失败或需修正的候选与后续结果分别保留，返回成功或结构校验通过不等于人工审阅通过。R6 当时的候选未保存，这些新文本不能反推它回退的具体原因。</p>${notes(probe.review_notes).map(note=>'<p>'+esc(note)+'</p>').join('')}${attempts.map((attempt,index)=>{const brief=attempt.brief||attempt.rewritten||{},body=attempt.rewritten_prompt;return `<details><summary>${esc(attemptLabel(attempt,index))}：查看可见正文与人工审阅</summary>${visibleRewrite(body?{...brief,rewritten_prompt:body}:brief)}${['preserved','improvements','issues','limitations'].map(key=>{const labels={preserved:'保留的原意',improvements:'更清楚的表达',issues:'需修正的问题',limitations:'仍需保留的边界'},items=notes(attempt.manual_review?.[key]);return items.length?'<p><strong>'+labels[key]+'</strong></p><ul>'+items.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul>':'';}).join('')}</details>`;}).join('')}</section>`;
 }
 function history(){
  return `<section id="improvement-history"><div class="section-heading"><p class="eyebrow">改进历程 / 统一看 Agent 执行时间</p><h2>问题怎样一步步改进？</h2></div>${table(['阶段','Agent 执行','这一步做了什么'],[
   ['<a href="B10-R1.html">R1 发现问题</a>',dur(900.7),'发现装配超时后前端仍继续保存，重复调用与慢素材拖长了流程。'],
   ['<a href="B10-R2.html">R2 修复</a> → <a href="B10-R3.html">R3 新素材复测</a>',dur(314.63)+' → '+dur(296.46),'补上任务追踪、防重复与素材并行准备，再用新主题、新素材确认修复后的表现。'],
   ['<a href="B10-R4.html">R4 同轮与并发</a>',dur(251.05),'把清单更新和实际动作放在同轮，独立的 A 面与背面并发生图。'],
   ['<a href="B10-R5.html">R5 自然语言调度</a>',dur(261.6),'用户只写短需求，由代码安排图片依赖；实测 7 轮模型请求，生图等待 '+ms(58718)+'。'],
   ...(hasRewriteRetest?[[ '<a href="B10-R6.html#prompt-rewrite">R6 提示词整理实验</a>',dur(226.86),'整理等待 2.838 秒后回退，改写未应用；本轮另有单面范围修复，模型等待也有波动。' ]]:[]),
   ...(hasGtaRetest?[[ '<a href="B10-R7.html#run-findings">R7 GTA6 主题复测</a>',dur(310.03)+'（两轮合计）','改写已应用，但多问一次确认、装配退回三次单面保存；墙钟 '+dur(423.233)+'，不能声称这轮更快。' ]]:[])
  ])}<p>以上统一使用 Agent 执行口径；R1 从提交到结束另为约 ${dur(912.476)}。历史的长素材等待未复现，速度提升不能全归功于代码；R1 还尝试了三维，新轮只做生图与装配，不能当作严格同条件的“约 70% 提速”。</p><p class="sub">${hasRewriteRetest?'<strong>画稿边界：</strong>R5 背面拼版保留为历史问题；R6 本次背面未见拼版，但改写回退未应用，画面改善不能归功于改写，结果也不倒填前轮。':'<strong>仍待完成：</strong>R5 背面出现多余人物拼版，需修改后再验收；R6 提示词整理实验准备中，尚无结果。'}</p></section>`;
 }
 function runFindingsSection(r){
  if(r.case!=='B10-R7')return '';
  return `<section id="run-findings"><h2>这轮哪里退步，接下来怎么改？</h2><p><strong>问题：</strong>原文已要求用默认规格做完，首轮仍停下来要确认；续做后才生图，装配又分成 A、B、背面三次。虽然没有 ERROR 观测，这两个流程问题仍然存在。</p><p><strong>原因：</strong>确认要求与直接执行的需求冲突，批量装配也尚未成为代码强制的默认路径。优先修正确认冲突、减少重复规划，并让三面齐备后自动走批量；首轮有真实规划工作，不能承诺删掉确认就省下整轮 151.350 秒。</p><p><strong>进一步方案，尚未实现或测出节省：</strong>三面素材准备齐后，一次写母版、一次保存与版本记录、一次更新三维。当前三次独立保存会更新纹理，已挂载的三维预览可能重复重建；现有引擎已支持 A/B/背面，无须为此先引入 Remotion。本轮没有三维测试，装配回调耗时不是纯三维耗时。</p></section>`;
 }
 function rewriteExperimentSection(r,timingEvidence){
  if(!['B10-R6','B10-R7'].includes(r.case))return '';
  const rewrite=r.prompt_rewrite||{},known=n=>typeof n==='number'&&Number.isFinite(n);
  const wait=known(rewrite.duration_ms)?ms(rewrite.duration_ms):'未记录';
  const fee=known(rewrite.reference_cost_usd)?'$'+rewrite.reference_cost_usd.toFixed(6):'未记录，不能按 $0 计算';
  const status=rewrite.applied_to_planner===true?'已应用整理结果':rewriteStatus(rewrite.status);
  const enabled=rewrite.enabled===true||rewrite.applied_to_planner===true?'本轮开启':rewrite.enabled===false?'本轮未开启':'启用状态未记录';
  const totalMs=timingEvidence?.local_total_ms??(known(r.agent_seconds)?r.agent_seconds*1000:null);
  const included=rewrite.included_in_agent_seconds===true?'整理等待已计入本轮 Agent 总时间，不要再加一次。':rewrite.included_in_agent_seconds===false?'整理等待发生在 Agent 计时之外，不能冒充 Agent 内部耗时。':'整理等待与 Agent 总计的包含关系尚未单独记录，暂不相加。';
  const feeNote=known(rewrite.reference_cost_usd)?'整理步骤参考费已包含在本次任务总参考费用内，不能再相加。':'整理步骤用量或计价尚未完整记录；费用未知不能补成零，任务总费用的完整性见费用区。';
  const brief=visibleRewrite(rewrite.rewritten??rewrite.brief);
  const scope=r.case==='B10-R6'?'本轮还包含每次只输出当前单面画稿的范围约束修复，模型服务和生图速度也会波动；不是严格只改一个变量的实验。':'本轮更换了图片主题，整理器版本及模型服务、生图速度也可能影响结果；不能把不同主题的总时间差当成改写带来的净收益。';
  return `<section id="prompt-rewrite"><div class="section-heading"><p class="eyebrow">${esc(r.case)} / 后台提示词整理实验</p><h2>整理提示词，直接多花了多少时间？</h2></div><p>本轮主题：${esc(r.theme||'以用户原话为准')}。</p><p><strong>直接新增等待：${wait}；整理步骤参考费用：${fee}。</strong>${included}</p><p>${feeNote}</p>${table(['本轮状态','整理模型'],[[esc(enabled+' · '+status),esc(rewrite.model||'未记录')]])}<p>用户原话仍完整保留，共 ${[...String(r.prompt||'')].length} 字符：</p><blockquote><p>${esc(r.prompt).replace(/\r?\n/g,'<br>')}</p></blockquote><p>功能默认关闭；原文保留且优先。开启实验后最多等待 10 秒，超时或整理失败就回退原文继续执行；回退仍产生等待，不能算“整理已应用”。</p>${table(['整次 Agent 执行','实测用时'],[
   ['<a href="B10-R5.html">R5：原短提示词</a>',dur(261.6)+'（261.600 秒）'],
   [esc(r.case.replace('B10-','')+'：提示词整理实验'),known(totalMs)?dur(totalMs/1000)+'（'+ms(totalMs)+'）':'尚未取得完整记录']
  ])}<p><strong>${esc(r.case.replace('B10-',''))} 总时间与 R5 的差值，不能全部归因于提示词整理。</strong>${scope}</p><p>R5 第 3 轮模型请求用了 <strong>90.313 秒</strong>，随后成功创建清单和制品规格，这段真实等待继续保留。日志尚不能区分其中的模型处理、排队和网络时间，不能把它全说成“理解太慢”，也不能当作报错重试扣掉。</p><details><summary>查看整理后的可见中文正文</summary><p>以下先显示后台整理后的任务正文，原文引用及校验字段另行折叠；不包含模型隐藏推理，是否实际采用以上方状态为准。</p>${brief}</details></section>`;
 }
 function speedComparisonSection(r,timingEvidence){
  if(!['B10-R4','B10-R5'].includes(r.case))return '';
  const natural=r.case==='B10-R5';
  const before=runtimes.cases.find(x=>x.case==='B10-R3');
  const item=(e,key)=>e?.items.find(x=>x.key===key);
  const known=n=>typeof n==='number'&&Number.isFinite(n);
  const duration=n=>known(n)?ms(n):'尚未取得完整记录';
  const total=n=>known(n)?dur(n/1000)+'<small>（'+ms(n)+'）</small>':'尚未取得完整记录';
  const money=n=>known(n)?'$'+n.toFixed(4):'记录不完整';
  const cost=id=>costEvidence.cases.find(x=>x.case===id)?.reference_total_usd;
  const change=(a,b,unit='秒')=>!known(a)||!known(b)?'待完整数据核对':a===b?'相同':(b<a?'减少 ':'增加 ')+Math.abs(b-a).toFixed(3)+' '+unit;
  const timeChange=(a,b)=>change(known(a)?a/1000:a,known(b)?b/1000:b);
  const earlierPlan=item(before,'planning'),laterPlan=item(timingEvidence,'planning');
  // The runtime evidence owns overlap removal. Never add generation_steps here.
  const earlierImages=before?.generation_critical_path_ms??item(before,'generation')?.milliseconds;
  const laterImages=timingEvidence?.generation_critical_path_ms??item(timingEvidence,'generation')?.milliseconds;
  const samePrompt=typeof r.prompt==='string'&&r.prompt.trim()===fireRetest.prompt.trim();
  const rows=[
   ['Agent 本地执行总时间',total(before?.local_total_ms),total(timingEvidence?.local_total_ms),timeChange(before?.local_total_ms,timingEvidence?.local_total_ms)],
   ['模型请求次数',known(earlierPlan?.count)?earlierPlan.count+' 次':'记录不完整',known(laterPlan?.count)?laterPlan.count+' 次':'记录不完整',natural?'多图依赖交给代码执行，无需模型逐张安排':'清单更新与实际动作同轮提交，减少单独往返'],
   ['模型请求与等待',duration(earlierPlan?.milliseconds),duration(laterPlan?.milliseconds),timeChange(earlierPlan?.milliseconds,laterPlan?.milliseconds)],
   ['图片生成关键路径',duration(earlierImages)+'<small>三次串行</small>',duration(laterImages)+'<small>按实际重叠去重</small>','并行时间不能把 A、B、背面三次时长直接相加'],
   ['装配与保存（前端整批）',duration(fireRetest.batch_ms),duration(r.batch_ms),timeChange(fireRetest.batch_ms,r.batch_ms)],
   ['参考费用 USD',money(cost('B10-R3')),money(cost(r.case)),change(cost('B10-R3'),cost(r.case),'美元')]
  ];
  const intro=natural?`<p><strong>用户只说需要什么画面，生成顺序由程序安排。</strong>本次短提示词没有工具名、参数字段或并行要求。下面是提交的完整原话：</p><blockquote><p>${esc(r.prompt).replace(/\r?\n/g,'<br>')}</p></blockquote><p>代码同时启动 A 面与背面；A 图生成并保存为可用素材后，立即以它为参考制作 B 面，不等背面结束。缺图或保存失败会保留失败结果，不会将三张标为全部完成。</p>`:`<p><strong>${samePrompt?'沿用 R3 的同一份长技术提示词、同一模型，另建新项目并重新生成图片。':'这是长技术提示词下的对照实验；提示词原文见下方版本区。'}</strong>R4 将清单更新与实际动作放在同轮，独立的 A 面与背面并发；B 面拿到本次新 A 图后再生成。</p>`;
  const scope=natural?`<p><strong>R5 是普通用户表达方式的验收，不是严格只改变一个变量的速度实验。</strong>它同时更换为短自然语言并使用代码安排多图依赖，不能把与 R3 的全部时间差归因于某一个改动。<a href="B10-R4.html#speed-comparison">查看相同长提示词的 R4 技术对照</a>。</p>`:`<p><strong>R4 是技术条件对照，还不是普通用户验收。</strong>长提示词包含操作要求，不能据此声称用户只说一句自然语言，系统就已默认正确并行。短自然语言配合代码自动处理图片依赖的验收，见<a href="B10-R5.html#speed-comparison">独立 R5 记录</a>。</p>`;
  return `<section id="speed-comparison"><div class="section-heading"><p class="eyebrow">B10-R3 → ${esc(r.case)} / ${natural?'自然语言验收':'技术对照'}</p><h2>${natural?'自然语言下单，代码负责安排顺序':'这次提速，具体省在了哪里？'}</h2></div>${intro}${table(['对照项',natural?'R3 长技术提示词':'R3 修改前',natural?'R5 自然语言':'R4 修改后','怎样理解'],rows)}<p>图片生成一行采用运行记录中去除重叠后的实际等待时长，不是把三次调用相加，也不是将 R3 的理论 68.2 秒当作本次结果。装配一行只计前端整批操作；上方时间图中的装配还包含 Agent 与前端通信等待，范围不同。</p><p><strong>两轮各只有一个样本，变化不是以后每次都能达到的保证。</strong>网络、模型服务和生图排队也会影响结果；参考美元按记录用量和配置费率核算，并非实际账单。</p>${scope}</section>`;
 }
 function modelAuditSection(r,timingEvidence){
  if(r.case!=='B10-R3')return '';
  const audit=modelCallAudit;
  const checklist=audit.calls.filter(call=>call.pure_checklist);
  const combine={
   1:'可省去单独查工具这一步，直接加载已经知道的工具包。',
   2:'保留加载；可与路径已知的资料读取放在同次模型响应。',
   3:'这次已合并读取两份资料。',
   4:'确认规格路径后再读；路径已知时可提前合读。',
   5:'与下一步创建制品合并。',
   6:'与首次清单更新同轮完成。',
   7:'与 A 面、背面生图请求合并。',
   8:'A 面与不依赖它的背面一起开始。',
   9:'与下一步 B 面编辑请求合并。',
   10:'保留 A → B 的依赖，先拿到本次新 A 图。',
   11:'背面提前开始后，无需为这项状态更新单独请求模型。',
   12:'提前与 A 面一起开始。',
   13:'与三面批量装配请求合并。',
   14:'保留批量装配；同一画稿的保存仍需依次进行。',
   15:'与保存检查请求合并。',
   16:'保留实际检查，确认三面已经保存。',
   17:'与最后的结果回复合并。',
   18:'与最后一次清单更新同轮完成。',
  };
  const rows=audit.calls.map(call=>[
   String(call.step).padStart(2,'0'),ms(call.model_ms),
   esc(call.observable_action)+(call.pure_checklist?'<small class="badge">仅更新清单</small>':''),
   esc(combine[call.step]||call.optimization),esc(call.dependency)
  ]);
  const steps=timingEvidence.generation_steps;
  const a=steps.find(step=>step.face==='frame-a').milliseconds;
  const b=steps.find(step=>step.face==='frame-b').milliseconds;
  const back=steps.find(step=>step.face==='back').milliseconds;
  const serial=a+b+back,parallel=Math.max(a+b,back);
  return `<section id="model-call-audit"><div class="section-heading"><p class="eyebrow">B10-R3 / 模型请求与等待</p><h2>${audit.calls.length} 次模型请求，${ms(audit.total_model_ms)} 在做什么？</h2></div><p><strong>其中 ${checklist.length} 次只是创建或更新进度清单，共 ${ms(audit.checklist_model_ms)}，占模型请求时间的 ${(audit.checklist_model_ms/audit.total_model_ms*100).toFixed(1)}%。</strong>清单工具本身执行合计只有 ${ms(audit.checklist_execution_ms)}；主要耗时来自为这些清单操作单独发起的模型请求。</p><p>这里的“模型请求与等待”包含输入处理、生成操作参数或答复，以及等待模型服务响应。现有日志不能分开供应商内部计算、排队和网络各占多少，不能把这 ${ms(audit.total_model_ms)} 全称为“思考”。下表按模型随后提交的可观察动作说明用途。</p>${table(['轮次','模型请求与等待','这轮实际做了什么','减少往返的建议','先等什么结果'],rows)}<p>表中 18 行模型时长合计 ${ms(audit.total_model_ms)}，已经计入上方的 Agent 本地执行时间；生图、装配和核验工具自身的执行时间另外分类，不能再加进这列。合并清单是改进建议，不代表优化后一定能原样省下 ${ms(audit.checklist_model_ms)}。</p><div class="fix-summary"><h3>A、B、背面应该怎样并行？</h3><p><strong>A 面和背面可以同时开始；B 面必须等这次新 A 图完成。</strong>B 面要沿用 A 面的人物构图，再把营寨改为火光背景，因此本次三张图并非完全独立。</p>${table(['建议的开始顺序','A → B 这一路','背面这一路'],[
   ['第一批同时开始','生成 A 面：'+ms(a),'生成背面：'+ms(back)],
   ['A 面返回后','用新 A 图编辑 B 面：'+ms(b),'背面完成后，等待其余图片就绪'],
   ['三张图均就绪','共同进入三面批量装配','同一画稿依次保存，保留结果核验']
  ])}<p>只按 R3 已测出的三次生图时长重新排布：串行合计约 <strong>${(serial/1000).toFixed(1)} 秒</strong>；两路同时开始，需等待的较长一路为 A + B，理论上约 <strong>${(parallel/1000).toFixed(1)} 秒</strong>（${ms(a)} + ${ms(b)}；背面为 ${ms(back)}）。</p><p><strong>这只是理论排布，不是并行实测，也不是完整任务用时预测。</strong>它假设并发后各次生图仍与 R3 一样快，没有计入中间模型请求及并发可能带来的排队变化。实际效果以 R4 的独立复测记录为准。</p></div><details><summary>查看审计来源与范围</summary><p>来源为 B10-R3 本地运行日志中的 18 次模型请求持续时间，以及对应工具调用名称、参数和回执。按记录的 <code>duration_ms</code> 汇总；部分开始时间为事后补记，因此不把这些时间戳拼成精确时间线。</p><p>只公开可观察动作与计时，不包含模型隐藏推理。审计数据保留原始工具调用编号，供需要时回查。</p><p><a href="../../../content/useit/model-call-audit-2026-11-14.json" download>下载 B10-R3 模型请求审计数据 JSON ↓</a></p></details></section>`;
 }
 function render(r){
  const timingEvidence=runtimes.cases.find(x=>x.case===r.case);
  const serial=r.placement_mode==='serial';
  const placementExecutionMs=serial?(r.placement_execution_ms??r.batch_ms):r.batch_ms;
  const placementCallbackMs=timingEvidence?.items.find(item=>item.key==='placement')?.milliseconds;
  const isSpeed=r.case==='B10-R4',isRewrite=['B10-R6','B10-R7'].includes(r.case),isNatural=r.case==='B10-R5'||isRewrite,isFire=['B10-R3','B10-R4','B10-R5','B10-R6'].includes(r.case);
  const fireDescriptions={'frame-a':'生成第一幅画稿：诸葛亮持羽扇，背景为营寨，作为变图前的 A 面。','frame-b':'以本次新生成的 A 图为参考，保留人物构图，将远景营寨改为火光背景，制作变图后的 B 面。',back:'生成背面画稿，内容为羽扇、阵图和“火烧连营”题名。'};
  const neutralDescriptions={'frame-a':'按本次用户需求生成 A 面画稿，等待图片生成并保存为可用素材。','frame-b':'以本次新 A 图为参考编辑 B 面，保留约定的主体构图，并完成用户要求的画面变化。',back:'按本次用户需求生成独立背面画稿，等待图片生成并保存为可用素材。'};
  const notes=Object.fromEntries((timingEvidence?.generation_steps||[]).map(step=>{
   const supplied=r.face_descriptions?.[step.face]??r.face_descriptions?.[String(step.face).replace('-','_')];
   const description=typeof supplied==='string'?supplied:supplied?.description|| (isFire?fireDescriptions[step.face]:r.case==='B10-R2'?`为光栅卡${names[step.face]}制作“黄仁勋参加华为面试”主题画稿，等待图片服务返回可装配的素材。`:neutralDescriptions[step.face]);
   return [step.observation_id||step.note_key||step.tool_call_id,{title:supplied?.title||step.title,description}];
  }).filter(([key])=>key));
  if(isNatural)for(const job of r.langfuse.observations.filter(o=>o.name==='stage.product_image_job')){
   const parent=r.langfuse.observations.find(o=>o.id===job.parentObservationId);
   if(parent?.name==='tool.tool_product_image_gen')notes[parent.id]={title:'一次生成整套三面画稿',description:'代码同时开始 A 面与背面；A 素材保存成功后自动编辑 B 面。这里是整套任务总计，包含下方各面的生成与保存。'};
  }
  for(const observation of r.langfuse.observations.filter(o=>o.name==='stage.product_image_request')){
   const parent=r.langfuse.observations.find(o=>o.id===observation.parentObservationId),note=parent&&(notes[parent.id]||notes[parent.tool_call_id]);
   if(note)notes[observation.id]={title:note.title+'：服务请求',description:'这是“'+note.title+'”内部等待生图服务的一段时间，已经包含在上层生图耗时中，不再相加。'};
  }
  const reads=[...r.langfuse.observations].filter(o=>o.name==='tool.read').sort((a,b)=>a.startTime.localeCompare(b.startTime));
  if(reads.length===2){notes[reads[0].id]={title:'读取制品设计操作说明',description:'读取实体制品设计的操作规范，了解接下来如何制作光栅卡。'};notes[reads[1].id]={title:'读取光栅卡规格与三面要求',description:'查看光栅卡尺寸、工艺，以及 A 面、B 面和背面的制作要求。'};}
  const trace=r.langfuse_url.split('/sessions/')[0]+'/traces/'+r.langfuse.traces[0].id;
  const completed=r.batch_status==='completed'&&r.placements.length===3&&Object.keys(names).every(face=>r.placements.some(p=>p.face===face&&p.success))&&r.placements.every(p=>p.success);
  const images=`<div class="gallery">${r.images.map(im=>`<figure><a href="${esc(im.src)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.caption)}" loading="lazy" width="1104" height="1504"></a><figcaption>${esc(im.caption)}</figcaption></figure>`).join('')}</div>`;
  const review=r.visual_review;
  const visualReview=review?`<div class="fix-summary"><h3>二维画稿目视检查</h3><p>${esc(typeof review==='string'?review:review.summary||'')}</p>${Array.isArray(review.notes)?'<ul>'+review.notes.map(note=>'<li>'+esc(note)+'</li>').join('')+'</ul>':typeof review.notes==='string'?'<p>'+esc(review.notes)+'</p>':''}</div>`:'';
  const sourceRows=r.placements.map(p=>[names[p.face]||esc(p.face),ms(p.receipt.timing.stages.load_source),ms(p.receipt.timing.stages.write_queue),ms(serial?(r.placement_task_flow?.find(task=>task.face===p.face)?.elapsed_ms??p.receipt.timing.total_ms):p.receipt.timing.total_ms)]);
  const downloadRows=r.downloads.map(d=>[names[d.face]||esc(d.face||'素材'),ms(d.headers_ms),ms(d.body_wait_ms),ms(d.disk_backpressure_ms),ms(d.commit_ms),ms(d.total_ms)]);
  let original='';
  if(r.original_file_evidence){
   const network=r.same_file_network_comparison.results,warm=r.warm_source_probe.results;
   original=`<h3>旧素材的对照调查</h3>${table(['原素材','旧文件创建至最后写入','完整缓存读取','重下原文件：直连 / 代理'],r.original_file_evidence.map((f,i)=>[names[r.placements[i].face],sec(f.creation_to_last_write_seconds),ms(warm[i].timing.total_ms),ms(network.find(x=>x.face===f.face&&x.transport==='node-fetch-direct').total_ms)+' / '+ms(network.find(x=>x.face===f.face&&x.transport==='system-proxy').total_ms)]))}<p>同一批旧图约 2.5 MB，直连与代理下载的哈希一致。文件时间戳支持“当时主要在等本机文件到齐”，但不是网络计时，不能区分当时网络停顿与写入背压。今天原文件下载约 1.6–1.8 秒，历史异常没有复现。</p>`;
  }
  const verification=r.post_run_verification;
  const agentInspection=verification?.agent_called_inspect===true?'本轮 Agent 已在自身流程中调用检查工具；下方记录是运行结束后的额外核验。':verification?.agent_called_inspect===false?'本轮 Agent 没有单独调用检查工具。':'本轮 Agent 是否单独调用检查工具，当前核验记录未说明。';
  const independentVerification=verification?`<section id="independent-verification"><h2>运行结束后的独立只读核验</h2><p><strong>${agentInspection}</strong>于 ${date(verification.observed_at)} 另行读取已保存母版，${verification.success===false?'本次独立核验未取得成功回执':`确认 ${r.saved_image_count} 张图片、${r.saved_placement_count} 条装配记录`}。额外核验耗时 ${ms(verification.duration_ms)}，不计入 Agent 的 ${dur(r.agent_seconds)}，也不冒充原调用链中的步骤。</p><p>这份额外检查不能代替对 Agent 实际检查动作的记录。二维目视结果见画稿区，三维与印刷未验收。</p></section>`:'';
  const taskFlow=(!serial&&r.placement_task_flow?.length>1)?`<h3>长任务没有重新装配</h3>${table(['操作','原任务状态','从任务启动起累计时间'],r.placement_task_flow.map(x=>[x.action==='canvas_product_add_batch'?'一次提交三面装配':'查询同一任务',x.status==='running'?'仍在执行':'已完成',ms(x.elapsed_ms)]))}<p>只有一次装配提交，后面复用原任务编号查询；上表是累计时间，不能相加。没有因为超过首次等待窗口就重做。</p>`:'';
  const rewriteNotice=r.prompt_rewrite?.status==='fallback'?`<p><strong>辅助改写有一次校验回退：</strong>本轮等待 ${Number.isFinite(r.prompt_rewrite.duration_ms)?ms(r.prompt_rewrite.duration_ms):'时间未记录'}后继续使用原文，没有采用改写建议。${r.case==='B10-R6'?'具体拒绝分支未保留，不能据此猜测原因；文字单测另列。':'具体原因以本轮改写回执为准。'}</p>`:'';
  const version=r.implementation_version;
  const versionFix=serial?'<p><strong>本轮实际走了三次单面装配，未采用已有批量装配入口。</strong>生图的 A／背面并发与装配是两件事，不能据此说三面的装配素材也并行读取。</p>':fix;
  const placementSummary=serial?`本次分别调用 ${r.placement_call_count} 次单面装配，依次读取并保存 A 面、B 面、背面。前端任务累计 ${ms(placementExecutionMs)}；Agent 等待装配回调累计 ${ms(placementCallbackMs)}。Langfuse 三条工具记录合计 ${ms(r.placement_tool_ms??r.batch_tool_ms)}，起止边界略有差异，不重复相加。`:`三面的素材准备并行启动，写入同一个母版时依次保存。上表时间相互重叠，不能相加。前端整批 ${ms(r.batch_ms)}；${r.batch_call_count>1?'装配与状态查询的工具等待合计':'Langfuse 工具含通信等外围等待为'} ${ms(r.batch_tool_ms)}${r.batch_call_count>1?'，不含两次调用之间的模型请求时间':''}。`;
  const generationSummary=isNatural?'生图由代码安排：A 面与背面同时开始；A 素材保存成功就立即启动 B 面，不等背面。三面生图有重叠，不能直接相加。':isSpeed?'生图阶段 A 面与背面并发，B 面在本次新 A 图完成后再生成；三次生图调用有重叠，耗时不能相加。':'生图仍由 Agent 分次调用。';
  const speedVersion=isSpeed?`<div class="fix-summary"><h3>R4 额外改了什么，怎样验证？</h3><ol><li><strong>清单和动作一起提交：</strong>更新“做到哪一步”时，同轮提交实际操作，减少只改进度就单独请求一次模型。</li><li><strong>按图片依赖安排并发：</strong>独立的 A 面与背面同时生成；B 面需要参考本次新 A 图，必须等 A 完成。三图就绪后，三面并行准备装配素材，同一画稿仍依次保存。</li><li><strong>每份素材的保存失败单独保留：</strong>原来按产品归属记失败，一张图成功可能清掉同产品另一张图的失败。现在按素材和原图／预览图分别记录，只有同一素材、同一用途重试成功才清除对应失败。</li></ol><p>第三项已通过“同批中有的成功、有的失败”的模拟回归测试。本次 R4 成功样本不能代替失败场景的验证，生图提速也不代表所有素材一定保存成功。</p><p>本轮仍使用长技术提示词做同条件对照；普通用户短提示词下的默认调度能力，需单独验收。</p></div>`:'';
  const naturalVersion=isNatural?`<div class="fix-summary"><h3>${isRewrite?esc(r.case.replace('B10-',''))+' 沿用代码安排图片依赖':'R5：把生成顺序写进代码'}</h3><p>用户提交自然语言需求，Agent 整理画面内容后交给程序；不需要用户填写工具名、字段或“请并行”的操作要求。</p><ol><li><strong>A 面与背面固定并行：</strong>多图任务进入后，代码同时启动这两份不相互依赖的画稿。</li><li><strong>B 面只等 A：</strong>A 图生成并保存为可用素材后，立即启动基于 A 的 B 面编辑。即使背面还未完成，也不阻塞 B。</li><li><strong>失败如实保留：</strong>A 未成功保存时不会继续假装能编辑 B；任何一面生成或保存失败，都不能回报三张全部完成。</li><li><strong>生图与装配分开确认：</strong>三份素材就绪后再装入产品画稿，同一画稿仍依次保存，并检查最终三面记录。</li></ol><p>这轮验收关注普通用户表达能否走通，以及默认依赖安排是否执行。耗时与费用按本次实测记录，不能把它与长技术提示词的时间差当作单项代码改动的净收益。</p><details><summary>开发者定位</summary><p>多图调度入口为 <code>artwork_set</code>；A 面和背面并发，B 面依赖新 A 素材保存成功。用户提示词不需要出现这个入口名。</p></details></div>`:'';
  const versionHTML=version?`<section id="version"><h2>本次测试的修改版本</h2><p>${esc(version.label)} · 应用基础版本 ${esc(version.app_version)} · 本机修改版，非已发布安装包。</p><p>前端基础提交 <code>${esc(version.frontend_base_commit)}</code>；具体修改文件的 SHA-256 指纹保存在下方证据数据中。${esc(r.version_note||'')}</p>${versionFix}${speedVersion}${serial?'':naturalVersion}<details><summary>查看本次完整测试提示词</summary><p>${esc(r.prompt)}</p></details></section>`:'';
  const errorSummary=r.failure_observations.length?table(['位置','开始时间','错误原因'],r.failure_observations.map(o=>[esc(o.name),date(o.startTime),esc(o.statusMessage||'回执未提供底层原因')])):completed?'<div class="empty">本次没有 ERROR 观测或失败装配回执。三面分别保存，最终有 3 张图片和 3 条装配记录。</div>':'<div class="empty">当前证据未确认三面全部保存成功，不能标记整批完成；请以本次回执和结果记录为准。</div>';
  const batchTimingSummary=Number.isFinite(placementExecutionMs)?`本次${serial?'三次前端任务累计':'前端整批装配用时'} ${ms(placementExecutionMs)}；`:'';
  const longTaskNote=serial?'本轮没有批量调用或同任务轮询，三次单面保存回执分别保留。':'长任务查询路径另有模拟 200 秒执行、130 秒重复请求只执行一次、完成后取得原回执的回归测试。任务记录保存在当前应用会话，保留 30 分钟；应用重启后应先核查已保存画稿。';
  return `<nav class="crumb"><a href="../../index.html">USEIT</a><span>/</span><a href="index.html">全品类测试</a><span>/</span>${esc(r.case)}</nav><div class="detail-title"><div><p class="eyebrow">${esc(r.case)} / 修改后独立复测 / ${esc(r.test_date)}</p><h1>${esc(r.theme||'光栅卡装配修复')}</h1><p class="sub">光栅变图卡 · A 面 / B 面 / 背面 · ${date(r.sent_at)}</p></div>${external(r.langfuse_url,'打开 Langfuse 会话')}</div>${links(r.case)}${runtimeUI.breakdown(r.case,r)}${runFindingsSection(r)}${rewriteExperimentSection(r,timingEvidence)}${rewriteProbeSection(r)}${history()}${speedComparisonSection(r,timingEvidence)}${modelAuditSection(r,timingEvidence)}<div class="verdict"><span class="badge">${completed?'三面装配已验证':'本次未全部通过'}</span><h2>${completed?(serial?'三次单面调用，分别保存 A 面、B 面与背面。':'三面共 '+ms(r.batch_ms)+'，保存 3 次，没有重复装配。'):'详见下方结果与错误记录。'}</h2><p>${esc(r.conclusion||'本次仅验证画稿生成与装配，不包含三维渲染；完整缓存、下载与前端操作采用不同计时范围。')}</p></div><div class="metrics"><div><small>提交至完成</small><strong>${dur(r.submitted_to_local_completion_seconds)}</strong></div><div><small>Agent 本地执行</small><strong>${dur(r.agent_seconds)}</strong></div><div><small>${serial?'三次前端任务累计':'前端整批装配'}</small><strong>${(placementExecutionMs/1000).toFixed(3)}<em> 秒</em></strong></div><div><small>参考费用 USD</small><strong>${r.cost_label}</strong></div></div><nav class="jump"><a href="#runtime-overview">总时间去向</a>${isRewrite?'<a href="#prompt-rewrite">提示词整理实验</a>':''}${r.rewrite_probe?'<a href="#rewrite-probe">独立文字测试</a>':''}<a href="#version">修改版本</a><a href="#images">实际画稿</a><a href="#timing">耗时与素材调查</a><a href="#cost">费用</a><a href="#errors">报错记录</a><a href="#chain">调用链</a></nav>${versionHTML}<section id="images"><h2>01 / 实际生成并装配的画稿</h2>${images}${visualReview}<p>二维画稿证据；不能据此声称 A/B 变图效果或三维已验收。</p></section><section id="timing"><h2>02 / 耗时与素材加载</h2><p>${date(r.sent_at)} → ${date(r.completed_at)}。${r.failure_observations.length===0&&completed?'<strong>生图与装配未见失败调用，实测流程约 '+dur(r.submitted_to_local_completion_seconds)+'，无需扣除重试时间。</strong>':''}范围为生图与装配，不含三维；这是单次样本，不是所有任务的固定预测。终止记录精度为秒。</p>${table(['面片','素材准备','等待同一画稿保存',serial?'该面前端任务耗时':'该面从开始至完成（含排队）'],sourceRows)}<p>${placementSummary}${generationSummary}</p>${taskFlow}<h3>新图片下载分段</h3>${table(['素材','等响应头','接收数据等待','写入背压','提交文件','下载总计'],downloadRows)}<p>只统计本次新生成素材的下载，按文件字节数与本次回执关联。主机读取可能包含缺失文件的云端下载，因此 <code>source_host_read</code> 不能全部当成磁盘时间；R2 的旧字段名为 <code>source_disk_read</code>。下载、素材准备和整次操作的起点不同，不应相减或重复相加。</p>${original}<p>${esc(r.download_conclusion||'新图下载也没有复现旧的两三分钟等待。当前速度变化同时受网络、缓存和工作流影响，不能全部归功于代码修改。')}</p></section>${independentVerification}${costPanel(r.case)}<section id="errors"><h2>03 / 本次错误记录</h2>${errorSummary}${rewriteNotice}<p>${batchTimingSummary}${longTaskNote}</p></section><section id="chain"><h2>04 / Langfuse 与脱敏证据</h2><p>${external(r.langfuse_url,'Session')} · ${external(trace,'Trace')} · ${r.observations} 条 Observation。Langfuse 需要项目权限，以下记录可直接查阅。</p><details class="readable-trace-details"><summary>展开 ${r.observations} 条步骤与中文说明</summary>${runtimeUI.chain(r.langfuse.observations,{notes,baseUrl:r.langfuse_url.split('/sessions/')[0]})}</details>${isSpeed||isNatural?`<p><a href="../../../content/useit/${esc(r.case)}-runtime-audit.json" download>下载逐轮动作与并发审计 ↓</a></p>`:""}<p><a href="evidence/${esc(r.case)}-placement.json" download>下载本次回执、版本指纹、提示词与计时数据 ↓</a></p></section><a class="back-link" href="B10-R1.html#placement-investigation">← 查看原始问题与修复说明</a>`;
 }
 return {fix,links,history,render};
};
