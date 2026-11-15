'use strict';
const audit=require('../content/useit/B10-R7-runtime-audit.json');
const groups=[
 {key:'read',steps:[1,2],title:'决定读取哪些设计资料、规格',
  why:'模型先决定读取设计指南和品类目录，拿到结果后再决定读取双图规格。24 秒主要花在这两次请求中。',
  toolKind:'本地读取操作',
  toolNote:'两次读取的本地外层动作合计。资料读取本身没有用 24 秒。',
  change:'识别出唯一明确的品类与款式后，由程序从已有产品资料快照一次准备必要指南和当前款规格，把精简结果直接给模型；不把整个目录塞进去。有多个候选或能力冲突时才询问，减少“先问读哪个目录，再问读哪个规格”的往返。'} ,
 {key:'plan',steps:[3],title:'创建默认规格、方案与清单',
  why:'这一轮主要输出默认尺寸、工艺、产品 ID、用户目标和任务清单。长时间在等待模型输出，不在写入计划。',
  toolKind:'本地计划操作',
  toolNote:'清单与制品计划的本地外层动作合计。97 秒内部的排队、处理和网络占比尚无法确认。',
  change:'复用现有参数解析规则，由代码补齐默认尺寸、工艺和固定步骤，继续执行范围及制造校验。用户本次明确值优先，未要求改变的已有设置保留；缺少的交付物 ID 按规则创建，重试复用。模型保留主题、构图和画面变化等设计决策。'},
 {key:'confirmation',steps:[4],title:'回复方案并要求确认',
  why:'用户已经要求默认规格、直接做完；模型仍生成了一段方案并要求确认，随后本轮停止。',
  toolKind:'本地状态与消息提交',
  toolNote:'这里只计本地外层提交，不包含消息到达客户端和界面最终显示的时间。',
  change:'统一“已授权直接制作”与“方案确认后继续”的冲突规则。需求明确、无缺失信息时继续执行，由进度事件更新状态；只有实际缺少关键信息时才询问。'},
 {key:'generation',steps:[5],title:'编写三面的创意生图提示词',
  why:'主 Agent 模型在写人物、城市、跑车、昼夜变化以及背面设计要求。这部分包含实际创作决策。',
  toolKind:'生图服务与素材保存',
  toolNote:'整套生图工具的实际等待，包含生图服务响应及结果保存；并行重叠已去重。这不是本地 CPU 连续运算 57 秒。',
  change:'优先保留这次创意请求与相同生成质量。继续让代码并发生成 A 面和背面，A 图保存成功后自动以它为参考生成 B 面；模型不再逐张安排生成顺序。'},
 {key:'placement',steps:[6,7,8],title:'分三次安排 A、B、背面装配',
  why:'三张图已就绪，模型仍用三轮请求分别填素材路径和面名，再逐面发出装配指令。34 秒是安排指令的等待。',
  toolKind:'前端执行与回调等待',
  toolNote:'三次本地测得的前端往返：5.555 + 4.006 + 5.257 秒，含读取、保存及通信；不是纯渲染时间，也不是纯 CPU 时间。',
  change:'用户已要求装入产品时，程序校验三图均已保存、归属与对应面正确且无待审核阻断，再一次调用已有批量入口；运行中就查询同一任务，结束后核验逐面回执。失败、取消或需求变更再交回模型。只要求出图时不自动装配；批量入口当前仍逐次保存，合并为一次保存是另一项优化。'},
 {key:'reply',steps:[9],title:'更新完成状态并撰写回复',
  why:'三面装配结束后，再次请求模型更新清单并撰写较长的完成说明。',
  toolKind:'本地状态与消息提交',
  toolNote:'本地外层提交时间；不包含客户端最终显示。这里也不包含运行后另做的独立检查。',
  change:'根据真实回执生成简短结果：哪些面已保存和装入、版本是否记录、哪些检查还没做。保留现有失败与未写回检查；三面均完成才报告完成，运行中和部分失败分别说明。复杂异常再交给模型，不承诺未经验证的三维或印刷效果。'}
];
function evidenceRows(){
 return groups.map(group=>{
  const steps=audit.steps.filter(step=>group.steps.includes(step.step));
  const modelMs=steps.reduce((sum,step)=>sum+step.model_ms,0);
  const toolMs=group.key==='placement'
   ?audit.frontend_roundtrips.filter(row=>row.tool_name==='canvas_product_add').reduce((sum,row)=>sum+row.duration_ms,0)
   :steps.reduce((sum,step)=>sum+step.outer_action_ms,0);
  return {...group,modelMs,toolMs};
 });
}
function render(id,esc){
 if(id!=='B10-R7')return '';
 const rows=evidenceRows(),total=rows.reduce((sum,row)=>sum+row.modelMs,0);
 const modelSteps=rows.flatMap(row=>row.steps);
 if(total!==audit.breakdown_ms.model||new Set(modelSteps).size!==audit.model_round_count)throw Error('Model waiting groups do not match the recorded audit');
 const time=ms=>(ms/1000).toFixed(3)+' 秒';
 return `<details class="model-wait-details" id="model-wait-details"><summary>展开：222.3 秒的明细、工具耗时与具体改法</summary>
 <div class="model-wait-content"><p><strong>左边是等主 Agent 模型返回指令或文字；右边是模型返回后，程序执行指令的工具阶段。</strong>这 9 次模型请求归为 6 类。模型请求计时包含传输、服务排队、模型处理和输出，现有记录无法进一步区分各占多少。</p>
 <p class="model-wait-flow">等主模型给指令 → 执行读取 / 写计划 / 生图 / 装配等工具 → 再决定下一步</p>
 <div class="table-wrap model-wait-table" tabindex="0" role="region" aria-label="六类模型等待、工具时间和拟修改方法"><table><thead><tr><th scope="col">模型在做什么，为什么要等</th><th scope="col">等主模型响应</th><th scope="col">模型返回后：工具阶段</th><th scope="col">建议具体怎么改</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td><strong>${index+1}. ${esc(row.title)}</strong><p>${esc(row.why)}</p></td><td class="model-wait-number"><strong>${time(row.modelMs)}</strong><small>${row.steps.length} 次模型请求</small></td><td><span class="model-tool-kind">${esc(row.toolKind)}</span><strong class="model-tool-time">${time(row.toolMs)}</strong><p>${esc(row.toolNote)}</p></td><td>${esc(row.change)}</td></tr>`).join('')}</tbody><tfoot><tr><th scope="row">模型请求合计</th><td><strong>${time(total)}</strong></td><td colspan="2">工具列只解释对应执行阶段；已包含在原时间图里，不另加一次。</td></tr></tfoot></table></div>
 <div class="model-wait-note"><p><strong>97 秒最值得优化，但不能整段当作可删除时间。</strong>记录能确认：模型请求用了 97.009 秒，清单与方案操作约 0.016 秒。默认规格可交给代码，创意决策仍需保留；目前无法断定那次模型请求为何异常慢。</p>
 <p><strong>生图和装配也包含等待。</strong>57.412 秒生图包含另一个生图服务的响应与保存；14.818 秒装配包含前端操作及通信。两者已经分别计入上方“生成三面图片”“装配并保存三面”。小段读取、计划、消息提交合计 0.044 秒，已在“其他衔接”中；这些都不能再叠加到总时间。</p>
 <p><strong>确认后的等待另计。</strong>20.236 秒是模型生成确认回复的时间；之后的 101.990 秒续做间隔不在这 222.308 秒里，也不在 Agent 执行合计 310.030 秒里，而在提交至完成的 423.233 秒中。</p></div>
 <p class="sub">上述改法尚未作为新一轮性能优化完成复测；三面生图自动并发已存在，继续保留。取消多余确认、合并 B 面和背面的单独派发，对应旧记录中 32.531 秒的请求等待；再简化最终回复，对应 50.332 秒。它们是候选优化规模，不是保证节省的秒数。</p>
 <p><a href="../../../content/useit/B10-R7-runtime-audit.json" download>查看 9 次请求的动作与计时依据 ↓</a> · <a href="B10-R7.html#chain">查看完整调用说明</a></p></div></details>`;
}
module.exports={render,evidenceRows};
