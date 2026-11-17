'use strict';

const report=require('../content/useit/b02-optimization-2026-11-17.json');
const timeBar=require('./useit-time-bar.cjs');
const sec=n=>`${n.toFixed(1)} 秒`;
const oldStep=(n,text)=>`<li><b>${n}</b><span>${text}</span></li>`;
const pair=(label,before,after)=>`<div class="b02-flow-pair"><div class="b02-flow-box b02-before">${before}</div><div class="b02-flow-link" aria-hidden="true"><span>${label}</span>→</div><div class="b02-flow-box b02-after">${after}</div></div>`;
const oldBox=(title,steps,note)=>`<h3>${title}</h3><ol class="b02-old-steps">${steps.map(s=>oldStep(...s)).join('')}</ol><p class="b02-step-note">${note}</p>`;
const newBox=(n,title,body,note)=>`<p class="b02-step-number">现在 ${n}</p><h3>${title}</h3><p>${body}</p><p class="b02-step-note">${note}</p>`;

module.exports=function renderB02Optimization(baseline){
 const r=report,s=r.steps;
 const parts=Object.values(r.runtime);
 if(Math.abs(parts.reduce((a,b)=>a+b,0)-r.agent_seconds)>.001)throw new Error('B02 time parts do not sum to Agent total');
 const oldModel=baseline.observations.filter(o=>o.name==='llm.plan');
 if(oldModel.length!==16)throw new Error('B02 baseline model count changed');
 const modelSum=(from,to)=>oldModel.slice(from-1,to).reduce((v,o)=>v+o.duration_ms/1000,0);
 const flow=[
  pair('合并',oldBox('准备规格与制作任务',[
   ['①②','模型先决定读品类目录，再决定读具体规格。'],
   ['③④','模型填写产品计划；ID 填错，修正后再保存。'],
   ['⑤','模型回复方案，停下来等用户确认默认值。'],
   ['⑥⑦','确认后，模型查找并加载工具包。'],
   ['⑧⑨','模型更新产品计划，再编写制作清单。']
  ],`<strong>9 次模型 · ${sec(modelSum(1,9))}</strong>；另等确认 194.5 秒，不计入 Agent 时间。`),
  newBox('①','模型理解一次，代码准备固定内容','模型确定<strong>品类、主题与制作范围</strong>；代码加载规格、补默认值、绑定产品 ID、建立进度。需求明确就继续。',`<strong>1 次模型 · ${sec(s.model_requirement_and_plan)}</strong>；固定参数与校验交给代码。`)),
  pair('保留',oldBox('创作与生图',[
   ['⑩','模型编写创意提示词，再调用生图服务生成透明背景画稿。']
  ],`模型 ${sec(modelSum(10,10))} ＋ 生图 17.6 秒。`),
  newBox('②','保留模型创意与真实生图','模型设计小狐狸的形象、构图和透明背景，随后生图服务生成<strong>1 张新素材</strong>。',`模型 ${sec(s.model_artwork_prompt)} ＋ 生图 ${sec(s.image_generation)}；没有删减创作步骤。`)),
  pair('自动',oldBox('装配并保存画稿',[
   ['⑪','图片生成后，再问模型更新制作清单。'],
   ['⑫','再问模型发装配指令；工具读取素材并写入母版。']
  ],`2 次模型 · ${sec(modelSum(11,12))}；装配往返 55.9 秒。`),
  newBox('③','代码装配，跟踪同一个任务','素材就绪后自动装配。返回运行中，就<strong>查询原任务</strong>，不重复装配；取得保存回执。',`0 次模型；装配与查询往返共 <strong>${sec(s.placement+s.placement_status)}</strong>。`)),
  pair('自动',oldBox('生成切线与挂孔',[
   ['⑬','模型决定调用切线工具；工具计算轮廓、透明留边和挂孔。']
  ],`模型 ${sec(modelSum(13,13))} ＋ 工具往返 18.8 秒。`),
  newBox('④','代码调用切线与挂孔工具','装配完成后按依赖顺序执行。保留轮廓算法与尺寸校验，修正适配余量，避免边界舍入造成反复缩放。',`0 次模型；工具往返 <strong>${sec(s.cut_and_hole)}</strong>。切线仍标为待审核。`)),
  pair('自动',oldBox('处理白墨',[
   ['⑭','模型决定调用白墨工具，再生成与图案匹配的白墨层。']
  ],`模型 ${sec(modelSum(14,14))} ＋ 工具往返 3.9 秒。`),
  newBox('⑤','代码检查白墨，必要时处理','先读真实母版：白墨有效就复用；需处理时沿用当前印刷设置，再检查保存结果。',`本轮 0 次模型；检查 ${sec(s.inspect_white)} ＋ 白墨往返 ${sec(s.white_ink)}。`)),
  pair('收尾',oldBox('更新进度并回复',[
   ['⑮','模型将制作清单标为完成。'],
   ['⑯','再调用模型撰写完成回复。']
  ],`2 次模型 · ${sec(modelSum(15,16))}。`),
  newBox('⑥','本轮仍多了一次模型收尾','<strong>本轮实际：</strong><code>60.0/60</code> 误判使自动流程退出，模型撰写完成回复；随后独立检查确认保存。<br><strong>最后修正：</strong>由代码继续核验并回复，已通过真实回执重放，待完整复测。',`<span class="b02-residual">本轮第 3 次模型 · ${sec(s.model_final_reply)}</span>。这 18 秒仍计入 2分23秒，没有提前扣掉。`))
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
 <section id="b02-flow-comparison" class="b02-flow-comparison" aria-labelledby="b02-flow-title"><h3 id="b02-flow-title">原来怎样做 → 现在怎样做</h3><p>每排左右是同一阶段，<strong>对应框等高对齐</strong>。左侧编号是原始 16 轮模型调用，右侧编号是现在的 6 个流程阶段，并不表示每步都调用模型。</p>
 <div class="b02-flow-scroll" tabindex="0" role="region" aria-label="新旧流程左右对照，可横向滚动"><div class="b02-flow-grid"><div class="b02-flow-head"><div><span>之前 / 逐步问模型</span><strong>16 轮主模型调用</strong></div><span></span><div><span>现在 / 代码接续固定步骤</span><strong>本轮 3 轮，最终目标 2 轮</strong></div></div>${flow}</div></div><p class="b02-mobile-hint">窄屏可左右滑动，左右对应框保持对齐。</p></section>
 <details class="b02-evidence"><summary>测试范围、费用与证据</summary><p>本轮在独立项目通过本机聊天链路发送短需求，覆盖真实生图与前端装配；结束后独立检查保存状态。截图与独立检查不计入 143.29 秒。保留本轮自动收尾中断的事实，不能当作最终修正后“两轮模型”的完整验收。</p><p>原始 Agent 344.14 秒，首次发送至结束 550.147 秒（9分10秒），包含 194.519 秒等待用户确认；这里统一比较 Agent 时间。上一轮 R5 为 6分16秒，本轮为 2分23秒，尚未证明可稳定保持在两分钟左右。</p><p>参考费用：原始 <strong>$${baseline.cost.reference_total_usd.toFixed(6)}</strong> → 本轮 <strong>$${r.reference_usd.toFixed(6)}</strong>。按记录用量与本地费率计算，非账单，不含存储、网络及本机计算。两次各生成 1 张图，另各有 1 次辅助模型调用；3 次或 16 次指主规划模型，不是全部 API 请求数。</p><p><a href="evidence/B02-R6-optimization.json">查看本轮脱敏计时与验证记录 →</a> · <a href="#numeric-scope-fix">查看数值比较修复 →</a></p></details>
 </section>`;
};
