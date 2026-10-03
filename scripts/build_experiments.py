"""Build concise experiment pages: experiment, metrics, conclusion.

Original workbook and imported data are retained unchanged. The public page
shows only completed numerical comparisons, grouped for reading rather than
presented as a run-by-run ledger.
"""
from __future__ import annotations
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
E = html.escape


def entries():
    path = ROOT / 'content/experiments/index.json'
    data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
    seen = set()
    for item in data:
        slug = item['slug']
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+', slug) or slug in seen:
            raise ValueError('Invalid or duplicate experiment slug')
        seen.add(slug)
    return sorted(data, key=lambda x: x['date'], reverse=True)


def configure(core):
    count = len(entries())
    original_sidebar, original_shell = core.sidebar, core.shell
    original_thesis = core.thesis_index

    def sidebar(prefix, section):
        text = original_sidebar(prefix, section)
        if count and not core.THESES:
            text = text.replace('<span class="nav-meta">待补充</span>', f'<span class="nav-meta">{count:02d} 实验</span>')
        return text

    def shell(path, title, main, section='', toc=None, description=None):
        if path == 'index.html' and count and not core.THESES:
            main = main.replace('<span class="collection-state">内容待补充</span>', f'<span class="collection-state">{count:02d} 份实验记录</span>')
        original_shell(path, title, main, section, toc, description)
        if section == 'thesis':
            output = ROOT / path
            text = output.read_text(encoding='utf-8')
            css = f'<link rel="stylesheet" href="{core.prefix_for(path)}assets/experiments.css">'
            text = text.replace('</head>', css + '\n</head>')
            if toc == '':
                text = text.replace('class="layout article-layout"', 'class="layout experiment-layout"')
            output.write_text(text, encoding='utf-8')

    def thesis_index():
        original_thesis()
        path = ROOT / 'thesis/index.html'
        text = path.read_text(encoding='utf-8')
        folder = f'<a class="experiment-folder" href="experiments/index.html"><div><h2>实验</h2><p>{count:02d} 份记录 · 按日期查看实验、指标与结论</p></div>{core.icon("arrow")}</a>'
        start = text.index('</header>', text.index('<main ')) + len('</header>')
        text = text[:start] + folder + text[start:]
        if not core.THESES:
            text = re.sub(r'<section class="empty-state".*?</section><p class="empty-notice">.*?</p>', '<p class="experiment-note">论文正文暂未添加。</p>', text, flags=re.S)
        path.write_text(text, encoding='utf-8')

    core.sidebar, core.shell, core.thesis_index = sidebar, shell, thesis_index


def table(headers, rows, caption, trials=False):
    heads = ''.join(f'<th scope="col">{E(h)}</th>' for h in headers)
    body = ''
    for row in rows:
        cells = ''.join(f'<td data-label="{E(label)}">{E(str(value)).replace(chr(10), "<br>")}</td>' for label, value in zip(headers, row))
        body += '<tr>' + cells + '</tr>'
    style = ' trials' if trials else ''
    return f'<div class="experiment-table{style}" tabindex="0" role="region" aria-label="{E(caption)}；窄屏可横向滚动"><table><caption>{E(caption)}</caption><thead><tr>{heads}</tr></thead><tbody>{body}</tbody></table></div>'


def block(number, title, what, metrics, conclusion, note=''):
    small = f'<p class="experiment-note">{E(note)}</p>' if note else ''
    return f'<section class="experiment-block" id="experiment-{number}"><h2><span>{number:02d}</span>{E(title)}</h2><h3>做了什么实验</h3><p>{E(what)}</p><h3>结果指标</h3>{metrics}{small}<div class="experiment-conclusion"><h3>实验结论</h3><p>{E(conclusion)}</p></div></section>'


