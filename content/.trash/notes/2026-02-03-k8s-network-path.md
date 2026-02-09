---
title: K8s 网络路径：一次请求到底走了几层？
date: 2026-02-03
categories: [ai-infra, systems]
tags: [k8s, networking, latency]
nodes: [ai-infra/k8s, ai-infra/linux-net]
excerpt: "当你发现 p99 抖动，不要先怀疑模型：先把网络路径画出来。"
---

## 结论先行

你以为是：Client → Pod  
实际上可能是：Client → LB → NodePort → kube-proxy → CNI → Pod → Sidecar → App

每一层都可能带来：

- 抖动（queue / conntrack / CPU 抢占）
- 放大（重试风暴）
- 不可见（没有指标/链路）

## 我的做法

先做一张“路径图”，再决定要观测什么。  
路径一旦画出来，你就知道 **tracing 应该在哪些边界点打证据**。

