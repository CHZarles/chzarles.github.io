---
title: Hyperblog：把博客做成“可探索的个人技术空间”（以及怎么部署）
date: 2026-02-11
categories: [writing, product]
tags: [hyperblog, roadmap-as-file, studio, github-pages, cloudflare-workers]
nodes: [writing-system/roadmap-file, writing-system/publish]
mindmaps: [hyperblog-architecture]
cover: /uploads/hyperblog-home.webp
excerpt: "内容、目录、路线图、思维导图全部落成文件：公开站静态托管；写作台用 Cloudflare Workers 把改动 commit 回 GitHub main。"
---

这是一套面向个人用户的博客系统，但我不想把它做成“文章列表 + 标签云”的老样子。  
我想要的是一个**可探索的个人技术空间**：读者能顺着目录读；也能顺着 Roadmap 看到你的技术栈；还能看到你真实的项目与证据链。

下面是这套产品的设计思路、技术路线，以及如何让别人把它部署到自己的 GitHub Pages，并用 Cloudflare Workers 上线一个可发文的 Studio。

---

## 产品设计：两套目录并存，索引同一批 Notes

### 1) Notes：只保留一种内容类型

- 全站唯一内容类型是 `Note`（不区分长短文）
- 用 frontmatter 让同一篇 Note 同时被两套目录索引：`categories[]` + `nodes[]`

示例（摘自 frontmatter 语义）：

```yaml
categories: [ai-infra, observability]
nodes: [ai-infra/otel, writing-system/roadmap-file]
mindmaps: [otel-evidence-loop]
draft: false
```

### 2) Categories：传统目录（叙事）

你可以像写一本书一样维护栏目结构与叙事，它是对外表达最稳定的入口。

### 3) Roadmaps：路线图目录（体系）

Roadmap 的核心不是“系统生成”，而是**你编辑一份文件**：

- `content/roadmaps/*.yml` 定义节点树（可选 edges 依赖）
- UI 负责渲染 Graph/Outline、聚合节点下的 Notes
- 每个节点都是站点入口（适合呈现能力结构与学习路线）

### 4) Projects：作品集入口（更像仓库/产品页）

Projects 是独立的作品集（`content/projects.json`），它不再绑定 roadmap 节点，避免“结构表达”与“作品表达”互相绑架。

---

## 视觉与交互：像杂志一样“可读 + 可逛”

首页与 Roadmap 页的视觉风格与交互，是这套系统“吸睛但不浮夸”的关键。

### 公开站首页（封面式 Hero）

![Hyperblog Home](/uploads/hyperblog-home.webp)

### Roadmap：Graph 是主视图，Outline 可收起

![Roadmap Graph](/uploads/hyperblog-roadmap.webp)

---

## 技术路线：静态公开站 + 可写入的 Publisher API（Studio 发文）

这套系统把“读”和“写”拆成两条链路：

```text
（读）content/* ── build ──> dist/api/*.json ──> GitHub Pages（纯静态）

（写）Studio ──> Publisher API（Cloudflare Workers） ──> GitHub commit(main)
                                └───────────────触发 GitHub Actions build 部署───────────────┘
```

### 为什么这样做

- **长期成本低**：公开站是纯静态，基本免费；后端只有一个轻量 Worker
- **可审计**：所有内容是 Git 提交（谁改了什么，一目了然）
- **可迁移**：不绑数据库；换平台就是换托管方式
- **写作顺手**：Studio 频繁保存走本地草稿；最终一键 Publish 才产生 commit

### Studio 的资产关联（图片/文件）

Studio 上传的文件会进入 `public/uploads/*`，在 Note 里引用统一用站点路径：`/uploads/...`。  
这篇 Note 里的三张截图就是用这条链路引用的（同时也验证了 assets 的渲染）。

![Studio Notes Editor](/uploads/hyperblog-studio.webp)

---

## 部署指南：把它变成你自己的 `<user>.github.io`

### Step 0：准备一个 GitHub Pages 仓库

