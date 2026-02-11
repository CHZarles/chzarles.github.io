# 内容格式（v0）

Hyperblog 是**文件驱动**：`content/*` + `public/uploads/*` 是唯一真相。Studio、GitHub Web 或本地编辑最终都会落到这些文件。

提交前做一次校验：

```bash
pnpm run validate:content
```

规则见：`scripts/validate-content.ts`

---

## 0) 文件与页面的对应关系

| 内容 | 文件路径 | 公开页 |
|---|---|---|
| Notes（文章） | `content/notes/<noteId>.md` | `/notes/<noteId>` |
| Categories（分类目录） | `content/categories.yml` | `/categories` / `/categories/<id>` |
| Roadmaps（路线图目录） | `content/roadmaps/<roadmapId>.yml` | `/roadmaps` / `/roadmaps/<id>` / `/roadmaps/<id>/node/<nodeId>` |
| Mindmaps（思维导图） | `content/mindmaps/<mindmapId>.json` | `/mindmaps` / `/mindmaps/<id>` |
| Projects（作品集） | `content/projects.json` | `/projects` / `/projects/<id>` |
| Profile / Hero | `content/profile.json` | `/`（以及 `/api/profile.json`） |
| Uploads（资产） | `public/uploads/*` | `/uploads/...` |

---

## 0.1) Roadmap vs Mindmap（什么时候用哪个？）

- **Roadmap**：更像“特殊目录/路线图”。它是你技术栈的结构化表达；每个节点都是入口，用来聚合 Notes（并可表达依赖）。
- **Mindmap**：更像“思维导图/概念图”。它是自由结构的图，用来解释一个主题内部的关系；通常被 Note 引用（也有独立页）。

---

## 1) ID 规则（强烈建议照做）

这些 ID 会进入 URL、引用关系与检索索引，把它们当作“稳定主键”。

### 通用 id（category / roadmap / mindmap / project）

- 规则：`^[a-z0-9-]{2,80}$`
- 示例：`ai-infra`、`observability`、`otel-context`

### roadmap node id（节点）

- 规则：`^[a-z0-9][a-z0-9-]{0,79}$`（不能以 `-` 开头）
- 同一张 roadmap 内必须全局唯一（整棵树里不能重名）

### note id（文章文件名）

- 规则：`YYYY-MM-DD-<slug>`
- slug 规则：`^[a-z0-9-]{3,80}$`
- 示例：`2026-02-11-hyperblog-product-and-deploy`

> 改 id = 改链接。改之前要同步更新所有引用（notes 的 `categories/nodes/mindmaps`、roadmap 的 `edges/pinned` 等）。

---

## 2) Notes（`content/notes/<noteId>.md`）

格式：**Markdown 正文 + YAML frontmatter**（用 `---` 包起来）。

### frontmatter 字段（v0）

- `title`：string（必填）
- `date`：`YYYY-MM-DD`（建议必填）
- `updated`：`YYYY-MM-DD`（可选）
- `excerpt`：string（可选）
- `categories`：string[]（可选，填 category id）
- `tags`：string[]（可选）
- `nodes`：string[]（可选，填 node ref：`roadmapId/nodeId`）
- `mindmaps`：string[]（可选，填 mindmap id）
- `cover`：string（可选，建议 `/uploads/...`）
- `draft`：boolean（可选；`true` 时前台默认不展示，但仍可 publish 到 GitHub）

### 示例

```md
---
title: OTel Context 的几个坑
date: 2026-02-10
updated: 2026-02-11
excerpt: Context 不是“一个 map”，它是传播协议的一部分。
categories: [ai-infra, observability]
tags: [otel, tracing]
nodes: [ai-infra/otel]
mindmaps: [otel-evidence-loop]
cover: /uploads/20260210-otel-context-3a1f2c.avif
draft: false
---

这里是正文 Markdown…
```

---

## 3) Categories（`content/categories.yml`）

