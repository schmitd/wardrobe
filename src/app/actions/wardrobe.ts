"use server";

import { Effect, Schedule } from "effect";
import { SchemaType, type Schema } from "@google/generative-ai";
import type { Id } from "@convex/_generated/dataModel";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

import { runServerAction } from "@/lib/run-effect";
import { publishJson } from "@/lib/qstash";
import { ensureTraceContext } from "@/lib/trace";
import { GeminiLive, GeminiService } from "@/services/GeminiService";
import {
  processWardrobeInference,
  USER_SAFE_INFERENCE_ERROR,
} from "@/server/wardrobeInference";

const getConvexAuth = async () => {
  const { userId, getToken } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const token = await getToken({
    template: process.env.CLERK_JWT_TEMPLATE ?? "convex",
  });
  if (!token) throw new Error("Missing Convex token");

  return { userId, token };
};

const fetchImageBase64 = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
};

const parseJson = <T>(text: string, label: string) =>
  Effect.try({
    try: () => JSON.parse(text) as T,
    catch: (error) => new Error(`${label} JSON parse failed: ${String(error)}`),
  });

const withRetries = <A, E, R>(effect: Effect.Effect<A, E, R>, attempts = 3) =>
  effect.pipe(Effect.retry(Schedule.recurs(attempts - 1)));

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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

    const prompt =
      "Analyze this clothing item. Extract 3-5 style tags, category, and description. Return JSON with keys in this order: style_tags, category, description.";

    const result = yield* gemini.generateContent("gemini-2.0-flash-lite", {
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

    return yield* parseJson<{ category: string; description: string; style_tags: string[] }>(
      result.response.text(),
      "analyzeImageFull"
    );
  }).pipe(withRetries);

const generateStyleQuery = (description: string, styleTags: string[]) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const prompt = `Given this clothing item description: "${description}" and style tags: "${styleTags.join(
      ", "
    )}", generate a search query to find compatible items in a wardrobe. Return just the query string.`;

    const result = yield* gemini.generateContent("gemini-2.0-flash-lite", prompt);
    return result.response.text().trim();
  }).pipe(withRetries);

const embedText = (text: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const result = yield* gemini.embedContent(text);
    return result.embedding.values;
  }).pipe(withRetries);

