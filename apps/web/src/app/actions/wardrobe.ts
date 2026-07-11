"use server";

import { Effect, Either } from "effect";
import { SchemaType, type Schema } from "@google/generative-ai";
import type { Id } from "@convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";
import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

import {
  DESCRIPTION_MAX_OUTPUT_TOKENS,
  ITEM_DESCRIPTION_WORD_LIMIT,
  STYLE_LABEL_MAX_OUTPUT_TOKENS,
  sanitizeStyleTags,
  truncateWords,
} from "@/lib/inferenceOutputGuards";
import { runServerAction } from "@/lib/run-effect";
import { ensureTraceContext } from "@/lib/trace";
import { ArcjetLive, ArcjetService } from "@/services/ArcjetService";
import {
  GEMINI_FLASH_LITE_MODEL,
  GeminiLive,
  GeminiService,
} from "@/services/GeminiService";
import {
  embedText,
  fetchImageBase64,
  parseJson,
  toErrorMessage,
  toInferenceFailure,
  withRetries,
} from "@/server/inference/shared";
import { processWardrobeInference } from "@/server/wardrobeInference";

type UserTier = "free" | "pro";
type AuthenticatedScope = "upload" | "check" | "inference";
type ConvexAuthContext = {
  userId: string;
  token: string;
  tier: UserTier;
};

const resolveUserTier = (has: Awaited<ReturnType<typeof auth>>["has"]): UserTier =>
  has?.({ permission: "compatibility_check" }) || has?.({ plan: "pro" }) ? "pro" : "free";

const enforceAuthenticatedProtection = async (input: {
  scope: AuthenticatedScope;
  tier: UserTier;
  userId: string;
}) =>
  runServerAction(
    ArcjetService.pipe(
      Effect.flatMap((arcjet) =>
        arcjet.protectAuthenticated({
          scope: input.scope,
          tier: input.tier,
          userId: input.userId,
        })
      ),
      Effect.provide(ArcjetLive)
    )
  );

const enforceGuestBatchProtection = () =>
  runServerAction(
    ArcjetService.pipe(
      Effect.flatMap((arcjet) => arcjet.protectGuestBatch()),
      Effect.provide(ArcjetLive)
    )
  );

const getConvexAuth = async () => {
  const { userId, getToken, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken({
    template: process.env.CLERK_JWT_TEMPLATE ?? "convex",
  });
  if (!token) throw new Error("Missing Convex token");

  return { userId, token, tier: resolveUserTier(has) };
};

const runBestEffort = async <A>(
  event: string,
  context: Record<string, string>,
  operation: () => Promise<A>
) => {
  const outcome = await runServerAction(
    Effect.tryPromise({ try: operation, catch: toErrorMessage }).pipe(Effect.either)
  );
  if (Either.isLeft(outcome)) {
    console.warn(event, { ...context, message: outcome.left });
    return undefined;
  }
  return outcome.right;
};

export const getUploadUrlAction = async () => {
  const { token } = await getConvexAuth();

  return fetchMutation(api.wardrobe.getUploadUrl, {}, { token });
};

const analyzeImageFull = (base64: string) =>
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

    const parsed = yield* parseJson<{ category: string; description: string; style_tags: string[] }>(
      result.response.text(),
      "analyzeImageFull"
    );

    return {
      category: truncateWords(parsed.category, 6),
      description: truncateWords(parsed.description, ITEM_DESCRIPTION_WORD_LIMIT),
      style_tags: sanitizeStyleTags(parsed.style_tags),
    };
  }).pipe(withRetries);

const analyzeInspirationImage = (base64: string) =>
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
    const parsed = yield* parseJson<{ category: string; description: string; style_tags: string[] }>(result.response.text(), "analyzeInspirationImage");
    return { category: truncateWords(parsed.category, 6), description: truncateWords(parsed.description, ITEM_DESCRIPTION_WORD_LIMIT), style_tags: sanitizeStyleTags(parsed.style_tags) };
  }).pipe(withRetries);

const generateStyleQuery = (description: string, styleTags: string[]) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const prompt = `Given this clothing item description: "${description}" and style tags: "${styleTags.join(
      ", "
    )}", generate a search query to find compatible items in a wardrobe. Return just the query string.`;

    const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, prompt);
    return result.response.text().trim();
  }).pipe(withRetries);

