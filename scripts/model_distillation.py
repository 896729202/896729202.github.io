"""Build author-supplied distillation summaries; never run training or inference."""
from __future__ import annotations
import csv
import io
import json
import re
from datetime import date
from decimal import Decimal
from html import escape
from pathlib import Path


def esc(value):
    return escape(str(value), quote=True)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def export_csv(path, headers, rows):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(headers)
    writer.writerows(rows)
    path.write_text(stream.getvalue(), encoding='utf-8')


def facts(rows):
    return '<dl class="md-facts">'+''.join(
        f'<div><dt>{esc(k)}</dt><dd>{esc(v)}</dd></div>' for k,v in rows)+'</dl>'


def table(headers, rows, caption, cls=''):
    if not rows or any(len(r)!=len(headers) for r in rows):
        raise ValueError('Invalid distillation table')
    heads=''.join(f'<th scope="col">{esc(h)}</th>' for h in headers)
    body=''.join('<tr>'+''.join(f'<td>{esc(v)}</td>' for v in row)+'</tr>' for row in rows)
    return (f'<div class="md-scroll {esc(cls)}" role="region" tabindex="0" aria-label="{esc(caption)}；可横向滚动">'
            f'<table class="md-table"><caption>{esc(caption)}</caption><thead><tr>{heads}</tr></thead><tbody>{body}</tbody></table></div>')


def results_table(rows):
    body=''
    for row in rows:
        cells=f'<th scope="row">{esc(row["split"])}</th>'
        for metric,higher in [('psnr',True),('ssim',True),('lpips',False)]:
            before,after=row[metric+'_before'],row[metric+'_after']
            a,b=Decimal(before),Decimal(after)
            if not a.is_finite() or not b.is_finite():
                raise ValueError('Non-finite metric')
            trend='相同' if a==b else ('改善' if (b>a)==higher else '变差')
            cls={'改善':'md-better','变差':'md-worse','相同':'md-same'}[trend]
            cells+=(f'<td data-metric="{metric}" data-before="{esc(before)}" data-after="{esc(after)}">'
                    f'<span class="md-before">{esc(before)}</span><span class="md-arrow"> → </span>'
                    f'<strong class="{cls}">{esc(after)}</strong><small class="{cls}">{trend}</small></td>')
        body+='<tr>'+cells+'</tr>'
    return ('<div class="md-scroll" role="region" tabindex="0" aria-label="FoundationStereo 教师版前后指标；可横向滚动">'
            '<table class="md-table md-results"><caption>FoundationStereo 教师版 · 微调前 → 微调后'
            '<span>左右滑动查看完整指标 →</span></caption><thead><tr><th scope="col">划分</th>'
            '<th scope="col">PSNR ↑ / dB</th><th scope="col">SSIM ↑</th><th scope="col">LPIPS ↓</th>'
            '</tr></thead><tbody>'+body+'</tbody></table></div>')


def write(core, path, title, main, description, article=False):
    core.shell(path,title,main,'thesis',toc='' if article else None,description=description)
    output=core.ROOT/path
    css=f'<link rel="stylesheet" href="{core.prefix_for(path)}assets/model-distillation.css">\n'
    output.write_text(output.read_text(encoding='utf-8').replace('</head>',css+'</head>',1),encoding='utf-8')


