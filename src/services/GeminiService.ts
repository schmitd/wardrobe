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

export interface GeminiService {
  readonly generateContent: (
    modelName: "gemini-2.5-flash-lite",
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

  const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const getModel = () => visionModel;

  return {
    generateContent: (
      modelName: "gemini-2.5-flash-lite",
      request: GenerateContentRequest | string | Array<string | Part>
    ) =>
      Effect.tryPromise({
        try: () => getModel().generateContent(request),
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
