'use strict';

const report = require('../content/useit/b04-retests-2026-11-19.json');

const tabs = `<nav class="tabs" aria-label="立牌测试记录">
  <a href="#b04-results">实测对比</a><a href="#b04-changes">流程改动</a>
  <a href="#b04-previews">三维成品</a><a href="#b04-original">原始记录</a>
</nav>`;

function duration(value) {
  if (!Number.isFinite(value)) return '未记录';
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`;
}

function render(baseline, { esc, table, external }) {
  const runs = report.cases;
  const interrupted = report.interrupted_attempts;
  const initial = {
    id: 'original', title: '旧版 B04', wall_seconds: baseline.submitted_to_finish_seconds,
    agent_seconds: baseline.agent_seconds, model_calls: baseline.groups['llm.plan'].count,
    tool_errors: baseline.failures.length, reference_usd: baseline.cost.reference_total_usd
  };
  const count = n => Number.isInteger(n) ? `${n} 次` : '未记录';
  const rows = [initial, ...runs].map(run => {
    const title = `<a href="#b04-${esc(run.id)}">${esc(run.title)}</a>`;
    const complete = run.status === 'completed';
    const stopped = run.status === 'incomplete';
    const retry = run.id === 'kakashi' && complete ? '<small>前两轮生图超时，此处为成功轮次</small>' : '';
    return [
      title + (stopped ? '<small>第二次尝试 · 未完成</small>' : retry),
      complete ? `<strong class="b04-duration">${duration(run.wall_seconds)}</strong>` : duration(run.wall_seconds) + (stopped ? '<small>到中止</small>' : ''),
      duration(run.agent_seconds), `<strong>${count(run.model_calls)}</strong>`, `<strong>${count(run.tool_errors)}</strong>` + (run.image_request_timeouts ? `<small>子请求超时 ${run.image_request_timeouts} 次</small>` : ''),
      Number.isFinite(run.reference_usd) ? '$' + run.reference_usd.toFixed(4) : '未记录'
    ];
  });
  const stages = [
    ['model', '等主模型'], ['images', '并行生图'], ['place', '装配与保存'], ['cut', '切线'],
    ['white', '白墨工具'], ['inspect', '检查母版'], ['render', '三维渲染'], ['other', '其他']
  ];
  const breakdown = runs.filter(run => run.groups);
  const stageTable = table(['案例', ...stages.map(([, title]) => title)], breakdown.map(run =>
    [esc(run.title), ...stages.map(([key]) => {
      const value = run.groups[key];
      return Number.isFinite(value) ? value.toFixed(1) : '—';
    })]
  ));
  function sample(run) {
    const title = esc(run.title);
    if (!run.image) {
      return `<p id="b04-${esc(run.id)}"><strong>${title}</strong> · ${esc(run.notes)} ${external(run.langfuse_url, 'Langfuse 链路')}</p>`;
    }
    const image = run.image ? `<a href="${esc(run.image)}"><img src="${esc(run.image)}" width="800" height="800" loading="lazy" decoding="async" alt="${title}的双插片亚克力立牌三维截图"></a>` : '';
    const dimensions = [...new Set(run.image_sizes || [])];
    const artwork = dimensions.length ? `<small>插片 ${esc(run.size_mm)} · 原图 ${esc(dimensions.join('、'))} 像素</small>` : '';
    const status = [run.status === 'incomplete' ? '本次流程未完成' : '', run.review_required > 0 ? `${run.review_required} 片切线待审核` : ''].filter(Boolean).join(' · ');
    return `<figure id="b04-${esc(run.id)}">${image}<figcaption>
      <strong>${title}</strong><p>“${esc(run.prompt)}”</p>
      ${run.notes ? `<p>${esc(run.notes)}</p>` : ''}${artwork}${status ? `<small>${esc(status)}</small>` : ''}${run.langfuse_url ? external(run.langfuse_url, 'Langfuse 链路') : ''}
    </figcaption></figure>`;
  }
  return `<section id="b04-results" class="b04-results">
    <h2>从发送需求到运行结束，实际用了多久？</h2>
    ${table(['实测', '发送到完成', 'Agent 执行', '主模型调用', '工具报错', '参考费用'], rows)}
    <p>索隆只用了 <strong>2 次主模型调用</strong>，整轮仍花了 <strong>8 分 15 秒</strong>。其中切线占 3 分 33 秒，白墨占 1 分 40 秒。</p>
    <p class="sub">原始测试为 2026-11-13，优化版为 ${esc(report.date)}。主模型调用和生图请求分别计数，参考费用按记录用量和本地费率折算为美元。</p>
    <details><summary>查看中止的 ${interrupted.length} 次尝试与费用</summary>
      ${interrupted.map(attempt => `<p><strong>${esc(attempt.title)}</strong> · ${esc(attempt.reason)}${Number.isFinite(attempt.wall_seconds) ? '从发送到中止 ' + duration(attempt.wall_seconds) : 'Agent 执行 ' + duration(attempt.agent_seconds)}，主模型 ${attempt.model_calls} 次，参考费用 $${attempt.reference_usd.toFixed(4)}。${external(attempt.langfuse_url, '查看链路')}</p>`).join('')}
      <p class="sub">卡卡西这两轮的外层工具都报告 0 次报错，生图服务每轮各有 2 次超时。</p>
    </details>
    ${breakdown.length ? `<details><summary>查看优化版 Agent 分步耗时（秒）</summary>${stageTable}</details>` : ''}
  </section>
  <section id="b04-changes" class="b04-changes"><h2>原来慢在哪里，新版怎么做？</h2>
    ${table(['环节', '旧版遇到的问题', '新版怎么做，保留了什么'], [
      ['理解与计划', `模型逐步查规格、填计划、选工具，默认规格也要等用户确认。整次运行<strong>共请求主模型 ${initial.model_calls} 次，等待 ${baseline.groups['llm.plan'].seconds.toFixed(1)} 秒</strong>。`,
        '<strong>模型选款、设计画面</strong>。程序保留用户指定的尺寸、片数和层距，缺项用所选款式的默认值补齐。模型据此决定每片画什么、前后怎么摆。'],
      ['生图与装配', '前景做完才生背景，两张画稿也要先后读取和装入。',
        '<strong>两片共用画风，并行生成两张透明原图</strong>。两张原图一起提交，程序并行读取、依次写入同一母版，按插片编号核对原图和保存版本。'],
      ['切线与白墨', '切线写回时遇到母版版本变化，白墨工具也拒绝过面片和来源参数。旧母版最后仍显示白墨过期。',
        '<strong>按插片分别切线和检查白墨</strong>。沿画面轮廓生成切线与插脚，底座按插脚生成槽位。已有白墨有效就复用，缺失或过期才重做，再读母版核对。'],
      ['三维展示', '两次截图都失败，旧记录只能看到二维画稿，前后遮挡无从检查。',
        '<strong>从保存的母版渲染三维图</strong>。沿用软件预览的结构和贴图，等两片纹理加载完成，并核对截图与已检查母版的版本。']
    ])}
  </section>
  <section id="b04-previews"><h2>实测三维成品</h2>
    <p class="sub">点击截图可放大检查前后遮挡和底座。标为「待审核」的切线仍需工艺复核。</p>
    <div class="gallery b04-shots">${runs.filter(run => run.image).map(sample).join('')}</div>
    ${runs.filter(run => !run.image).map(sample).join('')}
    <p><a href="../../../content/useit/b04-retests-2026-11-19.json">查看各例实测数据</a></p>
  </section>
  <section id="b04-original"><p class="eyebrow">2026.11.13 / 原始测试</p><h2>旧版 B04 的画稿、耗时与报错记录</h2></section>`;
}

module.exports = { render, tabs, date: report.date };
