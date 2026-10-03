"""Dated experiment archive. Sources remain separate from generated HTML.

No spreadsheet is recalculated or rewritten here. JSON contains the imported
cell values; original XLSX bytes are checked before generating download links.
"""
from __future__ import annotations
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'content/experiments/index.json'
E = html.escape
FOLDER = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 9h18"/></svg>'
SECTION_NAMES = ['记录总览', '实验台账', '当前协议基准', '曝光敏感性与几何真值', '控制与负结果', '待办与阻塞', '追加记录模板', '历史口径归档']


def entries():
    data = json.loads(INDEX.read_text(encoding='utf-8')) if INDEX.exists() else []
    seen = set()
    for item in data:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}-[a-z0-9-]+', item['slug']):
            raise ValueError('实验目录须以 ISO 日期开头，并使用安全的小写 slug')
        if item['slug'] in seen:
            raise ValueError('实验目录重复')
        seen.add(item['slug'])
    return sorted(data, key=lambda item: item['date'], reverse=True)


def configure(core):
    """Extend the existing generator without changing its note rendering."""
    count = len(entries())
    original_sidebar = core.sidebar
    original_shell = core.shell
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
            output.write_text(text.replace('</head>', css + '\n</head>'), encoding='utf-8')

    def thesis_index():
        original_thesis()
        output = ROOT / 'thesis/index.html'
        text = output.read_text(encoding='utf-8')
        folder = f'''<a class="folder-card" href="experiments/index.html"><span class="folder-symbol">{FOLDER}</span><div class="folder-info"><span class="folder-date">研究资料 / 子文件夹</span><h2>实验</h2><p>按日期归档实验过程、结果与原始记录。</p><p>{count:02d} 份实验记录 · 持续更新</p></div>{core.icon('arrow','folder-arrow')}</a>'''
        marker = '</header>'
        start = text.index('<main ')
        insertion = text.index(marker, start) + len(marker)
        text = text[:insertion] + folder + text[insertion:]
        if not core.THESES:
            text = re.sub(r'<section class="empty-state".*?</section><p class="empty-notice">.*?</p>', '<p class="experiment-footnote">论文正文暂未添加。研究过程已收录在上方「实验」文件夹中；实验记录不计作已完成论文。</p>', text, flags=re.S)
        output.write_text(text, encoding='utf-8')

    core.sidebar, core.shell, core.thesis_index = sidebar, shell, thesis_index


def crumbs(core, prefix, current=None):
    parts = [f'<a href="{prefix}index.html">首页</a>', f'<a href="{prefix}thesis/index.html">毕业论文</a>']
    if current:
        parts += ['<a href="../index.html">实验</a>', f'<span aria-current="page">{E(current)}</span>']
    else:
        parts += ['<span aria-current="page">实验</span>']
    return '<nav class="breadcrumb" aria-label="面包屑">' + core.icon('chevron').join(parts) + '</nav>'


def text(value):
    return E(str(value)).replace('\n','<br>') if value is not None else '未提供 / 未估计'


def card(row, headers, opened=False):
    heading = f'{text(row[0])}'
    fields = ''
    for key, value in zip(headers[2:], row[2:]):
        if key is None:
            continue
        label = str(key)
        boundary = ' class="boundary"' if any(w in label for w in ('局限','边界','不能','判定')) else ''
        value_text = text(value)
        if any(w in label for w in ('证据','路径')):
            value_text = '<code>' + value_text + '</code>'
        fields += f'<div{boundary}><dt>{E(label)}</dt><dd>{value_text}</dd></div>'
    return f'<details class="research-record"{" open" if opened else ""}><summary><span class="record-id">{heading}</span><span class="record-title">{text(row[1])}</span></summary><dl class="record-fields">{fields}</dl></details>'


