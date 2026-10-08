"""Render the two research overviews from curated data; never run experiments.

Use the existing core shell and theme. The historical reproduction groups stay
unchanged in their source and remain separately downloadable and addressable.
"""
from __future__ import annotations
import csv
import io
import json
from datetime import date
from decimal import Decimal
from html import escape
from pathlib import Path


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def local_file(root, name):
    if not isinstance(name, str) or Path(name).name != name:
        raise ValueError('Data references must be plain file names')
    path = root / name
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def txt(value):
    return escape(str(value)).replace('\n', '<br>')


def table(headers, rows, caption, style='', group=False):
    if not headers or not rows or any(len(row) != len(headers) for row in rows):
        raise ValueError('Empty or ragged research table')
    head = ''.join(f'<th scope="col">{txt(h)}</th>' for h in headers)
    body, last = [], None
    for row in rows:
        new_group = group and last is not None and row[0] != last
        last = row[0]
        cells = ''.join(f'<td>{txt(v)}</td>' for v in row)
        body.append(f'<tr class="{"ro-group-start" if new_group else ""}">{cells}</tr>')
    return (f'<div class="ro-scroll {escape(style)}" tabindex="0" role="region" '
            f'aria-label="{escape(caption)}；可横向滚动"><table class="ro-table">'
            f'<caption>{txt(caption)}<span class="ro-swipe">左右滑动查看完整列 →</span></caption><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table></div>')


def section(anchor, title, body, badge=''):
    mark = f'<span class="ro-kicker">{txt(badge)}</span>' if badge else ''
    return f'<section class="ro-section" id="{escape(anchor)}">{mark}<h2>{txt(title)}</h2>{body}</section>'


def paragraph(value, cls=''):
    return f'<p class="{escape(cls)}">{txt(value)}</p>'


def conclusion(value):
    return '<div class="experiment-conclusion"><h3>结论与边界</h3>' + paragraph(value) + '</div>'


def facts(items):
    return '<dl class="ro-facts">' + ''.join(f'<div><dt>{txt(k)}</dt><dd>{txt(v)}</dd></div>' for k, v in items) + '</dl>'


def links(items):
    return '<div class="ro-downloads">' + ''.join(f'<a href="{escape(path)}" download>{txt(label)} ↓</a>' for path, label in items) + '</div>'


def navigation(items):
    return '<nav class="ro-jump" aria-label="页内导航">' + ''.join(f'<a href="#{escape(anchor)}">{txt(label)}</a>' for anchor, label in items) + '</nav>'


def header(core, title, subtitle, day, sibling, sibling_label):
    date.fromisoformat(day)
    return ('<header class="experiment-header ro-header">'
            f'<div class="ro-breadcrumb"><a class="back-link" href="../index.html">{core.icon("left")} 返回实验</a>'
            f'<a href="../{sibling}/index.html">{txt(sibling_label)} {core.icon("arrow")}</a></div>'
            f'<p class="experiment-date">更新于 <time datetime="{day}">{day}</time></p>'
            f'<h1 tabindex="-1">{txt(title)}</h1><p class="experiment-subtitle">{txt(subtitle)}</p></header>')


def finish(core, slug, title, main, description):
    path = f'thesis/experiments/{slug}/index.html'
    core.shell(path, title, main, 'thesis', toc='', description=description)
    out = core.ROOT / path
    html = out.read_text(encoding='utf-8')
    html = html.replace('class="layout experiment-layout"', 'class="layout experiment-layout research-overview-layout"', 1)
    html = html.replace('</head>', '<link rel="stylesheet" href="../../../assets/research-overviews.css">\n</head>', 1)
    out.write_text(html, encoding='utf-8')


