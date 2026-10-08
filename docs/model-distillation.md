# 模型蒸馏专题

位置：内窥镜三维重建 → 模型蒸馏，与「实验」并列。专题入口为 `thesis/distillation/index.html`，每项研究使用独立日期目录。2026-10-08 是本次记录日期，实际运行日期未提供，不补猜。

正文按「怎么蒸馏 → 前后指标 → 教师对照 → 结论与边界」整理。首篇是双目教师生成 XYZ 伪标签，对非官方 OpenD4RT 32 帧模型做 240 步局部微调；只报告 P1 同视角适配，不宣称跨场景、真几何或新视角改善。教师校验的 5 帧真值只用于选教师，不进入学生训练梯度。RAFT 缺失的其余指标不补造。

## 内容与构建

- `content/distillation/index.json`：条目索引。
- `content/distillation/<slug>.json`：已提供事实及原精度指标字符串，未知运行日期为 null。
- `scripts/model_distillation.py`：生成入口、文章、CSV/JSON，并在内窥镜主页插入入口；由原 `scripts/build.py` 最后调用。
- `assets/model-distillation.css`：只加载于两个新增页面，复用现有主题。

运行 `python3 scripts/build.py` 后，再运行 `python3 scripts/check_model_distillation.py`。必须提交内容源及生成页面，不能只手改 HTML。重复构建不应产生差异。

每篇生成 `summary.json`、`metrics.csv`、`teacher-validation.csv`、`teacher-control.csv`，下载地址为同目录相对链接。页面的改善/下降文字与颜色按每个指标方向计算，不跨数据划分排名。

本次来源为作者提供的实验汇总，没有访问训练服务器、跑模型或重新计算图像指标。18 个片段／576 帧是总评价范围，未虚构逐划分数量；LPIPS 网络、聚合方式未提供，明确保留未知。不公开图像、伪标签或权重，不修改原方法汇总、数据集、已有实验及八股文。
