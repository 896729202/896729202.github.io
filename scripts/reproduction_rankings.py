"""Present existing reproduction results by method family and dataset.

Run after the original research overview builder. Source metrics, the complete
summary and its downloads are never overwritten. Ranking uses full-precision
Decimal values within each explicitly delimited table, not between protocols.
"""
from __future__ import annotations
import csv
import io
import json
import re
from decimal import Decimal
from html import escape
from pathlib import Path

METRICS = [('psnr', 'PSNR ↑', 'dB', 3, True),
           ('ssim', 'SSIM ↑', '', 4, True),
           ('lpips', 'LPIPS ↓', '', 4, False),
           ('mae', '深度 MAE ↓', 'mm', 3, False)]
DATASETS = [('endonerf', 'EndoNeRF'), ('ec', 'EndoNeRF-EC'),
            ('scared', 'SCARED'), ('c3vd', 'C3VD'),
            ('stereomis', 'StereoMIS'), ('hamlyn', 'Hamlyn')]


def text(value):
    return escape(str(value), quote=True)


def decimal(value):
    if value in (None, '', '未提供', '不适用', '—'):
        return None
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError('Non-finite metric')
    return result


def ranks(values, higher):
    """Dense ties; single available observation is not a comparison."""
    parsed = [decimal(v) for v in values]
    available = [v for v in parsed if v is not None]
    if len(available) < 2:
        return [None] * len(values)
    order = sorted(set(available), reverse=higher)
    return [(order.index(v) + 1) if v is not None else None for v in parsed]


def record(name, values, context='', control=False):
    if len(values) != 4:
        raise ValueError('Expected PSNR, SSIM, LPIPS and depth MAE')
    result = dict(method=name, context=context, control=control)
    for (key, *_), value in zip(METRICS, values):
        decimal(value)
        result[key] = None if value is None else str(value)
    return result


def metric_table(key, title, rows, explanation, exports, rank=True):
    if not rows:
        raise ValueError('Empty metric table')
    computed = {k: ranks([r[k] for r in rows], high) if rank else [None]*len(rows)
                for k, _, _, _, high in METRICS}
    exports.append(dict(id=key, title=title, scope=explanation,
                        ranking_enabled=rank, rows=rows, ranks=computed))
    headers = '<th scope="col">方法 / 配置</th>' + ''.join(
        f'<th scope="col">{label}<small>{unit or "&nbsp;"}</small></th>'
        for _, label, unit, _, _ in METRICS)
    body = ''
    for i, row in enumerate(rows):
        context = f'<small>{text(row["context"])}</small>' if row['context'] else ''
        cells = f'<th scope="row">{text(row["method"])}{context}</th>'
        for metric, label, unit, places, _ in METRICS:
            value, position = decimal(row[metric]), computed[metric][i]
            if value is None:
                missing = '不适用' if row['control'] and metric == 'mae' else '未提供'
                cells += f'<td class="rk-missing" data-metric="{metric}" title="{missing}" aria-label="{label}：{missing}">—</td>'
                continue
            high = position in (1, 2)
            cls = f' rk-rank-{position}' if high else ''
            label_rank = f'；表内第 {position} 名' if high else ''
            badge = f'<sup aria-hidden="true">{position}</sup>' if high else ''
            cells += (f'<td data-metric="{metric}" data-value="{text(row[metric])}" '
                      f'data-rank="{position or ""}" aria-label="{text(label)}：{value}{label_rank}">'
                      f'<span class="rk-value{cls}" title="原记录：{text(row[metric])}{label_rank}">'
                      f'{value:.{places}f}{badge}</span></td>')
        body += f'<tr class="{"rk-control" if row["control"] else ""}">{cells}</tr>'
    return (f'<div class="rk-table-wrap" role="region" tabindex="0" aria-label="{text(title)}；可横向滚动">'
            f'<table class="rk-table" data-table="{key}"><caption>{text(title)}'
            '<span>左右滑动查看完整指标 →</span></caption>'
            f'<thead><tr>{headers}</tr></thead><tbody>{body}</tbody></table></div>'
            f'<p class="rk-table-note">{text(explanation)}</p>')