def build_record(core, item, data):
    sheets = data['sheets']
    baseline = sheets['02_基准结果'][5:]
    exposure = sheets['03_曝光与真值'][5:]
    controls = sheets['04_控制与负结果'][5:]
    rows = [[r[2], r[3], f'{r[4]:.3f}', f'{r[5]:.5f}', f'{r[6]:.5f}'] for r in baseline]
    body = block(1, '两种重建方法的基准对比',
        '在 EndoNeRF 的 pulling、cutting 场景中，对比 Deform3DGS 与 SurgicalGS。统一训练 3000 步，采用有效组织块评价；每组 1 个随机种子。',
        table(['场景', '方法', 'PSNR ↑ / dB', 'SSIM ↑', 'LPIPS ↓'], rows, '图像重建质量'),
        '两种方法各有优势，没有一种方法在两个场景的所有指标上都领先。当前只有单种子结果，尚不能判断小幅差异是否稳定。')
    real = {r[1]: {} for r in exposure if r[0] in ('E04', 'E05')}
    for r in exposure:
        if r[0] in ('E04', 'E05'):
            real[r[1]][r[0]] = f'{r[4]:.3f}' + (f' ± {r[5]:.3f}' if r[5] is not None else '')
    rows = [[scene, r['E04'], r['E05']] for scene, r in real.items()]
    body += block(2, '只改变曝光，重建深度会不会变？',
        '在 StereoMIS P1、P3 窗口中固定初始化、相机、深度、采样和训练步数，只改变训练 RGB 曝光，EV(t) = 0.5 sin(2πt)。同时做原始曝光的重复训练作为参照。',
        table(['测试窗口', '原始 / 原始（A/A）', '原始 / 曝光变化（A/B）'], rows, '归一化渲染深度 D/α 差异 · mm'),
        '所测窗口中，改变曝光后的深度差异大于已测的原始重复训练差异，支持存在曝光敏感性。这里测的是渲染深度变化，不是真实组织位移或几何真值误差。',
        'A/B：3 个种子的均值 ± 样本标准差；A/A：每个窗口仅 1 次同种子重复对照，不据此作显著性判断。')
    rows = [[r[2].replace('（报告中的配对增量）', ''), f'{r[4]:.3f} ± {r[5]:.3f}'] for r in exposure if r[0] == 'E06']
    body += block(3, '有几何真值时，曝光是否让误差增大？',
        '使用带解析深度真值的动态曲面，对原始 RGB 和曝光变化 RGB 做配对训练，重复 3 个随机种子，并比较测试深度 MAE。',
        table(['条件 / 比较', '深度 MAE / 配对增量 · mm'], rows, '几何准确度 · MAE 越低越好'),
        '三个种子的几何误差均增加，说明曝光变化降低了该解析场景的几何准确度；尚不能直接外推为真实软组织的准确度结论。',
        '数值为均值 ± 样本标准差。配对增量为原表报告值，不由两组标准差相减。')
    by_id = {}
    for r in controls:
        by_id.setdefault(r[0], []).append(r)
    descriptions = {
        'E07': ('高亮区域降权', '图像质量也有损失，未达目标。'),
        'E08': ('使用已知曝光补偿', '支持曝光补偿机制；依赖真实 EV，不是无标签算法成果。'),
        'E09': ('学习曝光曲线', '敏感性降低，但损伤原始条件画质，尚无稳定净收益。'),
        'E10': ('学习曝光迁移到 SurgicalGS', '低于预定 25% 门槛，未达迁移目标。'),
        'E11': ('按深度尺度调整深度损失', '敏感性降低，但综合质量未达目标。'),
        'E12': ('固定高斯集合，关闭增密与裁剪', '变化很小，不支持把主要问题简单归因于增密。'),
        'E13': ('曝光切向量梯度投影', '图像质量及解析几何均未过门槛，停止扩展。')}
    rows = []
    for key, (name, conclusion) in descriptions.items():
        parts = []
        for r in by_id[key]:
            result = f'{r[3]}：敏感性下降约 {r[4]*100:.1f}%'
            if r[5] is not None:
                result += f'；原始条件 PSNR {r[5]:+.2f} dB'
            parts.append(result)
        if key == 'E07': parts.append('画质退化幅度未提供')
        if key == 'E08': parts.append('其他质量指标未提供')
        if key == 'E11': parts.append('RGB 与 LPIPS 退化，幅度未提供')
        if key == 'E13': parts.append('比较基准：仅 L2 对照')
        rows.append([name, '\n'.join(parts), conclusion])
    body += block(4, '尝试了哪些改进，是否有效？',
        '分别测试曝光补偿、高亮降权、深度损失调整、固定高斯集合和梯度投影，检查曝光敏感性能否降低，以及是否牺牲重建质量。',
        table(['做了什么实验', '结果指标', '结论'], rows, '改进实验与机制对照', trials=True),
        '曝光补偿能够缓解敏感性，但当前记录尚未支持一个同时保住重建质量、并有稳定迁移收益的可用方案。敏感性更低，不等于几何更准确。',
        '各项降幅相对各自对照计算，不能按百分比跨实验排名；原表缺失的质量指标不代表没有代价。')
    filename = E(item['source_file'], quote=True)
    main = f'''<main id="main" class="experiment-main"><header class="experiment-header"><a class="back-link" href="../index.html">{core.icon('left')} 返回实验</a><p class="experiment-date"><time datetime="{E(item['date'])}">{E(item['date'])}</time> · 实验记录</p><h1>{E(item['title'])}</h1><p class="experiment-subtitle">{E(item['subtitle'])}</p><a class="experiment-download" href="{filename}" download>{core.icon('download')} 原始 Excel</a></header>{body}<footer class="experiment-source">依据原始实验表整理，未重新运行实验或核验服务器日志；日期为记录更新日期。其余台账与历史数据保留在原始 Excel 中。</footer></main>'''
    core.shell(f'thesis/experiments/{item["slug"]}/index.html', f'{item["date"]} · 实验记录', main, 'thesis', toc='', description='做了什么实验、结果指标是什么、实验支持什么结论。')


def build(core):
    items = entries()
    cards = ''
    for item in items:
        slug, filename = item['slug'], item['source_file']
        if Path(filename).name != filename:
            raise ValueError('Invalid source file name')
        data = json.loads((ROOT / f'content/experiments/{slug}.json').read_text(encoding='utf-8'))
        source = ROOT / 'thesis/experiments' / slug / filename
        if hashlib.sha256(source.read_bytes()).hexdigest() != data['source_sha256']:
            raise ValueError('Original workbook checksum mismatch')
        build_record(core, item, data)
        cards += f'<a class="experiment-folder" href="{slug}/index.html"><div><time datetime="{E(item["date"])}">{E(item["date"])}</time><h2>{E(item["title"])}</h2><p>{E(item["subtitle"])}</p></div>{core.icon("arrow")}</a>'
    main = f'<main class="page-main" id="main"><header class="page-heading"><a class="back-link" href="../index.html">{core.icon("left")} 返回内窥镜三维重建</a><h1>实验</h1><p class="description">做了什么 · 结果指标 · 实验结论</p></header>{cards}</main>'
    core.shell('thesis/experiments/index.html', '实验', main, 'thesis')
    print(f'Built {len(items)} concise experiment archive(s); original workbook verified.')