const evaluateCompatibility = (input: {
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

CANDIDATE ITEM:
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
- Do NOT evaluate the candidate item's internal consistency or standalone quality
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

    return yield* parseJson<{
      score: number;
      explanation: string;
      best_pairings: number[];
      worst_clashes: number[];
    }>(result.response.text(), "evaluateCompatibility");
  }).pipe(withRetries);

const analyzeSelfie = (base64: string) =>
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

    return yield* parseJson<{
      skin_tone: string;
      complexion: string;
      hair_color: string;
      color_season: string;
    }>(
      result.response.text(),
      "analyzeSelfie"
    );
  }).pipe(withRetries);

type FitCheckKind = "daily_fit_check" | "try_on";

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

type RecordFitCheckItemInput = {
  wardrobeItemId?: Id<"wardrobeItems">;
  source: "matched_existing" | "created_from_fit_check";
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
};

const normalizeBoundingBox = (box: DetectedFitCheckItem["bounding_box"]) => {
  if (!box) return undefined;
  const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return {
    x: clamp(box.x),
    y: clamp(box.y),
    width: clamp(box.width),
    height: clamp(box.height),
  };
};

const analyzeFitCheckPhoto = (base64: string, type: FitCheckKind) =>
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

    const prompt = `Analyze this full-body outfit photo for a ${type === "daily_fit_check" ? "daily fit check of what the user actually wore" : "try-on check of items the user tried on"}.
Return JSON only.
- transcription: one concise sentence describing the whole outfit.
- items: each visible worn garment, shoe, bag, or accessory.
- category: garment role such as top, bottom, outerwear, footwear, dress, accessory, bag, jewelry.
- description: concise visual description with color, silhouette, material/pattern if visible.
- style_tags: 3-5 concise tags, each at most 3 words.
- bounding_box: normalized coordinates from 0 to 1 around just that item, as { x, y, width, height }.
- confidence: 0 to 1.`;

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

    const parsed = yield* parseJson<{
      transcription: string;
      items: DetectedFitCheckItem[];
    }>(result.response.text(), "analyzeFitCheckPhoto");

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

const generateClosetBio = (items: { category: string; description: string; style_tags: string[] }[]) =>
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

    return yield* parseJson<{ bio: string }>(result.response.text(), "generateClosetBio");
  }).pipe(withRetries);

const generateMaintainedStyleBio = (input: {
  currentBio: string;
  manualAnchor: string;
  refreshReason: string;
  closetItems: { category: string | null; description: string | null; styleTags: string[] }[];
  recentFits: { type: string; description: string | null; createdAt: number }[];
  collections: { name: string; description: string | null; memberCount: number }[];
  graphFacts: string[];
}) => Effect.gen(function* () {
  const gemini = yield* GeminiService;
  const schema: Schema = {
    type: SchemaType.OBJECT,
    properties: { bio: { type: SchemaType.STRING } },
    required: ["bio"],
  };
  const prompt = `You maintain a living first-person style notebook for one person. Write 45-90 words about how they actually dress and what they are exploring.

Rules:
- Treat MANUAL ANCHOR as the user's own words. Preserve its voice, commitments, and specific preferences unless newer evidence directly contradicts them.
- Make an incremental edit to CURRENT BIO. Do not churn phrasing merely to sound fresh.
- Ground every claim in the supplied closet, fit diary, collections, or graph facts. Empty evidence means an honest starter note about building the closet, not invented taste.
- Describe clothing, color, silhouette, texture, repetition, outfit habits, and open style questions. Never sound like LinkedIn, a résumé, a brand manifesto, or a personality assessment.
- Never infer profession, status, competence, gender identity, or lifestyle from a selfie or appearance.
- Do not mention AI, graphs, data, uploads, or this prompt.

REFRESH REASON: ${input.refreshReason}
CURRENT BIO: ${input.currentBio || "(none yet)"}
MANUAL ANCHOR: ${input.manualAnchor || "(none yet)"}
CLOSET: ${JSON.stringify(input.closetItems)}
RECENT FITS: ${JSON.stringify(input.recentFits)}
COLLECTIONS: ${JSON.stringify(input.collections)}
GRAPH FACTS: ${JSON.stringify(input.graphFacts)}`;

  const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema },
  });
  return yield* parseJson<{ bio: string }>(result.response.text(), "generateMaintainedStyleBio");
}).pipe(withRetries);

