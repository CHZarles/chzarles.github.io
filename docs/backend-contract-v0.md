# Hyperblog · Publisher Backend Contract v0 (Mode B / Token Auth)

目标：在**公开 GitHub 仓库**里直接写 `main` 分支（Notes / Mindmaps / Uploads），站点侧通过 CI/CD 自动构建发布；Publisher 后端只负责**鉴权 + 写入 + 原子提交**。

本文件定义 v0 的后端契约：路由、请求/响应、文件路径、鉴权/CSRF、Git 提交流程、错误码，以及按当前 repo 的推荐模块拆分。

> 你当前选择：**GitHub Pages 根域**（仓库为 `<user>.github.io`）作为公共站点；Publisher API 是独立域名（例如 Cloudflare Workers），因此 Admin 写入必须是**跨域**调用，本 v0 改为 **Bearer Token 鉴权**（不使用跨域 Cookie Session）。

---

## 0. 范围（v0）

### In-scope
- GitHub OAuth 登录（仅白名单用户可写）。
- Admin API：创建/更新/删除 Note、Mindmap，上传资产到 `public/uploads/`。
- 写入 GitHub：**一次提交可包含多个文件**（避免碎 commit）。
- 基础并发控制（基于 `headSha` 的乐观锁）。

### Out-of-scope（建议 v1+）
- 多用户租户化（每个用户绑定不同 repo）。
- PR 流程、草稿分支、审阅工作流。
- 大附件外部对象存储（R2/S3）与 CDN 策略。
- 服务端全文检索（推荐改为构建期产物 + 客户端搜索）。

---

## 1. 名词

- **Publisher**：你部署的后端（OAuth + 写 GitHub）。
- **Content Repo**：公开仓库（包含 `content/` 与 `public/`）。
- **Write main**：所有写入直接落到 `refs/heads/main`。
- **Atomic commit**：同一个逻辑操作（比如上传封面 + 发布文章）在 GitHub 上是一次 commit。

---

## 2. Repo 文件路径约定（Source of Truth）

> Publisher 写入的文件路径必须严格校验，禁止任意路径/覆盖敏感文件。

### 2.1 Notes
- 路径：`content/notes/<noteId>.md`
- `noteId` 推荐：`YYYY-MM-DD-<slug>`（slug 小写、`a-z0-9-`）
- 文件内容：YAML frontmatter + Markdown body

Frontmatter v0（最小字段）
```yaml
title: string
date: YYYY-MM-DD
updated: YYYY-MM-DD (可选)
excerpt: string (可选)
categories: string[] (可选)
tags: string[] (可选)
nodes: string[] (可选)   # "ai-infra/otel"
mindmaps: string[] (可选) # "otel-context"
cover: string (可选)     # "/uploads/2026/02/<hash>.jpg"
draft: boolean (可选)
```

### 2.2 Mindmaps
- 路径：`content/mindmaps/<mindmapId>.json`
- `mindmapId`：`a-z0-9-`（建议与 note 引用一致）

Mindmap JSON v0（推荐 ReactFlow 兼容）
```jsonc
{
  "id": "otel-context",
  "title": "OTel Context Propagation",
  "updated": "2026-02-06T12:34:56.000Z",
  "format": "reactflow",
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

### 2.3 Uploads（资产）
- 路径：`public/uploads/YYYY/MM/<hash>.<ext>`
- URL：`/uploads/YYYY/MM/<hash>.<ext>`

约束建议（v0）
- 单文件上限：`8MB`（超出返回 `413`）。
- 图片落盘前建议压缩：服务端可选做（v0 可先不做）。
- 仓库会膨胀：这是“简单方案”的已知 trade-off（需要时迁移到对象存储）。

### 2.4 Roadmaps
- 路径：`content/roadmaps/<roadmapId>.yml`（也支持 `.yaml`）
- 文件内容：YAML（tree + edges）

Roadmap YAML v0（最小字段）
```yaml
id: ai-infra
title: AI Infra
description: optional
theme: optional
layout: horizontal # or vertical
nodes:
  - id: foundations
    title: Foundations
    description: optional
    edges: [dist-sys]        # optional deps (same roadmap)
    children: []             # optional
