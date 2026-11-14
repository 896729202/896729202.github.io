"""Validate public report coverage, local links and evidence joins."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json,re
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
print(f'PASS: {len(pages)} pages, 12 categories, 15 attempts, 32 images, {sum(c["observation_count"] for c in cases)} observations; all local links and anchors resolve.')
