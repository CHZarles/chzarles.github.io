---
title: GPU 调度里最难的其实是“碎片化”
date: 2026-02-05
categories: [ai-infra]
tags: [gpu, scheduling, kubernetes]
nodes: [ai-infra-complex/gpu-scheduling, ai-infra-complex/kubernetes]
excerpt: "当 GPU 不是一整张卡在用，而是被切成很多片（MIG / 多租户）时，调度问题会从“资源够不够”变成“资源拼不拼得起来”。"
---

如果你把 GPU 调度只理解成“给 Pod 加个 `nvidia.com/gpu: 1`”，那它最多只是 **分配**。

真正把系统拖垮的往往是两件事：

1. **碎片化**：算力被切得很细，但你的请求需要一块“连续”的资源
2. **尾延迟**：看起来平均利用率很高，但 99p 卡在排队/冷启动/抢占

## 一个实用的分层视角

- **资源层**：MIG / vGPU / NVLink 拓扑 / NUMA
- **编排层**：K8s device plugin / priority / preemption / quota
- **服务层**：batching、queue、warm pool、模型路由

## 记录一个经验

先把“资源可见性”做扎实：  
把每次调度决策的 **原因**（为什么分配/为什么排队/为什么失败）写成可检索的事件流。  
否则你会在“看起来都对”的指标里浪费很多天。
