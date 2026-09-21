import sharp from "sharp";
import { Cause, Effect, Schedule } from "effect";
import {
  SchemaType,
  type Schema,
  type Part,
  type GenerationConfig,
} from "@google/generative-ai";
import { GeminiError, GeminiService } from "@/services/GeminiService";
import { sanitizeStyleTags, truncateWords } from "@/lib/inferenceOutputGuards";
import {
  cropGarmentRegion,
  type NormalizedBoundingBox,
} from "../garmentIdentity";
import { parseJson, ModelResponseError } from "./shared";

export const FIT_DETECTOR_MODEL = "gemini-2.5-flash" as const;
export const FIT_DETECTOR_VERSION = "outfit-focus-context-verification-v2";
// Leave half of the mobile route's 180-second budget for embeddings and writes.
export const FIT_LOCALIZATION_TIMEOUT_MS = 90_000;
export const FIT_VISION_CONFIG: GenerationConfig & {
  thinkingConfig: { thinkingBudget: number };
} = {
  temperature: 0,
  maxOutputTokens: 4096,
  thinkingConfig: { thinkingBudget: 0 },
};
const roles = [
  "top",
  "bottom",
  "outerwear",
  "footwear",
  "dress",
  "accessory",
  "bag",
  "jewelry",
];
const boxSchema: Schema = {
  type: SchemaType.ARRAY,
  items: { type: SchemaType.NUMBER },
};
const detectionSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    transcription: { type: SchemaType.STRING },
    outfit_box: boxSchema,
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING, enum: roles, format: "enum" },
          description: { type: SchemaType.STRING },
          style_tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          box_2d: boxSchema,
          confidence: { type: SchemaType.NUMBER },
        },
        required: [
          "category",
          "description",
          "style_tags",
          "box_2d",
          "confidence",
        ],
      },
    },
  },
  required: ["transcription", "outfit_box", "items"],
};

export type FitItem = {
  category: string;
  description: string;
  style_tags: string[];
  bounding_box: NormalizedBoundingBox;
  confidence: number;
};
/** Gemini's trained localization convention is [ymin, xmin, ymax, xmax]/1000. */
export function boxFromGemini(
  value: unknown,
): NormalizedBoundingBox | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some(
      (n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1000,
    )
  )
    return;
  const [y0, x0, y1, x1] = value as number[];
  if (x1 <= x0 || y1 <= y0) return;
  return {
    x: x0 / 1000,
    y: y0 / 1000,
    width: (x1 - x0) / 1000,
    height: (y1 - y0) / 1000,
  };
}

export function mapBox(
  box: NormalizedBoundingBox,
  region: NormalizedBoundingBox,
): NormalizedBoundingBox {
  return {
    x: region.x + box.x * region.width,
    y: region.y + box.y * region.height,
    width: box.width * region.width,
    height: box.height * region.height,
  };
}

// Category identifies a kind of garment, not an individual piece. Only a
// substantial overlap in original-image coordinates can replace a first pass.
function sameLocatedItem(a: FitItem, b: FitItem): boolean {
  if (a.category !== b.category) return false;
  const x = Math.max(a.bounding_box.x, b.bounding_box.x);
  const y = Math.max(a.bounding_box.y, b.bounding_box.y);
  const right = Math.min(a.bounding_box.x + a.bounding_box.width, b.bounding_box.x + b.bounding_box.width);
  const bottom = Math.min(a.bounding_box.y + a.bounding_box.height, b.bounding_box.y + b.bounding_box.height);
  const intersection = Math.max(0, right - x) * Math.max(0, bottom - y);
  const union = a.bounding_box.width * a.bounding_box.height + b.bounding_box.width * b.bounding_box.height - intersection;
  return union > 0 && intersection / union >= 0.5;
}

export function detailRegion(
  box: NormalizedBoundingBox,
): NormalizedBoundingBox {
  const width = Math.min(1, Math.max(0.18, box.width * 4));
  const height = Math.min(1, Math.max(0.18, box.height * 4));
  const x = Math.max(0, Math.min(1 - width, box.x + box.width / 2 - width / 2));
  const y = Math.max(
    0,
    Math.min(1 - height, box.y + box.height / 2 - height / 2),
  );
  return { x, y, width, height };
}

export function parseFitItems(
  value: unknown,
  region: NormalizedBoundingBox = { x: 0, y: 0, width: 1, height: 1 },
): FitItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    if (
      !item ||
      !roles.includes(item.category) ||
      typeof item.description !== "string" ||
      !item.description.trim()
    )
      return [];
    const box = boxFromGemini(item.box_2d);
    if (
      !box ||
      typeof item.confidence !== "number" ||
      !Number.isFinite(item.confidence) ||
      item.confidence < 0.5
    )
      return [];
    return [
      {
        category: item.category,
        description: truncateWords(item.description, 40),
        style_tags: sanitizeStyleTags(
          Array.isArray(item.style_tags)
            ? item.style_tags.filter((s: unknown) => typeof s === "string")
            : [],
        ),
        bounding_box: mapBox(box, region),
        confidence: Math.min(1, item.confidence),
      },
    ];
  });
}

