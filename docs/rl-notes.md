# 强化学习复习专题

位置：八股文 → 强化学习，与 LoRA 并列。PPO、DPO、GRPO、GSPO、DAPO 各自有一个入口页。

每个算法入口的正文第一行是论文原文 PDF 链接（旁附 arXiv 摘要页）。下方两个按钮「八股文」「原理」分别进入独立子页面。两类内容未提供前保持 pending，不预填算法知识，不计为已整理。

## 论文与目录

`content/notes/rl/index.json` 使用 schema_version 2：modules 定义 interview（八股文）与 principles（原理）；topics 保存算法、paper.title / url / pdf 以及 sections 中各子模块的 pending / published 状态。论文对应 PPO 1707.06347、DPO 2305.18290、GRPO 2402.03300（DeepSeekMath）、GSPO 2507.18071、DAPO 2503.14476。链接依据 arXiv 论文原始记录核对，未复制论文全文。

## 后续添加正文

编辑 `content/notes/rl/<算法>/<子模块>.md`，例如 `content/notes/rl/ppo/interview.md` 或 `content/notes/rl/ppo/principles.md`。仅在作者提供或确认正文后，把该算法 sections 中对应子模块设为 published。另一个模块可继续 pending。保留一个一级标题，二、三级标题组织正文。

旧 `content/notes/rl/<算法>.md` 空白占位文件保留，不再用作正文；若其中出现已写内容，生成器会停止并要求迁移，避免静默丢失。不要把正文继续写入旧位置。

运行 `python3 scripts/build.py`，提交内容源与实际变化的生成页面：`notes/index.html`、`notes/rl/index.html`、`notes/rl/<算法>/index.html`、`notes/rl/<算法>/<子模块>/index.html`。`scripts/rl_notes.py` 统一生成入口、子页面、状态及搜索索引，`assets/rl-sections.css` 仅作用于 RL 页面。

保留两大站点板块，不修改 LoRA、内窥镜实验、数据集、复现汇总或 Pages 发布方式。
