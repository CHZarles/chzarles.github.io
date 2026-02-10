# Hyperblog Studio 使用说明

Studio 是写作者的后台（`/studio/*`）：用 GitHub OAuth 登录，拿到短期 Token，然后通过 Publisher API 把内容 **commit 到 GitHub main**。公开站点由 GitHub Actions build 后发布到 GitHub Pages。

---

## 1) 进入 Studio

- 线上：`https://<user>.github.io/studio/notes`
- 本地：`http://localhost:5173/studio/notes`

首次进入会看到登录页，或右上角的 `Login with GitHub`。

### 登录流程（你会看到什么）

1. 点击 `Login with GitHub`
2. 跳转到 GitHub 授权
3. 授权完成后回到 `/<site>/auth/callback`
4. Studio 把 token 存到 `sessionStorage`，再跳回你原本的 Studio 页面

常见问题：

- `403 Not allowed`：当前 GitHub 用户名不在 Publisher 的 `ADMIN_GITHUB_LOGINS` 白名单里
- `Session expired`：token 过期了，重新登录即可

---

## 2) 顶部栏：Session / Sync / Logout

- `Session`：刷新登录态 + 仓库 `headSha`（用于冲突检测）
- `Sync`：清理 Studio 的本地缓存并从 GitHub 重新拉取（**不会删除本地草稿**）
- `Logout`：清掉 `sessionStorage` 里的 token

左上角会显示当前使用的 Publisher Base URL。你如果怀疑请求跑到了错误的 Publisher，看这里最快。

---

## 3) 两种“保存”：本地草稿 vs GitHub 提交

Studio 故意把“写作的频繁保存”与“发布/写入仓库”分开：

- `Save local`：只保存到浏览器 `localStorage`，**不产生 commit**
- `Publish / Update / Commit draft`：调用 Publisher 的写入接口，**一次 commit** 写到 GitHub（可以同时写 Note + Uploads 等多文件）

另外，Note 里有一个 `Draft (hide on public site)` 开关：

- `draft: true` 仍然会 commit（便于跨设备同步），只是公开站点默认过滤不展示

---

## 4) Notes（`/studio/notes`）

布局：左侧列表 / 中间正文编辑器 / 右侧 Metadata。

### 新建与打开

- `New`：开始一篇新 Note（如果当前有未保存内容会提示）
- 点击左侧条目：打开现有 Note
- 如果本地有同一篇 Note 的草稿，会询问是否恢复

### 编辑模式与快捷键

- `Edit / Split / Preview` 三种视图
- 快捷键：
  - `Ctrl/Cmd+S`：Save local
  - `Ctrl/Cmd+Enter`：Publish / Update

### 上传图片 / PDF（Upload）

- 点击顶部 `Upload` 选择文件
- 文件会先进入 `Staged uploads`（暂存区），**在你 Publish/Update 时一起 commit**
- 插入规则：
  - 图片：自动插入 `![](/uploads/...)`
  - 其他文件：插入链接 `[name](/uploads/...)`
- `Cover URL` 默认会填第一张 staged 图，也可以手动改成任意 `/uploads/...`

### Metadata（右侧）

- `Categories`：输入 category id 回车；也可以点击下方 chip 快速勾选（来源于 `content/categories.yml`）
- `Tags`：自由输入
- `Roadmap nodes`：把 Note 挂到 roadmap 节点（例如 `ai-infra/otel`）
- `Mindmaps`：引用 mindmap id（会写入 frontmatter，前台可作为入口/嵌入）
- `Draft`：勾选后前台默认不展示（但仍会 commit）

### 删除

- 打开已有 Note 时会出现 `Trash`：删除会产生一次 commit

### 冲突（main moved）

如果看到 `Conflict: main moved. Refresh and retry.`：

1. 点顶部 `Session`（或 `Sync`）
2. 再点一次 `Publish/Update`

这通常意味着你发布期间 `main` 又被其它提交推进了。

---

## 5) Assets（`/studio/assets`）

资产库管理的是 `public/uploads/*`。

- `Upload`：把文件加入暂存区
- 资产卡片上 `Trash`：加入 “staged delete”（不会立刻删除）
- `Commit`：一次提交写入所有 staged uploads/deletes
- 常用操作：
  - `Copy URL`：复制 `/uploads/...`
  - `Copy Markdown`：复制 `![](/uploads/...)`
  - `Open`：打开 GitHub raw 预览（便于确认文件内容）

---

## 6) Roadmaps（`/studio/roadmaps`）

Roadmap 是 YAML（`content/roadmaps/<id>.yml`）。

- 左侧：列表 / New / 本地草稿（LOCAL DRAFTS）
- 中间：YAML 编辑器
- 右侧：Preview
  - Graph 是主要视图
  - Outline 可展开/收起
  - `Horizontal/Vertical` 只影响预览（不改文件），方便你看布局效果

同样支持：

- `Save local`（`Ctrl/Cmd+S`）
- `Publish`（`Ctrl/Cmd+Enter`，commit 到 GitHub）

---

## 7) Mindmaps（`/studio/mindmaps`）

Mindmap 存储为 ReactFlow JSON（`content/mindmaps/<id>.json`）。

画布操作：

- 双击空白处：新增节点
- 拖拽节点连接点：建立边
- `Backspace/Delete`：删除选中节点/边
- `Fit`：自动缩放到合适视图

右侧 Properties：

- `Mindmap id`：创建时可改；编辑已有 mindmap 时会锁定
- `Title`：可选
- 选中节点后：可编辑 label；`Add child` 快速创建子节点；`Delete` 删除节点

保存与发布：

- `Save local`：只存浏览器
- `Publish/Update`：commit 到 GitHub

---

## 8) Config（`/studio/config`）

Config 页面直接编辑 3 个驱动文件：

- Profile：`content/profile.json`
- Categories：`content/categories.yml`
- Projects：`content/projects.json`

要点：

- 顶部 `Save` 会直接 commit（不会走本地草稿逻辑）
- `Categories` 支持两种视图：
  - `Form`：结构化编辑（支持 tone、排序、删除）
  - `YAML`：直接编辑原始文件
- Config 会做本地缓存；如果你怀疑缓存不一致，点顶部 `Sync`

---

## 9) 本地开发常见误会：我发布了，但 localhost 没变

Studio 写入的是 **GitHub main**。你本机的 `content/*` 不会自动更新。

- 想让 `pnpm dev` 看到刚发布的内容：到仓库目录执行 `git pull`
- 想让 `https://<user>.github.io` 更新：等待 GitHub Actions build 完成即可