// Use integer extraction coordinates for both the model input and inverse mapping.
// No independently rounded or padded box is allowed to shift a small accessory.
export async function focusOutfit(source: Buffer, box: NormalizedBoundingBox) {
  const { width = 0, height = 0 } = await sharp(source).metadata();
  const left = Math.max(0, Math.floor((box.x - box.width * 0.06) * width));
  const top = Math.max(0, Math.floor((box.y - box.height * 0.06) * height));
  const right = Math.min(width, Math.ceil((box.x + box.width * 1.06) * width));
  const bottom = Math.min(
    height,
    Math.ceil((box.y + box.height * 1.06) * height),
  );
  if (right <= left || bottom <= top) throw new Error("Invalid outfit region");
  const image = await sharp(source)
    .extract({ left, top, width: right - left, height: bottom - top })
    .jpeg({ quality: 95 })
    .toBuffer();
  return {
    image,
    region: {
      x: left / width,
      y: top / height,
      width: (right - left) / width,
      height: (bottom - top) / height,
    },
  };
}

const prompt = `Catalog the visible worn garments and accessories of the primary outfit in this photo.
Ignore background objects, reflections of objects, phones, skin, and bystanders. Do not identify the wearer or infer personal traits.
Decompose the outfit into separate individual pieces. Never return a person, "clothing", "outfit" or "menswear" as an item.
A distant subject still has separate garments. Locate each visible piece, including small watches, belts and jewelry. Do not invent hidden detail or items outside the frame.
Return outfit_box enclosing ALL visible worn garments/accessories, and items with box_2d tightly enclosing the actual visible item, not the neighboring arm/body or the whole person.
Every box uses [ymin, xmin, ymax, xmax] normalized to 0–1000 relative to THIS image, top-left origin. Never use x/y/width/height. For a watch include its face AND visible band; do not box the forearm.
Description: concise garment color/material/shape; style_tags: up to five short tags; confidence: 0–1. Transcription: one short outfit sentence without describing the person.`;

const verificationSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    checks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          index: { type: SchemaType.INTEGER },
          contains_item: { type: SchemaType.BOOLEAN },
          well_framed: { type: SchemaType.BOOLEAN },
        },
        required: ["index", "contains_item", "well_framed"],
      },
    },
  },
  required: ["checks"],
};

export function verifiedIndices(value: unknown, count: number): Set<number> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    Array.from({ length: count }, (_, i) => i).filter((i) => {
      const checks = value.filter((c) => c && c.index === i);
      return (
        checks.length === 1 &&
        checks[0].contains_item === true &&
        checks[0].well_framed === true
      );
    }),
  );
}

