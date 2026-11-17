'use strict';

const report = require('../content/useit/b02-short-retests-2026-11-17.json');
const timeBar = require('./useit-time-bar.cjs');

const seconds = value => value.toFixed(1);
const duration = value => {
  const total = Math.round(value);
  return `${Math.floor(total / 60)}分${total % 60}秒`;
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

function renderSample(sample) {
  const { model_wait, image_generation_tool, frontend_roundtrips, other } = sample.runtime;
  const parts = [model_wait, image_generation_tool, frontend_roundtrips, other];
  if (Math.abs(parts.reduce((sum, part) => sum + part, 0) - sample.agent_seconds) > 0.01) {
    throw new Error(`B02 ${sample.case} time parts do not sum to the Agent total`);
  }
  const artwork = escapeHtml(sample.preview.path);
  const title = escapeHtml(sample.title);
  const previewNote = sample.preview.render_seconds === null
    ? '截图回执超时，已核验落盘图片'
    : `${seconds(sample.preview.render_seconds)} 秒`;
  return `<article class="b02-retest-card" id="${escapeHtml(sample.case.toLowerCase())}">
  <figure class="b02-retest-figure">
    <a href="${artwork}"><img src="${artwork}" width="${sample.preview.width}" height="${sample.preview.height}" alt="${title}亚克力挂件的三维视图，展示印刷画稿、透明边缘、挂孔和金属环链" loading="lazy" decoding="async"></a>
    <figcaption>USEIT 三维实渲 · 制作后另行截图 · ${previewNote}</figcaption>
  </figure>
  <div class="b02-retest-body">
    <p class="eyebrow">${escapeHtml(sample.case)}</p>
    <h3>${title}</h3>
    <p class="b02-retest-prompt">“${escapeHtml(sample.prompt)}”</p>
    <p class="b02-retest-total"><strong>${duration(sample.agent_seconds)}</strong> <small>Agent 执行 · ${sample.agent_seconds.toFixed(2)} 秒</small></p>
    <p><strong>${sample.main_model_calls} 次主模型 · ${sample.image_calls} 次生图 · ${sample.tool_failures} 次工具报错</strong><br>画稿、切线、挂孔及白墨已保存，切线待审核。</p>
    ${timeBar(parts).replaceAll('装配与保存', '装配、切线与白墨核验')}
    <p class="b02-retest-foot">白墨${sample.white_tool_called ? '经原工具处理后复检' : '已有效，检查后复用'} · 参考费用 ${sample.reference_usd.toFixed(4)} 美元</p>
  </div>
</article>`;
}

module.exports = () => `<section id="b02-short-retests" class="b02-latest" aria-labelledby="b02-short-retests-title">
  <p class="eyebrow">2026.11.17 / B02-R7 与 B02-R8</p>
  <h2 id="b02-short-retests-title">两条短句并行复测</h2>
  <p class="b02-result"><strong>两个独立项目均完成制作，主模型各调用 2 次。</strong>分别理解需求、编写画稿提示词，之后由代码接续装配、切线、白墨核验和回复。</p>
  <p class="b02-boundary">路飞先启动，鸣人随后启动。按 Agent 收到首次请求至结束的时间戳，两轮重叠约 <strong>${Math.round(report.agent_overlap_seconds)} 秒</strong>。下方制作时间各自计量，三维渲染在制作完成后单独进行。</p>
  <div class="b02-retest-grid">${report.samples.map(renderSample).join('')}</div>
  <p class="b02-boundary">两张图直接来自保存母版的三维渲染，可检查画稿、透明切边和配件的呈现。实物工艺仍需样片验证。费用按记录用量与本地费率估算。</p>
  <p><a href="evidence/B02-short-retests.json">查看两轮计时与三维渲染记录 →</a> · <a href="#b02-flow-comparison">对照优化前的 16 轮调用 →</a></p>
</section>`;
