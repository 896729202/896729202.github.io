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


def report_tables(report):
    """Parse local Markdown tables in memory; never copy a source report."""
    tables=[];current=[]
    for line in report.decode('utf-8-sig').splitlines()+['']:
        if line.startswith('|'):
            if not re.fullmatch(r'[|:\s-]+',line):
                current.append([c.strip() for c in line.strip('|').split('|')])
        elif current:
            tables.append(current);current=[]
    return tables


def check_sampling_generalization(data, sections, tables):
    primary=data['primary_results']
    assert len(primary['rows'])==6
    shares=sections['fixed-head']['tables'][0]['rows']
    for i in range(3):
        base,fixed,best=[Decimal(primary['rows'][r][i+1]) for r in range(3)]
        assert f'{100*(base-fixed)/(base-best):.2f}%'==shares[i][1]
    assert Decimal(primary['rows'][3][3])-Decimal(primary['rows'][4][3])==Decimal('0.004088')
    raw=sections['evaluation-scope']['tables'][1]['rows']
    assert [r[2] for r in raw]==[r[3] for r in primary['rows']]
    coverage=sections['preference-transfer']['tables'][0]['rows']
    assert [r[3:] for r in coverage]==[['15/16','1/12'],['14/16','0/12'],['13/16','1/12']]
    for row in coverage:
        assert sum(json.loads(row[1]))==16 and sum(json.loads(row[2]))==12
    if tables is not None:
        original=tables[0][1:]
        assert [r[1:] for r in primary['rows']]==[r[1:4] for r in original[:6]]
        static=sections['preference-transfer']['tables'][1]['rows']
        assert [r[1] for r in static]==[r[4] for r in original[:6]]
        assert [r[1:] for r in raw]==[r[1:] for r in tables[1][1:]]
        history=sections['evaluation-scope']['tables'][2]['rows']
        assert [r[1:] for r in history]==[r[1:] for r in original[6:]]
        arms=sections['paired-arms']['tables'][1]['rows']
        normalized=[[c.replace('＋','+') for c in row] for row in tables[5][1:]]
        assert arms==normalized, 'Original per-seed A/B/C values or reported deltas changed'
        assert [r[:3] for r in coverage]==[r[:3] for r in tables[7][1:]]


