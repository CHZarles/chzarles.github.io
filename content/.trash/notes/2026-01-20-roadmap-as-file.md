---
title: Roadmap-as-File：把技术栈变成“特殊目录”
date: 2026-01-20
categories: [writing, product]
tags: [roadmap, indexing, knowledge]
nodes: [writing-system/roadmap-file, writing-system/index]
excerpt: "Roadmap 不是系统生成的技能图，而是你亲手维护的目录文件：它是入口，也是叙事。"
---

## 我想要的体验

我写一个 `roadmaps/ai-infra.yml`：  
里面有节点（目录骨架），也有依赖（先修关系）。

然后我写 notes 的时候，只要挂上：

```yaml
nodes:
  - ai-infra/otel
  - ai-infra/k8s
```

UI 就能把它们聚合成：节点入口、路径、分享卡片。  
这就是“写文件驱动产品”的爽感。