def article(core, data):
    slug=data['slug']
    output=core.ROOT/'thesis/distillation'/slug
    save_json(output/'summary.json',data)
    columns=['split','scope','psnr_before','psnr_after','ssim_before','ssim_after','lpips_before','lpips_after']
    export_csv(output/'metrics.csv',columns,[[r[k] for k in columns] for r in data['results']])
    for name,key in [('teacher-validation.csv','teacher_validation'),('teacher-control.csv','teacher_control')]:
        export_csv(output/name,data[key]['headers'],data[key]['rows'])
    steps=''.join(f'<li><span>{i:02d}</span>{esc(t)}</li>' for i,t in enumerate(data['pipeline'],1))
    links='<nav class="md-jump" aria-label="本页目录">'+''.join(
        f'<a href="#{anchor}">{label}</a>' for anchor,label in [('method','怎么蒸馏'),('results','前后指标'),('teachers','教师对照'),('conclusion','结论与边界')])+'</nav>'
    main=(f'<main class="experiment-main md-main" id="main"><header class="experiment-header md-header">'
          f'<a class="back-link" href="../index.html">{core.icon("left")} 返回模型蒸馏</a>'
          f'<p class="experiment-date"><time datetime="{data["record_date"]}">{data["record_date"]}</time> · 记录日期</p>'
          f'<h1 tabindex="-1">{esc(data["title"])}</h1><p class="experiment-subtitle">{esc(data["subtitle"])}</p>'
          f'<p class="md-answer">{esc(data["summary"])}</p></header>{links}')
    main+=('<section class="md-section" id="method"><h2><span>01</span>怎么蒸馏</h2>'
           f'<ol class="md-flow">{steps}</ol>{facts(data["method_facts"])}'
           f'<p class="md-note">{esc(data["filter_note"])}</p></section>')
    main+=('<section class="md-section" id="results"><h2><span>02</span>结果：P1 改善，跨场景下降</h2>'
           '<p class="md-note">以下是 <strong>0° 同视角重投影</strong>，不是新视角或真实深度评价。前后使用同一重投影流程，黑色空洞也计入。</p>'
           +results_table(data['results'])+'<a class="md-download" href="metrics.csv" download>前后指标 CSV ↓</a></section>')
    teacher=data['teacher_validation'];control=data['teacher_control']
    main+=('<section class="md-section" id="teachers"><h2><span>03</span>为什么选这个教师</h2>'
           +table(teacher['headers'],teacher['rows'],'SCARED · 5 帧真实深度校验')
           +f'<p class="md-note">{esc(teacher["note"])}</p>'
           +table(control['headers'],control['rows'],'换教师的对照 · PSNR ↑ / dB','md-control')
           +f'<p class="md-note">{esc(control["note"])}</p></section>')
    main+=('<section class="md-section" id="conclusion"><h2><span>04</span>结论与评价边界</h2>'
           +f'<div class="md-verdict">{esc(data["conclusion"])}</div>'+facts(data['evaluation'])+'</section>')
    main+=('<div class="md-downloads"><a href="summary.json" download>完整摘要 JSON ↓</a>'
           '<a href="teacher-validation.csv" download>教师校验 CSV ↓</a>'
           '<a href="teacher-control.csv" download>教师对照 CSV ↓</a></div>'
           +f'<footer class="experiment-source">{esc(data["source_note"])}</footer></main>')
    write(core,f'thesis/distillation/{slug}/index.html',data['title'],main,data['summary'],article=True)


def build(core):
    source=core.ROOT/'content/distillation'
    if not (source/'index.json').exists():
        return
    index=json.loads((source/'index.json').read_text(encoding='utf-8'))
    if index.get('schema_version')!=1 or not index.get('entries'):
        raise ValueError('Invalid distillation index')
    studies=[];seen=set()
    for item in index['entries']:
        slug=item['slug']
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+',slug) or slug in seen:
            raise ValueError('Invalid or duplicate distillation slug')
        seen.add(slug)
        if item['file']!=slug+'.json':
            raise ValueError('Unexpected distillation data path')
        data=json.loads((source/item['file']).read_text(encoding='utf-8'))
        if data.get('schema_version')!=1 or data['slug']!=slug or not data['results']:
            raise ValueError('Invalid distillation summary')
        date.fromisoformat(data['record_date'])
        studies.append(data);article(core,data)
    studies.sort(key=lambda d:d['record_date'],reverse=True)
    cards=''.join(f'<a class="experiment-folder md-study" href="{d["slug"]}/index.html">'
                  f'<div><time datetime="{d["record_date"]}">{d["record_date"]} · 记录日期</time>'
                  f'<h2>{esc(d["title"])}</h2><p>{esc(d["summary"])}</p></div>{core.icon("arrow")}</a>' for d in studies)
    main=(f'<main class="page-main md-index" id="main"><header class="page-heading">'
          f'<a class="back-link" href="../index.html">{core.icon("left")} 返回内窥镜三维重建</a>'
          '<p class="eyebrow">内窥镜三维重建 / 专题实验</p>'
          f'<h1 tabindex="-1">{esc(index["title"])}</h1><p class="description">{esc(index["description"])}</p></header>'
          f'<p class="md-note">{len(studies):02d} 份记录</p>{cards}'
          '<p class="md-note">训练适配结果单独记录，不混入原方法复现排行榜。记录日期不代替实际实验日期。</p></main>')
    write(core,'thesis/distillation/index.html',index['title'],main,index['description'])
    path=core.ROOT/'thesis/index.html'
    page=path.read_text(encoding='utf-8')
    pattern=r'<a class="experiment-folder" href="experiments/index.html">.*?</a>'
    matches=list(re.finditer(pattern,page,re.S))
    if len(matches)!=1 or 'href="distillation/index.html"' in page:
        raise ValueError('Research landing page changed; use the normal full build before inserting')
    folder=(f'<a class="experiment-folder" href="distillation/index.html"><div><h2>模型蒸馏</h2>'
            f'<p>{len(studies):02d} 份记录 · 教师伪标签、学生适配与泛化结果</p></div>{core.icon("arrow")}</a>')
    end=matches[0].end()
    path.write_text(page[:end]+folder+page[end:],encoding='utf-8')
    print(f'Built model distillation: {len(studies)} study; original reproduction metrics unchanged.')
