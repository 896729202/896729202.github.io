"""One-time, guarded LoRA review update. Run from the repository root."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path.cwd()
PAYLOAD = Path(__file__).resolve().parent

def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

expected = {
    'content/notes/lora.md': '48348e4d8c7569debd833bc358b047dd5d3d7c53',
    'content/notes/index.json': 'b8dde6f62baa1ac16b35c7ecbc37e51ecaf3da4a',
    'scripts/build_core.py': '8c95dfc32cd29f7a12065ba1c9035977aa927699',
}
for name, sha in expected.items():
    assert blob((ROOT / name).read_bytes()) == sha, f'Concurrent edit: {name}'

p = ROOT / 'content/notes/lora.md'
s = p.read_text()
changes = [
    ('- **梯度（Gradients）**：反向传播导数。FP16/BF16 下，每个参数吃 **2 字节**。',
     '- **梯度（Gradients）**：可训练参数的反向传播导数。按 FP16/BF16 存储时每个参数 **2 字节**；实际 dtype 不一定等于底座权重 dtype。'),
    ('- **优化器状态（Optimizer States）**：AdamW 需要保存 **FP32 权重备份、一阶动量、二阶动量**，每个参数吃 $4 + 4 + 4 = \\mathbf{12\\text{ 字节}}$。',
     '- **优化器状态（Optimizer States）**：两份 FP32 动量合计 **8 字节/可训练参数**；若训练框架另存 FP32 主权重，再加 4 字节，此时合计 $4 + 4 + 4 = \\mathbf{12\\text{ 字节}}$。并非所有 AdamW 实现都额外保存主权重。'),
    ('每一层前向传播算出的中间特征图，随 Batch Size 和序列长度平方级暴涨；可通过梯度检查点（Gradient Checkpointing）压到极低。',
     '前向中间结果及分配器开销。激活通常随 Batch Size 近似线性增加；朴素注意力矩阵随序列长度平方增长，但 FlashAttention 避免完整存储它。梯度检查点用重计算换空间，不会消除所有激活。'),
    ('- **静态显存计算公式（全量微调，16-bit + AdamW）**：',
     '- **静态显存示例（全量微调：16-bit 权重和梯度、FP32 双动量及主权重）**：'),
    ('**$A$ 设为高斯分布随机数**：保留高维数据降维投影的多样性，打破反向传播的梯度对称性死锁。',
     '**$A$ 随机初始化**：原论文使用高斯随机；PEFT 默认使用 Kaiming-uniform。关键是不能将 A、B 同时设零，否则两者的损失梯度都会为零。'),
    ('初始化时，$A$ 采用高斯随机初始化，$B$ 采用全 0 初始化。',
     '常规初始化时，$A$ 随机、$B$ 全零；原论文使用高斯随机 A，PEFT 默认使用 Kaiming-uniform。'),
    ('随后两者协同自激更新。', '随后两者共同学习。'),
    ('格式对齐、分类、简单问答等通用任务，$r=8 \\sim 16$ 足够好；复杂推理、代码或大规模领域垂直注入，通常尝试 $r=32 \\sim 64$。',
     '格式对齐、分类、简单问答等任务可从 $r=8 \\sim 16$ 起步；复杂任务可再尝试 $r=32 \\sim 64$，最终由验证集决定。'),
    ('无脑设置过大的 rank 会导致在小样本上严重**过拟合**，并且削弱低秩约束，引发原模型的**灾难性遗忘**。',
     '增大 rank 会增加容量、参数量和训练开销；是否过拟合或遗忘，还取决于数据、学习率和训练时长，不能只由 rank 判定。'),
    ('其核心作用有两点：第一是控制微调知识对原模型的**介入强度**；第二是**解耦 Rank 与学习率（尺度不变性）**，让不同 rank 尝试时无需重新精细搜索学习率。',
     '它控制低秩分支的缩放幅度，也影响梯度尺度；固定比例便于对比，但**不保证换 rank 后学习率无需重调**。'),
    ('训练显存开销的最大头不是静态模型文件本身，而是 **AdamW 优化器状态（占 12 字节/参数）与梯度（占 2 字节/参数）**。',
     '全量训练除了权重，还要为可训练参数保存梯度和优化器状态；这些是显著开销，但长序列下激活也可能成为主要开销。'),
    ('（比如 8B 模型仅静态就需要 128GB）', '（按模块一的示例口径，8B 静态开销约 128GB）'),
    ('原权重不计算、不保存任何梯度与动量。',
     '从训练开始就冻结且梯度为 None 的底座参数，不累积权重梯度，也不为其新建 AdamW 动量；但反向传播仍可能穿过冻结层，传向可训练的 LoRA。'),
    ('可训参数占比通常低于 0.5%，因此原本极其庞大的优化器与梯度显存被砍掉了 99% 以上。',
     '将梯度和状态的主要开销缩小到适配器规模；具体占比取决于 rank、挂载层和额外可训练模块，不是固定低于 0.5%。'),
    ('**全量微调绝对不行**', '**标准 AdamW、训练状态全部驻卡：不行**'),
    ('加上激活值直接突破 140GB，24G 单卡会立即 OOM，至少需要两张 80G A100/H100。',
     '这一示例静态预算已超过 24GB，尚未计入激活；卸载、分片或其他优化器是另外的方案，不能据此固定推断至少需要几张卡。'),
    ('**LoRA 微调可以胜任**', '**LoRA：合适配置下可能可行，要实测峰值**'),
    ('原模型冻结仅占 16GB 权重，LoRA 的梯度与优化器只需几百 MB，加上开启重计算后的激活值（约 2～3GB），总显存可稳定在 **18～20 GB** 左右，正好放进 24G 显存内。',
     '按约 8B 参数估算，16-bit 底座权重约 16GB；剩余空间要容纳适配器、梯度、状态、激活和缓存。小 batch、短序列与检查点有助于放入 24GB，**18～20GB 不是通用保证**。'),
    ('Self-Attention 显存是序列长度的平方阶（$O(L^2)$），截短上下文能立竿见影释放显存。',
     '朴素注意力矩阵占用为 $O(L^2)$；采用 FlashAttention 等实现后不能把全部激活一概按平方估算。缩短上下文仍通常可以降低显存。'),
    ('8B 基础权重直接从 16GB 缩减到 5GB 左右，整套训练能直接压到 10GB 显存以内。',
     '8B 的纯 4-bit 编码约 4GB，另有量化元数据及未量化层；总训练显存仍取决于激活与配置，不能保证低于 10GB。'),
]
for old, new in changes:
    assert s.count(old) == 1, f'Unexpected note text: {old[:45]}'
    s = s.replace(old, new, 1)
s += (PAYLOAD / 'appendix.md').read_text()
s += '\n补充核对：[FlashAttention 的显存机制](https://arxiv.org/abs/2205.14135)。以上显存按十进制 GB / MB 估算，不等同于 GiB / MiB。\n'
p.write_text(s)

p = ROOT / 'content/notes/index.json'
notes = json.loads(p.read_text())
note = next(n for n in notes if n['slug'] == 'lora')
note['summary'] = '核心原理、显存估算与六道面试问答，补充 LoRA 配置、梯度自检和 AdamW 源码纠错。'
note['updated'] = '2026-10-05'
note['modules'] = 3
p.write_text(json.dumps(notes, ensure_ascii=False, indent=2) + '\n')

p = ROOT / 'scripts/build_core.py'
s = p.read_text()
patches = [
    ("date = note['date'].replace('-', '.')", "display_date = note.get('updated', note['date'])\n    date = display_date.replace('-', '.')"),
    ('''<time datetime="{note["date"]}">{date}</time>''', '''<time datetime="{display_date}">{date}</time>'''),
    ("['核心知识与底层原理', '高频面试问答'][modules-1] if slug == 'lora' and modules <= 2", "['核心知识与底层原理', '高频面试问答', '实操速记与源码追问'][modules-1] if slug == 'lora' and modules <= 3"),
    ("y, m, d = note['date'].split('-')", "display_date = note.get('updated', note['date'])\n    date_label = '更新于 ' if note.get('updated') else ''\n    y, m, d = display_date.split('-')"),
    ('''<time datetime="{note['date']}">{y} 年 {int(m)} 月 {int(d)} 日</time>''', '''<time datetime="{display_date}">{date_label}{y} 年 {int(m)} 月 {int(d)} 日</time>'''),
    ("    body = re.sub(r'<h([23])>(.*?)</h\\1>', heading, body, flags=re.S)",
     "    body = re.sub(r'<h([23])>(.*?)</h\\1>', heading, body, flags=re.S)\n    body = body.replace('<pre>', '<pre tabindex=\"0\" aria-label=\"代码示例；窄屏可横向滚动\">')"),
    ("    output = ROOT / path\n", "    if path == 'notes/lora/index.html':\n        result = result.replace('</head>', '<link rel=\"stylesheet\" href=\"../../assets/lora-practice.css\">\\n</head>')\n    output = ROOT / path\n"),
    ("    shell(f'notes/{slug}/index.html', note['title'], main, 'notes', toc, note['summary'])",
     "    if slug == 'lora':\n        main = re.sub(r'<aside class=\"original-notice\".*?</aside>', '<aside class=\"original-notice\" aria-label=\"笔记口径说明\"><strong>复习提示</strong> · 参数建议是起点，显存估算须注明精度与实现；代码为核心片段，不是实测结果。<a href=\"#module-3\">新增：LoRA 实操速记与源码追问 →</a></aside>', main, count=1, flags=re.S)\n    shell(f'notes/{slug}/index.html', note['title'], main, 'notes', toc, note['summary'])"),
]
for old,new in patches:
    assert s.count(old) == 1, f'Unexpected build code: {old[:65]}'
    s = s.replace(old,new,1)
p.write_text(s)
(ROOT / 'assets/lora-practice.css').write_bytes((PAYLOAD / 'lora-practice.css').read_bytes())
print('Updated LoRA source, metadata, scoped code style and article rendering.')
