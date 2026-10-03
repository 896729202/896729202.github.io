# 实验归档维护说明

首页仍只有「毕业论文」「八股文」两个主板块；实验放在毕业论文内。

```text
thesis/experiments/
  index.html
  2026-09-29-endogs/
    index.html
    README.md
    endogs_experiment_log_2026-09-29.xlsx
```

## 数据与构建

`content/experiments/index.json` 是实验档案索引；每份档案的原表提取值在同目录的 `<slug>.json` 中，保留工作表名、空值和来源。原始工作簿放在对应日期文件夹中，SHA-256 与文件大小写入数据文件。

运行 `python3 scripts/build.py` 一次即可生成原有页面与实验页面；Windows 可使用 `python`。构建器原有实现保留为 `scripts/build_core.py`，实验扩展为 `scripts/build_experiments.py`。扩展没有增加运行时 CDN、追踪或额外 Python 构建依赖。

新增归档时创建新的日期 slug 和数据文件，将真实原文件放入对应文件夹，更新索引，再构建并提交生成 HTML。文件夹的日期必须说明是运行日期还是记录更新日期。不要按上传时间猜测实验执行日期。

论文正文仍用 `content/theses.json` 管理。实验档案不计入论文篇数，未完成的候选方案不计入实验结果。

发布前核验原始文件哈希、站内链接和表格空值；不要补造日志，不把服务器本地证据路径变成虚假下载链接。
