# 当前数据集页面

位置：内窥镜三维重建 → 实验 → 顶部「当前数据集」按钮。

内容源为 `content/datasets.json`，生成入口为 `scripts/dataset_inventory.py`，
schema v2 页面由 `scripts/research_overviews.py` 的 `render_datasets` 渲染。
统一入口 `scripts/build.py` 在实验页面构建后调用清单生成器，
在原方法复现指标汇总旁加入入口；若目录导航结构变化，会报错而不是盲目替换。
页面不进入日期实验索引，也不计作新实验；不修改已有指标或实验摘要。

修改清单时更新 `records`、`coverage` 及 `coverage_totals`，覆盖合计由生成器核对。
`record_date` 配合 `date_label` 描述日期含义；本版日期为来源 HTML 的更新日期，
完整时间保存在 `source_report_updated_at`，不视为独立验收时间。
`supervision_notes`、`protocol_note` 与 `source_links` 一并生成监督边界、输入协议和公开来源链接。
保持帧、双目图像组和曝光衍生版本的计数口径，未提供的数量不推算。
本地可用状态来自作者提供的清单，不代表服务器目录已自动扫描。

2026-10-11 版保留旧六类子集并加入 EndoSLAM v1，共 7 个公开数据集条目、
87 条序列/评价流、1,004 张留出目标。EndoSLAM 的 65 条评价流包含 64 条真实
相机流和 1 条 Olympus 模体视频；PillCam 的 14 条流来自 7 条物理轨迹的交替
前后镜头，不能当作同步双目。来源为用户提供的 HTML 和更新说明；未提供原始
验收 JSON、实验 CSV 或 scene_manifest 时，保留这一核验边界，不能称已独立验收。

按现有方式安装依赖并运行 `python3 scripts/build.py`，提交内容源及生成的
`thesis/experiments/datasets/index.html` 和实验目录页面。
不要只修改生成的 HTML；保留现有 Pages 发布设置。