def check_clip_coverage(data, sections, tables):
    primary=data['primary_results']
    rows=primary['rows']
    assert primary['headers']==['方法','选头所用信息','K3 XYZ ↓']
    assert [r[1] for r in rows]==['无需奖励选头','K1＋K2 平均奖励','K1 奖励标签',
                                 'K1＋K2 奖励标签','全部 K3 目标奖励','每帧 K3 目标奖励']
    assert [r[2] for r in rows]==['8.659784','8.648655','8.684987','8.540419','8.340851','8.333794']
    assert '全部12帧' in primary['caption'], 'Full-clip and anchor-excluded metrics must stay separate'
    values=[Decimal(r[2]) for r in rows]
    assert values[1]-values[3]==Decimal('0.108236')
    assert values[2]-values[3]==Decimal('0.144568')
    assert values[4]-values[5]==Decimal('0.007057')

    decomposition,seeds=sections['clip-preference']['tables']
    assert decomposition['rows'][0][-1]=='92.44% / 7.56%'
    for row in decomposition['rows']:
        between,within,total=map(Decimal,row[1:4])
        # Each reported gap was independently rounded to eight decimal places.
        assert abs(between+within-total)<=Decimal('0.00000001')
        assert f'{100*between/total:.2f}% / {100*within/total:.2f}%'==row[4]
    assert [r[0] for r in seeds['rows']]==['17','29','43']
    for seed_col,primary_row in [(2,1),(3,4),(4,5),(5,2),(6,3)]:
        mean=sum(Decimal(r[seed_col]) for r in seeds['rows'])/3
        assert abs(mean-values[primary_row])<=Decimal('0.0000005'), 'Per-seed mean changed'
    assert Decimal(seeds['rows'][0][3])-Decimal(seeds['rows'][0][4])==Decimal('0.056034')
    assert all(Decimal(r[3])<Decimal(r[4]) for r in seeds['rows'][1:]), 'T/F geometric counterexamples lost'

    interior=sections['two-frame']['tables'][0]
    assert interior['headers'][1:]==['K1 14帧 ↓','K2 14帧 ↓','K3 10帧 ↓']
    assert len(interior['rows'])==8
    assert interior['rows'][0][3]=='8.662704'
    assert interior['rows'][5][3]==interior['rows'][6][3]=='8.364265'
    assert interior['rows'][7][3]=='8.356162'
    assert Decimal(interior['rows'][2][3])>Decimal(interior['rows'][0][3])
    assert '局部帧号0和95' in ''.join(sections['two-frame']['paragraphs'])

    fitting,transfer,coverage=sections['training-coverage']['tables']
    assert [(r[0],r[1]) for r in fitting['rows']]==[(k,m) for k in ('K1','K2','K3') for m in ('C','C12')]
    assert [r[-1] for r in fitting['rows'][-2:]]==[rows[2][2],rows[3][2]]
    assert [r[2:] for r in transfer['rows']]==[
        ['5/12','[0, 0, 2, 10]'],['0/12','[2, 0, 7, 3]'],['0/12','[0, 0, 0, 12]']]
    for source,row in zip(seeds['rows'],transfer['rows']):
        assert source[0]==row[0]
        assert Decimal(source[5])>Decimal(source[6])
        delta=Decimal(source[2])-Decimal(source[6])
        assert delta>0 and abs(delta-Decimal(row[1]))<=Decimal('0.000001')
        assert sum(json.loads(row[3]))==12
    assert [r[0] for r in coverage['rows']]==['17','29','43']
    for row in coverage['rows']:
        counts=json.loads(row[1])
        assert len(counts)==4 and all(c>0 for c in counts) and sum(counts)==32
        assert sum(json.loads(row[2]))==12
    assert fitting['rows'][-1][4]==f'{100*Decimal(5)/36:.2f}%'

    paired,costs=sections['limits-status']['tables']
    assert [r[2] for r in paired['rows']]==[r[2] for r in rows]
    assert [r[1] for r in paired['rows']]==['11.110799','12.065994','12.090388','12.013135','11.932662','11.885119']
    assert re.findall(r'\d+',costs['rows'][0][1])==['360','3','120','0']
    assert re.findall(r'\d+',costs['rows'][1][1])==['33','99','1452']

    if tables is not None:
        original=tables[0][1:]
        selected=[0,2,8,9,3,4]
        assert [r[2] for r in rows]==[original[i][3] for i in selected]
        assert [r[1:] for r in paired['rows']]==[[original[i][4],original[i][3],original[i][5]] for i in selected]
        assert [r[1:] for r in decomposition['rows']]==[r[2:] for r in tables[1][1:] if r[0]=='K3']
        assert seeds['rows']==tables[2][1:]
        assert [r[1:] for r in coverage['rows']]==[r[3:] for r in tables[4][1:]]
        anchor_rows=[0,1,2,9,10,3,4,5]
        assert [r[1:] for r in interior['rows']]==[tables[5][1:][i][1:4] for i in anchor_rows]
        assert [r[:1]+r[2:] for r in fitting['rows']]==[[r[0],*r[2:5],r[6]] for r in tables[6][1:]]
        assert transfer['rows']==[[r[0],r[2],r[6],r[7]] for r in tables[7][1:]]
        slot=sections['slot-control']['tables'][0]['rows']
        assert [r[1:] for r in slot]==[r[1:4] for r in tables[8][1:4]]


