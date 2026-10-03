"""Render schema-v2 summaries beside the unchanged workbook renderer."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
from build_experiments import ROOT, E, entries, block, build_record


def table(headers, rows, caption, trials=False):
    if not headers or any(len(row) != len(headers) for row in rows):
        raise ValueError('Experiment table rows must match headers')
    heads = ''.join(f'<th scope="col">{E(h)}</th>' for h in headers)
    body = ''
    for row in rows:
        cells = ''.join((f'<td data-label="{E(label)}">' if trials else '<td>') + E(str(value)).replace(chr(10), '<br>') + '</td>' for label, value in zip(headers, row))
        body += '<tr>' + cells + '</tr>'
    style = ' trials' if trials else ''
    return f'<div class="experiment-table{style}" tabindex="0" role="region" aria-label="{E(caption)}；窄屏可横向滚动"><table><caption>{E(caption)}</caption><thead><tr>{heads}</tr></thead><tbody>{body}</tbody></table></div>'


def build_summary(core, item, data):
    """Schema v2: one purpose, metric tables and conclusion per completed group."""
    groups = data.get('groups', [])
    if not groups:
        raise ValueError('An experiment summary must contain completed groups')
    body = ''
    jump_links = []
    for number, group in enumerate(groups, 1):
        for key in ('title', 'what', 'conclusion'):
            if not isinstance(group.get(key), str) or not group[key].strip():
                raise ValueError(f'Missing experiment group field: {key}')
        tables = group.get('tables', [])
        if not tables:
            raise ValueError('An experiment group must have a results table')
        metrics = ''
        for t in tables:
            rendered = table(t['headers'], t['rows'], t['caption'], trials=t.get('wrap', False))
            if t.get('supplemental', False):
                rendered = f'<details class="experiment-extra"><summary>{E(t["caption"])}</summary>{rendered}</details>'
            metrics += rendered
        jump_links.append(f'<a href="#experiment-{number}">{number:02d} {E(group["title"])}</a>')
        body += block(number, group['title'], group['what'], metrics,
                      group['conclusion'], group.get('note', ''))
    navigation = '<nav class="experiment-jump" aria-label="本页实验"><span>本页跳转</span>' + ''.join(jump_links) + '</nav>'
    if len(groups) < 4:
        navigation = ''
    root = ROOT / 'thesis/experiments' / item['slug']
    root.mkdir(parents=True, exist_ok=True)
    # Only the curated summary is copied, never raw reports, imagery or checkpoints.
    (root / 'summary.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    links = f'<a class="experiment-download" href="summary.json" download>{core.icon("download")} 摘要数据</a>'
    if item.get('source_file'):
        links += f' <a class="experiment-download" href="{E(item["source_file"])}" download>{core.icon("download")} 原始 Excel</a>'
    main = f'<main id="main" class="experiment-main"><header class="experiment-header"><a class="back-link" href="../index.html">{core.icon("left")} 返回实验</a><p class="experiment-date"><time datetime="{E(item["date"])}">{E(item["date"])}</time> · {E(item.get("date_kind", "记录日期"))}</p><h1>{E(item["title"])}</h1><p class="experiment-subtitle">{E(item["subtitle"])}</p>{links}<p class="experiment-note">窄屏可横向滑动表格查看完整指标。</p></header>{navigation}{body}<footer class="experiment-source">{E(data.get("source_note", "依据已提供的实验汇总整理。"))}</footer></main>'
    core.shell(f'thesis/experiments/{item["slug"]}/index.html',
               f'{item["date"]} · {item["title"]}', main, 'thesis', toc='',
               description=item.get('summary', item['subtitle']))


def build(core):
    items = entries()
    index_rows = ''
    date_links = []
    seen_dates = set()
    for item in items:
        slug = item['slug']
        data_file = item.get('data_file', slug + '.json')
        if Path(data_file).name != data_file or not data_file.endswith('.json'):
            raise ValueError('Invalid experiment data file')
        data = json.loads((ROOT / 'content/experiments' / data_file).read_text(encoding='utf-8'))
        filename = item.get('source_file')
        if filename:
            if Path(filename).name != filename:
                raise ValueError('Invalid source file name')
            original = ROOT / 'thesis/experiments' / slug / filename
            # A v2 summary may reference a retained, unmodified workbook import.
            legacy = ROOT / 'content/experiments' / (slug + '.json')
            source_data = data if 'source_sha256' in data else json.loads(legacy.read_text(encoding='utf-8'))
            if hashlib.sha256(original.read_bytes()).hexdigest() != source_data['source_sha256']:
                raise ValueError('Original workbook checksum mismatch')
        if data.get('schema_version') == 2:
            build_summary(core, item, data)
        elif 'sheets' in data:
            build_record(core, item, data)
        else:
            raise ValueError('Unsupported experiment schema')
        day = item['date']
        anchor = ''
        if day not in seen_dates:
            anchor = f' id="date-{E(day)}"'
            seen_dates.add(day)
            date_links.append(f'<a href="#date-{E(day)}">{E(day[5:])}</a>')
        takeaway = item.get('takeaway', item['summary'])
        index_rows += f'<tr{anchor}><td><time datetime="{E(day)}">{E(day)}</time></td><td><a href="{slug}/index.html">{E(item["title"])}</a></td><td>{E(takeaway)}</td></tr>'
    dates = '<nav class="experiment-dates" aria-label="按日期跳转">' + ''.join(date_links) + '</nav>'
    overview_nav = ''
    overview_file = ROOT / 'content/experiments/reproductions.json'
    if overview_file.exists():
        overview_data = json.loads(overview_file.read_text(encoding='utf-8'))
        overview_item = overview_data['overview']
        if overview_item['slug'] != 'reproductions' or overview_data.get('schema_version') != 2:
            raise ValueError('Invalid reproduction overview')
        build_summary(core, overview_item, overview_data)
        overview_nav = '<nav class="experiment-dates" aria-label="复现汇总"><a href="reproductions/index.html">原方法复现指标汇总 →</a></nav>'
    catalog = '<div class="experiment-catalog"><table><thead><tr><th scope="col">记录日期</th><th scope="col">实验主题</th><th scope="col">核心结论</th></tr></thead><tbody>' + index_rows + '</tbody></table></div>'
    main = f'<main class="page-main" id="main"><header class="page-heading"><a class="back-link" href="../index.html">{core.icon("left")} 返回内窥镜三维重建</a><h1>实验</h1><p class="description">按日期回看目的、指标与结论；同一组对照合并展示。</p></header>{overview_nav}{dates}{catalog}<p class="experiment-note">归档截至2026-10-03已提供结果；未执行及进行中的实验不列入。缺失指标明确标注，不等于零。</p></main>'
    core.shell('thesis/experiments/index.html', '实验', main, 'thesis')
    print(f'Built {len(items)} concise experiment archive(s); retained workbook verified.')
