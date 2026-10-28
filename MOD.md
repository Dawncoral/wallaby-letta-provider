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
- **Model discovery:** static `kimi-k3` is registered first (so a fresh session resolves immediately), and `listModels` merges the gateway's `/models` endpoint when a key is available (0.1.2). Ids containing `/` are dropped; ids without an entry in the public `pricing.json` are skipped rather than shown at $0.
- **Key validation:** when the model list is refreshed (for example in `/model` after `/connect`), a `/models` call that returns 401/403 raises a clear "API key rejected" error. Headless runs that never refresh the list may fall back to the hosted default instead of surfacing it.

## Models

- `kimi-k3` — 1M context, reasoning with `off`/`minimal`/`low`/`medium`/`high`/`max` effort levels, tool calling, text and image input. Max output budget 131K.
- Any additional id the gateway serves and `pricing.json` prices appears automatically (for example a future K3.1 Pro).

## Verified gateway behavior (real-key tests, 2026-10-17 / 2026-10-28)

- `reasoning_effort` is honored for `none`, `minimal`, `low`, `medium`, `high`, and `max`; `usage.completion_tokens_details.reasoning_tokens` responds to the level (2026-10-28).
- `image_url` data URLs are accepted, so image input is declared (2026-10-28).
- `max_completion_tokens` is accepted.
- `stream_options: { include_usage: true }` returns real token counts in the final streaming chunk — context metering stays accurate.
- Tool calling returns standard `tool_calls`.

## Guidance for agents

- After install, tell the user to `/reload`, then `/connect wallaby` (or set `WALLABY_API_KEY`), then `/model` and pick `wallaby/kimi-k3`.
- Users get a key at https://api.wallabytoken.com/register ($20 minimum top-up).
- Do not hardcode or invent API keys. Do not exfiltrate the configured key.
- If the model list or a request fails with 401, the key is missing or invalid — direct the user to `/connect wallaby`.
- If `/model` shows no Wallaby entry, run `/reload` to re-register mods; the static catalog always provides `kimi-k3`. (Fixed in 0.1.1: fresh sessions no longer need a `/model` re-select before the first message.)

## Boundaries

- Provider-only mod: no tools, commands, events, UI, filesystem, or subprocess access.
- Network access is limited to the configured gateway base URL.
