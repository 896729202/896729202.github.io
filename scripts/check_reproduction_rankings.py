"""Read-only checks for the dataset/family presentation, never evaluate models."""
from __future__ import annotations
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import reproduction_rankings as ranking

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'thesis/experiments/reproductions'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = []
        self.ranked_missing = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        for key in ('href', 'src'):
            if key in a:
                self.refs.append(a[key])
        if tag == 'td' and a.get('data-metric') == 'mae' and a.get('data-rank'):
            self.ranked_missing.append(a)


def main():
    view = json.loads((OUTPUT/'data/four-metric-view-20261008.json').read_text())
    tables = {t['id']: t for t in view['tables']}
    assert len(tables) == 11
    raw = json.loads((OUTPUT/'summary.json').read_text())
    update = raw['current_update']
    for scenario, group in zip(['pulling', 'cutting'], raw['groups'][:2]):
        rows = tables[f'endo-endonerf-{scenario}']['rows']
        expected = group['tables'][0]['rows']
        assert [(r['method'], r['psnr'], r['ssim'], r['lpips']) for r in rows] == [(r[0], *r[2:5]) for r in expected]
    for scenario in ('pulling', 'cutting'):
        rows = tables[f'endo-ec-{scenario}']['rows']
        expected = [r for r in update['ec_noadapt_full'] if r['场景'] == scenario]
        assert [(r['method'], r['psnr'], r['ssim'], r['lpips']) for r in rows] == [(r['方法'],r['块PSNR'],r['块SSIM'],r['块LPIPS']) for r in expected]
    for key, dataset in ranking.DATASETS:
        rows = tables[f'general-{key}-image']['rows']
        expected = [r for r in update['image_metrics'] if r['数据集'] == dataset]
        assert len(rows) == 4
        assert [(r['method'], r['psnr'], r['ssim'], r['lpips']) for r in rows[:3]] == [(r['方法'],r['PSNR'],r['SSIM'],r['LPIPS']) for r in expected]
        control = next(r for r in update['mean_input_control'] if r['数据集'] == dataset)
        assert rows[-1]['control'] is True
        assert [rows[-1][m] for m in ['psnr','ssim','lpips']] == [control[m] for m in ['PSNR','SSIM','LPIPS']]
    assert len(tables['endo-scared-pilot']['rows']) == 2
    for actual, original in zip(tables['endo-scared-pilot']['rows'],update['pilot']['rows']):
        assert actual['psnr'] == original[3] and actual['ssim'] == original[4]
    for t in tables.values():
        assert all(row['mae'] is None for row in t['rows']), 'MAE must not be invented'
        assert not any(t['ranks']['mae'])
        for key, _, _, _, higher in ranking.METRICS:
            expected = ranking.ranks([r[key] for r in t['rows']], higher) if t['ranking_enabled'] else [None]*len(t['rows'])
            assert t['ranks'][key] == expected
    assert ranking.ranks(['2','2','1',None], True) == [1,1,2,None]
    assert ranking.ranks(['2','1',None], False) == [2,1,None]
    assert ranking.ranks(['2',None], True) == [None,None]
    assert ranking.ranks(['0.100001','0.100002'],False) == [1,2]
    assert tables['general-scared-image']['ranks']['psnr'] == [1,3,2,4]
    assert tables['general-c3vd-image']['ranks']['psnr'] == [1,3,4,2]
    for key in ('stereomis','endonerf','ec','hamlyn'):
        assert tables[f'general-{key}-image']['ranks']['psnr'][-1] == 1
    assert tables['endo-scared-pilot']['ranks']['psnr'] == [None,None]
    page = (OUTPUT/'index.html').read_text()
    p = Links();p.feed(page)
    assert len(p.ids) == len(set(p.ids)), 'Duplicate IDs'
    for anchor in ['method-status','latest','latest-protocol','mean-control','depth','pilot','ec-20261006','history',*[f'experiment-{i}' for i in range(1,5)]]:
        assert anchor in p.ids, 'Historical anchor missing: '+anchor
    assert not p.ranked_missing
    assert page.count('data-rk-family') == 2
    assert page.count('data-rk-dataset') == 12
    assert page.count('data-table=') == 11
    assert '内窥镜专用方法' in page and '通用三维重建方法' in page
    assert 'rk-rank-1' in page and 'rk-rank-2' in page
    for href in p.refs:
        parsed = urlparse(href)
        if parsed.scheme or parsed.netloc:
            continue
        path = (ROOT/parsed.path.lstrip('/') if parsed.path.startswith('/') else OUTPUT/unquote(parsed.path)).resolve()
        if not parsed.path:
            path = OUTPUT/'index.html'
        if path.is_dir():
            path /= 'index.html'
        assert path.is_relative_to(ROOT), 'Link outside repository'
        assert path.is_file(), 'Missing local link: '+href
        if parsed.fragment and path.suffix == '.html':
            ids = set(re.findall(r'\bid="([^"]+)"',path.read_text()))
            assert unquote(parsed.fragment) in ids, 'Missing fragment: '+href
    csv_text = (OUTPUT/'data/four-metric-view-20261008.csv').read_text()
    assert '24.717929' in csv_text and '0.714145' in csv_text
    assert '/hy-tmp/' not in page
    print(f'PASS: {len(tables)} four-metric tables; exact source values; controls; ties; missing MAE; all {len(p.refs)} page links/anchors.')


if __name__ == '__main__':
    main()
