import { Data, Effect, Schema, Schedule } from "effect";

import { GeminiError, GeminiService } from "../../services/GeminiService";
import { modelResponses } from "./modelResponses";

export class ModelResponseError extends Data.TaggedError("ModelResponseError")<{ message: string; operation: string }> {}
export const parseJson = <L extends keyof typeof modelResponses>(text: string, label: L) => Effect.gen(function* () {
  const invalid = () => new ModelResponseError({ message: "The model returned an invalid response. Please try again.", operation: label });
  const json: unknown = yield* Effect.try({ try: () => JSON.parse(text.trim()), catch: invalid });
  return yield* Schema.decodeUnknownEffect(modelResponses[label])(json).pipe(Effect.mapError(invalid));
});

export const withRetries = <A, E, R>(effect: Effect.Effect<A, E, R>, attempts = 3) =>
  effect.pipe(Effect.retry({ times: attempts - 1, schedule: Schedule.exponential("500 millis"), while: error => error instanceof GeminiError && error.retryable }));

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

export const embedImage = (base64: string, mimeType: string, context?: string) =>
  Effect.gen(function* () {
    const gemini = yield* GeminiService;
    const parts = [
      ...(context ? [{ text: context }] : []),
      { inlineData: { data: base64, mimeType } },
    ];
    const result = yield* gemini.embedContent(parts);
    return result.embedding.values;
  }).pipe(withRetries);
