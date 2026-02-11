# 文档目录

这是一组“面向使用”的文档。Hyperblog 是一套**文件驱动**的个人博客系统：公开站点纯静态；Studio 通过 Publisher API 把改动 **commit 回 GitHub main**。

---

## 我想做什么？

| 目标 | 去看 |
|---|---|
| 把站点部署到 GitHub Pages（纯静态） | [deploy-guide.md](deploy-guide.md) |
| 开启线上 Studio（Cloudflare Workers Publisher） | [deploy-guide.md](deploy-guide.md) |
| 学会用 Studio 写作/上传/统一 Publish | [studio-guide.md](studio-guide.md) |
| 按规范写 Notes/Roadmaps/Mindmaps/Categories/Projects | [content-formats.md](content-formats.md) |
| 调整首页 Hero/强调色/导航/外链 | [configuration.md](configuration.md) |
| 了解 Publisher API 路由、鉴权、错误码 | [backend-contract-v0.md](backend-contract-v0.md) |

---

## 本地最小闭环（推荐先跑通）

只看公开站（不需要后端）：

```bash
pnpm install
pnpm dev
```

打开：`http://localhost:5173`

本地也要用 Studio Publish（写到 GitHub main）：再起一个本地 Publisher：

```bash
cp publisher/.dev.vars.example publisher/.dev.vars
pnpm dev:publisher -- --port 8788
```

然后打开：`http://localhost:5173/studio/notes`
