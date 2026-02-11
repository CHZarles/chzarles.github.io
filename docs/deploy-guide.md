# Hyperblog 部署指南（GitHub Pages + Cloudflare Workers Publisher）

这份文档面向“第一次部署这套方案”的人：从 clone 代码开始，把公开站点发布到 **GitHub Pages**，并把写入后端（Publisher API）部署到 **Cloudflare Workers（Free 即可）**，最终实现：

- 读者访问：`https://<user>.github.io`
- 作者发布：`https://<user>.github.io/studio/*`（GitHub OAuth 登录后发文/传图/编辑 roadmap/mindmap）
- 写入路径：Publisher 直接把内容 commit 到你的 `main`（`content/*` + `public/uploads/*`）
- 发布链路：push `main` → GitHub Actions build → Pages 自动更新

> 重要：这里用的是 **GitHub OAuth App**（不是 GitHub App）。

---

## 0. 前置条件

- GitHub 账号（有权限创建公开仓库）
- Cloudflare 账号（Workers Free 即可）
- 本机：Node.js 20+（建议）与 `pnpm`（建议通过 corepack）

```bash
corepack enable
```

## 0.1 可选：先跑一次 init / doctor（少踩坑）

在仓库根目录：

```bash
pnpm install
pnpm run init
pnpm run doctor
```

`init` 会帮你把 `content/profile.json`、`publisher/wrangler.toml`、`publisher/.dev.vars.example` 填到可用的默认值；  
`doctor` 会检查常见漂移/配置坑（Pages workflow、lockfile、ALLOWED_ORIGINS、hero image 路径等）。

---

## 1. 准备 GitHub Pages 仓库（公共站点 + 内容仓库）

最简单（也是本方案默认）：你的内容仓库就是 Pages 仓库：

- 仓库名：`<user>.github.io`
- 可见性：Public
- 默认分支：`main`

然后把本项目代码推到该仓库的 `main`。

### 1.1 启用 Pages（GitHub Actions）

在 GitHub 仓库：

- `Settings → Pages → Source = GitHub Actions`

> 本项目已经内置 `.github/workflows/pages.yml`：push `main` 会自动 build 并部署到 Pages。

---

## 2. 部署 Publisher API 到 Cloudflare Workers

Publisher 是写入后端，负责：GitHub OAuth + 签发 Bearer Token + 写入 GitHub main。

### 2.1 登录 Cloudflare（wrangler）

在仓库根目录：

```bash
pnpm install
pnpm wrangler login
```

首次会要求你注册 `workers.dev` 子域名（免费的），例如 `chzarles`：

- 你的子域名：`https://<subdomain>.workers.dev`
- 你的 Worker 通常会是：`https://hyperblog-publisher.<subdomain>.workers.dev`

下面把它记为：`PUBLISHER_URL`

### 2.2 配置 Worker 的普通变量（可提交到 git）

编辑：`publisher/wrangler.toml`

你需要把 `[vars]` 改成自己的值（这些是非敏感配置）：

- `BASE_URL`: 你的 `PUBLISHER_URL`
- `ADMIN_GITHUB_LOGINS`: 允许发布的人（逗号分隔，建议只填自己）
- `CONTENT_REPO`: 你的 Pages 仓库（`<user>/<user>.github.io`）
- `CONTENT_BRANCH`: `main`
- `CONTENT_ROOT`: 留空（表示 repo 根目录；如果你是 monorepo 才需要）
- `ALLOWED_ORIGINS`: 允许调用 Publisher 的站点 origin（建议包含你的 Pages + 本地 dev/preview）
- `TOKEN_TTL_SECONDS`: 可选，默认 12h（43200）

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

### 2.3 首次部署（生成 Worker）

```bash
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```

> `--keep-vars` 用来避免你在 Dashboard/CLI 配的变量被 deploy 清掉（secrets 不会被清，但 vars 可能会）。

### 2.4 创建 GitHub OAuth App（拿到 Client ID/Secret）

去 GitHub：

- `Settings → Developer settings → OAuth Apps → New OAuth App`