const cosineSimilarity = (a: number[], b: number[]) => {
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

export const createWardrobeItemAction = async (input: {
  storageId: string;
  clientFileName?: string;
  contentType?: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token, tier } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);
  await enforceAuthenticatedProtection({ scope: "upload", tier, userId });

  const result = await fetchMutation(
    api.wardrobe.createWardrobeItem,
    {
      storageId: input.storageId as Id<"_storage">,
      clientFileName: input.clientFileName,
      contentType: input.contentType,
      traceId,
      traceparent,
    },
    { token }
  );

  console.info("wardrobe.create.request", { traceId, traceparent, itemId: result.id, userId });
  return result;
};

export const seedWardrobeItemFromGuestAction = async (input: {
  itemId: string;
  category?: string | null;
  description: string;
  styleTags: string[];
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token, tier } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);
  await enforceAuthenticatedProtection({ scope: "inference", tier, userId });

  try {
    await fetchMutation(
      api.wardrobe.setAnalysisStatus,
      { itemId: input.itemId as Id<"wardrobeItems">, status: "processing_embedding" },
      { token }
    );

    await fetchMutation(
      api.wardrobe.applyTags,
      {
        itemId: input.itemId as Id<"wardrobeItems">,
        category: input.category ?? null,
        styleTags: input.styleTags,
      },
      { token }
    );

    await fetchMutation(
      api.wardrobe.applyDescription,
      {
        itemId: input.itemId as Id<"wardrobeItems">,
        category: input.category ?? null,
        description: input.description,
      },
      { token }
    );

    const embedding = await runServerAction(
      embedText(`${input.description} ${input.styleTags.join(" ")}`.trim()).pipe(
        Effect.withSpan("action.seedWardrobeItemFromGuest", {
          attributes: { userId, itemId: input.itemId },
        }),
        Effect.provide(GeminiLive)
      )
    );

    await fetchMutation(
      api.wardrobe.applyFullAnalysis,
      {
        itemId: input.itemId as Id<"wardrobeItems">,
        category: input.category ?? null,
        description: input.description,
        styleTags: input.styleTags,
        embedding,
        traceId,
        traceparent,
      },
      { token }
    );

    return { success: true as const };
  } catch (error) {
    const failure = toInferenceFailure(error);
    try {
      await fetchMutation(
        api.wardrobe.setAnalysisError,
        { itemId: input.itemId as Id<"wardrobeItems">, error: failure.userMessage },
        { token }
      );
    } catch {
      // ignore
    }
    console.error("guest.import.seed.failed", {
      traceId,
      traceparent,
      itemId: input.itemId,
      code: failure.code,
      message: failure.message,
    });
    return { success: false as const, error: failure.userMessage };
  }
};

export const deleteWardrobeItemAction = async (input: {
  itemId: string;
  reason: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);

  await fetchMutation(
    api.wardrobe.deleteWardrobeItem,
    {
      itemId: input.itemId as Id<"wardrobeItems">,
      reason: input.reason,
      traceId,
      traceparent,
    },
    { token }
  );

  console.info("wardrobe.delete.request", { traceId, traceparent, itemId: input.itemId, userId });
  return { success: true };
};

export const updateProfileBioAction = async (input: {
  bio: string;
  source?: "manual" | "guest_import";
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);

  await fetchMutation(
    api.profile.updateBio,
    { bio: input.bio, ...(input.source ? { source: input.source } : {}), traceId, traceparent },
    { token }
  );

  console.info("profile.update.request", { traceId, traceparent, userId });
  return { success: true };
};

export const processWardrobeItemAction = async (input: {
  itemId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token, tier } = await getConvexAuth();
  await enforceAuthenticatedProtection({ scope: "inference", tier, userId });
  const { traceId, traceparent } = ensureTraceContext(input);

  console.info("inference.start", { traceId, traceparent, itemId: input.itemId, userId });

  const result = await processWardrobeInference({
    itemId: input.itemId,
    userId,
    token,
    traceId,
    traceparent,
  });

  if (!result.success) {
    console.error("inference.error", {
      traceId,
      traceparent,
      itemId: input.itemId,
      message: result.error,
    });
    return result;
  }

  console.info("inference.complete", { traceId, traceparent, itemId: input.itemId, userId });
  return result;
};

