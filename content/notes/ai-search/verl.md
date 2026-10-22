# verl 实操：PPO、GRPO、DAPO 配置与奖励接入

> **版本口径：verl v0.6.0 示例。** 不代表当前项目已使用此版本。数值是练习示例，不是唯一正确配置，也不是针对特定硬件验证过的推荐值。

## 1. 三种算法的关键开关

| 配置项 | PPO + GAE | GRPO | DAPO |
| --- | --- | --- | --- |
| 启动入口 | verl.trainer.main_ppo | verl.trainer.main_ppo | recipe.dapo.main_dapo |
| algorithm.adv_estimator | gae | grpo | grpo |
| critic.enable | True | False | False |
| rollout.n | 可从 1 开始，也支持多条 | 示例 4，组内多条采样 | 示例 4，组内多条采样 |
| clip_ratio_low | 0.2 | 0.2 | 0.2 |
| clip_ratio_high | 0.2 | 0.2 | 0.28 |
| loss_agg_mode | 示例 token-mean | 示例 token-mean | token-mean |

- **adv_estimator**：怎样估计回答相对基准的优势。
- **critic.enable**：是否启用价值模型。典型 PPO + GAE 需要 Critic；GRPO 用同组回答的相对奖励构造优势，通常不需要 Critic。
- **rollout.n**：每个问题生成几条回答；数量增加通常也增加生成成本。
- **clip_ratio_low/high**：限制新旧策略概率比允许的更新范围，不是裁剪奖励分数。
- **loss_agg_mode**：如何汇总 token 损失。不能仅凭 token-mean 区分算法，也不代表每个 token 都有独立评分。

PPO 还需配置 critic.model.path 和 Critic 优化器；algorithm.gamma、algorithm.lam 控制回报与 GAE 计算。verl v0.6.0 的相关默认值为 1.0，实际运行前应核对锁定版本的配置文件。

