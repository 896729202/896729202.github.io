'use strict';

// Homepage content has one owner. Case builders keep their detailed notices on
// case/report pages; the homepage collects verified updates as short news.
const fs = require('node:fs');
const path = require('node:path');
const stylesheet = '<link rel="stylesheet" href="../assets/useit-home.css?v=20261116-2">';

function renderHome({retestCount = 9, root = path.resolve(__dirname, '..')} = {}) {
  const flatCard = require('./build-useit-flat-card.cjs').loadReadyBundle(root)?.report;
  const flatCardUI = require('./useit-b07-optimization.cjs');
  if (!Number.isInteger(retestCount) || retestCount < 0) throw new Error('Invalid retest count');
  return `<div class="useit-home" data-useit-home>
  <nav class="crumb"><a href="../index.html">知识手记</a><span>/</span>USEIT</nav>
  <header class="report-hero home-hero">
    <p class="eyebrow">PRODUCT / EXPERIMENTS / EVIDENCE</p>
    <h1>USEIT <em>测试与观察。</em></h1>
    <p>看生成效果，也看它如何发生。<br>真实测试、代码架构与每一次改进，记录在这里。</p>
  </header>
  <div class="home-layout">
    <div class="home-features" aria-label="USEIT 板块">
      <a class="home-card home-report" href="tests/2026-11-13/index.html">
        <div class="home-card-heading"><p class="eyebrow">01 / 全品类测试</p><h2>12 个品类，<br>完整生成链路。</h2><p>从最终画稿，追到耗时、错误与调用记录。</p></div>
        <div class="home-report-image"><img src="tests/2026-11-13/images/B09-R1-1.webp" alt="真实测试产物：带主题画稿的马克杯三维截图" width="400" height="400"><span>真实测试产物 / 马克杯</span></div>
        <div class="home-report-meta"><time datetime="2026-11-13">2026.11.13 — ${flatCard?'11.16':'11.15'}</time><p>原报告 15 次测试 · 另有 ${retestCount} 次独立复测<br>图片 · 时间分布 · 参考费用 · Langfuse</p></div>
        <strong class="home-card-link">查看测试报告 <span aria-hidden="true">→</span></strong>
      </a>
      <a href="architecture.html" class="home-card home-report home-architecture" id="architecture" aria-labelledby="architecture-title">
        <div class="home-card-heading"><p class="eyebrow">02 / 代码架构 →</p><h2 id="architecture-title">一句需求，<br>如何找到制作流程？</h2><p>模型理解需求，代码分派到对应制品。</p></div>
        <figure class="home-flow" aria-label="用户输入，模型选品，代码校验和分派到光栅卡、盒子或其他模块，再调用共享工具并核验结果">
          <div class="home-flow-node">用户输入需求</div><div class="home-flow-arrow" aria-hidden="true">↓</div>
          <div class="home-flow-node">模型理解与选品<small>确定品类、款式与本次操作</small></div><div class="home-flow-arrow" aria-hidden="true">↓</div>
          <div class="home-flow-node home-flow-router">代码校验 → 统一分派<small>按“品类＋款式”找到独立模块</small></div>
          <div class="home-flow-fork" aria-hidden="true"></div>
          <div class="home-flow-branches"><div>光栅卡<br><small>独立模块</small></div><div>盒子<br><small>独立模块</small></div><div>其他制品<br><small>各自模块</small></div></div>
          <div class="home-flow-fork home-flow-merge" aria-hidden="true"></div>
          <div class="home-flow-node">共享工具<small>按需生图、下载、装配与保存</small></div><div class="home-flow-arrow" aria-hidden="true">↓</div>
          <div class="home-flow-node">核验实际结果 → 返回用户</div>
          <figcaption>需要展示时，再调用对应产品的前端适配器。</figcaption>
        </figure>
        <p class="home-architecture-note"><strong>当前状态：</strong>${flatCard?`${flatCard.test_scope==='integration'?'光栅卡已自动续接；普通双面卡独立自动流程已通过集成复测，正常聊天入口仍待验证。':'光栅卡与普通双面卡的新建画稿任务已接入各自自动流程；其他制品保留独立入口，可分别优化。'}<time datetime="2026-11-16">架构版本 · 2026.11.16</time>`:'光栅卡已自动续接装配与核验；其他制品保留原工具流程，可分别优化。<time datetime="2026-11-15">架构版本 · 2026.11.15</time>'}</p>
        <strong class="home-card-link">查看代码阅读指南 →</strong>
      </a>
      <div id="langfuse" style="grid-column:1/-1">
        <a href="langfuse/index.html" class="home-card home-report" aria-labelledby="langfuse-title">
          <div class="home-card-heading"><p class="eyebrow">03 / Langfuse</p><h2 id="langfuse-title">Langfuse 问题回放</h2><p>逐轮对照用户原话、Agent 回复和实际生成的图片。</p></div>
          <strong class="home-card-link">查看问题例子 <span aria-hidden="true">→</span></strong>
        </a>
        <a class="u-button" style="margin-top:10px" href="langfuse/context-management.html">长上下文管理 →</a>
      </div>
    </div>
    <aside class="home-news" aria-labelledby="home-news-title">
      <div class="home-news-heading"><h2 id="home-news-title">News <span>更新记录</span></h2><span class="home-news-count">${flatCard?'04':'03'}</span></div>
      <ol class="home-news-list">
        ${flatCard?flatCardUI.homeNews(flatCard):''}
        <li><div class="home-news-meta"><time datetime="2026-11-15">11.15</time><span class="home-news-tag home-news-warning">完整复测</span></div><h3><a href="tests/2026-11-13/B01-V1.html">插盖盒：新图流程仍未通过 <span aria-hidden="true">↗</span></a></h3><p>left 面配准失败，整版未保存，最终为白模。</p><p class="home-news-facts"><strong>4分52秒</strong> · 6次失败或拒绝<br>参考费用 $0.4944</p></li>
        <li><div class="home-news-meta"><time datetime="2026-11-15">11.15</time><span class="home-news-tag">优化记录</span></div><h3><a href="tests/2026-11-13/B10-latest.html">光栅卡：三版本、两轮优化 <span aria-hidden="true">↗</span></a></h3><p class="home-news-path"><a href="tests/2026-11-13/B10-R1.html">15分01秒</a><span>→</span><a href="tests/2026-11-13/B10-R7.html">5分10秒</a><span>→</span><a href="tests/2026-11-13/B10-latest.html#latest-tests"><strong>1分32秒</strong></a></p><p>历史代表实测；长短需求耗时不同，最快一轮不代表通用速度。</p></li>
        <li><div class="home-news-meta"><time datetime="2026-11-14">11.14</time><span class="home-news-tag">旧图回放</span></div><h3><a href="tests/2026-11-13/B01-R1.html">插盖盒：五面配准修复 <span aria-hidden="true">↗</span></a></h3><p>同一原图 <strong>13/13 面映射通过</strong>，隔离装配验证通过，边缘仍需复核。</p><p class="home-news-footnote">这是旧图回放；新图完整测试见上方记录。</p></li>
      </ol>
      <p class="home-news-updated">页面整理于 <time datetime="2026-11-16">2026.11.16</time></p>
    </aside>
  </div>
</div>`;
}

function refreshHome(root = path.resolve(__dirname, '..')) {
  const file = path.join(root, 'useit/index.html');
  let html = fs.readFileSync(file, 'utf8');
  const retestCount = Number(html.match(/另有\s*(\d+)\s*次独立复测/)?.[1] ?? 9);
  if (!/<main\b[\s\S]*?<\/main>/.test(html)) throw new Error('Missing homepage main');
  html = html.replace(/<main\b[^>]*>[\s\S]*?<\/main>/, () => `<main id="main" class="u-main">${renderHome({root,retestCount})}</main>`);
  html = html.replace(/<body class="([^"]*)">/, (_, classes) => `<body class="${[...new Set([...classes.split(/\s+/), 'useit-home-page'])].join(' ')}">`);
  html = html.replace(/<link\b[^>]*href="[^"]*useit-home\.css[^"]*"[^>]*>/g, '');
  html = html.replace('</head>', stylesheet + '</head>');
  html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="USEIT 测试与观察：12种代表性制品测试、按品类分派的代码架构，以及简明更新记录。">');
  fs.writeFileSync(file, html);
  require('./useit-architecture.cjs').buildArchitecture(root, html);
}

module.exports = {renderHome, refreshHome};
if (require.main === module) refreshHome();
