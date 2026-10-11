"""Publish the supplied result snapshot without reranking rounded display values."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from datetime import datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser

SOURCE = 'all-models-20261011.html'
DATASETS = ['EndoNeRF', 'EndoNeRF-EC', 'SCARED', 'C3VD', 'StereoMIS', 'Hamlyn', 'EndoSLAM']
METRICS = [('psnr', 'PSNR ↑'), ('ssim', 'SSIM ↑'), ('lpips', 'LPIPS ↓')]


class Snapshot(HTMLParser):
    """Read data and explanatory text; never execute or copy source scripts."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows, self.paragraphs = [], []
        self.row = self.cell = self.paragraph = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = {'attrs': dict(attrs), 'cells': []}
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = {'tag': tag, 'attrs': dict(attrs), 'text': ''}
        elif tag == 'p':
            self.paragraph = ''

    def handle_data(self, data):
        if self.cell is not None:
            self.cell['text'] += data
        if self.paragraph is not None:
            self.paragraph += data

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row['cells'].append(self.cell)
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        elif tag == 'p' and self.paragraph is not None:
            self.paragraphs.append(self.paragraph.strip())
            self.paragraph = None


def read_snapshot(raw):
    parsed = Snapshot()
    parsed.feed(raw)
    assert [c['text'] for c in parsed.rows[0]['cells'][2:]] == DATASETS
    timestamp = re.search(r'更新时间 UTC：([^。]+)', parsed.paragraphs[0]).group(1)
    datetime.fromisoformat(timestamp)
    rows, family = [], None
    complete, diagnostic = set(), 0
    for source_row in parsed.rows[2:]:
        cells = source_row['cells']
        if source_row['attrs'].get('class') == 'separator':
            family = {'内窥镜方法': 'endoscopic', '通用重建方法': 'general'}[cells[0]['text']]
            continue
        assert family in ('endoscopic', 'general')
        record = {'method': cells[0]['text'], 'protocol': cells[1]['text'], 'family': family, 'datasets': {}}
        expanded = []
        for c in cells[2:]:
            expanded.extend([c] * int(c['attrs'].get('colspan', '1')))
        assert len(expanded) == 21
        for index, dataset in enumerate(DATASETS):
            values = {}
            for metric_index, (key, _) in enumerate(METRICS):
                cell = expanded[index * 3 + metric_index]
                attrs = cell['attrs']
                value = attrs.get('data-value')
                value_record = {'display_value': value, 'note': attrs.get('title', cell['text'])}
                for scope in ('global', 'protocol'):
                    rank = attrs.get(f'data-{scope}-rank', '')
                    value_record[f'{scope}_rank'] = int(rank) if rank else None
                if value is not None:
                    assert re.fullmatch(r'-?\d+\.\d+', value)
                    status = attrs['title'].rsplit(' / ', 1)[1]
                    value_record['status'] = status
                    if status == 'complete':
                        complete.add((record['method'], dataset))
                        assert all(value_record[f'{scope}_rank'] for scope in ('global', 'protocol'))
                    else:
                        diagnostic += 1
                        assert not value_record['global_rank'] and not value_record['protocol_rank']
                else:
                    assert cell['text'].startswith('N/A')
                    value_record['status'] = 'not_applicable'
                values[key] = value_record
            record['datasets'][dataset] = values
        rows.append(record)
    assert len(rows) == 16 and len({r['method'] for r in rows}) == 16
    assert [sum(r['family'] == f for r in rows) for f in ('endoscopic', 'general')] == [9, 7]
    assert len(complete) == 105 and diagnostic == 6
    assert '105/105' in parsed.paragraphs[0] and '15107/15107' in parsed.paragraphs[0]
    return {'source_file': SOURCE, 'source_sha256': hashlib.sha256(raw.encode('utf-8')).hexdigest(),
            'source_report_updated_utc': timestamp,
            'precision_note': 'Values are the supplied HTML display strings. Ranks are copied from the source attributes; full-precision CSV was not supplied and no ranking is recomputed.',
            'verification': {'source_report': 'EndoSLAM 验收：通过', 'independently_verified': False,
                             'missing_evidence': ['verification_all_models.json', 'dataset_metrics.csv', 'coverage_matrix.csv', 'per_sequence_metrics.csv', 'per_frame_metrics.csv']},
            'datasets': DATASETS, 'complete_heldout_combinations': len(complete),
            'reported_image_records': 15107, 'rows': rows, 'source_paragraphs': parsed.paragraphs}


