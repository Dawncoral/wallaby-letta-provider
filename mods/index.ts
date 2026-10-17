// Wallaby provider mod for Letta Code
//
// Registers the Wallaby gateway (https://api.wallabytoken.com/v1) as a local
// provider using its OpenAI-compatible API endpoint. Pay-per-token,
// pre-paid balance, Kimi K3 at 10% off the official list price.
//
// Auth: WALLABY_API_KEY env var, or /connect wallaby to save a key locally.
// Models: discovered live from /models (authenticated), with a static
// fallback catalog.
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

type WallabyModelEntry = {
  id: string;
  object?: string;
};

/** Static fallback catalog when /models cannot be reached. */
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

/**
 * Fetch the live model list from the gateway (requires auth).
 * Falls back to undefined on any error so the caller can use the static
 * catalog. Only kimi-k3 entries are surfaced; the gateway's slash-namespaced
 * alias (moonshotai/kimi-k3) is dropped because Letta model ids must not
 * contain "/".
 */
async function fetchModels(
  baseUrl: string,
  apiKey?: string,
): Promise<WallabyModelEntry[] | undefined> {
  if (!apiKey) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    if (!data || !Array.isArray(data.data)) return undefined;
    return data.data.filter(
      (m: unknown): m is WallabyModelEntry =>
        !!m &&
        typeof m === "object" &&
        typeof (m as WallabyModelEntry).id === "string",
    );
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
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
    async listModels(connection: {
      id: string;
      providerName: string;
      baseUrl?: string;
      apiKey?: string;
      headers?: Record<string, string>;
    }) {
      const base = connection.baseUrl?.replace(/\/$/, "") || DEFAULT_BASE_URL;
      const live = await fetchModels(base, connection.apiKey);
      if (!live) return staticModels;
      const usable = live.filter((m) => !m.id.includes("/"));
      if (usable.length === 0) return staticModels;
      return usable.map((m) => ({
        id: m.id,
        name: m.id === "kimi-k3" ? "Kimi K3 (Wallaby)" : m.id,
        reasoning: true,
        input: ["text"] as ("text" | "image")[],
        cost: { ...PRICING },
        contextWindow: CONTEXT_WINDOW,
        maxTokens: MAX_OUTPUT_TOKENS,
        compat: WALLABY_COMPAT,
      }));
    },
    connect: {
      fields: [{ key: "apiKey", label: "Wallaby API Key", secret: true }],
    },
  });
}
