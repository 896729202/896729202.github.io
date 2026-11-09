"""Check published D4RT metrics against all exported targets; no model execution."""
from __future__ import annotations

import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path
from statistics import fmean
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'content/d4rt'
OUTPUT = ROOT / 'thesis/experiments/d4rt'
METRICS = (
    'baseline_D4RT_renderer_PSNR', 'frozen_new_renderer_PSNR',
    'native_parameters_new_renderer_PSNR', 'native_SSIM', 'native_LPIPS_squeeze',
    'appearance_memory_PSNR', 'appearance_memory_SSIM', 'appearance_memory_LPIPS_squeeze',
)


def read_csv(name):
    with (SOURCE / name).open(encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


def near(actual, expected, context, tolerance=1e-9):
    assert math.isfinite(float(actual)), context
    assert abs(float(actual) - float(expected)) <= tolerance, (context, actual, expected)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.refs, self.tables = [], [], []
        self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        self.refs.extend(attrs[key] for key in ('href', 'src') if key in attrs)
        if tag == 'table':
            self.tables.append([])
        if tag == 'tr':
            self.row = []
        if tag in ('th', 'td'):
            self.cell = []

    def handle_data(self, text):
        if self.cell is not None:
            self.cell.append(text)

    def handle_endtag(self, tag):
        if tag in ('th', 'td') and self.cell is not None:
            self.row.append(''.join(self.cell).strip())
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.tables[-1].append(self.row)
            self.row = None


def main():
    data = json.loads((SOURCE / 'overview.json').read_text(encoding='utf-8'))
    frames = read_csv('per-frame.csv')
    sequences = read_csv('per-sequence.csv')
    results = read_csv('results.csv')
    legacy = read_csv('matched-legacy.csv')
    assert len(frames) == 1250 and len(sequences) == 110 and len(results) == 8
    assert len({f['case'] for f in frames}) == len(frames), 'Duplicate target IDs'
    assert Counter(f['data_group'] for f in frames) == {'Public': 1112, 'Synthetic-control': 138}
    assert Counter(f['original_target_split'] for f in frames if f['data_group'] == 'Synthetic-control') == {
        'test': 108, 'val': 24, 'unpartitioned_smoke': 6}
    by_sequence = defaultdict(list)
    by_dataset = defaultdict(list)
    for frame in frames:
        by_sequence[frame['dataset'], frame['sequence']].append(frame)
        near(frame['native_PSNR_independent_PNG'], frame['native_parameters_new_renderer_PSNR'],
             frame['case'], tolerance=1e-5)
    assert len(by_sequence) == len(sequences)
    for sequence in sequences:
        key = sequence['dataset'], sequence['sequence']
        group = by_sequence[key]
        assert len(group) == int(sequence['frames'])
        assert Counter(f['original_target_split'] for f in group) == json.loads(sequence['original_target_split_counts'])
        for metric in METRICS:
            near(sequence[metric], fmean(float(f[metric]) for f in group), (key, metric))
        for prefix, metric in [('native', METRICS[2]), ('appearance_memory', METRICS[5])]:
            assert int(sequence[prefix + '_frames_at_least_28']) == sum(float(f[metric]) >= 28 for f in group)
        by_dataset[sequence['dataset']].append(sequence)
    assert set(by_dataset) == {r['dataset'] for r in results}
    for result in results:
        group = by_dataset[result['dataset']]
        targets = [f for f in frames if f['dataset'] == result['dataset']]
        assert len(group) == int(result['sequences']) and len(targets) == int(result['frames'])
        assert Counter(f['original_target_split'] for f in targets) == json.loads(result['original_target_split_counts'])
        assert result['benchmark_valid'] == 'False'
        source_row = next(r for r in data['results'] if r['dataset'] == result['dataset'])
        assert source_row['benchmark_valid'] is False
        for metric in METRICS:
            near(result[metric], fmean(float(s[metric]) for s in group), (result['dataset'], metric))
            near(source_row[metric], result[metric], ('JSON/CSV', result['dataset'], metric))
        near(result['native_delta_vs_frozen_renderer'],
             float(result[METRICS[2]]) - float(result[METRICS[1]]), result['dataset'])
        for prefix, metric in [('native', METRICS[2]), ('appearance_memory', METRICS[5])]:
            assert int(result[prefix + '_frames_at_least_28']) == sum(float(f[metric]) >= 28 for f in targets)
            near(result[prefix + '_min_frame_PSNR'], min(float(f[metric]) for f in targets), result['dataset'])
        if int(result['native_best_step']) == 0:
            near(result[METRICS[2]], result[METRICS[1]], ('step 0', result['dataset']))
    assert sum(int(r['frames']) for r in legacy) == 1004
    assert sum(int(r['sequences']) for r in legacy) == 87
    assert len(legacy) == 7 and all(r['data_group'] == 'Public' for r in legacy)

    for file in data['files']:
        content = (SOURCE / file['name']).read_bytes()
        assert hashlib.sha256(content).hexdigest() == file['sha256']
        assert content == (OUTPUT / file['name']).read_bytes()
    assert json.loads((OUTPUT / 'summary.json').read_text(encoding='utf-8')) == data
    for file in [*SOURCE.iterdir(), *OUTPUT.iterdir()]:
        if file.is_file():
            text = file.read_text(encoding='utf-8')
            assert all(marker not in text for marker in ('/hy-tmp/', '/root/', 'PRIVATE KEY')), file
    page = Page()
    html = (OUTPUT / 'index.html').read_text(encoding='utf-8')
    page.feed(html)
    assert len(page.ids) == len(set(page.ids)), 'Duplicate HTML IDs'
    for ref in page.refs:
        parts = urlsplit(ref)
        if parts.scheme or parts.netloc:
            continue
        target = ROOT / unquote(parts.path).lstrip('/') if parts.path.startswith('/') else OUTPUT / unquote(parts.path)
        if not parts.path:
            target = OUTPUT / 'index.html'
        if target.is_dir():
            target /= 'index.html'
        assert target.exists(), ('Broken local link', ref)
        if parts.fragment and target.suffix == '.html':
            linked = Page()
            linked.feed(target.read_text(encoding='utf-8'))
            assert unquote(parts.fragment) in linked.ids, ('Missing anchor', ref)
    cells = page.tables[0][1:] + page.tables[1][1:]
    assert len(cells) == len(results)
    for row in cells:
        source_row = next(r for r in results if r['dataset'] == row[0])
        assert row[1] == f"{source_row['frames']} / {source_row['sequences']}"
        for column, metric in [(2, METRICS[0]), (3, METRICS[1]), (4, METRICS[2]), (6, METRICS[5])]:
            assert row[column].removesuffix(' †') == f'{float(source_row[metric]):.2f}'
        assert row[5] == f"{float(source_row['native_delta_vs_frozen_renderer']):+.2f}"
    assert all(term in html for term in ('不是独立测试成绩', '第 0 步', '138', 'GT_mask', '不是原生 D4RT 参数微调'))
    for file in (ROOT / 'thesis/index.html', ROOT / 'thesis/experiments/index.html'):
        assert file.read_text(encoding='utf-8').count('data-d4rt-column') == 1
    assert (ROOT / 'thesis/experiments/grpo/index.html').read_text(encoding='utf-8').count('data-d4rt-archive') == 1
    print('PASS: 1250 unique targets → 110 sequences → 8 groups; all eight metrics, thresholds, PNG cross-checks, published PSNR cells, exact downloads and local links validated.')


if __name__ == '__main__':
    main()
