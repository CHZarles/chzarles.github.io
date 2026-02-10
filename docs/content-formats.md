# Studio 内容格式规范 v0（Notes / Roadmaps / Mindmaps / Categories…）

Studio 的“编辑”最终都会落到仓库里的文件（`content/*`、`public/uploads/*`）。这份文档说明每类内容应该按什么格式组织，方便你在 Studio、GitHub Web、或本地编辑时保持一致。

如果你想在提交前做一次校验：`pnpm run validate:content`（规则在 `scripts/validate-content.ts`）。

---

## 0. 文件与页面的对应关系

- Notes（文章）：`content/notes/<noteId>.md`
- Roadmaps（路线图）：`content/roadmaps/<roadmapId>.yml`
- Mindmaps（思维导图）：`content/mindmaps/<mindmapId>.json`
- Categories（分类）：`content/categories.yml`
- Projects（项目）：`content/projects.json`
- Profile（站点信息/首页 Hero）：`content/profile.json`
- Uploads（图片/PDF 等资产）：`public/uploads/*`（站点访问路径为 `/uploads/...`）

---

## 1. ID 规则（强烈建议照做）

这些 ID 会直接进入 URL、引用关系与检索索引，尽量把它们当作“稳定主键”。

### 通用 id（category / roadmap / mindmap / project）

- 规则：`^[a-z0-9-]{2,80}$`
- 示例：`ai-infra`、`observability`、`otel-context`

### roadmap node id（节点）

- 规则：`^[a-z0-9][a-z0-9-]{0,79}$`（不能以 `-` 开头）
- 同一张 roadmap 内必须全局唯一（整棵树里不能重名）
- 示例：`foundations`、`otel`、`metrics-pipeline`

### note id（文章文件名）

- 规则：`YYYY-MM-DD-<slug>`
- slug 规则：`^[a-z0-9-]{3,80}$`
- 示例：`2026-02-10-otel-context`

> 改 id = 改链接。改之前要同步更新所有引用（notes 的 `categories/nodes/mindmaps`、roadmap 的 `edges/pinned` 等）。

---

## 2. Notes（`content/notes/<noteId>.md`）

格式：**Markdown 正文 + YAML frontmatter**（用 `---` 包起来）。

### frontmatter 字段（v0）

- `title`：string（必填）
- `date`：`YYYY-MM-DD`（建议必填；Studio 会要求）
- `updated`：`YYYY-MM-DD`（可选；不填则用文件时间）
- `excerpt`：string（可选；不填则从正文抽取）
- `categories`：string[]（可选，填 category id）
- `tags`：string[]（可选）
- `nodes`：string[]（可选，填 **node ref**：`roadmapId/nodeId`）
- `mindmaps`：string[]（可选，填 mindmap id）
- `cover`：string（可选，建议 `/uploads/...`）
- `draft`：boolean（可选；`true` 时前台默认不展示，但仍会 commit 到 GitHub）

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
mindmaps: [otel-context]
cover: /uploads/20260210-otel-context-3a1f2c.avif
draft: false
---

