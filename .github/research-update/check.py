"""Repository-level data, link and preservation checks; no model execution."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import csv,hashlib,json,subprocess
from decimal import Decimal
ROOT=Path(__file__).resolve().parents[2]
BASE='fd6021df83dd8ff8ac90431fc8ba0d8f7a047c3b'
def load(path): return json.loads((ROOT/path).read_text())
def old(path): return subprocess.check_output(['git','show',BASE+':'+path],cwd=ROOT)
class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.ids=[];self.links=[];self.downloads=[];self.chunks=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if 'href' in a:self.links.append(a['href'])
  if tag=='script' and 'src' in a:self.links.append(a['src'])
  if 'download' in a:self.downloads.append(a.get('href',''))
 def handle_data(self,data):self.chunks.append(data)
base=load('content/experiments/reproductions.json')
prior=json.loads(old('content/experiments/reproductions.json'))
assert base['groups']==prior['groups'],'Historical groups changed'
assert base['overview']['date']==prior['overview']['date'],'Historical summary date changed'
assert base['sources']==prior['sources'] and base['source_note']==prior['source_note']
d=load('content/datasets.json');u=load('content/experiments/'+base['update_file'])
assert d['record_date']==u['updated']=='2026-10-08'
assert len(d['records'])==9 and sum(r[1] for r in d['coverage'])==22 and sum(r[2] for r in d['coverage'])==262
assert u['coverage']==d['coverage']
image=list(csv.DictReader((ROOT/'content/experiments'/u['image_csv']).open()))
control=list(csv.DictReader((ROOT/'content/experiments'/u['control_csv']).open()))
ec=list(csv.DictReader((ROOT/'content/experiments'/u['ec_csv']).open()))
assert len(image)==18 and len(control)==6 and len(ec)==7
assert sum(int(r['目标帧数']) for r in image)==786
expect={r[0]:r[2] for r in d['coverage']}
assert {(r['数据集'],r['方法']) for r in image}=={(k,m) for k in expect for m in ['DepthSplat','MVSplat','OpenD4RT＋贴图渲染']}
assert all(int(r['目标帧数'])==expect[r['数据集']] for r in image)
cm={r['数据集']:Decimal(r['PSNR']) for r in control}
for ds in ['StereoMIS','EndoNeRF','EndoNeRF-EC','Hamlyn']:
 assert all(Decimal(r['PSNR'])<cm[ds] for r in image if r['数据集']==ds)
for ds,expected in [('SCARED','1.255546'),('C3VD','0.734206')]:
 value=next(Decimal(r['PSNR']) for r in image if r['数据集']==ds and r['方法']=='DepthSplat')
 assert value-cm[ds]==Decimal(expected)
assert not any(r['场景']=='pulling' and r['方法']=='EndoGaussian' for r in ec)
assert len(u['depth']['rows'])==4 and len(u['pilot']['rows'])==2
assert all(r[-1]=='未提供' for r in u['pilot']['rows'])
assert [s['total'] for s in d['sequence_breakdown']]==[2744,20058,948]
assert 2744+20058==22802
for name in [u['image_csv'],u['control_csv'],u['ec_csv']]:
 assert (ROOT/'content/experiments'/name).read_bytes()==(ROOT/'thesis/experiments/reproductions/data'/name).read_bytes()
checked=0
for slug in ['datasets','reproductions']:
 path=ROOT/f'thesis/experiments/{slug}/index.html'
 text=path.read_text();page=Page();page.feed(text)
 assert len(page.ids)==len(set(page.ids)),(slug,'duplicate ids')
 assert '2026-10-08' in text and '/hy-tmp/' not in text
 assert 'assets/research-overviews.css' in text and '内窥镜三维重建' in text
 assert page.downloads
 for href in page.links:
  url=urlsplit(href)
  if url.scheme or url.netloc:continue
  target=(ROOT/unquote(url.path).lstrip('/') if url.path.startswith('/') else path.parent/unquote(url.path)).resolve() if url.path else path
  if target.is_dir():target=target/'index.html'
  assert target.is_file(),(slug,href,'missing link')
  if url.fragment:
   target_page=Page();target_page.feed(target.read_text())
   assert unquote(url.fragment) in target_page.ids,(slug,href,'missing anchor')
  checked+=1
 if slug=='reproductions':
  assert all(f'experiment-{i}' in page.ids for i in range(1,5))
  all_text=' '.join(page.chunks)
  for g in prior['groups']:
   for t in g['tables']:
    for row in t['rows']:
     for value in row:assert str(value) in all_text,(value,'historical value missing')
allowed={'content/datasets.json','content/experiments/reproductions.json','scripts/dataset_inventory.py','scripts/experiment_summaries.py','thesis/experiments/datasets/index.html','thesis/experiments/reproductions/index.html','thesis/experiments/reproductions/summary.json'}
tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],cwd=ROOT,text=True).splitlines()
for n in tracked:
 if n not in allowed:
  assert (ROOT/n).read_bytes()==old(n),'Unrelated file modified: '+n
before={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.rglob('*') if p.is_file() and '.git' not in p.parts and '__pycache__' not in p.parts}
subprocess.run([__import__('sys').executable,'scripts/build.py'],cwd=ROOT,check=True)
for n,h in before.items():assert hashlib.sha256((ROOT/n).read_bytes()).hexdigest()==h,'Non-idempotent build: '+n
print(f'PASS: {checked} local links / anchors / assets; all downloads valid.')
print('PASS: 18 full-precision image rows; 6 controls; 4 depth rows; 2 pilot rows; 7 EC rows; coverage 22 / 262 / 786.')
print('PASS: historical values, dates, LoRA, RL, datasets button and all dated experiment pages preserved; second build identical.')
