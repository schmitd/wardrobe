import { afterEach, describe, expect, it, mock } from "bun:test";

const callbacks: Array<() => Promise<void>> = [];
const captures: Array<Record<string, unknown>> = [];
const ingested: Array<Record<string, unknown>> = [];
const clerkServer = await import("@clerk/nextjs/server");
const nextServer = await import("next/server");
mock.module("@clerk/nextjs/server", () => ({ ...clerkServer, auth: async () => ({ userId: "user_telemetry_test" }) }));
mock.module("next/server", () => ({ ...nextServer, after: (callback: () => Promise<void>) => callbacks.push(callback) }));
mock.module("posthog-node", () => ({ PostHog: class {
  capture(event: Record<string, unknown>) { captures.push(event); }
  async shutdown() {}
} }));
const { observeMobileRequest } = await import("./mobileTelemetry");
const originalFetch = globalThis.fetch;
const previous = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ["NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "NEXT_PUBLIC_POSTHOG_HOST", "AXIOM_TOKEN", "AXIOM_DATASET"]) {
    if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
  callbacks.length = captures.length = ingested.length = 0;
});

describe("mobile telemetry delivery boundary", () => {
  function setup() {
    Object.assign(process.env, { NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "test", NEXT_PUBLIC_POSTHOG_HOST: "https://example.com", AXIOM_TOKEN: "test", AXIOM_DATASET: "test" });
    globalThis.fetch = (async (_input, init) => {
      ingested.push(...JSON.parse(String(init?.body)));
      return new Response(null, { status: 200 });
    }) as typeof fetch;
  }
  it("links authenticated product and operational events without forwarding content", async () => {
    setup();
    const request = new Request("https://example.com/api/mobile/capture", { method: "POST", headers: {
      "X-POSTHOG-DISTINCT-ID": "user_telemetry_test", "X-POSTHOG-SESSION-ID": "019b9fb2-c5fb-4000-a11b-1832d2e6f127",
      "X-Wardrobe-Trace-ID": "1234567890abcdef1234567890abcdef",
    }, body: JSON.stringify({ operation: "record_fit", password: "private-sentinel", storageId: "private-sentinel" }) });
    const response = await observeMobileRequest(request, "capture", async (forwarded, traceId) => {
      expect(forwarded).toBe(request);
      expect(traceId).toBe("1234567890abcdef1234567890abcdef");
      expect((await forwarded.json()).operation).toBe("record_fit");
      return Response.json({ saved: true });
    });
    expect(response.status).toBe(200);
    expect(captures).toHaveLength(0);
    await callbacks[0]();
    expect(captures).toHaveLength(1);
    expect(ingested).toHaveLength(1);
    expect((captures[0].properties as Record<string, unknown>).trace_id).toBe(response.headers.get("X-Wardrobe-Trace-ID"));
    expect(JSON.stringify([captures, ingested])).not.toContain("private-sentinel");
  });
  it("retains only operational logs when analytics headers are absent", async () => {
    setup();
    await observeMobileRequest(new Request("https://example.com"), "bootstrap", async () => Response.json({ ok: true }));
    await callbacks[0]();
    expect(captures).toHaveLength(0);
    expect(ingested).toHaveLength(1);
  });
  it("preserves framework request identity and passes a normalized trace separately", async () => {
    setup();
    const original = new Request("https://example.com/api/mobile/bootstrap", { headers: { "X-Wardrobe-Trace-ID": "invalid" } });
    const request = new Proxy(original, { get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    } });
    const response = await observeMobileRequest(request, "bootstrap", async (forwarded, traceId) => {
      expect(forwarded).toBe(request);
      expect(forwarded.headers.get("X-Wardrobe-Trace-ID")).toBe("invalid");
      expect(traceId).toMatch(/^[a-f0-9]{32}$/);
      return Response.json({ ok: true });
    });
    expect(response.status).toBe(200);
    await callbacks[0]();
    expect(ingested[0].trace_id).toBe(response.headers.get("X-Wardrobe-Trace-ID"));
  });
  it("sanitizes handler failures and never changes the response for sink failures", async () => {
    setup();
    globalThis.fetch = (async () => { throw new Error("sink unavailable"); }) as unknown as typeof fetch;
    const response = await observeMobileRequest(new Request("https://example.com"), "bootstrap", async () => { throw new Error("private-sentinel"); });
    await callbacks[0]();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private-sentinel");
  });
});
