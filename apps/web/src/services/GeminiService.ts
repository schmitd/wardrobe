import { Effect, Context, Layer } from "effect";
import {
  GoogleGenerativeAI,
  GenerateContentRequest,
  GenerateContentResult,
  Part,
  BatchEmbedContentsRequest,
  BatchEmbedContentsResponse,
  EmbedContentResponse,
} from "@google/generative-ai";

export class GeminiError extends Error {
  readonly _tag = "GeminiError";
  readonly status: number | undefined;
  readonly retryable: boolean;
  constructor(public error: unknown) {
    super(error instanceof Error ? error.message : String(error));
    this.status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : undefined;
    this.retryable = this.status === 429 || (this.status !== undefined && this.status >= 500) || error instanceof TypeError;
  }
}

export type GeminiModelName =
  | "gemma-3-27b-it"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite";

export const GEMINI_FLASH_LITE_MODEL = "gemini-2.5-flash-lite" satisfies GeminiModelName;
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
export const GEMINI_EMBEDDING_DIMENSIONS = 768;

type EmbedContentRequestWithDimensions = {
  content: {
    role: string;
    parts: Part[];
  };
  output_dimensionality: typeof GEMINI_EMBEDDING_DIMENSIONS;
};

const isTemporaryModelCapacityError = (error: unknown) => {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  return (
    message.includes("503") ||
    /service unavailable|high demand|overloaded|temporarily unavailable/i.test(message)
  );
};

export interface GeminiService {
  readonly generateContent: (
    modelName: GeminiModelName,
    request: GenerateContentRequest | string | Array<string | Part>
  ) => Effect.Effect<GenerateContentResult, GeminiError>;

  readonly embedContent: (input: string | Part[]) => Effect.Effect<EmbedContentResponse, GeminiError>;

  readonly batchEmbedContents: (
    request: BatchEmbedContentsRequest
  ) => Effect.Effect<BatchEmbedContentsResponse, GeminiError>;
}

export const GeminiService = Context.Service<GeminiService>("GeminiService");

const make = Effect.gen(function* () {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return yield* Effect.fail(new GeminiError("Missing GEMINI_API_KEY"));
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const gemma27bModel = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });
  const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const flashLiteModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const embeddingModel = genAI.getGenerativeModel({ model: GEMINI_EMBEDDING_MODEL });

  const getModel = (name: GeminiModelName) => {
    switch (name) {
      case "gemma-3-27b-it":
        return gemma27bModel;
      case "gemini-2.5-pro":
        return proModel;
      case "gemini-2.5-flash":
        return flashModel;
      case "gemini-2.5-flash-lite":
      default:
        return flashLiteModel;
    }
  };

  return {
    generateContent: (
      modelName: GeminiModelName,
      request: GenerateContentRequest | string | Array<string | Part>
    ) =>
      Effect.tryPromise({
        try: async signal => {
          try {
            return await getModel(modelName).generateContent(request, { signal, timeout: 50_000 });
          } catch (error) {
            if (modelName === GEMINI_FLASH_LITE_MODEL && isTemporaryModelCapacityError(error)) {
              return flashModel.generateContent(request, { signal, timeout: 50_000 });
            }
            throw error;
          }
        },
        catch: (error) => new GeminiError(error),
      }).pipe(Effect.withSpan("gemini.generateContent", { attributes: { model: modelName } })),

    embedContent: (input: string | Part[]) =>
      Effect.tryPromise({
        try: signal => {
          const request = {
            content: { role: "user", parts: typeof input === "string" ? [{ text: input }] : input },
            output_dimensionality: GEMINI_EMBEDDING_DIMENSIONS,
          } satisfies EmbedContentRequestWithDimensions;
          return embeddingModel.embedContent(
            request as unknown as Parameters<typeof embeddingModel.embedContent>[0],
            { signal, timeout: 50_000 }
          );
        },
        catch: (error) => new GeminiError(error),
      }).pipe(Effect.withSpan("gemini.embedContent")),

    batchEmbedContents: (request: BatchEmbedContentsRequest) =>
      Effect.tryPromise({
        try: signal =>
          embeddingModel.batchEmbedContents({
            requests: request.requests.map((embeddingRequest) => ({
              ...embeddingRequest,
              output_dimensionality: GEMINI_EMBEDDING_DIMENSIONS,
            })),
          } as BatchEmbedContentsRequest, { signal, timeout: 50_000 }),
        catch: (error) => new GeminiError(error),
      }).pipe(Effect.withSpan("gemini.batchEmbedContents")),
  };
});

export const GeminiLive = Layer.effect(GeminiService, make);