```

### 2.5 Config（站点配置）
这些文件用于驱动公共站点 UI（非敏感配置，仍需路径白名单防止覆盖别的文件）：

- Profile：`content/profile.json`
- Categories：`content/categories.yml`（也可 `.yaml`，v0 建议统一 `.yml`）
- Projects：`content/projects.json`

---

## 3. 鉴权与会话

### 3.1 GitHub OAuth（Authorization Code）

GitHub OAuth App 设置：
- Homepage URL：Publisher 的域名
- Authorization callback URL：`{BASE_URL}/api/auth/github/callback`

环境变量（v0）
- `BASE_URL`：`https://publisher.example.com`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `TOKEN_SECRET`：用于签名/加密 Publisher Token（JWT/JWE 均可）
- `TOKEN_TTL_SECONDS`：例如 `43200`（12h）
- `ADMIN_GITHUB_LOGINS`：逗号分隔白名单，例如：`charles,alice`
- `CONTENT_REPO`：例如 `charles/hyperblog-content`
- `CONTENT_BRANCH`：固定 `main`
- `CONTENT_ROOT`：固定 `""`（默认 repo 根），如要子目录可设 `site/`（v1）
- `ALLOWED_ORIGINS`：CORS 白名单，例如 `https://<user>.github.io,http://localhost:5173`

OAuth scope（公开仓库写 main）
- `public_repo`（用于写入公开 repo）
- `read:user`（用于读取用户信息，通常默认就够）

### 3.2 Publisher Token（Bearer）

由于公共站点与 Publisher API 跨域（`github.io` ↔ `workers.dev`），Cookie Session 会受到“第三方 Cookie”策略影响，稳定性差；v0 采用 **Authorization Header Bearer Token**：

- 登录成功后，Publisher **签发一个短期 Token**（JWT/JWE）。
- 前端调用 Admin API 时带上 header：`Authorization: Bearer <token>`
- Token 建议只用于“发布/管理”能力，不参与公共读接口（公共读建议走静态 JSON）。

Token 内容（建议）
- `sub`: GitHub user id
- `login`: GitHub login
- `iat/exp`: 过期时间（建议 6h~24h，个人使用可放宽但要可接受泄露风险）
- `gh`: **GitHub access token 的加密载荷**（可选；用于让 Publisher 无状态调用 GitHub）
  - v0 为了部署简单，可以把 `gh` 做成 JWE/AES-GCM 加密字段（解密后作为 GitHub API token 使用）。
  - 如果你不想把 GitHub token 带到客户端（即便是加密后也在 token 内），可改为服务端存储（KV/D1/Durable Object）——这是 v1 范围。

前端存储建议
- **不要**存 `localStorage`（XSS 风险更高）。
- 优先：只存在内存；次选：`sessionStorage`（刷新保留、关页失效）。
- 登录回跳 URL 中携带 token 后，应立即 `history.replaceState` 清理 URL（避免地址栏残留）。

### 3.3 CSRF
当且仅当你**不用 Cookie 自动携带凭证**（即只用 `Authorization: Bearer ...`），通常不需要单独的 CSRF 方案；需要的是：
- 严格 CORS（仅允许你的站点 origin）
- 严格 Token 过期时间与撤销策略（v0：过期即重登）
- CSP / XSS 防护（站点侧）

### 3.4 CORS（跨域必需）
Publisher 必须：
- 对 `ALLOWED_ORIGINS` 返回 `Access-Control-Allow-Origin`
- 允许 methods：`GET,POST,PATCH,DELETE,OPTIONS`
- 允许 headers：`Authorization,Content-Type`
- `Access-Control-Allow-Credentials: false`（因为不使用 cookie）

---

## 4. API 规范（通用）

### 4.1 Base
- Base URL：`/api`
- Content-Type：`application/json; charset=utf-8`
- 所有响应包含：`X-Request-Id`（用于排查）

