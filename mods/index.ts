// Wallaby provider mod for Letta Code
//
// Registers the Wallaby gateway (https://api.wallabytoken.com/v1) as a local
// provider using its OpenAI-compatible API endpoint. Pay-per-token,
// pre-paid balance, Kimi K3 at 10% off the official list price.
//
// Auth: WALLABY_API_KEY env var, or /connect wallaby to save a key locally.
//
// Models (0.1.2): the static catalog always carries kimi-k3, and listModels
// merges whatever the gateway's /models endpoint returns. A live catalog is
// what lets a newly launched model (for example a K3.1 Pro id) show up
// without shipping a new npm release. Ids containing "/" are dropped because
// Letta model ids must not contain a slash; ids without a matching entry in
// the public pricing.json are skipped rather than shown with a wrong price.
//
// History: 0.1.0's listModels made the provider "account-scoped" in the
// 0.34.16 local runtime (its catalog is in-memory per session), so a fresh
// session failed with `Unknown model "wallaby/kimi-k3"` until /model was
// opened once. 0.1.1 removed listModels. The static catalog is still
// registered first, so a fresh session keeps working even when the live
// fetch is slow or fails.
//
// Compat notes (all verified against the live gateway with a real key):
// - reasoning_effort IS supported (none/minimal/low/medium/high/max);
//   reasoning_tokens in usage respond to the level (2026-10-17, 2026-10-28).
// - max_completion_tokens IS supported.
// - image_url data URLs ARE accepted (2026-10-28), so the model declares
//   image input.
// - stream_options: { include_usage: true } IS supported — the final
//   streaming chunk carries real token counts, so Letta's context meter
//   stays accurate for Kimi's tokenizer (char/4 would underestimate).
// - store, developer role, strict mode are NOT documented by the gateway
//   and are disabled to avoid 400s from unknown parameters.

const DEFAULT_BASE_URL = "https://api.wallabytoken.com/v1";
const API_KEY_ENV = "WALLABY_API_KEY";
const PRICING_URL = "https://wallabytoken.com/pricing.json";

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

// pi thinking level -> gateway reasoning_effort value. xhigh folds into high
// because the gateway does not advertise a separate xhigh tier.
const THINKING_LEVEL_MAP = {
  off: "none",
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "high",
  max: "max",
} as const;

type Cost = { input: number; output: number; cacheRead: number; cacheWrite: number };

type PricingEntry = { label?: string; cost: Cost };

function buildModel(id: string, name: string, cost: Cost) {
  return {
    id,
    name,
    reasoning: true,
    input: ["text", "image"] as ("text" | "image")[],
    cost: { ...cost },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_OUTPUT_TOKENS,
    thinkingLevelMap: { ...THINKING_LEVEL_MAP },
    compat: WALLABY_COMPAT,
  };
}

/** Static catalog: always registered so a fresh session has a usable model. */
export function buildStaticModels() {
  return [buildModel("kimi-k3", "Kimi K3 (Wallaby)", PRICING)];
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Live model ids from the gateway. Throws on 401/403 so /connect and the
 * model picker surface a bad key immediately instead of failing on the first
 * message. Any other failure returns undefined and the static catalog is used.
 */
async function fetchLiveIds(
  baseUrl: string,
  apiKey?: string,
): Promise<string[] | undefined> {
  if (!apiKey) return undefined;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl}/models`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
      5000,
    );
  } catch {
    // Timeout or transport error: the static catalog is enough to keep the
    // session usable, so this is not fatal.
    return undefined;
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Wallaby rejected this API key (HTTP ${res.status}). Check the key at wallabytoken.com, then run /connect wallaby again.`,
    );
  }
  if (!res.ok) return undefined;
  let data: any;
  try {
    data = await res.json();
  } catch {
    return undefined;
  }
  if (!data || !Array.isArray(data.data)) return undefined;
  return data.data
    .map((m: any) => m?.id)
    .filter((id: unknown): id is string => typeof id === "string");
}

/** Public price list, used to describe models we did not ship statically. */
async function fetchPricing(): Promise<Record<string, PricingEntry> | undefined> {
  try {
    const res = await fetchWithTimeout(
      PRICING_URL,
      { headers: { Accept: "application/json" } },
      3000,
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const out: Record<string, PricingEntry> = {};
    for (const m of data?.models ?? []) {
      if (!m || typeof m.id !== "string" || !m.ours) continue;
      out[m.id] = {
        label: typeof m.label === "string" ? m.label : undefined,
        cost: {
          input: Number(m.ours.input) || 0,
          output: Number(m.ours.output) || 0,
          cacheRead: Number(m.ours.cacheHitInput) || 0,
          cacheWrite: 0,
        },
      };
    }
    return out;
  } catch {
    return undefined;
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
    async listModels(connection: any) {
      const base = connection.baseUrl?.replace(/\/$/, "") || DEFAULT_BASE_URL;
      const live = await fetchLiveIds(base, connection.apiKey);
      if (!live) return staticModels;

      const ids = live.filter((id) => !id.includes("/"));
      if (ids.length === 0) return staticModels;

      const pricing = await fetchPricing();
      const models: ReturnType<typeof buildModel>[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        if (id === "kimi-k3") {
          models.push(buildModel(id, "Kimi K3 (Wallaby)", PRICING));
          continue;
        }
        const entry = pricing?.[id];
        // No price source means no honest cost to display; skip it instead of
        // showing a model at $0.
        if (!entry) continue;
        models.push(buildModel(id, `${entry.label ?? id} (Wallaby)`, entry.cost));
      }
      return models.length ? models : staticModels;
    },
    connect: {
      fields: [{ key: "apiKey", label: "Wallaby API Key", secret: true }],
    },
  });
}
