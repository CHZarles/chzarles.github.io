---
title: vLLM Serving 的关键点：吞吐不是白来的
date: 2026-02-01
categories: [ai-infra]
tags: [vllm, serving, gpu]
nodes: [ai-infra/vllm, ai-infra/serving]
excerpt: "prefill/decode 分阶段、KV cache 的命中、batching 策略，决定了你能不能把 GPU 吃满。"
---

## 三个变量

1. **Batching**：吞吐上去，tail latency 也会变
2. **KV Cache**：命中率决定成本
3. **调度**：请求怎么排队，才不会让某类请求饿死

## 实验建议

把实验参数写进 note 和指标里，别靠记忆。

> “可复现”也是一种审美。
