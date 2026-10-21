"""Agent collection and authored long-form documents; no placeholder lessons."""
from __future__ import annotations
from datetime import date
from html import unescape
from hashlib import sha256
import json
import re


def required_text(record, key):
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Missing Agent document field: {key}')
    return value


def load_manifest(core):
    data = json.loads((core.ROOT / 'content/notes/agent/index.json').read_text(encoding='utf-8'))
    if data.get('schema_version') != 1 or not isinstance(data.get('entries'), list):
        raise ValueError('Invalid Agent document index')
    required_text(data, 'title')
    required_text(data, 'description')
    seen = set()
    for entry in data['entries']:
        slug = core.safe_slug(required_text(entry, 'slug'))
        if slug in seen:
            raise ValueError(f'Duplicate Agent document slug: {slug}')
        seen.add(slug)
        for key in ('title', 'summary', 'date'):
            required_text(entry, key)
        date.fromisoformat(entry['date'])
        for key in ('tags', 'questions'):
            values = entry.get(key)
            if not isinstance(values, list) or not values or any(
                    not isinstance(value, str) or not value.strip() for value in values):
                raise ValueError(f'Invalid Agent document {key}: {slug}')
        if slug == 'rag-reranker' and len(entry['questions']) != 7:
            raise ValueError('RAG / Reranker document must contain seven questions')
    return data


def write(core, path, title, main, description, toc=None):
    core.shell(path, title, main, 'notes', toc=toc, description=description)
    output = core.ROOT / path
    css = ''
    for name in ('rl-notes.css', 'agent-notes.css'):
        # Change the URL when styles change so cached CSS cannot hide new diagrams.
        source = (core.ROOT / 'assets' / name).read_text(encoding='utf-8')
        version = sha256(source.encode('utf-8')).hexdigest()[:12]
        css += f'<link rel="stylesheet" href="{core.prefix_for(path)}assets/{name}?v={version}">\n'
    output.write_text(output.read_text(encoding='utf-8').replace(
        '</head>', css + '</head>', 1), encoding='utf-8')


def article(core, entry, source):
    E = core.ESC
    body = core.render_markdown(source, tables=True)
    question_count = 0

    def question(match):
        nonlocal question_count
        question_count += 1
        contents = match.group(1)
        text = unescape(re.sub(r'<[^>]+>', '', contents)).strip()
        label = re.match(r'^Q(\d+)(?:[.．、:：\s]|$)', text)
        if not label or int(label.group(1)) != question_count:
            raise ValueError(f'Agent question headings must be ordered Q1, Q2, …: {entry["slug"]}')
        cleaned = re.sub(r'^Q\d+[.．、:：\s]*', '', contents, count=1)
        return (f'<h2 id="q{question_count}"><span class="module-number">Q{question_count}</span>'
                f'<span>{cleaned}</span></h2>')

    body = re.sub(r'<h2>(.*?)</h2>', question, body, flags=re.S)
    if question_count != len(entry['questions']):
        raise ValueError(f'Agent document question count differs from its index: {entry["slug"]}')
    body = body.replace('<pre>', '<pre tabindex="0" aria-label="代码示例；窄屏可横向滚动">')
    body = re.sub(
        r'<table>(.*?)</table>',
        r'<div class="agent-table" role="region" tabindex="0" aria-label="对照表；窄屏可横向滚动">'
        r'<p class="agent-table-hint">左右滑动查看完整表格 →</p><table>\1</table></div>',
        body, flags=re.S)
    links = ''.join(f'<a class="toc-module" href="#q{i}">Q{i} · {E(title)}</a>'
                    for i, title in enumerate(entry['questions'], 1))
    toc = (
        '<aside class="toc-sidebar" aria-label="文章目录">'
        f'<a class="back-link" href="../index.html">{core.icon("left")} 返回 Agent</a>'
        f'<p class="toc-heading">本篇 {question_count} 个问题</p>'
        f'<nav class="toc" aria-label="问题导航">{links}</nav></aside>'
    )
    crumb_parts = [
        '<a href="../../../index.html">首页</a>',
        '<a href="../../index.html">八股文</a>',
        '<a href="../index.html">Agent</a>',
        f'<span aria-current="page">{E(entry["title"])}</span>',
    ]
    crumb = '<nav class="breadcrumb" aria-label="面包屑">' + core.icon('chevron').join(crumb_parts) + '</nav>'
    main = (
        '<main class="article-main agent-article" id="main"><article>'
        f'<header class="article-header">{crumb}'
        '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>Agent / 学习文档</p>'
        f'<h1 tabindex="-1">{E(entry["title"])}</h1>'
        f'<p class="agent-article-summary">{E(entry["summary"])}</p>'
        f'<div class="article-meta">{core.icon("calendar")}<time datetime="{E(entry["date"])}">'
        f'整理于 {E(entry["date"])}</time><span>·</span><span>{question_count} 个问题 · 一篇文档</span></div>'
        f'<div class="article-toolbar">{core.tags(entry)}<div class="article-actions">'
        f'<a class="button" href="../../../content/notes/agent/{E(entry["slug"])}.md" download>'
        f'{core.icon("download")} 下载整理稿</a>'
        f'<button class="button" data-copy-link type="button">{core.icon("link")} 复制链接</button>'
        f'<button class="button" data-print type="button">{core.icon("print")} 打印</button>'
        '</div></div></header>'
        f'<details class="mobile-toc"><summary>本篇目录 · {question_count} 个问题</summary>'
        f'<nav class="toc" aria-label="移动端问题导航">{links}</nav></details>'
        f'<div class="article-body">{body}</div>'
        '<footer class="article-end"><span>把检索链路与模型计算过程连起来理解。</span>'
        f'<a class="button" href="../index.html">{core.icon("left")} 返回 Agent</a></footer>'
        '</article></main>'
    )
    write(core, f'notes/agent/{entry["slug"]}/index.html', entry['title'], main, entry['summary'], toc)


