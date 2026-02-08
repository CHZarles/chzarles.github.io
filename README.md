# Hyperblog (UI Prototype)

一个“可探索的个人技术空间”UI 原型：同时支持传统 `Categories` 目录与 `Roadmap-as-File` 路线图目录；所有内容统一为 `Note`（不区分长短文）。

## 系统概览（现在的结构）

这套 repo 里同时包含 3 个“面向不同人”的东西：

- **Public Site（公开站点）**：读者看到的博客 UI（`/`、`/notes`、`/roadmaps`…）
- **Studio（发布台）**：写作者用的高效率后台（`/studio/*`）
- **Publisher API（写入后端）**：负责鉴权 + 写 GitHub main（Notes / Roadmaps / Uploads / Mindmaps / Config）

数据链路（读 / 写）大概长这样：

```text
（读）content/*  ──dev──> mock API (/api/*) ──> Public Site
（读）content/*  ──build──> dist/api/*.json  ──> GitHub Pages

（写）Studio ──> Publisher API ──> GitHub commit(main) ──> GitHub Actions build ──> GitHub Pages
```

## 目录结构（你现在应该关注的文件）

- `content/`：内容源（Source of Truth）
  - `content/notes/*.md`：文章（frontmatter 支持 `categories/tags/nodes/mindmaps/cover/draft`）
  - `content/roadmaps/*.yml`：Roadmap-as-File（tree + edges）
  - `content/mindmaps/*.json`：思维导图（当前 Studio 里是 ReactFlow 格式）
  - `content/profile.json`：主页/导航配置（Hero 背景、链接等）
  - `content/categories.yml`：分类
  - `content/projects.json`：项目
- `public/uploads/`：上传的图片/PDF 等资产（Publisher 写入；公开站点直接以 `/uploads/...` 访问）
- `src/ui/`：公开站点 UI（读 `/api/*.json`）
- `src/studio/`：Studio（发布台 UI，调用 Publisher API）
- `publisher/`：Publisher API（Cloudflare Workers + Hono）
- `mock/`：Mock API（Express，开发阶段把 `content/` 暴露成 `/api/*`）
- `scripts/postbuild.ts`：构建后生成 `dist/api/*.json`（用于 GitHub Pages 静态读取）
- `docs/backend-contract-v0.md`：后端契约 v0（路由、文件路径、鉴权、错误码）

## 运行

```bash
pnpm install
pnpm dev
```

- Web（含 Mock API）: `http://localhost:5173`

生产预览（更接近 GitHub Pages 的效果：先 build 生成 `dist/` + `dist/api/*.json`，再静态预览）：

```bash
pnpm preview
```

可选：单独启动 mock server（不走 Vite 中间件；默认端口从 `8792` 开始自动找可用端口）

```bash
pnpm dev:api
```

## 内容与数据（文件驱动）

- Profile: `content/profile.json`
- Categories: `content/categories.yml`
- Roadmaps: `content/roadmaps/*.yml`
- Mindmaps: `content/mindmaps/*.json`
- Notes: `content/notes/*.md`（frontmatter 里用 `nodes: ["ai-infra/otel"]` 绑定节点）
- Projects: `content/projects.json`

## Publisher（本地发文 / 上传 / 思维导图）

启动两个服务：

```bash
pnpm dev
pnpm dev:publisher -- --port 8788
```

打开写作台（Studio）：
- Notes：`http://localhost:5173/studio/notes`
- Assets：`http://localhost:5173/studio/assets`
- Mindmaps：`http://localhost:5173/studio/mindmaps`
- Roadmaps：`http://localhost:5173/studio/roadmaps`
- Config：`http://localhost:5173/studio/config`

- 首次会跳 GitHub OAuth，回到 `/auth/callback` 后把 token 存在 `sessionStorage`
- 默认 Publisher 地址是 `http://localhost:8788`，如需修改可设置 `VITE_PUBLISHER_BASE_URL`

### publisher/.dev.vars 是什么？（本地开发不需要操作 Cloudflare）

`publisher/.dev.vars` 是 **wrangler 本地启动**时读取的环境变量文件，用来给 Worker 注入配置（GitHub OAuth、允许的站点 Origin、目标仓库等）。

- 本地开发：只要创建 `publisher/.dev.vars` 并运行 `pnpm dev:publisher` 就行，不需要先部署到 Cloudflare。
- 本地开发：只要创建 `publisher/.dev.vars` 并运行 `pnpm dev:publisher` 就行，不需要先部署到 Cloudflare。
- 只有当你要“线上可用的 Publisher API”时，才需要把同样的变量配置到 Cloudflare Workers 环境里。

必要变量（v0，按你的实际填写）：

```bash
BASE_URL=http://localhost:8788
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
TOKEN_SECRET=...
ADMIN_GITHUB_LOGINS=chzarles
CONTENT_REPO=CHZarles/chzarles.github.io
ALLOWED_ORIGINS=http://localhost:5173
```

### 主页大卡片背景（可自定义）

在 `content/profile.json` 的 `hero` 配置：

```json
{
  "hero": { "imageUrl": "/hero.svg", "blurPx": 22, "opacity": 0.28, "position": "center" }
}
```

把图片放进 `public/`（例如 `public/hero.jpg`），然后用 `/hero.jpg` 引用即可。

## 常用接口（mock）

- `GET /api/notes`
- `GET /api/categories`
- `GET /api/roadmaps`
- `GET /api/roadmaps/:roadmapId/nodes/:nodeId`
- `GET /api/search?q=...`（⌘K）

## 当前开发进度（2026-02-07）

已完成：
- Public Site：Home / Notes / Note / Categories / Roadmaps（Graph + Outline）/ Projects + ⌘K Search
- 构建期静态 API：`pnpm build` 产出 `dist/api/*.json`（GitHub Pages 直接读）
- Studio：Notes 编辑器 + 上传插图、Assets 资产库、Roadmaps YAML 编辑器、Config 编辑器、Mindmap 可视化编辑器（ReactFlow）
- Publisher API：GitHub OAuth + Bearer Token + 原子写 main（Notes / Uploads / Roadmaps / Config / Mindmaps）

待做（建议下一步）：
- 公开站点的 Mindmaps：`/mindmaps`、`/mindmaps/:id`，并在 Note 中渲染/跳转 `mindmaps: [...]`
- 公开站点默认过滤 `draft: true`

## FAQ：dev / preview / GitHub Pages 为什么看起来不一样？

- `pnpm dev` 是 Vite Dev Server：页面来自源码（`/src/main.tsx`），带 HMR；API 由 mock 中间件从 `content/` 实时读取。
- `pnpm preview` 是生产构建预览：先 build 生成 `dist/` 与 `dist/api/*.json`，再静态跑 `dist/`（更接近 Pages）。
- 浏览器的 **缩放比例** 和 `localStorage` 是按「域名 + 端口」隔离的：`localhost:5173`、`localhost:4173`、`chzarles.github.io` 会各存一份主题/强调色/缩放设置；对齐显示时先 `Ctrl/Cmd+0` 复位缩放，再统一一次主题/强调色即可。

## 发布到 GitHub Pages（静态托管）

- 构建与部署由 `.github/workflows/pages.yml` 完成：push `main` → build `dist/` → 部署 Pages
- GitHub 仓库里需要设置：`Settings → Pages → Source = GitHub Actions`
- 本地想“尽量复刻线上效果”：用 `pnpm preview`

## 后端设计（Mode B / GitHub OAuth）

见：`docs/backend-contract-v0.md`
