# 大模型 LoRA 与微调显存面试复习手册

## 模块一：核心知识点与底层原理速记

### 1. 显存由哪四部分构成？

- **模型权重（Weights）**：前向计算底座。FP16/BF16 下，每个参数吃 **2 字节**。
- **梯度（Gradients）**：可训练参数的反向传播导数。按 FP16/BF16 存储时每个参数 **2 字节**；实际 dtype 不一定等于底座权重 dtype。
- **优化器状态（Optimizer States）**：两份 FP32 动量合计 **8 字节/可训练参数**；若训练框架另存 FP32 主权重，再加 4 字节，此时合计 $4 + 4 + 4 = \mathbf{12\text{ 字节}}$。并非所有 AdamW 实现都额外保存主权重。
- **激活值（Activations）+ 碎屑缓存**：前向中间结果及分配器开销。激活通常随 Batch Size 近似线性增加；朴素注意力矩阵随序列长度平方增长，但 FlashAttention 避免完整存储它。梯度检查点用重计算换空间，不会消除所有激活。
- **静态显存示例（全量微调：16-bit 权重和梯度、FP32 双动量及主权重）**：

  $$\text{每个参数总开销} = 2 (\text{权重}) + 2 (\text{梯度}) + 12 (\text{优化器}) = \mathbf{16\text{ 字节}}$$

  - 7B 模型静态占用：$7 \times 16 = \mathbf{112\text{ GB}}$
  - 8B 模型静态占用：$8 \times 16 = \mathbf{128\text{ GB}}$

### 2. LoRA 的数学原理与维度推导

- **前向计算公式**：

  $$\text{输出} = W_0 x + \Delta W x = W_0 x + \frac{\alpha}{r} (B \cdot A) x$$

- **低秩拆解（为什么新增参数极少？）**：
  - 原矩阵 $W_0$ 维度为 $d \times k$（例如 $4096 \times 4096 \approx 1677\text{万}$ 参数）。
  - 矩阵 $A$（负责降维压缩）：维度为 $r \times k$（$8 \times 4096 \approx 3.2\text{万}$ 参数）。
  - 矩阵 $B$（负责升维还原）：维度为 $d \times r$（$4096 \times 8 \approx 3.2\text{万}$ 参数）。
  - **LoRA 新增参数量公式**：

    $$\text{Params}_{\text{LoRA}} = (d \times r) + (r \times k)$$

    仅占原参数量的不到 **0.4%**。

- **初始化设计机制**：
  - **$A$ 随机初始化**：原论文使用高斯随机；PEFT 默认使用 Kaiming-uniform。关键是不能将 A、B 同时设零，否则两者的损失梯度都会为零。
  - **$B$ 设为全 0**：充当阀门，使初始时刻 $\Delta W = B \times A = 0$，**保证 Step 0 模型输出完全等于原预训练底座**，不冲击原有能力。

## 模块二：高频面试真题与标准答题模板

### Q1：LoRA 是什么？它的核心原理与初始化机制是怎样的？

**参考答案**：

> “LoRA 是一种参数高效微调方法（PEFT）。它的核心假设是**模型在特定下游任务上的参数更新矩阵具有很低的本征秩**。
>
> 具体实现上，它完全冻结原始权重 $W_0$，旁路引入低秩矩阵 $A$ 和 $B$（维度分别为 $r \times k$ 与 $d \times r$），用两者的乘积 $B \cdot A$ 来模拟参数增量 $\Delta W$。
>
> 常规初始化时，$A$ 随机、$B$ 全零；原论文使用高斯随机 A，PEFT 默认使用 Kaiming-uniform。这样在初始步（Step 0）时，增量 $B \times A = 0$，使模型输出完全与原预训练模型对齐，保证平滑微调。训练第 1 步时，因为 $A$ 非零，$B$ 优先获取非零梯度脱离 0，随后两者共同学习。”

