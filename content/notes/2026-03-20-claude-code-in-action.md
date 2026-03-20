---
title: Claude Code In Action
date: 2026-03-20
categories:
  - vibe-coding
cover: /uploads/20260320-screenshot-2026-03-20-111351-823-2f6a8c.png
---

## How LLM execute tools

![](/uploads/20260320-screenshot-2026-03-20-111351-823-2f6a8c.png)


## Tools with Claude Code 

> Claude Code comes with a comprehensive set of built-in tools that handle common development tasks like reading files, writing code, running commands, and managing directories. But what makes Claude Code truly powerful is how intelligently it combines these tools to tackle complex, multi-step problems.

### 通过 mcp 让claude感知到新工具

... todo ....

### Idea of customize with workflow

claude code可以接入github mcp接口， 可以利用github pull request 的机制让claude code在运行时感知上下文。之后每个请求都以pull request的形式发起，LLM会根据任务需求，结合约束审核PR。

  - Anthropic GitHub Actions 文档: https://code.claude.com/docs/en/github-actions
    (https://code.claude.com/docs/en/github-actions)