def build(core):
    root, E = core.ROOT, core.ESC
    data = load_manifest(core)
    description = data['description']
    # Keep authored text in the previous single-file collection as its intro.
    source = (root / 'content/notes/agent.md').read_text(encoding='utf-8')
    intro = core.render_markdown(source)
    search_texts = [data['title'], 'Agent 智能体', description, source]
    buttons = []
    question_total = 0
    for entry in data['entries']:
        text = (root / 'content/notes/agent' / (entry['slug'] + '.md')).read_text(encoding='utf-8')
        article(core, entry, text)
        count = len(entry['questions'])
        question_total += count
        search_texts += [entry['title'], entry['summary'], *entry['tags'], *entry['questions'], text]
        buttons.append(
            f'<a class="agent-document" href="{E(entry["slug"])}/index.html" aria-label="阅读 {E(entry["title"])}">'
            f'<span class="agent-document-icon" aria-hidden="true">{core.icon("book")}</span>'
            f'<div><p class="agent-document-meta">学习文档 · {count} 个问题</p>'
            f'<h2>{E(entry["title"])}</h2><p class="agent-document-summary">{E(entry["summary"])}</p>'
            '<span class="agent-document-open">阅读全文</span></div>'
            f'{core.icon("arrow")}</a>'
        )
    document_count = len(data['entries'])
    state = f'{document_count} 篇文档' if document_count else ('已整理' if intro.strip() else '待补充')
    content = f'<div class="article-body rl-body agent-intro">{intro}</div>' if intro.strip() else ''
    if buttons:
        content += (f'<div class="rl-topline"><span>{document_count:02d} 篇文档</span>'
                    f'<span>{question_total} 个问题</span></div>'
                    f'<div class="agent-documents">{"".join(buttons)}</div>')
    elif not intro.strip():
        content = ('<section class="rl-empty" aria-labelledby="pending-title">'
                   '<h2 id="pending-title">内容待补充</h2>'
                   '<p>后续在这里整理 Agent 学习笔记。</p></section>')
    main = (
        '<main class="page-main rl-main agent-main" id="main"><header class="page-heading">'
        + core.breadcrumb('../../', data['title'], article=True)
        + '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 复习专题</p>'
        f'<h1 tabindex="-1">{E(data["title"])}</h1>'
        f'<p class="description">{E(description)}</p></header>{content}'
        '<a class="back-link rl-back" href="../index.html">'
        + core.icon('left') + ' 返回八股文</a></main>'
    )
    write(core, 'notes/agent/index.html', data['title'], main, description)

    # Register after the RL collection so both existing entries remain intact.
    path = root / 'notes/index.html'
    page = path.read_text(encoding='utf-8')
    marker = '</div>\n<div class="zero-results"'
    if page.count(marker) != 1 or 'data-slug="agent"' in page:
        raise ValueError('Notes layout changed or Agent already registered; rebuild notes first')
    card = (
        '<a class="note-card index-note rl-collection" href="agent/index.html" '
        'data-note-card data-slug="agent" data-note-kind="topic" aria-label="进入 Agent 栏目">'
        '<div class="note-art rl-art" aria-hidden="true"><span class="note-art-title">Agent</span>'
        '<span class="rl-art-caption">智能体</span></div><div class="note-card-body">'
        '<div class="note-meta"><b class="note-category">复习专题</b><span></span>'
        f'<span>{E(state)}</span></div><h3>{E(data["title"])}</h3><p>{E(description)}</p>'
        '<div class="note-tags"><span class="tag">Agent</span>'
        '<span class="tag tag-neutral">智能体</span></div></div>'
        + core.icon('arrow', 'end-arrow') + '</a>'
    )
    page = page.replace(marker, card + marker, 1)
    topics = page.count('data-note-kind="topic"')
    page, count = re.subn(
        r'(<span class="count-label"><strong>\d+</strong> 篇学习笔记)(?: · \d+ 个专题)?</span>',
        rf'\g<1> · {topics} 个专题</span>', page, count=1)
    if count != 1:
        raise ValueError('Missing note collection count')
    page = re.sub(
        r'(<p class="note-list-caption"[^>]*>).*?(</p>)',
        rf'\g<1>已收录 {len(core.NOTES)} 篇笔记 · {topics} 个专题\g<2>', page, count=1)
    matches = list(re.finditer(r'(<script type="application/json" id="note-search-data">)(.*?)(</script>)', page, re.S))
    if len(matches) != 1:
        raise ValueError('Missing or ambiguous note search index')
    found = matches[0]
    search = json.loads(found.group(2))
    if any(row['slug'] == 'agent' for row in search):
        raise ValueError('Duplicate Agent search entry')
    search.append({'slug': 'agent', 'text': ' '.join(search_texts)})
    serialized = json.dumps(search, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:found.start(2)] + serialized + page[found.end(2):]
    path.write_text(page, encoding='utf-8')
    print(f'Built Agent collection: {state}.')
