"""Render an author-supplied selector diagnosis without recomputing metrics."""
from __future__ import annotations

import json
import re
from datetime import date

import model_distillation as layout


def _text(data, key):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Missing selector diagnostic field: {key}')
    return value


def _table(data):
    headers, rows = data.get('headers'), data.get('rows')
    if not isinstance(headers, list) or not headers or not all(isinstance(h, str) for h in headers):
        raise ValueError('Invalid selector table headers')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty selector diagnostic table')
    if any(not isinstance(row, list) or len(row) != len(headers)
           or not all(isinstance(value, str) for value in row) for row in rows):
        raise ValueError('Selector table values must retain source precision as strings')
    _text(data, 'caption')
    if not isinstance(data.get('note', ''), str):
        raise ValueError('Invalid selector table note')
    if 'collapsible' in data and not isinstance(data['collapsible'], bool):
        raise ValueError('Invalid selector table collapse flag')


def validate(data):
    if data.get('schema_version') != 2 or data.get('kind') != 'selector_diagnostic':
        raise ValueError('Invalid selector diagnostic schema')
    for key in ('slug', 'record_date', 'title', 'subtitle', 'summary', 'kind_label',
                'source_title', 'source_sha256', 'source_note'):
        _text(data, key)
    date.fromisoformat(data['record_date'])
    if data.get('experiment_date') is not None:
        date.fromisoformat(data['experiment_date'])
    if not re.fullmatch(r'[0-9a-f]{64}', data['source_sha256']):
        raise ValueError('Invalid selector report checksum')
    related = data.get('related_studies', [])
    if not isinstance(related, list):
        raise ValueError('Invalid related studies list')
    related_slugs = set()
    for study in related:
        if not isinstance(study, dict):
            raise ValueError('Invalid related study')
        slug = _text(study, 'slug')
        if (not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+', slug)
                or slug == data['slug'] or slug in related_slugs):
            raise ValueError('Invalid, self-linked or duplicate related study slug')
        related_slugs.add(slug)
        _text(study, 'title')
        _text(study, 'relation')
    protocol = data.get('protocol')
    if not isinstance(protocol, list) or not protocol or any(
            not isinstance(row, list) or len(row) != 2
            or not all(isinstance(value, str) and value.strip() for value in row)
            for row in protocol):
        raise ValueError('Invalid selector diagnostic protocol facts')
    _table(data.get('primary_results', {}))
    sections = data.get('sections')
    if not isinstance(sections, list) or not sections:
        raise ValueError('Missing selector diagnostic sections')
    seen = {'protocol', 'results'}
    for section in sections:
        anchor = _text(section, 'id')
        if not re.fullmatch(r'[a-z][a-z0-9-]*', anchor) or anchor in seen:
            raise ValueError('Invalid or duplicate selector section ID')
        seen.add(anchor)
        _text(section, 'title')
        _text(section, 'conclusion')
        paragraphs = section.get('paragraphs')
        if not isinstance(paragraphs, list) or any(
                not isinstance(text, str) or not text.strip() for text in paragraphs):
            raise ValueError('Invalid selector diagnostic paragraphs')
        tables = section.get('tables', [])
        if not isinstance(tables, list):
            raise ValueError('Invalid selector diagnostic tables')
        for table in tables:
            _table(table)


def render_table(data):
    rendered = layout.table(data['headers'], data['rows'], data['caption'],
                            'md-selector-table', mobile_hint=True)
    if data.get('note'):
        rendered += f'<p class="md-note">{layout.esc(data["note"])}</p>'
    if data.get('collapsible', False):
        rendered = (
            f'<details class="md-history"><summary>{layout.esc(data["caption"])}</summary>'
            f'{rendered}</details>'
        )
    return rendered


def related_navigation(core, data):
    studies = data.get('related_studies', [])
    if not studies:
        return ''
    source = core.ROOT / 'content/distillation'
    index = json.loads((source / 'index.json').read_text(encoding='utf-8'))
    registered = {entry['slug']: entry['file'] for entry in index['entries']}
    links = []
    for study in studies:
        slug = study['slug']
        filename = slug + '.json'
        if registered.get(slug) != filename or not (source / filename).is_file():
            raise ValueError(f'Related study is not a buildable article: {slug}')
        links.append(
            f'<a href="../{layout.esc(slug)}/index.html">'
            f'<span>{layout.esc(study["relation"])}</span>'
            f'<strong>{layout.esc(study["title"])}</strong>'
            '<span class="md-related-arrow" aria-hidden="true">→</span></a>'
        )
    return '<nav class="md-related" aria-label="相关研究">' + ''.join(links) + '</nav>'


def article(core, data, parent_title):
    validate(data)
    related = related_navigation(core, data)
    slug = data['slug']
    output = core.ROOT / 'thesis/distillation' / slug
    layout.save_json(output / 'summary.json', data)
    primary = data['primary_results']
    layout.export_csv(output / 'metrics.csv', primary['headers'], primary['rows'])
    esc = layout.esc
    anchors = [('results', '当前结果')]
    anchors += [(section['id'], section['title']) for section in data['sections']]
    navigation = '<nav class="md-jump" aria-label="本页目录">' + ''.join(
        f'<a href="#{esc(anchor)}">{esc(title)}</a>' for anchor, title in anchors
    ) + '</nav>'
    experiment_date = data.get('experiment_date')
    date_note = (
        f'实验日期：{esc(experiment_date)}' if experiment_date else '实验运行日期未提供'
    )
    main = (
        '<main class="experiment-main md-main md-selector" id="main">'
        '<header class="experiment-header md-header">'
        f'<a class="back-link" href="../index.html">{core.icon("left")} 返回{esc(parent_title)}</a>'
        f'<p class="experiment-date"><time datetime="{esc(data["record_date"])}">'
        f'{esc(data["record_date"])}</time> · 记录日期 · {date_note}</p>'
        f'<h1 tabindex="-1">{esc(data["title"])}</h1>'
        f'<p class="experiment-subtitle">{esc(data["subtitle"])}</p>'
        f'<p class="md-answer">{esc(data["summary"])}</p>{related}</header>{navigation}'
        '<section class="md-section" id="protocol"><h2><span>01</span>训练与评价范围</h2>'
        f'{layout.facts(data["protocol"])}</section>'
        '<section class="md-section" id="results"><h2><span>02</span>当前结果</h2>'
        '<p class="md-note">根据各自信息条件列示；结合上述训练与评价范围阅读，不作跨范围排名。</p>'
        f'{render_table(primary)}<a class="md-download" href="metrics.csv" download>当前结果 CSV ↓</a></section>'
    )
    for number, section in enumerate(data['sections'], 3):
        paragraphs = ''.join(f'<p>{esc(text)}</p>' for text in section['paragraphs'])
        tables = ''.join(render_table(table) for table in section.get('tables', []))
        main += (
            f'<section class="md-section" id="{esc(section["id"])}">'
            f'<h2><span>{number:02d}</span>{esc(section["title"])}</h2>'
            f'{paragraphs}{tables}<div class="md-verdict">{esc(section["conclusion"])}</div></section>'
        )
    main += (
        '<div class="md-downloads"><a href="summary.json" download>完整摘要 JSON ↓</a></div>'
        f'<footer class="experiment-source">{esc(data["source_note"])}</footer></main>'
    )
    layout.write(core, f'thesis/distillation/{slug}/index.html', data['title'], main,
                 data['summary'], article=True)
