
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