写接口统一鉴权
- 对所有 `POST/PATCH/DELETE /api/admin/*`：要求 `Authorization: Bearer <token>`

### 4.2 错误响应格式（统一）
```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": { "any": "json" }
  }
}
```

---

## 5. 路由（v0）

### 5.1 Auth

#### `GET /api/auth/github/start`
Query:
- `redirect`（可选）：登录成功后跳回的 URL
  - 建议：用绝对 URL（例如 `https://<user>.github.io/auth/callback`）
  - 安全：服务端必须校验 `redirect` 属于允许的站点 origin（避免 open redirect）

Response:
- `302` 跳转 GitHub 授权页

#### `GET /api/auth/github/callback`
Query: `code`, `state`

Response:
- 成功：`302` 跳转到 `redirect`，并在 **URL hash** 注入 token（避免 token 出现在 query 中）：
  - 例：`https://<user>.github.io/auth/callback#token=<PUBLISHER_TOKEN>`
- 失败：`302` 跳转到 `/login?error=...`（或返回 JSON，取决于前端形态）

#### `GET /api/auth/me`
Headers:
- `Authorization: Bearer <token>`

Response 200:
```json
{
  "user": { "id": 123, "login": "charles", "avatarUrl": "..." },
  "repo": { "fullName": "charles/hyperblog-content", "branch": "main" }
}
```

#### `POST /api/auth/logout`
说明：在“纯 Bearer Token”模式下，logout 通常是客户端删除本地 token；服务端接口可保留为兼容（v0 可返回 ok）。

Response 200:
```json
{ "ok": true }
```

---

### 5.2 Admin（需要 Bearer Token）

#### `GET /api/admin/profile`
读取 `content/profile.json`（供 Studio 的 Config 编辑器使用）。

Response 200:
```json
{ "file": { "path": "content/profile.json", "raw": "{...}", "json": { "name": "..." } } }
```

#### `PUT /api/admin/profile`
写入 `content/profile.json`（会进行 JSON 校验与格式化）。

Request:
```json
{ "raw": "{...json...}" }
```

Response 200:
```json
{ "ok": true, "file": { "path": "content/profile.json" }, "commit": { "sha": "...", "url": "..." } }
```

---

#### `GET /api/admin/categories`
读取 `content/categories.yml`。

Response 200:
```json
{ "file": { "path": "content/categories.yml", "raw": "- id: ...", "json": [] } }
```

#### `PUT /api/admin/categories`
写入 `content/categories.yml`（会进行 YAML 可解析校验）。

Request:
```json
{ "yaml": "- id: ..." }
```

---

#### `GET /api/admin/projects`
读取 `content/projects.json`。

#### `PUT /api/admin/projects`
写入 `content/projects.json`（会进行 JSON 校验与格式化）。

#### `GET /api/admin/notes`
用于 Studio 列表与编辑器加载（读 repo 内容，需要 Token）。

Query:
- `include=meta`（可选）：解析 frontmatter，返回 `title/date/draft/excerpt`
- `limit`（可选）：默认 50，最大 200（`include=meta` 时最大 50）
- `after`（可选）：分页游标（上一页最后一个 `noteId`）

Response 200:
```json
{
  "notes": [
    {
      "id": "2026-02-06-otel-tracing",
      "path": "content/notes/2026-02-06-otel-tracing.md",
      "sha": "blobSha",
      "size": 1234,
      "meta": { "title": "...", "date": "2026-02-06", "draft": false, "excerpt": "..." }
    }
  ],
  "paging": { "after": null, "nextAfter": "2026-02-01-..." }
}
```

#### `GET /api/admin/notes/:id`
Response 200:
```json
{
  "note": {
    "id": "2026-02-06-otel-tracing",
    "path": "content/notes/2026-02-06-otel-tracing.md",
    "input": { "title": "...", "date": "2026-02-06", "categories": [], "content": "..." },
    "markdown": "---\\n...\\n---\\n\\n## body\\n"
  }
}
```