def sections(page):
    """Preserve whole legacy sections, including nested disclosure content."""
    found, stack = {}, []
    for match in re.finditer(r'</?section\b[^>]*>', page):
        if match.group().startswith('</'):
            if not stack:
                raise ValueError('Unbalanced section in prior overview')
            start, name = stack.pop()
            if name:
                found[name] = page[start:match.end()]
        else:
            ident = re.search(r'\bid="([^"]+)"', match.group())
            stack.append((match.start(), ident.group(1) if ident else None))
    if stack:
        raise ValueError('Unclosed legacy section')
    return found


def disclosure(title, body):
    return f'<details class="rk-details"><summary>{text(title)}</summary><div class="rk-detail-body">{body}</div></details>'


def dataset_panel(slug, title, body):
    return f'<section class="rk-dataset" id="{slug}" data-rk-dataset><h3>{text(title)}</h3>{body}</section>'


def dataset_nav(family, datasets):
    return '<nav class="rk-dataset-nav" data-rk-tabs="dataset" aria-label="选择数据集">' + ''.join(
        f'<a href="#{family}-{key}">{text(name)}</a>' for key, name in datasets) + '</nav>'


def note(value):
    return f'<p class="rk-note">{text(value)}</p>'


def render(summary, legacy):
    update = summary['current_update']
    exports = []
    required = ['method-status', 'latest', 'latest-protocol', 'mean-control', 'depth',
                'pilot', 'ec-20261006', 'history'] + [f'experiment-{i}' for i in range(1, 5)]
    if any(k not in legacy for k in required):
        raise ValueError('Original overview structure changed; review before rebuilding')
    image, controls, ec = update['image_metrics'], update['mean_input_control'], update['ec_noadapt_full']
    if len(image) != 18 or len(controls) != 6 or len(ec) != 7:
        raise ValueError('Metric coverage changed; review explicit table grouping')
    main = ('<main id="main" class="experiment-main research-overview rankings" data-rk-root>'
            '<header class="experiment-header ro-header"><div class="ro-breadcrumb">'
            '<a class="back-link" href="../index.html">← 返回实验</a>'
            '<a href="../datasets/index.html">当前数据集 →</a></div>'
            f'<p class="experiment-date">更新于 <time datetime="{text(update["updated"])}">{text(update["updated"])}</time></p>'
            '<h1 tabindex="-1">原方法复现指标汇总</h1>'
            '<p class="experiment-subtitle">先选方法类别，再按数据集查看指标。</p></header>'
            '<nav class="rk-family-nav" data-rk-tabs="family" aria-label="选择方法类别">'
            '<a href="#endoscopic"><strong>内窥镜专用方法</strong><span>逐场景方法 / 专用模型</span></a>'
            '<a href="#general"><strong>通用三维重建方法</strong><span>预训练模型 / 跨域尝试</span></a></nav>'
            '<div class="rk-legend"><span class="rk-legend-first">1 第一名</span>'
            '<span class="rk-legend-second">2 第二名</span><span>逐列标色 · 不做跨表总排名</span></div>'
            '<p class="rk-key">— 未提供或不适用；MAE 未报告时不以其他深度指标替代。</p>')
    endo = '<section id="endoscopic" data-rk-family><h2 class="rk-family-heading">内窥镜专用方法</h2>'
    endo += dataset_nav('endo', DATASETS)
    body = note('逐场景训练 / 优化 · 测试集有效组织块。按同表记录值标色；训练预算与先验不同，不代表等预算优势。')
    for scenario, group in zip(['pulling', 'cutting'], summary['groups'][:2]):
        t = group['tables'][0]
        rows = [record(r[0], [*r[2:5], None], f'{r[1]} 步' if r[1] != '未提供' else '训练预算未提供') for r in t['rows']]
        body += metric_table(f'endo-endonerf-{scenario}', f'{scenario} · 原始数据', rows,
                             '历史测试记录；验证集不参与此表排名。完整精度、全有效区域 PSNR 和覆盖率保留在下方历史原表。', exports)
    body += note('Endo3R 的 pulling 前 8 帧仅完成官方权重推理 smoke，尚无可纳入主表的统一指标。')
    endo += dataset_panel('endo-endonerf', 'EndoNeRF', body)
    body = '<span id="ec-20261006" class="rk-anchor"></span>' + note(update['ec_note'])
    budgets = {'Deform3DGS': '3000 步', 'Endo-4DGX': '10000 步',
               'Endo-4DGS': '1000 coarse + 3000 fine', 'EndoGaussian': '1000 coarse + 3000 fine'}
    for scenario in ['pulling', 'cutting']:
        rows = [record(r['方法'], [r['块PSNR'], r['块SSIM'], r['块LPIPS'], None], budgets[r['方法']])
                for r in ec if r['场景'] == scenario]
        body += metric_table(f'endo-ec-{scenario}', f'{scenario} · 2026-10-06 / noadapt_full', rows,
                             '有效组织块 · AlexNet LPIPS · 无适配全支持；仅按本表记录值标色，不与前馈全图或其他适配协议比较。', exports)
    body += note(update['ec_failure'])
    body += '<a class="rk-download" href="data/'+text(update['ec_csv'])+'" download>完整精度 EC 结果 CSV ↓</a>'
    endo += dataset_panel('endo-ec', 'EndoNeRF-EC', body)
    body = note(update['pilot']['setup'])
    rows = [record('Endo-E2E-GS', [r[3], r[4], None, None], f'{r[0]} · {r[1]} · stage2_final') for r in update['pilot']['rows']]
    body += metric_table('endo-scared-pilot', '自训练 pilot · 输入视角重渲染', rows,
                         '验证与测试是不同划分，不互相排名；此表不与通用模型的留出目标帧评价排名。LPIPS 和 MAE 未提供。', exports, rank=False)
    body += disclosure('查看视差 EPE、AbsRel 与完整 pilot 说明', legacy['pilot'])
    endo += dataset_panel('endo-scared', 'SCARED', body)
    for key, name in [('c3vd', 'C3VD'), ('stereomis', 'StereoMIS')]:
        body = '<div class="rk-empty"><h4>尚无本组可比指标</h4><p>当前汇总没有此数据集的内窥镜专用方法数值；已有通用模型结果在另一组。</p>'
        body += f'<a href="#general-{key}">查看 {name} 的通用模型指标 →</a></div>'
        endo += dataset_panel(f'endo-{key}', name, body)
    body = '<div class="rk-empty"><h4>Endo3R · 仅完成推理 smoke</h4><p>Hamlyn23 前 8 帧已有点图、深度、置信度及相机输出；四项主指标尚未提供，不参与排名。</p><a href="#general-hamlyn">查看 Hamlyn 的通用模型指标 →</a></div>'
    endo += dataset_panel('endo-hamlyn', 'Hamlyn', body)
    endo += disclosure('历史原表与补充：全区域指标、覆盖率、EndoGaussian 验证、早期 EC',
                       legacy['history'] + ''.join(legacy[f'experiment-{i}'] for i in range(1, 5)))
    endo += '</section>'
    main += endo
    general_order = [DATASETS[i] for i in [2, 3, 4, 0, 1, 5]]
    general = '<section id="general" data-rk-family><span id="latest" class="rk-anchor"></span><h2 class="rk-family-heading">通用三维重建方法</h2>'
    general += dataset_nav('general', general_order)
    general += note('2026-10-08 · 两张时序输入 · 256×256 全图 · SqueezeNet LPIPS · 序列等权平均；没有场景优化或内窥镜权重训练。')
    for key, name in general_order:
        matched = [r for r in image if r['数据集'] == name]
        control = [r for r in controls if r['数据集'] == name]
        if len(matched) != 3 or len(control) != 1:
            raise ValueError('Incomplete paired model/control table')
        rows = [record(r['方法'], [r['PSNR'], r['SSIM'], r['LPIPS'], None],
                       '非官方实现 · 输入深度 + 外部贴图' if r['方法'].startswith('OpenD4RT') else
                       ('官方预训练权重' if r['方法'] == 'DepthSplat' else '第三方权重镜像')) for r in matched]
        c = control[0]
        rows += [record('输入图像直接平均', [c['PSNR'], c['SSIM'], c['LPIPS'], None], '非三维重建对照 · 参与表内标色', control=True)]
        body = metric_table(f'general-{key}-image', f'{name} · {matched[0]["目标帧数"]} 个留出目标', rows,
                             '包含输入平均对照，按原始精度逐列比较，等值并列；不是官方 benchmark 或综合方法排名。MAE 未报告。', exports)
        if name in ('EndoNeRF', 'EndoNeRF-EC'):
            body += note('固定相机 / 零基线时间插帧。DepthSplat、MVSplat 缺少三角化视差；这些分数不代表新视角能力或几何准确性。')
        elif name == 'Hamlyn':
            body += note('三种方法共用 OpenD4RT 三帧估计相机，目标 RGB 仅参与相机估计；几何仍由两张上下文图像独立编码。没有对应相机或深度真值。')
        else:
            body += note('使用提供的标定 / 位姿；全图评价保留空洞与错误区域。OpenD4RT 的 RGB 来自外部贴图，不是模型直接预测。')
        gain = Decimal(matched[0]['PSNR']) - Decimal(c['PSNR'])
        if name in ('SCARED', 'C3VD'):
            body += f'<p class="rk-takeaway">DepthSplat 的 PSNR 比输入平均高 {gain:.2f} dB；图像指标仍不能单独证明几何更准确。</p>'
        else:
            body += '<p class="rk-takeaway">本轮三种模型的 PSNR 均未超过输入平均对照。</p>'
        if key == 'scared':
            body += disclosure('VGGT / MoRe：独立深度评价（不是主表 MAE）', legacy['depth'])
        general += dataset_panel(f'general-{key}', name, body)
    general += disclosure('完整评价协议：输入、相机、渲染与统计口径', legacy['latest-protocol'])
    general += disclosure('六数据集输入平均对照：完整原表与结论', legacy['mean-control'])
    general += '</section>'
    main += general
    main += '<section class="rk-secondary" aria-label="补充资料">'
    main += disclosure('方法状态与权重来源（含 smoke、pilot、等待权重）', legacy['method-status'])
    main += '<div class="rk-footer-links"><a href="summary.json" download>完整原始汇总 JSON ↓</a><a href="data/four-metric-view-20261008.csv" download>当前主表 CSV ↓</a><a href="data/'+text(update['image_csv'])+'" download>三模型全精度 CSV ↓</a></div>'
    main += '<p class="rk-table-note">红 / 蓝仅代表同表同列记录值的第一 / 第二；相同值并列，按舍入前精度比较。不同预算、数据划分、图像区域或 LPIPS 网络不做跨表总排名。仅一条有效记录时不标名次。</p></section>'
    main += f'<footer class="experiment-source">{text(update["source_note"])} 历史数据与日期未更改；本次只调整分类、表格和导航。</footer></main>'
    return main, exports


