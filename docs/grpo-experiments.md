# GRPO 专栏维护

入口为 `thesis/experiments/grpo/index.html`，内容源为 `content/grpo/overview.json`。
沿用现有实验页样式与站点模板。完整构建 `python scripts/build.py` 最后调用
`grpo_experiments.build`，生成专栏与摘要下载，并为实验目录、论文目录、模型适配目录
及两份已有四头诊断页补充专栏入口。旧记录原址、指标与下载保持可访问。

仅更新专栏时，在已生成站点上运行 `python scripts/grpo_experiments.py`。
修改已存在入口文案时，先运行完整构建；入口插入是幂等的，不会重复堆积。
源数据与生成 HTML / summary.json 必须一起提交；GitHub Pages 直接发布静态文件。

整理日期与实验日期分开。真实 GRPO 训练、监督对照、冻结诊断、计划未执行分别说明。
旧逐帧 GT 尺度、固定尺度、长序列一个评价尺度不得混排；使用目标右目奖励的方法
注明额外输入。GT 选优仅诊断。训练集 GT 监督与测试 GT 隔离分别解释。
本次公开的是报告摘要；未发布原始临床图像、模型缓存、日志或服务器路径。
