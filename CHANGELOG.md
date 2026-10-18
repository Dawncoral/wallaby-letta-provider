# CHANGELOG

格式：正序 append-only、客观、不记人名（L1 代码版本管理纪律）。

## 0.1.0 — 2026-10-17

- 首个版本：Wallaby provider mod（Letta Code），注册 `wallaby` provider（openai-completions，`https://api.wallabytoken.com/v1`，`WALLABY_API_KEY`）。
- 静态目录 kimi-k3（1M ctx / 131K max output / $2.70·$13.50·$0.27 per 1M，对齐 pricing.json 2026-10-09 版）；`/models` 认证动态发现 + 静态兜底。
- compat 按真 key 实测设定（2026-10-17）：reasoning_effort ✅ / max_completion_tokens ✅ / stream include_usage ✅ / tool calling ✅；store·developer role·strict 关闭。
- 测试：node:test 五项（目录元数据 / compat / 注册行为 / 无能力降级 / 无 key 兜底）。

## 0.1.1 — 2026-10-19

- 修 fresh-session 首发消息报 `Unknown model "wallaby/kimi-k3"`（站长真机实拍擒获）：根因=listModels 动态发现钩子使 provider 在 Letta 本地运行时被判为 account-scoped，其模型目录为每会话内存态，新会话首发 turn 时目录未填充；摘掉 listModels 改纯静态目录（网关现仅 kimi-k3，动态发现无增量价值），注册即解析。测试第五项改为「无 listModels 钩子」回归断言。
