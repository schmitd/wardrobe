import { Effect, Schedule } from "effect";
import { SchemaType, type Schema } from "@google/generative-ai";
import type { Id } from "@convex/_generated/dataModel";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { runServerAction } from "@/lib/run-effect";
import { publishJson } from "@/lib/qstash";
import { GeminiLive, GeminiService } from "@/services/GeminiService";

const parseJson = <T>(text: string, label: string) =>
  Effect.try({
    try: () => JSON.parse(text) as T,
    catch: (error) => new Error(`${label} JSON parse failed: ${String(error)}`),
  });

const withRetries = <A, E, R>(effect: Effect.Effect<A, E, R>, attempts = 3) =>
  effect.pipe(Effect.retry(Schedule.recurs(attempts - 1)));

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const fetchImageBase64 = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
};

const fetchWithRetry = async <T>(
  fn: () => Promise<T>,
  opts: { attempts: number; delayMs: number; shouldRetry: (error: unknown) => boolean }
) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < opts.attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === opts.attempts - 1 || !opts.shouldRetry(error)) break;
      await sleep(opts.delayMs * (attempt + 1));
    }
  }
  throw lastError;
};

const analyzeImageTags = (base64: string) =>
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
      },
      required: ["style_tags"],
    };

    const result = yield* gemini.generateContent("gemini-2.0-flash-lite", {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Analyze this clothing item. Return JSON with style_tags first (3-5 strings), then category.",
            },
            { inlineData: { data: base64, mimeType: "image/jpeg" } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return yield* parseJson<{ category?: string; style_tags: string[] }>(
      result.response.text(),
      "analyzeImageTags"
    );
  }).pipe(withRetries);

const analyzeImageDescription = (
  base64: string,
  context?: { category?: string | null; styleTags?: string[] | null }
) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const schema: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        category: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
      },
      required: ["description"],
    };

    const contextTags = context?.styleTags?.length
      ? `Style tags so far: ${context.styleTags.join(", ")}.`
      : "";
    const contextCategory = context?.category
      ? `Category so far: ${context.category}.`
      : "";

    const prompt = `Analyze this clothing item and return JSON with category and description. ${contextTags} ${contextCategory}`.trim();

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

    return yield* parseJson<{ category?: string; description: string }>(
      result.response.text(),
      "analyzeImageDescription"
    );
  }).pipe(withRetries);

const embedText = (text: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const result = yield* gemini.embedContent(text);
    return result.embedding.values;
  }).pipe(withRetries);

export const USER_SAFE_INFERENCE_ERROR =
  "Failed to process this item right now. Please try again.";

export type InferenceProgressStage =
  | "fetching_image"
  | "analyzing_tags"
  | "analyzing_description"
  | "embedding"
  | "persisting";

type ProcessWardrobeInferenceInput = {
  itemId: string;
  userId: string;
  token: string;
  traceId: string;
  traceparent: string;
  onProgress?: (stage: InferenceProgressStage) => void | Promise<void>;
  onTags?: (data: { category: string | null; styleTags: string[] }) => void | Promise<void>;
  onDescription?: (data: { category: string | null; description: string }) => void | Promise<void>;
};

export const processWardrobeInference = async ({
  itemId,
  userId,
  token,
  traceId,
  traceparent,
  onProgress,
  onTags,
  onDescription,
}: ProcessWardrobeInferenceInput): Promise<
  { success: true } | { success: false; error: string }
> => {
  try {
    const item = await fetchWithRetry(
      () =>
        fetchQuery(
          api.wardrobe.getWardrobeItemWithUrl,
          { itemId: itemId as Id<"wardrobeItems"> },
          { token }
        ),
      {
        attempts: 5,
        delayMs: 250,
        shouldRetry: (error) => toErrorMessage(error).toLowerCase().includes("image not available"),
      }
    );

    if (!item || item.userId !== userId) {
      throw new Error("Not found");
    }

    await onProgress?.("fetching_image");
    const base64 = await fetchWithRetry(() => fetchImageBase64(item.imageUrl), {
      attempts: 3,
      delayMs: 300,
      shouldRetry: (error) => {
        const msg = toErrorMessage(error).toLowerCase();
        return msg.includes("image fetch failed") || msg.includes("fetch failed") || msg.includes("timeout");
      },
    });

    await onProgress?.("analyzing_tags");
    const tagResult = await runServerAction(
      analyzeImageTags(base64).pipe(
        Effect.withSpan("inference.analyzeTags", {
          attributes: { userId, itemId },
        }),
        Effect.provide(GeminiLive)
      )
    );
    const resolvedCategory = tagResult.category ?? null;
    await onTags?.({
      category: resolvedCategory,
      styleTags: tagResult.style_tags,
    });

    await onProgress?.("analyzing_description");
    const detailResult = await runServerAction(
      analyzeImageDescription(base64, {
        category: resolvedCategory,
        styleTags: tagResult.style_tags,
      }).pipe(Effect.provide(GeminiLive))
    );
    const finalCategory = detailResult.category ?? resolvedCategory;
    await onDescription?.({
      category: finalCategory,
      description: detailResult.description,
    });

    await onProgress?.("embedding");
    const embedding = await runServerAction(
      embedText(`${detailResult.description} ${tagResult.style_tags.join(" ")}`.trim()).pipe(
        Effect.provide(GeminiLive)
      )
    );

    await onProgress?.("persisting");
    await fetchMutation(
      api.wardrobe.applyFullAnalysis,
      {
        itemId: itemId as Id<"wardrobeItems">,
        category: finalCategory,
        description: detailResult.description,
        styleTags: tagResult.style_tags,
        embedding,
      },
      { token }
    );

    try {
      await publishJson(
        "/zep/sync",
        {
          type: "wardrobe_add",
          userId,
          itemId,
          traceId,
          traceparent,
        },
        traceparent ? { headers: { traceparent } } : undefined
      );
    } catch (error) {
      console.warn("zep.sync.enqueue.failed", {
        traceId,
        traceparent,
        itemId,
        message: toErrorMessage(error),
      });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = toErrorMessage(error);

    try {
      await fetchMutation(
        api.wardrobe.setAnalysisError,
        { itemId: itemId as Id<"wardrobeItems">, error: errorMessage },
        { token }
      );
    } catch {
      // ignore secondary failures
    }

    return { success: false, error: USER_SAFE_INFERENCE_ERROR };
  }
};