def check_selector(data, output, page, report=None):
    """Shared rendering/export checks, followed by the study's numeric audit."""
    assert data['schema_version']==2
    primary=data['primary_results']
    with (output/'metrics.csv').open(newline='',encoding='utf-8') as f:
        assert list(csv.reader(f))==[primary['headers']]+primary['rows'], 'Selector CSV precision or row mismatch'
    sections={s['id']:s for s in data['sections']}
    assert len(sections)==len(data['sections']), 'Duplicate source section IDs'
    for table in [primary]+[t for s in data['sections'] for t in s['tables']]:
        expected=[table['headers']]+table['rows']
        assert any(page.rows[i:i+len(expected)]==expected for i in range(len(page.rows))), 'Rendered table changed'
    assert {'protocol','results',*sections}.issubset(page.ids)
    assert data['experiment_date'] is None
    assert re.fullmatch(r'[0-9a-f]{64}',data['source_sha256'])
    assert {'summary.json','metrics.csv'}.issubset(page.refs), 'Missing public exports'
    assert not any(re.search(r'SELECTOR-SAMPLING-GENERALIZATION-|ROUTING-CLIP-COVERAGE-|/hy-tmp/',ref)
                   for ref in page.refs), 'Unavailable internal artifact linked'
    assert not list(output.rglob('*.md')), 'Full local report must not be published'
    assert not any(urlparse(ref).path.endswith('.md') for ref in page.refs), 'Local report linked'
    for path in output.rglob('*'):
        if path.is_file():
            assert hashlib.sha256(path.read_bytes()).hexdigest()!=data['source_sha256'], 'Full source report copied into public output'
    checks={'sampling_generalization':check_sampling_generalization,'clip_coverage':check_clip_coverage}
    profile=data['diagnostic_profile']
    assert profile in checks, f'Unknown selector diagnostic profile: {profile}'
    checks[profile](data,sections,report_tables(report) if report is not None else None)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-report',type=Path,action='append',default=[],
                        help='Optional local report; repeat for multiple studies. Matched by SHA256, never copied')
    args=parser.parse_args()
    source=ROOT/'content/distillation'
    data=json.loads((source/'index.json').read_text(encoding='utf-8'))
    studies=[json.loads((source/item['file']).read_text(encoding='utf-8')) for item in data['entries']]
    by_slug={d['slug']:d for d in studies}
    assert len(by_slug)==len(studies), 'Duplicate indexed study'
    assert [d['slug'] for d in studies]==[item['slug'] for item in data['entries']]
    reports={}
    known_hashes={d['source_sha256'] for d in studies if 'source_sha256' in d}
    for path in args.source_report:
        report=path.read_bytes()
        digest=hashlib.sha256(report).hexdigest()
        if digest not in known_hashes:
            parser.error(f'Source report SHA256 does not match any indexed study: {path}')
        reports[digest]=report
    profiles={d['diagnostic_profile']:d for d in studies if d.get('kind')=='selector_diagnostic'}
    if 'clip_coverage' in profiles:
        previous=profiles['sampling_generalization']
        current=profiles['clip_coverage']
        assert any(r['slug']==current['slug'] for r in previous['related_studies'])
        assert any(r['slug']==previous['slug'] for r in current['related_studies'])
    pages=[ROOT/'thesis/index.html',ROOT/'thesis/distillation/index.html']
    for d in studies:
        out=ROOT/'thesis/distillation'/d['slug']
        assert json.loads((out/'summary.json').read_text(encoding='utf-8'))==d
        page=Page();page.feed((out/'index.html').read_text(encoding='utf-8'))
        pages.append(out/'index.html')
        for related in d.get('related_studies',[]):
            other=by_slug[related['slug']]
            assert page.refs.count(f'../{other["slug"]}/index.html')==1, 'Related study link missing or duplicated'
            assert any(r['slug']==d['slug'] for r in other.get('related_studies',[])), 'Related study link is not reciprocal'
        if d.get('kind')=='selector_diagnostic':
            check_selector(d,out,page,reports.get(d['source_sha256']))
            continue
        with (out/'metrics.csv').open(newline='',encoding='utf-8') as f:rows=list(csv.DictReader(f))
        assert rows==d['results'],'CSV precision or row mismatch'
        for filename,key in [('teacher-validation.csv','teacher_validation'),('teacher-control.csv','teacher_control')]:
            with (out/filename).open(newline='',encoding='utf-8') as f:rows=list(csv.reader(f))
            assert rows==[d[key]['headers']]+d[key]['rows']
        expected=[(metric,r[metric+'_before'],r[metric+'_after']) for r in d['results'] for metric in ('psnr','ssim','lpips')]
        assert [(r['data-metric'],r['data-before'],r['data-after']) for r in page.metrics]==expected
        assert {'method','results','teachers','conclusion'}.issubset(page.ids)
        text=(out/'index.html').read_text(encoding='utf-8')
        assert '同视角重投影' in text and '不是新视角' in text and '记录日期' in text
        assert '/hy-tmp/' not in text
    for path in pages:
        p=Page();p.feed(path.read_text(encoding='utf-8'))
        assert len(p.ids)==len(set(p.ids)),f'Duplicate IDs: {path}'
        for link in p.refs:
            u=urlparse(link)
            if u.scheme or u.netloc:continue
            target=(ROOT/unquote(u.path).lstrip('/') if u.path.startswith('/') else path.parent/unquote(u.path)).resolve() if u.path else path
            if target.is_dir():target=target/'index.html'
            assert target.is_relative_to(ROOT) and target.is_file(),f'Broken link: {link}'
            if u.fragment and target.suffix=='.html':
                parsed=Page();parsed.feed(target.read_text(encoding='utf-8'))
                assert unquote(u.fragment) in parsed.ids,f'Broken fragment: {link}'
    landing=(ROOT/'thesis/index.html').read_text(encoding='utf-8')
    assert landing.count('href="distillation/index.html"')==1
    assert 'href="experiments/index.html"' in landing
    assert data['title'] in landing
    print(f'PASS: {len(pages)} pages, teacher metrics, {len(profiles)} selector profiles, values and arithmetic, downloads, anchors and reciprocal links; local reports audited={len(reports)}.')


if __name__=='__main__':main()
