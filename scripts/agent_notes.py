"""Agent collection in the notebook; render authored content when available."""
from __future__ import annotations
import json
import re


def build(core):
    root = core.ROOT
    source = (root / 'content/notes/agent.md').read_text(encoding='utf-8')
    body = core.render_markdown(source)
    state = '已整理' if body.strip() else '待补充'
    description = 'Agent 相关的原理、实践与面试笔记。'
    content = (f'<div class="article-body rl-body">{body}</div>' if body.strip() else
               '<section class="rl-empty" aria-labelledby="pending-title">'
               '<h2 id="pending-title">内容待补充</h2>'
               '<p>后续在这里整理 Agent 学习笔记。</p></section>')
    main = (
        '<main class="page-main rl-main" id="main"><header class="page-heading">'
        + core.breadcrumb('../../', 'Agent', article=True)
        + '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 复习专题</p>'
        '<h1 tabindex="-1">Agent</h1>'
        f'<p class="description">{description}</p></header>{content}'
        '<a class="back-link rl-back" href="../index.html">'
        + core.icon('left') + ' 返回八股文</a></main>'
    )
    core.shell('notes/agent/index.html', 'Agent', main, 'notes', description=description)
    output = root / 'notes/agent/index.html'
    output.write_text(output.read_text(encoding='utf-8').replace(
        '</head>', '<link rel="stylesheet" href="../../assets/rl-notes.css">\n</head>', 1),
        encoding='utf-8')

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
        f'<span>{state}</span></div><h3>Agent</h3><p>{description}</p>'
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
    search.append({'slug': 'agent', 'text': 'Agent 智能体 ' + description + ' ' + source})
    serialized = json.dumps(search, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:found.start(2)] + serialized + page[found.end(2):]
    path.write_text(page, encoding='utf-8')
    print(f'Built Agent collection: {state}.')
