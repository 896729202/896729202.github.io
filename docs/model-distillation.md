# 模型适配与泛化专题

位置：内窥镜三维重建 → 模型适配与泛化，与「实验」并列。专题名称从 `content/distillation/index.json` 读取；沿用 `thesis/distillation/index.html` 和各研究的独立日期目录，不更改已发布链接。专题按每项研究的训练范围、评价口径和预算独立展示，不合并成排行榜。记录日期不代替实际实验日期；未知运行日期保留为 `null`。

## 两类记录

`schema_version: 1` 保留原有教师蒸馏格式。正文按「怎么蒸馏 → 前后指标 → 教师对照 → 结论与边界」整理。首篇是双目教师生成 XYZ 伪标签，对非官方 OpenD4RT 32 帧模型做 240 步局部微调；只报告 P1 同视角适配，不宣称跨场景、真几何或新视角改善。教师校验的 5 帧真值只用于选教师，不进入学生训练梯度。该记录的内容与原指标不随专题名称调整；文章仅更新返回入口的名称。

`schema_version: 2`、`kind: "selector_diagnostic"` 使用四头选择器诊断格式，由 `scripts/selector_diagnostic.py` 渲染。字段包括 `record_date`、`experiment_date`、标题与摘要、`kind_label`、`protocol` 键值对、`primary_results` 主表、`sections` 分析章节，以及 `source_title`、`source_sha256` 和 `source_note`。来源 SHA-256 仅作已核对报告的出处标识，构建只校验其格式，不要求报告文件位于公开仓库。每章提供唯一 `id`、`title`、`paragraphs`、`tables` 与 `conclusion`；表格采用 `headers`、`rows`、`caption`、`note`，历史或补充表可指定 `collapsible: true`。

选择器诊断页先展示训练与评价范围，再展示当前主表。K1-only 训练、120 步预算和 K1/K2/K3 的评价关系必须在 `protocol` 中明确，不能只藏在页尾说明或折叠表内。主表保持来源顺序，不计算排名，也不推算缺失指标。表格值全部使用字符串，HTML 与 CSV 保留提供的完整精度。不同预算的历史记录通过文字区分，不能合并为同口径结论。

## 内容与构建

- `content/distillation/index.json`：专题标题、说明与条目索引。卡片使用记录的 `kind_label`，旧格式默认显示「教师蒸馏」。
- `content/distillation/<slug>.json`：已提供事实与原精度指标字符串。
- `scripts/model_distillation.py`：分派两种格式，生成入口和教师蒸馏文章，并在内窥镜主页插入专题入口；由 `scripts/build.py` 调用。
- `scripts/selector_diagnostic.py`：校验诊断数据、来源 SHA-256 格式、章节 ID 与表格列数，生成选择器诊断文章和摘要下载资料；不读取、复制或发布原始报告。
- `assets/model-distillation.css`：仅加载于本专题页面，复用现有主题。

运行 `python3 scripts/build.py` 后，再运行 `python3 scripts/check_model_distillation.py` 与适用于新增诊断页的检查。必须提交内容源及生成页面，不能只手改 HTML。重复构建不应产生差异。

教师蒸馏文章生成 `summary.json`、`metrics.csv`、`teacher-validation.csv`、`teacher-control.csv`。其改善／下降文字与颜色按每个指标方向计算，不跨数据划分排名。选择器诊断文章只生成整理后的 `summary.json` 与主表完整精度的 `metrics.csv`；原始完整报告保留在本地，不属于公开网站附件。下载地址均为同目录相对链接。

所有页面仅整理作者提供的结果；构建过程不访问训练服务器、不运行训练或推理、不重新计算图像指标。未提供的评价细节明确保留未知，不公开未提供的图像、伪标签或权重，不修改原方法复现汇总及曝光研究专题。
