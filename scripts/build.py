#!/usr/bin/env python3
"""Build the notebook. Run from any directory: python3 scripts/build.py.

Markdown is kept in content/notes/. All published pages are static HTML.
Only changed / new formulas require Node + mathjax-full; existing MathML is cached.
"""
from __future__ import annotations
import html
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / 'site.config.json').read_text(encoding='utf-8'))
NOTES = json.loads((ROOT / 'content/notes/index.json').read_text(encoding='utf-8'))
THESES = json.loads((ROOT / 'content/theses.json').read_text(encoding='utf-8'))
TEMPLATE = (ROOT / 'site-src/base.html').read_text(encoding='utf-8')
CACHE_FILE = ROOT / 'scripts/math-cache.json'
CACHE: dict[str, str] = json.loads(CACHE_FILE.read_text(encoding='utf-8')) if CACHE_FILE.exists() else {}
MD = MarkdownIt('commonmark', {'html': True, 'typographer': False})
ESC = html.escape

ICONS = {
 'book': '<path d="M3 4h5c2.4 0 4 1.4 4 3v14c0-2-1.6-3-4-3H3zM21 4h-5c-2.4 0-4 1.4-4 3v14c0-2 1.6-3 4-3h5z"/>',
 'paper':'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
 'note':'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4M12 8h5M12 12h5"/>',
 'arrow':'<path d="M5 12h14M13 6l6 6-6 6"/>',
 'external':'<path d="M7 17 17 7M7 7h10v10"/>',
 'down':'<path d="M12 4v16M6 14l6 6 6-6"/>',
 'up':'<path d="M12 20V4M6 10l6-6 6 6"/>',
 'left':'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 'chevron':'<path d="m9 5 7 7-7 7"/>',
 'moon':'<path d="M20.8 13.1A9 9 0 0 1 10.9 3.2 9 9 0 1 0 20.8 13.1Z"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
 'search':'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
 'github':'<path d="M9 19c-4 1.3-4-2-6-2m12 4v-3.5a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.3a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.4s-1.1-.4-3.6 1.3a12 12 0 0 0-6.6 0C5.8 1.6 4.7 2 4.7 2a4.6 4.6 0 0 0-.1 3.4A5 5 0 0 0 3.2 9c0 4.9 3 6 5.8 6.3a3 3 0 0 0-.8 2.2V21"/>',
 'leaf':'<path d="M20 4c-10-1-16 2-15 9 1 6 8 8 12 2 2-3 3-7 3-11Z"/><path d="M4 21c2-5 5-8 11-12"/>',
 'link':'<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(0 1) scale(.94)"/>',
 'download':'<path d="M12 3v12M7 10l5 5 5-5M4 15v5h16v-5"/>',
 'print':'<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7zM16 11h1"/>',
 'calendar':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>'
}

def icon(name: str, extra: str = '') -> str:
    return f'<svg class="icon {ESC(extra)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{ICONS[name]}</svg>'

def prefix_for(path: str) -> str:
    depth = len(Path(path).parts) - 1
    return '../' * depth if depth else './'

def safe_slug(slug: str) -> str:
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError(f'无效的笔记 slug：{slug}')
    return slug