#### `POST /api/admin/notes`
Request:
```json
{
  "title": "用 OpenTelemetry 把“慢”变成可解释的证据链",
  "content": "## ...markdown...",
  "excerpt": "可选",
  "categories": ["observability", "ai-infra"],
  "tags": ["otel", "tracing"],
  "nodes": ["ai-infra/otel"],
  "mindmaps": ["otel-context"],
  "cover": "/uploads/2026/02/abcd.jpg",
  "draft": false,
  "slug": "otel-tracing",
  "date": "2026-02-06"
}
```

Response 201:
```json
{
  "note": { "id": "2026-02-06-otel-tracing", "path": "content/notes/2026-02-06-otel-tracing.md" },
  "commit": { "sha": "abc123", "url": "https://github.com/<owner>/<repo>/commit/abc123" }
}
```

Validation（建议）
- `title` 必填，1..120
- `content` 必填
- `slug` 可选；不传则从 title 生成（中文可用拼音/短 hash）

#### `PATCH /api/admin/notes/:id`
Request（部分字段更新）：
```json
{
  "title": "new title",
  "content": "new markdown",
  "updated": "2026-02-06"
}
```

Response 200：同创建返回结构（含 commit）。

#### `DELETE /api/admin/notes/:id`
v0 建议：软删（移动文件到 `content/.trash/notes/<id>.md`）

Response 200:
```json
{ "ok": true, "commit": { "sha": "..." } }
```

---

#### `GET /api/admin/mindmaps`
Query: 同 `GET /api/admin/notes`（`include=meta/limit/after`）

Response 200:
```json
{
  "mindmaps": [
    {
      "id": "otel-context",
      "path": "content/mindmaps/otel-context.json",
      "sha": "blobSha",
      "size": 2345,
      "meta": { "title": "OTel Context", "updated": "2026-02-06T...", "nodeCount": 12, "edgeCount": 14 }
    }
  ],
  "paging": { "after": null, "nextAfter": null }
}
```

#### `GET /api/admin/mindmaps/:id`
Response 200:
```json
{
  "mindmap": {
    "id": "otel-context",
    "path": "content/mindmaps/otel-context.json",
    "input": { "id": "otel-context", "title": "OTel Context", "nodes": [], "edges": [] },
    "json": "{\\n  \\\"id\\\": ... }"
  }
}
```

