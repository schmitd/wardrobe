import { Effect } from "effect";
import { SchemaType, type Schema } from "@google/generative-ai";
import type { Id } from "@convex/_generated/dataModel";
import { DESCRIPTION_MAX_OUTPUT_TOKENS, ITEM_DESCRIPTION_WORD_LIMIT, STYLE_LABEL_MAX_OUTPUT_TOKENS, sanitizeStyleTags, truncateWords } from "@/lib/inferenceOutputGuards";
import { GEMINI_FLASH_LITE_MODEL, GeminiService } from "@/services/GeminiService";
import { parseJson, toErrorMessage, withRetries } from "./shared";

export const analyzeImageFull = (base64: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        style_tags: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        category: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
      },
      required: ["category", "description", "style_tags"],
    };

    const prompt = `Analyze this clothing item.
- Return JSON with keys in this exact order: style_tags, category, description.
- style_tags: provide 3-5 concise labels, each at most 3 words.
- category: short noun phrase.
- description: at most ${ITEM_DESCRIPTION_WORD_LIMIT} words.`;

    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64, mimeType: "image/jpeg" } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        maxOutputTokens: DESCRIPTION_MAX_OUTPUT_TOKENS + STYLE_LABEL_MAX_OUTPUT_TOKENS,
      },
    });

    const parsed = yield* parseJson(
      result.response.text(),
      "analyzeImageFull"
    );

    return {
      category: truncateWords(parsed.category, 6),
      description: truncateWords(parsed.description, ITEM_DESCRIPTION_WORD_LIMIT),
      style_tags: sanitizeStyleTags(parsed.style_tags),
    };
  }).pipe(withRetries);

export const analyzeInspirationImage = (base64: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        style_tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        category: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
      },
      required: ["category", "description", "style_tags"],
    };
    const prompt = `Read this image as a mood-board reference for a personal wardrobe.
- Do not merely inventory garments or products.
- Infer the broader visual language: silhouette, proportion, texture, palette, mood, setting, and social or cultural associations when visible.
- Return JSON in this exact order: style_tags, category, description.
- style_tags: 4-6 associative labels, each at most 3 words.
- category: a concise reference type, not a retail product title.
- description: at most ${ITEM_DESCRIPTION_WORD_LIMIT} words; describe what this image could contribute to a future outfit or collection.`;
    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { data: base64, mimeType: "image/jpeg" } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: DESCRIPTION_MAX_OUTPUT_TOKENS + STYLE_LABEL_MAX_OUTPUT_TOKENS },
    });
    const parsed = yield* parseJson(result.response.text(), "analyzeInspirationImage");
    return { category: truncateWords(parsed.category, 6), description: truncateWords(parsed.description, ITEM_DESCRIPTION_WORD_LIMIT), style_tags: sanitizeStyleTags(parsed.style_tags) };
  }).pipe(withRetries);

export const generateStyleQuery = (description: string, styleTags: string[]) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const prompt = `Given this clothing item description: "${description}" and style tags: "${styleTags.join(
      ", "
    )}", generate a search query to find compatible items in a wardrobe. Return just the query string.`;

    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, prompt);
    return result.response.text().trim();
  }).pipe(withRetries);