def table(headers, rows, caption, numeric=()):
    body = ''
    for row in rows:
        cells = []
        for i, value in enumerate(row):
            attrs = ' class="number"' if i in numeric else ''
            cells.append(f'<td{attrs}>{text(value)}</td>')
        body += '<tr>' + ''.join(cells) + '</tr>'
    heads = ''.join(f'<th scope="col">{E(h)}</th>' for h in headers)
    return f'<div class="research-table-wrap" role="region" aria-label="{E(caption)}；窄屏可横向滚动" tabindex="0"><table class="research-table"><caption>{E(caption)}</caption><thead><tr>{heads}</tr></thead><tbody>{body}</tbody></table></div>'


def section(number, content, sheet, source_note):
    return f'<section id="s{number}"><h2>{number:02d} · {SECTION_NAMES[number]}</h2>{content}<p class="sheet-source">来源：原始工作簿「{E(sheet)}」{E(source_note)}。</p></section>'


def build(core):
    items = entries()
    cards = ''
    for item in items:
        slug = item['slug']
        data = json.loads((ROOT / f'content/experiments/{slug}.json').read_text(encoding='utf-8'))
        source = ROOT / 'thesis/experiments' / slug / item['source_file']
        if Path(item['source_file']).name != item['source_file']:
            raise ValueError('原文件名不得包含目录')
        if hashlib.sha256(source.read_bytes()).hexdigest() != data['source_sha256']:
            raise ValueError(f'原始文件校验失败：{source}')
        if source.stat().st_size != data['source_bytes']:
            raise ValueError('原始文件大小不一致')
        cards += f'''<a class="folder-card" href="{slug}/index.html"><span class="folder-symbol">{FOLDER}</span><div class="folder-info"><time class="folder-date" datetime="{E(item['date'])}">{E(item['date'])} · 记录更新</time><h2>{E(item['title'])}</h2><p>{E(item['subtitle'])}</p><p>8 个工作表 · 阶段性汇总 · 附原始 Excel</p></div>{core.icon('arrow','folder-arrow')}</a>'''
        build_record(core, item, data)
    main = f'''<main class="page-main" id="main"><header class="page-heading">{crumbs(core,'../../')}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>毕业论文 / 研究过程</p><h1 tabindex="-1">实验</h1><p class="description">留下过程，也留下证据。<br>每份记录独立归档，保留日期、结果与结论边界。</p></header><div class="index-topline"><span class="count-label"><strong>{len(items):02d}</strong> 份实验记录</span><span class="tag tag-neutral">按日期归档</span></div>{cards}<aside class="research-notice"><strong>日期说明</strong> · 文件夹日期以每份记录注明的日期为准。阶段性汇总的更新日期，不代表其中所有运行都在当天完成。</aside><a class="back-link" href="../index.html">{core.icon('left')} 返回毕业论文</a></main>'''
    core.shell('thesis/experiments/index.html','实验',main,'thesis')
    print(f'已构建：实验目录与 {len(items)} 份日期归档；原始文件 SHA-256 校验通过。')


