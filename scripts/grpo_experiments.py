"""Build the dedicated GRPO research column from reviewed report summaries."""
from __future__ import annotations

import json
import re
from datetime import date
from html import escape as esc

from experiment_summaries import table


def render_section(number, section):
    anchor = section['id']
    if not re.fullmatch(r'[a-z][a-z0-9-]*', anchor):
        raise ValueError('Invalid GRPO section ID')
    parts = [f'<section class="experiment-block" id="{anchor}">',
             f'<h2><span>{number:02d}</span>{esc(section["title"])}</h2>']
    parts += [f'<p>{esc(text)}</p>' for text in section.get('paragraphs', [])]
    for item in section.get('tables', []):
        parts.append(table(item['headers'], item['rows'], item['caption'],
                           trials=item.get('wrap', False)))
    if section.get('formula'):
        parts.append(f'<p class="grpo-formula">{esc(section["formula"])}</p>')
        parts.append(f'<p class="experiment-note">{esc(section["formula_note"])}</p>')
    if section.get('steps'):
        parts.append('<ol class="grpo-steps">'+''.join(
            f'<li>{esc(text)}</li>' for text in section['steps'])+'</ol>')
    if section.get('conclusion'):
        parts.append('<div class="experiment-conclusion"><h3>结论</h3>'
                     f'<p>{esc(section["conclusion"])}</p></div>')
    if section.get('note'):
        parts.append(f'<p class="experiment-note">{esc(section["note"])}</p>')
    for detail in section.get('details', []):
        parts.append('<details class="grpo-detail">'
                     f'<summary>{esc(detail["title"])}</summary><p>{esc(detail["text"])}</p></details>')
    return ''.join(parts)+'</section>'


def insert_after_header(path, block, marker):
    """Add a discoverable link without replacing historical content."""
    page = path.read_text(encoding='utf-8')
    if marker in page:
        return
    start = page.index('</header>', page.index('<main ')) + len('</header>')
    path.write_text(page[:start]+block+page[start:], encoding='utf-8')


def build(core):
    data = json.loads((core.ROOT/'content/grpo/overview.json').read_text(encoding='utf-8'))
    date.fromisoformat(data['updated'])
    anchors = [s['id'] for s in data['sections']]
    if len(set(anchors)) != len(anchors):
        raise ValueError('Duplicate GRPO section ID')
    nav = '<nav class="experiment-jump" aria-label="GRPO 专栏目录">'+''.join(
        f'<a href="#{esc(s["id"])}">{i:02d} {esc(s["title"])}</a>'
        for i, s in enumerate(data['sections'], 1))+'</nav>'
    main = ('<main class="experiment-main grpo-main" id="main">'
            '<header class="experiment-header">'
            f'<a class="back-link" href="../index.html">{core.icon("left")} 返回实验主题</a>'
            f'<p class="experiment-date">GRPO 专栏 · 实验 {esc(data["experiment_range"])} · 整理 {esc(data["updated"])}</p>'
            f'<h1>{esc(data["title"])}</h1><p class="experiment-topic-summary">{esc(data["summary"])}</p>'
            '</header>'+nav+f'<p class="grpo-protocol">{esc(data["protocol"])}</p>')
    main += ''.join(render_section(i, s) for i, s in enumerate(data['sections'], 1))
    main += ('<details class="grpo-detail"><summary>报告来源与已有详细记录</summary><ul>'+''.join(
        f'<li>{esc(source)}</li>' for source in data['sources'])+'</ul>'
        '<p><a href="../../distillation/2026-10-13-four-head-selector/index.html">采样效率与泛化详细记录 →</a><br>'
        '<a href="../../distillation/2026-10-14-four-head-routing/index.html">片段偏好与训练覆盖详细记录 →</a></p></details>'
        '<a class="experiment-download" href="summary.json" download>专栏摘要 JSON ↓</a>'
        f'<footer class="experiment-source">{esc(data["source_note"])}</footer></main>')
    page_path = 'thesis/experiments/grpo/index.html'
    core.shell(page_path, data['title'], main, 'thesis', toc='', description=data['summary'])
    output = core.ROOT/page_path
    page = output.read_text(encoding='utf-8')
    page = page.replace('</head>', '<link rel="stylesheet" href="../../../assets/grpo-experiments.css">\n</head>', 1)
    output.write_text(page, encoding='utf-8')
    (output.parent/'summary.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

    for path, href in [('thesis/experiments/index.html', 'grpo/index.html'),
                       ('thesis/index.html', 'experiments/grpo/index.html')]:
        card = (f'<a class="experiment-folder experiment-topic-folder" data-grpo-column href="{href}">'
                '<div><span class="experiment-topic-label">GRPO 专栏</span>'
                '<h2>D4RT + GRPO</h2><p>光度策略、四头选择、奖励设计与完整诊断链</p>'
                f'<p class="experiment-topic-meta">实验 {esc(data["experiment_range"])} · 整理 {esc(data["updated"])}</p>'
                f'<span class="experiment-topic-open">查看实验、结论与下一步 →</span></div>{core.icon("arrow")}</a>')
        if path == 'thesis/experiments/index.html':
            target = core.ROOT/path
            page = target.read_text(encoding='utf-8')
            page = re.sub(r'<a\b[^>]*data-grpo-column[^>]*>.*?</a>', '', page, flags=re.S)
            exposure = re.search(r'<a\b[^>]*href="exposure-geometry/index.html"[^>]*>.*?</a>', page, re.S)
            if exposure is None:
                raise ValueError('Exposure topic entry missing')
            end = exposure.end()
            target.write_text(page[:end]+card+page[end:], encoding='utf-8')
        else:
            insert_after_header(core.ROOT/path, card, 'data-grpo-column')
    old_pages = [('thesis/distillation/index.html', '../experiments/grpo/index.html'),
                 ('thesis/distillation/2026-10-13-four-head-selector/index.html', '../../experiments/grpo/index.html'),
                 ('thesis/distillation/2026-10-14-four-head-routing/index.html', '../../experiments/grpo/index.html')]
    for path, href in old_pages:
        banner = ('<nav class="experiment-dates" data-grpo-overview aria-label="GRPO 完整研究">'
                  f'<a href="{href}">GRPO 专栏：完整实验、奖励设计与最新结论 →</a></nav>')
        insert_after_header(core.ROOT/path, banner, 'data-grpo-overview')
    print('Built GRPO column and linked existing records; no experiment results recomputed.')


if __name__ == '__main__':
    import build_core
    import build_experiments
    build_experiments.configure(build_core)
    build(build_core)
