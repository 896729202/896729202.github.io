"""Build the AI搜 topic card and its placeholder landing page."""
from __future__ import annotations
from hashlib import sha256
import json
import re


def build(core):
    root, E = core.ROOT, core.ESC
    title = "AI搜"
    description = "AI 搜索、检索增强与搜索工作流的学习记录，后续逐步整理。"
    main = (
        '<main class="page-main rl-main ai-search-main" id="main"><header class="page-heading">'
        + core.breadcrumb('../../', title, article=True)
        + '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 学习专题</p>'
        + f'<h1 tabindex="-1">{E(title)}</h1>'
        + f'<p class="description">{E(description)}</p></header>'
        + '<section class="rl-empty" aria-labelledby="ai-search-pending-title">'
        + '<h2 id="ai-search-pending-title">内容待补充</h2>'
        + '<p>后续在这里整理 AI 搜索工具、检索增强和相关实践笔记。</p>'
        + '</section><a class="back-link rl-back" href="../index.html">'
        + core.icon('left') + ' 返回八股文</a></main>'
    )
    core.shell('notes/ai-search/index.html', title, main, 'notes', description=description)
    output = root / 'notes/ai-search/index.html'
    css = (root / 'assets/rl-notes.css').read_text(encoding='utf-8')
    version = sha256(css.encode('utf-8')).hexdigest()[:12]
    output.write_text(output.read_text(encoding='utf-8').replace(
        '</head>', f'<link rel="stylesheet" href="../../assets/rl-notes.css?v={version}">\n</head>', 1),
        encoding='utf-8')

    index = root / 'notes/index.html'
    page = index.read_text(encoding='utf-8')
    marker = '</div>\n<div class="zero-results"'
    if page.count(marker) != 1 or 'data-slug="ai-search"' in page:
        raise ValueError('Notes layout changed or AI搜 is already registered; rebuild notes first')
    card = (
        '<a class="note-card index-note rl-collection" href="ai-search/index.html" '
        'data-note-card data-slug="ai-search" data-note-kind="topic" aria-label="进入 AI搜 栏目">'
        '<div class="note-art rl-art" aria-hidden="true"><span class="note-art-title">AI搜</span>'
        '<span class="rl-art-caption">AI 搜索</span></div><div class="note-card-body">'
        '<div class="note-meta"><b class="note-category">学习专题</b><span></span><span>待补充</span></div>'
        '<h3>AI搜</h3><p>AI 搜索、检索增强与搜索工作流的学习记录。</p>'
        '<div class="note-tags"><span class="tag">AI Search</span><span class="tag tag-neutral">RAG</span></div></div>'
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
    if any(row['slug'] == 'ai-search' for row in search):
        raise ValueError('Duplicate AI搜 search entry')
    search.append({'slug': 'ai-search', 'text': 'AI搜 AI 搜索 检索增强 RAG 搜索工作流'})
    serialized = json.dumps(search, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:found.start(2)] + serialized + page[found.end(2):]
    index.write_text(page, encoding='utf-8')
    print('Built AI搜 topic and registered it in the notes index.')
