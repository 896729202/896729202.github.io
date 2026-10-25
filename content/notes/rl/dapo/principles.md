# DAPO · 原理

**DAPO 在同一采样组内按 token 平均：每个 token 的平均系数相同，长回答因 token 更多而占更大份额。**

## 符号与优势

以下讨论每条回答只有一个结果奖励的情形：同一回答的 token 共用优势 $A_i$。

- $G$：同题采样的回答数；$T_i$：第 $i$ 条回答的有效 token 数；$R_i$：该回答的奖励。
- $A_i$：组内标准化优势；$\rho_{i,t}$：当前模型与采样时旧模型的 token 概率比。
- $\epsilon_{\mathrm{low}}$、$\epsilon_{\mathrm{high}}$：独立设置的下、上裁剪范围。

$$A_i=\frac{R_i-\operatorname{mean}(R_1,\ldots,R_G)}{\operatorname{std}(R_1,\ldots,R_G)}$$

$$\rho_{i,t}=\frac{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}{\pi_{\mathrm{old}}(o_{i,t}\mid q,o_{i,<t})}$$

$q$ 是问题，$o_{i,<t}$ 是该回答此前的 token。标准差为零时需处理除零；该组没有相对奖励学习信号。

## 目标函数：改为 token 平均

$$J_{\mathrm{DAPO}}(\theta)=\mathbb E\Bigg[\sum_{i=1}^{G}\sum_{t=1}^{T_i}\underline{\frac{1}{\sum_{j=1}^{G}T_j}}\min\!\left[\rho_{i,t}A_i,\;\operatorname{clip}(\rho_{i,t},1-\epsilon_{\mathrm{low}},1+\epsilon_{\mathrm{high}})A_i\right]\Bigg]$$

这是最大化目标；$\mathbb E$ 对训练问题及旧策略采样结果取期望。原论文去掉了 GRPO 的参考模型 KL 项。[DAPO 原论文 §2.3、§3.3](https://arxiv.org/html/2503.14476v2)

下划线系数是 $1/\sum_j T_j$：**同组 token 等权，长回答的好、坏模式都不会仅因回答长而被额外稀释。**

token 级平均只改变损失聚合方式，奖励仍按整条回答给出。

代价是长回答占据更大聚合份额；由权重可推知，若其奖励判断错误，影响也可能更大。

## DAPO 还改了什么？

- **独立裁剪**：上、下界分开设置，Clip-Higher 放宽上界以促进探索。
- **动态采样**：在论文的正确性奖励任务中，过滤全对、全错的组，继续采样补足训练批次：

$$0<N_{\mathrm{correct}}<G$$

$N_{\mathrm{correct}}$ 是同组正确回答数。筛选增加生成工作量，但不意味着总训练耗时一定增加。

- **超长奖励处理**：处理截断样本，并对过长输出施加软惩罚，降低奖励噪声。[DAPO 原论文 §3](https://arxiv.org/html/2503.14476v2#S3)

## 与 GRPO 直接对照

| 平均系数 | GRPO | DAPO |
| --- | --- | --- |
| 每个 token | $\frac{1}{G T_i}$ | $\frac{1}{\sum_j T_j}$ |
| 一条回答合计 | $\frac{1}{G}$ | $\frac{T_i}{\sum_j T_j}$ |

**表中仅比较平均系数；实际梯度还取决于优势、概率比、裁剪和各 token 的梯度方向。**

[对照 GRPO：为什么会产生长度偏差？](../../grpo/principles/index.html)
