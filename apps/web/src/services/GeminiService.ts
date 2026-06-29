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
  constructor(public error: unknown) {
    super(
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message: string }).message
        : String(error)
    );
  }
}

export type GeminiModelName =
  | "gemma-3-27b-it"
  | "gemini-3.1-flash-lite"
  | "gemini-2.5-pro"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-lite";

export const GEMINI_FLASH_LITE_MODEL = "gemini-3.1-flash-lite" satisfies GeminiModelName;

export interface GeminiService {
  readonly generateContent: (
    modelName: GeminiModelName,
    request: GenerateContentRequest | string | Array<string | Part>
  ) => Effect.Effect<GenerateContentResult, GeminiError>;

  readonly embedContent: (text: string) => Effect.Effect<EmbedContentResponse, GeminiError>;

  readonly batchEmbedContents: (
    request: BatchEmbedContentsRequest
  ) => Effect.Effect<BatchEmbedContentsResponse, GeminiError>;
}

export const GeminiService = Context.GenericTag<GeminiService>("GeminiService");

const make = Effect.gen(function* () {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return yield* Effect.fail(new GeminiError("Missing GEMINI_API_KEY"));
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const gemma27bModel = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });
  const flashLite31Model = genAI.getGenerativeModel({ model: GEMINI_FLASH_LITE_MODEL });
  const proModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  const flashModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const flashLiteModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const getModel = (name: GeminiModelName) => {
    switch (name) {
      case "gemma-3-27b-it":
        return gemma27bModel;
      case "gemini-3.1-flash-lite":
        return flashLite31Model;
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
        try: () => getModel(modelName).generateContent(request),
        catch: (error) => new GeminiError(error),
      }).pipe(Effect.withSpan("gemini.generateContent", { attributes: { model: modelName } })),

    embedContent: (text: string) =>
      Effect.tryPromise({
        try: () => embeddingModel.embedContent(text),
        catch: (error) => new GeminiError(error),
      }).pipe(Effect.withSpan("gemini.embedContent")),

    batchEmbedContents: (request: BatchEmbedContentsRequest) =>
      Effect.tryPromise({
        try: () => embeddingModel.batchEmbedContents(request),
        catch: (error) => new GeminiError(error),
      }).pipe(Effect.withSpan("gemini.batchEmbedContents")),
  };
});

export const GeminiLive = Layer.effect(GeminiService, make);
