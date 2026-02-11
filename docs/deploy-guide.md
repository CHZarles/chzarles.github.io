# 部署指南（GitHub Pages + Cloudflare Workers Publisher）

Hyperblog 的公开站点是**纯静态**。没有数据库，也没有读接口后端。随便找个静态托管就能跑（本仓库默认 GitHub Pages）。

如果你还希望“在线发文/上传/改 Roadmap/Mindmap”，再部署一个 Publisher API（Cloudflare Workers）：它负责 **GitHub OAuth 登录 → 签发 Bearer Token → 原子 commit 到 GitHub main**。

跑通之后，你会得到：

- 读者访问：`https://<user>.github.io`
- 作者发布：`https://<user>.github.io/studio/*`
- 写入路径：直接写 `main`（`content/*` + `public/uploads/*`）
- 发布链路：push `main` → GitHub Actions build → Pages 自动更新

> 重要：这里用的是 **GitHub OAuth App**（不是 GitHub App）。

---

## TL;DR（最快跑通）

1) 创建并推送仓库：`<user>.github.io`（Public，默认分支 `main`）  
2) GitHub：`Settings → Pages → Source = GitHub Actions`  
3) 本地跑一次：`pnpm install && pnpm run init && pnpm run doctor`  
4)（可选）部署 Publisher：`pnpm wrangler login` → `pnpm wrangler deploy -c publisher/wrangler.toml`  
5)（可选）创建 GitHub OAuth App，回调填：`<PUBLISHER_URL>/api/auth/github/callback`  
6)（可选）把 `publisherBaseUrl` 写到 `content/profile.json`，push 后等待 Pages build

---

## 0. 前置条件

- GitHub 账号（能创建公开仓库）
- Cloudflare 账号（要部署 Publisher 时才需要）
- 本机：Node.js 20+ 与 `pnpm`（建议通过 corepack）

```bash
corepack enable
```

---

## 1) 只部署公开站（不需要 Publisher）

这是最推荐的“先上线、再慢慢完善”的路径。

### 1.1 创建 GitHub Pages 仓库

- 仓库名：`<user>.github.io`
- 可见性：Public
- 默认分支：`main`

把本项目代码推到该仓库的 `main`。

### 1.2 启用 Pages（GitHub Actions）

在 GitHub 仓库：

- `Settings → Pages → Source = GitHub Actions`

本项目内置 `.github/workflows/pages.yml`：每次 push `main` 会自动 build 并部署到 Pages。

---

## 2) 推荐：跑一次 init / doctor（少踩坑）

在仓库根目录：

```bash
pnpm install
pnpm run init
pnpm run doctor
```

- `init`：填好 `content/profile.json`、`publisher/wrangler.toml`、`publisher/.dev.vars.example`
- `doctor`：检查常见坑（Pages workflow、lockfile、`ALLOWED_ORIGINS`、Hero 图片路径等）

> `init` 只改“非敏感配置”。OAuth 的 secret 仍需你在部署 Worker 时单独设置。

---

## 3) 部署 Publisher API（开启线上 Studio）

Publisher 是写入后端：登录 GitHub → 签发短期 token → 代表你把改动 commit 回 `main`。

### 3.1 登录 Cloudflare（wrangler）

在仓库根目录：

```bash
pnpm wrangler login
```

首次会提示你注册免费的 `workers.dev` 子域名（例如 `chzarles`）。部署后你的 Worker 通常长这样：

- `https://hyperblog-publisher.<subdomain>.workers.dev`

下面把它记为：`PUBLISHER_URL`

### 3.2 配置 `publisher/wrangler.toml` 的 `[vars]`（可提交到 git）

编辑：`publisher/wrangler.toml`

- `BASE_URL`：你的 `PUBLISHER_URL`
- `ADMIN_GITHUB_LOGINS`：允许发布的人（逗号分隔，建议只填自己）
- `CONTENT_REPO`：你的 Pages 仓库（`<user>/<user>.github.io`）
- `CONTENT_BRANCH`：`main`
- `CONTENT_ROOT`：留空（表示 repo 根目录；monorepo 才需要）
- `ALLOWED_ORIGINS`：允许调用 Publisher 的站点 origin（建议包含：Pages + 本地 dev/preview）
- `TOKEN_TTL_SECONDS`：可选，默认 12h（43200）

