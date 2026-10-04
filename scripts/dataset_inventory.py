"""Render the local dataset inventory without changing experiment results."""
from __future__ import annotations

from datetime import date
from html import escape
import json
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parent.parent


def build(core: ModuleType) -> bool:
    """Build the inventory when its source exists; return whether to link it."""
    source = ROOT / 'content/datasets.json'
    if not source.exists():
        return False
    data = json.loads(source.read_text(encoding='utf-8'))
    if data.get('schema_version') != 1:
        raise ValueError('Unsupported dataset inventory schema')
    for key in ('title', 'subtitle', 'record_date', 'note', 'source_note'):
        if not isinstance(data.get(key), str) or not data[key].strip():
            raise ValueError(f'Missing dataset inventory field: {key}')
    day = date.fromisoformat(data['record_date']).isoformat()
    records = data.get('records')
    if not isinstance(records, list) or not records:
        raise ValueError('Dataset inventory requires a non-empty records list')
    rows, seen = [], set()
    for record in records:
        if not isinstance(record, dict):
            raise ValueError('Invalid dataset inventory record')
        name, content = record.get('name'), record.get('content')
        if not all(isinstance(value, str) and value.strip() for value in (name, content)):
            raise ValueError('Dataset name and content must be non-empty strings')
        if name in seen:
            raise ValueError(f'Duplicate dataset entry: {name}')
        seen.add(name)
        rows.append(f'<tr><td data-label="数据集">{escape(name)}</td>'
                    f'<td data-label="目前本地内容">{escape(content)}</td></tr>')
    metrics = ('<div class="experiment-table trials" tabindex="0" role="region" '
               'aria-label="当前本地数据清单"><table aria-label="当前本地数据清单">'
               '<thead><tr><th scope="col">数据集</th><th scope="col">目前本地内容</th></tr></thead>'
               '<tbody>' + ''.join(rows) + '</tbody></table></div>')
    main = (
        '<main id="main" class="experiment-main">'
        '<header class="experiment-header">'
        f'<a class="back-link" href="../index.html">{core.icon("left")} 返回实验</a>'
        f'<p class="experiment-date"><time datetime="{day}">{day}</time> · 清单记录日期</p>'
        f'<h1>{escape(data["title"])}</h1>'
        f'<p class="experiment-subtitle">{escape(data["subtitle"])}</p></header>'
        '<section class="experiment-block" aria-label="本地数据清单">'
        f'{metrics}<p class="experiment-note">{escape(data["note"])}</p></section>'
        f'<footer class="experiment-source">{escape(data["source_note"])}</footer></main>'
    )
    # Keep this insertion in the normal build, so later rebuilds retain the button.
    catalog = ROOT / 'thesis/experiments/index.html'
    catalog_html = catalog.read_text(encoding='utf-8')
    original_nav = ('<nav class="experiment-dates" aria-label="复现汇总">'
                    '<a href="reproductions/index.html">原方法复现指标汇总 →</a></nav>')
    updated_nav = ('<nav class="experiment-dates" aria-label="研究资料汇总">'
                   '<a href="reproductions/index.html">原方法复现指标汇总 →</a>'
                   '<a href="datasets/index.html">当前数据集 →</a></nav>')
    if catalog_html.count(original_nav) == 1:
        catalog_html = catalog_html.replace(original_nav, updated_nav, 1)
    elif catalog_html.count(updated_nav) != 1:
        raise ValueError('Experiment overview navigation changed; review before adding dataset link')
    core.shell('thesis/experiments/datasets/index.html', data['title'], main,
               'thesis', toc='', description=data['subtitle'])
    catalog.write_text(catalog_html, encoding='utf-8')
    return True
