# 896729202 · 知识手记

一个简洁的个人学习网站，仅设 **毕业论文** 和 **八股文** 两个内容板块。

网站地址：[896729202.github.io](https://896729202.github.io/)

## 页面与功能

- 首页、毕业论文、八股文目录、LoRA 独立文章与 404 页面。
- 浅色 / 深色阅读、手机适配、本地全文搜索、文章目录、阅读进度、原文下载、复制链接与打印。
- 文章公式在构建时转为原生 MathML，不依赖远程字体或运行时 CDN。
- 毕业论文保持待补充状态，不添加虚构论文或个人履历。

LoRA 正文保留作者提供的复习笔记，仅调整 Markdown 标记与网页排版。文中显存数字基于特定假设，不是对任意训练配置的保证；页面有单独的原文收录提示。

## GitHub Pages 发布

站点使用已生成的静态 HTML。仓库设置：**Settings → Pages → Deploy from a branch → main → / (root)**。保留根目录 `.nojekyll` 文件。

提交成功与网站发布成功不是同一回事，部署状态以仓库 Actions / Pages 设置页及实际网站为准。

## 修改内容

**更新 LoRA：** 编辑 `content/notes/lora.md`。需要时更新 `content/notes/index.json` 的日期与摘要，然后重新构建并提交生成页面。

**新增八股文：** 在 `content/notes/` 新建 Markdown 文件，并在 `content/notes/index.json` 添加条目。字段格式如下，示例不会自动发布：

```json
{
  "slug": "your-topic",
  "label": "文章简称",
  "title": "文章完整标题",
  "summary": "列表摘要",
  "date": "2026-09-29",
  "tags": ["大模型"],
  "modules": 2,
  "questions": 6
}
```

`slug` 仅使用小写字母、数字和短横线。模块和问答数量请填写实际值。Markdown 用一个一级标题、二级模块标题和三级章节标题组织内容。

**添加毕业论文：** 将准备公开的论文文件放入 `assets/papers/`，在 `content/theses.json` 添加真实条目后重新构建：

```json
[
  {
    "title": "真实论文题目",
    "year": "2026",
    "summary": "真实论文摘要",
    "url": "assets/papers/your-thesis.pdf"
  }
]
```

`url` 也可填写已公开论文的 HTTPS 地址。本地文件不存在时构建会报错。此网站和仓库是公开的，不要上传未获准公开的论文、个人敏感信息、密钥或其他项目资料。

**修改网站名称：** 编辑 `site.config.json`，重新构建。布局和首页文案在 `scripts/build.py` / `site-src/base.html`，样式在 `assets/site.css`。

## 本地构建与预览

需要 Python 3.10+；新增数学公式时还需要 Node.js 20+。建议用虚拟环境安装 Python 依赖。

```bash
python3 -m pip install -r requirements.txt
npm install
python3 scripts/build.py
python3 -m http.server 4173 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:4173`。Windows 可以将 `python3` 换成 `python`。

仅浏览现有成品无需安装依赖，直接打开 `index.html` 即可。已收录公式缓存在 `scripts/math-cache.json`，没有新增公式时，安装 Python 依赖即可构建。

**重要：仅修改 Markdown 不会自动更新已生成的 HTML。必须运行构建并提交相应 HTML、元数据及公式缓存。** 当前没有配置云端 Markdown 自动构建流程。

## 隐私与维护

搜索在浏览器本地执行；深色偏好保存在本地存储。未接入追踪、广告、评论或外部 API。构建器允许 Markdown 内嵌 HTML，因此只应收录可信内容。

GitHub 官方发布说明：
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
