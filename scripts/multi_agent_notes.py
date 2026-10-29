"""Build the multi-agent collection and its online Badcase document."""
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


def build_document(core, source, *, slug='online-badcase', title='线上 Badcase 提炼',
                   summary='从零召回、连续重搜和短点击等线上信号中，筛出可归因、可复现、可评测的 Agent 问题。',
                   eyebrow='多智能体 Agent / 线上诊断',
                   back_label='返回多智能体 Agent', back_href='../index.html',
                   download_path='../../../content/notes/multi-agent/online-badcase.md',
                   description='多智能体 Agent 线上 Badcase 提炼：零召回、连续重搜与短点击的诊断方法。',
                   tags=('Multi-Agent', 'Badcase'),
                   footer='先提纯信号，再把问题沉淀为评测。'):
    E = core.ESC
    body = core.render_markdown(source, tables=True)
    headings = []

    def heading(match):
        contents = match.group(1)
        plain = unescape(re.sub(r'<[^>]+>', '', contents)).strip()
        found = re.match(r'Q(\d+)[.．、:：\s]*(.*)', plain)
        if not found:
            return f'<h2>{contents}</h2>'
        number, title = int(found.group(1)), found.group(2).strip()
        if number != len(headings) + 1:
            raise ValueError('Multi-agent questions must be ordered Q1, Q2, …')
        headings.append((f'q{number}', title))
        cleaned = re.sub(r'^Q\d+[.．、:：\s]*', '', contents, count=1)
        return f'<h2 id="q{number}"><span class="module-number">Q{number}</span><span>{cleaned}</span></h2>'

    body = re.sub(r'<h2>(.*?)</h2>', heading, body, flags=re.S)
    body = re.sub(
        r'<table>(.*?)</table>',
        r'<div class="agent-table" role="region" tabindex="0" aria-label="对照表；窄屏可横向滚动">'
        r'<p class="agent-table-hint">左右滑动查看完整表格 →</p><table>\1</table></div>',
        body, flags=re.S)
    links = ''.join(f'<a class="toc-module" href="#{anchor}">Q{idx} · {E(title)}</a>'
                    for idx, (anchor, title) in enumerate(headings, 1))
    toc = (
        '<aside class="toc-sidebar" aria-label="文章目录">'
        f'<a class="back-link" href="{E(back_href)}">{core.icon("left")} {E(back_label)}</a>'
        f'<p class="toc-heading">本篇 {len(headings)} 个问题</p>'
        f'<nav class="toc" aria-label="问题导航">{links}</nav></aside>'
    )
    crumb = (
        '<nav class="breadcrumb" aria-label="面包屑"><a href="../../../index.html">首页</a>'
        + core.icon('chevron') + '<a href="../../index.html">八股文</a>'
        + core.icon('chevron') + '<a href="../index.html">多智能体 Agent</a>'
        + core.icon('chevron') + f'<span aria-current="page">{E(title)}</span></nav>'
    )
    tag_html = ''.join(f'<span class="tag">{E(tag)}</span>' for tag in tags)
    main = (
        '<main class="article-main agent-article" id="main"><article><header class="article-header">'
        + crumb
        + f'<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>{E(eyebrow)}</p>'
        + f'<h1 tabindex="-1">{E(title)}</h1>'
        + f'<p class="agent-article-summary">{E(summary)}</p>'
        + f'<div class="article-meta"><span>{len(headings)} 个问题</span><span>·</span><span>多智能体学习专题</span></div>'
        + f'<div class="article-toolbar"><div class="note-tags">{tag_html}</div>'
        + f'<div class="article-actions"><a class="button" href="{E(download_path)}" download>下载整理稿</a>'
        '<button class="button" data-copy-link type="button">复制链接</button><button class="button" data-print type="button">打印</button></div></div></header>'
        f'<details class="mobile-toc"><summary>本篇目录 · {len(headings)} 个问题</summary><nav class="toc" aria-label="移动端问题导航">{links}</nav></details>'
        f'<div class="article-body">{body}</div>'
        + f'<footer class="article-end"><span>{E(footer)}</span><a class="button" href="../index.html">返回多智能体 Agent</a></footer>'
        '</article></main>'
    )
    path = f'notes/multi-agent/{slug}/index.html'
    core.shell(path, title, main, 'notes', toc=toc, description=description)
    add_styles(core, path)