def build(core):
    output = core.ROOT / 'thesis/experiments/reproductions'
    page_file = output / 'index.html'
    original = page_file.read_text(encoding='utf-8')
    if 'data-rk-root' in original:
        raise ValueError('Run through scripts/build.py to regenerate the source overview first')
    summary = json.loads((output / 'summary.json').read_text(encoding='utf-8'))
    legacy = sections(original)
    body, exports = render(summary, legacy)
    main_pattern = r'<main\b[^>]*>.*?</main>'
    if len(re.findall(main_pattern, original, flags=re.S)) != 1:
        raise ValueError('Expected exactly one overview main element')
    page = re.sub(main_pattern, lambda _: body, original, count=1, flags=re.S)
    includes = ('<link rel="stylesheet" href="../../../assets/reproduction-rankings.css">\n'
                '<script src="../../../assets/reproduction-rankings.js" defer></script>\n')
    page = page.replace('</head>', includes + '</head>', 1)
    ids = re.findall(r'\bid="([^"]+)"', page)
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate page anchors')
    if not set(legacy).issubset(set(ids)):
        raise ValueError('Lost historical anchor')
    page_file.write_text(page, encoding='utf-8')
    exported = dict(updated=summary['current_update']['updated'],
                    note='展示数据，非新评测；深度 MAE 缺失为 null，不由其他指标转换。输入平均参与同表逐列排名。',
                    metrics=[m[0] for m in METRICS], tables=exports)
    (output/'data/four-metric-view-20261008.json').write_text(json.dumps(exported, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['table_id','protocol','method','configuration','non_3d_control','PSNR','SSIM','LPIPS','depth_MAE_mm'])
    for t in exports:
        for row in t['rows']:
            writer.writerow([t['id'],t['scope'],row['method'],row['context'],row['control'],*[row[m[0]] for m in METRICS]])
    (output/'data/four-metric-view-20261008.csv').write_text(stream.getvalue(), encoding='utf-8')
    print(f'Built two method families and {len(exports)} four-metric tables; all existing sources and downloads preserved.')
