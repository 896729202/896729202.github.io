# 当前数据集页面

位置：内窥镜三维重建 → 实验 → 顶部「当前数据集」按钮。

内容源为 `content/datasets.json`，生成器为 `scripts/dataset_inventory.py`。
统一入口 `scripts/build.py` 在实验页面构建后调用清单生成器，
在原方法复现指标汇总旁加入入口；若目录导航结构变化，会报错而不是盲目替换。
页面不进入日期实验索引，也不计作新实验；不修改已有指标或实验摘要。

修改清单时更新 `records` 和 `record_date`；日期表示本次清单记录日期。
保持帧、双目图像组和曝光衍生版本的计数口径，未提供的数量不推算。
本地可用状态来自作者提供的清单，不代表服务器目录已自动扫描。

按现有方式安装依赖并运行 `python3 scripts/build.py`，提交内容源及生成的
`thesis/experiments/datasets/index.html` 和实验目录页面。
不要只修改生成的 HTML；保留现有 Pages 发布设置。
