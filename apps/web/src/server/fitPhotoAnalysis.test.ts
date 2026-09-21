import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import { Cause, Deferred, Effect, Fiber, Layer, Result } from "effect";
import { TestClock } from "effect/testing";
import { GeminiService } from "@/services/GeminiService";
import {
  analyzeFitPhoto,
  boxFromGemini,
  detailRegion,
  focusOutfit,
  mapBox,
  parseFitItems,
  verifiedIndices,
  FIT_LOCALIZATION_TIMEOUT_MS,
} from "./inference/fitPhotoAnalysis";

const item = (box = [200, 300, 250, 380]) => ({
  category: "accessory",
  description: "Black watch",
  style_tags: ["digital"],
  box_2d: box,
  confidence: 0.9,
});
const detection = (items: unknown[], box = [0, 0, 1000, 1000]) => ({
  transcription: "An outfit.",
  outfit_box: box,
  items,
});
const checked = (ok: boolean) => ({
  checks: [{ index: 0, contains_item: ok, well_framed: ok }],
});
const source = async () =>
  (
    await sharp({
      create: { width: 600, height: 1000, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer()
  ).toString("base64");
function service(responses: unknown[]) {
  const calls: unknown[] = [];
  return {
    calls,
    layer: Layer.succeed(GeminiService, {
      generateContent: (_model, request) => {
        calls.push(request);
        if (!responses.length)
          return Effect.die("Unexpected extra vision call");
        const body = responses.shift();
        return Effect.succeed({
          response: { text: () => JSON.stringify(body) },
        } as never);
      },
      embedContent: () => Effect.die("No embedding before verification"),
      batchEmbedContents: () => Effect.die("Unexpected embedding"),
    }),
  };
}
describe("fit localization geometry", () => {
  it("converts y/x corners without interpreting them as x/y/width/height", () => {
    expect(boxFromGemini([200, 300, 250, 380])).toEqual({
      x: 0.3,
      y: 0.2,
      width: 0.08,
      height: 0.05,
    });
    for (const value of [
      null,
      [],
      [0, 0, 0, 100],
      [100, 200, 50, 300],
      [0, 0, Infinity, 1],
      [-1, 0, 500, 500],
      [0, 0, 1001, 500],
    ])
      expect(boxFromGemini(value)).toBeUndefined();
  });
  it("maps close-view coordinates back onto the original image", () => {
    expect(
      mapBox(
        { x: 0.5, y: 0.25, width: 0.1, height: 0.2 },
        { x: 0.2, y: 0.1, width: 0.4, height: 0.8 },
      ),
    ).toEqual({
      x: 0.4,
      y: 0.30000000000000004,
      width: 0.04000000000000001,
      height: 0.16000000000000003,
    });
  });
  it("uses the exact integer region for inverse mapping, including edge padding", async () => {
    const bytes = Buffer.from(await source(), "base64");
    const { image, region } = await focusOutfit(bytes, {
      x: 0,
      y: 0.4,
      width: 0.3,
      height: 0.6,
    });
    const meta = await sharp(image).metadata();
    expect(region.x).toBe(0);
    expect(region.y + region.height).toBeCloseTo(1);
    expect(region.width * 600).toBeCloseTo(meta.width!);
    expect(region.height * 1000).toBeCloseTo(meta.height!);
  });
  it("rejects generic clothing, missing boxes and malformed values", () => {
    expect(
      parseFitItems([
        { ...item(), category: "menswear" },
        { ...item(), box_2d: undefined },
        { ...item(), confidence: NaN },
        { ...item(), description: null },
      ]),
    ).toEqual([]);
  });
  it("fails closed for missing, duplicate or non-boolean verifier checks", () => {
    expect([
      ...verifiedIndices(
        [{ index: 0, contains_item: true, well_framed: false }],
        1,
      ),
    ]).toEqual([]);
    expect([
      ...verifiedIndices([checked(true).checks[0], checked(true).checks[0]], 1),
    ]).toEqual([]);
    expect([
      ...verifiedIndices(
        [{ index: 0, contains_item: "true", well_framed: true }],
        1,
      ),
    ]).toEqual([]);
  });
});
describe("automatic fit analysis", () => {
  it("re-localizes a failed watch crop and verifies the repair without a manual step", async () => {
    const s = service([
      detection([item()]),
      checked(false),
      detection([item([700, 300, 750, 380])]),
      checked(true),
    ]);
    const result = await Effect.runPromise(
      analyzeFitPhoto(await source(), "daily_fit_check").pipe(
        Effect.provide(s.layer),
      ),
    );
    expect(result.items).toHaveLength(1);
    const focused = await focusOutfit(
      Buffer.from(await source(), "base64"),
      detailRegion(boxFromGemini(item().box_2d)!),
    );
    expect(result.items[0].bounding_box).toEqual(
      mapBox(boxFromGemini([700, 300, 750, 380])!, focused.region),
    );
    expect(s.calls).toHaveLength(4);
  });
  it("focuses distant outfits before item detection and maps resulting boxes", async () => {
    const s = service([
      detection([], [200, 300, 800, 700]),
      detection([item()]),
      checked(true),
    ]);
    const result = await Effect.runPromise(
      analyzeFitPhoto(await source(), "daily_fit_check").pipe(
        Effect.provide(s.layer),
      ),
    );
    expect(result.items[0].bounding_box.x).toBeGreaterThan(0.3);
    expect(result.items[0].bounding_box.width).toBeLessThan(0.08);
    expect(s.calls).toHaveLength(3);
    const verification = s.calls[2] as { contents: { parts: { inlineData?: { data: string } }[] }[] };
    const images = verification.contents[0].parts.filter(part => part.inlineData);
    expect(images).toHaveLength(2);
    const context = await sharp(Buffer.from(images[0].inlineData!.data, "base64")).metadata();
    expect([context.width, context.height]).toEqual([600, 1000]);
  });
  it("preserves distinct accessories across zoom passes while replacing an overlapping detection", async () => {
    const watch = { ...item([200, 200, 260, 300]), description: "Black watch" };
    const belt = { ...item([500, 200, 560, 700]), description: "Brown belt" };
    const s = service([
      detection([watch, belt], [100, 100, 900, 900]),
      detection([belt]),
      { checks: [0, 1].map(index => ({ index, contains_item: true, well_framed: true })) },
    ]);
    const result = await Effect.runPromise(analyzeFitPhoto(await source(), "daily_fit_check").pipe(Effect.provide(s.layer)));
    expect(result.items.map(piece => piece.description)).toEqual(["Brown belt", "Black watch"]);
    expect(s.calls).toHaveLength(3);
  });
  it("bounds the combined passes before verification and downstream persistence", async () => {
    const first = Array.from({ length: 12 }, (_, i) => item([100 + i * 15, 100, 110 + i * 15, 120]));
    const focused = Array.from({ length: 12 }, (_, i) => item([600 + i * 15, 600, 610 + i * 15, 620]));
    const s = service([
      detection(first, [100, 100, 900, 900]),
      detection(focused),
      { checks: Array.from({ length: 12 }, (_, index) => ({ index, contains_item: true, well_framed: true })) },
    ]);
    const result = await Effect.runPromise(analyzeFitPhoto(await source(), "daily_fit_check").pipe(Effect.provide(s.layer)));
    expect(result.items).toHaveLength(12);
    expect(s.calls).toHaveLength(3);
  });
  it("does not save an automatic repair twice when it lands on an accepted item", async () => {
    const bytes = await source();
    const accepted = item([400, 400, 600, 600]);
    const misplaced = item([400, 600, 600, 800]);
    const target = boxFromGemini(accepted.box_2d)!;
    const { region } = await focusOutfit(Buffer.from(bytes, "base64"), detailRegion(boxFromGemini(misplaced.box_2d)!));
    const repairedBox = [
      (target.y - region.y) / region.height * 1000,
      (target.x - region.x) / region.width * 1000,
      (target.y + target.height - region.y) / region.height * 1000,
      (target.x + target.width - region.x) / region.width * 1000,
    ];
    const s = service([
      detection([accepted, misplaced]),
      { checks: [
        { index: 0, contains_item: true, well_framed: true },
        { index: 1, contains_item: true, well_framed: false },
      ] },
      detection([item(repairedBox)]),
      checked(true),
    ]);
    const result = await Effect.runPromise(analyzeFitPhoto(bytes, "daily_fit_check").pipe(Effect.provide(s.layer)));
    expect(result.items).toHaveLength(1);
    expect(result.items[0].bounding_box).toEqual(target);
    expect(s.calls).toHaveLength(4);
  });
  it("never returns a crop that fails both independent checks", async () => {
    const s = service([
      detection([item()]),
      checked(false),
      detection([item()]),
      checked(false),
    ]);
    await expect(
      Effect.runPromise(
        analyzeFitPhoto(await source(), "daily_fit_check").pipe(
          Effect.provide(s.layer),
        ),
      ),
    ).rejects.toThrow("No verified garment crops");
  });
  it("retries generic category output rather than saving it as one item", async () => {
    const s = service([
      detection([{ ...item(), category: "menswear" }]),
      detection([item()]),
      checked(true),
    ]);
    const result = await Effect.runPromise(
      analyzeFitPhoto(await source(), "daily_fit_check").pipe(
        Effect.provide(s.layer),
      ),
    );
    expect(result.items[0].category).toBe("accessory");
  });
});

describe("localization provider boundaries", () => {
  it("cancels a slow recovery within the whole-workflow budget", async () => {
    const bytes = await source();
    let calls = 0;
    let interrupted = false;
    await Effect.runPromise(Effect.gen(function* () {
      const stages = yield* Effect.forEach([0, 1, 2, 3], () => Deferred.make<void>());
      const responses = [detection([], [100, 100, 900, 900]), detection([item()]), checked(false)];
      const slow = Layer.succeed(GeminiService, {
        generateContent: () => Effect.gen(function* () {
          const index = calls++;
          yield* Deferred.succeed(stages[index], undefined);
          yield* Effect.sleep("24 seconds").pipe(Effect.onInterrupt(() => Effect.sync(() => { interrupted = true; })));
          return { response: { text: () => JSON.stringify(responses[index]) } } as never;
        }),
        embedContent: () => Effect.die("Unexpected embedding"),
        batchEmbedContents: () => Effect.die("Unexpected embedding"),
      });
      const fiber = yield* analyzeFitPhoto(bytes, "daily_fit_check").pipe(Effect.provide(slow), Effect.result, Effect.forkChild);
      for (let index = 0; index < 3; index++) {
        yield* Deferred.await(stages[index]);
        yield* TestClock.adjust("24 seconds");
      }
      yield* Deferred.await(stages[3]);
      yield* TestClock.adjust(FIT_LOCALIZATION_TIMEOUT_MS - 72_000);
      const result = yield* Fiber.join(fiber);
      expect(Result.isFailure(result) && Cause.isTimeoutError(result.failure)).toBe(true);
    }).pipe(Effect.provide(TestClock.layer())));
    expect(calls).toBe(4);
    expect(interrupted).toBe(true);
  });
  it("rejects malformed model success before verification or persistence", async () => {
    const s = service([{ transcription: "Outfit", outfit_box: [], items: "not-an-array" }]);
    await expect(Effect.runPromise(analyzeFitPhoto(await source(), "daily_fit_check").pipe(Effect.provide(s.layer)))).rejects.toThrow("invalid response");
    expect(s.calls).toHaveLength(1);
  });
  it("rejects a malformed verifier response without treating truthy strings as approval", async () => {
    const s = service([detection([item()]), { checks: [{ index: 0, contains_item: "true", well_framed: true }] }]);
    await expect(Effect.runPromise(analyzeFitPhoto(await source(), "daily_fit_check").pipe(Effect.provide(s.layer)))).rejects.toThrow("invalid response");
    expect(s.calls).toHaveLength(2);
  });
  it("returns the corrected transcription from successful no-items recovery", async () => {
    const s = service([
      { ...detection([]), transcription: "Unclear clothing" },
      { ...detection([item()]), transcription: "A black digital watch." },
      checked(true),
    ]);
    const result = await Effect.runPromise(analyzeFitPhoto(await source(), "daily_fit_check").pipe(Effect.provide(s.layer)));
    expect(result.transcription).toBe("A black digital watch.");
    expect(result.items).toHaveLength(1);
  });
});
