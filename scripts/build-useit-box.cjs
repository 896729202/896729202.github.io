// Independent B01 evidence; kept separate from live Agent retest pages.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='useit/tests/2026-11-13';
const r=JSON.parse(fs.readFileSync(path.join(root,'content/useit/box-fit-2026-11-14.json'),'utf8'));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sec=n=>Number(n).toFixed(3)+' 秒';
const table=(headers,rows)=>`<div class="table-wrap" tabindex="0" role="region" aria-label="${esc(headers.join(' / '))}"><table><thead><tr>${headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const session=`${r.langfuse_base}/sessions/${r.original_session}`,trace=`${r.langfuse_base}/traces/${r.original_trace}`;
const failed=r.panels.filter(p=>p.before_error);
const fix=`<div class="box-fix"><h3>怎么解决</h3><ol>${r.fixes.map(x=>`<li><strong>${esc(x.title)}。</strong>${esc(x.detail)}</li>`).join('')}</ol><p>没有把这 5 个面跳过，也没有关掉安全检查强行放图。目标刀版尺寸和结构保持不变。</p></div>`;
const overview=`<p><strong>问题：</strong>一张完整展开图装进插盖盒时，13 个面里有 5 个未通过检查，程序因此拒绝整版装配。</p><p><strong>原因：</strong>画稿的青色背景和辅助折线颜色接近，旧算法把部分画稿当成了线条；生成图的折线又有约 80–95 像素偏移，需要放宽搜索范围，进一步扩大了误清理。于是出现“画面被清空”“多出假孔”和“轮廓边界不合格”。</p>${fix}`;
const short=`<section class="verdict" id="box-fit-investigation"><p class="eyebrow">2026-11-14 / 插盖盒专项修复</p><h2>五个面为什么对不上，现已定位</h2>${overview}<p><strong>独立回放：</strong>相同原图、相同刀版，配准从 8/13 提高到 13/13；隔离浏览器已验证 13 面切图与副本保存。状态仍为 <code>needs_review</code>，尚未做应用内完整复测和三维验收。</p><p><a href="B01-R1.html">查看 B01-R1：逐面原因、修复图片、耗时与验证结果 →</a></p><p class="sub">本页保留原始失败记录。旧“无报错估算”是失败区间的机械扣减，不是这次修复后测得的完整任务时间；两次回调超时的底层原因仍未证实。</p></section>`;
const figure=(src,title,caption)=>`<figure><a href="images/${src}"><img src="images/${src}" alt="${esc(title)}" loading="lazy"></a><figcaption><strong>${esc(title)}</strong><br>${caption}</figcaption></figure>`;
const body=`<nav class="crumb"><a href="../../index.html">USEIT</a><span>/</span><a href="B01.html">B01 原始测试</a><span>/</span>B01-R1 独立回放</nav>
<header class="report-hero"><p class="eyebrow">B01-R1 / 插盖盒 / 配准修复</p><h1>五个面曾对不上，<br><em>现在 13 面均已配准。</em></h1><p>原图没有重画，刀版没有改变。修复了辅助线识别和清理逻辑。<br><strong>独立回放通过，边缘仍需复核；应用内完整流程与三维尚未复测。</strong></p><div class="date-tag">测试日期　2026.11.14 <span>原始测试：2026.11.13 · 北京时间</span></div></header>
<div class="metrics"><div><small>修复后的本地配准</small><strong>${sec(r.after.elapsed_seconds)}</strong></div><div><small>隔离切图与副本装配</small><strong>${sec(r.assembly.elapsed_seconds)}</strong></div><div><small>相关自动检查</small><strong>${r.checks.total_passed}<em> 项通过</em></strong></div><div><small>本次新增模型费用</small><strong>$0.00</strong></div></div>
<p class="sub">两段时间分别测量，不包含 Agent 思考、生图、下载、应用或云端保存等待，不能相加当作完整任务完成时间。浏览器检查另列，不计入 84 项。</p>
<nav class="jump"><a href="#problem">问题与修改</a><a href="#faces">五个面逐项说明</a><a href="#pictures">图片对照</a><a href="#results">测试结果</a><a href="#evidence">日志与版本</a></nav>
<section id="problem"><h2>01 / 问题 → 原因 → 解决</h2>${overview}<p><strong>证据怎样连起来：</strong>Langfuse 记录了失败调用和 5 个面名，但没有保存内部的逐面几何原因。读取原项目的同一张图片和母版，在本地重跑旧算法，复现了完全相同的 5 个失败面，才获得下面的具体原因。</p></section>
<section id="faces"><h2>02 / 到底是哪五个面出了什么问题</h2>${table(['位置','旧算法检查结果','通俗解释','修复后'],failed.map(p=>[`${esc(p.label)}<br><small>${esc(p.face)}</small>`,esc(p.before_error),esc(p.cause),'已配准并写入隔离副本']))}<p class="sub">这里保留几何 face ID 便于定位。原回执中的 back 曾显示为“正面”；这个旧界面标签与几何命名不一致，不能据此判断贴图翻面。此次没有改名或交换面片。</p><p>粘口和下插舌不是原图没内容，而是处理时把内容误删了。边界检查报错也不是“放大一点就好”：程序必须确保取样仍来自对应的面。</p></section>
<section id="pictures"><h2>03 / 原图与修复后的展开稿</h2><div class="box-pictures">${figure('B01-R1-original.webp','原始生图 · 未重新生成','沿用 11 月 13 日真实生成图片；蓝绿色画面和辅助折线非常接近。人物情节为虚构幽默创作。')}${figure('B01-R1-fitted.webp','修复后 · 13 面配准预览','本地算法实际输出，已去辅助线并映射回目标刀版；不是 AI 重新绘制的效果图，也不是三维截图。')}</div>${figure('B01-R1-diagnostic.webp','定位图 · 目标轮廓、检测轮廓与旧辅助线识别范围','技术诊断图：对照目标位置和旧算法检测结果，定位被误判的颜色区域。点击图片查看大图。')}<p>整体预览可见人物、文字、粘口和插舌内容。小边缘仍需检查：右侧面和左侧面的边界残差分别约 <strong>5.38、5.43 原图像素</strong>，高于 4 像素的提醒阈值。</p></section>
<section id="results"><h2>04 / 修复后，独立验证到了哪一步</h2>${table(['验证步骤','实际做了什么','结果'],[
 ['旧算法回放','用原图、原刀版重跑，记录每个面的错误。',`8/13；${sec(r.before.elapsed_seconds)}；相同 5 面失败`],
 ['修复后配准','优先识别线条核心，缩小清线范围；继续执行几何安全检查。',`13/13；${sec(r.after.elapsed_seconds)}；needs_review`],
 ['隔离浏览器装配','运行实际光栅化、13 面切图、装配、版本记录代码；保存接口写入隔离副本。',`${sec(r.assembly.elapsed_seconds)}；保存 1 次、版本 1 个；重新读取 13 面均有图`],
 ['结构与原文件保护','对比刀版数据、结构层和原文件 SHA-256。','刀版与结构层未改；原项目图片、母版未改'],
 ['相关自动检查','Python 配准测试 32 项；前端装配测试 52 项。','84 项通过；不是全仓测试'],
 ['应用内完整流程 / 三维','按本轮要求仅做独立验证，未操作主聊天窗口。','未运行；不能声称云端保存、回调或成品验收已通过']])}
