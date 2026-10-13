"""Read-only source, download and navigation checks; no model execution."""
from __future__ import annotations
import csv
import argparse
import hashlib
import json
import re
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT=Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.refs=[];self.metrics=[]
        self.rows=[];self.row=None;self.cell=None
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        for key in ('href','src'):
            if key in a:self.refs.append(a[key])
        if 'data-metric' in a:self.metrics.append(a)
        if tag=='tr':self.row=[]
        if tag in ('th','td') and self.row is not None:self.cell=[]
    def handle_data(self,text):
        if self.cell is not None:self.cell.append(text)
    def handle_endtag(self,tag):
        if tag in ('th','td') and self.cell is not None:
            self.row.append(''.join(self.cell));self.cell=None
        if tag=='tr' and self.row is not None:
            self.rows.append(self.row);self.row=None


def check_selector(data, output, page, source_report=None):
    """Optionally audit against a local report without publishing that report."""
    primary=data['primary_results']
    with (output/'metrics.csv').open(newline='',encoding='utf-8') as f:
        assert list(csv.reader(f))==[primary['headers']]+primary['rows']
    sections={s['id']:s for s in data['sections']}
    if source_report is not None:
        report=source_report.read_bytes()
        assert hashlib.sha256(report).hexdigest()==data['source_sha256']
        tables=[];current=[]
        for line in report.decode('utf-8').splitlines()+['']:
            if line.startswith('|'):
                if not re.fullmatch(r'[|:\s-]+',line):
                    current.append([c.strip() for c in line.strip('|').split('|')])
            elif current:
                tables.append(current);current=[]
        original=tables[0][1:]
        assert [r[1:] for r in primary['rows']]==[r[1:4] for r in original[:6]]
        static=sections['preference-transfer']['tables'][1]['rows']
        assert [r[1] for r in static]==[r[4] for r in original[:6]]
        raw=sections['evaluation-scope']['tables'][1]['rows']
        assert [r[1:] for r in raw]==[r[1:] for r in tables[1][1:]]
        history=sections['evaluation-scope']['tables'][2]['rows']
        assert [r[1:] for r in history]==[r[1:] for r in original[6:]]
    shares=sections['fixed-head']['tables'][0]['rows']
    for i in range(3):
        base,fixed,best=[Decimal(primary['rows'][r][i+1]) for r in range(3)]
        assert f'{100*(base-fixed)/(base-best):.2f}%'==shares[i][1]
    assert Decimal(primary['rows'][3][3])-Decimal(primary['rows'][4][3])==Decimal('0.004088')
    for table in [primary]+[t for s in data['sections'] for t in s['tables']]:
        expected=[table['headers']]+table['rows']
        assert any(page.rows[i:i+len(expected)]==expected for i in range(len(page.rows))), 'Rendered table changed'
    assert {'protocol','results',*sections}.issubset(page.ids)
    assert data['experiment_date'] is None
    assert not any('SELECTOR-SAMPLING-GENERALIZATION-' in ref for ref in page.refs), 'Unavailable artifact linked'
    assert not (output/'report.md').exists(), 'Full local report must not be published'
    assert 'report.md' not in page.refs


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-report',type=Path,help='Optional local report for independent value and hash checks; never copied')
    args=parser.parse_args()
    source=ROOT/'content/distillation'
    data=json.loads((source/'index.json').read_text())
    pages=[ROOT/'thesis/index.html',ROOT/'thesis/distillation/index.html']
    for item in data['entries']:
        d=json.loads((source/item['file']).read_text())
        out=ROOT/'thesis/distillation'/d['slug']
        assert json.loads((out/'summary.json').read_text())==d
        page=Page();page.feed((out/'index.html').read_text())
        pages.append(out/'index.html')
        if d.get('kind')=='selector_diagnostic':
            check_selector(d,out,page,args.source_report)
            continue
        with (out/'metrics.csv').open(newline='') as f:rows=list(csv.DictReader(f))
        assert rows==d['results'],'CSV precision or row mismatch'
        for filename,key in [('teacher-validation.csv','teacher_validation'),('teacher-control.csv','teacher_control')]:
            with (out/filename).open(newline='') as f:rows=list(csv.reader(f))
            assert rows==[d[key]['headers']]+d[key]['rows']
        expected=[(metric,r[metric+'_before'],r[metric+'_after']) for r in d['results'] for metric in ('psnr','ssim','lpips')]
        assert [(r['data-metric'],r['data-before'],r['data-after']) for r in page.metrics]==expected
        assert {'method','results','teachers','conclusion'}.issubset(page.ids)
        text=(out/'index.html').read_text()
        assert '同视角重投影' in text and '不是新视角' in text and '记录日期' in text
        assert '/hy-tmp/' not in text
    for path in pages:
        p=Page();p.feed(path.read_text())
        assert len(p.ids)==len(set(p.ids)),f'Duplicate IDs: {path}'
        for link in p.refs:
            u=urlparse(link)
            if u.scheme or u.netloc:continue
            target=(ROOT/unquote(u.path).lstrip('/') if u.path.startswith('/') else path.parent/unquote(u.path)).resolve() if u.path else path
            if target.is_dir():target=target/'index.html'
            assert target.is_relative_to(ROOT) and target.is_file(),f'Broken link: {link}'
            if u.fragment and target.suffix=='.html':
                parsed=Page();parsed.feed(target.read_text())
                assert unquote(u.fragment) in parsed.ids,f'Broken fragment: {link}'
    landing=(ROOT/'thesis/index.html').read_text()
    assert landing.count('href="distillation/index.html"')==1
    assert 'href="experiments/index.html"' in landing
    assert data['title'] in landing
    print(f'PASS: {len(pages)} pages, teacher metrics, selector values and arithmetic, downloads, anchors and section links; local report audit={args.source_report is not None}.')


if __name__=='__main__':main()
