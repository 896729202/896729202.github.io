"""Publish audited D4RT results with explicit target-label reuse and renderer controls."""
from __future__ import annotations

import hashlib
import json
import re
from html import escape as esc

from experiment_summaries import table


def section(anchor, number, title, body):
    return (f'<section class="experiment-block" id="{anchor}">'
            f'<h2><span>{number:02d}</span>{esc(title)}</h2>{body}</section>')


def psnr_table(rows, caption):
    return table(['数据集', '目标 / 序列', 'A 网格基线', 'B 新渲染·冻结',
                  'C 新渲染·选中参数', 'C − B', 'D 外观记忆'], [
        [r['dataset'], f"{r['frames']} / {r['sequences']}",
         f"{r['baseline_D4RT_renderer_PSNR']:.2f}", f"{r['frozen_new_renderer_PSNR']:.2f}",
         f"{r['native_parameters_new_renderer_PSNR']:.2f}" + (' †' if r['native_best_step'] == 0 else ''),
         f"{r['native_delta_vs_frozen_renderer']:+.2f}", f"{r['appearance_memory_PSNR']:.2f}"]
        for r in rows], caption)


def build(core):
    source = core.ROOT/'content/d4rt'
    data = json.loads((source/'overview.json').read_text(encoding='utf-8'))
    rows = data['results']
    public = [r for r in rows if r['data_group'] == 'Public']
    synthetic = [r for r in rows if r['data_group'] == 'Synthetic-control']
    assert len(public) == 7 and sum(r['frames'] for r in public) == 1112
    assert len(synthetic) == 1 and synthetic[0]['frames'] == 138
    assert all(r['benchmark_valid'] is False for r in rows)
    for f in data['files']:
        assert hashlib.sha256((source/f['name']).read_bytes()).hexdigest() == f['sha256']

    header = ('<main class="experiment-main d4rt-main" id="main">'
              '<header class="experiment-header">'
              f'<a class="back-link" href="../index.html">{core.icon("left")} 返回实验主题</a>'
              '<p class="experiment-date"><time datetime="2026-11-09">2026-11-09</time> · D4RT 专题 · 本轮未使用 GRPO</p>'
              f'<h1>{esc(data["title"])}</h1>'
              '<p class="experiment-topic-summary">直接用测试目标训练，再在同一批目标上测量：'
              '新增外观记忆使 7 个公共数据集的平均 PSNR 达到 29.17–32.36 dB；'
              '参数微调路线仍未在这些数据集上全面达到 28 dB。</p>'
              '<div class="d4rt-status"><strong>测试目标参与训练与选优</strong>'
              '<span>这些是过拟合诊断结果，不是独立测试成绩。预测时不用目标 RGB，不代表训练时没见过目标。</span></div>'
              '</header>')
    nav = '<nav class="experiment-jump" aria-label="D4RT 专题目录">'+''.join(
        f'<a href="#{anchor}">{title}</a>' for anchor, title in [
            ('protocol', '01 四种结果口径'), ('renderers', '02 两种渲染方式'),
            ('results', '03 指标与对照'), ('diagnosis', '04 低分原因'), ('scope', '05 范围与复核')])+'</nav>'

    protocol = ('<p>本页使用非官方 OpenD4RT 实现。模型原生输出几何与跟踪信息，'
                '下面的 PSNR 衡量的是附加的 RGB 渲染链路，不是 D4RT 论文的官方原生图像指标。</p>'
                '<div class="d4rt-methods">'
                '<article><h3><span class="d4rt-letter">A</span>预训练参数＋网格渲染</h3>'
                '<p>本轮不更新 D4RT 参数。用上下文预测深度，构建三角网格并投影贴图，得到目标图像。</p>'
                '<p class="d4rt-label">本轮未微调的渲染基线</p></article>'
                '<article><h3><span class="d4rt-letter">B</span>预训练参数＋新渲染器</h3>'
                '<p>仍不更新模型参数，先测更换渲染器后的起点。残差位移初始为零，因此是两张上下文图按时间混合的基线。</p>'
                '<p class="d4rt-label">与 C 配对，衡量训练增量</p></article>'
                '<article><h3><span class="d4rt-letter">C</span>参数微调＋新渲染器</h3>'
                '<p>用这批测试目标 RGB 作为训练标签和选优依据；冻结编码器，训练查询嵌入、解码器和 XYZ 头。再评估同一批目标。</p>'
                '<p class="d4rt-label">测试集过拟合 · 参数与渲染器都需标注</p></article>'
                '<article><h3><span class="d4rt-letter">D</span>新增外观记忆</h3>'
                '<p>固定 A 的输出，每个目标单独学习 RGB 残差网格；按目标身份查询记忆并加回 A。它没有接在 C 后面，也不是原生 D4RT 参数微调。</p>'
                '<p class="d4rt-label">测试集过拟合 · 新增逐目标记忆模块</p></article></div>'
                '<p>所以，“直接预测测试集”需要区分：A、B 是本轮未微调参数的基线；C、D 已使用目标标签训练。'
                'C、D 推理时不再读取目标 RGB，但测试目标的信息已经进入权重或记忆。</p>'
                '<p class="experiment-note">Hamlyn 的 A 沿用历史估计相机，那个相机估计步骤使用过目标 RGB；'
                '渲染纹理仍来自上下文。不能把它称为严格无目标信息的评测。预训练基线也不代表已核验上游预训练数据与本地数据完全无重叠。</p>')

    renderers = ('<div class="d4rt-pipelines">'
                 '<article><h3>网格渲染：先建三维表面，再投影</h3>'
                 '<ol><li>从两张上下文图预测深度。</li><li>用内参反投影为三维点，连接成三角面片。</li>'
                 '<li>用外部提供或估计的相机位姿投影到目标视角。</li>'
                 '<li>按深度处理遮挡并贴上上下文颜色；没有覆盖的像素留黑。</li></ol></article>'
                 '<article><h3>新渲染器：反向采样上下文颜色</h3>'
                 '<ol><li>由两张上下文图构造时间插值代理，不输入真实目标图。</li>'
                 '<li>把 D4RT 跨时 XYZ 投影相对冻结模型的变化转成二维位移。</li>'
                 '<li>对目标像素，反向查找两张上下文图上的颜色。</li>'
                 '<li>插值并按时间混合；越界采样使用边缘填充。</li></ol></article></div>'
                 '<p>两者的相机使用、遮挡处理和空洞行为不同。A → C 的变化同时包含换渲染器和训练；'
                 'C − B 才是在新渲染器内的配对训练增量。较高 PSNR 本身不能证明三维几何更准确。</p>'
                 '<details class="d4rt-detail"><summary>新渲染器与外观记忆的实现边界</summary>'
                 '<p>新渲染器输入为［上下文 0、上下文插值代理、上下文 1、上下文 1］。'
                 '二维采样位置是 identity grid 加相对冻结预测的有界残差，最大约 31.875 像素；'
                 '64×64 位移网格插值到 256×256。它是本次新增的残差反向渲染器，不是官方 D4RT 的 RGB 解码头。</p>'
                 '<p>外观记忆的残差网格从零初始化，用 Adam 对每个目标优化 300 步。'
                 '先试 64×64，均值不足 28 时再试 128×128；SCARED 预设的 192 追加条件未触发。'
                 '较低容量版本也保留。这个已测容量结果不是数学意义上的上限。</p></details>')

    results = ('<p><strong>PSNR 越高越好，单位 dB。</strong>全部列使用同一组目标、256×256 PNG 全帧计分。'
               '不混排不同协议的名次；合成对照单列。窄屏可横向滑动表格。</p>'+psnr_table(public, '7 个公共数据集 · 1112 目标 / 96 序列')+
               '<p class="experiment-note">† C3VD、EndoSLAM 的选中权重为第 0 步。'
               '选优没有选中训练后的权重；C 等于 B，不能把相对 A 的提高记作训练收益。</p>'+
               psnr_table(synthetic, '自生成合成对照 · 138 目标 / 14 版本，不作为公共数据集排名')+
               '<p class="experiment-note">合成对照含原 test 108、实际曝光 val 24、无正式划分的 smoke 自检 6；'
               '14 个版本不是 14 个独立公共数据集。B 已达 47.86 dB，不能用合成高分替代公共内镜数据上的证据。</p>')
    results += ('<details class="d4rt-detail"><summary>SSIM、LPIPS 与逐帧达标情况</summary>'+table(
        ['数据集', 'C SSIM ↑', 'C LPIPS ↓', 'D SSIM ↑', 'D LPIPS ↓', 'D ≥28 帧数', 'D 最低 PSNR'], [
            [r['dataset'], f"{r['native_SSIM']:.4f}", f"{r['native_LPIPS_squeeze']:.4f}",
             f"{r['appearance_memory_SSIM']:.4f}", f"{r['appearance_memory_LPIPS_squeeze']:.4f}",
             f"{r['appearance_memory_frames_at_least_28']} / {r['frames']}", f"{r['appearance_memory_min_frame_PSNR']:.2f}"]
            for r in rows], 'C 与 D 的辅助指标 · LPIPS-SqueezeNet v0.1')+
        '<p>7 个公共数据集的 D 均值都超过 28，不代表每帧达标。EndoSLAM 为 462/742 帧达标，最低 15.47 dB。</p></details>')
    results += ('<details class="d4rt-detail"><summary>训练预算、检查点选择与同目标历史对照</summary>'+table(
        ['数据集', '训练步数', '选中步数', 'D 网格'], [
            [r['dataset'], r['native_training_steps'], r['native_best_step'], f"{r['appearance_memory_grid']}×{r['appearance_memory_grid']}"]
            for r in rows], 'C 的训练与选优；D 各网格独立训练 300 步')+
        '<p>常规 C 用每序列最多两个固定目标选优，随后评估全量；不保证全量最优。StereoMIS 的全帧损失对照用全部 36 目标选优：'
        '600 步中选第 200 步，27.5779 dB；常规版本为 27.4785 dB，冻结起点为 27.4435 dB。'
        '对照还改变了正则、选优范围和运行环境，不能把差值严格归因于单一变量。</p>'
        '<p>SCARED 主表已扩为 142 目标 / 12 序列，包含 d3_k1 以及 d2、d4 各四个序列。'
        '旧 24.7047 dB 对应 34 目标 / 3 序列，不能直接与主表相减。'
        '固定旧 34 目标时，当前 A 为 24.7063、扩集训练后的 C 为 21.2980、D 为 28.7579 dB，C 并未全面改善。</p>'
        '<p><a href="matched-legacy.csv" download>下载原 1004 目标的同集合前后对照 CSV ↓</a></p></details>')

    diagnosis = ('<p>这些控制实验解释现有渲染链路的误差，不把读取目标真值的诊断当作可泛化方法。</p>'+table(
        ['检查项', '观察', '能说明什么'], [
            ['mask 与 GT_mask', 'EndoNeRF：全帧 23.206；mask 26.134；GT_mask 25.851。EC 两种 mask 均约 13.59。',
             'EndoNeRF 两种 mask 相差约 0.283 dB；掩码口径影响分数，但解释不了 EC 的整体低分。'],
            ['曝光失配', 'EC 原输出做逐通道 GT 仿射亮度拟合：13.006 → 24.816 dB。',
             '支持存在显著光度误差。拟合使用目标 GT，仅作为诊断。'],
            ['覆盖空洞', 'StereoMIS 仅用上下文均值补黑洞：23.062 → 26.509 dB；一个全黑输出为 6.398 dB。',
             '原网格渲染的空洞会实质拉低全帧 PSNR。'],
            ['旧训练与渲染脱节', '旧三帧输入的第三帧未被时间下采样编码；旧跨时 XYZ 训练未进入 self-depth 刚性贴图。',
             '旧 clean/leak 相同不能证明训练无效。该旧实验不进入本页最终表。'],
            ['宽高比', '修正 SCARED、StereoMIS、Hamlyn 后，同旧目标分数变化均小于 0.007 dB。',
             '本次前后对照未显示显著改善；历史运行环境未完全核实，不作为纯宽高比因果消融。']
        ], '固定旧目标集的诊断控制；不与扩展集主表混算', trials=True)+
        '<p>当前方向是让跨时对应进入渲染、处理曝光和遮挡，并使用匹配的光度训练目标。'
        '本轮不使用 GRPO；新增外观记忆只证明允许记住这些目标后可取得高分，未证明几何或新场景泛化改善。</p>')

    downloads = '<div class="d4rt-downloads">'+''.join(
        f'<a class="experiment-download" href="{name}" download>{core.icon("download")} {label}</a>'
        for name, label in [('results.csv', '数据集指标 CSV'), ('per-sequence.csv', '逐序列 CSV'),
                            ('per-frame.csv', '逐目标 CSV'), ('summary.json', '协议与来源摘要 JSON')])+'</div>'
    scope = ('<p>共 1250 目标 / 110 序列：公共数据 1112 / 96，合成对照 138 / 14。'
             '这是本轮已定义的抽帧协议，不是磁盘全部原始视频帧。空素材目录、单帧快照、'
             '缺少可靠相机对应的 SCARED test8/9 和尚未核对图像—位姿对应的 EndoSLAM UnityCam 未纳入。</p>'
             '<p>主指标：RGB 归一到 [0,1]，全帧 MSE 后计算逐帧 PSNR；先对同序列帧平均，再对数据集内各序列等权。'
             '不按方法各自的 coverage、mask 或 GT_mask 筛选，也不是把全数据 MSE 合起来再取一次对数。</p>'
             '<p>1250 个目标的 PNG 分数均独立复算，并核对目标对应、样本集合、权重哈希和聚合方式。'
             '每组原生权重至少一个新进程重载样例通过；StereoMIS 全帧版本额外通过全部 36 帧逐像素复核。'
             '最终外观记忆版本全部 1250 帧均通过权重重载验证。</p>'
             '<p>常规参数训练和早期外观记忆使用 PyTorch 2.4；StereoMIS 全帧版本、修正网格基线和修正版外观记忆使用 2.5.1。'
             '跨版本首次重载曾出现像素差异，同训练环境复核后完全一致。精确复现应匹配各自环境。</p>'
             '<p>权重按数据集保存：原生参数的 best / last、优化器、冻结参考位移，以及外观记忆网格分别归档。'
             '本页提供指标与协议下载，模型权重保存在实验工作区。</p>'+downloads+
             '<p class="experiment-note">来源：2026-11-09 已完成并核验的实验归档。公开文件只含数值和方法摘要；'
             '本次网页更新没有新增训练。<a href="https://github.com/Lijiaxin0111/Open-d4rt" target="_blank" rel="noopener noreferrer">OpenD4RT 实现 →</a></p>')

    main = header+nav+''.join(section(*args) for args in [
        ('protocol', 1, '四种结果，不同的信息使用方式', protocol),
        ('renderers', 2, '网格渲染与新渲染器有什么区别', renderers),
        ('results', 3, 'PSNR 与过拟合结果', results),
        ('diagnosis', 4, '为什么原来的 PSNR 较低', diagnosis),
        ('scope', 5, '数据范围、复核与下载', scope)])+'</main>'
    path = 'thesis/experiments/d4rt/index.html'
    core.shell(path, data['title'], main, 'thesis', toc='', description=data['summary'])
    output = core.ROOT/path
    text = output.read_text(encoding='utf-8').replace('</head>', '<link rel="stylesheet" href="../../../assets/d4rt-experiments.css">\n</head>', 1)
    output.write_text(text, encoding='utf-8')
    for f in data['files']:
        (output.parent/f['name']).write_bytes((source/f['name']).read_bytes())
    (output.parent/'summary.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

    for page_path, href in [('thesis/experiments/index.html', 'd4rt/index.html'),
                            ('thesis/index.html', 'experiments/d4rt/index.html')]:
        target = core.ROOT/page_path
        page = target.read_text(encoding='utf-8')
        page = re.sub(r'<a\b[^>]*data-d4rt-column[^>]*>.*?</a>', '', page, flags=re.S)
        card = (f'<a class="experiment-folder experiment-topic-folder" data-d4rt-column href="{href}">'
                '<div><span class="experiment-topic-label">D4RT 专题 · 2026-11-09</span>'
                '<h2>D4RT：渲染诊断与测试集过拟合</h2>'
                '<p>网格渲染、新渲染器与外观记忆：区分冻结基线、测试集微调和记忆容量。</p>'
                '<p class="experiment-topic-meta">7 个公共数据集 · 1112 个目标 · 另有 138 个合成对照目标</p>'
                f'<span class="experiment-topic-open">查看实验口径与完整指标 →</span></div>{core.icon("arrow")}</a>')
        pos = page.index('</header>', page.index('<main '))+len('</header>')
        page = page[:pos]+card+page[pos:]
        page = re.sub(r'(<a\b[^>]*data-grpo-column[^>]*>)(.*?)(</a>)', lambda m:
            m[1]+m[2].replace('GRPO 专栏</span>', 'GRPO 历史记录</span>').replace(
                '查看实验、结论与下一步 →', '查看已停止追加训练的历史记录 →')+m[3], page, flags=re.S)
        target.write_text(page, encoding='utf-8')
    archive = core.ROOT/'thesis/experiments/grpo/index.html'
    page = archive.read_text(encoding='utf-8')
    page = re.sub(r'<aside\b[^>]*data-d4rt-archive[^>]*>.*?</aside>', '', page, flags=re.S)
    banner = ('<aside class="experiment-conclusion" data-d4rt-archive><h2>历史路线：已停止追加 GRPO 训练</h2>'
              '<p>以下保留截至 2026-10-18 的实验与当时计划。2026-11-09 的渲染诊断、参数过拟合和外观记忆实验均不使用 GRPO。'
              '<a href="../d4rt/index.html">查看最新 D4RT 专题 →</a></p></aside>')
    pos = page.index('</header>', page.index('<main '))+len('</header>')
    archive.write_text(page[:pos]+banner+page[pos:], encoding='utf-8')
    print('Built D4RT column: 8 groups, 1250 targets; test-label reuse explicit.')


if __name__ == '__main__':
    import build_core
    import build_experiments
    build_experiments.configure(build_core)
    build(build_core)
