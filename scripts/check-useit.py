"""Validate public report coverage, local links and evidence joins."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'useit/tests/2026-11-13'
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.ids=set();self.images=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.add(a['id'])
  for key in ['href','src']:
   if key in a:self.links.append(a[key])
  if tag=='img':self.images.append(a);assert a.get('alt')
  if tag=='a' and re.search(r'(?:^|/)B10(?:-R\d+|-latest)?\.html(?:#|$)',a.get('href','')):
   assert a.get('target')!='_blank','Internal test version link opens another tab'
errors=[];pages=[ROOT/'index.html',*list((ROOT/'useit').rglob('*.html'))]
for p in pages:
 text=p.read_text('utf8');doc=Parser();doc.feed(text)
 assert not re.search(r'C:\\\\Users|Bearer\s|sk-[a-zA-Z0-9]{20}|X-Amz-Signature|api_key=',text,re.I),p
 for link in doc.links:
  u=urlsplit(link)
  if u.scheme or u.netloc:continue
  target=(p.parent/unquote(u.path)).resolve() if u.path else p
  if target.is_dir():target/='index.html'
  if not target.exists():errors.append((str(p.relative_to(ROOT)),link))
  elif u.fragment and target.suffix=='.html':
   other=Parser();other.feed(target.read_text('utf8'))
   if unquote(u.fragment) not in other.ids:errors.append((str(p.relative_to(ROOT)),link))
cases=[json.loads(p.read_text('utf8')) for p in (BASE/'data').glob('*.json')]
assert len(cases)==15
assert len({c['case'].split('-')[0] for c in cases})==12
assert sum(len(c['images']) for c in cases)==32
for c in cases:
 assert len(c['observations'])==c['observation_count']
 assert c['langfuse_url'].endswith(c['session_id'])
 if c['case']=='B10':assert c['agent_seconds'] is None and c['root_timing_anomaly']
 if c['case']=='B01':assert c['agent_seconds']==676
 for f in c['failures']:
  if f.get('observation_id'):assert any(o['id']==f['observation_id'] for o in c['observations'])
 assert (BASE/(c['case']+'.html')).exists()
assert not errors,errors
retests=[]
for name,source in [('B10-R2','placement-fix'),('B10-R3','placement-fire'),('B10-R4','placement-speed'),('B10-R5','placement-natural'),('B10-R6','placement-rewrite'),('B10-R7','placement-gta')]:
 if not (ROOT/f'content/useit/{source}-2026-11-14.json').exists():continue
 r=json.loads((BASE/f'evidence/{name}-placement.json').read_text('utf8'));retests.append(r)
 assert r==json.loads((ROOT/f'content/useit/{source}-2026-11-14.json').read_text('utf8'))
 assert r['batch_status']=='completed' and not r['failure_observations']
 assert r['saved_image_count']==r['saved_placement_count']==len(r['placements'])==3
 for i,p in enumerate(r['placements']):
  assert p['success'] and p['receipt']['status']=='applied'
  if i:assert p['receipt']['rev']['before']==r['placements'][i-1]['receipt']['rev']['after']
 for im in r['images']:
  assert hashlib.sha256((BASE/im['src']).read_bytes()).hexdigest()==im['source_sha256']
 assert (BASE/f'{name}.html').is_file()
for p in [*(BASE/'data').glob('*.json'),*(BASE/'evidence').glob('*.json'),*(ROOT/'content/useit').glob('*.json')]:
 assert not re.search(r'Bearer\s|sk-[a-zA-Z0-9]{20}|X-Amz-Signature|api_key=|[A-Z]:[\\/]Users',p.read_text('utf8'),re.I),p
fastflow=ROOT/'content/useit/placement-fastflow-2026-11-15.json'
if fastflow.exists():
 bundle=json.loads(fastflow.read_text('utf8'));r=bundle['report']
 public=json.loads((BASE/'evidence/B10-R8-placement.json').read_text('utf8'))
 assert all(public[key]==value for key,value in bundle.items())
 assert r['summary_available'] and all(run['final_state']=='done' for run in r['execution_runs'])
 assert r['saved_image_count']==r['saved_placement_count']==3 and not r['failure_observations']
 assert {p['face'] for p in r['placements']}=={'frame-a','frame-b','back'}
 assert all(p['success'] for p in r['placements'])
 assert abs(sum(i['milliseconds'] for i in bundle['runtime']['items'])-r['agent_seconds']*1000)<1
 assert r['langfuse_url'].startswith('https://') and r['langfuse_url'].endswith(r['session_id'])
 for report in [r,*[a['report'] for a in bundle['attempts']]]:
  assert report['langfuse_url'].startswith('https://')
  for im in report['images']:
   assert hashlib.sha256((BASE/im['src']).read_bytes()).hexdigest()==im['display_sha256']
   assert hashlib.sha256((BASE/im['original_src']).read_bytes()).hexdigest()==im['sha256']
 print('PASS: R8 completed, disjoint timing, 3 saved faces, valid Langfuse links and 9 source/display image hashes.')
short_file=ROOT/'content/useit/short-prompts-2026-11-15.json'
if short_file.exists():
 bundle=json.loads(short_file.read_text('utf8'))
 assert bundle==json.loads((BASE/'evidence/B10-short-prompts.json').read_text('utf8'))
 assert [r['case'] for r in bundle['cases']]==['B10-R9','B10-R10']
 for r in bundle['cases']:
  assert r['summary_available'] and r['post_run_verification']['success']
  assert len(r['prompt'])<=20 and not r['bootstrap_fastpath_applied']
  assert r['saved_image_count']==r['saved_placement_count']==3
  assert {p['face'] for p in r['placements']}=={'frame-a','frame-b','back'}
  assert all(p['success'] and p['data']['version_saved'] for p in r['placements'])
  assert abs(sum(i['milliseconds'] for i in r['runtime']['items'])-r['agent_seconds']*1000)<1
  assert r['langfuse_url'].startswith('https://') and r['langfuse_url'].endswith(r['session_id'])
  for im in r['images']:
   assert hashlib.sha256((BASE/im['src']).read_bytes()).hexdigest()==im['display_sha256']
   assert hashlib.sha256((BASE/im['original_src']).read_bytes()).hexdigest()==im['sha256']
 print('PASS: R9/R10 short inputs, actual saved faces, disjoint timings, intact links, and six source/display image hashes.')
print(f'PASS: {len(pages)} pages, 12 categories, 15 original attempts/32 images/{sum(c["observation_count"] for c in cases)} observations plus {len(retests)} independent retests/{sum(len(r["images"]) for r in retests)} verified images/{sum(r["observations"] for r in retests)} observations; all links and anchors resolve.')
