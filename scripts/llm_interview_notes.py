"""Render numbered question-and-answer documents for the LLM interview collection."""
from __future__ import annotations
from html import unescape
import re


def build_questions(core):
    title = '大模型面经 考题1'
    source = (core.ROOT / 'content/notes/llm-interview/questions-1.md').read_text(encoding='utf-8')
    questions = re.findall(r'^## (\d+)\. (.+)$', source, re.M)
    count = len(questions)
    if not count or [int(number) for number, _ in questions] != list(range(1, count + 1)):
        raise ValueError('LLM interview questions must have continuous numbering')
    sections = []

    def heading(match):
        number = len(sections) + 1
        anchor = f'q{number}'
        label = unescape(re.sub(r'<[^>]+>', '', match.group(1)))
        sections.append((anchor, label))
        return f'<h2 id="{anchor}">{match.group(1)}</h2>'

    body = re.sub(r'<h2>(.*?)</h2>', heading, core.render_markdown(source, tables=True), flags=re.S)
    body = body.replace('<table>', '<table class="interview-table">')
    if len(sections) != count:
        raise ValueError('Question heading count changed during rendering')
    links = ''.join(f'<a href="#{anchor}">{core.ESC(label)}</a>' for anchor, label in sections)
    toc = (
        '<aside class="toc-sidebar" aria-label="文章目录">'
        f'<a class="back-link" href="../index.html">{core.icon("left")} 返回大模型面经</a>'
        f'<p class="toc-heading">考题1 · {count} 道题</p>'
        f'<nav class="toc" aria-label="题目导航">{links}</nav></aside>'
    )
    main = (
        '<main class="article-main" id="main"><article><header class="article-header">'
        '<nav class="breadcrumb" aria-label="面包屑"><a href="../../../index.html">首页</a>'
        + core.icon('chevron') + '<a href="../../index.html">八股文</a>'
        + core.icon('chevron') + '<a href="../index.html">大模型面经</a>'
        + core.icon('chevron') + '<span aria-current="page">考题1</span></nav>'
        '<p class="eyebrow"><span class="live-dot" aria-hidden="true"></span>大模型面经 / 问答整理</p>'
        f'<h1 tabindex="-1">{title}</h1>'
        '<p class="description">后训练与数据、策略优化、Agent、评测及基础原理。</p>'
        f'<div class="article-meta"><span>{count} 道题</span><span>·</span><span>含参考回答</span></div>'
        '<div class="article-toolbar"><div class="note-tags"><span class="tag">大模型</span>'
        '<span class="tag">面试问答</span></div><div class="article-actions">'
        '<a class="button" href="../../../content/notes/llm-interview/questions-1.md" download>下载题目与回答</a>'
        '<button class="button" data-copy-link type="button">复制链接</button>'
        '<button class="button" data-print type="button">打印</button></div></div></header>'
        f'<details class="mobile-toc"><summary>本篇目录 · {count} 道题</summary>'
        f'<nav class="toc" aria-label="移动端题目导航">{links}</nav></details>'
        f'<div class="article-body">{body}</div>'
        '<footer class="article-end"><span>大模型面经 考题1</span>'
        '<a class="button" href="../index.html">返回大模型面经</a></footer></article></main>'
    )
    core.shell('notes/llm-interview/questions-1/index.html', title, main, 'notes', toc=toc,
               description=f'{title}：{count} 道编号问答，涵盖 SFT、RL、数据质量、Agent、评测与模型基础。')
    output = core.ROOT / 'notes/llm-interview/questions-1/index.html'
    output.write_text(output.read_text(encoding='utf-8').replace(
        '</head>', '<link rel="stylesheet" href="../../../assets/llm-interview.css">\n</head>', 1), encoding='utf-8')
    return {'title': title, 'count': count, 'source': source}
