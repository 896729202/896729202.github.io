"""Organize preserved experiment records around a research question."""
from __future__ import annotations

import json
import re

from build_experiments import ROOT, E


TOPIC_SLUG = 'exposure-geometry'


def _text(data, key):
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f'Missing experiment topic field: {key}')
    return value


def load_topic(items):
    """Require every archived record to have exactly one narrative home."""
    path = ROOT / 'content/experiments' / f'{TOPIC_SLUG}.json'
    topic = json.loads(path.read_text(encoding='utf-8'))
    if topic.get('slug') != TOPIC_SLUG:
        raise ValueError('Invalid experiment topic slug')
    for key in ('title', 'subtitle', 'summary', 'record_range', 'question',
                'terminology', 'model_scope', 'current_conclusion'):
        _text(topic, key)
    known = {item['slug'] for item in items}
    seen, stage_ids = set(), set()
    stages = topic.get('stages')
    if not isinstance(stages, list) or not stages:
        raise ValueError('An experiment topic must contain stages')
    for stage in stages:
        stage_id = _text(stage, 'id')
        if not re.fullmatch(r'[a-z][a-z0-9-]*', stage_id) or stage_id in stage_ids:
            raise ValueError('Invalid or duplicate experiment stage ID')
        stage_ids.add(stage_id)
        for key in ('title', 'question', 'conclusion'):
            _text(stage, key)
        records = stage.get('records')
        if not isinstance(records, list) or not records:
            raise ValueError('An experiment stage must contain records')
        for slug in records:
            if not isinstance(slug, str) or slug not in known:
                raise ValueError(f'Unknown experiment topic record: {slug}')
            if slug in seen:
                raise ValueError(f'Duplicate experiment topic record: {slug}')
            seen.add(slug)
    if seen != known:
        raise ValueError(f'Ungrouped experiment records: {sorted(known - seen)}')
    writing = topic.get('writing', {})
    _text(writing, 'title')
    if not isinstance(writing.get('sections'), list) or not writing['sections']:
        raise ValueError('Missing suggested chapter sections')
    for section in writing['sections']:
        _text(section, 'title')
        _text(section, 'content')
    if not isinstance(writing.get('pending'), list) or any(
            not isinstance(text, str) or not text.strip() for text in writing['pending']):
        raise ValueError('Invalid pending evidence list')
    return topic


def folder(core, topic, items):
    return (
        f'<a class="experiment-folder experiment-topic-folder" href="{TOPIC_SLUG}/index.html">'
        '<div><span class="experiment-topic-label">研究主题</span>'
        f'<h2>{E(topic["title"])}</h2><p>{E(topic["subtitle"])}</p>'
        f'<p class="experiment-topic-meta">{len(items):02d} 份实验记录 · '
        f'{len(topic["stages"])} 个研究环节 · {E(topic["record_range"])}</p>'
        f'<span class="experiment-topic-open">查看研究脉络与实验 →</span></div>{core.icon("arrow")}</a>'
    )


def build_topic(core, topic, items):
    lookup = {item['slug']: item for item in items}
    jumps, stages = [], []
    for number, stage in enumerate(topic['stages'], 1):
        anchor = f'stage-{stage["id"]}'
        jumps.append(f'<a href="#{anchor}">{number:02d} {E(stage["title"])}</a>')
        records = []
        for slug in stage['records']:
            item = lookup[slug]
            takeaway = item.get('takeaway', item.get('summary', item['subtitle']))
            records.append(
                f'<li><a href="../{E(slug)}/index.html">'
                f'<div class="experiment-topic-record-heading"><h3>{E(item["title"])}</h3>'
                f'<time datetime="{E(item["date"])}">{E(item["date"])}</time></div>'
                f'<p>{E(takeaway)}</p><span class="experiment-topic-record-open">查看实验与指标 →</span>'
                '</a></li>'
            )
        stages.append(
            f'<section class="experiment-topic-stage" id="{anchor}" aria-labelledby="{anchor}-title">'
            f'<h2 id="{anchor}-title"><span>{number:02d}</span>{E(stage["title"])}</h2>'
            f'<p class="experiment-topic-stage-question">{E(stage["question"])}</p>'
            f'<p class="experiment-topic-stage-answer">{E(stage["conclusion"])}</p>'
            f'<ul class="experiment-topic-records">{"".join(records)}</ul></section>'
        )
    writing = topic['writing']
    sections = ''.join(
        f'<li><h3>{E(section["title"])}</h3><p>{E(section["content"])}</p></li>'
        for section in writing['sections']
    )
    pending = ''.join(f'<li>{E(text)}</li>' for text in writing['pending'])
    main = (
        '<main id="main" class="experiment-main experiment-topic">'
        '<header class="experiment-header">'
        f'<a class="back-link" href="../index.html">{core.icon("left")} 返回实验主题</a>'
        f'<p class="experiment-date">研究主题 · {len(items):02d} 份实验记录 · {E(topic["record_range"])}</p>'
        f'<h1>{E(topic["title"])}</h1><p class="experiment-subtitle">{E(topic["subtitle"])}</p>'
        f'<p class="experiment-topic-summary">{E(topic["summary"])}</p></header>'
        '<section class="experiment-topic-intro" aria-labelledby="research-question">'
        '<h2 id="research-question">核心研究问题</h2>'
        f'<p class="experiment-topic-question">{E(topic["question"])}</p>'
        '<div class="experiment-topic-scope">'
        f'<div><h3>优化方式</h3><p>{E(topic["terminology"])}</p></div>'
        f'<div><h3>模型与研究范围</h3><p>{E(topic["model_scope"])}</p></div></div>'
        '<div class="experiment-conclusion"><h3>当前证据支持的结论</h3>'
        f'<p>{E(topic["current_conclusion"])}</p></div></section>'
        '<nav class="experiment-jump experiment-topic-jump" aria-label="研究环节">'
        '<span>按研究问题阅读 · 记录日期保留在各项实验中</span>'
        f'{"".join(jumps)}</nav>{"".join(stages)}'
        '<details class="experiment-topic-writing"><summary>论文章节建议与待补证据</summary>'
        f'<h2>{E(writing["title"])}</h2><ol class="experiment-topic-outline">{sections}</ol>'
        '<h3>还需补齐的证据</h3>'
        f'<ul class="experiment-topic-pending">{pending}</ul></details>'
        '<footer class="experiment-source">按研究问题归类现有实验；记录日期、原始指标及下载资料保留在各实验页。'
        '本页为研究脉络与写作提纲，结论范围以对应实验的协议和对照为准。</footer></main>'
    )
    core.shell(f'thesis/experiments/{TOPIC_SLUG}/index.html', topic['title'], main,
               'thesis', toc='', description=topic['summary'])