def csv_export(path, headers, rows):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(headers)
    writer.writerows(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(stream.getvalue(), encoding='utf-8')


def render_datasets(core, data):
    records = data['records']
    if len({r['name'] for r in records}) != len(records):
        raise ValueError('Duplicate dataset names')
    fields = ['content', 'supervision', 'processed', 'tested', 'limitations']
    for r in records:
        if not r.get('status') or any(not isinstance(r.get(k), str) or not r[k] for k in fields):
            raise ValueError('Incomplete dataset inventory row')
    output = core.ROOT / 'thesis/experiments/datasets'
    dump(output / 'inventory.json', data)
    heads = ['数据集 / 状态', '本地内容', '监督 / 标定', '已处理范围', '已测试范围', '局限']
    rows = [[r['name']+'\n'+' · '.join(r['status'])] + [r[k] for k in fields] for r in records]
    csv_export(output/'inventory.csv', heads, rows)
    main = '<main id="main" class="experiment-main research-overview">'
    main += header(core, data['title'], data['subtitle'], data['record_date'], 'reproductions', '原方法复现指标汇总')
    main += navigation([('inventory','库存总览'),('supervision','数据与监督'),('coverage','实际测试覆盖'),('incomplete','未取得 / 下载不完整')])
    main += paragraph(data['counts_note'], 'ro-notice')
    main += links([('inventory.json','完整清单 JSON'),('inventory.csv','库存表 CSV')])
    body = '<div class="ro-legend"><span>本地可用 ≠ 已处理 ≠ 已测试</span><span>横向滑动查看完整列 →</span></div>'
    body += table(heads,rows,'本地库存 · 原始量、处理量与测试量分别报告','ro-inventory')
    main += section('inventory','库存总览',body,'01 / LOCAL INVENTORY')
    body = facts([
        ('深度文件不等于物理真值','EndoNeRF 深度的性质不一概而论；EC 的 DAM 是模型生成的相对深度参考；StereoMIS 的估计深度先验不是独立测量真值。'),
        ('两类 C3VD 监督不同','注册序列有配准深度等真值；screening 有相机位姿和模型，不因此认定所有帧都有深度真值。'),
        ('相关版本不当作独立样本','EndoNeRF-EC 与 EndoNeRF 对应场景相关；13 个解析合成版本之间也有关联。本页不计算跨版本“独立样本总量”。'),
        ('示例与正式数据集有别','Hamlyn23 的 66 张示例图像不是完整 Hamlyn。EndoSLAM 和肠／胃素材的占位目录不计作可用数据。'),
    ])
    for item in data['sequence_breakdown']:
        if sum(r[1] for r in item['sequences']) != item['total']:
            raise ValueError('Sequence inventory total mismatch')
        metrics = table(['序列 / 视频','原始帧数'], item['sequences']+[['合计',item['total']]],item['kind'],'ro-sequences')
        body += f'<details class="ro-details"><summary>{txt(item["title"])} · {item["total"]:,} 帧明细</summary>{metrics}</details>'
    main += section('supervision','数据与监督说明',body,'02 / DATA SCOPE')
    coverage=data['coverage']
    if sum(r[1] for r in coverage)!=22 or sum(r[2] for r in coverage)!=262:
        raise ValueError('Coverage totals mismatch')
    body=paragraph('2026-10-08 三模型图像评价：6 个公开数据集条目、22 条序列、262 个留出目标，三种方法合计 786 条模型—目标评价记录。EC 是关联曝光版本；合成数据未包含。')
    body+=table(['数据集','序列数','测试目标帧','实际子集','相机条件'],coverage,'本地确定性测试子集 · 不是全帧或官方 benchmark','ro-coverage')
    body+=paragraph('SCARED 的 Endo-E2E-GS pilot（48 / 12 / 1 对）和 VGGT / MoRe 对齐深度评价是独立实验，不混入上表的 34 个图像测试目标。','ro-muted')
    body+='<a class="ro-text-link" href="../reproductions/index.html#latest-protocol">查看完整输入、相机与全图评价协议 →</a>'
    main+=section('coverage','实际实验覆盖',body,'03 / TESTED SUBSET')
    main+=section('incomplete','未取得与下载不完整',paragraph(data['unavailable_note'],'ro-notice'))
    main+=f'<footer class="experiment-source">{txt(data["source_note"])}</footer></main>'
    finish(core,'datasets',data['title'],main,data['subtitle'])
    print('Built dataset overview: 9 entries, 22 tested sequences, 262 targets.')


def read_metrics(root, source, output):
    path=local_file(root,source)
    raw=path.read_text(encoding='utf-8')
    rows=list(csv.DictReader(io.StringIO(raw)))
    if not rows:
        raise ValueError('Missing metric rows')
    output.mkdir(parents=True,exist_ok=True)
    (output/source).write_text(raw,encoding='utf-8')
    return rows


def metric(value, places):
    return format(Decimal(str(value)),f'.{places}f')


def render_reproductions(core, item, history):
    root=core.ROOT/'content/experiments'
    update=json.loads(local_file(root,history['update_file']).read_text(encoding='utf-8'))
    output=core.ROOT/'thesis/experiments/reproductions'
    downloads=output/'data'
    image=read_metrics(root,update['image_csv'],downloads)
    mean=read_metrics(root,update['control_csv'],downloads)
    ec=read_metrics(root,update['ec_csv'],downloads)
    assert len(image)==18 and len(mean)==6 and len(ec)==7
    assert sum(int(r['目标帧数']) for r in image)==786
    combined=dict(history,current_update=dict(update,image_metrics=image,mean_input_control=mean,ec_noadapt_full=ec))
    dump(output/'summary.json',combined)
    dump(downloads/'protocol-20261008.json',dict(updated=update['updated'],totals=update['totals'],coverage=update['coverage'],protocol=update['protocol'],camera_conditions=update['cameras'],source_note=update['source_note']))
    for name,key in [('scared-depth-aligned.csv','depth'),('endo-e2e-gs-pilot.csv','pilot')]:
        csv_export(downloads/name,update[key]['headers'],update[key]['rows'])
    csv_export(downloads/'method-status-20261008.csv',['方法','状态类别','已覆盖数据','说明'],update['method_status'])
    main='<main id="main" class="experiment-main research-overview">'
    main+=header(core,item['title'],item['subtitle'],update['updated'],'datasets','当前数据集')
    nav=[('method-status','方法状态'),('latest','六数据集图像'),('latest-protocol','评价协议'),('mean-control','简单对照'),('depth','独立深度评价'),('pilot','自训练 pilot'),('ec-20261006','EC 10-06'),('history','历史指标')]
    main+=navigation(nav)
    main+=paragraph('不同任务与统计口径分开呈现：全图留出目标、输入视角重渲染、对齐深度与历史组织块指标不合并排名。历史实验日期不因本次更新改变。','ro-notice')
    main+=links([('summary.json','完整汇总 JSON'),('data/protocol-20261008.json','最新协议 JSON')])
    body=table(['方法','状态类别','数据集覆盖','当前结果 / 局限'],update['method_status'],'方法状态与数据覆盖 · 截至 2026-10-08','ro-status')
    body+=paragraph('预训练推理完成、工程 smoke 完成、自训练 pilot 完成和论文 benchmark 完整复现不是同一种状态；等待权重的模型不借用其他模型分数。','ro-muted')
    body+=links([('data/method-status-20261008.csv','方法状态 CSV')])
    main+=section('method-status','方法状态与数据集覆盖',body,'01 / METHOD STATUS')
    totals=update['totals']
    main+=section('latest','2026-10-08：六数据集三模型统一图像评价',
        '<div class="ro-stats">'+''.join(f'<div><strong>{totals[k]}</strong><span>{label}</span></div>' for k,label in [('methods','种方法'),('datasets','个数据集条目'),('sequences','条序列'),('targets','个目标帧'),('model_target_records','条模型—目标记录')])+'</div>'
        +paragraph('256×256 · 保存 PNG 的全图指标 · 序列等权平均 · PSNR / SSIM / LPIPS 三项全部完成。LPIPS 为经校准的 SqueezeNet v0.1；目标帧数是每种方法的测试数量，不是数据库存。')
        +table(['数据集','方法','目标帧数','PSNR ↑ / dB','SSIM ↑','LPIPS ↓'],[[r['数据集'],r['方法'],r['目标帧数'],metric(r['PSNR'],3),metric(r['SSIM'],4),metric(r['LPIPS'],4)] for r in image],'最新留出目标图像评价 · 非官方 benchmark','ro-numeric',True)
        +links([('data/'+update['image_csv'],'完整精度结果 CSV')])
        +paragraph('先阅读下面的相机/输入条件，再解释分数。EndoNeRF / EC 为固定相机时间插帧；Hamlyn 的目标 RGB 可参与相机估计；OpenD4RT 的 RGB 来自外部贴图渲染。','ro-notice'),
        '02 / HELD-OUT IMAGE EVALUATION')
    main+=section('latest-protocol','实验协议与输入边界',facts(update['protocol'])+facts(update['cameras']),'PROTOCOL / READ WITH THE TABLE')
    body=paragraph(update['control_note'])
    body+=table(['数据集','PSNR ↑ / dB','SSIM ↑','LPIPS ↓'],[[r['数据集'],metric(r['PSNR'],3),metric(r['SSIM'],4),metric(r['LPIPS'],4)] for r in mean],'直接平均两张输入图像 · 不进行三维重建','ro-numeric')
    body+=links([('data/'+update['control_csv'],'完整精度对照 CSV')])+conclusion(update['control_conclusion'])
    main+=section('mean-control','简单对照：直接平均两张输入',body,'03 / NON-3D CONTROL')
    d=update['depth']
    body=paragraph('VGGT 与 MoRe 已完成 Hamlyn、EndoNeRF、SCARED 预训练推理；下表是独立的小规模 SCARED 深度评价。')
    body+=paragraph(d['note'],'ro-notice')+table(d['headers'],d['rows'],'SCARED · 逐对 GT 中位数尺度对齐','ro-numeric')
    body+=links([('data/scared-depth-aligned.csv','对齐深度结果 CSV')])+conclusion(d['conclusion'])
    main+=section('depth','VGGT / MoRe：独立深度评价',body,'04 / ALIGNED DEPTH — NOT NATIVE METRIC SCALE')
    d=update['pilot']
    body=paragraph(d['setup'])+table(d['headers'],d['rows'],'Endo-E2E-GS · stage2_final · 输入视角重渲染','ro-numeric')
    body+=paragraph(d['note'],'ro-notice')+links([('data/endo-e2e-gs-pilot.csv','pilot 结果 CSV')])+conclusion(d['conclusion'])
    main+=section('pilot','Endo-E2E-GS：自训练 pilot',body,'05 / SELF-TRAINED PILOT')
    rows=[[r['场景'],r['方法'],metric(r['块PSNR'],3),metric(r['块SSIM'],4),metric(r['块LPIPS'],4)] for r in ec]
    body=paragraph(update['ec_note'])+table(['场景','方法','块 PSNR ↑ / dB','块 SSIM ↑','块 LPIPS ↓'],rows,'2026-10-06 · test / noadapt_full · AlexNet LPIPS','ro-numeric',True)
    body+=paragraph(update['ec_failure'],'ro-notice')+paragraph(update['ec_boundary'],'ro-muted')
    body+=links([('data/'+update['ec_csv'],'完整精度 EC CSV')])
    main+=section('ec-20261006','2026-10-06：EC 四方法复现实验',body,'06 / EFFECTIVE TISSUE PATCHES')
    main+=section('history','历史逐场景复现 · 保留原表',paragraph(update['historic_boundary'],'ro-notice')+navigation([(f'experiment-{i}',g['title']) for i,g in enumerate(history['groups'],1)]),'HISTORY / AS RECORDED THROUGH 2026-10-03')
    for number,g in enumerate(history['groups'],1):
        body=paragraph(g['what'])
        for t in g['tables']:
            rendered=table(t['headers'],t['rows'],t['caption'],'ro-history')
            if t.get('supplemental'):
                rendered=f'<details class="ro-details"><summary>{txt(t["caption"])}</summary>{rendered}</details>'
            body+=rendered
        body+=paragraph(g.get('note',''),'ro-muted')+conclusion(g['conclusion'])
        main+=section(f'experiment-{number}',g['title'],body,'历史记录 / 原数值未修改')
    main+=f'<footer class="experiment-source">{txt(update["source_note"])}<br>{txt(history["source_note"])}</footer></main>'
    finish(core,'reproductions',item['title'],main,item['summary'])
    print('Built reproduction overview: 18 image rows, 6 controls, 4 depth rows, 2 pilot rows, 7 EC rows; historical groups retained.')
