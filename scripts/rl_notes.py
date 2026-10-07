"""Reinforcement-learning topic pages; pending pages are not published notes."""
from __future__ import annotations
import json
import re
from pathlib import Path


def build(core):
    root = core.ROOT
    data = json.loads((root / 'content/notes/rl/index.json').read_text(encoding='utf-8'))
    topics = data['topics']
    slugs = [t['slug'] for t in topics]
    if len(slugs) != len(set(slugs)) or not topics:
        raise ValueError('Reinforcement-learning topics must be nonempty and unique')
    for topic in topics:
        core.safe_slug(topic['slug'])
        if topic.get('status') not in ('pending', 'published'):
            raise ValueError('Topic status must be pending or published')
        if not isinstance(topic.get('title'), str) or not topic['title'].strip():
            raise ValueError('Missing topic title')
    E = core.ESC
    title = E(data['title'])

    def crumb(prefix, current=None):
        parts = [f'<a href="{prefix}index.html">首页</a>',
                 f'<a href="{prefix}notes/index.html">八股文</a>']
        if current:
            parts += [f'<a href="{prefix}notes/rl/index.html">{title}</a>',
                      f'<span aria-current="page">{E(current)}</span>']
        else:
            parts.append(f'<span aria-current="page">{title}</span>')
        return '<nav class="breadcrumb" aria-label="面包屑">' + core.icon('chevron').join(parts) + '</nav>'

    def write(path, page_title, main):
        core.shell(path, page_title, main, 'notes', description='强化学习复习专题：PPO、DPO、GRPO、GSPO、DAPO。')
        output = root / path
        css = f'<link rel="stylesheet" href="{core.prefix_for(path)}assets/rl-notes.css">'
        output.write_text(output.read_text(encoding='utf-8').replace('</head>', css + '\n</head>', 1), encoding='utf-8')

    rows = []
    published = 0
    for number, topic in enumerate(topics, 1):
        slug, name = topic['slug'], topic['title']
        ready = topic['status'] == 'published'
        published += int(ready)
        state = '已整理' if ready else '待补充'
        source = (root / 'content/notes/rl' / (slug + '.md')).read_text(encoding='utf-8')
        # The publication flag controls exposure; no definitions are invented here.
        body = core.render_markdown(source) if ready else ''
        if ready and not body.strip():
            raise ValueError(f'Published topic has no content: {slug}')
        rows.append(f'<a class="rl-topic" href="{slug}/index.html"><span class="rl-number">{number:02d}</span><h2>{E(name)}</h2><span class="rl-state">{state}</span>{core.icon("arrow")}</a>')
        tabs = ''.join(f'<a href="../{t["slug"]}/index.html"' + (' aria-current="page"' if t['slug'] == slug else '') + f'>{E(t["title"])}</a>' for t in topics)
        content = f'<div class="article-body rl-body">{body}</div>' if ready else f'<section class="rl-empty" aria-labelledby="pending-title"><span class="rl-empty-icon" aria-hidden="true">{core.icon("note")}</span><h2 id="pending-title">内容待补充</h2><p>后续在这里整理 {E(name)} 的学习笔记。</p></section>'
        main = f'<main class="page-main rl-main" id="main"><header class="page-heading">{crumb("../../../", name)}<p class="eyebrow">八股文 / 强化学习</p><h1 tabindex="-1">{E(name)}</h1><span class="tag tag-neutral">{state}</span></header><nav class="rl-tabs" aria-label="强化学习主题">{tabs}</nav>{content}<a class="back-link rl-back" href="../index.html">{core.icon("left")} 返回强化学习</a></main>'
        write(f'notes/rl/{slug}/index.html', f'{name} · 强化学习', main)

    main = f'<main class="page-main rl-main" id="main"><header class="page-heading">{crumb("../../")}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 复习专题</p><h1 tabindex="-1">{title}</h1><p class="description">PPO · DPO · GRPO · GSPO · DAPO</p></header><div class="rl-topline"><span>{len(topics):02d} 个主题</span><span>{published} 篇已整理</span></div><div class="rl-topics">{"".join(rows)}</div><a class="back-link rl-back" href="../index.html">{core.icon("left")} 返回八股文</a></main>'
    write('notes/rl/index.html', '强化学习', main)

    # Extend the freshly generated notes directory without touching LoRA content.
    path = root / 'notes/index.html'
    page = path.read_text(encoding='utf-8')
    labels = ' · '.join(t['title'] for t in topics)
    card = f'<a class="note-card index-note rl-collection" href="../notes/rl/index.html" data-note-card data-slug="rl" data-note-kind="topic" aria-label="进入强化学习专题"><div class="note-art rl-art" aria-hidden="true"><span class="note-art-title">RL</span><span class="rl-art-caption">强化学习</span></div><div class="note-card-body"><div class="note-meta"><b class="note-category">复习专题</b><span></span><span>{len(topics)} 个主题</span></div><h3>{title}</h3><p>{E(labels)}</p><div class="note-tags"><span class="tag tag-neutral">{published} 篇已整理</span></div></div>{core.icon("arrow", "end-arrow")}</a>'
    marker = '</div>\n<div class="zero-results"'
    if page.count(marker) != 1:
        raise ValueError('Notes layout changed; refusing an ambiguous insertion')
    page = page.replace(marker, card + marker, 1)
    page = page.replace(' 篇学习笔记</span>', ' 篇学习笔记 · 1 个专题</span>', 1)
    search_pattern = r'(<script type="application/json" id="note-search-data">)(.*?)(</script>)'
    matches = list(re.finditer(search_pattern, page, re.S))
    if len(matches) != 1:
        raise ValueError('Missing or ambiguous note search index')
    found = matches[0]
    search = json.loads(found.group(2))
    if any(row['slug'] == 'rl' for row in search):
        raise ValueError('Duplicate RL search entry; rebuild notes first')
    search_text = data['title'] + ' reinforcement learning RL ' + labels
    for topic in topics:
        if topic['status'] == 'published':
            search_text += ' ' + (root / 'content/notes/rl' / (topic['slug'] + '.md')).read_text(encoding='utf-8')
    search.append({'slug': 'rl', 'text': search_text})
    serialized = json.dumps(search, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:found.start(2)] + serialized + page[found.end(2):]
    css = '<link rel="stylesheet" href="../assets/rl-notes.css">'
    page = page.replace('</head>', css + '\n</head>', 1)
    page = page.replace(f'已收录 {len(core.NOTES)} 篇笔记</p>', f'已收录 {len(core.NOTES)} 篇笔记 · 1 个专题</p>', 1)
    path.write_text(page, encoding='utf-8')
    print(f'Built RL directory and {len(topics)} topic pages; {published} published, {len(topics)-published} pending.')
