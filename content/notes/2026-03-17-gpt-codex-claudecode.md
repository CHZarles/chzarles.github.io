---
title: 移花接木:将Gpt-codex模型接入ClaudeCode
date: 2026-03-17
categories:
  - vibe-coding
tags:
  - claude code
updated: 2026-03-18
---

灵感来源：https://linux.do/t/topic/1664093

## step 1 : download CLIProxyAPI
> https://help.router-for.me/cn/introduction/quick-start.html
```
curl -fsSL https://raw.githubusercontent.com/brokechubb/cliproxyapi-installer/refs/heads/master/cliproxyapi-installer | bash
```



## step 2 : config 

enter /home/charles/cliproxyapi and modify config.yaml

```
# .... add configuration ...
# ref https://help.router-for.me/cn/configuration/provider/codex-compatibility.html
codex-api-key:
  - api-key: "sk-54xxxxxxxxa7d34832"
    base-url: "https://xxxxx.cn" # 使用第三方 Codex API 中转服务端点
    models:
      - name: "gpt-5.4"
        alias: "codex-opus"
      - name: "gpt-5.3-codex"
        alias: "codex-sonnet"
      - name: "gpt-5.1-codex-mini"
        alias: "codex-haiku"
```

modify /home/charles/.claude/settings.json

```
/home/charles/.claude/settings.json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-xxxxx",
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "codex-haiku",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "codex-opus",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "codex-sonnet",
    "ANTHROPIC_MODEL": "codex-opus",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "includeCoAuthoredBy": false,
  "model": "haiku",
  "enabledPlugins": {
    "pyright-lsp@claude-plugins-official": true
  }
}
```
## step 3 : test
start server and test
```
charles@DESKTOP-L39GC67:~/tmp$ curl http://127.0.0.1:8317/v1/messages \
    -H 'content-type: application/json' \
    -H 'anthropic-version: 2023-06-01' \
    -H 'authorization: Bearer sk-fsKDbgaCxT22gOhw3mUilK2pdcLX0SQYxEeRmzP9iwrxd' \
    --data '{"model":"codex-sonnet","max_tokens":32,"messages":[{"role":"user","content":"reply with ok"}]}'

{"id":"resp_0e479d5a9cfa85980169b968c5f90c8192bc2efa10dd0a7792","type":"message","role":"assistant","model":"gpt-5.3-codex","content":[{"type":"text","text":"ok"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":20,"output_tokens":5}}charles@DESKTOP-L39GC67:~/tmp$

```
