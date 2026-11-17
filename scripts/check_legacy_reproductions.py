"""Check public metrics against per-frame evidence and the generated HTML."""
import csv
import json
import math
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT/'content/experiments/legacy-20261117'
OUTPUT = ROOT/'thesis/experiments/reproductions'


def rows(name):
    with (SOURCE/name).open() as stream:
        return list(csv.DictReader(stream))


class NewCells(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.cells = {}
        self.depth = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'tr':
            if 'data-legacy-heldout' in attrs:
                self.current = ('heldout', attrs['data-legacy-heldout'], attrs['data-scene'], attrs['data-iteration'])
            elif 'data-legacy-stereo' in attrs:
                self.current = ('stereo', attrs['data-legacy-stereo'])
            elif 'data-legacy-depth' in attrs:
                self.depth.append(attrs['data-legacy-depth'])
        if tag == 'td' and 'data-legacy-metric' in attrs:
            assert self.current is not None
            assert not any(k in attrs for k in ('data-rank','data-global-rank','data-protocol-rank'))
            key = (*self.current, attrs['data-legacy-metric'])
            assert key not in self.cells
            self.cells[key] = float(attrs['data-value'])

    def handle_endtag(self, tag):
        if tag == 'tr':
            self.current = None


def main():
    data = json.loads((SOURCE/'summary.json').read_text())
    heldout = rows('heldout.csv')
    heldout_frames = rows('heldout-per-frame.csv')
    assert len(heldout) == 9 and len(heldout_frames) == 120
    grouped = defaultdict(list)
    for row in heldout_frames:
        grouped[(row['method'],row['scene'],row['checkpoint_iteration'])].append(row)
    for row in heldout:
        values = grouped[(row['method'],row['scene'],row['checkpoint_iteration'])]
        expected = list(range(1,63 if row['scene']=='pulling' else 156,8))
        assert sorted(int(r['frame']) for r in values) == expected
        assert len(values) == int(row['test_frames'])
        for key in ('tissue_psnr','block_psnr','block_ssim','block_lpips_alex'):
            assert math.isclose(float(row[key]),mean(float(r[key]) for r in values),abs_tol=1e-10)
    stereo = rows('stereo.csv')
    stereo_frames = rows('stereo-per-frame.csv')
    assert len(stereo) == 20 and len(stereo_frames) == 305
    assert len({(r['method'],r['case']) for r in stereo_frames}) == 305
    for row in stereo:
        values = [r for r in stereo_frames if r['method']==row['method'] and (row['split']=='all' or row['split']==r['split'])]
        sequences = {r['sequence'] for r in values}
        assert len(values)==int(row['frames']) and len(sequences)==int(row['sequences'])
        for key in ('full_psnr','full_ssim','full_lpips_alex','block_psnr','block_ssim','block_lpips_alex','coverage'):
            calculated = mean(mean(float(r[key]) for r in values if r['sequence']==seq) for seq in sequences)
            assert math.isclose(float(row[key]),calculated,abs_tol=1e-10)
    page = (OUTPUT/'index.html').read_text()
    parser = NewCells(); parser.feed(page)
    assert len(parser.cells)==42 and len(parser.depth)==2
    for row in heldout:
        for key, field in [('psnr','block_psnr'),('ssim','block_ssim'),('lpips','block_lpips_alex')]:
            assert parser.cells[('heldout',row['method'],row['scene'],row['checkpoint_iteration'],key)]==float(row[field])
    for row in stereo:
        if row['split']=='all':
            for key, field in [('psnr','full_psnr'),('ssim','full_ssim'),('lpips','full_lpips_alex')]:
                assert parser.cells[('stereo',row['method'],key)]==float(row[field])
    for filename in ['summary.json',*data['files']]:
        original = (SOURCE/filename).read_bytes()
        assert original==(OUTPUT/'data/legacy-20261117'/filename).read_bytes()
        assert b'/hy-tmp/' not in original and b'/root/' not in original
    assert all(r['psnr'] is None and r['ssim'] is None and r['lpips'] is None for r in data['depth_components'])
    assert 'LPIPS-SqueezeNet' in page and 'LPIPS-AlexNet' in page
    assert '目标右图参与了双目深度估计' in page and '中间检查点' in page
    assert '/hy-tmp/' not in page
    print('PASS: 9 held-out runs / 120 frame records; 5 stereo variants / 305 frame records; all means and 42 displayed metric cells verified; exact downloadable exports; no mixed rankings or invented RGB scores.')


if __name__ == '__main__':
    main()
