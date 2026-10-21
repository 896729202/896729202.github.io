# RAG 检索与 Reranker 重排底层原理

本文讨论常见的“单向量 Bi-Encoder 召回＋双向 Cross-Encoder 重排”。用户问题记为 $q$，文档记为 $D$；注意力中的 $Q,K,V$ 是模型内部的矩阵。

## Q1. 为什么有了 RAG 还需要 Reranker？

**因为常见 RAG 的向量检索用“一维向量”快速找候选，Cross-Encoder Reranker 用“二维 token 交互”进一步判断候选是否回答了问题。**

- **“一维”检索**：问题和文档各自压缩成一个向量，再计算相似度，适合从大量文档中快速召回。
- **“二维”重排**：问题和候选文档放在一起，逐 token 建立关联，更细致地处理否定、数字和条件。

这里的“一维”特指 RAG 中的**单向量检索**，不是说 RAG 本身是一维模型；一个 $d$ 维向量仍有 $d$ 个特征维度。Reranker 是可选的精排步骤，只能重排已召回的候选。

## Q2. 拼接是一条序列，N×M 的交互矩阵从哪里来？

**二维交互来自注意力中的 $QK^{\mathsf T}$，拼接本身只增加序列长度。**

忽略特殊 token，问题长 $N$、文档长 $M$，总长度 $T=N+M$。单个注意力头中，$Q$ 和 $K$ 的形状都是 $T\times d_k$，因此：

$$(T\times d_k)(d_k\times T)=T\times T.$$

每一行与每一列分别对应一个 token，两者的交点就是配对分数。完整的 $T\times T$ 矩阵分成四块：

<figure class="attention-matrix" aria-labelledby="matrix-title" aria-describedby="matrix-caption">
  <p class="matrix-title" id="matrix-title">QK<sup>T</sup>：完整的 T × T 打分矩阵</p>
  <p class="matrix-example">例：N = 3，M = 5，T = 8；忽略特殊 token</p>
  <p class="matrix-axis">行 Q 发起匹配 · 列 K 被匹配</p>
  <div class="matrix-layout">
    <span class="matrix-corner">行 Q ↓</span>
    <div class="matrix-columns"><span>问题 · N = 3</span><span>文档 · M = 5</span></div>
    <div class="matrix-rows"><span>问题<br>N = 3</span><span>文档<br>M = 5</span></div>
    <div class="matrix-grid">
      <div class="matrix-block matrix-qq"><span><strong>N × N</strong><small>3 × 3</small></span></div>
      <div class="matrix-block matrix-qd"><span><strong>N × M</strong><small>3 × 5</small></span></div>
      <div class="matrix-block matrix-dq"><span><strong>M × N</strong><small>5 × 3</small></span></div>
      <div class="matrix-block matrix-dd"><span><strong>M × M</strong><small>5 × 5</small></span></div>
    </div>
  </div>
  <div class="matrix-legend">
    <p><i class="matrix-qq" aria-hidden="true"></i><span><b>绿色 · 问题 → 问题</b>问题内部的关联</span></p>
    <p><i class="matrix-qd" aria-hidden="true"></i><span><b>蓝色 · 问题 → 文档</b>问题 token 匹配文档 token</span></p>
    <p><i class="matrix-dq" aria-hidden="true"></i><span><b>橙色 · 文档 → 问题</b>文档 token 匹配问题 token</span></p>
    <p><i class="matrix-dd" aria-hidden="true"></i><span><b>紫色 · 文档 → 文档</b>文档内部的关联</span></p>
  </div>
  <figcaption id="matrix-caption">每个小格代表一对 token 的配对分数；颜色只区分交互区域，不表示分数大小。蓝色与橙色是跨文本交互。</figcaption>
</figure>

输入 ID 写成 $1\times T$ 时，前面的 1 表示批大小，与注意力矩阵的行数无关。

## Q3. Bi-Encoder 是什么？与 Cross-Encoder 有何不同？

**Bi-Encoder 就是常见 RAG 向量检索中，分别把问题和文档转换成向量的 Embedding 编码架构。**

“双塔”就是两条编码路径：**一条处理问题，另一条处理文档，编码时互不读取对方。** 两条路径可以共用同一套模型参数，并不一定是两个不同的模型。

~~~text
文档 → 文档编码器 → 文档向量（提前存入向量库）
问题 → 问题编码器 → 问题向量（用户提问时计算）
                    ↓
            比较两个向量，召回候选
~~~

**Cross-Encoder 则把“问题＋候选文档”作为一对输入，联合编码后直接输出相关性分数。** 前者适合大规模召回，后者常用于候选重排。Reranker 是重排用途的名称，Cross-Encoder 是它的一种常见实现。

## Q4. Cross-Encoder 如何实时计算相关性分数？

**把问题和候选文档联合编码，再由打分头输出这一个文本对的相关性分数。**

以 BERT 类模型为例：

~~~text
[CLS] 问题 [SEP] 文档 [SEP]
  → token 表示
  → 多层双向自注意力：问题与文档相互影响
  → 读取 [CLS] 等联合表示
  → 打分头 → 相关性分数
~~~

关键发生在联合注意力：**同一篇文档与不同问题配对，其隐藏表示会随问题改变。** 所以每个候选都需要完成当前文本对的交互计算。