def build_record(core, item, data):
    sheets = data['sheets']
    keys = list(sheets)
    if len(keys) != 8:
        raise ValueError('该归档布局预期原工作簿含8个工作表，请先核对数据结构')
    s0,s1,s2,s3,s4,s5,s6,s7 = [sheets[key] for key in keys]
    download = E(item['source_file'], quote=True)
    overview = '<p>本档案整理内窥镜动态三维重建的协议审计、曝光配对诊断、解析真值验证与改进探索。它是一份研究阶段记录，不是单次训练的运行日志。</p>'
    overview += '<p><strong>报告范围：</strong>原表记录了 64 次有效 3000 步训练，其中 61 次已测试集评价、3 次仅验证集控制；另按研究逻辑整理为 15 项研究条目。两种计数层级不同，不可相加或相互替代。</p>'
    overview += '<details class="research-record"><summary><span class="record-title">原表总览、记录规则与设备边界</span></summary><div class="overview-lines">'
    for row in s0[8:]:
        if any(v is not None for v in row):
            overview += '<p>' + ' · '.join(text(v) for v in row if v is not None) + '</p>'
    overview += '<p>原表所记可用 GPU：1 张（记录当时状态，不代表当前实时设备状态）。</p></div></details>'
    body = section(0, overview, keys[0], '第 2–29 行')
    ledger = '<p>点击条目查看研究目的、对照、实际结果和解释边界。E 编号是本次整理编号，不是准确运行顺序；各项运行日期和次数仍须核对服务器台账。</p>'
    ledger += ''.join(card(row,s1[4]) for row in s1[5:])
    body += section(1,ledger,keys[1],'第 2、5–20 行')
    rows = [[r[2],r[3],f'{r[4]:.3f}',f'{r[5]:.5f}',f'{r[6]:.5f}',r[7],r[8]] for r in s2[5:]]
    baseline = '<p><strong>EndoNeRF · 单种子 · 3000 步 · 有效组织块。</strong>当前协议内比较；不能与历史 37–38 dB 结果直接混比。两方法没有跨场景、跨指标的全面赢家。</p>'
    baseline += table(['场景','方法','PSNR ↑ / dB','SSIM ↑','LPIPS ↓','种子数','步数'], rows, '当前新协议基准（E02）', (2,3,4,5,6))
    baseline += '<p class="experiment-footnote">证据定位：<code>endogs_research/科研探索总报告.md</code>；<code>endogs_research/EXPERIMENTS.csv</code>。这里只保留原表路径，未读取这些服务器文件。</p>'
    body += section(2,baseline,keys[2],'第 2、5–9 行')
    real, synthetic = [],[]
    for row in s3[5:]:
        value=f'{row[4]:.3f}' + (f' ± {row[5]:.3f}' if row[5] is not None else '（SD 未估计）')
        if row[1].startswith('StereoMIS'):
            real.append([row[1],row[2],value,row[6]])
        else:
            synthetic.append([row[2],row[3],value,row[6]])
    exposure = '<aside class="research-notice"><strong>两类指标分开看：</strong>真实序列的 D/α 是透明度归一化渲染深度；A/B 差异衡量敏感性，不是真值误差或组织位移。解析场景的 MAE 才是在该生成系统中的真值误差，不能直接外推到真实软组织。</aside>'
    exposure += '<h3>真实序列：A/B 曝光敏感性与 A/A 重复性</h3><p>固定 step-0、优化器、随机状态、采样、相机、深度与 3000 步，仅改变训练 RGB 曝光：EV(t) = 0.5 sin(2πt)。</p>'
    exposure += table(['窗口','比较条件','D/α 差异 / mm','重复层级'],real,'共同高可见区域 · StereoMIS（E04 / E05）',(2,))
    exposure += '<p>A/A 每窗口仅一次同种子重复对照，不能完整估计噪声分布，也不能据此作显著性判断。空白标准差不是零。</p><h3>解析场景：几何真值准确度</h3>'
    exposure += table(['比较条件','指标','均值 ± 样本 SD / mm','重复层级'],synthetic,'解析动态曲面（E06）',(2,))
    exposure += '<p>三个种子的误差均同向增加。配对增量 0.080 ± 0.006 mm 保留原报告统计量，不由两组标准差简单相减。</p><p class="experiment-footnote">证据定位：<code>REPEAT-BATCH-001/summary.json</code> 与 <code>SYNTH-GEOMETRY-REPEAT-001/summary.json</code>（完整路径见原表和数据下载）。</p>'
    body += section(3,exposure,keys[3],'第 2、5–12 行；干预设定见「01_实验台账」E05')
    controls = '<p><strong>8 条记录对应 7 类方案。</strong>各项比较基准不同，以下保持原表顺序，不按敏感性降幅排名。缺失质量数值不等于没有代价；理想化机制对照不当作已完成算法成果。</p>'
    for original in s4[5:]:
        row=original[:]
        row[1] += ' · ' + row[3]
        row[4]=f'约 {row[4]*100:.1f}%'
        if row[5] is not None: row[5]=f'{row[5]:+.2f} dB'
        controls += card(row,s4[4])
    body += section(4,controls,keys[4],'第 2、5–13 行')
    pending='<aside class="research-notice"><strong>不是已完成结果。</strong>下面事项未计入 64 次已报告训练；M1/M2 均尚未执行。这里只归档状态，不代表安排或启动任务。</aside>'
    pending+=''.join(card(row,s5[4]) for row in s5[5:])
    body+=section(5,pending,keys[5],'第 2、5–13 行')
    template='<p>空白追加模板不是已执行实验。准确日期、运行 ID、种子和次数不明时，不补猜测；每次运行前后分别填写目的、对照、协议、实测结果与证据。</p>'
    template+='<details class="research-record"><summary><span class="record-title">展开 18 项追加字段</span></summary><ol class="archive-template">'+''.join(f'<li>{i:02d} · {E(name)}</li>' for i,name in enumerate(s6[4],1))+'</ol></details>'
    body+=section(6,template,keys[6],'第 2、5 行')
    history='<aside class="research-notice"><strong>仅归档，不混比。</strong>历史记录与最新 64 次训练的逐项对应关系未核对，不能累加训练数量。协议、掩膜、实现或数据边界未对齐时，不能用旧新分数差推断改进或退化。</aside>'
    history+=''.join(card(row,s7[4]) for row in s7[5:])
    body+=section(7,history,keys[7],'第 2、5–11 行')
    toc_links=''.join(f'<a class="toc-module" href="#s{i}">{i:02d} · {E(name)}</a>' for i,name in enumerate(SECTION_NAMES))
    toc=f'<aside class="toc-sidebar" aria-label="实验目录"><a class="back-link" href="../index.html">{core.icon("left")} 返回实验</a><p class="toc-heading">本页目录</p><nav class="toc" aria-label="章节导航">{toc_links}</nav><div class="toc-hint">先固定协议，<br>再区分结果与边界。<br>负结果也值得保留。</div></aside>'
    main=f'''<main class="article-main" id="main"><article><header class="article-header experiment-heading">{crumbs(core,'../../../',item['date'])}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>毕业论文 / 实验 / 阶段性记录</p><h1 tabindex="-1">{E(item['title'])}</h1><p class="description">{E(item['subtitle'])}</p><div class="article-meta">{core.icon('calendar')}<time datetime="{E(item['date'])}">{E(item['date'])}</time><span>·</span><span>记录更新日期</span><span>·</span><span>8 个工作表</span></div><div class="article-toolbar"><div class="note-tags"><span class="tag">3DGS</span><span class="tag">曝光敏感性</span><span class="tag">研究记录</span></div><div class="article-actions"><a class="button" href="{download}" download>{core.icon('download')} 原始 Excel</a><a class="button" href="../../../content/experiments/{E(item['slug'])}.json" download>数据 JSON</a><button class="button" data-copy-link type="button">{core.icon('link')} 复制链接</button></div></div></header><aside class="research-notice"><strong>来源与日期边界</strong> · 本页根据上传的实验记录表整理；未核验服务器原始日志。<strong>{E(item["date"])} 是记录更新日期，不代表全部运行都在当天完成。</strong>证据路径仅供定位，不代表已读取或已上传对应文件。</aside><div class="experiment-stats"><div><strong>64</strong><span>已报告训练运行</span></div><div><strong>15</strong><span>整理后的研究条目</span></div><div><strong>8</strong><span>原始工作表</span></div></div><details class="mobile-toc"><summary>本页目录 · 8 个章节</summary><nav class="toc" aria-label="移动端章节导航">{toc_links}</nav></details><div class="article-body research-body">{body}</div><footer class="article-end"><span>保留证据，也保留不确定性。</span><a class="button" href="../index.html">{core.icon('left')} 返回实验</a></footer><p class="sheet-source">原始文件未改写 · {data['source_bytes']:,} 字节 · SHA-256</p><p class="source-hash">{E(data['source_sha256'])}</p></article></main>'''
    core.shell(f'thesis/experiments/{item["slug"]}/index.html',f'{item["date"]} · {item["title"]}',main,'thesis',toc,item['summary'])
