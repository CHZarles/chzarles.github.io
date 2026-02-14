---
title: 先有 Telemetry Design，才谈得上 SLO
date: 2026-02-05
categories: [observability, ai-infra]
tags: [slo, metrics, tracing]
nodes: [ai-infra-complex/telemetry-design, ai-infra-complex/slo, ai-infra-complex/otel]
excerpt: "SLO 不是一个数字；它需要一整套“可证明”的观测设计：语义、采样、维度、以及可以追溯到变更的证据链。"
---

我现在越来越倾向于把 **Telemetry Design** 当成“产品需求文档”的一部分：

- 你要回答的核心问题是什么？
- 这个问题需要哪些维度（租户/模型版本/地区/实验组）？
- 采样怎么做，才不会把最贵的 tail case 丢掉？

## 一个最小闭环

1. 先选一个用户能感知的指标（例如 `P95 latency`）
2. 让它能拆解成三件事：排队、推理、后处理（或者你自己的链路分解）
3. 每次发布都能对比：**变快 / 变慢**，以及为什么

有了这条证据链，SLO 才会从“写在墙上的口号”变成团队的共同语言。
