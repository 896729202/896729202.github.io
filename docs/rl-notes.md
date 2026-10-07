# 强化学习复习专题

位置：八股文 → 强化学习，与 LoRA 并列。下面按顺序保留 PPO、DPO、GRPO、GSPO、DAPO 五个独立入口。

本次只建立目录与占位页，不补写算法定义、公式或实操经验。`pending` 页面显示“内容待补充”，不计入已整理笔记。

## 后续添加正文

编辑 `content/notes/rl/<slug>.md`，并在 `content/notes/rl/index.json` 将相应条目的 `status` 从 `pending` 改为 `published`。仅在作者提供或确认正文后发布。保持一级标题为对应主题，二、三级标题用于内容组织。

运行 `python3 scripts/build.py`，提交内容源以及生成的 `notes/index.html`、`notes/rl/index.html`、`notes/rl/<slug>/index.html` 等实际变更。目录、五个主题的导航和搜索条目由 `scripts/rl_notes.py` 统一生成，不要只手改 HTML。

该模块在现有构建流程最后执行，不修改 LoRA、实验、数据集或复现汇总内容。保留两个站点主板块；强化学习属于八股文，不是新增主导航。
