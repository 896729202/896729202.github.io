"""Publish verified 2026-11-17 supplements without changing historical rankings."""
from __future__ import annotations
import json
from html import escape
from pathlib import Path

SOURCE = 'legacy-20261117'
STAGES = {'3000_step_screening': '3000 步初筛', 'full_100k_budget': '10 万步终点',
          'intermediate_snapshot': '中间检查点'}
LABELS = {'StereoBM': 'StereoBM', 'StereoSGBM': 'StereoSGBM', 'ELAS': 'ELAS · 双目模块',
          'SuPer_sgbm': 'SuPer 后端 + SGBM', 'SuPer_elas': 'SuPer 后端 + ELAS'}


def e(value):
    return escape(str(value), quote=True)


def table(headers, rows, caption, kind):
    head = ''.join(f'<th scope="col">{e(value)}</th>' for value in headers)
    return (f'<div class="rk-table-wrap" role="region" tabindex="0" aria-label="{e(caption)}；可横向滚动">'
            f'<table class="rk-table legacy-table" data-legacy-table="{kind}"><caption>{e(caption)}'
            '<span>左右滑动查看完整指标 →</span></caption>'
            f'<thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def metric(value, key, places):
    return f'<td data-legacy-metric="{key}" data-value="{value}" title="实测原值：{value}">{value:.{places}f}</td>'


def render(root):
    source = root/'content/experiments'/SOURCE
    data = json.loads((source/'summary.json').read_text())
    if data['schema_version'] != 1:
        raise ValueError('Unsupported legacy metric schema')
    output = root/'thesis/experiments/reproductions/data'/SOURCE
    output.mkdir(parents=True, exist_ok=True)
    for filename in ['summary.json', *data['files']]:
        if Path(filename).name != filename:
            raise ValueError('Invalid export filename')
        (output/filename).write_bytes((source/filename).read_bytes())
    methods = {item['name']: item for item in data['methods']}
    body = ('<section class="legacy-supplement" id="legacy-20261117" aria-labelledby="legacy-title">'
            '<div class="legacy-heading"><p class="legacy-kicker">2026-11-17 · 新增实测</p>'
            '<h2 id="legacy-title">早期方法：PSNR、SSIM 与 LPIPS</h2>'
            '<p class="rk-note">新增 NeRF、D-NeRF、EndoNeRF、EndoSurf，以及传统双目和 SuPer 几何后端。'
            '以下数值来自实际渲染与参考图像；训练预算、评价区域和 LPIPS 网络随表注明。</p></div>'
            '<div class="latest-stats legacy-stats"><span><strong>4</strong> 种留出帧方法</span>'
            '<span><strong>9</strong> 组留出结果</span><span><strong>5</strong> 组重投影结果</span></div>'
            '<nav class="legacy-nav" aria-label="新增结果导航"><a href="#legacy-heldout">留出帧</a>'
            '<a href="#legacy-stereo">立体重投影</a><a href="#legacy-depth">深度模块</a>'
            '<a href="#latest-comparison">原七数据集表</a></nav>'
            '<p class="legacy-protocol-note">本次采用 LPIPS-AlexNet v0.1。下方原七数据集表采用 '
            '256×256 全图与 LPIPS-SqueezeNet v0.1，指标口径不同，新增结果不混入原表排名。</p>'
            '<section id="legacy-heldout" class="legacy-result-section"><h3>EndoNeRF 数据集 · 留出帧渲染</h3>'
            '<p class="rk-note">统一 test=1::8：pulling 8 帧、cutting 20 帧。使用官方组织掩膜内完整 '
            '64×64 块，逐块后逐帧平均；SSIM 为 11×11 高斯窗口，LPIPS 为 AlexNet v0.1。</p>')
    rows = []
    for row in data['heldout']:
        method = methods[row['method']]
        cells = (f'<th scope="row"><a href="{e(method["source"])}">{e(row["method"])}</a>'
                 f'<small>{method["year"]} · {"通用网络适配" if row["method"] in ("NeRF", "D-NeRF") else "内窥镜方法"}</small></th>'
                 f'<td>{e(row["scene"])}</td><td>{row["checkpoint_iteration"]:,}'
                 f'<small>{e(STAGES[row["phase"]])}</small></td><td>{row["test_frames"]}</td>')
        for key, label, places in [('block_psnr','psnr',3),('block_ssim','ssim',5),('block_lpips_alex','lpips',5)]:
            cells += metric(row[key], label, places)
        rows.append(f'<tr data-legacy-heldout="{e(row["method"])}" data-scene="{e(row["scene"])}" '
                    f'data-iteration="{row["checkpoint_iteration"]}">{cells}</tr>')
    body += table(['方法','场景','迭代 / 状态','测试帧','PSNR ↑ / dB','SSIM ↑','LPIPS ↓'], rows,
                  '9 组已完成评测 · 有效组织块', 'heldout')
    body += ('<p class="rk-table-note">3000 步为初筛，不能视为充分收敛；EndoNeRF 同时保留初筛和 10 万步结果。'
             'EndoSurf 为 66000 步中间检查点，本次尚无 cutting 完成结果。不同预算不作等预算排名。'
             '下载表另含全组织 PSNR；测试帧、掩膜像素数、块数和逐帧均值已经核对。</p></section>'
             '<section id="legacy-stereo" class="legacy-result-section"><h3>SCARED · 立体重投影诊断</h3>'
             '<p class="legacy-protocol-note">目标右图参与了双目深度估计，以下是立体重投影成绩，'
             '不能与独立留出帧成绩直接排名。ELAS 仅为双目模块，SuPer 为几何后端适配。</p>'
             '<p class="rk-note">同一 61 对工程子集、4 条序列；左图或融合颜色按双目标定投影至右图。'
             '统一 256×320 全图、LPIPS-AlexNet v0.1；未覆盖区域保留黑色并计入图像误差。'
             '序列内逐帧等权、序列间等权；d4 仅 1 帧，占汇总权重的 25%。</p>')
    rows = []
    for row in data['stereo']:
        cells = f'<th scope="row">{e(LABELS[row["method"]])}</th><td>{row["frames"]}</td>'
        cells += metric(row['full_psnr'], 'psnr', 3)
        cells += metric(row['full_ssim'], 'ssim', 5)
        cells += metric(row['full_lpips_alex'], 'lpips', 5)
        cells += f'<td data-legacy-coverage="{row["coverage"]}">{row["coverage"]:.2%}</td>'
        rows.append(f'<tr data-legacy-stereo="{e(row["method"])}">{cells}</tr>')
    body += table(['方法 / 模块','图像对','PSNR ↑ / dB','SSIM ↑','LPIPS ↓','渲染覆盖率'], rows,
                  '5 组已完成评测 · 全图与实际空洞', 'stereo')
    body += ('<p class="rk-table-note">这些图像分数受几何、颜色融合、固定点渲染器和覆盖率共同影响。'
             '所有 split 与 305 条逐帧记录均可下载；无按测试分数选帧、拟合颜色或用目标图填洞。</p></section>'
             '<details class="rk-details" id="legacy-depth"><summary>已完成的深度模块 · RGB 指标缺项说明</summary>'
             '<div class="rk-detail-body"><p class="rk-note">SAGE 深度先验与 Monodepth2 各完成 412 帧深度评测。'
             '本次没有相应的独立留出 RGB 渲染实验，PSNR / SSIM / LPIPS 标为 N/A，不由深度误差换算。'
             'SAGE 的零编码深度先验不能标成完整 SAGE-SLAM 复现。</p>')
    rows = []
    for row in data['depth_components']:
        item = methods[row['method']]
        rows.append(f'<tr data-legacy-depth="{e(row["method"])}"><th scope="row"><a href="{e(item["source"])}">'
                    f'{e(row["method"])}</a><small>{row["year"]} · 深度模块</small></th><td>{row["frames"]}</td>'
                    '<td>N/A</td><td>N/A</td><td>N/A</td></tr>')
    body += table(['方法 / 模块','深度评价帧','PSNR','SSIM','LPIPS'], rows, '深度模块记录 · 尚无留出 RGB 指标', 'depth')
    body += ('<p class="rk-table-note">深度 CSV 保留 AbsRel、RMSE 与 δ1。C3VD / SCARED 使用实测深度；'
             'EndoNeRF / EC 只评价与 DAM 伪深度的一致性。中位数尺度对齐仅用于深度评价。</p></div></details>'
             '<section class="legacy-result-section" id="legacy-downloads"><h3>下载新增实测数据</h3>'
             '<div class="rk-footer-links">')
    for filename, label in [('heldout.csv','留出帧汇总 CSV'),('heldout-per-frame.csv','留出帧逐帧 CSV'),
                            ('stereo.csv','立体重投影汇总 CSV'),('stereo-per-frame.csv','重投影逐帧 CSV'),
                            ('depth-components.csv','深度模块 CSV'),('summary.json','协议与来源 JSON')]:
        body += f'<a href="data/{SOURCE}/{filename}" download>{e(label)} ↓</a>'
    body += ('</div><p class="rk-table-note">导出保留原始数值精度；网页仅对显示值舍入。'
             '来源摘要、文件校验值和评价口径一并保存。</p></section></section>')
    return body


if __name__ == '__main__':
    # Rebuild only this existing page; the full site build uses the same module.
    import build_core
    import build_experiments
    import experiment_summaries
    import reproduction_rankings
    root = Path(__file__).resolve().parent.parent
    build_experiments.configure(build_core)
    data = json.loads((root/'content/experiments/reproductions.json').read_text())
    experiment_summaries.build_summary(build_core, data['overview'], data)
    reproduction_rankings.build(build_core)
