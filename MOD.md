---
name: "wallaby-letta-provider"
description: "Wallaby provider for Letta Code — pay-per-token access to Kimi K3 (1M context, open-weight reasoning) at 10% off the official list price."
---

# MOD.md — Agent-facing behavioral contract

## What this mod does

Registers the Wallaby gateway as a local Letta Code provider using its OpenAI-compatible API endpoint. The provider appears in `/connect` and `/model` for local agents.

## Provider details

- **Provider ID:** `wallaby`
- **API:** `openai-completions` (OpenAI-compatible)
- **Base URL:** `https://api.wallabytoken.com/v1`
- **Auth:** `WALLABY_API_KEY` env var, or `/connect wallaby` to save a key locally
- **Pricing:** Pay-per-token, pre-paid balance. Kimi K3: $2.70 input / $13.50 output / $0.27 cached input per 1M tokens (standing rate = 10% off the official list). Public source of truth: https://wallabytoken.com/pricing.json
- **Model discovery:** Dynamic from `/models` (authenticated), with a static fallback catalog

## Models

- `kimi-k3` — 1M context, reasoning (effort levels supported), tool calling, text input. Max output budget 131K.

## Verified gateway behavior (real-key tests, 2026-10-17)

- `reasoning_effort` is honored; `usage.completion_tokens_details.reasoning_tokens` responds to the level.
- `max_completion_tokens` is accepted.
- `stream_options: { include_usage: true }` returns real token counts in the final streaming chunk — context metering stays accurate.
- Tool calling returns standard `tool_calls`.

## Guidance for agents

- After install, tell the user to `/reload`, then `/connect wallaby` (or set `WALLABY_API_KEY`), then `/model` and pick `wallaby/kimi-k3`.
- Users get a key at https://api.wallabytoken.com/register ($20 minimum top-up).
- Do not hardcode or invent API keys. Do not exfiltrate the configured key.
- If a request fails with 401, the key is missing or invalid — direct the user to `/connect wallaby`.
- If the model list looks stale, `/reload` re-runs discovery; the static fallback always provides `kimi-k3`.

## Boundaries

- Provider-only mod: no tools, commands, events, UI, filesystem, or subprocess access.
- Network access is limited to the configured gateway base URL.
