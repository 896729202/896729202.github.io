'use strict';
const fs = require('node:fs');
const path = require('node:path');
const agent = 'https://github.com/UseIt-AI/useit-agent-internal/blob/bajuyan/agent/';
const front = 'https://github.com/UseIt-AI/useit-studio-frontend/blob/bajuyan/src/features/workspace/canvas/product-preview/';
const link = (url, label) => `<a href="${url}">${label}</a>`;
function buildArchitecture(root, shell) {
  const rows = [
    ['① 保存计划', link(agent+'agent_loop/execution/actions/project_plan.py#L56','project_plan.py → handle() · 第 56 行'), '接收模型选好的产品计划，校验、保存，然后调用分派器。'],
    ['② <strong>重点：统一分派</strong>', link(agent+'agent_loop/product_workflows/registry.py#L36','registry.py → resolve_workflow()、on_plan_saved() · 第 36 行'), '<strong>按“品类＋款式”找对应模块</strong>；找不到具体款式时，再走品类入口。'],
    ['③ 款式登记表', link(agent+'agent_loop/product_workflows/variants/__init__.py#L24','variants/__init__.py → PRODUCT_WORKFLOWS · 第 24 行'), '款式与函数的对应表，例如盒子指向 <code>tuck_box.prepare</code>。'],
    ['④ <strong>光栅卡</strong>', link(agent+'agent_loop/product_workflows/lenticular.py#L457','lenticular.py → prepare() · 第 457 行'), '流程入口。接着看 <code>activate()</code>、<code>register_artwork_set()</code>、<code>run_pending()</code>、<code>accept_callback()</code>：<strong>启动 → 接收素材 → 批量装配及查询 → 核验保存结果</strong>。'],
    ['⑤ <strong>盒子</strong>', link(agent+'agent_loop/product_workflows/variants/tuck_box.py#L5','tuck_box.py → prepare() · 第 5 行'), '盒子独立入口，规定刀线、配准、装配与核验要求。'],
    ['⑥ 前端展示', link(front+'geometryAdapters/registry.ts#L28','geometryAdapters/registry.ts → resolveProductGeometry() · 第 28 行'), '根据产品选择光栅卡、盒子等对应的结构适配器。'],
  ];
  const body = `<nav class="crumb"><a href="index.html">USEIT</a><span>/</span>02 / 代码架构</nav>
  <header class="report-hero"><p class="eyebrow">02 / CODE ARCHITECTURE</p><h1>顺着一条需求，<br><em>读懂制作流程。</em></h1><p>用户需求如何找到对应品类，以及每一步该看哪个文件、哪个函数。</p><p class="sub">记录日期：2026.11.16 · 代码分支：bajuyan · 文件链接直达 GitHub 对应行；私有仓库需登录查看。</p></header>
  <section><h2>按这条线读就行</h2><div class="architecture-reading-flow" aria-label="用户需求到前端展示的流程">
  <div>用户需求</div><span>↓</span><div>模型选择品类、款式，写入产品计划</div><span>↓</span><div>校验并保存计划</div><span>↓</span><div><strong>统一分派器</strong><p>光栅卡流程 ／ 盒子流程 ／ 其他款式流程</p></div><span>↓</span><div>共享生图、装配、保存工具</div><span>↓</span><div>前端选择对应产品结构并展示</div></div></section>
  <section><h2>文件与函数阅读顺序</h2><p><strong>先看②，再对照④和⑤，最容易理解这次拆分。</strong></p><div class="table-wrap"><table><thead><tr><th>顺序</th><th>看哪个文件、函数</th><th>主要看什么</th></tr></thead><tbody>${rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')}</tbody></table></div></section>
<details class="home-architecture-detail"><summary>“品类”和“款式”有什么区别？</summary><p><strong>品类是大分类，款式是具体产品结构。</strong></p><dl><div><dt>卡片</dt><dd>普通双面卡、立体折叠卡</dd></div><div><dt>周边制品</dt><dd>亚克力挂件、徽章、马克杯</dd></div><div><dt>光栅卡</dt><dd>双图变图卡</dd></div></dl><p>“小狐狸、GTA6、小熊露营”是画面主题，同一个款式可以换不同主题。</p><p>当前有 <strong>13 个顶层品类入口、12 个具体款式入口</strong>；测试报告的“12 个品类”是 12 种代表性制品，与顶层目录的计数口径不同。</p></details>
  <aside class="verdict"><strong>当前实现边界</strong><p>目前各款式已有独立入口，但<strong>只有光栅卡接入了完整的自动续接流程</strong>；其他款式仍由模型安排原有工具，并非全部已经自动化。</p><p>品类是大分类，款式是具体产品结构；例如“包装 → 插盖盒”。画面主题不会改变款式。“品类分开”也不等于完全不共享代码，生图、下载、存储等公共能力仍然复用。</p></aside><p><a href="index.html#architecture">← 返回 USEIT 首页</a></p>`;
  let html = shell.replace(/<main\b[^>]*>[\s\S]*?<\/main>/,()=>`<main id="main" class="u-main architecture-guide">${body}</main>`)
    .replace(/<title>[^<]*<\/title>/,'<title>代码架构与阅读指南 · USEIT</title>')
    .replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="USEIT 代码阅读指南：产品计划、品类分派、光栅卡、盒子流程与前端结构适配。">')
    .replace(/<link rel="canonical" href="[^"]*">/,'<link rel="canonical" href="https://896729202.github.io/useit/architecture.html">');
  html = html.replace('</head>','<style>.architecture-reading-flow{max-width:660px;margin:24px auto;text-align:center}.architecture-reading-flow>div{padding:18px;border:1px solid var(--u-border);border-radius:8px;background:var(--u-paper);line-height:1.8}.architecture-reading-flow>span{display:block;padding:7px;color:var(--u-accent)}.architecture-reading-flow p{margin:8px 0 0;color:var(--u-accent)}.architecture-guide td:nth-child(1){min-width:120px}.architecture-guide td:nth-child(2){min-width:230px;overflow-wrap:anywhere}.architecture-guide td:nth-child(3){min-width:260px}.architecture-guide td{font-size:14px;padding:18px;line-height:1.9}</style></head>');
  fs.writeFileSync(path.join(root,'useit/architecture.html'),html);
}
module.exports = {buildArchitecture};
