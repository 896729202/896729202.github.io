# GRPO · 原理

**GRPO 先在每条回答内平均，再对回答平均：每条回答等权，长回答的单个 token 权重更小。**

## 符号与优势

以下讨论每条回答只有一个结果奖励的情形：同一回答的 token 共用优势 $A_i$。

- $G$：同题采样的回答数；$T_i$：第 $i$ 条回答的有效 token 数；$R_i$：该回答的奖励。
- $A_i$：奖励相对同组均值的标准化优势。
- $\rho_{i,t}$：当前模型与采样时旧模型，在相同上下文下生成该 token 的概率比。
- $K_{i,t}$：相对参考模型的逐 token KL 惩罚估计；$\beta$：惩罚系数；$\epsilon$：裁剪范围。

$$A_i=\frac{R_i-\operatorname{mean}(R_1,\ldots,R_G)}{\operatorname{std}(R_1,\ldots,R_G)}$$

$$\rho_{i,t}=\frac{\pi_\theta(o_{i,t}\mid q,o_{i,<t})}{\pi_{\mathrm{old}}(o_{i,t}\mid q,o_{i,<t})}$$

$q$ 是问题，$o_{i,<t}$ 是该回答此前的 token。标准差为零时需处理除零；该组没有相对奖励学习信号，KL 项仍可能产生梯度。

## 目标函数：看平均系数

将原式两层平均展开，得到等价的最大化目标：

$$J_{\mathrm{GRPO}}(\theta)=\mathbb E\Bigg[\sum_{i=1}^{G}\sum_{t=1}^{T_i}\underline{\frac{1}{G\,T_i}}\Big(\min\!\left[\rho_{i,t}A_i,\;\operatorname{clip}(\rho_{i,t},1-\epsilon,1+\epsilon)A_i\right]-\beta K_{i,t}\Big)\Bigg]$$

$\mathbb E$ 对训练问题及旧策略采样结果取期望；旧策略用于概率比，参考模型用于 KL 约束。[GRPO 原论文 §4.1](https://arxiv.org/html/2402.03300v3#S4.SS1)

## 长度带来的影响

下划线系数是 $1/(G T_i)$：**每条回答总权重为 $1/G$，回答越长，单个 token 分到的权重越小。**

在优势、概率比等其他条件相同时：

- **正优势**：短回答的单 token 正向更新更强，长回答的有用模式可能学习不足。
- **负优势**：长回答的单 token 惩罚更弱，冗长错误可能抑制不足。

所以不能简单说“GRPO 只偏爱短回答”。[长度偏差分析 §3.1](https://arxiv.org/html/2503.20783v1#S3.SS1)

| 平均系数 | GRPO | DAPO |
| --- | --- | --- |
| 每个 token | $\frac{1}{G T_i}$ | $\frac{1}{\sum_j T_j}$ |
| 一条回答合计 | $\frac{1}{G}$ | $\frac{T_i}{\sum_j T_j}$ |

**表中仅比较平均系数；实际梯度还取决于优势、概率比、裁剪和各 token 的梯度方向。**

[继续看 DAPO：改为 token 平均](../../dapo/principles/index.html)
