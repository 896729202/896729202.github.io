"""Apply the author's verified 2026-10-08 facts; never run experiments."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[2]
DAY = '2026-10-08'
SOURCE = '依据作者已核对并提供的数据整理；本次未访问实验服务器，未重新运行实验。更新时间不是原始实验或下载日期。'
def save(path, data):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
def record(name, status, content, supervision, processed, tested, limitations):
    return dict(name=name, status=status, content=content, supervision=supervision, processed=processed, tested=tested, limitations=limitations)
records = [
 record('EndoNeRF', ['本地可用', '已测试子集'],
        'pulling_soft_tissues：63 帧；cutting_tissues_twice：156 帧，共 219 帧。',
        '已有 RGB、深度文件、掩码与 poses_bounds.npy；本地相机位姿固定，各帧相同。',
        '上述两个场景已有本地文件；文件存在不等于全帧已评价。',
        '最新三模型：两个场景各 12 个目标，共 24 帧。',
        '深度文件不一概视为物理深度真值。固定相机下的本轮评价是零基线时间插帧，不是新视角或几何准确度测试。'),
 record('EndoNeRF-EC', ['本地可用', '已处理', '已测试子集'],
        'pulling：63 帧；cutting：156 帧，共 219 帧；是 EndoNeRF 对应场景的曝光变化版本。',
        '已有 images_mix、images_mix_adjusted、depth_dam_adjusted、masks、poses_bounds.npy；DAM 为模型生成的相对深度参考。',
        'images_mix 为曝光变化 RGB；images_mix_adjusted 为预处理增强 RGB。已用于 Endo-4DGX 及其他方法的曝光实验。',
        '最新三模型：两个场景各 12 个目标，共 24 帧。',
        '不是额外独立场景；DAM 不是物理深度真值。保留真实固定相机，图像分数不代表新视角或几何恢复能力。'),
 record('StereoMIS', ['本地原始视频', '已处理窗口', '已测试子集'],
        '原始视频元数据：P1 为 19,180 帧，P3 为 19,185 帧。',
        '处理窗口已有校正双目图像、相机参数及相关深度/掩码文件。',
        'P1_6001_6367、P1_8001_8367、P3_9101_9467 各 184 组，共 552 组已处理双目图像。',
        '最新三模型使用这三个窗口，每窗口 12 个目标，共 36 帧。',
        '原始视频帧数不是已处理/已评价数量；估计深度先验不是独立测量的深度真值。'),
 record('SCARED', ['本地可用', '已有校正帧池', '已测试子集'],
        'dataset_1 的 keyframe_1/2/3 动态视频分别为 197/280/471 帧，共 948 帧；另有静态双目样本。',
        '已有双目视频、标定、逐帧相机数据和几何监督文件；静态样本包括 dataset_1/keyframe_4、keyframe_5 与 dataset_4/keyframe_1。',
        '已有校正帧池。Endo-E2E-GS pilot：训练 48 对、验证 12 对、测试 1 对；320×256 双目校正。',
        '最新三模型：从三条动态序列测试 12、12、10 个目标，共 34 帧。另有独立的 pilot 与逐对尺度对齐深度评价。',
        '34 个测试目标和校正帧池均不代表原始数据总量；不能称为完成整个官方 benchmark。'),
 record('C3VD', ['本地可用', '已处理', '已测试子集', '部分下载不完整'],
        '7 条完整注册序列，共 2,744 帧；4 条完整 screening 视频，共 20,058 帧；可用 RGB 合计 22,802 帧。',
        '已有相机标定与相关三维模型。注册序列有配准深度等真值；screening 有相机位姿和模型，但不据此认定都有逐帧深度真值。',
        '最新实验按官方多项式相机标定转换为虚拟针孔图像；不宣称全部原始帧都完成处理。',
        '最新三模型覆盖上述 11 条完整序列，每条 12 个目标，共 132 帧。',
        'cecum_t2_b 下载不完整，排除于完整可用序列与以上计数；两类数据的监督内容不同。'),
 record('Hamlyn', ['本地示例帧池', '已测试子集'],
        'Hamlyn23 本地示例帧池：66 张图像，来自已有复现仓库的示例数据。',
        '本地没有对应相机或深度真值；最新实验三种方法共用估计相机。',
        '已用于 Endo3R、VGGT、MoRe、OpenD4RT 推理，不是完整 Hamlyn 数据集。',
        '最新三模型：12 个目标帧。',
        '共享相机由 OpenD4RT 独立三帧估计，目标 RGB 仅可参与相机估计；上下文几何独立用两张输入编码。详见复现页协议。'),
 record('自建解析合成数据', ['本地可用', '机制/几何实验已使用'],
        '13 个各 97 帧的版本，以及 19 帧 smoke 版本。',
        '含内容变化、曝光变化与几何验证版本；解析系统中的真值与真实数据的监督分开。',
        '已用于内容变化、曝光干预与几何机制验证。',
        '不包含在最新“六个公开数据集三模型实验”中。',
        '各版本有关联，不能作为独立真实样本合并统计。'),
 record('EndoSLAM', ['尚未取得'], '只有占位目录，没有可读取的实际数据。', '未取得。', '无可确认处理数据。', '不计入测试结果。', '目录存在不等于数据可用。'),
 record('肠／胃素材', ['目录占位'], '已建立目录，本次核查没有可读取文件。', '未确认。', '无可确认处理数据。', '不计入可用数据集和测试结果。', '不将占位目录统计为可用素材。'),
]
coverage = [
 ['SCARED',3,34,'三条动态序列：12 / 12 / 10 个目标','提供的标定/位姿'],
 ['C3VD',11,132,'7 条注册序列 + 4 条 screening；每条 12 个目标','提供的标定/位姿；多项式相机转虚拟针孔'],
 ['StereoMIS',3,36,'三个已处理窗口；每个 12 个目标','提供的标定/位姿'],
 ['EndoNeRF',2,24,'两个场景；每个 12 个目标','真实固定相机；零基线时间插帧'],
 ['EndoNeRF-EC',2,24,'两个对应曝光版本；每个 12 个目标','真实固定相机；非额外独立场景'],
 ['Hamlyn',1,12,'Hamlyn23 示例帧池','共享三帧估计相机；目标 RGB 可用于相机估计'],
]
datasets = dict(schema_version=2, title='当前数据集', subtitle='本地库存、处理范围与实际测试子集', record_date=DAY, records=records, coverage=coverage, source_note=SOURCE,
 counts_note='“本地可用”“已处理”“已测试”是不同层级；帧、双目图像组和相关衍生版本不相加为独立样本。下载数据不等于完成官方 benchmark。',
 sequence_breakdown=[
  dict(title='C3VD · 完整注册序列',kind='注册序列：配准深度等真值',sequences=[['cecum_t1_a',276],['cecum_t1_b',765],['cecum_t2_a',370],['cecum_t4_a',465],['sigmoid_t3_a',613],['trans_t1_a',61],['trans_t2_a',194]],total=2744),
  dict(title='C3VD · 完整 screening 视频',kind='screening：相机位姿和模型；不保证逐帧深度真值',sequences=[['screening_t1',5458],['screening_t2',5100],['screening_t3',4726],['screening_t4',4774]],total=20058),
  dict(title='SCARED · dataset_1 动态视频',kind='原始视频帧数；不是测试目标数',sequences=[['keyframe_1',197],['keyframe_2',280],['keyframe_3',471]],total=948)],
 unavailable_note='C3VD 的 cecum_t2_b 下载不完整；EndoSLAM 尚未取得；肠／胃素材仅有目录。以上均未计入完整可用数据或本轮测试。')
save('content/datasets.json',datasets)
image_csv = '''数据集,方法,目标帧数,PSNR,SSIM,LPIPS
SCARED,DepthSplat,34,24.717929,0.714145,0.077053
SCARED,MVSplat,34,23.754110,0.651316,0.093605
SCARED,OpenD4RT＋贴图渲染,34,24.704658,0.692219,0.119622
C3VD,DepthSplat,132,25.255965,0.727191,0.147627
C3VD,MVSplat,132,24.300491,0.695549,0.170843
C3VD,OpenD4RT＋贴图渲染,132,22.383835,0.651002,0.205948
StereoMIS,DepthSplat,36,19.227290,0.437816,0.203749
StereoMIS,MVSplat,36,20.095953,0.462671,0.184549
StereoMIS,OpenD4RT＋贴图渲染,36,23.061752,0.657666,0.161521
EndoNeRF,DepthSplat,24,23.278657,0.728850,0.122282
EndoNeRF,MVSplat,24,24.004695,0.740065,0.124365
EndoNeRF,OpenD4RT＋贴图渲染,24,23.206411,0.735277,0.131095
EndoNeRF-EC,DepthSplat,24,12.089031,0.482776,0.278997
EndoNeRF-EC,MVSplat,24,12.791279,0.515091,0.274001
EndoNeRF-EC,OpenD4RT＋贴图渲染,24,13.005772,0.508736,0.284244
Hamlyn,DepthSplat,12,20.412522,0.613745,0.277385
Hamlyn,MVSplat,12,19.270736,0.581028,0.291411
Hamlyn,OpenD4RT＋贴图渲染,12,22.864783,0.722508,0.190884
'''
mean_csv = '''数据集,PSNR,SSIM,LPIPS
SCARED,23.462383,0.558002,0.101712
C3VD,24.521759,0.657786,0.155632
StereoMIS,27.426777,0.730754,0.091030
EndoNeRF,24.305848,0.753419,0.110553
EndoNeRF-EC,13.393265,0.528824,0.253558
Hamlyn,23.398207,0.746161,0.160130
'''
ec_csv = '''场景,方法,块PSNR,块SSIM,块LPIPS
pulling,Deform3DGS,28.226947,0.852844,0.166815
pulling,Endo-4DGS,27.990796,0.864931,0.208664
pulling,Endo-4DGX,30.129343,0.903352,0.086045
cutting,Deform3DGS,23.450177,0.690913,0.295129
cutting,Endo-4DGS,27.659881,0.815434,0.262793
cutting,EndoGaussian,27.911488,0.836191,0.203843
cutting,Endo-4DGX,28.564226,0.897850,0.102119
'''
for name,text in [('three-model-dataset-metrics-20261008.csv',image_csv),('mean-input-control-20261008.csv',mean_csv),('ec-noadapt-full-20261006.csv',ec_csv)]:
    (ROOT/'content/experiments'/name).write_text(text,encoding='utf-8')
statuses = [
 ['Deform3DGS','逐场景训练/优化','EndoNeRF、EC','已有历史及 EC noadapt_full 数值；预算、先验和评价区域按各表披露。'],
 ['SurgicalGS / EndoPrior-GS / EndoPlanar','逐场景训练/优化','EndoNeRF','保留 pulling、cutting 原有结果；不是等预算排名。'],
 ['Endo-4DGS / EndoGaussian','逐场景训练/优化','EndoNeRF、EC','保留历史；新增 EC 预算为 1000 coarse + 3000 fine。EndoGaussian pulling 新训练数值失败，无完整结果。'],
 ['Endo-4DGX','逐场景训练/优化','EndoNeRF-EC','历史与新增 EC 结果按 noadapt_full 等协议区分，不和前馈全图表混合。'],
 ['DepthSplat','预训练前馈推理','本轮六数据集','官方预训练 checkpoint；已完成前馈高斯推理与本轮图像评价。'],
 ['MVSplat','预训练前馈推理','本轮六数据集','dylanebert 第三方权重镜像；架构严格加载通过，未独立核对与官方 Google Drive 权重的字节一致性。'],
 ['OpenD4RT＋贴图渲染','预训练推理 + 外部渲染','本轮六数据集','非官方 OpenD4RT 实现及其权重。几何、相机、轨迹已有推理；RGB 来自输入纹理与外部渲染器，不是 D4RT 直接预测。'],
 ['VGGT / MoRe','预训练前馈推理','Hamlyn、EndoNeRF、SCARED','已有推理记录及小规模 SCARED 对齐深度评价；没有统一 PSNR/SSIM/LPIPS，不补造。'],
 ['Endo3R','官方预训练推理 · 工程 smoke','Hamlyn23 前 8 帧；EndoNeRF pulling 前 8 帧','在线推理 smoke 已完成：点图、深度、置信度、相机及输出有限性检查。没有完整官方 benchmark 或统一图像质量指标。'],
 ['Endo-E2E-GS','自训练 pilot','SCARED：48 / 12 / 1 对','随机初始化；stage1 1000 + stage2 1000 步；使用 stage2_final，不是作者预训练权重或论文完整复现。'],
 ['NAS3R / NoPoSplat','等待完整权重 · 尚无结果','无完成的新模型评价','NAS3R 早先下载超时，后有续传记录；本次状态仍为等待权重。DepthSplat/MVSplat 的引用旧分数不是这两个模型的结果。'],
]
protocol = [
 ['输入与留出目标','每个目标使用前后两张时间上下文图像；每条序列均匀选择最多 12 个留出目标。SCARED 一条序列为 10 个，合计 22 条序列、262 个目标。六个公开数据集条目中，EC 是 EndoNeRF 的关联曝光版本，不是额外独立场景。'],
 ['统一图像评价','分辨率 256×256；从保存的 PNG 统一计算全图 PSNR、SSIM、LPIPS，空洞和错误区域均计入。SSIM 使用 skimage；LPIPS 使用经过校准的 SqueezeNet v0.1。三项均已完成。'],
 ['汇总与训练条件','先对每条序列的目标帧取平均，再对同一数据集的序列等权平均。没有场景优化或内窥镜权重训练。结果仅代表本地确定性测试子集，不是全帧测试或官方 benchmark。'],
]
cameras = [
 ['SCARED / C3VD / StereoMIS','使用提供的标定/位姿。C3VD 按官方多项式相机标定转换为虚拟针孔图像。'],
 ['EndoNeRF / EndoNeRF-EC','保留真实固定相机，属于零基线时间插帧。DepthSplat/MVSplat 缺少三角化视差；图像分数不能解释为新视角合成或几何准确性。'],
 ['Hamlyn · 目标 RGB 的使用边界','OpenD4RT 独立三帧相机估计允许目标 RGB 仅用于相机估计，三种方法共用这些相机。上下文几何仍独立用两张输入图像编码；并非严格不使用目标 RGB 的全流程。'],
 ['OpenD4RT · 外部贴图图像流程','两张输入预测深度 + 外部网格贴图渲染；不使用目标纹理或 GT 深度。用输入预测相机基线与共享相机基线对齐尺度，再使用共享相机参数投影，保留未覆盖的黑色区域。旧同帧自重投影诊断不与本轮留出目标图评价合并。'],
]
depth = dict(headers=['样本 / 划分','方法','AbsRel ↓','RMSE ↓ / mm','δ1 ↑'],rows=[
 ['dataset1/keyframe3 · 12 对验证','VGGT','0.061982','6.7072','0.989411'],
 ['dataset1/keyframe3 · 12 对验证','MoRe','0.089464','9.4129','0.937819'],
 ['dataset4/keyframe1 · 单对测试','VGGT','0.062641','5.3460','0.979129'],
 ['dataset4/keyframe1 · 单对测试','MoRe','0.045665','3.7160','0.992579']],
 note='逐对使用 GT 中位数进行尺度对齐；只评价对齐后的深度形状，不代表原生毫米尺度恢复。验证 12 对与单对测试分开解释；不补造两者的 PSNR/SSIM/LPIPS。',
 conclusion='此验证子集上 VGGT 三项指标更好；单对测试上 MoRe 三项更好。样本规模与逐对尺度对齐限制了结论，不能据此判断原生尺度或完整 benchmark 优劣。')
pilot = dict(headers=['划分','样本数','视差 EPE ↓ / px','输入视角 PSNR ↑ / dB','SSIM ↑','有效深度 AbsRel ↓','LPIPS'],rows=[
 ['验证','12 对','1.5213','23.112','0.6506','0.08921','未提供'],
 ['测试','1 对','6.0956','19.318','0.7894','0.37892','未提供']],
 setup='SCARED 双目校正，320×256；训练 48 对、验证 12 对、测试 1 对。随机初始化，自训练 stage1 1000 步 + stage2 1000 步。此表报告 stage2_final。',
 note='stage2_best 的本次最佳验证 EPE 出现在 step1，不称为完整联合训练模型。RGB 指标是输入视角重渲染，不与留出目标帧表排名；LPIPS 未提供。',
 conclusion='pilot 已得到验证和单对测试数值；测试 EPE / AbsRel 高于验证。它是小规模自训练实验，不是作者预训练模型或论文完整复现。')
update = dict(schema_version=1,updated=DAY,source_note=SOURCE,coverage=coverage,
 totals=dict(methods=3,datasets=6,sequences=22,targets=262,model_target_records=786),
 method_status=statuses,protocol=protocol,cameras=cameras,depth=depth,pilot=pilot,
 image_csv='three-model-dataset-metrics-20261008.csv',control_csv='mean-input-control-20261008.csv',ec_csv='ec-noadapt-full-20261006.csv',
 control_note='对照直接逐像素平均前后两张输入 RGB，不进行三维重建，采用同一留出目标及图像评价协议。',
 control_conclusion='DepthSplat 在 SCARED / C3VD 的 PSNR 高于直接平均输入约 1.26 / 0.73 dB。在其余四个数据集，本轮三种方法的 PSNR 均未超过这一简单对照。这些结果不能单独证明三维几何有效；仍需独立几何评价和更大基线的新视角实验。',
 ec_note='2026-10-06 汇总；test / noadapt_full，即无适配全支持，使用有效组织块指标与 AlexNet LPIPS。新增 Endo-4DGS / EndoGaussian 预算为 1000 coarse + 3000 fine；原生预算、深度先验与条件不同，不是等预算排名。',
 ec_failure='EndoGaussian pulling 的新增训练数值失败，未完成完整训练，无有效结果可填；不能称四个新增训练全部成功。历史 EndoGaussian 结果不挪用为本批结果。',
 ec_boundary='无适配全支持、无适配右半、左半拟合/右半评价的适配是不同协议。本表仅列 noadapt_full；AlexNet 组织块 LPIPS 不与本轮 SqueezeNet 全图 LPIPS 混合排名。',
 historic_boundary='下方保留 2026-10-03 及更早的 pulling、cutting、EndoGaussian 验证补充和 EC 历史表，原数值与历史日期不变。“不读取测试 RGB 进行适配”仅适用于相应历史 EC 实验，不概括 Hamlyn 的目标图相机估计或其他已有适配结果。')
save('content/experiments/reproduction-update-2026-10-08.json',update)
old_path=ROOT/'content/experiments/reproductions.json'
history=json.loads(old_path.read_text(encoding='utf-8'))
history['updated']=DAY
history['update_file']='reproduction-update-2026-10-08.json'
history['overview']['subtitle']='方法状态、六数据集前馈评价与历史逐场景指标；不同协议分开呈现。'
history['overview']['summary']='截至 2026-10-08 的方法状态、全图图像测试、对齐深度评价、自训练 pilot 与历史逐场景复现。'
save('content/experiments/reproductions.json',history)
p=ROOT/'scripts/experiment_summaries.py'
s=p.read_text(encoding='utf-8')
old="    groups = data.get('groups', [])"
new="    if item['slug'] == 'reproductions' and data.get('update_file'):\n        from research_overviews import render_reproductions\n        return render_reproductions(core, item, data)\n    groups = data.get('groups', [])"
assert s.count(old)==1,'Summary renderer changed; stop and review'
p.write_text(s.replace(old,new,1),encoding='utf-8')
p=ROOT/'scripts/dataset_inventory.py'
s=p.read_text(encoding='utf-8')
old="    if data.get('schema_version') != 1:"
new="    if data.get('schema_version') == 2:\n        from research_overviews import render_datasets\n        render_datasets(core, data)\n        link_catalog(ROOT / 'thesis/experiments/index.html')\n        return True\n    if data.get('schema_version') != 1:"
assert s.count(old)==1,'Dataset renderer changed; stop and review'
s=s.replace(old,new,1)
a=s.index("    catalog_html = catalog.read_text(encoding='utf-8')")
b=s.index("    core.shell('thesis/experiments/datasets/index.html'",a)
nav=s[a:b]+"    catalog.write_text(catalog_html, encoding='utf-8')\n"
s+='\n\ndef link_catalog(catalog):\n'+nav
p.write_text(s,encoding='utf-8')
print('Prepared dataset inventory and reproduction update; historical groups preserved.')
