# 数据集与复现汇总维护

更新时间：2026-10-08。两个页面的 URL、实验目录入口和历史实验日期保持不变。

## 内容源

- `content/datasets.json`：schema v2，区分本地库存、监督/标定、已处理、已测试、局限，保留不完整/未取得条目。
- `content/experiments/reproductions.json`：历史 `groups` 完整保留，`updated` 表示本次更新时间；`update_file` 指向新增内容。
- `content/experiments/reproduction-update-2026-10-08.json`：方法状态、协议、对齐深度评价与自训练 pilot。
- 同目录三个 CSV：`three-model-dataset-metrics-20261008.csv`、`mean-input-control-20261008.csv`、`ec-noadapt-full-20261006.csv`。保留全精度，不能换成页面舍入值。

## 构建

继续运行 `python3 scripts/build.py`。原 `dataset_inventory.py` 和 `experiment_summaries.py` 将新版两页交给 `research_overviews.py`，不改变其他内容的构建流程。

两页及下载文件生成在 `thesis/experiments/datasets/` 和 `thesis/experiments/reproductions/`。`assets/research-overviews.css` 只作用于这两页，复用主题色，长表支持横向滚动。历史 `experiment-1` 至 `experiment-4` 锚点保留。

## 数据边界

本次新增数据来自作者已核对的汇总；未访问实验服务器，未重跑实验。所有相对下载链接均指向真实生成的 CSV/JSON，不公开服务器绝对路径、原始图像或权重。

全图 SqueezeNet LPIPS、组织块 AlexNet LPIPS、输入视角重渲染、GT 中位数尺度对齐深度不混合排名。随表披露 Hamlyn 目标 RGB 仅参与共享相机估计、EndoNeRF/EC 固定相机时间插帧。NAS3R/NoPoSplat 只有实际完成并有对应模型评价文件才能升级状态。
