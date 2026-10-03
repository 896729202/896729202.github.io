# 实验归档维护说明

首页仍只有「内窥镜三维重建」「八股文」两个主板块；实验放在内窥镜三维重建内。

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

## 精简摘要格式（schema_version 2）

通用渲染实现位于 `scripts/experiment_summaries.py`；旧工作簿渲染器保留，统一构建入口负责调用。

新实验无需Excel。在 `content/experiments/<日期-主题>.json` 编写：

```json
{
  "schema_version": 2,
  "groups": [{
    "title": "一个研究问题",
    "what": "简述目的、改动和对照；注明必要的场景、步数和重复次数。",
    "tables": [{
      "caption": "验证集；评价区域与单位",
      "headers": ["方法", "指标与方向"],
      "rows": [["baseline", "真实数值"], ["改进", "真实数值"]]
    }],
    "conclusion": "实际支持的结论和必要限制。",
    "note": "可选：影响结论理解的口径差异。"
  }],
  "source_note": "来源：实验报告、CSV或作者确认的实验汇总。"
}
```

索引保留 `slug/date/title/subtitle/summary`，新增可选 `data_file` 和
`date_kind`（例如“记录日期”）；无原始下载文件时省略 `source_file`。
每个表格行与表头列数必须相同。长文字表可设置 `wrap: true`；数值表窄屏可横向滚动。
构建自动生成详情页与可下载的 `summary.json`。来源脚注只写非敏感说明，不上传原始实验目录。

原工作簿格式继续支持，原 JSON 与 Excel 不变。已有9月29日页面改用独立的
`2026-09-29-endogs-summary.json`，旧数据仍保留并校验Excel；不要覆盖旧协议分数。

新增后运行 `python3 scripts/build.py`，同时提交内容源和生成HTML/摘要数据。
缺失数值写“未提供”；均值±标准差写明重复单位。全像素/组织块、真值误差/先验一致性、
无适配/部分观测适配分开报告。只展示已完成的比较，不收录待执行方案或GPU管理台账。
来源为作者提供汇总时如实标注，不冒称所有原始预测已独立复核。

## 回看与补充结果

目录的 `takeaway` 用一句话写实际结论，不重复主题或使用“效果很好”等笼统措辞。
四组及以上的长页自动生成组内跳转；主要指标表始终展开。历史重复、配套诊断表可加
`"supplemental": true` 折叠展示，数值仍完整保留在HTML和摘要下载中。
补充遗漏结果沿用原记录日期，不更新成维护日期。保持“同条件同预算”、
“真值／先验”和“全有效像素／组织块”边界，不把工程检查凑成方法实验。

## 原方法复现总表

`content/experiments/reproductions.json` 是未加本研究改进模块的原方法汇总，
由同一构建入口生成 `thesis/experiments/reproductions/index.html`，目录顶部提供入口。
它不加入日期实验条目计数，旧记录页面不覆盖、不重编号。

更新总表时对照已有日期JSON；同一方法不同预算分别保留，EC与原始数据分开，
测试时适配另列在历史记录，不放进无适配总表。新增数值注明报告来源与记录日期，
缺失的预算、种子、全区域指标写“未提供”，不由官方默认配置推断本地执行配置。
“原方法”不等于所有源码逐行不变；兼容修复、先验与输入协议的限制需保留。
EndoGaussian当前新增值依据作者确认的2026-10-03汇总，尚缺完整预算与种子信息。
