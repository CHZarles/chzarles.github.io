# Hyperblog

一个文件驱动的个人站点模板。

它现在的结构很简单：

- 公开站点只有三块：主页、`Notes`、`Projects`
- `Categories` 还在数据层里，但不再是单独页面，而是搜索面板里的筛选条件
- `Studio` 是写作后台，草稿先存在浏览器本地，确认后一次性发布到 GitHub
- `Publisher` 是可选写入后端，跑在 Cloudflare Workers 上

如果你只想把内容写进仓库然后生成静态站点，这个项目已经够用。  
如果你还想在网页里编辑、上传资源、发布到远程，也可以把 `Studio + Publisher` 一起开起来。

## 现在这套系统怎么工作

公开读路径：

```text
content/* + public/uploads/*
  -> Vite dev mock API (/api/*)
  -> 前台页面

build 时：
content/*
  -> dist/api/*.json
  -> 静态托管
```

写入路径：

```text
Studio
  -> 浏览器本地草稿
  -> Changes 里统一确认
  -> Publisher API
  -> GitHub commit
```

这意味着：

- 内容的真实来源是仓库里的文件，不是数据库
- 本地编辑很频繁也没关系，因为默认只写浏览器本地
- 真正改远程仓库，只发生在你点击 `Publish` 的那一次

## 当前包含的能力

### 公开站点

- 首页 Hero + 最近内容入口
- Notes 列表页和文章页
- Projects 列表页和详情页
- 顶部搜索面板
- 搜索面板里直接展示 category，并支持按 category 过滤 note 结果

### Studio

- Note 编辑
- 本地草稿恢复
- Markdown 预览
- 资源上传与删除暂存
- 配置文件编辑
- Changes 页统一看 diff 并发布

### 可选写入后端

- GitHub OAuth 登录
- 签发 Bearer Token
- 原子写入 `content/*` 和 `public/uploads/*`
- 单次发布合并成一个 GitHub commit

## 目录结构

最重要的是这几块：

```text
content/
  notes/*.md
  categories.yml
  projects.json
  profile.json
  .trash/

public/
  uploads/*

src/
  ui/        # 公开站点
  studio/    # Studio 后台

mock/        # 本地 dev API
publisher/   # 可选 Cloudflare Workers 写入后端
scripts/     # 初始化、校验、build 后处理
```

## 内容文件说明

### `content/notes/*.md`

文章内容，Markdown + frontmatter。

常用字段：

- `title`
- `date`
- `updated`
- `excerpt`
- `categories`
- `tags`
- `cover`
- `draft`

### `content/categories.yml`

分类数据源。  
现在主要给搜索面板和 Studio 里的 category 选择器使用。

### `content/projects.json`

项目列表数据源。

### `content/profile.json`

站点配置入口。  
这里会影响首页 Hero、站点文案、Publisher 基础地址等。

### `public/uploads/*`

图片和附件。前台统一按 `/uploads/...` 引用。

## 本地启动

先安装依赖：

```bash
pnpm install
```

只看公开站点：

```bash
pnpm dev
```

默认地址：

```text
http://localhost:5173
```

`pnpm dev` 会直接挂载本地 mock API，所以改完 `content/*` 基本立刻就能看到效果。

如果要看最接近线上静态产物的结果：

```bash
pnpm preview
```

这个命令会先 build，再预览 `dist/`。

## Studio 的实际用法

访问：

```text
/studio/notes
```

Studio 的工作方式是这样的：

1. 你在 `Notes` 页编辑内容
2. 草稿自动存进浏览器本地存储
3. `Assets` 页可以暂存上传和删除
4. `Config` 页可以改 `profile / categories / projects`
5. `Changes` 页统一查看待发布内容
6. 点击 `Publish` 后，所有改动合并成一次提交

几个容易误会的点：

- “保存本地”不是提交 GitHub，只是把草稿存进浏览器
- `Publish` 是全局操作，不是只发当前这一个文件
- 如果你在另一台机器发布过，本地仓库不会自动更新，还是要自己 `git pull`

## 可选：本地启动 Publisher

如果你只做静态站点，这部分可以跳过。  
如果你要真的从 Studio 写回 GitHub，需要把 Publisher 跑起来。

先复制环境变量模板：

```bash
cp publisher/.dev.vars.example publisher/.dev.vars
```

然后补这些值：

- `BASE_URL`
- `ADMIN_GITHUB_LOGINS`
- `CONTENT_REPO`
- `CONTENT_BRANCH`
- `ALLOWED_ORIGINS`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `TOKEN_SECRET`

启动本地 Publisher：

```bash
pnpm dev:publisher -- --port 8788
```

默认前台会优先读取：

1. `VITE_PUBLISHER_BASE_URL`
2. `content/profile.json` 里的 `publisherBaseUrl`
3. 都没有时回退到 `http://localhost:8788`

## 常用命令

```bash
pnpm dev                # 前台开发 + 本地 mock API
pnpm preview            # build 后预览静态产物
pnpm build              # 生成 dist/ 和 dist/api/*
pnpm typecheck          # TypeScript 检查
pnpm validate:content   # 校验内容文件
pnpm init               # 初始化辅助脚本
pnpm doctor             # 环境检查
pnpm dev:publisher      # 本地跑 Cloudflare Publisher
pnpm test:publisher     # Publisher smoke test
```

## build 会产出什么

`pnpm build` 会做两件事：

1. 用 Vite 打包前台
2. 读取 `content/*`，生成 `dist/api/*.json`

另外还会顺手处理几件静态部署相关的事：

- 把 `profile` 和 build id 注入 `index.html`
- 生成 `404.html`
- 写入 `.nojekyll`

所以这个仓库的静态部署目标很直接：把 `dist/` 扔到 GitHub Pages 或任何静态托管都可以。

## 这个版本不再包含什么

这点值得单独写一下，免得看旧文档时混淆。

当前主站和 Studio 已经去掉了这些公开结构：

- 独立 `category` 页面
- `mindmaps`
- `roadmaps`

仓库里还可能留着一些历史文件或 `.trash` 数据，但它们已经不是当前产品结构的一部分。

## 建议的工作流

如果你是内容维护者：

1. 先写 `content/*`
2. 用 `pnpm dev` 看公开效果
3. 用 `pnpm validate:content` 做一次校验
4. 需要网页编辑时再打开 Studio

如果你是站点维护者：

1. 先确认 `content/profile.json` 和 `projects/categories` 配置
2. 用 `pnpm build` 检查静态产物
3. 需要在线发布时再配 Publisher

## 还有哪些文件值得先看

- `vite.config.ts`
- `src/router.tsx`
- `src/studio/state/StudioWorkspace.tsx`
- `scripts/postbuild.ts`
- `publisher/src/routes/admin.ts`

如果你第一次接手这个项目，从这几个文件开始，基本就能把读链路、写链路和 build 过程串起来。