### Q2：微调时 Rank（$r$）和 Scaling Factor（$\alpha$）怎么选？有什么考量？

**参考答案**：

> “1. **关于 Rank（$r$）**：
>
> - 不是盲目越大越好，而是由任务复杂度决定。
> - 格式对齐、分类、简单问答等任务可从 $r=8 \sim 16$ 起步；复杂任务可再尝试 $r=32 \sim 64$，最终由验证集决定。
> - 增大 rank 会增加容量、参数量和训练开销；是否过拟合或遗忘，还取决于数据、学习率和训练时长，不能只由 rank 判定。
>
> 2. **关于 Scaling Factor（$\alpha$）**：
>
> - 它在前向计算中以系数 $\frac{\alpha}{r}$ 缩放增量 $BA$。
> - 它控制低秩分支的缩放幅度，也影响梯度尺度；固定比例便于对比，但**不保证换 rank 后学习率无需重调**。
> - 工程上通常保持 $\alpha = r$ 或 $\alpha = 2r$（即比例保持为 1 或 2）。”

### Q3：为什么说 LoRA 能极大节约显存？参数量不是还有原模型加上 B 和 A 吗？

**参考答案**：

> “全量训练除了权重，还要为可训练参数保存梯度和优化器状态；这些是显著开销，但长序列下激活也可能成为主要开销。
>
> 全量微调时，原模型所有参数都要分配梯度和优化器状态（按模块一的示例口径，8B 静态开销约 128GB）。而 LoRA **完全冻结了原模型的全部参数**，从训练开始就冻结且梯度为 None 的底座参数，不累积权重梯度，也不为其新建 AdamW 动量；但反向传播仍可能穿过冻结层，传向可训练的 LoRA。LoRA 仅引入了 $(d \times r + r \times k)$ 的低秩矩阵，将梯度和状态的主要开销缩小到适配器规模；具体占比取决于 rank、挂载层和额外可训练模块，不是固定低于 0.5%。”

### Q4：手头只有单张 24G 显存的 RTX 4090，要跑 Llama-3-8B（FP16/BF16），全量微调行不行？LoRA 能不能行？

**参考答案**：

> “1. **标准 AdamW、训练状态全部驻卡：不行**：
>
> - 8B 模型静态显存为 $8 \times (2\text{权重} + 2\text{梯度} + 12\text{优化器}) = 128\text{ GB}$。
> - 这一示例静态预算已超过 24GB，尚未计入激活；卸载、分片或其他优化器是另外的方案，不能据此固定推断至少需要几张卡。
>
> 2. **LoRA：合适配置下可能可行，要实测峰值**：
>
> - 按约 8B 参数估算，16-bit 底座权重约 16GB；剩余空间要容纳适配器、梯度、状态、激活和缓存。小 batch、短序列与检查点有助于放入 24GB，**18～20GB 不是通用保证**。”

### Q5：微调过程中即使开了 LoRA 依然爆显存（OOM），训练参数里优先调整哪些？

**参考答案**：

> “1. **开启梯度检查点（Gradient Checkpointing）**：用重算时间换空间，不保留大部分中间层激活值，立即砍掉几 GB 到十几 GB 显存。
>
> 2. **压低单卡 Batch Size + 增大梯度累加步数（Gradient Accumulation Steps）**：设 `per_device_train_batch_size=1`，通过增大累加步数维持整体等效 Batch Size。
>
> 3. **截断最大序列长度（cutoff_len / max_seq_length）**：朴素注意力矩阵占用为 $O(L^2)$；采用 FlashAttention 等实现后不能把全部激活一概按平方估算。缩短上下文仍通常可以降低显存。
>
> 4. **升级为 QLoRA（4-bit 量化微调）**：用 bitsandbytes 将原模型权重压到 4-bit，8B 的纯 4-bit 编码约 4GB，另有量化元数据及未量化层；总训练显存仍取决于激活与配置，不能保证低于 10GB。”

