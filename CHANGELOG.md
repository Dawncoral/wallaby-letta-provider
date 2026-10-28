# CHANGELOG

格式：正序 append-only、客观、不记人名（L1 代码版本管理纪律）。

## 0.1.0 — 2026-10-17

- 首个版本：Wallaby provider mod（Letta Code），注册 `wallaby` provider（openai-completions，`https://api.wallabytoken.com/v1`，`WALLABY_API_KEY`）。
- 静态目录 kimi-k3（1M ctx / 131K max output / $2.70·$13.50·$0.27 per 1M，对齐 pricing.json 2026-10-09 版）；`/models` 认证动态发现 + 静态兜底。
- compat 按真 key 实测设定（2026-10-17）：reasoning_effort ✅ / max_completion_tokens ✅ / stream include_usage ✅ / tool calling ✅；store·developer role·strict 关闭。
- 测试：node:test 五项（目录元数据 / compat / 注册行为 / 无能力降级 / 无 key 兜底）。

## 0.1.1 — 2026-10-19

- 修 fresh-session 首发消息报 `Unknown model "wallaby/kimi-k3"`（站长真机实拍擒获）：根因=listModels 动态发现钩子使 provider 在 Letta 本地运行时被判为 account-scoped，其模型目录为每会话内存态，新会话首发 turn 时目录未填充；摘掉 listModels 改纯静态目录（网关现仅 kimi-k3，动态发现无增量价值），注册即解析。测试第五项改为「无 listModels 钩子」回归断言。

## 0.1.2 — 2026-10-28

- 模型目录：静态 `kimi-k3` 保底 + `listModels` 合并网关 `/v1/models`。静态目录仍先注册，fresh session 不依赖动态拉取；ID 含 `/` 丢弃，未在 pricing.json 定价的模型跳过（不显示 $0 假价）。
- 图片输入：模型声明 `input: ["text","image"]`（真实 key 实测 image_url data URL 返回 200，2026-10-28）。
- 思考档位：`thinkingLevelMap` 把 off/minimal/low/medium/high/xhigh/max 映射到 `reasoning_effort`（xhigh→high 折叠；none/minimal 实测 200）。
- 连接校验：模型列表刷新（如 `/connect` 后 `/model`）时，`/v1/models` 返回 401/403 抛出明确错误（key 无效）；headless 不刷新列表的路径可能回落托管默认模型，文档已按实测边界写明。
- 测试：node:test 八项（静态目录 / compat / 注册 / 无能力降级 / 目录合并 / 坏 key / 网络回退 / 静态解析）。
