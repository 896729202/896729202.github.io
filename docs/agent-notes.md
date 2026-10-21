# Agent 栏目与学习文档

`notes/index.html` 中的 Agent 保持为一个专题入口；子文档不在八股文目录额外平铺。`notes/agent/index.html` 使用整行文档按钮，首篇「RAG 检索与 Reranker 重排底层原理」是一篇包含 7 个问题的长文，不拆成 7 个页面。

## 内容源

- `content/notes/agent/index.json` 使用 `schema_version: 1`，包含栏目 `title`、`description` 和 `entries`。
- 每个条目包含 `slug`、`title`、`summary`、`date`、`tags` 与 `questions`；`questions` 保存目录用的简短标题。
- 正文位于 `content/notes/agent/<slug>.md`。一级标题由页面标题替代，二级标题须依次标为 `Q1`、`Q2` 等；三级标题作为各问题的子节。
- `rag-reranker` 条目必须有 7 个目录标题，正文也必须恰有 7 个二级标题，顺序为 Q1–Q7。构建时验证，计数不凭空填写。
- 原有 `content/notes/agent.md` 保留为栏目简介来源。仅一级标题时不显示简介；若后续增加正文，构建器会显示，不会静默丢弃。

## 构建与展示

`scripts/agent_notes.py` 由完整构建在 RL 栏目之后调用，生成栏目、每篇文档、Agent 卡片状态与搜索资料。文档使用现有文章布局：桌面目录、手机折叠目录、`q1`–`q7` 锚点、返回 Agent、下载整理稿、复制链接及打印。只复用现有前端交互，不引入新的脚本。

`build_core.render_markdown(source, tables=True)` 为 Agent 正文启用独立的 Markdown 表格渲染器；默认 `tables=False` 保持旧页面行为。公式仍使用已有 MathJax / MathML 缓存流程。`assets/agent-notes.css` 只加载于 Agent 栏目与文档，负责整行入口、局部表格滚动及文章细节；较长公式和代码沿用局部滚动，不扩大整页宽度。

Agent 页面引用的附加样式带有根据文件内容生成的 `?v=` 版本号。样式修改后，构建会更新地址，避免浏览器沿用旧缓存而让矩阵图退化为纯文字；请保留版本生成逻辑。

Agent 卡片显示真实文档数，全文加入同一个 Agent 搜索项。八股文目录仍为「1 篇笔记＋2 个专题」，首页和侧栏的实际笔记数不因专题内部文档增加而变化；搜索清空后仍显示 LoRA、强化学习、Agent 三个条目。

运行 `python scripts/build.py` 后检查生成页面：单个整行入口、7 个问题锚点和两套目录链接、下载路径、移动端表格与公式、按全文搜索命中 Agent、旧简介保留，以及再次完整构建没有差异。提交内容源、构建脚本、样式和实际变化的生成页面，不能只修改 HTML。
