# wallaby-letta-provider

[![npm version](https://img.shields.io/npm/v/wallaby-letta-provider)](https://www.npmjs.com/package/wallaby-letta-provider)
[![License](https://img.shields.io/npm/l/wallaby-letta-provider)](https://github.com/Dawncoral/wallaby-letta-provider/blob/main/LICENSE)

[Wallaby](https://wallabytoken.com) provider for [Letta Code](https://docs.letta.com/letta-code). Adds pay-per-token access to **Kimi K3** — 1M context, open-weight reasoning — at a standing 10% off the official list price.

## Install

Ask your Letta Code agent to install this mod:

> Install the Wallaby provider mod from `npm:wallaby-letta-provider`

Or install manually:

```bash
letta install npm:wallaby-letta-provider
```

Then reload:

```
/reload
```

## Connect

Get an API key at [api.wallabytoken.com/register](https://api.wallabytoken.com/register) ($20 minimum top-up), then either:

```
/connect wallaby
```

Or set an environment variable:

```bash
export WALLABY_API_KEY="sk-your-key-here"
```

Then `/model` and pick `wallaby/kimi-k3`.

## Models

Discovered live from the gateway after connect; the static catalog always provides Kimi K3.

| Model | Context | Reasoning | Tool calling | Price (per 1M tokens) |
|---|---|---|---|---|
| `kimi-k3` | 1M | effort levels supported | yes | $2.70 in / $13.50 out / $0.27 cached |

Prices track the public source of truth: [wallabytoken.com/pricing.json](https://wallabytoken.com/pricing.json) (standing rate, not a promo window — 10% off the official list).

## Why Kimi K3 for Letta agents

Letta agents replay their memory blocks on every turn, so stateful workloads are input-token heavy. Kimi K3's cached-input rate ($0.27/1M) is where that repetition gets cheap, and the 1M context window leaves room for long-running agents before compaction.

## What the mod does (and doesn't do)

- Registers a local provider only — no tools, commands, events, UI, filesystem, or subprocess access.
- Network access is limited to the Wallaby gateway endpoint.
- Verified against the live gateway with a real key: `reasoning_effort`, `max_completion_tokens`, streaming usage (`stream_options.include_usage`), and tool calling all behave as declared in `mods/index.ts`.

## Development

```bash
npm test   # node --experimental-strip-types --test mods/index.test.ts
```

## Links

- Gateway & pricing: https://wallabytoken.com
- Letta Code mods: https://github.com/letta-ai/mods
