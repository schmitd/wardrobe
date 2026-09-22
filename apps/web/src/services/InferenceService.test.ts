import { afterEach, expect, test } from "bun:test";
import { resolve } from "node:path";
import { Effect, Layer, Result } from "effect";
import { GeminiError, GeminiService } from "./GeminiService";
import { buildResponseRequest, InferenceError, InferenceLayer, InferenceService, inferenceUsage } from "./InferenceService";
import { embedImage } from "../server/inference/shared";

const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});
const google = Layer.succeed(GeminiService, {
  generateContent: () => Effect.die("Google generation must not be called"),
  embedContent: () => Effect.die("Unexpected embedding"),
  batchEmbedContents: () => Effect.die("Unexpected batch embedding"),
});
const live = InferenceLayer.pipe(Layer.provide(google));
const generate = () => Effect.runPromise(InferenceService.pipe(Effect.flatMap(s => s.generateContent("Reply briefly")), Effect.provide(live)));

test("Luna boundary accepts a completed response and rejects malformed, incomplete and refused successes", async () => {
  process.env.OPENAI_API_KEY = "local-test-only";
  const fixtures: unknown[] = [
    { status: "completed", output: [{ content: [{ type: "output_text", text: "hello" }] }] },
    null,
    { status: "completed", output: "bad" },
    { status: "incomplete", output: [{ content: [{ type: "output_text", text: "partial" }] }] },
    { status: "completed", output: [{ content: [{ type: "refusal", refusal: "private" }] }] },
    { status: "completed", output: [] },
  ];
  globalThis.fetch = (async () => Response.json(fixtures.shift())) as unknown as typeof fetch;
  expect((await generate()).response.text()).toBe("hello");
  for (let i = 0; i < 5; i++) await expect(generate()).rejects.toBeInstanceOf(InferenceError);
});

test("HTTP errors retain retry classification without exposing the provider body", async () => {
  process.env.OPENAI_API_KEY = "local-test-only";
  for (const [status, retryable] of [[401, false], [429, true], [503, true]] as const) {
    globalThis.fetch = (async () => new Response("secret provider detail", { status })) as unknown as typeof fetch;
    const result = await Effect.runPromise(InferenceService.pipe(Effect.flatMap(s => s.generateContent("test")), Effect.provide(live), Effect.result));
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.retryable).toBe(retryable);
      expect(result.failure.message).not.toContain("secret");
    }
  }
});

test("direct image and text embeddings still reach Google unchanged, without an OpenAI key", async () => {
  delete process.env.OPENAI_API_KEY;
  let seen: unknown;
  const vectors = Array.from({ length: 768 }, (_, i) => i / 768);
  const layer = InferenceLayer.pipe(Layer.provide(Layer.succeed(GeminiService, {
    generateContent: () => Effect.die("No caption generation"),
    embedContent: input => { seen = input; return Effect.succeed({ embedding: { values: vectors } }); },
    batchEmbedContents: () => Effect.succeed({ embeddings: [{ values: vectors }] }),
  })));
  globalThis.fetch = (() => { throw new Error("OpenAI must not be called"); }) as unknown as typeof fetch;
  expect(await Effect.runPromise(embedImage("original-image-bytes", "image/jpeg", "shirt").pipe(Effect.provide(layer)))).toEqual(vectors);
  expect(seen).toEqual([{ text: "shirt" }, { inlineData: { data: "original-image-bytes", mimeType: "image/jpeg" } }]);
  await Effect.runPromise(InferenceService.pipe(Effect.flatMap(s => s.embedContent("search text")), Effect.provide(layer)));
  expect(seen).toBe("search text");
});

test("cache writes are opt-in at stable boundaries and are billed instead of ordinary input", () => {
  const ordinary = buildResponseRequest("one-off");
  expect(ordinary.prompt_cache_options.mode).toBe("explicit");
  expect(JSON.stringify(ordinary)).not.toContain("prompt_cache_breakpoint");
  const reuse = buildResponseRequest({ contents: [{ role: "user", parts: [{ text: "stable", cache: "reuse" }, { text: "variable" }] }] });
  expect(reuse.input[0].content[0]).toHaveProperty("prompt_cache_breakpoint");
  expect(reuse.input[0].content[1]).not.toHaveProperty("prompt_cache_breakpoint");
  expect(inferenceUsage({ input_tokens: 3000, output_tokens: 100, input_tokens_details: { cached_tokens: 1000, cache_write_tokens: 1000 } }).estimatedCostUsd).toBeCloseTo(.000285, 9);
});