这里是正文 Markdown…
```

### 你在 Studio 里会怎么填

- `Slug` 只用于生成文件名（note id），并不会作为单独路由使用。
- `Roadmap nodes` 里填的是 `roadmapId/nodeId`（不是标题路径）。
- 上传的图片会先进入 staged 区，只有在 `Publish/Update` 时才会写入 `public/uploads/*`。

---

## 3. Categories（`content/categories.yml`）

格式：YAML 数组，每一项是一个 category。

字段：

- `id`：category id（必填）
- `title`：展示标题（必填）
- `description`：描述（可选）
- `tone`：UI 色调（可选）
  - 可用值：`neutral | cyan | violet | lime | amber | rose`

> `tone` 只影响 UI 的“气质色”，不影响内容组织逻辑。

### 示例

```yml
- id: ai-infra
  title: AI Infra
  description: 模型训练/推理工程、平台与可观测性
  tone: violet

- id: writing
  title: 写作系统
  description: 知识结构、卡片、索引与复盘
  tone: amber
```

---

## 4. Roadmaps（`content/roadmaps/<roadmapId>.yml`）

格式：YAML 对象。文件名建议与 `id` 一致（否则校验会 warn）。

顶层字段：

- `id`：roadmap id（必填）
- `title`：标题（必填）
- `description`：描述（可选）
- `theme`：主题名（可选，更多是展示用元信息）
- `layout`：`horizontal | vertical`（可选；当前前台默认用 horizontal，可切换）
- `nodes`：节点树（必填，数组）

### 节点字段（每个 node）

- `id`：node id（必填；同 roadmap 内全局唯一）
- `title`：标题（必填）
- `description`：可选
- `children`：子节点数组（可选）
- `edges`：依赖（可选，`string[]`，填 **同一张 roadmap 内** 的 node id）
- `pinned`：置顶 notes（可选，`string[]`，填 note id，例如 `2026-02-10-otel-context`）
- `status` / `icon`：可选（v0 暂时更多是元信息；不影响引用）

### 示例（含树 + 依赖 + 置顶）

```yml
id: ai-infra
title: AI Infra
description: 从平台到可观测性
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
        edges: [linux, networking]      # 依赖：同一张 roadmap 的 node id
        pinned:
          - 2026-02-10-otel-context     # 置顶：noteId（文件名）
```

### Notes 如何“挂到节点上”

在 Note frontmatter 里：

```yml
nodes: [ai-infra/otel, ai-infra/linux]
```

这里的 `otel/linux` 必须是 roadmap 中存在的 node id（否则前台会忽略/校验会报警）。

---

## 5. Mindmaps（`content/mindmaps/<mindmapId>.json`）

格式：JSON 对象。Studio 里是可视化编辑（ReactFlow），一般不建议手写。

字段（v0，建议）：

- `id`：mindmap id（建议写上；Studio 会写）
- `title`：string（可选）
- `format`：string（建议固定 `"reactflow"`）
- `nodes`：array（ReactFlow nodes）
- `edges`：array（ReactFlow edges）
- `viewport`：`{ x, y, zoom }`（可选）
- `updated`：ISO 时间字符串（可选；不填会用文件时间）

### 最小示例

```json
{
  "id": "otel-context",
  "title": "OTel Context",
  "format": "reactflow",
  "nodes": [
    { "id": "n1", "type": "mind", "position": { "x": 0, "y": 0 }, "data": { "label": "Root" } }
  ],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

### Notes 如何引用 mindmap

在 Note frontmatter 里：

```yml
mindmaps: [otel-context]
```

`otel-context` 对应文件 `content/mindmaps/otel-context.json`。

---

## 6. Projects（`content/projects.json`）

格式：JSON 数组。每项是一个项目卡片。

字段（v0）：

- `id`：project id（必填）
- `name`：展示名（必填）
- `description`：描述（建议填）
- `repoUrl`：仓库链接（建议填）
- `homepage`：项目主页（可选；有就会被当作“live”）
- `stack`：string[]（可选）
- `highlights`：string[]（可选）

注意：

- Projects 已与 Roadmap Nodes 解耦：不要再写 `nodes` 字段（校验会报错）。

### 示例

```json
[
  {
    "id": "hyperblog",
    "name": "Hyperblog",
    "description": "Roadmap-as-File + Studio 发布链路",
    "repoUrl": "https://github.com/CHZarles/chzarles.github.io",
    "homepage": "https://chzarles.github.io",
    "stack": ["Vite", "React", "Tailwind", "Cloudflare Workers"]
  }
]
```

---

## 7. Uploads（`public/uploads/*`）

约定：

- 文件都放在 `public/uploads/` 下
- 前台引用统一用站点路径：`/uploads/<filename>`

Studio 的上传会自动生成安全文件名，并在 Notes/Assets 里帮你复制 URL/Markdown。