<div class="verdict"><h3>为什么还是 needs_review</h3><p>13 面已全部映射，所有面网格翻转数为 0、越界取样像素为 0。但仍检测到额外区域，且左右侧面存在边缘残差。因此保留复核提示，没有把“能装入”写成“可以直接印刷”。</p></div>
<details><summary>查看全部 13 个面的检查数据</summary>${table(['面片','原状态','修复后','边界残差 p95（原图像素）','网格翻转 / 越界取样'],r.panels.map(p=>[`${esc(p.label)} · ${esc(p.face)}`,p.before_error?'失败':'通过','已映射',Number(p.boundary_p95_source_px).toFixed(3),`${p.mesh_flips} / ${p.sampling_outside_panel_px}`]))}<p>p95 是边界样本误差的第 95 百分位，不是最大误差，也不是印刷公差。</p></details>
<h3>耗时改善与费用</h3><p>本机同一图片的两次配准回放：<strong>${sec(r.before.elapsed_seconds)} → ${sec(r.after.elapsed_seconds)}</strong>。旧版尝试 ${r.before.attempts} 组识别配置，修复版 ${r.after.attempts} 组后得到完整映射。只有一个案例，不能据此承诺其他盒型都能同幅提速。</p><p>${esc(r.cost.basis)}</p><p>原 B01 曾经发生的生图调用和美元参考费用仍在 <a href="B01.html#cost">原始任务费用记录</a>，不会因这次本地复测而归零。</p></section>
<section id="evidence"><h2>05 / 原始日志、修改版本和可核查记录</h2><p><a href="${esc(session)}">原始 Langfuse Session ↗</a> · <a href="${esc(trace)}">原始制作 Trace ↗</a> · <a href="evidence/B01-R1-fit.json">本次脱敏回放数据 JSON</a></p><p>本次直接运行本地算法与隔离浏览器，没有新 Agent 会话，也没有新的 Langfuse 链路。以下链接对应原始失败，不冒充本次复测。</p>${table(['原调用','耗时','在做什么 / 失败位置'],r.errors.map(e=>[`<a href="${esc(trace+'?observation='+e.observation)}">${esc(e.tool)} ↗</a>`,sec(e.seconds),esc(e.what)]))}
<details><summary>查看具体修改版本、数据指纹和提示</summary><p>${esc(r.code_version.label)}。这些业务代码来自含其他在做修改的本地工作区；文件指纹用于锁定回放版本，不宣称已部署到线上应用。</p>${table(['文件','SHA-256'],r.code_version.files.map(f=>[esc(f.path),`<code>${esc(f.sha256)}</code>`]))}<p>原图 SHA-256：<code>${esc(r.source_sha256)}</code><br>原母版 SHA-256：<code>${esc(r.master_sha256)}</code><br>几何指纹：<code>${esc(r.geometry_fingerprint)}</code></p><pre>${esc(JSON.stringify({warnings:r.after.warnings,browser_observed_at:r.assembly.observed_at},null,2))}</pre></details>
<p class="sub">尚未解决或尚未证实的范围：原始两次回调超时的底层原因；应用内完整流程；三维预览和印刷验收。后续完整测试应单独记录，不能覆盖此次独立回放的证据边界。</p></section><a class="back-link" href="B01.html">← 返回 B01 原始测试</a>`;
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const header=home.match(/<header class="site-header">[\s\S]*?<\/header>/)[0].replaceAll('href="./','href="../../../');
const css=`.box-pictures{display:grid;grid-template-columns:1fr 1fr;gap:24px}.box-pictures figure{margin:0}.box-pictures img,section>figure img{width:100%;height:auto;border:1px solid var(--u-border);border-radius:10px;background:white}figcaption{font-size:14px;line-height:1.8;padding:12px 0;color:var(--u-muted)}section{margin-top:42px;scroll-margin-top:90px}section p,section li{line-height:1.9}.box-fix{background:var(--u-paper);border-left:3px solid var(--u-accent);padding:10px 24px;margin:22px 0}.box-fix li{margin:12px 0}.table-wrap td{vertical-align:top;min-width:100px}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}section>figure{margin:28px 0}#faces .table-wrap table{min-width:760px}@media(max-width:700px){.box-pictures{grid-template-columns:1fr}}`;
const html=`<!doctype html><html lang="zh-CN" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B01-R1 插盖盒：五个面配准修复 · USEIT</title><meta name="description" content="原图复现五面失败，定位青色画稿误识别与折线偏移；修改后13面配准，独立装配验证通过，保留边缘复核提示。"><link rel="canonical" href="https://896729202.github.io/${base}/B01-R1.html"><link rel="stylesheet" href="../../../assets/site.css"><link rel="stylesheet" href="../../../assets/useit.css"><style>${css}</style><script>try{document.documentElement.dataset.theme=localStorage.getItem('notebook-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')}catch(e){}</script><script defer src="../../../assets/site.js"></script></head><body class="useit"><a class="skip-link" href="#main">跳到主要内容</a>${header}<main id="main" class="u-main">${body}</main><footer class="u-footer">USEIT / 独立回放 · 2026.11.14 <span>保留原始失败；明确验证范围</span></footer></body></html>`;
fs.writeFileSync(path.join(root,base,'B01-R1.html'),html);
fs.mkdirSync(path.join(root,base,'evidence'),{recursive:true});
fs.writeFileSync(path.join(root,base,'evidence/B01-R1-fit.json'),JSON.stringify(r,null,2)+'\n');
function inject(file,marker,fragment,anchor){
 const p=path.join(root,file);let text=fs.readFileSync(p,'utf8');
 if(file==='useit/index.html' && text.includes('data-useit-home'))return;
 const block=`<!-- ${marker}:start -->${fragment}<!-- ${marker}:end -->`;
 const re=new RegExp(`<!-- ${marker}:start -->[\\s\\S]*?<!-- ${marker}:end -->`);
 if(re.test(text))text=text.replace(re,()=>block);
 else {if(!text.includes(anchor))throw Error(`Missing insertion point in ${file}`);text=text.replace(anchor,()=>block+anchor);}
 fs.writeFileSync(p,text);
}
inject(`${base}/B01.html`,'B01-FIT-UPDATE',short,'<section id="chain">');
inject(`${base}/index.html`,'B01-FIT-UPDATE','<p class="verdict"><strong>插盖盒专项更新：</strong>原图复现并修复 5 个面配准失败，13 面独立回放通过，边缘仍需复核。<a href="B01-R1.html">B01-R1 原因、修复与独立验证 →</a>（不计入原始 15 次 Agent 测试）</p>','<div class="section-heading catalog-title">');
inject('useit/index.html','B01-FIT-UPDATE','<p class="verdict"><strong>插盖盒：五面配准问题已定位并修复。</strong><br>相同原图回放 13/13 面映射，隔离装配验证通过；应用内完整复测待做。<a href="tests/2026-11-13/B01-R1.html">查看 B01-R1 独立验证 →</a></p>','</main>');
console.log('Built B01-R1 independent replay and linked original B01 / USEIT indexes.');
require('./build-useit-box-v1.cjs');
