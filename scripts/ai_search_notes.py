"""Build the AI搜 collection, practice notes and interview question list."""
from __future__ import annotations
from hashlib import sha256
from html import unescape
import json
import re


def add_styles(core, path):
    links = ''
    for name in ('rl-notes.css', 'agent-notes.css'):
        source = (core.ROOT / 'assets' / name).read_text(encoding='utf-8')
        version = sha256(source.encode('utf-8')).hexdigest()[:12]
        links += f'<link rel="stylesheet" href="{core.prefix_for(path)}assets/{name}?v={version}">\n'
    output = core.ROOT / path
    output.write_text(output.read_text(encoding='utf-8').replace('</head>', links + '</head>', 1), encoding='utf-8')


def build_interview(core):
    source = (core.ROOT / 'content/notes/ai-search/interview-questions.md').read_text(encoding='utf-8')
    numbers = [int(value) for value in re.findall(r'^(\d+)\.\s', source, re.M)]
    if numbers != list(range(1, 33)):
        raise ValueError('AI search interview questions must retain numbers 1–32')
    sections = []

    def section(match):
        title = unescape(re.sub(r'<[^>]+>', '', match.group(1))).strip()
        anchor = f'topic-{len(sections) + 1}'
        sections.append((anchor, title))
        return f'<h2 id="{anchor}">{match.group(1)}</h2>'

    body = re.sub(r'<h2>(.*?)</h2>', section, core.render_markdown(source), flags=re.S)
    if len(sections) != 8:
        raise ValueError('AI search interview questions must retain eight topic groups')
    links = ''.join(f'<a class="toc-module" href="#{anchor}">{core.ESC(title)}</a>' for anchor, title in sections)
    toc = ('<aside class="toc-sidebar" aria-label="文章目录">'
           f'<a class="back-link" href="../index.html">{core.icon("left")} 返回 AI搜</a>'
           '<p class="toc-heading">8 个主题 · 32 个问题</p>'
           f'<nav class="toc" aria-label="主题导航">{links}</nav></aside>')
    main = (
        '<main class="article-main agent-article" id="main"><article><header class="article-header">'
        '<nav class="breadcrumb" aria-label="面包屑"><a href="../../../index.html">首页</a>'
        + core.icon('chevron') + '<a href="../../index.html">八股文</a>'
        + core.icon('chevron') + '<a href="../index.html">AI搜</a>'
        + core.icon('chevron') + '<span aria-current="page">面试问题汇总</span></nav>'
        '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>AI搜 / 面试准备</p>'
        '<h1 tabindex="-1">面试问题汇总</h1>'
        '<p class="agent-article-summary">AI 搜索项目的 32 个追问，涵盖项目职责、辅助模型、引用评测、奖励设计、强化学习与训练工程。</p>'
        '<div class="article-meta"><span>8 个主题</span><span>·</span><span>32 个问题</span>'
        '<span>·</span><span>★ 重点追问</span></div>'
        '<div class="article-toolbar"><div class="note-tags"><span class="tag">AI 搜索</span>'
        '<span class="tag">面试</span><span class="tag">问题清单</span></div>'
        '<div class="article-actions"><a class="button" href="../../../content/notes/ai-search/interview-questions.md" download>下载问题清单</a>'
        '<button class="button" data-copy-link type="button">复制链接</button>'
        '<button class="button" data-print type="button">打印</button></div></div></header>'
        '<details class="mobile-toc"><summary>本篇目录 · 8 个主题</summary>'
        f'<nav class="toc" aria-label="移动端主题导航">{links}</nav></details>'
        f'<div class="article-body">{body}</div>'
        '<footer class="article-end"><span>AI 搜索项目面试追问清单</span>'
        '<a class="button" href="../index.html">返回 AI搜</a></footer></article></main>'
    )
    path = 'notes/ai-search/interview-questions/index.html'
    core.shell(path, '面试问题汇总 · AI搜', main, 'notes', toc=toc,
               description='AI 搜索项目面试追问清单：8 个主题、32 个问题，覆盖模型训练、引用奖励、GRPO、LoRA、MoE 与算力实验。')
    add_styles(core, path)
    return source