def build(core):
    root, E = core.ROOT, core.ESC
    source = (root / 'content/notes/multi-agent/online-badcase.md').read_text(encoding='utf-8')
    langfuse_source = (root / 'content/notes/multi-agent/langfuse.md').read_text(encoding='utf-8')
    intro_source = (root / 'content/notes/multi-agent.md').read_text(encoding='utf-8')
    build_document(core, source)
    build_document(
        core, langfuse_source, slug='langfuse', title='Langfuse 使用',
        summary='从 Trace 展开链路，定位工具参数漏传，并把可复现问题沉淀为 Dataset。',
        eyebrow='多智能体 Agent / 可观测与评测',
        download_path='../../../content/notes/multi-agent/langfuse.md',
        description='多智能体 Agent 的 Langfuse 可观测、Badcase 定位与离线评测流程。',
        tags=('Multi-Agent', 'Langfuse', '可观测'),
        footer='先看链路定位责任，再用数据验证修复。',
    )
    title = '多智能体 Agent'
    description = '多智能体协作、线上诊断、Langfuse 可观测与评测。'
    badcase_card = (
        '<a class="agent-document" href="online-badcase/index.html" aria-label="阅读线上 Badcase 提炼">'
        f'<span class="agent-document-icon" aria-hidden="true">{core.icon("book")}</span><div>'
        '<p class="agent-document-meta">线上诊断 · 3 个问题</p>'
        '<h2>线上 Badcase 提炼</h2>'
        '<p class="agent-document-summary">从零召回、连续重搜和短点击中提纯 Agent 问题，建立可复现的黄金测评集。</p>'
        '<span class="agent-document-open">阅读全文</span></div>' + core.icon('arrow') + '</a>'
    )
    langfuse_card = (
        '<a class="agent-document" href="langfuse/index.html" aria-label="阅读 Langfuse 使用">'
        f'<span class="agent-document-icon" aria-hidden="true">{core.icon("book")}</span><div>'
        '<p class="agent-document-meta">可观测与评测 · 2 个问题</p>'
        '<h2>Langfuse 使用</h2>'
        '<p class="agent-document-summary">用 Trace、Score 和 Dataset 定位 Agent 的工具参数问题，并做回归评测。</p>'
        '<span class="agent-document-open">阅读全文</span></div>' + core.icon('arrow') + '</a>'
    )
    parent_main = (
        '<main class="page-main rl-main agent-main" id="main"><header class="page-heading">'
        + core.breadcrumb('../../', title, article=True)
        + '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 复习专题</p>'
        f'<h1 tabindex="-1">{E(title)}</h1><p class="description">{E(description)}</p></header>'
        '<div class="article-body rl-body agent-intro">' + core.render_markdown(intro_source) + '</div>'
        '<div class="rl-topline"><span>02 篇文档</span><span>线上诊断 · 可观测 · 评测闭环</span></div>'
        f'<div class="agent-documents">{badcase_card}{langfuse_card}</div>'
        '<a class="back-link rl-back" href="../index.html">' + core.icon('left') + ' 返回八股文</a></main>'
    )
    core.shell('notes/multi-agent/index.html', title, parent_main, 'notes', description=description)
    add_styles(core, 'notes/multi-agent/index.html')

    path = root / 'notes/index.html'
    page = path.read_text(encoding='utf-8')
    marker = '</div>\n<div class="zero-results"'
    if page.count(marker) != 1 or 'data-slug="multi-agent"' in page:
        raise ValueError('Notes layout changed or Multi-Agent already registered; rebuild notes first')
    top_card = (
        '<a class="note-card index-note rl-collection" href="multi-agent/index.html" data-note-card data-slug="multi-agent" data-note-kind="topic" aria-label="进入多智能体 Agent 栏目">'
        '<div class="note-art rl-art" aria-hidden="true"><span class="note-art-title">M-Agent</span><span class="rl-art-caption">多智能体</span></div>'
        '<div class="note-card-body"><div class="note-meta"><b class="note-category">复习专题</b><span></span><span>02 篇文档</span></div>'
        '<h3>多智能体 Agent</h3><p>多智能体协作、线上诊断、Langfuse 可观测与评测。</p><div class="note-tags"><span class="tag">Multi-Agent</span><span class="tag tag-neutral">Langfuse · Badcase</span></div></div>'
        + core.icon('arrow', 'end-arrow') + '</a>'
    )
    page = page.replace(marker, top_card + marker, 1)
    topics = page.count('data-note-kind="topic"')
    page, count = re.subn(r'(<span class="count-label"><strong>\d+</strong> 篇学习笔记)(?: · \d+ 个专题)?</span>',
                          rf'\g<1> · {topics} 个专题</span>', page, count=1)
    if count != 1:
        raise ValueError('Missing note collection count')
    page = re.sub(r'(<p class="note-list-caption"[^>]*>).*?(</p>)',
                  rf'\g<1>已收录 {len(core.NOTES)} 篇笔记 · {topics} 个专题\g<2>', page, count=1)
    match = re.search(r'(<script type="application/json" id="note-search-data">)(.*?)(</script>)', page, re.S)
    if not match:
        raise ValueError('Notes search index missing')
    rows = json.loads(match.group(2))
    rows.append({'slug': 'multi-agent', 'text': '多智能体 Agent Multi-Agent 智能体协作 线上 Badcase 提炼 Langfuse Trace Score Dataset 可观测 评测 ' + intro_source + ' ' + source + ' ' + langfuse_source})
    serialized = json.dumps(rows, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:match.start(2)] + serialized + page[match.end(2):]
    path.write_text(page, encoding='utf-8')
    print('Built Multi-Agent collection: online Badcase and Langfuse documents.')