def href_is_safe(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in ('', 'https', 'http') and not value.startswith('//')

def header(prefix: str, section: str) -> str:
    nav = ''
    for key, label, target in [('thesis', '毕业论文', 'thesis/index.html'), ('notes', '八股文', 'notes/index.html')]:
        current = ' aria-current="page"' if key == section else ''
        nav += f'<a href="{prefix}{target}"{current}>{label}</a>'
    return f'''<header class="site-header"><div class="header-inner">
<a class="brand" href="{prefix}index.html" aria-label="{ESC(CONFIG['name'])} 知识手记首页"><span class="brand-mark">{icon('book')}</span><span class="brand-name">{ESC(CONFIG['name'])}<span class="brand-divider">/</span><span class="brand-sub">{ESC(CONFIG['title'])}</span></span></a>
<nav class="header-nav" aria-label="主导航">{nav}<div class="header-controls"><button class="icon-button" data-theme-toggle type="button" aria-label="切换为深色模式" aria-pressed="false"><span class="theme-dark">{icon('moon')}</span><span class="theme-light">{icon('sun')}</span></button></div></nav>
</div></header>'''

def sidebar(prefix: str, section: str) -> str:
    thesis_current = ' aria-current="page"' if section == 'thesis' else ''
    notes_current = ' aria-current="page"' if section == 'notes' else ''
    thesis_count = f'{len(THESES):02d}' if THESES else '待补充'
    return f'''<aside class="sidebar" aria-label="个人简介">
<div class="profile-avatar" aria-hidden="true"><span>89.</span></div>
<h2 class="profile-name">{ESC(CONFIG['name'])}</h2><p class="profile-caption">一份个人知识手记</p>
<p class="profile-bio">记录学习，也整理思考。<br>在这里，把零散的知识<br>慢慢连成自己的地图。</p>
<a class="profile-github" href="{ESC(CONFIG['github'])}" target="_blank" rel="noopener noreferrer">{icon('github')} GitHub {icon('external')}</a>
<div class="profile-tags"><span class="tag">学习笔记</span><span class="tag tag-neutral">持续整理</span></div>
<nav class="sidebar-nav" aria-label="内容板块"><p class="section-eyebrow">内容板块</p>
<a href="{prefix}thesis/index.html"{thesis_current}>{icon('paper')}<span>毕业论文</span><span class="nav-meta">{thesis_count}</span></a>
<a href="{prefix}notes/index.html"{notes_current}>{icon('note')}<span>八股文</span><span class="nav-meta">{len(NOTES):02d}</span></a>
</nav><div class="sidebar-note">{icon('leaf')}<p>把学过的东西，<br>变成自己的知识。</p></div></aside>'''

def footer() -> str:
    return f'''<footer class="site-footer"><div class="footer-inner"><span>© {CONFIG['year']} <a href="{ESC(CONFIG['github'])}" target="_blank" rel="noopener noreferrer">{ESC(CONFIG['name'])}</a> · 知识手记</span><span>保持好奇，持续记录。</span></div></footer>'''

def shell(path: str, title: str, main: str, section: str = '', toc: str | None = None, description: str | None = None) -> None:
    prefix = prefix_for(path)
    canonical_path = path.removesuffix('index.html')
    canonical = CONFIG['url'].rstrip('/') + '/' + canonical_path
    page_title = title + ' · ' + CONFIG['name'] if title else CONFIG['name'] + ' · ' + CONFIG['title']
    description = description or CONFIG['description']
    head = f'''<title>{ESC(page_title)}</title>
<meta name="description" content="{ESC(description, quote=True)}">
<meta property="og:type" content="{'article' if toc else 'website'}">
<meta property="og:title" content="{ESC(page_title, quote=True)}">
<meta property="og:description" content="{ESC(description, quote=True)}">
<meta property="og:locale" content="zh_CN">
<meta property="og:url" content="{ESC(canonical, quote=True)}">
<link rel="canonical" href="{ESC(canonical, quote=True)}">'''
    values = {'head': head, 'prefix': prefix, 'header': header(prefix, section), 'main': main,
              'footer': footer(), 'up_icon': icon('up'),
              'layout_class': 'layout article-layout' if toc is not None else 'layout',
              'sidebar': toc if toc is not None else sidebar(prefix, section),
              'progress': '<div class="reading-progress" aria-hidden="true"><span data-reading-progress></span></div>' if toc is not None else ''}
    result = TEMPLATE
    for key, value in values.items():
        result = result.replace('{{' + key + '}}', value)
    if re.search(r'\{\{[a-z_]+\}\}', result):
        raise RuntimeError(f'页面模板存在未替换字段：{path}')
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result, encoding='utf-8')


def tags(note: dict) -> str:
    return '<div class="note-tags">' + ''.join(f'<span class="tag">{ESC(t)}</span>' for t in note['tags']) + '</div>'


def note_art(note: dict) -> str:
    return f'''<div class="note-art" aria-hidden="true"><span class="note-art-title">{ESC(note['label'])}</span><div class="matrix-equation"><i class="matrix square"></i><span>=</span><i class="matrix tall"></i><span>×</span><i class="matrix wide"></i></div></div>'''


def note_card(note: dict, prefix: str, index: bool = False) -> str:
    slug = safe_slug(note['slug'])
    target = f'{prefix}notes/{slug}/index.html'
    heading = note['label'] if index else note['title'].replace('面试复习手册', '')
    desc = note['summary'] if index else f"核心原理 · 显存估算 · {note['questions']} 道面试问答"
    attrs = f' data-note-card data-slug="{slug}"' if index else ''
    date = note['date'].replace('-', '.')
    meta = f'<b class="note-category">大模型 · 微调</b><span></span><time datetime="{note["date"]}">{date}</time>'
    return f'''<a class="note-card{' index-note' if index else ''}" href="{target}"{attrs} aria-label="阅读 {ESC(note['title'])}">
{note_art(note)}<div class="note-card-body"><div class="note-meta">{meta}</div><h3>{ESC(heading)}</h3><p>{ESC(desc)}</p>{tags(note)}</div>{icon('arrow','end-arrow')}</a>'''