def table(data):
    head = '<tr><th rowspan="2" scope="col">方法</th><th rowspan="2" scope="col">输入协议</th>'
    head += ''.join(f'<th colspan="3" scope="colgroup">{escape(d)}</th>' for d in DATASETS) + '</tr><tr>'
    head += ''.join(f'<th scope="col">{label}</th>' for _ in DATASETS for _, label in METRICS) + '</tr>'
    body, family = '', None
    for row in data['rows']:
        if row['family'] != family:
            family = row['family']
            name = '内窥镜专用方法' if family == 'endoscopic' else '通用三维重建方法'
            body += f'<tr class="latest-family"><th colspan="23" scope="rowgroup">{name}</th></tr>'
        body += f'<tr data-latest-method="{escape(row["method"], quote=True)}"><th scope="row">{escape(row["method"])}</th><td class="latest-protocol">{escape(row["protocol"])}</td>'
        for dataset in DATASETS:
            values = row['datasets'][dataset]
            if values['psnr']['status'] == 'not_applicable':
                body += '<td colspan="3" class="rk-missing" title="无同步校准且重叠的双目输入；不参与留出排名">N/A · 无适用同步双目</td>'
                continue
            for metric, label in METRICS:
                cell = values[metric]
                rank = cell['global_rank']
                cls = f' rk-rank-{rank}' if rank in (1, 2) else ''
                badge = {1: ' ①', 2: ' ②'}.get(rank, '')
                value = escape(cell['display_value'])
                diagnostic = '；源视图诊断，不参与留出排名' if cell['status'] != 'complete' else ''
                title = escape(cell['note'] + diagnostic, quote=True)
                label_base = escape(f'{row["method"]} · {dataset} · {label}：{cell["display_value"]}{diagnostic}', quote=True)
                rank_label = f'；全部留出方法第 {rank} 名' if rank in (1, 2) else ''
                body += (f'<td data-latest-metric="{metric}" data-dataset="{escape(dataset)}" '
                         f'data-display-value="{value}" data-global-rank="{cell["global_rank"] or ""}" '
                         f'data-protocol-rank="{cell["protocol_rank"] or ""}" data-status="{cell["status"]}" '
                         f'data-label-base="{label_base}" aria-label="{label_base}{rank_label}" title="{title}">'
                         f'<span class="rk-value{cls}">{value}{badge}</span></td>')
        body += '</tr>'
    return ('<div class="rk-table-wrap latest-table-wrap" role="region" tabindex="0" aria-label="全部模型七数据集指标表，可左右滑动">'
            '<table class="rk-table latest-table"><caption>16 个模型 · 7 个数据集 · 3 项图像指标'
            '<span>左右滑动查看全部数据集 →</span></caption>'
            f'<thead>{head}</thead><tbody>{body}</tbody></table></div>')


