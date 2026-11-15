'use strict';
const navigation=require('./useit-navigation.cjs');
module.exports=function({report:r,historyCases,priorReport,shortBundle,fastflowBundle,runtimeUI,costs,esc,table,dur,sec,external}){
 if(fastflowBundle)return require('./useit-versions.cjs')({historyCases,priorReport,shortBundle,fastflowBundle,costs,esc,table,dur,sec,external});
 if(shortBundle)return require('./build-useit-short-prompts.cjs').renderBody(shortBundle,{latestView:true});
 if(r.case==='B10-R8'&&fastflowBundle)return require('./useit-fastflow.cjs')().render({...fastflowBundle,latestView:true,evidenceUrl:'evidence/B10-R8-placement.json'});
 const cost=costs.cases.find(x=>x.case===r.case);
 const failureCount=r.failure_observations.length;
 const gallery=r.images.map(im=>`<figure><a href="${esc(im.src)}"><img src="${esc(im.src)}" alt="${esc(im.caption)}" loading="lazy" width="1104" height="1504"></a><figcaption>${esc(im.caption)}</figcaption></figure>`).join('');
 return `<nav class="crumb"><a href="../../index.html">USEIT</a><span>/</span><a href="index.html">全品类测试</a><span>/</span>光栅卡最新成果</nav>
 <div class="detail-title"><div><p class="eyebrow">进展汇总 / 更新于 2026.11.15</p><h1>光栅卡：最新改动与成果</h1><p class="sub">依据 B10-R7 GTA6 复测 · 测试日期 ${esc(r.test_date)} · 本页是成果汇总，没有新增一轮测试。</p></div><a class="u-button" href="B10-R7.html">查看完整 R7 记录</a></div>
 ${navigation('B10-latest')}
 <div class="verdict"><span class="badge">最新实测 · 生图与装配未见工具报错</span><h2>A 面、B 面、背面已生成并保存，三面核验通过。</h2><p>本次 ${r.observations} 条 Langfuse 观测中有 ${failureCount} 条 ERROR，三次装配回执均完成；运行结束后另做只读检查，确认 ${r.saved_image_count} 张图片、${r.saved_placement_count} 条保存记录。仍有多余确认和逐面装配问题；本轮没有验证三维变图与印刷效果。</p></div>
 <div class="metrics"><div><small>工具报错观测</small><strong>${failureCount}<em> 条</em></strong></div><div><small>已核验保存</small><strong>${r.saved_image_count}<em> 面</em></strong></div><div><small>两轮 Agent 执行</small><strong>${dur(r.agent_seconds)}</strong></div><div><small>任务参考费用 USD</small><strong>$${cost.reference_total_usd.toFixed(4)}</strong></div></div>
 ${runtimeUI.breakdown(r.case,r)}
 <nav class="jump"><a href="#changes">已做改动</a><a href="#images">最新画稿</a><a href="#next">仍需改进</a><a href="#chain">原始证据</a></nav>
 <section id="changes"><h2>已经改了什么，取得了什么结果？</h2>${table(['原来的问题','已完成的修改','最新验证结果'],[
  ['后台约 120 秒<strong>报超时，前端却继续保存</strong>；重试可能<strong>重复装配</strong>。','超过 20 秒<strong>返回任务编号</strong>，继续查询原任务；相同运行中请求<strong>复用任务</strong>。','R6 已真实走通“<strong>返回运行中 → 查询原任务 → 完成</strong>”；R7 三面回执均完成，<strong>没有装配重试</strong>。'],
  ['清单更新与实际操作<strong>分开调用模型</strong>，往返较多。','清单更新与实际动作可在<strong>同一轮提交</strong>，合并不必要的安排步骤。','R3 为 <strong>18 次</strong>模型请求；R7 两轮合计 <strong>9 次</strong>。模型请求仍耗时 <strong>222.308 秒</strong>，仍是最大项。'],
  ['多张图片<strong>逐个安排</strong>，等待时间叠加。','由代码<strong>同时启动 A 面与背面</strong>；<strong>A 保存成功后</strong>，以它为参考自动制作 B 面。','用户只写自然语言。R7 生图整段等待 <strong>57.412 秒</strong>，已扣除并发重叠；<strong>三张图均已保存</strong>。'],
  ['旧日志<strong>只有 load_source 总耗时</strong>，<strong>缺少内部拆分</strong>，看不出素材慢在哪一步。','<strong>新增分段计时</strong>，分别记录下载、素材准备、写入排队和保存耗时。','R7 三面素材准备约 <strong>0.753 / 0.167 / 0.144 秒</strong>；历史 132–190 秒的<strong>异常仍未复现</strong>，最底层原因尚未证实。'],
  ['希望短需求表达得更清楚，又担心<strong>改写拖慢流程</strong>。','增加可选后台提示词整理：<strong>保留原文优先</strong>，<strong>失败或超时回退</strong>；默认关闭。',`R7 实验已应用改写，增加 <strong>${sec(r.prompt_rewrite.duration_ms/1000)}</strong>，参考 <strong>$${r.prompt_rewrite.reference_cost_usd.toFixed(6)}</strong>；已计入总时间和费用。单次实验<strong>尚不能证明效果提升</strong>。`]
 ])}<p class="sub">已有批量装配入口可并行准备素材，但 R7 实际仍调用三次单面装配。将它变成代码默认流程，以及只保存一次，仍是后续工作。</p>
 <p>从最初 R1 的约 <strong>15分01秒</strong>，到 R6 的 <strong>3分47秒</strong>、最新 R7 的 <strong>5分10秒</strong>，耗时仍有波动。R1 还尝试了三维，历史慢素材也未复现，不能把全部差值归功于代码提速。<a href="B10-R7.html#improvement-history">查看每次改动与耗时历程</a>。</p></section>
 <section id="images"><h2>最新成果：GTA6 昼夜变图卡</h2><div class="gallery">${gallery}</div><p>A/B 的人物与跑车构图基本一致，白昼到霓虹夜景的变化清楚；背面为完整的同主题设计。局部车轮、反光有变化，背面外框裁切仍需复核。以上是二维画稿及保存证据。</p></section>
 <section id="next"><h2>接下来怎么更快？</h2>${table(['仍存在的问题','接下来的修改方案','当前状态'],[
  ['用户已要求默认规格做完，首轮仍停下来确认。','统一确认规则，让已授权任务继续执行，减少额外停顿和重复规划。','待修复；不能把首轮全部规划时间都当成可省时间。'],
  ['三面仍分别装配、保存，预览可能重复重建。','三张素材齐备后，一次写入整张画稿、一次保存与版本记录，再统一更新三维预览。现有引擎已支持三张贴图。','尚未实现；节省多少秒需另行复测。'],
  ['本轮只测试画稿生成和装配。','补测 A/B 视角变化、背面与裁切，记录三维首次可见的耗时。','三维与成品效果尚未验收。']
 ])}</section>
 <section id="chain"><h2>日期、费用与核验依据</h2><p>成果汇总更新于 <strong>2026 年 11 月 15 日</strong>；实际测试发生于 <strong>2026 年 11 月 14 日</strong>。两轮执行合计 ${sec(r.agent_seconds)}，首次提交至完成 ${sec(r.submitted_to_local_completion_seconds)}；确认后到续做前的间隔单列在上方时间图。</p><p>参考费用 <strong>$${cost.reference_total_usd.toFixed(6)}</strong> 按记录用量与本地配置费率计算，包含两轮任务及改写，未核对供应商账单。独立只读核验 ${r.post_run_verification.duration_ms} 毫秒，未计入 Agent 时间。</p><p><a href="B10-R7.html#chain">38 条调用的中文说明</a> · ${external(r.langfuse_url,'Langfuse 会话')} · <a href="B10-R7.html#version">测试代码版本与指纹</a> · <a href="evidence/B10-R7-placement.json">保存回执与脱敏数据</a> · <a href="B10-R7.html#cost">逐任务费用明细</a></p></section>`;
};
