# Hyperblog (UI Prototype)

一个“可探索的个人技术空间”UI 原型：同时支持传统 `Categories` 目录与 `Roadmap-as-File` 路线图目录；所有内容统一为 `Note`（不区分长短文）。

## 运行

```bash
npm install
npm run dev
```

- Web（含 Mock API）: `http://localhost:5173`

可选：单独启动 mock server（不走 Vite 中间件）

```bash
npm run dev:api
```

## 内容与数据（文件驱动）

- Profile: `content/profile.json`
- Categories: `content/categories.yml`
- Roadmaps: `content/roadmaps/*.yml`
- Notes: `content/notes/*.md`（frontmatter 里用 `nodes: ["ai-infra/otel"]` 绑定节点）
- Projects: `content/projects.json`

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