def build(core):
    root, E = core.ROOT, core.ESC
    title = "AI搜"
    description = "AI 搜索、检索增强与搜索工作流的学习记录。"
    source = (root / 'content/notes/ai-search/verl.md').read_text(encoding='utf-8')
    body = core.render_markdown(source, tables=True)
    css = (root / 'assets/rl-notes.css').read_text(encoding='utf-8')
    version = sha256(css.encode('utf-8')).hexdigest()[:12]
    interview_source = build_interview(core)

    article = (
        '<main class="page-main rl-main ai-search-main" id="main"><article><header class="page-heading">'
        '<nav class="breadcrumb" aria-label="面包屑"><a href="../../../index.html">首页</a>'
        + core.icon('chevron') + '<a href="../../index.html">八股文</a>'
        + core.icon('chevron') + '<a href="../index.html">AI搜</a>'
        + core.icon('chevron') + '<span aria-current="page">verl 实操</span></nav>'
        '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>AI搜 / 实操文档</p>'
        '<h1 tabindex="-1">verl 实操：PPO、GRPO、DAPO 配置与奖励接入</h1>'
        '<p class="description">固定版本，核对算法开关，最后把自定义奖励接入训练。</p>'
        '<div class="article-toolbar"><div class="note-tags"><span class="tag">verl v0.6.0</span>'
        '<span class="tag">PPO</span><span class="tag">GRPO</span><span class="tag">DAPO</span></div>'
        '<div class="article-actions"><a class="button" href="../../../content/notes/ai-search/verl.md" download>下载 Markdown</a>'
        '<button class="button" data-copy-link type="button">复制链接</button>'
        '<button class="button" data-print type="button">打印</button></div></div></header>'
        '<div class="article-body">' + body + '</div>'
        '<footer class="article-end"><span>配置要结合版本、日志和独立评测验证。</span>'
        '<a class="button" href="../index.html">返回 AI搜</a></footer></article></main>'
    )
    core.shell('notes/ai-search/verl/index.html', 'verl 实操', article, 'notes',
               description='verl v0.6.0：PPO、GRPO、DAPO 配置、KL、动态采样与奖励接入。')
    p = root / 'notes/ai-search/verl/index.html'
    p.write_text(p.read_text(encoding='utf-8').replace(
        '</head>', f'<link rel="stylesheet" href="../../../assets/rl-notes.css?v={version}">\n</head>', 1), encoding='utf-8')

    card = (
        '<a class="agent-document" href="verl/index.html" aria-label="阅读 verl 实操">'
        f'<span class="agent-document-icon">{core.icon("book")}</span><div>'
        '<p class="agent-document-meta">实操文档 · PPO / GRPO / DAPO</p>'
        '<h2>verl 实操：PPO、GRPO、DAPO 配置与奖励接入</h2>'
        '<p class="agent-document-summary">算法开关、KL、DAPO 动态采样、训练参数与自定义 F1 奖励。</p>'
        '<span class="agent-document-open">阅读全文</span></div>' + core.icon('arrow') + '</a>'
    )
    interview_card = (
        '<a class="agent-document" href="interview-questions/index.html" aria-label="阅读面试问题汇总">'
        f'<span class="agent-document-icon" aria-hidden="true">{core.icon("book")}</span><div>'
        '<p class="agent-document-meta">问题清单 · 8 个主题 · 32 个问题</p>'
        '<h2>面试问题汇总</h2>'
        '<p class="agent-document-summary">AI 搜索项目面试追问：项目职责、辅助模型、引用奖励、GRPO、LoRA、MoE 与算力实验。</p>'
        '<span class="agent-document-open">查看问题清单</span></div>' + core.icon('arrow') + '</a>'
    )
    main = (
        '<main class="page-main rl-main ai-search-main" id="main"><header class="page-heading">'
        + core.breadcrumb('../../', title, article=True)
        + '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 学习专题</p>'
        + f'<h1 tabindex="-1">{E(title)}</h1><p class="description">{E(description)}</p></header>'
        '<div class="rl-topline"><span>02 篇文档</span><span>面试准备 · verl 实操</span></div>'
        f'<div class="agent-documents">{interview_card}{card}</div>'
        '<a class="back-link rl-back" href="../index.html">' + core.icon('left') + ' 返回八股文</a></main>'
    )
    core.shell('notes/ai-search/index.html', title, main, 'notes', description=description)
    add_styles(core, 'notes/ai-search/index.html')

    index = root / 'notes/index.html'
    page = index.read_text(encoding='utf-8')
    marker = '</div>\n<div class="zero-results"'
    if page.count(marker) != 1:
        raise ValueError('Notes index insertion marker missing')
    if 'data-slug="ai-search"' not in page:
        card_index = (
            '<a class="note-card index-note rl-collection" href="ai-search/index.html" data-note-card data-slug="ai-search" data-note-kind="topic" aria-label="进入 AI搜 栏目">'
            '<div class="note-art rl-art"><span class="note-art-title">AI搜</span><span class="rl-art-caption">AI 搜索</span></div>'
            '<div class="note-card-body"><div class="note-meta"><b class="note-category">学习专题</b><span></span><span>02 篇文档</span></div>'
            '<h3>AI搜</h3><p>AI 搜索项目面试问题与 verl 强化学习实操笔记。</p>'
            '<div class="note-tags"><span class="tag">AI Search</span><span class="tag tag-neutral">RAG</span></div></div>'
            + core.icon('arrow', 'end-arrow') + '</a>'
        )
        page = page.replace(marker, card_index + marker, 1)
    topics = page.count('data-note-kind="topic"')
    page, n = re.subn(r'(<span class="count-label"><strong>\d+</strong> 篇学习笔记)(?: · \d+ 个专题)?</span>',
                      rf'\g<1> · {topics} 个专题</span>', page, count=1)
    if n != 1:
        raise ValueError('Notes collection count missing')
    page = re.sub(r'(<p class="note-list-caption"[^>]*>).*?(</p>)',
                  rf'\g<1>已收录 {len(core.NOTES)} 篇笔记 · {topics} 个专题\g<2>', page, count=1)
    match = re.search(r'(<script type="application/json" id="note-search-data">)(.*?)(</script>)', page, re.S)
    if not match:
        raise ValueError('Notes search index missing')
    rows = json.loads(match.group(2))
    search_text = 'AI搜 AI 搜索 面试问题汇总 检索增强 RAG 搜索工作流 verl PPO GRPO DAPO KL 奖励函数 F1 ' + source + ' ' + interview_source
    for row in rows:
        if row.get('slug') == 'ai-search':
            row['text'] = search_text
    if not any(row.get('slug') == 'ai-search' for row in rows):
        rows.append({'slug':'ai-search','text':search_text})
    serialized = json.dumps(rows, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:match.start(2)] + serialized + page[match.end(2):]
    index.write_text(page, encoding='utf-8')
    print('Built AI搜 collection: verl practice and 32 interview questions.')
