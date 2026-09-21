import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import { Effect, Layer } from "effect";
import { GeminiService } from "@/services/GeminiService";
import {
  analyzeFitPhoto,
  boxFromGemini,
  detailRegion,
  focusOutfit,
  mapBox,
  parseFitItems,
  verifiedIndices,
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
      detection([item()], [200, 300, 800, 700]),
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
});