1. 在 GitHub 新建仓库：`<user>.github.io`（根域模式）
2. 把 Hyperblog 代码推到这个仓库的 `main`
3. GitHub 仓库设置：`Settings → Pages → Source = GitHub Actions`

从此以后：push `main` → Actions build → Pages 自动更新。

### Step 1：填你的内容（不需要后端）

你只要编辑这些文件，就能驱动公开站：

- Notes：`content/notes/*.md`
- Roadmaps：`content/roadmaps/*.yml`
- Mindmaps：`content/mindmaps/*.json`
- Categories：`content/categories.yml`
- Projects：`content/projects.json`
- Profile / Hero：`content/profile.json`
- 图片等资产：`public/uploads/*`（页面引用 `/uploads/...`）

本地预览：

```bash
pnpm install
pnpm dev
```

生产预览（最像 GitHub Pages）：

```bash
pnpm preview
```

### Step 2：上线可写入的 Publisher API（Cloudflare Workers）

如果你只想“纯静态写文章”，到这一步可以结束。  
如果你希望在线发文（Studio 一键发布），需要一个 Publisher API。

#### 2.1 创建 GitHub OAuth App（用于登录 Studio）

在 GitHub：`Settings → Developer settings → OAuth Apps → New OAuth App`

- Homepage URL：填你的站点（例如 `https://<user>.github.io`）
- Authorization callback URL：填你的 Worker 回调（例如 `https://<worker>.workers.dev/api/auth/github/callback`）

记下：
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

#### 2.2 部署 Worker

在本项目根目录（第一次需要登录 Cloudflare）：

```bash
pnpm install
pnpm wrangler login
```

然后先配置 Worker 的普通变量（非敏感配置，建议直接写进 `publisher/wrangler.toml`），再部署：

```bash
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```

部署成功后你会得到一个 Worker URL（`https://<name>.<subdomain>.workers.dev`），下面记作 `PUBLISHER_URL`。

#### 2.3 配置 Worker 环境变量/密钥

普通变量（Variables）：编辑 `publisher/wrangler.toml` 的 `[vars]`（变量名见 `docs/backend-contract-v0.md`）：

```toml
[vars]
BASE_URL = "https://<your-worker>.workers.dev"
ADMIN_GITHUB_LOGINS = "<your-github-login>"
CONTENT_REPO = "<owner>/<repo>" # e.g. chzarles/chzarles.github.io
CONTENT_BRANCH = "main"
CONTENT_ROOT = ""
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:4173,https://<user>.github.io"
TOKEN_TTL_SECONDS = 43200
```

密钥（Secrets）：用 wrangler 写入（不要提交到 git）：

```bash
pnpm wrangler secret put GITHUB_CLIENT_ID -c publisher/wrangler.toml
pnpm wrangler secret put GITHUB_CLIENT_SECRET -c publisher/wrangler.toml
pnpm wrangler secret put TOKEN_SECRET -c publisher/wrangler.toml
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```

#### 2.4 让公开站知道 Publisher URL

把 `content/profile.json` 里的 `publisherBaseUrl` 指向你的 `PUBLISHER_URL`。  
然后你就可以访问：

- `https://<user>.github.io/studio/notes`

首次会跳 GitHub 授权，回来后就能发文、传图、改 Roadmap、改 Mindmap，并一键 Publish（commit 到 main）。

---

## 结语：这套系统解决的不是“写”，而是“长期组织与展示”

我希望它最终呈现的是一种可证明的成长轨迹：

- Roadmap 让你的技术栈结构可被浏览
- Notes 提供证据与细节（踩坑/决策/复盘）
- Projects 是作品入口（更接近产品页/仓库）
- Studio 把“发布”从繁琐 Git 操作里解放出来，但仍然把一切落到 Git（可审计/可迁移）

如果你也想把博客做成“可探索的技术空间”，欢迎直接 fork/改造：从 `content/*` 开始，你的结构就已经成型了。
