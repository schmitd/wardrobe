import { SchemaType, type Schema } from "@google/generative-ai";
import { Effect } from "effect";

import { GEMINI_FLASH_LITE_MODEL, GeminiService } from "@/services/GeminiService";
import { parseJson } from "@/server/inference/shared";
import type { DirectGarmentComparison } from "@/server/garmentIdentity";

export type GarmentCropImage = {
  data: string;
  mimeType: string;
};

export type DirectComparisonCandidate = {
  wardrobeItemId: string;
  category?: string | null;
  description?: string | null;
  image: GarmentCropImage;
};

export type DirectComparisonResult = DirectGarmentComparison & {
  model: typeof GEMINI_FLASH_LITE_MODEL;
  inputTokens: number | null;
  outputTokens: number | null;
};

const comparisonSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    match_index: { type: SchemaType.NUMBER },
    confidence: { type: SchemaType.NUMBER },
    rationale: { type: SchemaType.STRING },
  },
  required: ["match_index", "confidence", "rationale"],
};

export const compareGarmentCrops = (input: {
  query: GarmentCropImage;
  candidates: DirectComparisonCandidate[];
}) => Effect.gen(function* () {
  const gemini = yield* GeminiService;
  const candidates = input.candidates.slice(0, 3);
  if (!candidates.length) return yield* Effect.fail(new Error("Direct comparison needs at least one candidate"));

  const prompt = `Decide whether the query garment crop is the exact same physical wardrobe item as one candidate image.
This is instance matching, not style similarity: matching only color or category is insufficient. Compare distinctive print placement, seams, hardware, pockets, texture, proportions, wear marks, and other stable details. Allow differences in pose, lighting, occlusion, and camera angle. Do not identify or describe any person.
Return JSON only:
- match_index: zero-based candidate index, or -1 when none is clearly the same physical item.
- confidence: 0 to 1 for that exact-instance decision.
- rationale: one short sentence naming garment evidence only.
Be conservative. Use -1 when the evidence cannot distinguish similar items.`;

  const parts = [
    { text: prompt },
    { text: "Query garment crop:" },
    { inlineData: input.query },
    ...candidates.flatMap((candidate, index) => [
      { text: `Candidate ${index}: ${candidate.category ?? "unknown category"}. ${candidate.description ?? "No description."}` },
      { inlineData: candidate.image },
    ]),
  ];
  const generated = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: comparisonSchema,
    },
  });
  const parsed = yield* parseJson<{
    match_index?: unknown;
    confidence?: unknown;
    rationale?: unknown;
  }>(generated.response.text(), "compareGarmentCrops");
  const usage = generated.response.usageMetadata;

  return {
    matchIndex: typeof parsed.match_index === "number" ? Math.trunc(parsed.match_index) : -1,
    confidence: typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim().slice(0, 180) : "",
    model: GEMINI_FLASH_LITE_MODEL,
    inputTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
  } satisfies DirectComparisonResult;
});
