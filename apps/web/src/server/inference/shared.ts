import { Effect, Schedule } from "effect";

import { GeminiService } from "@/services/GeminiService";

export const parseJson = <T>(text: string, label: string) =>
  Effect.try({
    try: () => {
      const trimmed = text.trim();
      if (!trimmed) {
        throw new Error("empty response text");
      }

      return JSON.parse(trimmed) as T;
    },
    catch: (error) => new Error(`${label} JSON parse failed: ${String(error)}`),
  });

export const withRetries = <A, E, R>(effect: Effect.Effect<A, E, R>, attempts = 3) =>
  effect.pipe(Effect.retry(Schedule.recurs(attempts - 1)));

export const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const toInferenceFailure = (error: unknown) => {
  const message = toErrorMessage(error);
  return {
    code: "inference_failed",
    message,
    userMessage: "Failed to process this item right now. Please try again.",
  } as const;
};

export const fetchImageBase64 = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
};

export const embedText = (text: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const result = yield* gemini.embedContent(text);
    return result.embedding.values;
  }).pipe(withRetries);