export const evaluateCompatibility = (input: {
  scope: "single_piece" | "full_fit";
  candidate: { category: string; description: string; style_tags: string[] };
  similarItems: { category: string | null; description: string | null; similarity: number }[];
  dissimilarItems: { category: string | null; description: string | null; similarity: number }[];
  memoryContext: Array<{ fact: string; relation: string; relevance: number | null }>;
}) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.NUMBER },
        explanation: { type: SchemaType.STRING },
        best_pairings: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.NUMBER },
        },
        worst_clashes: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.NUMBER },
        },
      },
      required: ["score", "explanation", "best_pairings", "worst_clashes"],
    };

    const prompt = `You are a professional fashion stylist with high standards. Your job is to critically evaluate whether a candidate clothing item fits well with an existing wardrobe.

CANDIDATE ${input.scope === "full_fit" ? "OUTFIT (all described garments together)" : "ITEM"}:
${JSON.stringify(input.candidate)}

WARDROBE MEMORY (saved preferences, collections, and prior comparisons):
${input.memoryContext.length > 0
  ? input.memoryContext.map((entry) => `- [${entry.relation}] ${entry.fact}`).join("\n")
  : "No relevant long-term wardrobe memory found."}

WARDROBE ITEMS (Most Compatible):
${input.similarItems.length > 0
  ? input.similarItems
      .map(
        (item, i) =>
          `${i}. ${item.category ?? "Item"}: ${item.description ?? ""} (similarity: ${Math.round(
            item.similarity * 100
          )}%)`
      )
      .join("\n")
  : "No similar items found in wardrobe."}

${input.dissimilarItems.length > 0
  ? `\nWARDROBE ITEMS (Least Compatible - Potential Clashes):\n${input.dissimilarItems
      .map(
        (item, i) =>
          `${i}. ${item.category ?? "Item"}: ${item.description ?? ""} (similarity: ${Math.round(
            item.similarity * 100
          )}%)`
      )
      .join("\n")}`
  : ""}

CRITICAL EVALUATION GUIDELINES:
- Focus ONLY on how well this candidate fits with the EXISTING WARDROBE ITEMS listed above
- ${input.scope === "full_fit" ? "Consider all described garments as one outfit and explain how the overall look relates to the closet; do not reduce it to one garment." : "Do NOT evaluate the candidate item's internal consistency or standalone quality"}
- Be CRITICAL and HONEST - most items should score 40-70%, not 90%+
- Score 90-100%: Perfect match, complements multiple wardrobe items, fills a gap
- Score 70-89%: Good fit, works well with several items
- Score 50-69%: Acceptable, works with some items but limited versatility
- Score 30-49%: Poor fit, clashes with most items or redundant
- Score 0-29%: Terrible fit, completely incompatible with wardrobe style

Return JSON with keys:
- score (number 0-100): Your critical compatibility score
- explanation (string): Focus on how it compares to the WARDROBE, not its internal quality
- best_pairings (array of indices): Which wardrobe items it pairs best with
- worst_clashes (array of indices): Which wardrobe items it clashes with most (if any)`;

    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return yield* parseJson(result.response.text(), "evaluateCompatibility");
  }).pipe(withRetries);

export const analyzeSelfie = (base64: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        skin_tone: { type: SchemaType.STRING },
        complexion: { type: SchemaType.STRING },
        hair_color: { type: SchemaType.STRING },
        color_season: { type: SchemaType.STRING },
      },
      required: ["skin_tone", "complexion", "hair_color", "color_season"],
    };

    const prompt =
      "Analyze only visible color characteristics that can help coordinate clothing. Extract approximate skin tone, complexion/undertone notes, hair color, and a tentative color season. Do not infer profession, personality, lifestyle, gender identity, or style taste from the face. Return JSON: { skin_tone, complexion, hair_color, color_season }.";

    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64, mimeType: "image/jpeg" } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return yield* parseJson(
      result.response.text(),
      "analyzeSelfie"
    );
  }).pipe(withRetries);

export type FitCheckKind = "daily_fit_check" | "try_on";

export const FIT_CHECK_CONTENT_BLOCK_MESSAGE =
  "This photo could not be analyzed. Try another well-lit photo where your full outfit is visible.";

export const isGeminiContentBlock = (error: unknown) =>
  /PROHIBITED_CONTENT|prompt was blocked|response was blocked|finishReason.*SAFETY/i.test(
    toErrorMessage(error)
  );

type DetectedFitCheckItem = {
  category: string;
  description: string;
  style_tags: string[];
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
};

export type RecordFitCheckItemInput = {
  wardrobeItemId?: Id<"wardrobeItems">;
  source: "matched_existing" | "created_from_fit_check" | "observed_unresolved";
  category: string;
  description: string;
  styleTags: string[];
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
  embedding?: number[];
  observation?: {
    cropStorageId: Id<"_storage">;
    categoryKey: string;
    visualEmbedding: number[];
    semanticEmbedding?: number[];
    embeddingModel: string;
    detectorModel: string;
    resolutionStatus: "auto_matched" | "needs_confirmation" | "unresolved";
    matchScore?: number;
    matchMargin?: number;
    candidateItemIds: Id<"wardrobeItems">[];
    candidateScores: number[];
  };
};

export const normalizeBoundingBox = (box: DetectedFitCheckItem["bounding_box"]) => {
  if (!box) return undefined;
  const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const x = clamp(box.x);
  const y = clamp(box.y);
  return { x, y, width: Math.min(clamp(box.width), 1 - x), height: Math.min(clamp(box.height), 1 - y) };
};

