"""RL topic hubs: original paper first, then interview and principles modules."""
from __future__ import annotations
import json
import re
from urllib.parse import urlparse


def build(core):
    root, E = core.ROOT, core.ESC
    source_root = root / 'content/notes/rl'
    data = json.loads((source_root / 'index.json').read_text(encoding='utf-8'))
    topics, modules = data['topics'], data['modules']
    if data.get('schema_version') != 2:
        raise ValueError('RL notes require schema_version 2')
    for records in (topics, modules):
        slugs = [r['slug'] for r in records]
        if not records or len(slugs) != len(set(slugs)):
            raise ValueError('Topic and module slugs must be nonempty and unique')
        for record in records:
            core.safe_slug(record['slug'])
            if not isinstance(record.get('title'), str) or not record['title'].strip():
                raise ValueError('Missing topic or module title')
    module_ids = {m['slug'] for m in modules}
    bodies, published_sources = {}, []
    for topic in topics:
        slug = topic['slug']
        if set(topic['sections']) != module_ids:
            raise ValueError(f'Module status mismatch: {slug}')
        paper = topic['paper']
        if not isinstance(paper.get('title'), str) or not paper['title'].strip():
            raise ValueError('Missing original paper title')
        for key, kind in (('url', 'abs'), ('pdf', 'pdf')):
            url = urlparse(paper[key])
            if url.scheme != 'https' or url.netloc != 'arxiv.org' or not re.fullmatch(r'/' + kind + r'/\d{4}\.\d{4,5}(v\d+)?', url.path) or url.query or url.fragment:
                raise ValueError(f'Invalid original paper URL: {slug}/{key}')
        # Retain the old flat source files; do not silently discard authored text.
        legacy = source_root / (slug + '.md')
        if legacy.exists() and re.sub(r'^# [^\n]*(?:\n|$)', '', legacy.read_text(encoding='utf-8'), count=1).strip():
            raise ValueError(f'Migrate existing authored text before rebuilding: {legacy}')
        for module in modules:
            key = module['slug']
            status = topic['sections'][key]
            if status not in ('pending', 'published'):
                raise ValueError(f'Invalid publication status: {slug}/{key}')
            source = (source_root / slug / (key + '.md')).read_text(encoding='utf-8')
            body = core.render_markdown(source) if status == 'published' else ''
            if status == 'published' and not body.strip():
                raise ValueError(f'Published module has no text: {slug}/{key}')
            bodies[(slug, key)] = body
            if status == 'published':
                published_sources.append(source)

    def crumb(prefix, topic=None, module=None):
        parts = [f'<a href="{prefix}index.html">首页</a>', f'<a href="{prefix}notes/index.html">八股文</a>']
        if topic:
            parts.append(f'<a href="{prefix}notes/rl/index.html">{E(data["title"])}</a>')
            if module:
                parts += [f'<a href="../index.html">{E(topic["title"])}</a>', f'<span aria-current="page">{E(module["title"])}</span>']
            else:
                parts.append(f'<span aria-current="page">{E(topic["title"])}</span>')
        else:
            parts.append(f'<span aria-current="page">{E(data["title"])}</span>')
        return '<nav class="breadcrumb" aria-label="面包屑">' + core.icon('chevron').join(parts) + '</nav>'

    def paper_line(topic):
        paper = topic['paper']
        identifier = paper['url'].rsplit('/', 1)[1]
        return f'<p class="rl-paper-line"><a class="rl-paper-primary" href="{E(paper["pdf"], quote=True)}" target="_blank" rel="noopener noreferrer" aria-label="{E(topic["title"])} 论文原文 PDF（新窗口）">{core.icon("paper")} 论文原文（PDF）{core.icon("external")}</a><a class="rl-paper-meta" href="{E(paper["url"], quote=True)}" target="_blank" rel="noopener noreferrer">arXiv:{E(identifier)}</a></p>'

    def write(path, page_title, main):
        core.shell(path, page_title, main, 'notes', description='强化学习复习专题：论文原文、八股文与原理。')
        output = root / path
        prefix = core.prefix_for(path)
        css = ''.join(f'<link rel="stylesheet" href="{prefix}assets/{name}">\n' for name in ('rl-notes.css', 'rl-sections.css'))
        output.write_text(output.read_text(encoding='utf-8').replace('</head>', css + '</head>', 1), encoding='utf-8')

    rows = []
    published = len(published_sources)
    for number, topic in enumerate(topics, 1):
        slug, name = topic['slug'], topic['title']
        count = sum(status == 'published' for status in topic['sections'].values())
        state = f'{count}/{len(modules)} 已整理' if count else '待补充'
        rows.append(f'<a class="rl-topic" href="{slug}/index.html"><span class="rl-number">{number:02d}</span><h2>{E(name)}</h2><span class="rl-state">{state}</span>{core.icon("arrow")}</a>')
        buttons = ''
        for module in modules:
            key, label = module['slug'], module['title']
            ready = topic['sections'][key] == 'published'
            module_state = '已整理' if ready else '待补充'
            buttons += f'<a class="rl-module-card" href="{key}/index.html" aria-label="进入 {E(name)} {E(label)}"><span class="rl-module-icon">{core.icon("note" if key == "interview" else "book")}</span><h2>{E(label)}</h2><span class="rl-module-state">{module_state}</span>{core.icon("arrow")}</a>'
            tabs = ''.join(f'<a href="../{m["slug"]}/index.html"' + (' aria-current="page"' if m['slug'] == key else '') + f'>{E(m["title"])}</a>' for m in modules)
            body = bodies[(slug, key)]
            content = f'<div class="article-body rl-body">{body}</div>' if ready else '<section class="rl-empty" aria-labelledby="pending-title"><h2 id="pending-title">内容待补充</h2><p>后续在这里整理学习笔记。</p></section>'
            main = f'<main class="page-main rl-main rl-module-page" id="main">{paper_line(topic)}<header class="page-heading">{crumb("../../../../", topic, module)}<h1 tabindex="-1">{E(name)} · {E(label)}</h1></header><nav class="rl-tabs rl-subtabs" aria-label="{E(name)} 内容模块">{tabs}</nav>{content}<a class="back-link rl-back" href="../index.html">{core.icon("left")} 返回 {E(name)}</a></main>'
            write(f'notes/rl/{slug}/{key}/index.html', f'{name} · {label}', main)
        tabs = ''.join(f'<a href="../{t["slug"]}/index.html"' + (' aria-current="page"' if t['slug'] == slug else '') + f'>{E(t["title"])}</a>' for t in topics)
        main = f'<main class="page-main rl-main rl-hub" id="main">{paper_line(topic)}<header class="page-heading">{crumb("../../../", topic)}<h1 tabindex="-1">{E(name)}</h1><p class="rl-paper-title">{E(topic["paper"]["title"])}</p></header><nav class="rl-module-grid" aria-label="{E(name)} 内容模块">{buttons}</nav><nav class="rl-tabs rl-algorithm-tabs" aria-label="强化学习主题">{tabs}</nav><a class="back-link rl-back" href="../index.html">{core.icon("left")} 返回强化学习</a></main>'
        write(f'notes/rl/{slug}/index.html', f'{name} · 强化学习', main)

    labels = ' · '.join(t['title'] for t in topics)
    main = f'<main class="page-main rl-main" id="main"><header class="page-heading">{crumb("../../")}<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>八股文 / 复习专题</p><h1 tabindex="-1">{E(data["title"])}</h1><p class="description">{E(labels)}</p></header><div class="rl-topline"><span>{len(topics):02d} 个主题 · 八股文 / 原理</span><span>{published} 个模块已整理</span></div><div class="rl-topics">{"".join(rows)}</div><a class="back-link rl-back" href="../index.html">{core.icon("left")} 返回八股文</a></main>'
    write('notes/rl/index.html', '强化学习', main)

    # The core builder has just generated notes/index.html; retain its LoRA card.
    path = root / 'notes/index.html'
    page = path.read_text(encoding='utf-8')
    card = f'<a class="note-card index-note rl-collection" href="../notes/rl/index.html" data-note-card data-slug="rl" data-note-kind="topic" aria-label="进入强化学习专题"><div class="note-art rl-art" aria-hidden="true"><span class="note-art-title">RL</span><span class="rl-art-caption">强化学习</span></div><div class="note-card-body"><div class="note-meta"><b class="note-category">复习专题</b><span></span><span>{len(topics)} 个主题</span></div><h3>{E(data["title"])}</h3><p>{E(labels)}</p><div class="note-tags"><span class="tag tag-neutral">八股文 / 原理 · {published} 个模块已整理</span></div></div>{core.icon("arrow", "end-arrow")}</a>'
    marker = '</div>\n<div class="zero-results"'
    if page.count(marker) != 1:
        raise ValueError('Notes layout changed; refusing an ambiguous insertion')
    page = page.replace(marker, card + marker, 1)
    page = page.replace(' 篇学习笔记</span>', ' 篇学习笔记 · 1 个专题</span>', 1)
    matches = list(re.finditer(r'(<script type="application/json" id="note-search-data">)(.*?)(</script>)', page, re.S))
    if len(matches) != 1:
        raise ValueError('Missing or ambiguous note search index')
    found = matches[0]
    search = json.loads(found.group(2))
    if any(row['slug'] == 'rl' for row in search):
        raise ValueError('Duplicate RL search entry; rebuild notes first')
    text = data['title'] + ' reinforcement learning RL 八股文 原理 论文原文 ' + labels
    text += ' ' + ' '.join(t['paper']['title'] for t in topics) + ' ' + ' '.join(published_sources)
    search.append({'slug': 'rl', 'text': text})
    serialized = json.dumps(search, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = page[:found.start(2)] + serialized + page[found.end(2):]
    page = page.replace('</head>', '<link rel="stylesheet" href="../assets/rl-notes.css">\n</head>', 1)
    page = page.replace(f'已收录 {len(core.NOTES)} 篇笔记</p>', f'已收录 {len(core.NOTES)} 篇笔记 · 1 个专题</p>', 1)
    path.write_text(page, encoding='utf-8')
    print(f'Built {len(topics)} RL hubs and {len(topics)*len(modules)} submodules; {published} published.')