def breadcrumb(prefix: str, current: str, article: bool = False) -> str:
    if article:
        return f'<nav class="breadcrumb" aria-label="面包屑"><a href="{prefix}index.html">首页</a>{icon("chevron")}<a href="{prefix}notes/index.html">八股文</a>{icon("chevron")}<span aria-current="page">{ESC(current)}</span></nav>'
    return f'<nav class="breadcrumb" aria-label="面包屑"><a href="{prefix}index.html">首页</a>{icon("chevron")}<span aria-current="page">{ESC(current)}</span></nav>'


def home() -> None:
    cards = ''
    for idx, (key, title, desc, status, ico) in enumerate([
        ('thesis', '毕业论文', '研究过程、写作整理与最终成果。<br>按自己的节奏，慢慢完成。', f'{len(THESES):02d} 篇论文' if THESES else '内容待补充', 'paper'),
        ('notes', '八股文', '从基本原理到面试表达，<br>把每个知识点真正弄明白。', f'{len(NOTES):02d} 篇笔记', 'note')
    ], 1):
        cards += f'''<a href="./{key}/index.html" class="collection-card{' notes-card' if key == 'notes' else ''}"><div class="collection-top"><span class="collection-icon">{icon(ico)}</span><span class="collection-number">0{idx}</span></div><h2>{title}</h2><p>{desc}</p><div class="collection-bottom"><span class="collection-state">{status}</span><span class="card-arrow">{icon('arrow')}</span></div></a>'''
    recent = ''.join(note_card(n, './') for n in sorted(NOTES, key=lambda n: n['date'], reverse=True)[:3])
    main = f'''<main class="page-main" id="main"><section class="hero" aria-labelledby="home-title"><p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>一份持续生长的学习档案</p>
<h1 id="home-title" tabindex="-1"><span>把知识写下来，</span><span>让理解<em>更进一步。</em></span></h1>
<p class="hero-description">这里收藏我的毕业论文与技术学习笔记。<br>不止记录答案，也记录思考的过程。</p>
<div class="hero-bottom"><a class="browse-link" href="#collections">浏览两个板块 {icon('down')}</a><span class="edition">个人知识手记 / {CONFIG['year']}</span></div></section>
<section class="collection-grid" id="collections" aria-label="毕业论文与八股文">{cards}</section>
<section class="latest" aria-labelledby="latest-title"><div class="section-heading"><h2 id="latest-title">最近整理</h2><a href="./notes/index.html">全部笔记 {icon('external')}</a></div><div class="note-list">{recent}</div></section></main>'''
    shell('index.html', '', main)


