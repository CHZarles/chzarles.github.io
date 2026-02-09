---
title: 用 OpenTelemetry 把“慢”变成可解释的证据链
date: 2026-02-05
categories: [observability, ai-infra]
tags: [otel, tracing, latency]
nodes: [ai-infra/otel, ai-infra/observability]
excerpt: "目标不是“埋点”，而是建立一条从用户请求 → 关键 span → 资源/代码变更的证据链。"
---

## 为什么 tracing 不该是“最后再做”

如果你把 tracing 当成上线前的装饰，它永远只会是：  
一堆 span + 一堆不知道怎么用的图。

真正有价值的是：**把一次性能问题，变成可复盘的证据链**。

## 一条最小闭环的建议

1. 定义一个“用户可感知”的 `SLO`（例如 P95 < 800ms）
2. 把 `root span` 的语义对齐：路由、租户、实验组、模型版本
3. 选 3 个关键子 span：排队、推理、后处理
4. 每次优化只回答一个问题：**慢在谁、为什么、怎么证明改好了**

## 示例：把模型版本写进 span 属性

```ts
span.setAttribute("model.version", process.env.MODEL_VERSION ?? "unknown");
span.setAttribute("experiment.bucket", bucketId);
```

## 下一步

把 tracing 和 release 绑定：每一次发布，都能对比“变快/变慢”的证据。  
这才是 infra 的味道。