export const analyzeFitPhoto = (
  base64: string,
  _type: string,
  _mimeType?: string,
  trace: { traceId?: string; traceparent?: string } = {},
) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const started = Date.now();
    // Strip EXIF and orient once BEFORE vision. All boxes, zooms and final crops
    // refer to this same upright pixel space, on both native and web uploads.
    const source = yield* Effect.tryPromise(() =>
      sharp(Buffer.from(base64, "base64"))
        .rotate()
        .jpeg({ quality: 95 })
        .toBuffer(),
    );
    const request = <L extends "fitLocalization" | "fitCropVerification">(parts: Part[], schema: Schema, label: L) =>
      gemini
        .generateContent(FIT_DETECTOR_MODEL, {
          contents: [{ role: "user", parts }],
          generationConfig: {
            ...FIT_VISION_CONFIG,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        })
        .pipe(
          Effect.flatMap((r) =>
            parseJson(r.response.text(), label),
          ),
          Effect.timeout("25 seconds"),
          Effect.retry({ times: 1, schedule: Schedule.exponential("500 millis"), while: (error) => Cause.isTimeoutError(error) || (error instanceof GeminiError && error.retryable) }),
        );
    const detect = (image: Buffer, instruction = prompt) =>
      request(
        [
          { text: instruction },
          {
            inlineData: {
              data: image.toString("base64"),
              mimeType: "image/jpeg",
            },
          },
        ],
        detectionSchema,
        "fitLocalization",
      );
    const first = yield* detect(source);
    const initialItems = parseFitItems(first.items);
    const outfitBox = boxFromGemini(first.outfit_box);
    let scene = source;
    let region = { x: 0, y: 0, width: 1, height: 1 };
    let detection = first;
    let zoomed = false;
    if (outfitBox && outfitBox.width * outfitBox.height < 0.7) {
      const focused = yield* Effect.tryPromise(() =>
        focusOutfit(source, outfitBox),
      );
      scene = focused.image;
      region = focused.region;
      detection = yield* detect(
        scene,
        `${prompt}\nCheck the close view for every visible piece, including these first-pass candidates: ${JSON.stringify(initialItems.map((i) => ({ category: i.category, description: i.description })))}`,
      );
      zoomed = true;
    }
    let items = parseFitItems(detection.items, region);
    // Do not drop a small accessory solely because the second pass overlooked it.
    for (const item of initialItems) {
      if (!items.some((i) => sameLocatedItem(i, item))) items.push(item);
    }
    // If the model produced no usable boxes, re-localize once automatically.
    if (!items.length) {
      detection = yield* detect(
          scene,
          `${prompt}\nThe previous pass did not return valid individual items. Re-examine the clothing boundaries carefully.`,
      );
      items = parseFitItems(detection.items, region);
    }
    const verify = (candidates: FitItem[]) =>
      Effect.gen(function* () {
        if (!candidates.length) return new Set<number>();
        const parts: Part[] = [
          {
            text: `The first image is the upright original photo; subsequent images are numbered candidate crops. Compare each crop with the original photo and check it independently against its label. Do not assume the label is true. contains_item means the named garment/accessory is actually visible. well_framed means the crop includes the visible item extent, not just a fragment at an edge, and is centered on the item rather than adjacent body/background. A watch crop showing mostly arm with a sliver of watch is NOT well_framed. Use the original photo to distinguish natural occlusion from crop-induced cutoff: a crop must include the full visible extent in the original, even when the crop alone looks plausible. Natural occlusion in the photo is acceptable, crop-induced cutoff is not. Return exactly one check for each index.`,
          },
          { inlineData: { data: source.toString("base64"), mimeType: "image/jpeg" } },
        ];
        for (const [index, item] of candidates.entries()) {
          const crop = yield* Effect.tryPromise(() =>
            cropGarmentRegion(source, item.bounding_box),
          );
          parts.push(
            { text: `Index ${index}: ${item.category}. ${item.description}` },
            {
              inlineData: {
                data: crop.toString("base64"),
                mimeType: "image/jpeg",
              },
            },
          );
        }
        const result = yield* request(
          parts,
          verificationSchema,
          "fitCropVerification",
        );
        return verifiedIndices(result.checks, candidates.length);
      });
    const valid = yield* verify(items);
    const rejected = items.filter((_, i) => !valid.has(i));
    const accepted = items.filter((_, i) => valid.has(i));
    if (rejected.length) {
      // Give hard accessories a real pixel-level close-up from the original photo,
      // not an enlarged thumbnail or another identical full-scene guess.
      const repairs = (yield* Effect.forEach(
        rejected.slice(0, 4),
        (old) =>
          Effect.gen(function* () {
            const focused = yield* Effect.tryPromise(() =>
              focusOutfit(source, detailRegion(old.bounding_box)),
            );
            const retry = yield* detect(
              focused.image,
              `${prompt}\nLocate ONLY this item in this close view: ${JSON.stringify({ category: old.category, description: old.description })}. Previous framing was incorrect. Find the actual object, not the arm/background. Return no items if it is not visible.`,
            );
            return parseFitItems(retry.items, focused.region)
              .filter((i) => i.category === old.category)
              .slice(0, 1);
          }),
        { concurrency: 2 },
      )).flat();
      const repairValid = yield* verify(repairs);
      for (const old of rejected) {
        const index = repairs.findIndex(
          (r, i) => repairValid.has(i) && r.category === old.category,
        );
        if (index >= 0) {
          accepted.push(repairs[index]);
          repairValid.delete(index);
        }
      }
    }
    // An inaccurate first-pass box may repair onto an already accepted item.
    // Preserve distinct same-category pieces, but do not save the same crop twice.
    const uniqueAccepted = accepted.filter((candidate, index) =>
      !accepted.slice(0, index).some(other => sameLocatedItem(candidate, other)),
    );
    console.info("fit_check.localization.complete", {
      ...trace,
      detectorVersion: FIT_DETECTOR_VERSION,
      model: FIT_DETECTOR_MODEL,
      zoomed,
      detectedCount: items.length,
      initialRejectedCount: rejected.length,
      acceptedCount: uniqueAccepted.length,
      durationMs: Date.now() - started,
    });
    // Failed candidates cannot enter garment identity matching or the catalog.
    if (!uniqueAccepted.length)
      return yield* Effect.fail(
        new ModelResponseError({ message: "No verified garment crops were produced", operation: "fitLocalization" }),
      );
    return {
      transcription: truncateWords(
        typeof detection.transcription === "string"
          ? detection.transcription
          : "",
        40,
      ),
      items: uniqueAccepted,
    };
  }).pipe(
    Effect.timeout(FIT_LOCALIZATION_TIMEOUT_MS),
    Effect.withSpan("fit_check.localize", {
      attributes: { detectorVersion: FIT_DETECTOR_VERSION },
    }),
  );
