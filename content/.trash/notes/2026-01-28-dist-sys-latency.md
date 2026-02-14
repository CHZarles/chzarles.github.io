---
title: 延迟这件事：不是平均数，是尾巴
date: 2026-01-28
categories: [systems]
tags: [distributed-systems, latency, slos]
nodes: [ai-infra/dist-sys]
excerpt: "p50 让你自我安慰，p99 才决定用户体验。"
---

## 一个观念

分布式系统里，**尾延迟是系统结构的结果**，不是某一次偶然。

## 复盘模板

- 现象：哪个 SLO 失守？
- 证据：trace / metrics / deploy / config
- 根因：资源、依赖、排队、锁？
- 方案：如何证明“改好了”？
