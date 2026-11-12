"""Build the dated DJI interview recap without rebuilding unrelated articles."""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent.parent
E = html.escape
PAGE = 'interviews/dji-2026-11-12.html'


def build(core):
    data = json.loads((ROOT / 'content/interviews/dji-2026-11-12.json').read_text(encoding='utf-8'))
    questions = data['questions']
    ids = [q['id'] for q in questions]
    assert len(ids) == len(set(ids)) == 12
    toc = ''.join(f'<a href="#{E(q["id"])}">{i:02d} · {E(q["title"])}</a>' for i, q in enumerate(questions, 1))
    blocks = []
    for i, q in enumerate(questions, 1):
        details = core.MD_TABLES.render(q['detail']).replace('<table>', '<div class="recap-table"><table>').replace('</table>', '</table></div>')
        sources = ' · '.join(f'<a href="{E(url, quote=True)}" target="_blank" rel="noopener noreferrer">{E(label)}</a>' for label, url in q['sources'])
        status = f'<p class="recap-status">{E(q["status"])}</p>' if q.get('status') else ''
        blocks.append(f'''<section class="recap-question" id="{q['id']}">
<div class="recap-kicker">{i:02d} / {len(questions):02d} <span>{E(q['group'])}</span></div>
<h2>{E(q['title'])}</h2>
<p class="recap-original"><strong>原题回忆</strong> {E(q['original'])}</p>{status}
<div class="recap-answer"><span class="recap-answer-label">面试口述 · 先讲这一段</span><p>{E(q['answer'])}</p></div>
<details class="recap-deep"><summary>展开原理与追问</summary><div>{details}</div></details>
<p class="recap-sources"><strong>原始资料</strong> {sources}</p>
<label class="recap-check"><input type="checkbox" data-review="{q['id']}"> 已能独立讲清这一题</label>
</section>''')
    main = f'''<main class="article-main recap-main" id="main"><article>
<header class="article-header"><nav class="breadcrumb" aria-label="面包屑"><a href="../index.html">首页</a><span>/</span><a href="./index.html">面试</a><span>/</span><span>真实复盘</span></nav>
<p class="eyebrow">2026.11.12 · AI 模型岗（图像算法方向）</p>
<h1>{E(data['title'])}</h1><p class="recap-intro">12 组亲历问题。先用一段话讲清，再展开原理接住追问。</p>
<div class="recap-topics"><span>高斯与几何 · 4</span><span>部署与量化 · 3</span><span>网络原理 · 5</span></div>
</header>
<aside class="recap-notice"><strong>记录口径</strong> 题目来自本人面试后的回忆，答案为依据原论文与官方资料整理的复习稿，不是面试官提供的标准答案。“拉夫 net”暂按 RLFN 整理并保留待确认标记；“一维高斯”已确认，具体论文未指定。</aside>
<div class="recap-toolbar"><p id="recap-progress" aria-live="polite">已复盘 0 / 12</p><div><button class="button" type="button" data-recap-expand>展开全部原理</button><button class="button" type="button" data-recap-collapse>仅看口述答案</button></div></div>
<details class="recap-mobile-toc"><summary>跳到题目 · 12 组</summary><nav aria-label="手机题目目录">{toc}</nav></details>
<div class="article-body">{''.join(blocks)}</div>
<footer class="article-end"><a class="button" href="dji-image-algorithms.html">返回考前逐题清单</a><a class="button" href="./index.html">全部面试笔记</a></footer>
</article></main>'''
    sidebar = f'<aside class="toc-sidebar recap-toc"><a href="./index.html">← 面试板块</a><p class="section-eyebrow">本次复盘</p><nav aria-label="题目目录">{toc}</nav><p class="toc-hint">复盘勾选只保存在当前浏览器。</p></aside>'
    core.shell(PAGE, data['title'], main, 'interviews', sidebar, data['description'])
    page = ROOT / PAGE
    text = page.read_text(encoding='utf-8').replace('</head>', '<link rel="stylesheet" href="../assets/interview-recap.css">\n<script src="../assets/interview-recap.js" defer></script>\n</head>')
    page.write_bytes(text.encode('utf-8'))


if __name__ == '__main__':
    import build_core
    build(build_core)
