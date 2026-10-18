// Wallaby provider mod for Letta Code
//
// Registers the Wallaby gateway (https://api.wallabytoken.com/v1) as a local
// provider using its OpenAI-compatible API endpoint. Pay-per-token,
// pre-paid balance, Kimi K3 at 10% off the official list price.
//
// Auth: WALLABY_API_KEY env var, or /connect wallaby to save a key locally.
// Models: static catalog only (0.1.1). v0.1.0's live /models discovery hook
// made the provider "account-scoped" in Letta's local runtime, whose catalog
// is in-memory per session — the first message of a fresh session then failed
// with `Unknown model "wallaby/kimi-k3"` until /model was opened once. The
// gateway serves only kimi-k3 today, so dynamic discovery added nothing;
// removing listModels makes the catalog available from registration time.
//
// Compat notes (all verified against the live gateway with a real key,
// 2026-10-17):
// - reasoning_effort IS supported (none/low/medium/high; reasoning_tokens
//   in usage respond to the level).
// - max_completion_tokens IS supported.
// - stream_options: { include_usage: true } IS supported — the final
//   streaming chunk carries real token counts, so Letta's context meter
//   stays accurate for Kimi's tokenizer (char/4 would underestimate).
// - store, developer role, strict mode are NOT documented by the gateway
//   and are disabled to avoid 400s from unknown parameters.

const DEFAULT_BASE_URL = "https://api.wallabytoken.com/v1";
const API_KEY_ENV = "WALLABY_API_KEY";

// Per-1M-token USD prices, kept in sync with the public source of truth:
// https://wallabytoken.com/pricing.json
const PRICING = {
  input: 2.7,
  output: 13.5,
  cacheRead: 0.27,
  cacheWrite: 0,
};

const CONTEXT_WINDOW = 1_000_000;
// Kimi K3 output cap is 131K; a budget far below the 1M context window
// leaves the prompt side plenty of room (mirrors the umans lesson: never
// size maxTokens anywhere near the context window).
const MAX_OUTPUT_TOKENS = 131_072;

const WALLABY_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: true,
  maxTokensField: "max_completion_tokens" as const,
  supportsStrictMode: false,
  supportsUsageInStreaming: true,
};

/** Static catalog (the gateway currently serves kimi-k3 only). */
export function buildStaticModels() {
  return [
    {
      id: "kimi-k3",
      name: "Kimi K3 (Wallaby)",
      reasoning: true,
      input: ["text"] as ("text" | "image")[],
      cost: { ...PRICING },
      contextWindow: CONTEXT_WINDOW,
      maxTokens: MAX_OUTPUT_TOKENS,
      compat: WALLABY_COMPAT,
    },
  ];
}

export default function activate(letta: any) {
  if (!letta.capabilities.providers) {
    letta.diagnostics?.report?.({
      severity: "warning",
      message:
        "wallaby provider mod requires providers capability, but this host does not expose it.",
    });
    return;
  }

  const staticModels = buildStaticModels();

  return letta.providers.register("wallaby", {
    name: "Wallaby",
    description: "Connect a Wallaby API key (Kimi K3, pay-per-token)",
    api: "openai-completions",
    baseUrl: DEFAULT_BASE_URL,
    apiKey: API_KEY_ENV,
    authHeader: true,
    models: staticModels,
    connect: {
      fields: [{ key: "apiKey", label: "Wallaby API Key", secret: true }],
    },
  });
}