打分头可直接输出 logit；若再做 sigmoid，才映射到 0～1。

## Q5. 为什么双塔能提前算文档，而交叉编码器通常需要在线计算？

**能否提前算，取决于文档表示是否依赖当前问题。**

$$s_{\mathrm{bi}}(q,D)=f(q)^{\mathsf T}g(D),\qquad s_{\mathrm{cross}}(q,D)=F(q,D).$$

- **双塔**：$g(D)$ 只依赖文档，可以离线编码并建立索引。在线只需编码问题，再检索已有文档向量。
- **交叉编码器**：$F(q,D)$ 依赖整个文本对，通常无法用一个与问题无关的文档向量替代完整交互。在线需为每个候选联合评分。

因此常见流程是“全库召回 → 少量候选重排”，把昂贵的联合计算限制在候选集内。文档预处理仍可提前完成；双塔的文档缓存则要求文本、模型和编码配置保持一致。

## Q6. Query＋Document 是向量相加吗？拼接后只生成 Q 吗？

**这里的“＋”表示组合文本序列；组合后的全部 token 同时生成注意力的 Q、K、V。**

通常把问题与文档交给 tokenizer，按模型格式添加分隔符，得到一条序列，再形成输入表示 $X$。这一步不是两个句向量逐元素相加。

在每个自注意力层中，整条序列的隐藏表示分别做三次投影：

$$Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V.$$

**Q、K、V 都包含问题和文档的所有位置。** 用户的 Query 是输入文本；注意力的 Q 是每个 token 用来参与匹配的投影矩阵，二者不能等同。

随后用 $QK^{\mathsf T}$ 算配对分数，缩放并做 softmax，再对 V 加权汇聚。下一层基于更新后的隐藏状态重新生成 Q、K、V。

## Q7. Q、K、V 有几行几列？随机参数为什么能学会这些作用？

**行数等于 token 数，列数取决于每个头的特征宽度；计算角色由公式规定，有用的参数由训练学得。**

设序列长 $T$、模型宽度为 $d_{\mathrm{model}}$，忽略 batch 维。单个注意力头的形状是：

| 对象 | 形状 |
| --- | --- |
| 输入 $X$ | $T\times d_{\mathrm{model}}$ |
| 参数 $W_Q,W_K$ | $d_{\mathrm{model}}\times d_k$ |
| 参数 $W_V$ | $d_{\mathrm{model}}\times d_v$ |
| 投影 $Q,K$ | $T\times d_k$ |
| 投影 $V$ | $T\times d_v$ |
| 注意力权重 | $T\times T$ |

多头注意力中，每个头都有自己的投影与交互；常见设置为 $d_k=d_v=d_{\mathrm{model}}/H$，其中 $H$ 是头数。

$$\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\left(\frac{QK^{\mathsf T}}{\sqrt{d_k}}\right)V.$$

这个公式已经规定了分工：**Q 发起匹配，K 提供被匹配的特征，两者决定注意力权重；V 提供按权重汇聚的内容。** 这里省略了注意力掩码。

### 为什么训练后能完成这些分工？

**角色由计算路径规定，匹配和提取内容的能力由任务误差训练出来。真正更新的是 $W_Q,W_K,W_V$；Q、K、V 是每次输入经过这些参数算出的中间结果。**

以一个简化的相关性训练样本为例：问题是“促销商品能退吗？”，文档是“促销商品不支持退货”。这段文档回答了问题，因此相关性标签为 $y=1$，并不是说“允许退货”。

1. **前向计算**：文本对经过投影、注意力和打分头，得到分数。假设经 sigmoid 后预测为 $p=0.12$。
2. **计算误差**：用二元交叉熵衡量预测与标签的差距。此例 $L=-\log p$，把相关文档打得太低会产生较大损失。
3. **反向传播**：梯度从损失经过打分头和各层传回。经过 $QK^{\mathsf T}$ 与 softmax 的分支，告诉 $W_Q,W_K$ 怎样改变匹配；经过被加权汇聚的 V 分支，告诉 $W_V$ 怎样改变传递的内容。
4. **更新参数**：优化器根据各自梯度调整参数。以梯度下降为例：

$$W_Q\leftarrow W_Q-\eta\frac{\partial L}{\partial W_Q},$$

$W_K,W_V$ 同理，$\eta$ 是学习率。对大量相关与不相关样本重复这个过程，模型便能逐渐学到对最终判断有用的匹配和内容表示。[反向传播的计算依据](https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html)

**损失监督的是最终判断，并没有给每个 Q、K、V 单独贴语义标签。** 因此不能断言某一对词的注意力一定升高，或某一维固定代表“否定”。上面的数字只是训练示例；实际下载的 BGE Reranker 已有训练好的参数，重排训练通常基于已有模型继续微调。[BGE 模型与训练说明](https://huggingface.co/BAAI/bge-reranker-v2-m3)

---

**参考资料：** [检索与重排流程](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html) · [Cross-Encoder 与分数](https://sbert.net/docs/cross_encoder/usage/usage.html) · [Transformer 注意力公式](https://arxiv.org/html/1706.03762v7#S3.SS2) · [BERT 输入与联合编码](https://arxiv.org/abs/1810.04805)