参考：[GRPO 文档](https://verl.readthedocs.io/en/latest/algo/grpo.html) · [Actor 配置](https://github.com/verl-project/verl/blob/v0.6.0/verl/trainer/config/actor/actor.yaml) · [PPO 配置](https://github.com/verl-project/verl/blob/v0.6.0/verl/trainer/config/ppo_trainer.yaml) · [Critic 配置](https://github.com/verl-project/verl/blob/v0.6.0/verl/trainer/config/critic/critic.yaml)

## 2. KL 有两个接入位置

| 配置项 | PPO 的一种配置 | GRPO 示例思路 | DAPO 示例 |
| --- | --- | --- | --- |
| algorithm.use_kl_in_reward | True | False | False |
| actor.use_kl_loss | False | True | False |
| 对应系数 | algorithm.kl_ctrl.kl_coef | actor.kl_loss_coef | 关闭时不生效 |

- **奖励端 KL**：把 KL 惩罚合并进奖励。
- **损失端 KL**：在策略损失中加入 KL 项。
- 这不是强制组合。不要无意中同时启用两处而重复惩罚；PPO 也可以关闭 KL。先选一种明确方案，再观察日志与独立评测。

GRPO 示例里的 kl_loss_coef=0.001 只是参考起点。[GRPO 示例](https://github.com/verl-project/verl/blob/v0.6.0/examples/grpo_trainer/run_qwen3-8b.sh)

## 3. DAPO 动态采样与超长输出

配置片段示例，字段需按锁定版本核对：

    data.train_batch_size=64
    data.gen_batch_size=128
    algorithm.filter_groups.enable=True
    algorithm.filter_groups.metric=seq_reward
    algorithm.filter_groups.max_num_gen_batches=10
    reward_model.reward_manager=dapo

流程：先生成一批候选回答；按序列奖励过滤训练组；如果同一问题的回答奖励完全相同，组内可能缺少相对优劣信号；继续生成，直到凑够训练样本或达到采样次数上限。

视频任务若以 F1 为奖励，可考虑用 seq_reward 按实际奖励过滤，但需先确认奖励返回值和过滤字段定义；**不能不检查就照搬数学任务里的 acc 字段**。

超长输出相关字段：

    reward_model.overlong_buffer.enable
    reward_model.overlong_buffer.len
    reward_model.overlong_buffer.penalty_factor

是否启用、缓冲区多长，应根据输出长度分布决定。以上只展示字段，不是推荐值；只输出 ID 的任务不应照搬长推理任务的长度配置。[DAPO 配置说明](https://verl.readthedocs.io/en/latest/algo/dapo.html)

## 4. 其他训练参数

以下只是练习起点，需结合显存、并行方式、数据长度和版本验证。

| 参数 | 示例／依据 | 作用 |
| --- | --- | --- |
| actor_rollout_ref.actor.optim.lr | 全参数训练可试 1e-6 | Actor 学习率 |
| critic.optim.lr | PPO 可试 1e-5 | Critic 学习率 |
| data.train_batch_size | 如 64 | 每轮输入问题数 |
| actor.ppo_mini_batch_size | 如 16 | 更新 mini-batch 大小 |
| actor.ppo_micro_batch_size_per_gpu | 可先试 1 | 单 GPU 一次处理量，影响显存 |
| actor.ppo_epochs | 先用 1 | 同一批生成数据重复更新轮数 |
| rollout.temperature | 如 1.0 | 采样随机性 |
| data.max_prompt_length | 按输入长度统计 | 提示词长度上限 |
| data.max_response_length | 按任务设定 | 回答长度上限 |
| trainer.test_freq | 如 10 | 按训练步间隔评测 |

**ppo_epochs 不等于 trainer.total_epochs**：前者是重复利用同一批生成数据的更新轮数；后者是遍历训练数据集的轮数。test_freq=10 也不等于每十个 epoch 评测一次。字段名和约束以对应版本配置为准。

不要只凭“8 张 H200”推导唯一 batch size 或学习率。应观察显存峰值、生成吞吐、有效 batch、梯度范数、KL、奖励分布和独立验证指标。[verl v0.6.0 PPO 配置](https://github.com/verl-project/verl/blob/v0.6.0/verl/trainer/config/ppo_trainer.yaml)

## 5. 奖励函数接入

算法开关不会自动实现“4B 模型预测 ID → 计算 F1 → 融合文本奖励”。需要配置自定义奖励函数，例如：

    custom_reward_function.path=/实际路径/video_reward.py
    custom_reward_function.name=compute_score

实现需要按项目情况完成：解析输出并提取预测 ID、获取参考 ID 并计算 F1、按需调用文本评分服务、明确奖励归一化与权重、处理缺失值，并确认返回结构兼容所用版本的 reward manager。

**预测 ID 的 4B 模型不能直接当作输出标量分数的奖励模型配置进去就结束。** 必须有调用与结果转换逻辑；多种奖励怎样融合也需明确实现。[verl DAPO 奖励管理器](https://github.com/verl-project/verl/blob/v0.6.0/verl/workers/reward_manager/dapo.py)

## 面试与实操自检

- 能否解释为什么 PPO + GAE 需要 Critic，而 GRPO 通常不需要？
- 能否区分奖励端 KL 与损失端 KL，并确认没有意外重复启用？
- 能否解释 rollout.n、clip 区间、loss 聚合分别影响什么？
- 能否说明 DAPO 的组过滤依据，以及为什么不能随便把 acc 换成 F1？
- 能否展示自定义奖励函数如何解析输出、计算 F1 并返回正确结构？
- 是否保存了版本、完整配置、日志和独立评测结果？

**复习重点：** 比背住 0.2 或 0.28 更重要的是讲清楚为什么改参数、观察什么日志、如何判断有效，以及独立评测是否改善。本文是配置学习笔记，不代表这些参数已在你的项目中实际运行或验证。