#### `POST /api/admin/mindmaps`
Request:
```json
{
  "id": "otel-context",
  "title": "OTel Context",
  "format": "reactflow",
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

Response 201:
```json
{
  "mindmap": { "id": "otel-context", "path": "content/mindmaps/otel-context.json" },
  "commit": { "sha": "..." }
}
```

#### `PATCH /api/admin/mindmaps/:id`
同 notes 的 PATCH 语义，返回含 commit。

#### `DELETE /api/admin/mindmaps/:id`
同 notes 的删除策略（可软删）。

---

#### `GET /api/admin/roadmaps`
Query: 同 `GET /api/admin/notes`（`include=meta/limit/after`）

Response 200:
```json
{
  "roadmaps": [
    {
      "id": "ai-infra",
      "path": "content/roadmaps/ai-infra.yml",
      "sha": "blobSha",
      "size": 3456,
      "meta": { "title": "AI Infra", "theme": "violet", "layout": "horizontal" }
    }
  ],
  "paging": { "after": null, "nextAfter": null }
}
```

#### `GET /api/admin/roadmaps/:id`
Response 200:
```json
{
  "roadmap": {
    "id": "ai-infra",
    "path": "content/roadmaps/ai-infra.yml",
    "exists": true,
    "yaml": "id: ai-infra\\n...",
    "json": { "id": "ai-infra", "nodes": [] }
  }
}
```

#### `PUT /api/admin/roadmaps/:id`
写入（或创建）`content/roadmaps/<id>.yml`（会进行 YAML 校验；若 YAML 内 `id` 与 path 不一致会返回 `422`）。

Request:
```json
{ "yaml": "id: ai-infra\\n..." }
```

#### `DELETE /api/admin/roadmaps/:id`
软删到 `content/.trash/roadmaps/<id>.yml`（并删除原文件）。

---

#### `POST /api/admin/uploads`
Content-Type: `multipart/form-data`
- `file`: Blob
- `folder`（可选）：默认 `uploads`，v0 可固定

Response 201:
```json
{
  "asset": {
    "path": "public/uploads/2026/02/<hash>.jpg",
    "url": "/uploads/2026/02/<hash>.jpg",
    "bytes": 123456,
    "contentType": "image/jpeg"
  },
  "commit": { "sha": "..." }
}
```

#### `GET /api/admin/uploads`
列出 `public/uploads/` 下的资产（供 Studio 资产库使用）。

Query:
- `q`（可选）：按 path/url 模糊搜索
- `limit`（可选）：默认 80，最大 200
- `after`（可选）：分页游标（上一页最后一个 `asset.path`）

Response 200:
```json
{
  "assets": [
    {
      "path": "public/uploads/2026/02/<hash>.jpg",
      "url": "/uploads/2026/02/<hash>.jpg",
      "rawUrl": "https://raw.githubusercontent.com/<owner>/<repo>/main/public/uploads/...",
      "bytes": 123456,
      "contentType": "image/jpeg",
      "sha": "blobSha"
    }
  ],
  "paging": { "after": null, "nextAfter": null },
  "truncated": false
}
```

#### `DELETE /api/admin/uploads`
删除指定资产（硬删；可通过 git history 找回）。

Request:
```json
{ "path": "public/uploads/2026/02/<hash>.jpg" }
```

Response 200:
```json
{ "ok": true, "commit": { "sha": "...", "url": "..." } }
```

---

#### `POST /api/admin/commit`（可选：批量原子提交）
用于一次性提交多个文件（例如：上传封面 + 发布文章合成一个 commit）。

Request:
```json
{
  "message": "publish: 2026-02-06-otel-tracing",
  "expectedHeadSha": "optional",
  "files": [
    { "path": "public/uploads/2026/02/a.jpg", "contentBase64": "...", "encoding": "base64" },
    { "path": "content/notes/2026-02-06-otel-tracing.md", "content": "---\\n...\\n---\\n", "encoding": "utf8" }
  ]
}
```

Response 200:
```json
{ "commit": { "sha": "..." } }
```

---

## 6. GitHub 写入：Atomic Commit 流程（推荐 Git Data API）

目标：多个文件写入到 `main`，只产生 1 次 commit。

步骤：
1. 获取 head：
   - `GET /repos/{owner}/{repo}/git/ref/heads/main` → `headSha`
2.（可选）并发控制：
   - 若请求带 `expectedHeadSha` 且不匹配当前 `headSha` → `409 CONFLICT (HEAD_MOVED)`
3. 获取 base tree：
   - `GET /repos/{owner}/{repo}/git/commits/{headSha}` → `treeSha`
4. 为每个文件创建 blob：
   - `POST /repos/{owner}/{repo}/git/blobs`（`content` + `encoding`）
5. 创建 tree：
   - `POST /repos/{owner}/{repo}/git/trees`（`base_tree: treeSha` + `tree[]`）
6. 创建 commit：
   - `POST /repos/{owner}/{repo}/git/commits`（`message`, `tree`, `parents:[headSha]`）
7. 更新 ref：
   - `PATCH /repos/{owner}/{repo}/git/refs/heads/main`（`sha: newCommitSha`, `force:false`）
8. 返回 commit sha + url。

失败处理：
- 如果第 7 步因 ref 更新冲突失败：返回 `409`，客户端可重试（重新读 head 并重放）。

---

## 7. 错误码（建议）

| HTTP | code | 场景 |
|---|---|---|
| 400 | `BAD_REQUEST` | JSON 解析失败、字段类型不对 |
| 401 | `UNAUTHENTICATED` | 未登录/Session 失效 |
| 403 | `FORBIDDEN` | 不在 `ADMIN_GITHUB_LOGINS`、无 repo 写权限 |
| 409 | `HEAD_MOVED` | expectedHeadSha 不匹配；并发写冲突 |
| 413 | `PAYLOAD_TOO_LARGE` | upload 超过上限 |
| 422 | `VALIDATION_FAILED` | title/content/slug/path 校验失败 |
| 429 | `RATE_LIMITED` | 写入太频繁（本地或 GitHub） |
| 502 | `GITHUB_UPSTREAM` | GitHub API 异常/超时 |

建议额外返回：
- `details.githubStatus`、`details.githubMessage`（当上游为 GitHub）

---

## 8. 目录与模块拆分（基于当前 repo）

当前 repo：
- `src/`：Web UI（Vite/React）
- `mock/`：开发期的本地文件 API

推荐新增（v0）：
```
publisher/
  src/
    config.ts                 # env + repo/branch 配置
    http/
      app.ts                  # 创建 app（Express/Hono 均可）
      errors.ts               # error format + request id
      cors.ts                 # CORS allowlist
      rateLimit.ts            # 简单限流（可选）
    auth/
      github.ts               # OAuth start/callback, user fetch
      token.ts                # issue/verify bearer token (JWT/JWE)
      oauthState.ts           # state/PKCE（可选：用 cookie 或签名 state）
      guard.ts                # requireAdmin()
    github/
      client.ts               # fetch wrapper + retry + auth header
      gitData.ts              # blobs/trees/commits/refs 原子提交
      validate.ts             # path whitelist, size limits
    content/
      notes.ts                # noteId 生成 + frontmatter 序列化
      mindmaps.ts             # mindmap schema 校验
      uploads.ts              # hash/path 生成
    routes/
      auth.ts
      adminNotes.ts
      adminMindmaps.ts
      adminUploads.ts
      adminCommit.ts          # 可选批量提交
