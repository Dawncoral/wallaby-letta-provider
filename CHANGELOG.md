# CHANGELOG

格式：正序 append-only、客观、不记人名（L1 代码版本管理纪律）。

## 0.1.0 — 2026-10-17

- 首个版本：Wallaby provider mod（Letta Code），注册 `wallaby` provider（openai-completions，`https://api.wallabytoken.com/v1`，`WALLABY_API_KEY`）。
- 静态目录 kimi-k3（1M ctx / 131K max output / $2.70·$13.50·$0.27 per 1M，对齐 pricing.json 2026-10-09 版）；`/models` 认证动态发现 + 静态兜底。
- compat 按真 key 实测设定（2026-10-17）：reasoning_effort ✅ / max_completion_tokens ✅ / stream include_usage ✅ / tool calling ✅；store·developer role·strict 关闭。
- 测试：node:test 五项（目录元数据 / compat / 注册行为 / 无能力降级 / 无 key 兜底）。
