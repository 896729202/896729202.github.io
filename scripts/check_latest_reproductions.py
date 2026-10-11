"""Check the published cells against the supplied report, without reranking."""
import hashlib
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Cells(HTMLParser):
    def __init__(self, latest=False):
        super().__init__()
        self.latest = latest
        self.cells = []
        self.methods = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'data-latest-method' in a:
            self.methods.append(a['data-latest-method'])
        value_key = 'data-display-value' if self.latest else 'data-value'
        if tag == 'td' and value_key in a:
            self.cells.append((a[value_key], a['data-global-rank'], a['data-protocol-rank'], a['title']))


def main():
    source = ROOT / 'content/experiments/all-models-20261011.html'
    output = ROOT / 'thesis/experiments/reproductions'
    original = Cells()
    original.feed(source.read_text(encoding='utf-8'))
    published = Cells(latest=True)
    page = (output / 'index.html').read_text(encoding='utf-8')
    published.feed(page)
    assert len(published.methods) == 16
    assert len(original.cells) == len(published.cells) == 321
    for expected, actual in zip(original.cells, published.cells):
        assert expected[:3] == actual[:3], (expected, actual)
        assert actual[3].startswith(expected[3])
    assert sum(bool(c[1]) for c in published.cells) == 315
    assert Counter(c[1] for c in published.cells)['1'] == 21
    assert Counter(c[1] for c in published.cells)['2'] == 21
    assert sum('源视图诊断，不参与留出排名' in c[3] for c in published.cells) == 6
    source_copy = output / 'data/all-models-20261011.html'
    assert source.read_bytes() == source_copy.read_bytes()
    data = json.loads((output / 'data/all-models-20261011.json').read_text(encoding='utf-8'))
    assert data['source_sha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert data['verification']['independently_verified'] is False
    assert data['complete_heldout_combinations'] == 105
    inventory = json.loads((ROOT / 'thesis/experiments/datasets/inventory.json').read_text(encoding='utf-8'))
    endoslam = next(r for r in inventory['records'] if r['name'] == 'EndoSLAM')
    all_text = json.dumps(endoslam, ensure_ascii=False)
    assert '742' in all_text and '65' in all_text
    assert 'historical-results' in page and 'latest-rank-scope' in page
    print('PASS: 16 methods; all 321 source metric cells and both rank sets preserved; 105 complete combinations; diagnostics excluded; source snapshot exact; EndoSLAM inventory present.')


if __name__ == '__main__':
    main()