def note_index() -> None:
    search_data = [{'slug': n['slug'], 'text': ' '.join([n['title'], n['summary'], *n['tags'], (ROOT / f'content/notes/{safe_slug(n["slug"])}.md').read_text(encoding='utf-8')])} for n in NOTES]
    serialized = json.dumps(search_data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    main = f'''<main class="page-main" id="main"><header class="page-heading">{breadcrumb('../','八股文')}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>慢慢积累，认真理解</p><h1 tabindex="-1">八股文</h1><p class="description">从「记住答案」到「真正理解」。<br>把原理讲清楚，也把自己的思路讲清楚。</p></header>
<div class="index-topline"><span class="count-label"><strong>{len(NOTES):02d}</strong> 篇学习笔记</span><span class="tag tag-neutral">大模型</span></div>
<div class="search-wrap">{icon('search')}<input data-note-search type="search" aria-label="搜索学习笔记" placeholder="搜索笔记标题、内容或标签…" autocomplete="off"><button type="button" class="clear-search" data-clear-search hidden>清空</button><kbd aria-hidden="true">/</kbd></div>
<div class="note-list">{''.join(note_card(n, '../', True) for n in NOTES)}</div>
<div class="zero-results" data-no-results hidden><h2>暂时没有找到相关笔记</h2><p>试试「LoRA」「显存」或「初始化」，也可以清空搜索。</p></div>
<p class="note-list-caption" data-search-status role="status" aria-live="polite">已收录 {len(NOTES)} 篇笔记</p>
<script type="application/json" id="note-search-data">{serialized}</script></main>'''
    shell('notes/index.html', '八股文', main, 'notes')


def thesis_index() -> None:
    if not THESES:
        body = f'''<section class="empty-state" aria-labelledby="thesis-empty-title"><div class="empty-icon" aria-hidden="true">{icon('paper')}</div><span class="tag tag-neutral" style="margin-bottom:14px">内容待补充</span><h2 id="thesis-empty-title">这一页，留给下一段研究。</h2><p>论文内容尚未添加。<br>后续将在这里整理摘要、正文与相关资料。</p><a class="button" href="../notes/index.html">先去读读八股文 {icon('arrow')}</a></section><p class="empty-notice">只保留真实的研究记录，不用示例论文填满页面。</p>'''
    else:
        body = '<div class="thesis-list">'
        for item in THESES:
            href = item.get('url', '')
            if not href or not href_is_safe(href):
                raise ValueError('论文条目需要有效的 url')
            if not urlparse(href).scheme:
                if not (ROOT / href).is_file():
                    raise FileNotFoundError(f'论文文件尚不存在：{href}')
                href = '../' + href
            body += f'<a class="thesis-item" href="{ESC(href, quote=True)}"><span class="tag">{ESC(str(item.get("year", "论文")))}</span><h2>{ESC(item["title"])}</h2><p>{ESC(item.get("summary", ""))}</p><span class="browse-link">阅读全文 {icon("external")}</span></a>'
        body += '</div>'
    main = f'''<main class="page-main" id="main"><header class="page-heading">{breadcrumb('../','毕业论文')}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>研究 · 写作 · 记录</p><h1 tabindex="-1">毕业论文</h1><p class="description">记录一项研究，从问题到答案。<br>这里留给论文、思考与一步步走过的过程。</p></header>{body}</main>'''
    shell('thesis/index.html', '毕业论文', main, 'thesis')


MATH_PATTERN = re.compile(r'\$\$(.+?)\$\$|\$([^\n$]+?)\$', re.S)

def math_key(tex: str, display: bool) -> str:
    return ('block:' if display else 'inline:') + tex


def render_markdown(source: str) -> str:
    formulas: list[dict] = []
    for match in MATH_PATTERN.finditer(source):
        tex = (match.group(1) or match.group(2)).strip()
        display = match.group(1) is not None
        if math_key(tex, display) not in CACHE:
            record = {'tex': tex, 'display': display}
            if record not in formulas:
                formulas.append(record)
    if formulas:
        process = subprocess.run(['node', str(ROOT / 'scripts/render-math.cjs')], input=json.dumps(formulas), text=True, capture_output=True, check=False)
        if process.returncode:
            raise RuntimeError(process.stderr or '公式构建失败')
        for formula, rendered in zip(formulas, json.loads(process.stdout), strict=True):
            CACHE[math_key(formula['tex'], formula['display'])] = rendered
        CACHE_FILE.write_text(json.dumps(CACHE, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    def replace(match: re.Match) -> str:
        tex = (match.group(1) or match.group(2)).strip()
        display = match.group(1) is not None
        rendered = CACHE[math_key(tex, display)]
        if display:
            return f'<div class="math-block" role="region" aria-label="公式；较长时可横向滚动" tabindex="0">{rendered}</div>'
        return f'<span class="math-inline">{rendered}</span>'
    source = MATH_PATTERN.sub(replace, source)
    rendered = MD.render(source)
    rendered = re.sub(r'^<h1>.*?</h1>\s*', '', rendered, count=1, flags=re.S)
    return rendered


def article(note: dict) -> None:
    slug = safe_slug(note['slug'])
    source = (ROOT / f'content/notes/{slug}.md').read_text(encoding='utf-8')
    body = render_markdown(source)
    headings: list[tuple[str, str, int]] = []
    modules = 0
    sections = 0
    short_names = {'q1': 'Q1 · 原理与初始化', 'q2': 'Q2 · Rank 与 α 的选择', 'q3': 'Q3 · 为什么节约显存', 'q4': 'Q4 · 单卡 24G 能否微调', 'q5': 'Q5 · OOM 的调整顺序', 'q6': 'Q6 · 合并与多业务部署'}
    def heading(match: re.Match) -> str:
        nonlocal modules, sections
        level, contents = int(match.group(1)), match.group(2)
        text = html.unescape(re.sub(r'<[^>]+>', '', contents))
        if level == 2:
            modules += 1
            anchor = f'module-{modules}'
            cleaned = re.sub(r'^模块[一二三四五六七八九十\d]+[：:]\s*', '', contents)
            short = ['核心知识与底层原理', '高频面试问答'][modules-1] if slug == 'lora' and modules <= 2 else text
            headings.append((anchor, f'{modules:02d} · {short}', level))
            return f'<h2 id="{anchor}"><span class="module-number" aria-hidden="true">{modules:02d}</span><span>{cleaned}</span></h2>'
        sections += 1
        question = re.match(r'Q(\d+)', text)
        anchor = 'q' + question.group(1) if question else f'section-{sections}'
        short = short_names.get(anchor, text)
        headings.append((anchor, short, level))
        return f'<h3 id="{anchor}">{contents}</h3>'
    body = re.sub(r'<h([23])>(.*?)</h\1>', heading, body, flags=re.S)
    body = body.replace('<p><strong>参考答案</strong>：</p>', '<p class="answer-label"><strong>参考答案</strong></p>')
    toc_links = ''.join(f'<a href="#{anchor}" class="{"toc-module" if level == 2 else "toc-section"}">{ESC(title)}</a>' for anchor, title, level in headings)
    toc = f'''<aside class="toc-sidebar" aria-label="文章目录"><a class="back-link" href="../index.html">{icon('left')} 返回八股文</a><p class="toc-heading">本页目录</p><nav class="toc" aria-label="章节导航">{toc_links}</nav><div class="toc-hint">先看核心原理，<br>再用问答检查：<br>能否不看笔记，独立讲清楚？</div></aside>'''
    title = ESC(note['title'])
    if slug == 'lora':
        title = '<span>大模型 LoRA 与微调显存</span><span>面试复习手册</span>'
    y, m, d = note['date'].split('-')
    main = f'''<main class="article-main" id="main"><article><header class="article-header">{breadcrumb('../../', note['label'], True)}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>大模型 · 参数高效微调</p><h1 tabindex="-1">{title}</h1><div class="article-meta">{icon('calendar')}<time datetime="{note['date']}">{y} 年 {int(m)} 月 {int(d)} 日</time><span>·</span><span>{note['modules']} 个模块</span><span>·</span><span>{note['questions']} 道面试问答</span></div><div class="article-toolbar">{tags(note)}<div class="article-actions"><a class="button" href="../../content/notes/{slug}.md" download>{icon('download')} 原文</a><button class="button" data-copy-link type="button">{icon('link')} 复制链接</button><button class="button" data-print type="button">{icon('print')} 打印</button></div></div></header>
<aside class="original-notice" aria-label="笔记口径说明"><strong>原文收录</strong> · 正文保留个人复习笔记的原有表述，未作为逐条核验后的技术结论。显存数值为特定假设下的估算，实际占用取决于训练配置与实现。</aside>
<details class="mobile-toc"><summary>本页目录 · {note['modules']} 个模块 / {note['questions']} 道问答</summary><nav class="toc" aria-label="移动端章节导航">{toc_links}</nav></details>
<div class="article-body">{body}</div>
<footer class="article-end"><span>读到这里，不妨合上笔记，再讲一遍。</span><a class="button" href="../index.html">{icon('left')} 返回八股文</a></footer></article></main>'''
    shell(f'notes/{slug}/index.html', note['title'], main, 'notes', toc, note['summary'])


def not_found() -> None:
    main = f'''<main class="page-main not-found" id="main"><p class="big-number">404</p><h1 tabindex="-1">这页笔记还没有写到。</h1><p>页面可能已移动，也可能是地址写错了。<br>回到首页，从两个板块重新开始吧。</p><a class="button button-primary" href="/">{icon('left')} 回到首页</a></main>'''
    shell('404.html', '页面未找到', main)
    # 404 is served at the requested URL on GitHub Pages, so its assets must be root-relative.
    path = ROOT / '404.html'
    path.write_text(path.read_text(encoding='utf-8').replace('href="./', 'href="/').replace('src="./', 'src="/'), encoding='utf-8')


def main() -> None:
    for note in NOTES:
        safe_slug(note['slug'])
    if len({n['slug'] for n in NOTES}) != len(NOTES):
        raise ValueError('存在重复的笔记 slug')
    for note in NOTES:
        article(note)
    home()
    note_index()
    thesis_index()
    not_found()
    print(f'已构建：主页、毕业论文、八股文、{len(NOTES)} 篇文章与 404 页面。公式缓存：{len(CACHE)} 条。')

if __name__ == '__main__':
    main()