def compose(root, historical_main):
    source = root / 'content/experiments' / SOURCE
    raw = source.read_text(encoding='utf-8')
    data = read_snapshot(raw)
    output = root / 'thesis/experiments/reproductions/data'
    output.mkdir(parents=True, exist_ok=True)
    (output / SOURCE).write_bytes(source.read_bytes())
    (output / 'all-models-20261011.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['method', 'family', 'input_protocol', 'dataset', 'metric', 'display_value', 'global_rank', 'protocol_rank', 'status', 'source_note'])
    for row in data['rows']:
        for dataset, metrics in row['datasets'].items():
            for metric, cell in metrics.items():
                writer.writerow([row['method'], row['family'], row['protocol'], dataset, metric, cell['display_value'], cell['global_rank'], cell['protocol_rank'], cell['status'], cell['note']])
    (output / 'all-models-display-20261011.csv').write_text(stream.getvalue(), encoding='utf-8')
    updated = datetime.fromisoformat(data['source_report_updated_utc']).astimezone(timezone(timedelta(hours=8)))
    body = '<main id="main" class="experiment-main research-overview rankings" data-rk-root>'
    body += ('<header class="experiment-header ro-header"><div class="ro-breadcrumb">'
             '<a class="back-link" href="../index.html">← 返回实验</a><a href="../datasets/index.html">当前数据集 →</a></div>'
             f'<p class="experiment-date">源报告更新于 <time datetime="{escape(data["source_report_updated_utc"])}">{updated:%Y-%m-%d %H:%M}</time> · 北京时间</p>'
             '<h1 tabindex="-1">原方法复现指标汇总</h1><p class="experiment-subtitle">全部模型 · 七类公开内窥镜数据</p></header>')
    body += ('<section id="latest-comparison" class="latest-comparison" aria-label="最新完整结果">'
             '<div class="latest-stats"><span><strong>16</strong> 个模型</span><span><strong>7</strong> 个数据集</span>'
             '<span><strong>105 / 105</strong> 完整留出组合</span><span><strong>15,107</strong> 图像指标记录</span></div>'
             '<p class="rk-note">合并覆盖 87 条评价流、1,004 个留出目标。EndoSLAM 新增 65 条评价流、742 个目标；Endo-E2E-GS 的 47 条源视图诊断单列，不参加留出排名。</p>'
             '<div class="latest-toolbar"><label for="latest-rank-scope">排名范围 <select id="latest-rank-scope">'
             '<option value="global">全部完整留出方法</option><option value="protocol">各输入协议内部</option></select></label>'
             '<div class="rk-legend"><span class="rk-legend-first">① 第一名</span><span class="rk-legend-second">② 第二名</span></div></div>'
             '<p class="rk-note" id="latest-rank-description" aria-live="polite">每个数据集、每项指标，在全部完整留出方法中标记第一与第二。</p>')
    body += table(data)
    body += ('<p class="rk-table-note">PSNR ↑ / SSIM ↑ / LPIPS ↓。采用 256×256 PNG 全图评价、skimage SSIM、LPIPS-SqueezeNet v0.1；序列内帧等权、数据集内序列等权。显示值及两套名次均来自提供的结果表，不按显示小数重新排名；部分结果与源视图诊断不参加留出排名。</p>'
             '<p class="rk-takeaway">输入图数、训练预算、相机来源和划分不同，排名只说明本实验的图像指标；不能称为等输入预算比较、官方论文成绩或几何精度结论。</p></section>')
    body += ('<section id="latest-input-protocol" class="latest-explanation"><h2>输入与评价边界</h2><ul>'
             '<li>EndoSLAM 逐场景训练最多使用 20 张候选训练图，最终实际上下文图数以各场景 scene_manifest 为准；前馈方法只使用 2 张训练上下文图。</li>'
             '<li>EndoSLAM 采用全局训练 / 目标互斥划分。训练相机估计不使用目标 RGB；独立的目标相机估计步骤使用目标 RGB。15 个适用方法共用估计相机，因此不是 GT 相机下的新视角测试。</li>'
             '<li>初始化深度来自训练 RGB 的 OpenD4RT 两帧预测，不是深度真值。VGGT、MoRe、OpenD4RT、Endo3R 使用外部两视图贴图网格渲染；OpenD4RT 为非官方复现。</li>'
             '<li>Endo-E2E-GS 在 EndoSLAM 中标为 N/A：不存在符合要求的同步、校准且重叠的双目输入。PillCam 的前后镜头交替触发，不能拼成同步双目。</li></ul>'
             '<details class="rk-details"><summary>查看完整来源说明、数值适配与旧六类划分限制</summary><div class="rk-detail-body">')
    body += ''.join(f'<p class="rk-note">{escape(p)}</p>' for p in data['source_paragraphs'][3:])
    body += ('<p class="rk-note">作者更新说明报告：EndoSLAM 新增 455 次训练、11,130 条记录；合并 609 次训练、87 条评价流、1,004 个留出目标、15,107 条记录（含 47 条源视图诊断）。</p></div></details></section>'
             '<section class="latest-evidence" id="latest-source"><h2>数据来源</h2>'
             '<p class="rk-note">源报告标记“EndoSLAM 验收：通过”。本次页面同步使用作者提供的 HTML；原始验收 JSON 与全精度 CSV 未随附，未独立复核验收状态或重算排名。下方 CSV / JSON 是展示值和已有名次的导出。</p>'
             '<div class="rk-footer-links"><a href="data/all-models-20261011.html" download>提供的原始结果表 HTML ↓</a>'
             '<a href="data/all-models-display-20261011.csv" download>展示值与排名 CSV ↓</a>'
             '<a href="data/all-models-20261011.json" download>展示值、排名及来源 JSON ↓</a></div></section>')
    # Keep all previous tables, exports, anchors and family navigation as history.
    history = re.sub(r'^<main\b[^>]*>', '', historical_main)
    history = re.sub(r'</main>$', '', history)
    history = re.sub(r'<header\b[^>]*>.*?</header>', '', history, count=1, flags=re.S)
    history = history.replace('当前主表 CSV ↓', '2026-10-08 历史展示 CSV ↓')
    body += ('<details class="rk-details latest-history" id="historical-results"><summary>历史指标与原始资料 · 2026-10-08 及更早</summary>'
             f'<div class="rk-detail-body">{history}</div></details></main>')
    return body
