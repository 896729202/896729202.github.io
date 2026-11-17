'use strict';

const report=require('../content/useit/b02-optimization-2026-11-17.json');
const baselineRoundData=require('../content/useit/b02-baseline-rounds-2026-11-13.json');
const timeBar=require('./useit-time-bar.cjs');
const sec=n=>`${n.toFixed(1)} 秒`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toolTime=ms=>`${(ms/1000).toFixed(ms<1000?3:1)} 秒`;
const oldStep=(row,model,tool)=>`<li class="b02-old-round" id="b02-original-round-${row.number}"><div class="b02-round-heading"><span class="b02-round-number">${String(row.number).padStart(2,'0')}</span><h4>${esc(row.title)}</h4></div><div class="b02-api-call"><span>主模型 API：<strong>有 · 1次</strong></span><strong>${sec(model.duration_ms/1000)}</strong></div><p><strong>请求模型是为了：</strong>${esc(row.purpose)}</p><p><strong>模型返回后执行：</strong>${esc(row.execution)}<small class="b02-tool-fact"><code>${esc(row.tool)}</code> · 工具耗时 ${toolTime(tool.duration_ms)}，与上方模型耗时分开。</small></p>${row.additional_ai_api?`<p class="b02-extra-api"><strong>还有生图 API：</strong>${esc(row.additional_ai_api)}</p>`:''}<div class="b02-replacement"><strong>怎样平替</strong><span>${esc(row.replacement_kind)}</span><p>${esc(row.replacement)}</p></div></li>`;
const pair=(label,before,after)=>`<div class="b02-flow-pair"><div class="b02-flow-box b02-before">${before}</div><div class="b02-flow-link" aria-hidden="true"><span>${label}</span>→</div><div class="b02-flow-box b02-after">${after}</div></div>`;
const oldBox=(title,steps,note)=>`<h3>${title}</h3><ol class="b02-old-steps">${steps.join('')}</ol><p class="b02-step-note">${note}</p>`;
const newBox=(n,title,points,note)=>`<p class="b02-step-number">现在 ${n}</p><h3>${title}</h3><dl class="b02-change-explanation">${points.map(([label,text])=>`<div><dt>${label}</dt><dd>${text}</dd></div>`).join('')}</dl><p class="b02-step-note">${note}</p>`;

