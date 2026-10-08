"""Read-only source, download and navigation checks; no model execution."""
from __future__ import annotations
import csv
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT=Path(__file__).resolve().parent.parent


class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.ids=[];self.refs=[];self.metrics=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        for key in ('href','src'):
            if key in a:self.refs.append(a[key])
        if 'data-metric' in a:self.metrics.append(a)


def main():
    source=ROOT/'content/distillation'
    data=json.loads((source/'index.json').read_text())
    pages=[ROOT/'thesis/index.html',ROOT/'thesis/distillation/index.html']
    for item in data['entries']:
        d=json.loads((source/item['file']).read_text())
        out=ROOT/'thesis/distillation'/d['slug']
        assert json.loads((out/'summary.json').read_text())==d
        with (out/'metrics.csv').open(newline='') as f:rows=list(csv.DictReader(f))
        assert rows==d['results'],'CSV precision or row mismatch'
        for filename,key in [('teacher-validation.csv','teacher_validation'),('teacher-control.csv','teacher_control')]:
            with (out/filename).open(newline='') as f:rows=list(csv.reader(f))
            assert rows==[d[key]['headers']]+d[key]['rows']
        page=Page();page.feed((out/'index.html').read_text())
        expected=[(metric,r[metric+'_before'],r[metric+'_after']) for r in d['results'] for metric in ('psnr','ssim','lpips')]
        assert [(r['data-metric'],r['data-before'],r['data-after']) for r in page.metrics]==expected
        assert {'method','results','teachers','conclusion'}.issubset(page.ids)
        text=(out/'index.html').read_text()
        assert '同视角重投影' in text and '不是新视角' in text and '记录日期' in text
        assert '/hy-tmp/' not in text
        pages.append(out/'index.html')
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
    print(f'PASS: {len(pages)} pages, exact before/after metrics, teacher tables, source copies, downloads, anchors and section links.')


if __name__=='__main__':main()