export const checkCompatibilityForAuth = async (
  authContext: ConvexAuthContext,
  input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token, tier } = authContext;
  const { traceId, traceparent } = ensureTraceContext(input);
  await enforceAuthenticatedProtection({ scope: "check", tier, userId });

  console.info("compatibility.start", { traceId, traceparent, userId });

  // Quick-compare uploads aren't attached to a wardrobe item, so we explicitly
  // register them to authorize retrieval via `storage.getStorageUrl`.
  await fetchMutation(
    api.storage.registerUpload,
    { storageId: input.storageId as Id<"_storage">, purpose: "quick_compare" },
    { token }
  );

  const imageUrl = await fetchQuery(
    api.storage.getStorageUrl,
    { storageId: input.storageId as Id<"_storage"> },
    { token }
  );

  if (!imageUrl) {
    throw new Error("Uploaded file missing");
  }

  const base64 = await fetchImageBase64(imageUrl);

  const candidate = await runServerAction(
    analyzeImageFull(base64).pipe(Effect.provide(GeminiLive))
  );

  const styleQuery = await runServerAction(
    generateStyleQuery(candidate.description, candidate.style_tags).pipe(
      Effect.provide(GeminiLive)
    )
  );

  let memoryContext: Array<{ fact: string; relation: string; relevance: number | null }> = [];
  try {
    memoryContext = await fetchAction(api.zepSync.searchStyleContext, { query: styleQuery, traceId, traceparent }, { token });
  } catch (error) {
    console.warn("zep.search.style_context.failed", { traceId, traceparent, userId, message: error instanceof Error ? error.message : String(error) });
  }

  const embedding = await runServerAction(
    embedText(styleQuery).pipe(Effect.provide(GeminiLive))
  );

  const similarResults = await fetchAction(
    api.wardrobe.searchSimilarItems,
    { embedding, limit: 5 },
    { token }
  );

  const items = await fetchQuery(
    api.wardrobe.listItemsForSimilarity,
    { limit: 200 },
    { token }
  );

  const similarIds = new Set(similarResults.map((entry) => String(entry._id)));
  const scored = items
    .filter((item) => Array.isArray(item.embedding))
    .filter((item) => !similarIds.has(String(item._id)))
    .map((item) => ({
      item,
      similarity: cosineSimilarity(embedding, item.embedding ?? []),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const dissimilarItems = scored
    .slice()
    .reverse()
    .slice(0, 3)
    .filter((entry) => entry.similarity < 0.5);

  const displayItems = await fetchQuery(
    api.wardrobe.getWardrobeItemsDisplayByIds,
    {
      itemIds: [
        ...similarResults.map((entry) => entry._id),
        ...dissimilarItems.map((entry) => entry.item._id),
      ],
    },
    { token }
  );
  const displayMap = new Map(displayItems.map((item) => [item.id, item]));

  const hydrate = (entry: { itemId: Id<"wardrobeItems">; similarity: number }) => {
    const display = displayMap.get(entry.itemId);
    if (!display) return null;
    return {
      id: display.id,
      imageUrl: display.imageUrl,
      category: display.category ?? null,
      description: display.description ?? null,
      styleTags: display.styleTags ?? null,
      similarity: entry.similarity,
    };
  };

  const hydratedSimilar = similarResults
    .map((entry) => ({ itemId: entry._id, similarity: entry._score }))
    .map(hydrate)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const hydratedDissimilar = dissimilarItems
    .map((entry) => ({ itemId: entry.item._id, similarity: entry.similarity }))
    .map(hydrate)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const rememberTryOn = (description: string) => fetchMutation(
    api.fitChecks.recordFitCheck,
    {
      storageId: input.storageId as Id<"_storage">,
      type: "try_on" as const,
      description,
      transcription: candidate.description,
      items: [{ source: "transcribed_only" as const, category: candidate.category, description: candidate.description, styleTags: candidate.style_tags }],
      traceId,
      traceparent,
    },
    { token }
  );

  if (hydratedSimilar.length === 0 && hydratedDissimilar.length === 0) {
    const message = "This piece opens a new direction. There is no close closet anchor yet, but it does not directly clash with what you own.";
    const fitCheck = await rememberTryOn(message);
    if (fitCheck.created) try {
      await fetchAction(
        api.zepSync.syncCandidateComparison,
        {
          candidate: {
            category: candidate.category,
            description: candidate.description,
            styleTags: candidate.style_tags,
          },
          storageId: input.storageId,
          evaluation: null,
          similarItems: [],
          dissimilarItems: [],
          traceId,
          traceparent,
        },
        { token }
      );
    } catch (error) {
      console.warn("zep.sync.candidate_comparison.enqueue_failed", {
        traceId,
        traceparent,
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      storageId: input.storageId,
      fitCheckId: fitCheck.id,
      candidate,
      similarItems: [],
      dissimilarItems: [],
      evaluation: null,
      message,
    };
  }

  const evaluation = await runServerAction(
    evaluateCompatibility({
      candidate,
      similarItems: hydratedSimilar.map((entry) => ({
        category: entry.category,
        description: entry.description,
        similarity: entry.similarity,
      })),
      dissimilarItems: hydratedDissimilar.map((entry) => ({
        category: entry.category,
        description: entry.description,
        similarity: entry.similarity,
      })),
      memoryContext,
    }).pipe(Effect.provide(GeminiLive))
  );

  const fitCheck = await rememberTryOn(evaluation.explanation);
  if (fitCheck.created) try {
    await fetchAction(
      api.zepSync.syncCandidateComparison,
      {
        candidate: {
          category: candidate.category,
          description: candidate.description,
          styleTags: candidate.style_tags,
        },
        storageId: input.storageId,
        evaluation,
        similarItems: hydratedSimilar.map((item) => ({
          itemId: item.id,
          category: item.category,
          description: item.description,
          styleTags: item.styleTags,
        })),
        dissimilarItems: hydratedDissimilar.map((item) => ({
          itemId: item.id,
          category: item.category,
          description: item.description,
          styleTags: item.styleTags,
        })),
        traceId,
        traceparent,
      },
      { token }
    );
  } catch (error) {
    console.warn("zep.sync.candidate_comparison.enqueue_failed", {
      traceId,
      traceparent,
      userId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    storageId: input.storageId,
    fitCheckId: fitCheck.id,
    candidate,
    similarItems: hydratedSimilar,
    dissimilarItems: hydratedDissimilar,
    evaluation,
  };
};

export const checkCompatibilityAction = async (input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => checkCompatibilityForAuth(await getConvexAuth(), input);

const normalizeSourceUrl = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Source URL must use http or https");
  return url.toString();
};

export const saveInspirationForAuth = async (
  authContext: ConvexAuthContext,
  input: {
    wardrobeId: string; storageId?: string; sourceUrl?: string; sourceLabel?: string;
    note?: string; candidate?: { category: string; description: string; style_tags: string[] };
    traceId?: string; traceparent?: string;
  }
) => {
  const { userId, token, tier } = authContext;
  const { traceId, traceparent } = ensureTraceContext(input);
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  if (!input.storageId && !sourceUrl) throw new Error("Add an image or source URL");
  const candidate = input.candidate;
  if (input.storageId) {
    await fetchMutation(api.storage.registerUpload, { storageId: input.storageId as Id<"_storage">, purpose: "inspiration" }, { token });
  }
  const description = input.note?.trim() || candidate?.description || sourceUrl || "Saved visual reference";
  const category = candidate?.category || "Visual reference";
  const styleTags = candidate?.style_tags ?? [];
  const embedding = candidate
    ? await runServerAction(embedText(`${category} ${description} ${styleTags.join(" ")}`).pipe(Effect.provide(GeminiLive)))
    : undefined;
  const saved = await fetchMutation(api.candidates.createInspiration, {
    wardrobeId: input.wardrobeId as Id<"wardrobes">,
    ...(input.storageId ? { storageId: input.storageId as Id<"_storage"> } : {}),
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(input.sourceLabel?.trim() ? { sourceLabel: input.sourceLabel.trim() } : {}),
    category, description, styleTags, ...(embedding ? { embedding } : {}), traceId, traceparent,
  }, { token });
  if (!candidate && input.storageId) {
    await runBestEffort("inspiration.enrichment.failed", { traceId, userId }, async () => {
      await enforceAuthenticatedProtection({ scope: "inference", tier, userId });
      const imageUrl = await fetchQuery(api.storage.getStorageUrl, { storageId: input.storageId as Id<"_storage"> }, { token });
      if (!imageUrl) throw new Error("Uploaded file missing");
      const analysis = await runServerAction(analyzeInspirationImage(await fetchImageBase64(imageUrl)).pipe(Effect.provide(GeminiLive)));
      const semanticEmbedding = await runServerAction(embedText(`${analysis.category} ${analysis.description} ${analysis.style_tags.join(" ")}`).pipe(Effect.provide(GeminiLive)));
      await fetchMutation(api.candidates.enrichInspiration, {
        candidateItemId: saved.id,
        category: analysis.category,
        description: analysis.description,
        styleTags: analysis.style_tags,
        embedding: semanticEmbedding,
        traceId,
        traceparent,
      }, { token });
    });
  }
  return saved;
};

export const saveInspirationAction = async (input: Parameters<typeof saveInspirationForAuth>[1]) =>
  saveInspirationForAuth(await getConvexAuth(), input);

export const enrichInspirationAction = async (input: {
  candidateItemId: string;
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token, tier } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);
  const enriched = await runBestEffort("inspiration.enrichment.failed", { traceId, userId }, async () => {
    await enforceAuthenticatedProtection({ scope: "inference", tier, userId });
    const imageUrl = await fetchQuery(api.storage.getStorageUrl, { storageId: input.storageId as Id<"_storage"> }, { token });
    if (!imageUrl) throw new Error("Uploaded file missing");
    const analysis = await runServerAction(analyzeInspirationImage(await fetchImageBase64(imageUrl)).pipe(Effect.provide(GeminiLive)));
    const embedding = await runServerAction(embedText(`${analysis.category} ${analysis.description} ${analysis.style_tags.join(" ")}`).pipe(Effect.provide(GeminiLive)));
    return fetchMutation(api.candidates.enrichInspiration, {
      candidateItemId: input.candidateItemId as Id<"candidateItems">,
      category: analysis.category,
      description: analysis.description,
      styleTags: analysis.style_tags,
      embedding,
      traceId,
      traceparent,
    }, { token });
  });
  return enriched ?? { success: false as const };
};

export const analyzeSelfieForAuth = async (
  authContext: Pick<ConvexAuthContext, "userId" | "token">,
  input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = authContext;
  const { traceId, traceparent } = ensureTraceContext(input);

  console.info("selfie.analyze.start", { traceId, traceparent, userId });

  await fetchMutation(
    api.storage.registerUpload,
    { storageId: input.storageId as Id<"_storage">, purpose: "selfie" },
    { token }
  );

  const imageUrl = await fetchQuery(
    api.storage.getStorageUrl,
    { storageId: input.storageId as Id<"_storage"> },
    { token }
  );

  if (!imageUrl) {
    throw new Error("Uploaded file missing");
  }

  const base64 = await fetchImageBase64(imageUrl);

  const analysis = await runServerAction(
    analyzeSelfie(base64).pipe(Effect.provide(GeminiLive))
  );

  await fetchMutation(
    api.profile.updateProfileAttributes,
    {
      skinTone: analysis.skin_tone,
      hairColor: analysis.hair_color,
      ...(analysis.complexion ? { complexion: analysis.complexion } : {}),
      ...(analysis.color_season ? { colorSeason: analysis.color_season } : {}),
      traceId,
      traceparent,
    },
    { token }
  );

  console.info("selfie.analyze.complete", { traceId, traceparent, userId });
  return analysis;
};

export const refreshStyleBioAction = async (input: {
  force?: boolean;
  traceId?: string;
  traceparent?: string;
} = {}) => {
  const { token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);
  const context = await fetchQuery(api.profile.getStyleBioContext, {}, { token });
  if (!context) throw new Error("Unauthorized");
  if (!input.force && !context.shouldRefresh) {
    return { updated: false as const, reason: context.refreshReason, bio: context.profile?.bio ?? "" };
  }

  let graphFacts: string[] = [];
  try {
    graphFacts = await fetchAction(api.zepSync.getStyleBioGraphContext, {}, { token });
  } catch (error) {
    console.warn("style_bio.graph_context.unavailable", { traceId, message: toErrorMessage(error) });
  }

  const currentBio = context.profile?.bio ?? "";
  const manualAnchor = context.profile?.bioManualAnchor ?? "";
  const generated = context.counts.closetItemCount === 0 && context.counts.fitCheckCount === 0 && context.counts.collectionCount === 0
    ? { bio: manualAnchor || currentBio || "I'm building a clearer picture of what I like to wear. As my closet and outfit notes grow, this space will track the colors, shapes, textures, and combinations I return to without guessing ahead of the evidence." }
    : await runServerAction(generateMaintainedStyleBio({
        currentBio,
        manualAnchor,
        refreshReason: context.refreshReason,
        closetItems: context.closetItems,
        recentFits: context.recentFits,
        collections: context.collections,
        graphFacts,
      }).pipe(Effect.provide(GeminiLive)));

  const saved = await fetchMutation(api.profile.saveGeneratedBio, {
    bio: truncateWords(generated.bio, 110),
    reason: context.refreshReason,
    contextFingerprint: context.fingerprint,
    ...context.counts,
    ...(context.profile?.bioRevisionId ? { baseRevisionId: context.profile.bioRevisionId } : {}),
    traceId,
    traceparent,
  }, { token });

  return saved.success
    ? { updated: true as const, reason: context.refreshReason, bio: generated.bio }
    : { updated: false as const, reason: saved.reason, bio: context.profile?.bio ?? "" };
};

export const analyzeSelfieAction = async (input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => analyzeSelfieForAuth(await getConvexAuth(), input);

export const recordFitCheckForAuth = async (
  authContext: Pick<ConvexAuthContext, "userId" | "token" | "tier">,
  input: {
    storageId: string;
    type: FitCheckKind;
    traceId?: string;
    traceparent?: string;
  }
) => {
  const { userId, token, tier } = authContext;
  const { traceId, traceparent } = ensureTraceContext(input);
  await enforceAuthenticatedProtection({ scope: "inference", tier, userId });

  console.info("fit_check.analyze.start", { traceId, traceparent, userId, type: input.type });

  await fetchMutation(
    api.storage.registerUpload,
    { storageId: input.storageId as Id<"_storage">, purpose: input.type },
    { token }
  );

  const recorded = await runBestEffort("fit_check.analysis.failed", { traceId, userId }, async () => {
    const imageUrl = await fetchQuery(
      api.storage.getStorageUrl,
      { storageId: input.storageId as Id<"_storage"> },
      { token }
    );
    if (!imageUrl) throw new Error("Uploaded file missing");

    const base64 = await fetchImageBase64(imageUrl);
    const analysis = await runServerAction(
      analyzeFitCheckPhoto(base64, input.type).pipe(Effect.provide(GeminiLive))
    );
    const items: RecordFitCheckItemInput[] = [];
    for (const item of analysis.items) {
      const embedding = await runServerAction(
        embedText(`${item.description} ${item.style_tags.join(" ")}`.trim()).pipe(
          Effect.provide(GeminiLive)
        )
      );
      const matches = await fetchAction(
        api.wardrobe.searchSimilarItems,
        { embedding, limit: 1 },
        { token }
      );
      const bestMatch = matches[0];
      const matchedExisting = bestMatch && bestMatch._score >= 0.78;
      items.push({
        source: matchedExisting ? ("matched_existing" as const) : ("created_from_fit_check" as const),
        category: item.category,
        description: item.description,
        styleTags: item.style_tags,
        ...(matchedExisting ? { wardrobeItemId: bestMatch._id } : {}),
        ...(item.bounding_box ? { boundingBox: item.bounding_box } : {}),
        ...(item.confidence !== undefined ? { confidence: item.confidence } : {}),
        ...(matchedExisting ? {} : { embedding }),
      });
    }
    const saved = await fetchMutation(
      api.fitChecks.recordFitCheck,
      { storageId: input.storageId as Id<"_storage">, type: input.type, transcription: analysis.transcription, items, traceId, traceparent },
      { token }
    );
    return { ...saved, transcription: analysis.transcription };
  });

  if (!recorded) {
    if (input.type !== "daily_fit_check") {
      throw new Error("Try-on analysis failed");
    }
    const saved = await fetchMutation(
      api.fitChecks.recordFitCheck,
      {
        storageId: input.storageId as Id<"_storage">,
        type: input.type,
        description: "Visual analysis is pending.",
        items: [],
        traceId,
        traceparent,
      },
      { token }
    );
    console.info("fit_check.recorded_without_analysis", { traceId, traceparent, userId, fitCheckId: saved.id });
    return { ...saved, transcription: "" };
  }

  console.info("fit_check.analyze.complete", {
    traceId,
    traceparent,
    userId,
    type: input.type,
    fitCheckId: recorded.id,
    itemCount: recorded.items.length,
  });

  return {
    ...recorded,
  };
};

export const recordDailyFitCheckAction = async (input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) =>
  recordFitCheckForAuth(await getConvexAuth(), {
    ...input,
    type: "daily_fit_check",
  });

export const recordTryOnFitCheckAction = async (input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) =>
  recordFitCheckForAuth(await getConvexAuth(), {
    ...input,
    type: "try_on",
  });

const GUEST_DEMO_ITEM_LIMIT = 4;
const GUEST_DEMO_MAX_IMAGE_BYTES = 1_500_000;
const GUEST_DEMO_MAX_TOTAL_BYTES = 4_000_000;
const GUEST_DEMO_MAX_FILENAME_LENGTH = 140;
const GUEST_DEMO_LIMIT_MESSAGE = "Demo paused at the free limit. Continue by signing up or signing in.";
const GUEST_DEMO_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const extractBase64Payload = (value: string) => value.replace(/^data:.*;base64,/, "").replace(/\s+/g, "");

const estimateDecodedBytes = (base64: string) => {
  if (!base64 || !/^[a-zA-Z0-9+/=]+$/.test(base64)) {
    throw new Error("Invalid image encoding");
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const validateGuestBatchItems = (items: { fileName: string; mimeType: string; base64: string }[]) => {
  let totalBytes = 0;

  return items.map((item) => {
    const fileName = item.fileName.trim();
    if (!fileName || fileName.length > GUEST_DEMO_MAX_FILENAME_LENGTH) {
      throw new Error("Invalid file name");
    }

    if (!GUEST_DEMO_ALLOWED_MIME_TYPES.has(item.mimeType)) {
      throw new Error(`Unsupported image type: ${item.mimeType}`);
    }

    const normalizedBase64 = extractBase64Payload(item.base64);
    const decodedBytes = estimateDecodedBytes(normalizedBase64);
    if (decodedBytes === 0 || decodedBytes > GUEST_DEMO_MAX_IMAGE_BYTES) {
      throw new Error("Each image must be under 1.5MB after compression");
    }

    totalBytes += decodedBytes;
    if (totalBytes > GUEST_DEMO_MAX_TOTAL_BYTES) {
      throw new Error("Total upload size is too large for guest demo");
    }

    return {
      fileName,
      mimeType: item.mimeType,
      normalizedBase64,
    };
  });
};

export type GuestBatchAnalysisResult =
  | {
      kind: "ok";
      items: { fileName: string; category: string; description: string; styleTags: string[] }[];
      suggestedBio: string;
      capped: boolean;
      limit: number;
    }
  | {
      kind: "limit";
      message: string;
      limit: number;
    };

export const analyzeGuestBatchAction = async (input: {
  items: { fileName: string; mimeType: string; base64: string }[];
  traceId?: string;
  traceparent?: string;
}): Promise<GuestBatchAnalysisResult> => {
  const { traceId, traceparent } = ensureTraceContext(input);
  const cappedItems = input.items.slice(0, GUEST_DEMO_ITEM_LIMIT);
  const validatedItems = validateGuestBatchItems(cappedItems);

  if (validatedItems.length === 0) {
    throw new Error("No images provided");
  }
  try {
    await enforceGuestBatchProtection();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      kind: "limit",
      message: /automated traffic/i.test(message) ? message : GUEST_DEMO_LIMIT_MESSAGE,
      limit: GUEST_DEMO_ITEM_LIMIT,
    };
  }

  const analyzed = [];
  for (const item of validatedItems) {
    const analysis = await runServerAction(
      analyzeImageFull(item.normalizedBase64).pipe(Effect.provide(GeminiLive))
    );
    analyzed.push({
      fileName: item.fileName,
      category: analysis.category,
      description: analysis.description,
      styleTags: analysis.style_tags,
    });
  }

  const summary = await runServerAction(
    generateClosetBio(
      analyzed.map((item) => ({
        category: item.category,
        description: item.description,
        style_tags: item.styleTags,
      }))
    ).pipe(Effect.provide(GeminiLive))
  );

  console.info("guest.demo.complete", {
    traceId,
    traceparent,
    itemCount: cappedItems.length,
    capped: input.items.length > GUEST_DEMO_ITEM_LIMIT,
  });

  return {
    kind: "ok",
    items: analyzed,
    suggestedBio: summary.bio,
    capped: input.items.length > GUEST_DEMO_ITEM_LIMIT,
    limit: GUEST_DEMO_ITEM_LIMIT,
  };
};
