import { expect, test } from "bun:test";
import { Effect, Result } from "effect";
import { InferenceError, InferenceLive, InferenceService } from "../../services/InferenceService";
import { parseJson, withRetries } from "./shared";

test("model response schemas reject malformed provider success payloads", async () => {
  const invalid = await Effect.runPromise(parseJson('{"category":"Shirt","description":"cotton","style_tags":42}', "analyzeImageFull").pipe(Effect.result));
  expect(Result.isFailure(invalid)).toBe(true);
  const valid = await Effect.runPromise(parseJson('{"category":"Shirt","description":"cotton","style_tags":["relaxed"]}', "analyzeImageFull"));
  expect(valid.style_tags).toEqual(["relaxed"]);
});

test("nontransient provider failures are not retried", async () => {
  let calls = 0;
  await Effect.runPromise(Effect.suspend(() => { calls++; return Effect.fail(new InferenceError(Object.assign(new Error("denied"), { status: 403 }))); }).pipe(withRetries, Effect.result));
  expect(calls).toBe(1);
});

test("interrupting Luna actually aborts its HTTP fetch", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalGoogleKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "local-test-only";
  process.env.OPENAI_API_KEY = "local-test-only";
  let aborted = false;
  globalThis.fetch = ((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  })) as typeof fetch;
  try {
    await Effect.runPromise(InferenceService.pipe(Effect.flatMap(service => service.generateContent("test")), Effect.provide(InferenceLive), Effect.timeout("20 millis"), Effect.result));
    expect(aborted).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalGoogleKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalGoogleKey;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }
});