示例：

```toml
[vars]
BASE_URL = "https://hyperblog-publisher.<subdomain>.workers.dev"
ADMIN_GITHUB_LOGINS = "<user>"
CONTENT_REPO = "<user>/<user>.github.io"
CONTENT_BRANCH = "main"
CONTENT_ROOT = ""
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:4173,https://<user>.github.io"
TOKEN_TTL_SECONDS = 43200
```

### 3.3 部署 Worker（注意：配置文件在 `publisher/`）

```bash
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```

> 你不需要根目录的 `wrangler.toml`；本项目用的是 `publisher/wrangler.toml`。

### 3.4 创建 GitHub OAuth App（拿到 Client ID/Secret）

去 GitHub：

- `Settings → Developer settings → OAuth Apps → New OAuth App`

填写：

- `Application name`：随便（例如 `Hyperblog Publisher`）
- `Homepage URL`：`https://<user>.github.io`（展示用途）
- `Authorization callback URL`：`{PUBLISHER_URL}/api/auth/github/callback`

保存后拿到：

- `Client ID`
- `Client Secret`

### 3.5 配置 Worker Secrets（敏感，绝对不要提交）

用 wrangler 写入 secrets（交互式输入值）：

```bash
pnpm wrangler secret put GITHUB_CLIENT_ID -c publisher/wrangler.toml
pnpm wrangler secret put GITHUB_CLIENT_SECRET -c publisher/wrangler.toml
pnpm wrangler secret put TOKEN_SECRET -c publisher/wrangler.toml
```

`TOKEN_SECRET` 生成建议：

```bash
openssl rand -base64 32
```

### 3.6 再部署一次（让 secrets 生效）

```bash
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```

### 3.7 让公开站点（Studio）指向你的 Publisher

编辑：`content/profile.json`：

```json
{ "publisherBaseUrl": "https://hyperblog-publisher.<subdomain>.workers.dev" }
```

提交并 push 到 `main` 后，Pages 会重新 build。

> 前端解析优先级：`VITE_PUBLISHER_BASE_URL` → `profile.json.publisherBaseUrl` → 默认 `http://localhost:8788`

---

## 4) 验收：线上 Studio 发一篇 Note

1. 打开：`https://<user>.github.io/studio/notes`
2. 点击 `Login with GitHub` → 授权
3. 写一篇 Note / 上传一张图 → `Publish`

预期结果：

- `main` 出现新 commit（写入 `content/*` 与/或 `public/uploads/*`）
- GitHub Actions 完成后：`https://<user>.github.io` 内容更新

---

## 5) 常见问题（Troubleshooting）

### 5.1 Studio 仍然跳到 `http://localhost:8788/...`

通常是你打开的是旧构建产物或缓存未更新：

- 检查 `https://<user>.github.io/api/profile.json` 是否包含正确的 `publisherBaseUrl`
- 强刷（`Ctrl/Cmd+Shift+R`）或用无痕窗口再打开

### 5.2 授权后提示 `403 Not allowed`

- 确认 `ADMIN_GITHUB_LOGINS` 包含你当前 GitHub 用户名（不区分大小写）

### 5.3 浏览器报 `Origin not allowed` / CORS

- `ALLOWED_ORIGINS` 只填 origin（不要带路径、不要带尾部 `/`）
- 改完后重新 deploy Worker

### 5.4 `/health` 返回 500

通常是缺 vars/secrets：

- 检查 `publisher/wrangler.toml` 的 `[vars]`
- 重新 `secret put` 三个密钥
- 再 `deploy --keep-vars`

也可能是仓库权限问题：

- 你对 `CONTENT_REPO` 必须有 push 权限
- 仓库分支保护/强制 PR 会阻止直接写 `main`（需要调整策略或给自己开 bypass）
