'use strict';
const navigation=require('./useit-navigation.cjs');
const renderTimeBar=require('./useit-time-bar.cjs');
const {breakdown}=require('./build-useit-short-prompts.cjs');
const CSS=`.version-summary .v-path{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:24px 0}.v-stage{padding:22px;border:1px solid var(--u-border);border-radius:12px;background:var(--u-paper)}.v-stage small{display:block;color:var(--u-muted)}.v-stage h2{margin:10px 0!important;font-size:28px!important;white-space:nowrap}.v-stage p{font-size:13px;line-height:1.8;margin:8px 0}.v-stage.current{border-color:var(--u-accent);background:var(--u-soft)}.version-summary h1{font-size:clamp(28px,4vw,44px);line-height:1.35}.version-summary .v-intro{max-width:800px}.version-summary .v-note{padding:16px 20px;border-left:3px solid var(--u-accent);background:var(--u-soft);line-height:1.8}.version-summary section{margin-top:36px}.version-summary td{vertical-align:top;line-height:1.8}.version-summary td strong{font-weight:750;color:var(--u-ink)}.version-summary .v-tests table{min-width:720px}.version-summary .v-tests td:nth-child(2) strong{color:var(--u-accent);font-size:19px}.version-summary details{margin-top:18px}.version-summary summary{cursor:pointer}.version-summary .v-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.version-summary figure{margin:0}.version-summary figure img{width:100%;height:280px;object-fit:contain;background:var(--u-soft);border-radius:8px}.version-summary figcaption{font-size:13px;margin-top:6px}.version-summary .v-archive{font-size:13px;line-height:2}@media(max-width:700px){.version-summary .v-path{grid-template-columns:1fr;gap:10px}.version-summary .v-stage{padding:16px}.version-summary .v-stage h2{font-size:25px!important}.version-summary .v-gallery{grid-template-columns:1fr}.version-summary .v-tests:before{content:'表格可左右滑动';font-size:12px;color:var(--u-muted)}}`;
const TIMING_CSS=`.v-timings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.v-timing{padding:20px;border:1px solid var(--u-border);border-radius:10px;background:var(--u-paper)}.v-timing-heading{margin-bottom:20px}.v-timing-heading h3{font-size:16px;margin:0 0 12px;line-height:1.7}.v-timing-heading small{font-size:12px;color:var(--u-muted);font-weight:400}.v-timing-heading>strong{font-size:28px;color:var(--u-accent)}.v-timing .runtime-row{grid-template-columns:10px minmax(0,1fr) 80px;gap:8px}.v-timing .runtime-row strong{font-size:14px}.v-timing .runtime-value b{font-size:16px}@media(max-width:1000px){.v-timings{grid-template-columns:1fr}.v-timing-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}.v-timing-heading h3{margin:0}}`;
module.exports=function({historyCases=[],priorReport,fastflowBundle,shortBundle,costs,esc,table,dur,sec,external}){
 const original=historyCases.find(r=>r.case==='B10-R1');
 const prior=priorReport||fastflowBundle.baseline;
 const latest=fastflowBundle.report;
 const runs=[latest,...(shortBundle?.cases||[])];
 const costFor=r=>r.cost?.reference_total_usd??costs.cases.find(c=>c.case===r.case)?.reference_total_usd;
 const money=r=>costFor(r)==null?'未取得完整记录':'$'+costFor(r).toFixed(4);
 const errors=r=>r.tool_failure_count??r.failure_observations?.length??null;
 const records=r=>r.case==='B10-R8'?'B10-R8.html':`B10-short-prompts.html#${r.case}`;
 const label=r=>r.case==='B10-R8'?'GTA6 · 较完整需求':r.case==='B10-R9'?'猫咪变身 · 16字短句':'海底昼夜 · 17字短句';
 const rows=runs.map(r=>[`${esc(label(r))}<small>${esc(r.case)} · ${esc(r.test_date)}</small>`,
  `<strong>${dur(r.agent_seconds)}</strong><small>提交至完成 ${dur(r.submitted_to_local_completion_seconds)}</small>`,
  `${r.model_calls.length} 次<small>${r.case==='B10-R8'?'触发快速流程':'未触发快速流程'}</small>`,
  `${errors(r)==null?'未核验':errors(r)+' 次'}${r.case==='B10-R9'?'<small>独立三维截图入口报错；三面已保存</small>':'<small>三面已保存</small>'}`,
  money(r),`<a href="${records(r)}">图片、链路与回执 →</a>`]);
 const timingBars=runs.map(r=>{
  const runtime=r.case==='B10-R8'?fastflowBundle.runtime:r.runtime;
  const parts=breakdown({...r,runtime});
  return `<article class="v-timing" id="timing-${esc(r.case)}"><div class="v-timing-heading"><h3>${esc(label(r))}<small>${esc(r.case)} · ${r.model_calls.length}次模型请求 · ${errors(r)}次工具失败</small></h3><strong>${dur(r.agent_seconds)}</strong></div>${parts?renderTimeBar(parts):'<p>时间组成尚未完成核对。</p>'}</article>`;
 }).join('');
 const firstChanges=[
  ['后台约120秒<strong>报超时，前端继续保存</strong>；重试容易重复装配。','装配超过20秒先返回<strong>任务编号</strong>；查询原任务到完成，相同运行中请求复用任务。','补上任务追踪与去重；R7未见工具失败。'],
  ['图片与清单操作由模型<strong>一步步安排</strong>。','将<strong>清单更新和实际动作合并到同一轮</strong>；A面与背面并行生成，B面参考新A图。','R7合计9次模型请求；整段生图57.4秒。'],
  ['三面素材依次准备；旧日志<strong>看不出加载慢在哪里</strong>。','增加<strong>批量装配入口、素材并行准备和分段计时</strong>；同一画稿依次保存。','批量能力已具备，但R7实际仍调用3次单面装配，尚未成为默认路径。']
 ];
 const secondChanges=[
  ['模型先决定<strong>读哪些资料、怎样填默认规格</strong>。','代码提前提供当前产品资料，并按目录规则创建<strong>默认规格、计划和清单</strong>。'],
  ['明确要求制作后，仍可能<strong>再问确认、逐面安排、再写总结</strong>。','匹配制作条件后直接继续；三图就绪由代码<strong>批量装配、跟踪原任务</strong>，按真实保存回执生成回复。'],
  ['“读取素材”内部仍在下载，旧通道可能<strong>绕过系统代理</strong>；目录加载失败又误报产品不支持。','下载改用桌面网络通道遵守系统设置；保留完整性校验；复用有效目录缓存并<strong>区分目录加载失败</strong>。'],
  ['多个聊天的执行与完成状态<strong>不够清楚</strong>。','按项目和聊天记录任务状态；运行中转圈、完成未读蓝点、查看后清除；已验证两个项目并行完成。']
 ];
 const gallery=(r)=>`<h3>${esc(label(r))}</h3><div class="v-gallery">${r.images.map(im=>`<figure><a href="${esc(im.original_src||im.src)}"><img src="${esc(im.src)}" alt="${esc(im.caption||im.face)}" loading="lazy"></a><figcaption>${esc(im.caption||im.face)}</figcaption></figure>`).join('')}</div>`;
 return `<div class="version-summary"><style>${CSS}${TIMING_CSS}</style><nav class="crumb"><a href="../../index.html">USEIT</a><span>/</span><a href="index.html">全品类测试</a><span>/</span>光栅卡 · 三个版本</nav>
 <p class="eyebrow">光栅卡优化记录 / 更新于 2026.11.15</p><h1>三个版本，两轮优化。</h1><p class="v-intro">先修复超时与重复执行，再把固定步骤交给代码。第三版已经用不同主题和长短需求多次实测，结果放在一起看。</p>
 ${navigation('B10-latest')}
 <div class="v-path"><article class="v-stage"><small>① 原始版 · R1</small><h2><a href="B10-R1.html">${dur(original?.agent_seconds??900.7)}</a></h2><p><strong>4次工具失败</strong><br>素材等待长；后台超时、前端继续保存；A/B面重复装配。</p></article>
 <article class="v-stage"><small>② 第一轮优化 · R7</small><h2><a href="B10-R7.html">${dur(prior.agent_seconds)}</a></h2><p><strong>0次工具失败</strong><br>修复任务追踪、去重，合并部分模型调用，生图按依赖并行。</p><a href="#version-one-changes">具体改了什么 ↓</a></article>
 <article class="v-stage current"><small>③ 第二轮优化 · R8起</small><h2>${dur(latest.agent_seconds)}</h2><p><strong>较完整需求下的实测，0次失败</strong><br>短句另测：${(shortBundle?.cases||[]).map(r=>dur(r.agent_seconds)).join(' / ')}。<br>这几次属于同一修改版的不同测试。</p><a href="#latest-tests">查看所有实测 ↓</a></article></div>
 <p class="sub">统一采用Agent执行时间。R1还尝试了三维，各轮主题、网络与服务延迟也有变化；这些是实测记录，不是严格同条件的提速比例。</p>
 <section id="version-one-changes"><h2>第一轮优化：先解决超时与重复执行</h2>${table(['原来的问题','怎么修改','到R7的实际状态'],firstChanges)}<p class="sub">R7仍有额外确认和逐面装配；9次模型请求累计等待222.3秒，所以第二轮继续减少固定流程对模型的依赖。</p></section>
 <section id="version-two-changes"><h2>第二轮优化：让代码接手固定步骤</h2>${table(['第一轮还存在的问题','本轮具体修改'],secondChanges)}<p><strong>R8结果：</strong>决策模型从9次降为1次，模型请求与等待从222.3秒降为13.1秒；三张新图生成后批量装配，三面保存核验通过。</p><p class="v-note"><strong>仍有一个明确缺口：</strong>快速流程的识别条件过窄，还要求原话写出默认规格、背面和装配。两句真实短需求没有触发它，仍请求模型9次。这一点尚未修复，<strong>1分32秒不能当作普通短句的普遍速度</strong>。</p><p class="sub">素材准备并行，同一画稿仍保存3次。没有实现“一次原子保存”，也没有完成三维与印刷效果验收。</p></section>
 <section id="latest-tests"><h2>第三版：多次实测分别用了多久？</h2><div class="v-tests">${table(['测试输入','Agent耗时','模型请求','工具失败','参考USD','原始记录'],rows)}</div><h3>时间花在哪里？</h3><p class="sub">沿用相同颜色：绿色是模型等待，橙色是生图，蓝色是装配保存，灰色是其他时间。每条代表该次测试的总时间，色块越长，占比越大。</p><div class="v-timings">${timingBars}</div><p class="sub">各项排除了嵌套与并行重叠；灰色包含检查、三维尝试和流程衔接。这是时间占比，不是步骤的先后顺序。费用按记录用量与配置费率计算，不是供应商账单。</p><details><summary>查看三次测试的实际输入</summary>${runs.map(r=>`<p><strong>${esc(label(r))}</strong></p><blockquote>${esc(r.prompt)}</blockquote>`).join('')}</details><details><summary>查看三组画稿与原图</summary>${runs.map(gallery).join('')}</details></section>
 <details class="v-archive"><summary>中间试次与完整证据归档</summary><p>中间测试归入两轮优化，不再单独占用版本标签。</p><p><a href="B10-R2.html">任务状态修复</a> · <a href="B10-R3.html">新主题与18次模型调用分析</a> · <a href="B10-R4.html">并行对照</a> · <a href="B10-R5.html">自然语言调度</a> · <a href="B10-R6.html">提示词整理实验</a></p><p>提示词整理属于可选实验：R7实际增加约2.6秒；R8没有观察到执行。尚未证明它改善效果或稳定提速。</p><p><a href="B10-R8.html#r8-extra-findings">素材慢的定位与修复依据</a> · <a href="B10-R8.html#r8-concurrency">双项目并行验证</a> · <a href="B10-R8.html#r8-version">修改代码版本</a> · <a href="evidence/B10-R8-placement.json">R8脱敏证据</a> · <a href="evidence/B10-short-prompts.json">短句复测证据</a></p></details></div>`;
};
