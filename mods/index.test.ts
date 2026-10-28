import { test } from "node:test";
import assert from "node:assert/strict";
import activate, { buildStaticModels } from "./index.ts";

// Pricing constants must match https://wallabytoken.com/pricing.json
// (verified 2026-10-17: input 2.70 / output 13.50 / cacheHit 0.27 per 1M).
const EXPECTED_COST = { input: 2.7, output: 13.5, cacheRead: 0.27, cacheWrite: 0 };

function registerDef() {
  let registered: any = null;
  const letta = {
    capabilities: { providers: true },
    providers: {
      register(id: string, def: any) {
        registered = { id, def };
        return { unregister() {} };
      },
    },
  };
  activate(letta as any);
  return registered;
}

function withFetch(impl: typeof fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

const CONNECTION = {
  id: "wallaby",
  providerName: "Wallaby",
  baseUrl: "https://api.wallabytoken.com/v1",
  apiKey: "sk-test",
};

test("static catalog registers kimi-k3 with sane metadata", () => {
  const models = buildStaticModels();
  assert.equal(models.length, 1);
  const m = models[0];
  assert.equal(m.id, "kimi-k3");
  assert.ok(!m.id.includes("/"), "model id must not contain a slash");
  assert.deepEqual(m.cost, EXPECTED_COST);
  assert.equal(m.contextWindow, 1_000_000);
  assert.ok(m.maxTokens > 0 && m.maxTokens < m.contextWindow);
  assert.equal(m.reasoning, true);
  assert.deepEqual(m.input, ["text", "image"]);
  assert.equal(m.thinkingLevelMap.off, "none");
  assert.equal(m.thinkingLevelMap.max, "max");
  assert.equal(m.thinkingLevelMap.xhigh, "high");
});

test("compat overrides match the verified gateway behavior", () => {
  const [m] = buildStaticModels();
  assert.equal(m.compat.supportsReasoningEffort, true);
  assert.equal(m.compat.maxTokensField, "max_completion_tokens");
  assert.equal(m.compat.supportsUsageInStreaming, true);
  assert.equal(m.compat.supportsStore, false);
  assert.equal(m.compat.supportsDeveloperRole, false);
  assert.equal(m.compat.supportsStrictMode, false);
});

test("activation registers the wallaby provider when capability exists", () => {
  const registered = registerDef();
  assert.equal(registered.id, "wallaby");
  assert.equal(registered.def.api, "openai-completions");
  assert.equal(registered.def.baseUrl, "https://api.wallabytoken.com/v1");
  assert.equal(registered.def.apiKey, "WALLABY_API_KEY");
  assert.equal(registered.def.authHeader, true);
  // Static catalog stays registered so a fresh session resolves kimi-k3 even
  // if the live fetch is slow or unavailable (0.1.1 regression guard).
  assert.equal(registered.def.models.length, 1);
  assert.equal(registered.def.models[0].id, "kimi-k3");
  assert.equal(typeof registered.def.listModels, "function");
  // connect fields: API key only, base URL is fixed at provider level
  assert.deepEqual(registered.def.connect.fields, [
    { key: "apiKey", label: "Wallaby API Key", secret: true },
  ]);
});

test("activation degrades gracefully without providers capability", () => {
  const warnings: any[] = [];
  const letta = {
    capabilities: {},
    diagnostics: { report: (w: any) => warnings.push(w) },
  };
  assert.equal(activate(letta as any), undefined);
  assert.equal(warnings.length, 1);
});

test("listModels merges live ids with pricing and drops slash/unpriced ids", async () => {
  const restore = withFetch((async (url: any) => {
    const u = String(url);
    if (u.endsWith("/models")) {
      return new Response(
        JSON.stringify({
          data: [
            { id: "kimi-k3" },
            { id: "moonshotai/kimi-k3" },
            { id: "kimi-k3.1-pro" },
            { id: "mystery-model" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        models: [
          {
            id: "kimi-k3",
            label: "Kimi K3",
            ours: { input: 2.7, output: 13.5, cacheHitInput: 0.27 },
          },
          {
            id: "kimi-k3.1-pro",
            label: "Kimi K3.1 Pro",
            ours: { input: 4, output: 20, cacheHitInput: 0.4 },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch);
  try {
    const def = registerDef().def;
    const models = await def.listModels(CONNECTION);
    assert.deepEqual(
      models.map((m: any) => m.id),
      ["kimi-k3", "kimi-k3.1-pro"],
    );
    assert.equal(models[1].name, "Kimi K3.1 Pro (Wallaby)");
    assert.equal(models[1].cost.input, 4);
  } finally {
    restore();
  }
});

test("listModels surfaces a rejected key instead of failing later", async () => {
  const restore = withFetch((async () => new Response("{}", { status: 401 })) as typeof fetch);
  try {
    const def = registerDef().def;
    await assert.rejects(() => def.listModels(CONNECTION), /rejected this API key/);
  } finally {
    restore();
  }
});

test("listModels falls back to the static catalog when the network fails", async () => {
  const restore = withFetch((async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch);
  try {
    const def = registerDef().def;
    const models = await def.listModels(CONNECTION);
    assert.deepEqual(
      models.map((m: any) => m.id),
      ["kimi-k3"],
    );
  } finally {
    restore();
  }
});

test("static catalog resolves without any connection or refresh", () => {
  // The turn path must find kimi-k3 from the registered catalog alone.
  const models = buildStaticModels();
  assert.equal(models[0].id, "kimi-k3");
  assert.equal(models[0].name, "Kimi K3 (Wallaby)");
});