### Q6：训练好的 LoRA 权重，线上高并发部署时推荐怎么挂载？多业务如何设计？

**参考答案**：

> “1. **单任务/固定场景：权重静态合并（Merge-and-Unload）**
>
> - 部署时直接调用 `model.merge_and_unload()`，将 $W_{\text{new}} = W_0 + \frac{\alpha}{r} (BA)$ 一次性加回主干权重并保存。
> - **优势**：推理时不需要同时走两条旁路计算，**零额外推理延迟，零额外显存占用**。
>
> 2. **多业务场景（如一套客服、一套润色）：动态挂载架构（如 vLLM / S-LoRA）**
>
> - 显存中只常驻一份通用的 Base Model 骨干。
> - 各业务的小型 LoRA Adapter 权重常驻内存或显存缓存池中，推理引擎在 Batch 处理请求时根据任务路由动态挂载对应的 LoRA 算子，实现一份大底座支持上百种异构业务的高并发请求。”

## 模块三：LoRA 实操速记与源码追问

**顺序记忆：加载底座 → 注入 LoRA → 检查可训练参数 → 创建优化器 → 反向传播 → 检查更新 → 保存适配器。**

### 1. 配置速记：哪些是开关，哪些是经验值？

- **冻结**：`p.requires_grad = False` 不再为该参数累积新梯度；`True` 只是允许求梯度，真正更新还需要参与 loss、进入优化器并执行 `step()`。`model.eval()` 不等于冻结；也不要用 `torch.no_grad()` 包住整个 LoRA 训练前向。
- **秩 `r`**：8 / 16 / 32 / 64 是常见候选；单个矩阵新增 `r × (d + k)` 个参数，效果看验证集，不是越大越好。
- **缩放 `lora_alpha`**：普通 LoRA 使用 `alpha / r`；`alpha=r` 或 `2r` 可作起点，不是固定最优值。
- **挂载层 `target_modules`**：`"all-linear"` 可覆盖 Attention + MLP 的线性层；PEFT 对 `PreTrainedModel` 会排除输出层。显存紧时也可只选 `q_proj`、`v_proj`，具体名字先查 `model.named_modules()`。
- **学习率**：LoRA **SFT** 可从 `1e-4`～`2e-4` 尝试；“比全量高约 10 倍”是经验起点，不是定律，也不直接照搬给 DPO / GRPO。