export const analyzeFitCheckPhoto = (base64: string, type: FitCheckKind, mimeType = "image/jpeg") =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        transcription: { type: SchemaType.STRING },
        items: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              category: { type: SchemaType.STRING },
              description: { type: SchemaType.STRING },
              style_tags: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
              },
              bounding_box: {
                type: SchemaType.OBJECT,
                properties: {
                  x: { type: SchemaType.NUMBER },
                  y: { type: SchemaType.NUMBER },
                  width: { type: SchemaType.NUMBER },
                  height: { type: SchemaType.NUMBER },
                },
                required: ["x", "y", "width", "height"],
              },
              confidence: { type: SchemaType.NUMBER },
            },
            required: ["category", "description", "style_tags"],
          },
        },
      },
      required: ["transcription", "items"],
    };

    const prompt = `Analyze only the clothing and accessories visible in this outfit photo for a ${type === "daily_fit_check" ? "daily fit check of what the user actually wore" : "try-on check of items the user tried on"}.
Do not identify or describe the person. Do not infer age, gender, ethnicity, health, body characteristics, or any other sensitive personal trait. Ignore exposed skin and omit anything that is not clearly a garment or accessory.
Return JSON only.
- transcription: one concise sentence describing the whole outfit.
- items: each visible worn garment, shoe, bag, or accessory.
- category: garment role such as top, bottom, outerwear, footwear, dress, accessory, bag, jewelry.
- description: concise visual description with color, silhouette, material/pattern if visible.
- style_tags: 3-5 concise tags, each at most 3 words.
- bounding_box: normalized coordinates from 0 to 1 around just that item, as { x, y, width, height }.
- confidence: 0 to 1.`;

    const requestAnalysis = (
      model: typeof GEMINI_FLASH_LITE_MODEL | "gemini-2.5-flash",
      instruction: string
    ) =>
      Effect.gen(function* () {
        const result = yield* gemini.generateContent(model, {
          contents: [
            {
              role: "user",
              parts: [
                { text: instruction },
                { inlineData: { data: base64, mimeType } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });
        const responseText = yield* Effect.try({
          try: () => result.response.text(),
          catch: (error) => new Error(toErrorMessage(error)),
        });
        return yield* parseJson(responseText, "analyzeFitCheckPhoto");
      });

    const fallbackPrompt = `${prompt}
This is a wardrobe cataloging task. Focus narrowly on fabric, color, silhouette, and garment boundaries; produce no commentary about the wearer.`;
    const parsed = yield* requestAnalysis(GEMINI_FLASH_LITE_MODEL, prompt).pipe(
      Effect.catch((error) =>
        isGeminiContentBlock(error)
          ? requestAnalysis("gemini-2.5-flash", fallbackPrompt)
          : Effect.fail(error)
      )
    );

    return {
      transcription: truncateWords(parsed.transcription, 40),
      items: parsed.items.slice(0, 12).map((item) => ({
        category: truncateWords(item.category, 6),
        description: truncateWords(item.description, ITEM_DESCRIPTION_WORD_LIMIT),
        style_tags: sanitizeStyleTags(item.style_tags),
        bounding_box: normalizeBoundingBox(item.bounding_box),
        confidence:
          typeof item.confidence === "number"
            ? Math.max(0, Math.min(1, item.confidence))
            : undefined,
      })),
    };
  }).pipe(withRetries);

export const generateClosetBio = (items: { category: string; description: string; style_tags: string[] }[]) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        bio: { type: SchemaType.STRING },
      },
      required: ["bio"],
    };
    const prompt = `You are a style editor. Given the analyzed closet items below, write a concise first-person style bio in under 60 words.
Use practical fashion language and focus on taste, silhouettes, color preferences, and wardrobe gaps.
Do not mention AI or technology.

Items:
${items
  .map(
    (item, index) =>
      `${index + 1}. ${item.category}: ${item.description}. Tags: ${item.style_tags.join(", ")}`
  )
  .join("\n")}`;

    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return yield* parseJson(result.response.text(), "generateClosetBio");
  }).pipe(withRetries);

export { generateMaintainedStyleBio } from "./styleBio";

export const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};