填写：

- `Application name`: 随便（例如 `Hyperblog Publisher`）
- `Homepage URL`: `https://<user>.github.io`
- `Authorization callback URL`: `https://hyperblog-publisher.<subdomain>.workers.dev/api/auth/github/callback`

保存后拿到：

- `Client ID`
- `Client Secret`

### 2.5 配置 Worker Secrets（敏感，绝对不要提交）

用 wrangler 写入 secrets（会交互式让你输入值）：

```bash
pnpm wrangler secret put GITHUB_CLIENT_ID -c publisher/wrangler.toml
pnpm wrangler secret put GITHUB_CLIENT_SECRET -c publisher/wrangler.toml
pnpm wrangler secret put TOKEN_SECRET -c publisher/wrangler.toml
```

`TOKEN_SECRET` 建议生成长随机串，例如：

```bash
openssl rand -base64 32
```

> 你之后如果更换 `TOKEN_SECRET`，旧 token 会全部失效（需要重新登录）。

### 2.6 再部署一次（让 secrets 生效）

```bash
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```

### 2.7 健康检查

```bash
curl -sS https://hyperblog-publisher.<subdomain>.workers.dev/health
```

期望输出：

```json
{"ok":true}
```

---

## 3. 让公开站点（Studio）指向你的 Publisher

公开站点（GitHub Pages）是纯静态的，所以我们用 **配置文件驱动** 的方式告诉前端 Publisher 在哪：

编辑：`content/profile.json`

加/改：

```json
{
  "publisherBaseUrl": "https://hyperblog-publisher.<subdomain>.workers.dev"
}
```

提交并 push 到 `main` 后，Pages 会重新 build。

> 前端解析优先级：`VITE_PUBLISHER_BASE_URL`（环境变量）→ `profile.json.publisherBaseUrl` → 默认 `http://localhost:8788`

---

## 4. 验收：线上 Studio 发一篇文章

1) 打开：`https://<user>.github.io/studio/notes`  
2) 点击 `Login` → GitHub 授权  
3) 授权完成会回到：`/auth/callback`，然后进入 Studio  
4) 发布一篇 Note / 上传一张图

预期结果：

- 你的 `main` 出现新 commit（写入 `content/notes/*` 或 `public/uploads/*`）
- GitHub Actions 自动跑完后，`https://<user>.github.io` 内容更新

---

## 5. 本地开发（可选）

只跑公开站（读 `content/`，不写）：

```bash
pnpm dev
```

本地也要发文（写到 GitHub main）：再起一个本地 Publisher：

```bash
pnpm dev:publisher -- --port 8788
```

本地 Publisher 需要 `publisher/.dev.vars`（参考 `publisher/.dev.vars.example`）。

---

## 6. 常见问题（Troubleshooting）

### 6.1 打开 Studio 后跳到 `http://localhost:8788/...`

说明你打开的是旧构建产物（或缓存未更新）。检查：

- `https://<user>.github.io/api/profile.json` 是否包含正确的 `publisherBaseUrl`
- 强刷（`Ctrl/Cmd+Shift+R`）或用无痕窗口再打开 Studio

### 6.2 `health` 返回 500

通常是缺变量/secret：

- 确认 `publisher/wrangler.toml` 的 `[vars]` 已改成你的值
- 重新 `secret put` 三个密钥
- 再 `deploy --keep-vars`

### 6.3 授权后 403 Not allowed

确认：

- `ADMIN_GITHUB_LOGINS` 包含你当前登录的 GitHub 用户名（不区分大小写）

### 6.4 浏览器报 CORS / Origin not allowed

确认：

- `ALLOWED_ORIGINS` 包含你当前站点 origin（例如 `https://<user>.github.io` 或 `http://localhost:5173`）
- origin 不要带路径、不要带尾部 `/`
- 改完后重新 deploy Worker

### 6.5 Publisher 提示 No push permission / 写 main 失败

确认：

- 你对 `CONTENT_REPO` 有 push 权限
- 仓库没有强制 PR / 分支保护阻止直接 push（或给自己开 bypass）
