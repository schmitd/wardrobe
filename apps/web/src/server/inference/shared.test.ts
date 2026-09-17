import { expect, test } from "bun:test";
import { Effect, Result } from "effect";
import { GeminiError, GeminiLive, GeminiService } from "../../services/GeminiService";
import { parseJson, withRetries } from "./shared";

test("model response schemas reject malformed provider success payloads", async () => {
  const invalid = await Effect.runPromise(parseJson('{"category":"Shirt","description":"cotton","style_tags":42}', "analyzeImageFull").pipe(Effect.result));
  expect(Result.isFailure(invalid)).toBe(true);
  const valid = await Effect.runPromise(parseJson('{"category":"Shirt","description":"cotton","style_tags":["relaxed"]}', "analyzeImageFull"));
  expect(valid.style_tags).toEqual(["relaxed"]);
});

test("nontransient provider failures are not retried", async () => {
  let calls = 0;
  await Effect.runPromise(Effect.suspend(() => { calls++; return Effect.fail(new GeminiError(Object.assign(new Error("denied"), { status: 403 }))); }).pipe(withRetries, Effect.result));
  expect(calls).toBe(1);
});

test("interrupting Gemini actually aborts the SDK fetch", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "local-test-only";
  let aborted = false;
  globalThis.fetch = ((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  })) as typeof fetch;
  try {
    await Effect.runPromise(GeminiService.pipe(Effect.flatMap(service => service.generateContent("gemini-2.5-flash", "test")), Effect.provide(GeminiLive), Effect.timeout("20 millis"), Effect.result));
    expect(aborted).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  }
});