module.exports=function renderB02Optimization(baseline){
 const r=report,s=r.steps;
 const parts=Object.values(r.runtime);
 if(Math.abs(parts.reduce((a,b)=>a+b,0)-r.agent_seconds)>.001)throw new Error('B02 time parts do not sum to Agent total');
 const oldModel=baseline.observations.filter(o=>o.name==='llm.plan').sort((a,b)=>a.startTime.localeCompare(b.startTime));
 if(oldModel.length!==16)throw new Error('B02 baseline model count changed');
 if(baselineRoundData.rounds.length!==16)throw new Error('B02 needs all sixteen baseline descriptions');
 const oldSteps=baselineRoundData.rounds.map((row,index)=>{
  if(row.number!==index+1)throw new Error('B02 baseline round descriptions must remain chronological');
  const model=oldModel[index];
  const tools=baseline.observations.filter(o=>o.name===`tool.${row.tool}`&&o.parentObservationId===model.parentObservationId&&o.step===model.step);
  if(tools.length!==1)throw new Error(`B02 round ${row.number} does not match its recorded tool`);
  return oldStep(row,model,tools[0]);
 });
 const modelSum=(from,to)=>oldModel.slice(from-1,to).reduce((v,o)=>v+o.duration_ms/1000,0);
 const flow=[
  pair('合并',oldBox('准备规格与制作任务 · 第01–09轮',oldSteps.slice(0,9),`<strong>9 次模型 · ${sec(modelSum(1,9))}</strong>；另等确认 194.5 秒，不计入 Agent 时间。`),
  newBox('①','把确定的规格与任务准备交给代码',[
   ['原来为什么慢','模型反复决定“读什么、填什么、下一步做什么”，还要自己填写产品 ID；本次原始记录因此写错一次 ID，并多等了一轮默认值确认。'],
   ['现在具体怎么做','模型仍理解用户原话，选定品类、主题与制作范围。选定挂件后，代码读取<strong>当前产品目录的默认规格</strong>，用用户明确指定值覆盖默认值，再走原有参数校验；代码绑定产品 ID、准备设计规则和制作进度。'],
   ['保留什么，怎样防止做错','保留模型对需求的理解、设计规范和参数合法性校验。自动流程只接管<strong>明确选定的标准单片、单面、空白背面新建任务</strong>；已有作品、不同背面或特殊白墨等需求不强套这套流程。未识别或缺少必要信息时，仍需正常规划。'],
   ['验证与取舍','默认值、用户指定尺寸、已有项目保护及特殊范围退出已有回归检查；本轮用普通短句进入流程。减少的是固定内容的反复安排，不代表所有特殊需求都已覆盖。']
  ],`<strong>9 次模型 · ${sec(modelSum(1,9))} → 1 次模型 · ${sec(s.model_requirement_and_plan)}</strong>；代码准备与校验仍执行。`)),
  pair('保留',oldBox('创作与生图 · 第10轮',oldSteps.slice(9,10),`模型 ${sec(modelSum(10,10))} ＋ 生图 17.6 秒。`),
  newBox('②','模型做创意，代码把工艺要求带进生图',[
   ['这一步解决什么','创意设计本来就需要模型，<strong>这一步并未被删减，也不是本轮提速来源</strong>。主要改动是前后固定步骤自动接续，避免模型在创作之外反复管理工具与清单。'],
   ['现在具体怎么做','给模型保留用户主题、文字与参考要求，并加载实体设计规则；模型仍编写人物、构图、风格等创意提示词。原来的<strong>制品生图工具</strong>再把已选产品的尺寸、透明背景和适用工艺约束编入实际生图请求，生成新原图。'],
   ['保留什么，怎样防止做错','保留真实模型创作与原图保存。工具读取返回图片的实际字节，检查像素尺寸、比例、透明通道，并在规则明确时检查有效 DPI；明确失败的图片检查会阻止自动装配。代码还核对原图已登记、属于本项目和本产品正面。'],
   ['验证与缺口','本轮生成了 1 张新透明 PNG 并保存。<strong>这些检查不等于画面审美或语义验收</strong>：目前没有独立的生成后视觉复审，不能保证人物细节、文字或构图一定不退步；仍缺同主题的新旧画面对照。']
  ],`本轮创意 ${sec(s.model_artwork_prompt)} ＋ 生图 ${sec(s.image_generation)}；旧版分别为 7.8 秒、17.6 秒。这一步本轮反而更慢。`)),
  pair('自动',oldBox('装配并保存画稿 · 第11–12轮',oldSteps.slice(10,12),`2 次模型 · ${sec(modelSum(11,12))}；装配往返 55.9 秒。`),
  newBox('③','原图就绪后自动装配，按回执继续',[
   ['原来为什么慢','生图完成后，还要等模型更新清单，再等模型发装配指令。图片读取、写入母版和保存是工具实际执行的工作，原本就不是模型在计算像素。'],
   ['现在具体怎么做','原图确认保存后，代码把<strong>同一张原图</strong>交给原装配工具，指定已绑定的产品正面。返回运行中就记住任务编号、查询同一个任务；取得完成结果后才继续切线，同时自动更新进度。'],
   ['保留什么，怎样防止做错','素材读取、完整性检查、画稿装配和版本保存全部保留。继续执行前必须核对任务、项目、产品、来源与面片，并要求回执中的<strong>已保存、已放置、来源完整、可见</strong>检查通过；缺版本或来源不符不能继续。'],
   ['验证与取舍','本轮只发起 1 次装配、查询 1 次；保存回执和事后母版检查通过。省去模型调度也减少了模型再次查看图片的机会，故这里只能证明装配正确，不能用“可见”代替画面质量复审。']
  ],`省去 2 次模型等待；装配与查询往返 <strong>${sec(s.placement+s.placement_status)}</strong>。素材准备没有被跳过。`)),
  pair('自动',oldBox('生成切线与挂孔 · 第13轮',oldSteps.slice(12,13),`模型 ${sec(modelSum(13,13))} ＋ 工具往返 18.8 秒。`),
  newBox('④','沿用切线算法，修正放进外框的余量',[
   ['原来有什么问题','先等模型发切线指令。另在本地调试中发现：图像轮廓转成实际尺寸时有像素舍入误差，边界反复缩放后仍可能超限，导致整步拒绝保存。'],
   ['现在具体怎么做','装配保存后，由代码调用<strong>原来的切线与配件工具</strong>，根据真实画稿和所选配件生成轮廓、留边及挂孔。对标准透明留边、无自定义孔位的单片挂件，将装入规格外框的预留量从 0.10 mm 调为 0.25 mm，减少边界反复贴线。'],
   ['保留什么，怎样防止做错','透明留边、孔径、挂耳尺寸和最终越界检查仍保留，超限仍拒绝保存。<strong>代价是画面可能略收小</strong>以腾出余量；没有把“超界也算成功”当作提速方案。'],
   ['验证与边界','同一张失败画稿的重放，从 5 次轮廓计算后仍失败，变为 3 次计算可生成；本轮也已保存切线与挂孔。但关键内容离切线的距离、结构强度及供应商工艺仍需审核，<strong>切线待审不等于量产合格</strong>。']
  ],`0 次模型；本轮工具往返 <strong>${sec(s.cut_and_hole)}</strong>。不同主题的时间差不能全部归因于余量修正。`)),
  pair('自动',oldBox('处理白墨 · 第14轮',oldSteps.slice(13,14),`模型 ${sec(modelSum(14,14))} ＋ 工具往返 3.9 秒。`),
  newBox('⑤','检查真实白墨状态，按需复用或更新',[
   ['原来为什么慢','模型再决定调用白墨工具。真正计算白墨形状、写入图层的是原有工具；并不需要模型每次重新决定已经确定的标准工艺。'],
   ['现在具体怎么做','切线完成后先读取<strong>已保存母版</strong>。白墨已与当前画面匹配且是沿图白墨，就复用；需处理时调用原白墨工具，传入母版上的实际印刷设置，处理后再核验。'],
   ['保留什么，怎样防止做错','白墨计算与保存没有删除。透明板材、印刷面、白墨模式及内缩等已有设置被保留，不能凭默认值覆盖；局部白墨、满版白墨或明确不要白墨等不同意图不强行改成标准沿图白墨。没有可靠设置或回执就停止自动续接。'],
   ['验证与边界','“有效即复用”和“失效才处理”均有回归检查；本轮事后检查确认 WHITE 为当前有效状态。自动最终核验仍受下方数值误判影响；实际印刷的透色、套准与附着效果未通过样片验证。']
  ],`本轮 0 次模型；检查 ${sec(s.inspect_white)} ＋ 白墨往返 ${sec(s.white_ink)}。跳过的是不必要的重建，不是白墨检查。`)),
  pair('收尾',oldBox('更新进度并回复 · 第15–16轮',oldSteps.slice(14,16),`2 次模型 · ${sec(modelSum(15,16))}。`),
  newBox('⑥','按真实保存结果收尾，不凭回复判定完成',[
   ['原来为什么慢','保存后还要分别等模型更新清单、撰写完成回复。回复写得完整，不代表每一个文件与图层都经过最终核验。'],
   ['最终修正后的做法','代码核对母版存在且有版本、正面引用本轮原图、CUT 图层存在、白墨状态有效，再更新进度并返回简短结果。保留“切线待审”等提示；失败则报告未完成的步骤并保留已有成果。'],
   ['本轮暴露的问题与修复','白墨保存后的 <code>60.0 → 60</code> 被误认成用户改规格，自动流程退出，因而仍多了一次模型收尾。现已按数值等价比较；真正改尺寸、换产品或改需求仍会阻止旧任务继续执行。'],
   ['已验证到哪里','本轮依靠事后独立检查确认保存；最后修正通过 37 项回归检查和真实回执重放。<strong>尚未重新完整生图验证“两轮模型”</strong>，也没有把保存成功写成三维或生产验收通过。']
  ],`<span class="b02-residual">本轮实际仍有第 3 次模型 · ${sec(s.model_final_reply)}</span>，保留在 2分23秒中；修正后的耗时仍待测。`))
 ].join('');
 return `<section id="b02-latest" class="b02-latest" aria-labelledby="b02-latest-title">
 <p class="eyebrow">2026.11.17 / 最新本地实测 · B02-R6</p>
 <h2 id="b02-latest-title">画稿与装配已保存，本轮 <strong>2分23秒</strong></h2>
 <p>短需求：“${r.prompt}”</p>
 <p class="b02-result"><strong>画稿、切线、挂孔、白墨已保存 · 工具报错 0 次。</strong>这是 Agent 执行的 143.29 秒，不含另行核验和三维截图；切线仍需审核。</p>
 <div class="b02-scoreboard"><div><small>11/13 原始 · Agent</small><strong>5分44秒</strong><span>16 次主模型 · 1 次工具失败</span></div><div class="b02-score-arrow" aria-hidden="true">→</div><div class="b02-score-current"><small>11/17 本轮 · Agent</small><strong>2分23秒</strong><span>3 次主模型 · 0 次工具失败</span></div></div>
 <p class="b02-boundary"><strong>省下的主要是反复等模型安排固定步骤。</strong>模型等待从 207.5 秒降到 52.2 秒；本轮生图反而从 17.6 秒变为 24.0 秒。主题不同，只代表两次实测，不代表稳定速度。</p>
 <div class="b02-runtime" id="b02-latest-timing"><h3>这 2分23秒，花在哪里？</h3>${timeBar(parts).replaceAll('装配与保存','装配、切线与白墨')}
 <details><summary>展开每一段：哪些在等模型，哪些在执行工具？</summary>
 <ul class="b02-timing-detail"><li><strong>等主模型 52.2 秒：</strong>理解需求与计划 22.4 秒，创意提示词 11.7 秒，额外收尾 18.0 秒；包含请求与服务等待，不是纯思考时间。</li>
 <li><strong>生图 24.0 秒：</strong>真实生成一张透明背景插画的工具阶段；没有复用旧图。</li>
 <li><strong>工具往返 40.2 秒：</strong>装配及查询 35.0 秒，切线与挂孔 3.3 秒，检查母版 0.4 秒，白墨 1.5 秒。包括前端处理与回执等待，不能全部说成代码计算。</li>
 <li><strong>其他执行与衔接 26.9 秒：</strong>总时间扣除以上三段后的剩余，包括启动、事件处理及阶段衔接；现有记录未完整拆分，不能全部归因于网络。</li></ul>
 <p>本轮装配内部耗时 31.1 秒，已包含在上面的工具时间中。素材准备 7.45 秒，其中本机读取接口 6.54 秒、下载等待 0 秒；母版准备 18.15 秒，版本记录 4.45 秒。不能据这一轮反推旧测试素材准备 47.2 秒的根因。</p></details></div>
 <section id="b02-flow-comparison" class="b02-flow-comparison" aria-labelledby="b02-flow-title"><h3 id="b02-flow-title">原来怎样做 → 现在怎样做，为什么这样改</h3><p>每排左右是同一阶段，<strong>对应框等高对齐</strong>。左侧编号是原始 16 轮模型调用，右侧编号是现在的 6 个流程阶段，并不表示每步都调用模型。</p>
 <div class="b02-api-explainer"><h4>先分清：问模型，与让程序执行，是两件事</h4><p><strong>左侧01–16轮，每轮都调用了1次主模型 API。</strong>顺序是：请求模型决定做什么 → 模型返回指令 → 程序执行工具。每项分别列出两段耗时；例如第12轮等模型 6.4 秒，之后工具装配往返 55.9 秒。</p><p><strong>平替的是固定决策，不是删掉实际工作。</strong>代码直接读规格、写计划或调用装配接口后，这些工具和前后端请求仍存在，只是不必每一步先请求主模型。第10轮的创意模型与生图 API 继续保留；第16轮的最终替代仍待完整复测。</p><details><summary>调用数量与旧记录的说明范围</summary><p>${esc(baselineRoundData.source_note)}</p><p>已记录16次主模型、1次生图服务，另有1次辅助模型；辅助模型用途未在这份历史快照中单独记录，不能硬归到某一轮。这里不是全部 HTTP 请求次数。<a href="evidence/B02-baseline-rounds.json">查看16轮用途与平替说明 →</a></p></details></div>
 <div class="b02-quality-boundary"><strong>目前能证明流程提速和保存结果，不能保证画面效果一定更好。</strong><p>这次保留模型创意及原有制作工具，把固定调度、参数绑定和保存核验交给代码。像素检查、原图追踪、尺寸校验继续保留；但它们不能代替审美、文字准确性和构图检查。旧流程生图后还会再经过模型，新流程目前没有独立的生成后视觉复审。</p><p><strong>要确认没有牺牲效果：</strong>还需用同一组短需求做新旧多次对照，检查主题符合度、文字与细节、透明背景、切线与关键内容距离，以及实际样片。以下逐项区分“已保留的工作”“已经验证的结果”和“仍待验证的部分”。</p></div>
 <div class="b02-flow-scroll" tabindex="0" role="region" aria-label="新旧流程左右对照，可横向滚动"><div class="b02-flow-grid"><div class="b02-flow-head"><div><span>之前 / 逐步问模型</span><strong>16 轮主模型调用</strong></div><span></span><div><span>现在 / 代码接续固定步骤</span><strong>本轮 3 轮，最终目标 2 轮</strong></div></div>${flow}</div></div><p class="b02-mobile-hint">窄屏可左右滑动，左右对应框保持对齐。</p></section>
 <details class="b02-evidence"><summary>测试范围、费用与证据</summary><p>本轮在独立项目通过本机聊天链路发送短需求，覆盖真实生图与前端装配；结束后独立检查保存状态。截图与独立检查不计入 143.29 秒。保留本轮自动收尾中断的事实，不能当作最终修正后“两轮模型”的完整验收。</p><p>原始 Agent 344.14 秒，首次发送至结束 550.147 秒（9分10秒），包含 194.519 秒等待用户确认；这里统一比较 Agent 时间。上一轮 R5 为 6分16秒，本轮为 2分23秒，尚未证明可稳定保持在两分钟左右。</p><p>参考费用：原始 <strong>$${baseline.cost.reference_total_usd.toFixed(6)}</strong> → 本轮 <strong>$${r.reference_usd.toFixed(6)}</strong>。按记录用量与本地费率计算，非账单，不含存储、网络及本机计算。两次各生成 1 张图，另各有 1 次辅助模型调用；3 次或 16 次指主规划模型，不是全部 API 请求数。</p><p><a href="evidence/B02-R6-optimization.json">查看本轮脱敏计时与验证记录 →</a> · <a href="#numeric-scope-fix">查看数值比较修复 →</a></p></details>
 </section>`;
};
