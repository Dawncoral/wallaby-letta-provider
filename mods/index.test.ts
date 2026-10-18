import { test } from "node:test";
import assert from "node:assert/strict";
import activate, { buildStaticModels } from "./index.ts";

// Pricing constants must match https://wallabytoken.com/pricing.json
// (verified 2026-10-17: input 2.70 / output 13.50 / cacheHit 0.27 per 1M).
const EXPECTED_COST = { input: 2.7, output: 13.5, cacheRead: 0.27, cacheWrite: 0 };

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
  assert.deepEqual(m.input, ["text"]);
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
  assert.equal(registered.id, "wallaby");
  assert.equal(registered.def.api, "openai-completions");
  assert.equal(registered.def.baseUrl, "https://api.wallabytoken.com/v1");
  assert.equal(registered.def.apiKey, "WALLABY_API_KEY");
  assert.equal(registered.def.authHeader, true);
  assert.equal(registered.def.models.length, 1);
  // 0.1.1 regression guard: NO listModels hook. A mod with listModels becomes
  // "account-scoped" in Letta's local runtime (in-memory catalog per session),
  // and the first message of a fresh session fails with Unknown model until
  // /model is opened once. Static-only catalog resolves from registration.
  assert.equal(registered.def.listModels, undefined);
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

test("static catalog resolves without any connection or refresh", () => {
  // The turn path must find kimi-k3 from the registered catalog alone —
  // no listModels call, no credential, fresh in-memory runtime (0.1.1).
  const models = buildStaticModels();
  assert.equal(models[0].id, "kimi-k3");
  assert.equal(models[0].name, "Kimi K3 (Wallaby)");
});