test("Google embedding transport errors keep their existing retry behavior", async () => {
  const layer = InferenceLayer.pipe(Layer.provide(Layer.succeed(GeminiService, {
    generateContent: () => Effect.die("No Google generation"),
    embedContent: () => Effect.fail(new GeminiError(new TypeError("fetch failed"))),
    batchEmbedContents: () => Effect.die("Unexpected batch"),
  })));
  const result = await Effect.runPromise(InferenceService.pipe(Effect.flatMap(s => s.embedContent("text")), Effect.provide(layer), Effect.result));
  expect(Result.isFailure(result) && result.failure.retryable).toBe(true);
});

test("provider deadlines are retryable while caller cancellation is not", () => {
  expect(new InferenceError(new DOMException("Provider deadline", "TimeoutError")).retryable).toBe(true);
  expect(new InferenceError(new DOMException("Caller cancelled", "AbortError")).retryable).toBe(false);
});

test("audio remains in memory and uses the transcription endpoint", async () => {
  process.env.OPENAI_API_KEY = "local-test-only";
  let called = false;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    called = true;
    expect(String(url)).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = init?.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-mini-transcribe");
    expect(await (form.get("file") as Blob).text()).toBe("test audio");
    return Response.json({ text: "Museum on Friday." });
  }) as unknown as typeof fetch;
  const text = await Effect.runPromise(InferenceService.pipe(Effect.flatMap(s => s.transcribe({ data: Buffer.from("test audio").toString("base64"), mimeType: "audio/wav" })), Effect.provide(live)));
  expect(called).toBe(true);
  expect(text).toBe("Museum on Friday.");
});

test("Effect interruption aborts a real HTTP request", async () => {
  // UI tests install Happy DOM globally. Isolate native fetch/AbortSignal so this
  // checks real transport cancellation rather than a synthetic DOM implementation.
  const code = `
    import { Effect, Layer, Result } from "effect";
    import { GeminiService } from ${JSON.stringify(resolve(import.meta.dir, "GeminiService.ts"))};
    import { InferenceLayer, InferenceService } from ${JSON.stringify(resolve(import.meta.dir, "InferenceService.ts"))};
    const server = Bun.serve({ port: 0, fetch: () => new Promise(() => {}) });
    const nativeFetch = globalThis.fetch;
    let aborted = false;
    let settled;
    const transportSettled = new Promise(resolve => { settled = resolve; });
    globalThis.fetch = async (_url, init) => {
      try { return await nativeFetch(server.url, init); }
      catch (error) { aborted = init.signal.aborted; throw error; }
      finally { settled(); }
    };
    const layer = InferenceLayer.pipe(Layer.provide(Layer.succeed(GeminiService, {})));
    try {
      await Effect.runPromise(InferenceService.pipe(
        Effect.flatMap(s => s.generateContent("test")), Effect.provide(layer),
        Effect.timeout("100 millis"), Effect.result
      ));
      await Promise.race([transportSettled, new Promise((_, reject) => setTimeout(() => reject(new Error("Transport did not settle")), 1000))]);
      if (!aborted) throw new Error("Native request was not aborted");
      const timeout = AbortSignal.timeout.bind(AbortSignal);
      AbortSignal.timeout = () => timeout(20);
      const deadline = await Effect.runPromise(InferenceService.pipe(
        Effect.flatMap(s => s.generateContent("deadline")), Effect.provide(layer),
        Effect.timeout("1 second"), Effect.result
      ));
      if (!Result.isFailure(deadline) || !deadline.failure.retryable) throw new Error("Native provider timeout was not retryable");
    } finally { server.stop(true); }
  `;
  const process = Bun.spawn(["bun", "--eval", code], { env: { ...Bun.env, OPENAI_API_KEY: "local-test-only" }, stdout: "pipe", stderr: "pipe" });
  const [status, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()]);
  expect(stderr).toBe("");
  expect(status).toBe(0);
});