const evaluateCompatibility = (input: {
  candidate: { category: string; description: string; style_tags: string[] };
  similarItems: { category: string | null; description: string | null; similarity: number }[];
  dissimilarItems: { category: string | null; description: string | null; similarity: number }[];
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

    const result = yield* gemini.generateContent("gemini-2.0-flash-lite", {
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
        hair_color: { type: SchemaType.STRING },
        bio: { type: SchemaType.STRING },
      },
      required: ["skin_tone", "hair_color", "bio"],
    };

    const prompt =
      "Analyze this selfie for fashion profiling. Extract approximate skin tone (e.g., Fair, Medium, Deep) and hair color. Also suggest a short professional style bio. Return JSON: { skin_tone, hair_color, bio }.";

    const result = yield* gemini.generateContent("gemini-2.0-flash-lite", {
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

    return yield* parseJson<{ skin_tone: string; hair_color: string; bio: string }>(
      result.response.text(),
      "analyzeSelfie"
    );
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

    const result = yield* gemini.generateContent("gemini-2.0-flash-lite", {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return yield* parseJson<{ bio: string }>(result.response.text(), "generateClosetBio");
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
  const { userId, token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);

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
  const { userId, token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);

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
      api.wardrobe.applyEmbedding,
      { itemId: input.itemId as Id<"wardrobeItems">, embedding },
      { token }
    );

    await fetchMutation(
      api.wardrobe.setAnalysisStatus,
      { itemId: input.itemId as Id<"wardrobeItems">, status: "ready" },
      { token }
    );

    try {
      await publishJson(
        "/zep/sync",
        {
          type: "wardrobe_add",
          userId,
          itemId: input.itemId,
          traceId,
          traceparent,
        },
        traceparent ? { headers: { traceparent } } : undefined
      );
    } catch (error) {
      console.warn("zep.sync.enqueue.failed", {
        traceId,
        traceparent,
        itemId: input.itemId,
        message: toErrorMessage(error),
      });
    }

    return { success: true as const };
  } catch (error) {
    const errorMessage = toErrorMessage(error);
    try {
      await fetchMutation(
        api.wardrobe.setAnalysisError,
        { itemId: input.itemId as Id<"wardrobeItems">, error: errorMessage },
        { token }
      );
    } catch {
      // ignore
    }
    console.error("guest.import.seed.failed", {
      traceId,
      traceparent,
      itemId: input.itemId,
      message: errorMessage,
    });
    return { success: false as const, error: USER_SAFE_INFERENCE_ERROR };
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

  let item: { description?: string | null; category?: string | null } | null = null;
  try {
    const fetched = await fetchQuery(
      api.wardrobe.getWardrobeItem,
      { itemId: input.itemId as Id<"wardrobeItems"> },
      { token }
    );
    if (fetched && typeof fetched === "object") {
      const record = fetched as Record<string, unknown>;
      item = {
        description:
          typeof record.description === "string" ? record.description : null,
        category: typeof record.category === "string" ? record.category : null,
      };
    }
  } catch (error) {
    console.warn("wardrobe.delete.prefetch.failed", {
      traceId,
      traceparent,
      itemId: input.itemId,
      message: toErrorMessage(error),
    });
  }

  await fetchMutation(
    api.wardrobe.deleteWardrobeItem,
    { itemId: input.itemId as Id<"wardrobeItems">, reason: input.reason },
    { token }
  );

  try {
    await publishJson(
      "/zep/sync",
      {
        type: "wardrobe_delete",
        userId,
        description: item?.description ?? item?.category ?? "Unknown item",
        reason: input.reason,
        traceId,
        traceparent,
      },
      traceparent ? { headers: { traceparent } } : undefined
    );
  } catch (error) {
    console.warn("zep.sync.delete.failed", {
      traceId,
      traceparent,
      itemId: input.itemId,
      message: toErrorMessage(error),
    });
  }

  console.info("wardrobe.delete.request", { traceId, traceparent, itemId: input.itemId, userId });
  return { success: true };
};

export const updateProfileBioAction = async (input: {
  bio: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);

  await fetchMutation(api.profile.updateBio, { bio: input.bio }, { token });

  try {
    await publishJson(
      "/zep/sync",
      {
        type: "profile_update",
        userId,
        bio: input.bio,
        traceId,
        traceparent,
      },
      traceparent ? { headers: { traceparent } } : undefined
    );
  } catch (error) {
    console.warn("profile.zep.sync.failed", {
      traceId,
      traceparent,
      message: toErrorMessage(error),
    });
  }

  console.info("profile.update.request", { traceId, traceparent, userId });
  return { success: true };
};

export const processWardrobeItemAction = async (input: {
  itemId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = await getConvexAuth();
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

export const checkCompatibilityAction = async (input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = await getConvexAuth();
  const { traceId, traceparent } = ensureTraceContext(input);

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

  const embedding = await runServerAction(
    embedText(styleQuery).pipe(Effect.provide(GeminiLive))
  );

  const items = await fetchQuery(
    api.wardrobe.listItemsForSimilarity,
    { limit: 200 },
    { token }
  );

  const scored = items
    .filter((item) => Array.isArray(item.embedding))
    .map((item) => ({
      item,
      similarity: cosineSimilarity(embedding, item.embedding ?? []),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const similarItems = scored.slice(0, 5);
  const dissimilarItems = scored
    .slice()
    .reverse()
    .slice(0, 3)
    .filter((entry) => entry.similarity < 0.5);

  const displayItems = await fetchQuery(api.wardrobe.listWardrobeItems, {}, { token });
  const displayMap = new Map(displayItems.map((item) => [item.id, item]));

  const hydrate = (entry: (typeof similarItems)[number]) => {
    const display = displayMap.get(entry.item._id);
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

  const hydratedSimilar = similarItems
    .map(hydrate)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const hydratedDissimilar = dissimilarItems
    .map(hydrate)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (hydratedSimilar.length === 0 && hydratedDissimilar.length === 0) {
    return {
      candidate,
      similarItems: [],
      dissimilarItems: [],
      evaluation: null,
      message:
        "The item does not relate to any pieces in your wardrobe, but it also does not clash with existing items.",
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
    }).pipe(Effect.provide(GeminiLive))
  );

  return {
    candidate,
    similarItems: hydratedSimilar,
    dissimilarItems: hydratedDissimilar,
    evaluation,
  };
};

export const analyzeSelfieAction = async (input: {
  storageId: string;
  traceId?: string;
  traceparent?: string;
}) => {
  const { userId, token } = await getConvexAuth();
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
      bio: analysis.bio,
      skinTone: analysis.skin_tone,
      hairColor: analysis.hair_color,
    },
    { token }
  );

  try {
    await publishJson(
      "/zep/sync",
      {
        type: "profile_update",
        userId,
        bio: analysis.bio,
        skinTone: analysis.skin_tone,
        hairColor: analysis.hair_color,
        traceId,
        traceparent,
      },
      traceparent ? { headers: { traceparent } } : undefined
    );
  } catch (error) {
    console.warn("profile.zep.sync.failed", {
      traceId,
      traceparent,
      message: toErrorMessage(error),
    });
  }

  console.info("selfie.analyze.complete", { traceId, traceparent, userId });
  return analysis;
};

const GUEST_DEMO_ITEM_LIMIT = 4;
const GUEST_DEMO_MAX_IMAGE_BYTES = 1_500_000;
const GUEST_DEMO_MAX_TOTAL_BYTES = 4_000_000;
const GUEST_DEMO_MAX_FILENAME_LENGTH = 140;
const GUEST_DEMO_RATE_WINDOW_MS = 60_000;
const GUEST_DEMO_RATE_MAX_REQUESTS = 4;
const GUEST_DEMO_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const guestRequestWindow = new Map<string, { count: number; resetAt: number }>();

const extractBase64Payload = (value: string) => value.replace(/^data:.*;base64,/, "").replace(/\s+/g, "");

const estimateDecodedBytes = (base64: string) => {
  if (!base64 || !/^[a-zA-Z0-9+/=]+$/.test(base64)) {
    throw new Error("Invalid image encoding");
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

const getGuestRateLimitKey = async () => {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const realIp = requestHeaders.get("x-real-ip")?.trim();
    const userAgent = requestHeaders.get("user-agent")?.slice(0, 120);
    return forwardedFor || realIp || userAgent || "guest:unknown";
  } catch {
    return "guest:unknown";
  }
};

const enforceGuestRateLimit = async () => {
  const key = await getGuestRateLimitKey();
  const nowTs = Date.now();
  const existing = guestRequestWindow.get(key);

  if (!existing || existing.resetAt <= nowTs) {
    guestRequestWindow.set(key, {
      count: 1,
      resetAt: nowTs + GUEST_DEMO_RATE_WINDOW_MS,
    });
    return;
  }

  if (existing.count >= GUEST_DEMO_RATE_MAX_REQUESTS) {
    throw new Error("Guest demo is busy. Please wait a minute and try again.");
  }

  existing.count += 1;
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

export const analyzeGuestBatchAction = async (input: {
  items: { fileName: string; mimeType: string; base64: string }[];
  traceId?: string;
  traceparent?: string;
}) => {
  await enforceGuestRateLimit();
  const { traceId, traceparent } = ensureTraceContext(input);
  const cappedItems = input.items.slice(0, GUEST_DEMO_ITEM_LIMIT);
  const validatedItems = validateGuestBatchItems(cappedItems);

  if (validatedItems.length === 0) {
    throw new Error("No images provided");
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
    items: analyzed,
    suggestedBio: summary.bio,
    capped: input.items.length > GUEST_DEMO_ITEM_LIMIT,
    limit: GUEST_DEMO_ITEM_LIMIT,
  };
};