格式：YAML 数组，每一项是一个 category。

字段：

- `id`：category id（必填）
- `title`：展示标题（必填）
- `description`：可选
- `tone`：UI 色调（可选）
  - 可用值：`neutral | cyan | violet | lime | amber | rose`

示例：

```yml
- id: ai-infra
  title: AI Infra
  description: Serving / GPU / K8s / 成本与可靠性（偏工程）
  tone: violet
```

---

## 4) Roadmaps（`content/roadmaps/<roadmapId>.yml`）

格式：YAML 对象。文件名建议与 `id` 一致。

顶层字段：

- `id`：roadmap id（必填）
- `title`：标题（必填）
- `description`：可选
- `theme`：可选（展示元信息）
- `layout`：`horizontal | vertical`（可选；前台可切换）
- `nodes`：节点树（必填，数组）

节点字段（每个 node）：

- `id`：node id（必填；同 roadmap 内全局唯一）
- `title`：标题（必填）
- `description`：可选
- `children`：子节点数组（可选）
- `edges`：依赖（可选，`string[]`，填同一张 roadmap 内的 node id）
- `pinned`：置顶 notes（可选，填 note id）
- `status` / `icon`：可选（展示用元信息；不影响引用）

示例：

```yml
id: ai-infra
title: AI Infra
theme: violet
layout: horizontal
nodes:
  - id: foundations
    title: Foundations
    children:
      - id: linux
        title: Linux
      - id: networking
        title: Networking

  - id: observability
    title: Observability
    children:
      - id: otel
        title: OpenTelemetry
        edges: [linux, networking]
        pinned:
          - 2026-02-05-otel-tracing
```

Notes 如何“挂到节点上”：

```yml
nodes: [ai-infra/otel, ai-infra/linux]
```

---

## 5) Mindmaps（`content/mindmaps/<mindmapId>.json`）

格式：JSON 对象。Studio 里是可视化编辑（ReactFlow），一般不建议手写。

建议字段：

- `id`：mindmap id
- `title`：string（可选）
- `format`：string（建议固定 `"reactflow"`）
- `nodes`：array（ReactFlow nodes）
- `edges`：array（ReactFlow edges）
- `viewport`：`{ x, y, zoom }`（可选）
- `updated`：ISO 时间字符串（可选）

最小示例：

```json
{
  "id": "otel-evidence-loop",
  "title": "OTel Evidence Loop",
  "format": "reactflow",
  "nodes": [{ "id": "n1", "position": { "x": 0, "y": 0 }, "data": { "label": "Root" } }],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

Notes 如何引用 mindmap：

```yml
mindmaps: [otel-evidence-loop]
```

---

## 6) Projects（`content/projects.json`）

格式：JSON 数组。每项是一个项目卡片。

字段（v0）：

- `id`：project id（必填）
- `name`：展示名（必填）
- `description`：建议填
- `repoUrl`：建议填
- `homepage`：可选
- `stack`：string[]（可选）
- `highlights`：string[]（可选）

注意：

- Projects 已与 Roadmap Nodes 解耦：不要再写 `nodes` 字段（校验会报错）。

示例：

```json
[
  {
    "id": "hyperblog",
    "name": "Hyperblog",
    "description": "Roadmap-as-File + Studio 发布链路",
    "repoUrl": "https://github.com/<user>/<user>.github.io",
    "homepage": "https://<user>.github.io",
    "stack": ["Vite", "React", "Tailwind", "Cloudflare Workers"],
    "highlights": ["Roadmap-as-File", "Studio 一键 Publish", "静态 JSON API（dist/api/*.json）"]
  }
]
```

---

## 7) Uploads（`public/uploads/*`）

约定：

- 文件都放在 `public/uploads/` 下
- 前台引用统一用站点路径：`/uploads/<filename>`

Studio 上传会自动生成安全文件名，并在 Notes/Assets 里帮你复制 URL/Markdown。
