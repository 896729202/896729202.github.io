# Langfuse 使用：从 Trace 定位 Agent Badcase

Langfuse 是 LLM/Agent 的可观测与评测平台。它把一次请求中的模型调用、工具调用、检索和错误标记串成一条可展开的链路，便于回答“错在哪一步、怎么复现、改完是否变好”。下面的代码和页面示例是本地可复现演示；没有线上生产使用经历时，不应把它表述成线上维护经验。

## Q1. Langfuse 的 Trace 视图是什么？怎么用？

用户只说一句“帮我挑双便宜点的透气跑步鞋”，后台可能依次执行意图识别、抽槽、搜索、重排和答案生成。**Trace 是这一轮请求的完整链路；Observation 是链路中的节点。** 页面通常以树和时间轴展示它们：

- **Session**：同一用户的一段多轮会话；一个 Session 可以包含多个 Trace。
- **Trace**：一轮请求的生命周期。它把共享的 `trace_id`、`session_id` 等信息关联起来。
- **Observation**：Trace 中的观测节点。`Span` 记录业务步骤，`Generation` 记录一次 LLM 调用，`Event` 记录瞬时事件；工具调用和检索也可以作为节点记录。

Generation 里能看到哪些字段取决于 SDK、模型适配器和脱敏配置。常见字段包括模型名、输入摘要、结构化输出、token 用量、延迟和费用；不要默认记录或展示原始 Chain-of-Thought，线上更适合记录**结构化决策摘要、工具参数和错误类型**。

### 用 Trace 定位一个工具参数 Badcase

例如 Trace 展开后是：

```text
product-search
├─ planner (generation)
│  └─ decision_summary: "用户偏好低价、透气；类别=跑步鞋"
│     tool_call: {category: "跑步鞋", max_price: null}
├─ search_product_api (span)
│  └─ input: {category: "跑步鞋", max_price: null}
│     output: {items: [...], returned_count: 8}
└─ answer (generation)
   └─ output: "为你找到几双跑步鞋……"
```

先看 `planner` 的结构化摘要和工具参数，再看 `search_product_api` 的输入输出：如果“低价”被识别了，但 `max_price` 没传，搜索接口只是按收到的参数工作，责任边界就落在**意图到工具 Schema 的映射**，而不是搜索接口或最终话术。

### 一个最小可复现示例

当前 Python SDK 的基本流程是：设置环境变量、用 `start_as_current_observation` 创建嵌套观察、运行请求、`flush()` 发送短进程中的缓存。下面故意制造一个 `max_price: None` 的 Badcase：

```python
from langfuse import get_client, propagate_attributes

langfuse = get_client()  # 读取 LANGFUSE_* 环境变量

with langfuse.start_as_current_observation(
    as_type="span",
    name="product-search",
    input={"query": "帮我挑双便宜点的透气跑步鞋"},
) as root:
    with propagate_attributes(session_id="demo-session-001", user_id="demo-user"):
        with langfuse.start_as_current_observation(
            as_type="generation", name="planner", model="demo-planner"
        ) as planner:
            planner.update(output={
                "decision_summary": "低价 + 透气 + 跑步鞋",
                "tool_call": {"category": "跑步鞋", "max_price": None},
            })

        with langfuse.start_as_current_observation(
            as_type="span",
            name="search_product_api",
            input={"category": "跑步鞋", "max_price": None},
        ) as search:
            search.update(output={
                "items": [{"id": "shoe-101", "price": 999}],
                "returned_count": 1,
            })

        root.update(output={"status": "slot_missing"})
        langfuse.score_current_trace(
            name="error_type",
            value="slot_missing",
            data_type="CATEGORICAL",
            comment="低价意图未映射到工具参数",
        )

langfuse.flush()
```

运行后，Langfuse 中会出现一条 Trace 和三个嵌套 Observation；每条记录都有可关联的 ID、输入/输出、父子关系和时间信息。Generation 是否包含 token、费用等 usage 字段，取决于实际 LLM 集成是否上报。`score_current_trace` 会把 `error_type=slot_missing` 挂到这条 Trace 上。

接下来在界面里给这条 Trace 加标签或 Score，使用 **Add to Dataset** 保存输入、上下文和期望结果；修正 Schema 或 Prompt 后，用同一 Dataset 跑一次 Experiment，对比 `slot_missing` 比例、工具参数命中率和答案质量。Dataset/Experiment 的核心就是“测试样本 + 一次应用变体 + 评估器”，而不是把 Trace 当成模型训练数据直接喂进去。

## Q2. Think 识别出“便宜”，但没传 `max_price`，怎么解决？

这不是简单加一句 Prompt 的问题，而是**模糊偏好到精确 Schema 的映射失败**，还可能有“决策摘要到工具调用”的信息丢失。用户说“便宜”没有给出金额，模型若把 `max_price` 定义成必填数字，就可能选择留空，也可能猜一个错误数字。

### 第一层：先改 Schema，让表达能力匹配用户语言

保留明确数字使用的 `max_price: number`，另加模糊偏好字段，例如：

```json
{
  "price_preference": "low_budget",
  "sort_by": "price_asc",
  "max_price": null
}
```

后端再根据“跑步鞋”“羽绒服”等类目的价格分位规则，把 `low_budget` 转成可解释的价格带。明确说“300 元以内”时，才填 `max_price=300`。这样既避免瞎编数字，也保留了搜索策略。

### 第二层：把 Schema 说明和参数自检放在一起

在字段描述中写清楚：有明确数字就提取；只有“便宜、平价、学生党”等模糊偏好时，填 `price_preference`，不要猜金额。调用工具前，让模型输出一行结构化检查：

```text
价格原话：便宜点 → price_preference=low_budget, max_price=null
类别原话：跑步鞋 → category=跑步鞋
```

这里记录的是可审计的决策摘要，不需要保存原始思维链。这样可以直接检查“识别到的约束”和“实际发出的参数”是否一致。

### 第三层：用 Trace 数据做后训练和回归评测

从 Langfuse 中筛出“摘要里有低价意图、工具参数却为空”的轨迹：

1. 把原错误 Tool Call 作为 rejected；用规则、人工或独立模型补全后的调用作为 chosen，构造 DPO 样本。
2. 或在 GRPO 中增加一致性奖励：低价词命中且 `price_preference`、`max_price`、`sort_by` 全为空时惩罚；正确映射时奖励。
3. 每次改 Prompt、Schema 或模型，都在固定 Dataset 上对比参数命中率、零召回率和最终答案质量，避免只看总奖励上涨。

## 面试时怎么描述这段经历？

如果没有在线生产使用经历，可以这样说：

> “我没有把自己包装成线上 Langfuse 维护者，但我做过一个本地演示：每次请求创建 Trace，给 planner、搜索工具和回答生成分别记录 Generation/Span，记录输入摘要、工具参数、返回条数和耗时；再给 Trace 加 `slot_missing` Score，加入 Dataset，跑一次回归评测。我能解释 Trace、Observation、Score、Dataset 的关系；线上字段和 SDK 版本要以团队配置为准。”

这比声称“维护过线上 Langfuse”更稳。面试官继续追问时，直接展示上面的链路：**创建 Trace → 展开节点 → 找到漏传参数 → 打分 → 加入 Dataset → 对比修复前后指标**。

## 参考

- [Langfuse Python/JS SDK 概览](https://langfuse.com/docs/observability/sdk/overview)
- [Scores via SDK/API](https://langfuse.com/docs/evaluation/evaluation-methods/scores-via-sdk)
- [使用 Dataset 做离线评测](https://langfuse.com/docs/evaluation/get-started/offline)
