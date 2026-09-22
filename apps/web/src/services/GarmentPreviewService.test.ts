import { afterEach, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import sharp from "sharp";
import { GarmentPreviewLive, GarmentPreviewService } from "./GarmentPreviewService";

const previousKey = process.env.OPENAI_API_KEY;
afterEach(() => { if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; });
const generate = (input: Blob) => GarmentPreviewService.pipe(Effect.flatMap(service => service.generate(input)), Effect.provide(GarmentPreviewLive));
async function input(width = 200) { return new Blob([new Uint8Array(await sharp({ create: { width, height: width, channels: 3, background: "white" } }).png().toBuffer())], { type: "image/png" }); }

test("small crops are rejected before contacting the paid provider", async () => {
  process.env.OPENAI_API_KEY = "test";
  const originalFetch = globalThis.fetch;
  const fetchSpy = mock(originalFetch);
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  try {
    const result = await Effect.runPromise(generate(await input(72)).pipe(Effect.result));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") expect(result.failure).toMatchObject({ _tag: "PreviewFailure", reason: "input" });
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally { globalThis.fetch = originalFetch; }
});

test("a successful provider HTTP response with an opaque PNG is rejected", async () => {
  process.env.OPENAI_API_KEY = "test";
  const opaque = Buffer.from(await (await input()).arrayBuffer()).toString("base64");
  const originalFetch = globalThis.fetch;
  const fetchSpy = mock(async () => Response.json({ data: [{ b64_json: opaque }] }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  try {
    const result = await Effect.runPromise(generate(await input()).pipe(Effect.result));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") expect(result.failure).toMatchObject({ _tag: "PreviewFailure", reason: "invalid_output" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  } finally { globalThis.fetch = originalFetch; }
});

test("interrupting a preview aborts the actual fetch without a paid retry", async () => {
  // The UI suite installs Happy DOM globals. Exercise native fetch and its
  // AbortSignal in an isolated Bun runtime, as used by this transport check.
  if (process.env.PREVIEW_TRANSPORT_CHILD !== "1") {
    const child = Bun.spawn(["bun", "test", import.meta.path, "--test-name-pattern", "interrupting a preview"], { env: { ...process.env, PREVIEW_TRANSPORT_CHILD: "1" }, stdout: "pipe", stderr: "pipe" });
    const [code, output] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect({ code, failure: code ? output : "" }).toEqual({ code: 0, failure: "" });
    return;
  }
  process.env.OPENAI_API_KEY = "test";
  let started!: () => void;
  let release!: () => void;
  let settled!: (aborted: boolean) => void;
  const received = new Promise<void>(resolve => { started = resolve; });
  const hold = new Promise<void>(resolve => { release = resolve; });
  const clientSettled = new Promise<boolean>(resolve => { settled = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch() {
    started();
    await hold;
    return new Response("late");
  } });
  const originalFetch = globalThis.fetch;
  const fetchSpy = mock((_url: string | URL | Request, init?: RequestInit) => originalFetch(server.url, { ...init, headers: {} }).then(response => { settled(false); return response; }, error => { settled(init?.signal?.aborted === true && error.name === "AbortError"); throw error; }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  try {
    const abort = new AbortController();
    const task = Effect.runPromise(generate(await input()).pipe(Effect.result), { signal: abort.signal }).catch(() => undefined);
    await received;
    abort.abort();
    await task;
    expect(await Promise.race([clientSettled, new Promise(resolve => setTimeout(() => resolve(false), 500))])).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  } finally { globalThis.fetch = originalFetch; release(); await server.stop(true); }
});
