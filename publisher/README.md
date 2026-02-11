# Hyperblog Publisher API（Mode B）

Publisher 是 Hyperblog 的写入后端：跑在 Cloudflare Workers 上，负责 **GitHub OAuth 登录 → 签发 Bearer Token → 原子写入 GitHub main**（`content/*` + `public/uploads/*`）。

部署与使用主文档：

- 部署：`../docs/deploy-guide.md`
- 后端契约：`../docs/backend-contract-v0.md`

---

## 本地开发（wrangler dev）

### 1) 创建 GitHub OAuth App

- Authorization callback URL：`http://localhost:8788/api/auth/github/callback`（与 `--port` 一致）

### 2) 创建 `publisher/.dev.vars`

从模板复制：

```bash
cp publisher/.dev.vars.example publisher/.dev.vars
```

然后补全 secrets：

```bash
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
TOKEN_SECRET=... # long random string
```

### 3) 启动

在仓库根目录运行：

```bash
pnpm dev:publisher -- --port 8788
```

健康检查：

```bash
curl -sS http://localhost:8788/health
```

---

## 生产部署（wrangler deploy）

1) 修改 `publisher/wrangler.toml` 的 `[vars]`  
2) 写入 secrets（`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `TOKEN_SECRET`）  
3) 部署：

```bash
pnpm wrangler deploy --keep-vars -c publisher/wrangler.toml
```
