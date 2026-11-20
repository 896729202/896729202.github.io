'use strict';

const report = require('../content/useit/b04-retests-2026-11-19.json');
const workflow = require('../content/useit/b04-rounds-2026-11-13.json');
const cutComparison = require('../content/useit/b04-cut-2026-11-20.json');
const interrupted = report.interrupted_attempts || [];
const dates = [...new Set([...report.cases, ...interrupted].map(run => run.date).filter(Boolean))].sort();
const latestDate = dates.at(-1) || report.date;
const dateRange = dates.length > 1 ? `${dates[0]} 至 ${latestDate}` : latestDate;

const tabs = `<nav class="tabs" aria-label="立牌测试记录">
  <a href="#b04-results">实测对比</a><a href="#b04-cut">切线耗时</a><a href="#b04-changes">流程改动</a>
  <a href="#b04-rounds">逐轮对照</a>
  <a href="#b04-previews">三维成品</a><a href="#b04-original">原始记录</a>
</nav>`;

function duration(value) {
  if (!Number.isFinite(value)) return '未记录';
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`;
}

function cutResults(table) {
  const seconds = s => (Math.round(Math.round(s * 1000) / 10) / 100).toFixed(2);
  const rows = Object.values(cutComparison.samples).map(run => {
    const editor = run.editor_disk_s;
    const saved = editor.old - editor.new;
    return [run.title, `${run.old_calls} → ${run.new_calls} 次`,
      `${seconds(run.API_old_s)} → ${seconds(run.API_new_s)} 秒`,
      `${seconds(editor.old)} → <strong>${seconds(editor.new)} 秒</strong>`,
      `${saved > 0 ? '快' : '慢'} ${Math.abs(saved).toFixed(1)} 秒`];
  });
  return `<section id="b04-cut"><p class="eyebrow">2026.11.20 / 同图本地复测</p><h2>切线优化前后，做完前后两片用了多久？</h2>
    <p><strong>原来</strong>，插片超出成品尺寸时，编辑器每调一次尺寸就重新准备、发送一次画稿。<strong>现在</strong>，每片只发一次原稿，切线服务按原精度完成测量、缩放和复算。编辑器核对缩放和位置后才保存，有偏差就走原来的逐轮计算。</p>
    ${table(['样本（前后两片合计）', '切线请求（旧 → 新）', '切线接口（旧 → 新）', '编辑器切线并保存（旧 → 新）', '编辑器用时变化'], rows)}
    <p>三款共 <strong>13 → 6 次切线请求</strong>。逐片对比保存的画稿，六片切线路径、插脚尺寸和对应底座槽位均与原稿一致，工艺状态仍为「待审核」。</p>
    <p>女帝旧版的两份回执生成后，客户端合计等了 <strong>23.1 秒</strong>才发出。新版让桌面窗口持续运行到回执发出，并记录后台收件时间。新版完整对话的回执提速仍待实测。</p>
    <p class="sub">两列耗时分别来自切线接口测试和编辑器保存测试，各自使用相同原稿比较新旧版本。两列不能相加，均不含生图、聊天和云端同步。<a href="../../../content/useit/b04-cut-2026-11-20.json">查看逐款实测数据</a></p>
  </section>`;
}

function flowComparison(baseline, esc) {
  const observations = baseline.observations;
  const failures = new Set(baseline.failures.map(failure => failure.observation_id));
  const kakashi = report.cases.find(run => run.id === 'kakashi' && run.status === 'completed');
  const planning = kakashi?.plan_seconds;
  const latest = planning?.length === 2 && planning.every(Number.isFinite) && Number.isFinite(kakashi.groups?.images)
    ? `<p class="b04-flow-latest"><strong>${esc(kakashi.title)} · ${esc(kakashi.date)}</strong>　第一次等模型 ${planning[0].toFixed(1)} 秒，确定产品并提交制作计划。第二次等 ${planning[1].toFixed(1)} 秒，一次写好两片的创意。随后生图服务并行生成两张图，整段 ${kakashi.groups.images.toFixed(1)} 秒，代码接手装配、工艺检查与三维截图。</p>` : '';
  function originalRound(round) {
    const model = observations.find(obs => obs.id === round.observation_id && obs.name === 'llm.plan');
    if (!model) throw new Error(`B04 找不到第 ${round.number} 轮的模型观测`);
    const tool = observations.find(obs => obs.name.startsWith('tool.') && obs.traceId === model.traceId
      && obs.parentObservationId === model.parentObservationId && obs.step === model.step);
    if (!tool) throw new Error(`B04 找不到第 ${round.number} 轮随后的工具回执`);
    const toolSeconds = tool.duration_ms / 1000;
    return `<li id="b04-round-${round.number}">
      <div class="b04-round-heading"><strong>第 ${round.number} 轮</strong><span>主模型 API · ${round.seconds.toFixed(1)} 秒</span></div>
      <p>${esc(round.purpose)}</p>
      <p class="b04-tool-action"><strong>随后</strong> ${esc(round.action)}</p>
      <small><code>${esc(tool.name.slice(5))}</code> · 工具 ${toolSeconds.toFixed(toolSeconds < 1 ? 3 : 1)} 秒${failures.has(tool.id) ? ' · <b>报错</b>' : ''}</small>
    </li>`;
  }
  const groups = workflow.groups.map((group, index) => {
    const rounds = workflow.rounds.filter(round => round.number >= group.start && round.number <= group.end);
    const wait = rounds.reduce((seconds, round) => seconds + round.seconds, 0);
    const range = group.start === group.end ? group.start : `${group.start}–${group.end}`;
    return `<details class="b04-flow-stage"${index === 0 ? ' open' : ''}>
      <summary><strong>${esc(group.title)}</strong> <span>原第 ${range} 轮 · 等模型 ${wait.toFixed(1)} 秒</span></summary>
      <div class="b04-flow-pair" tabindex="0" role="region" aria-label="${esc(group.title)}新旧流程对照">
        <div class="b04-flow-before"><h3>旧版 · 逐轮执行</h3><ol start="${group.start}">${rounds.map(originalRound).join('')}</ol></div>
        <div class="b04-flow-after"><h3>新版 · 怎样接续</h3><p>${esc(group.after)}</p>
          <h4>为什么能替代</h4><p>${esc(group.reason)}</p></div>
      </div></details>`;
  });
  return `<section id="b04-rounds"><h2>旧版 ${workflow.rounds.length} 轮主模型调用，逐轮对照新版</h2>
    <p class="sub">旧版分两段执行，用户确认前 5 轮、确认后 27 轮，<strong>共等主模型 ${baseline.groups['llm.plan'].seconds.toFixed(1)} 秒</strong>。展开阶段，左栏逐轮列出等模型和随后执行工具的时间，右栏说明新版由谁完成同一组工作。<span class="b04-flow-mobile">向左滑动可看右栏。</span></p>
    ${latest}
    ${groups.join('')}
    <p class="sub">模型等待取自 Langfuse 的 <code>llm.plan</code>。工具耗时另列，等待用户确认的时间单独计算。<a href="../../../content/useit/b04-rounds-2026-11-13.json">查看逐轮记录</a> · <a href="#b04-original">查看原始测试证据</a></p>
  </section>`;
}

function render(baseline, { esc, table, external }) {
  const runs = report.cases;
  const initial = {
    id: 'original', title: '旧版 B04', date: baseline.sent_at.slice(0, 10), wall_seconds: baseline.submitted_to_finish_seconds,
    agent_seconds: baseline.agent_seconds, model_calls: baseline.groups['llm.plan'].count,
    tool_errors: baseline.failures.length, reference_usd: baseline.cost.reference_total_usd
  };
  const count = n => Number.isInteger(n) ? `${n} 次` : '未记录';
  const showDate = value => `<time datetime="${esc(value)}">${esc(value)}</time>`;
  const rows = [initial, ...runs].map(run => {
    const title = `<a href="#b04-${esc(run.id)}">${esc(run.title)}</a>`;
    const complete = run.status === 'completed';
    const stopped = run.status === 'incomplete';
    const attempts = interrupted.filter(attempt => attempt.case_id === run.id);
    const status = stopped ? ' · 未完成' : complete ? ' · 已完成' : '';
    const history = attempts.length ? `<small><a href="#b04-interrupted">查看 ${attempts.length} 次中止记录</a></small>` : '';
    return [
      `${title}<small>${showDate(run.date)}${status}</small>${history}`,
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
      return `<p id="b04-${esc(run.id)}"><strong>${title}</strong> · ${showDate(run.date)} · ${esc(run.notes)} ${external(run.langfuse_url, 'Langfuse 链路')}</p>`;
    }
    const image = run.image ? `<a href="${esc(run.image)}"><img src="${esc(run.image)}" width="800" height="800" loading="lazy" decoding="async" alt="${title}的双插片亚克力立牌三维截图"></a>` : '';
    const dimensions = [...new Set(run.image_sizes || [])];
    const artwork = dimensions.length ? `<small>插片 ${esc(run.size_mm)} · 原图 ${esc(dimensions.join('、'))} 像素</small>` : '';
    const status = [run.status === 'incomplete' ? '本次流程未完成' : '', run.review_required > 0 ? `${run.review_required} 片切线待审核` : ''].filter(Boolean).join(' · ');
    return `<figure id="b04-${esc(run.id)}">${image}<figcaption>
      <strong>${title}</strong><small>${showDate(run.date)}</small><p>“${esc(run.prompt)}”</p>
      ${run.notes ? `<p>${esc(run.notes)}</p>` : ''}${artwork}${status ? `<small>${esc(status)}</small>` : ''}${run.langfuse_url ? external(run.langfuse_url, 'Langfuse 链路') : ''}
    </figcaption></figure>`;
  }
  return `<section id="b04-results" class="b04-results">
    <h2>从发送需求到运行结束，实际用了多久？</h2>
    ${table(['实测', '发送到完成', 'Agent 执行', '主模型调用', '工具报错', '参考费用'], rows)}
    <p>索隆只用了 <strong>2 次主模型调用</strong>，整轮仍花了 <strong>8 分 15 秒</strong>。其中切线占 3 分 33 秒，白墨占 1 分 40 秒。</p>
    <p class="sub">原始测试为 ${esc(initial.date)}，优化复测为 ${esc(dateRange)}。主模型调用和生图请求分别计数，参考费用按记录用量和本地费率折算为美元。</p>
    ${interrupted.length ? `<details id="b04-interrupted"><summary>查看中止的 ${interrupted.length} 次尝试与费用</summary>
      ${interrupted.map(attempt => `<p><strong>${esc(attempt.title)}</strong> · ${showDate(attempt.date)} · ${esc(attempt.reason)}${Number.isFinite(attempt.wall_seconds) ? '从发送到中止 ' + duration(attempt.wall_seconds) : 'Agent 执行 ' + duration(attempt.agent_seconds)}，主模型 ${count(attempt.model_calls)}，外层工具报错 ${count(attempt.tool_errors)}${attempt.image_request_timeouts ? `，生图请求超时 ${count(attempt.image_request_timeouts)}` : ''}，参考费用 $${attempt.reference_usd.toFixed(4)}。${external(attempt.langfuse_url, '查看链路')}</p>`).join('')}
    </details>` : ''}
    ${breakdown.length ? `<details><summary>查看优化版 Agent 分步耗时（秒）</summary>${stageTable}</details>` : ''}
  </section>
  ${cutResults(table)}
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
  ${flowComparison(baseline, esc)}
  <section id="b04-previews"><h2>实测三维成品</h2>
    <p class="sub">点击截图可放大检查前后遮挡和底座。标为「待审核」的切线仍需工艺复核。</p>
    <div class="gallery b04-shots">${runs.filter(run => run.image).map(sample).join('')}</div>${runs.filter(run => !run.image).map(sample).join('')}
    <p><a href="../../../content/useit/b04-retests-2026-11-19.json">查看各例实测数据</a></p>
  </section>
  <section id="b04-original"><p class="eyebrow">2026.11.13 / 原始测试</p><h2>旧版 B04 的画稿、耗时与报错记录</h2></section>`;
}

module.exports = { render, tabs, date: latestDate };