```

本 repo 的 `mock/` 建议保留用于本地开发读内容；生产站点侧推荐走“构建期生成索引/静态 API”（见下一节）。

---

## 9. 站点侧（便宜）部署建议

你现在的前端是 SPA。在“GitHub Pages 根域 + Publisher API 独立域名”的组合下，建议把“公共读”与“发布写”彻底拆开：

- 公共读：构建期生成静态 JSON，随站点一起发布（同源、零成本、无 CORS）
- 发布写：只在需要发布时调用 Publisher（跨域、Bearer Token）

### 9.1 公共站点：纯静态（几乎 0 成本）
- 在 CI 构建阶段把 `content/` 解析为静态 JSON：
  - `public/api/profile.json`
  - `public/api/categories.json`
  - `public/api/notes/index.json`
  - `public/api/notes/<id>.json`
  - `public/api/roadmaps/index.json`
  - `public/api/roadmaps/<roadmapId>.json`
  - `public/_index/search.json`（给 ⌘K 客户端搜索）
- 静态站点托管（通常都有 free tier）：Cloudflare Pages / Netlify / Vercel / GitHub Pages（注意路由与重写）

### 9.2 Publisher API：最便宜的方案（相对）
- **Cloudflare Workers**：通常是性价比最高的“长期便宜”方案之一（有免费额度，且适合这种轻后端）。
- 备选：Vercel/Netlify Functions（也有免费额度，但限制/计费规则可能更敏感）。

> 价格/额度经常变化：最终以各平台最新定价为准；但“静态站点 + 一个轻量 OAuth 写入服务”在个人使用场景里基本能做到接近 0 成本。

### 9.3 GitHub Pages 根域（你当前选择）
仓库：
- 公共站点仓库：`<user>.github.io`（User Pages）
- `main` 分支保留 `content/` 与前端源码；由 GitHub Actions 构建并发布 Pages（推荐用官方 Pages Action 流程，避免把 `dist/` 直接 commit 到仓库）。

Publisher 写入：
- `CONTENT_REPO` 直接指向 `<user>/<user>.github.io`
- Publisher 提交到 `main` 后触发 Actions 自动发布站点
