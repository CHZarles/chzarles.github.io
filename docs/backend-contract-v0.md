# Hyperblog · Publisher Backend Contract v0 (Mode B)

目标：在**公开 GitHub 仓库**里直接写 `main` 分支（Notes / Mindmaps / Uploads），站点侧通过 CI/CD 自动构建发布；Publisher 后端只负责**鉴权 + 写入 + 原子提交**。

本文件定义 v0 的后端契约：路由、请求/响应、文件路径、鉴权/CSRF、Git 提交流程、错误码，以及按当前 repo 的推荐模块拆分。

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
- `SESSION_SECRET`：用于签名 session
- `ADMIN_GITHUB_LOGINS`：逗号分隔白名单，例如：`charles,alice`
- `CONTENT_REPO`：例如 `charles/hyperblog-content`
- `CONTENT_BRANCH`：固定 `main`
- `CONTENT_ROOT`：固定 `""`（默认 repo 根），如要子目录可设 `site/`（v1）

OAuth scope（公开仓库写 main）
- `public_repo`（用于写入公开 repo）
- `read:user`（用于读取用户信息，通常默认就够）

### 3.2 Session Cookie

建议：Cookie Session（服务端存储最少），内容只包含：
- `sub`: GitHub user id
- `login`: GitHub login
- `iat/exp`

Cookie 属性：
- `HttpOnly`
- `Secure`（生产环境必须）
- `SameSite=Lax`
- `Path=/`

### 3.3 CSRF（Admin 写接口必须）

v0 推荐：**Double Submit Cookie**
- 登录后发两个 cookie：
  - `hb.sid`（HttpOnly，session）
  - `hb.csrf`（非 HttpOnly，随机 token）
- 写请求必须带 header：`X-CSRF-Token: <hb.csrf>`
- 服务端校验：header == cookie

---

## 4. API 规范（通用）

### 4.1 Base
- Base URL：`/api`
- Content-Type：`application/json; charset=utf-8`
- 所有响应包含：`X-Request-Id`（用于排查）

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
- `redirect`（可选）：登录成功后跳回的路径（默认 `/`）

Response:
- `302` 跳转 GitHub 授权页

#### `GET /api/auth/github/callback`
Query: `code`, `state`

Response:
- 成功：`302` 跳转到 `redirect`
- 失败：`302` 跳转到 `/login?error=...`（或返回 JSON，取决于前端形态）

#### `GET /api/auth/me`
Response 200:
```json
{
  "user": { "id": 123, "login": "charles", "avatarUrl": "..." },
  "repo": { "fullName": "charles/hyperblog-content", "branch": "main" }
}
```

#### `POST /api/auth/logout`
Response 200:
```json
{ "ok": true }
```

---

### 5.2 Admin（需要 session + CSRF）

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
      rateLimit.ts            # 简单限流（可选）
    auth/
      github.ts               # OAuth start/callback, user fetch
      session.ts              # cookie session encode/decode
      csrf.ts                 # double submit cookie
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

你现在的前端是 SPA，依赖 `/api/*`。在模式 B 下，为了省钱与稳定，建议：

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