依据：[PyTorch 梯度控制](https://docs.pytorch.org/docs/main/notes/autograd.html#setting-requires-grad)、[PEFT LoRA 配置](https://huggingface.co/docs/peft/package_reference/lora)、[TRL 参数建议](https://huggingface.co/docs/trl/peft_integration)。

### 2. 注入 LoRA，再创建优化器

以下是**普通 LoRA 的核心片段**，假定 `base_model` 已加载到训练设备；不是完整训练脚本或个人实测结果。

```python
import torch
from peft import LoraConfig, get_peft_model

base_model.requires_grad_(False)  # 展示冻结；PEFT 也会处理底座冻结
config = LoraConfig(
    task_type="CAUSAL_LM",
    r=16,
    lora_alpha=32,               # 本例 alpha/r = 2
    target_modules="all-linear",
    lora_dropout=0.05,
    bias="none",                # 不额外训练原模型 bias
)
model = get_peft_model(base_model, config)
model.print_trainable_parameters()

trainable = [p for p in model.parameters() if p.requires_grad]
assert trainable, "没有可训练参数，请检查 LoRA 是否正确注入"
optimizer = torch.optim.AdamW(trainable, lr=1e-4)
```

**自检不只看比例**：确认可训练参数名称包含 `lora_A` / `lora_B`。0.1%～1% 仅是常见范围；全线性层、高 rank 或额外训练 embedding / lm_head 都可能超出。不要在注入 LoRA **之前**创建优化器，也不要在注入之后再次冻结整个 `model`。

**初始化追问**：原论文可用 A 高斯随机、B 全零；PEFT 默认是 **A：Kaiming-uniform，B：全零**。显式设 `init_lora_weights="gaussian"` 才选择高斯方式。[配置与初始化说明](https://huggingface.co/docs/peft/package_reference/lora)

### 3. 怎么确认真的在训练，而不是只看 loss？

检查一个可训练的 B 矩阵：**有梯度吗？执行 `step()` 后数值变了吗？** 假定 `batch` 已放到同一设备，包含 `input_ids`、`attention_mask`、`labels`；答案监督时，提示词及 padding 的 `labels` 设为 `-100`。

```python
model.train()
model.config.use_cache = False
optimizer.zero_grad(set_to_none=True)
b = next(p for n, p in model.named_parameters()
         if "lora_B" in n and p.requires_grad)
before = b.detach().clone()

loss = model(**batch).loss
loss.backward()
assert b.grad is not None, "B 没收到梯度，请检查计算图"
print("B 梯度范数:", b.grad.float().norm().item())
optimizer.step()
print("B 是否更新:", not torch.equal(before, b.detach()))
```

**首步易误判**：默认 B=0 时，A 的**损失梯度**为 0 是正常的；B 通常先获得非零梯度。`grad is None` 与“梯度张量全零”不同；不要要求首步所有 LoRA 梯度都非零。

训练结束用 `model.save_pretrained("lora_adapter")` 保存适配器；加载仍需对应底座。继续训练已有适配器时，检查 `PeftModel.from_pretrained(..., is_trainable=True)`。[自检说明](https://huggingface.co/docs/peft/developer_guides/troubleshooting) · [保存与加载](https://huggingface.co/docs/peft/quicktour)

### 4. AdamW 源码纠错：不过滤就白占 56GB？

**不是。显式过滤值得保留，但不是为了阻止 AdamW 给所有传入参数预分配状态。** 标准 PyTorch AdamW 对 `grad is None` 的参数跳过更新；状态是在首次有梯度的 `step()` 中按需创建的。[源码中的惰性初始化](https://github.com/pytorch/pytorch/blob/main/torch/optim/adam.py)

```python
# AdamW/Adam 状态初始化的简化逻辑，省略 step 等字段与更新公式
for p in group["params"]:
    if p.grad is None:
        continue
    if not state[p]:
        state[p]["exp_avg"] = torch.zeros_like(p)
        state[p]["exp_avg_sq"] = torch.zeros_like(p)
```

**显存记法**：两份 **FP32** 动量共 `8 × N` 字节，N 是实际建立状态的参数量。7B 全部建立 FP32 动量才约 **56GB**；并不是“把冻结参数传进去就增加 56GB”。1000 万可训练参数对应约 **80MB** 动量，不含权重、梯度和激活；实际还要看状态 dtype、优化器实现与配置。FP32 主权重副本是另一项，不能默认所有 AdamW 都额外保存。

**为什么仍建议过滤？** 明确优化范围，便于排查漏冻、误训与参数分组。训练中途才冻结时，旧梯度和已分配状态不会自动消失；需清理旧 `grad`，必要时安全移除对应状态或重建优化器。梯度全零时，动量或 weight decay 仍可能更新参数，不能用“清零梯度”替代冻结。[`None` 与零梯度的区别](https://docs.pytorch.org/docs/main/generated/torch.optim.AdamW.html#torch.optim.AdamW.zero_grad)

> **面试收尾句**：我会先检查冻结与 LoRA 挂载，再过滤可训练参数创建优化器；除了看 loss，还检查梯度、参数是否更新和适配器能否正确加载。显存节省主要来自底座不再建立训练所需的梯度与优化器状态，而不是过滤列表本身产生了几十 GB 的魔法收益。

补充核对：[FlashAttention 的显存机制](https://arxiv.org/abs/2205.14135)。以上显存按十进制 GB / MB 估算，不等同于 GiB / MiB。
