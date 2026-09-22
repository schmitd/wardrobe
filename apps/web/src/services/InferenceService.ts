import { Context, Effect, Layer, Schema } from "effect";
import { INFERENCE_MODEL, TRANSCRIPTION_MODEL } from "../lib/inferenceModels";
import { GeminiError, GeminiLive, GeminiService } from "./GeminiService";
export { INFERENCE_MODEL } from "../lib/inferenceModels";

export class InferenceError extends Error {
  readonly _tag = "InferenceError";
  readonly status: number | undefined;
  readonly retryable: boolean;
  readonly code: string;
  constructor(error: unknown, code = "provider_failed") {
    super(error instanceof Error ? error.message : String(error));
    this.status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : undefined;
    this.retryable = this.status === 429 || (this.status !== undefined && this.status >= 500) || error instanceof TypeError || (error instanceof GeminiError && error.retryable);
    this.code = code;
  }
}

// Application request contracts, independent of any provider SDK.
export const SchemaType = { OBJECT: "object", ARRAY: "array", STRING: "string", NUMBER: "number", BOOLEAN: "boolean", INTEGER: "integer" } as const;
export type JsonSchema = { type: string; properties?: Record<string, JsonSchema>; items?: JsonSchema; required?: string[]; enum?: string[]; description?: string; format?: string };
export type ContentPart = { text: string; cache?: "reuse" } | { inlineData: { data: string; mimeType: string }; cache?: "reuse" };
export type GenerationConfig = { responseMimeType?: string; responseSchema?: JsonSchema; maxOutputTokens?: number; temperature?: number };
export type InferenceRequest = { contents: { role: "user" | "model" | "developer"; parts: ContentPart[] }[]; generationConfig?: GenerationConfig; cache?: { mode: "explicit" | "implicit"; key?: string } };
export type InferenceResult = { response: { text: () => string; usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; cachedTokenCount: number; cacheWriteTokenCount: number } } };
type EmbeddingResult = { embedding: { values: number[] } };
type BatchEmbeddingRequest = { requests: { content: { role: string; parts: ContentPart[] } }[] };
export interface InferenceService {
  readonly generateContent: (request: InferenceRequest | string) => Effect.Effect<InferenceResult, InferenceError>;
  readonly embedContent: (input: string | ContentPart[]) => Effect.Effect<EmbeddingResult, InferenceError>;
  readonly batchEmbedContents: (request: BatchEmbeddingRequest) => Effect.Effect<{ embeddings: { values: number[] }[] }, InferenceError>;
  readonly transcribe: (audio: { data: string; mimeType: string }) => Effect.Effect<string, InferenceError>;
}
export const InferenceService = Context.Service<InferenceService>("InferenceService");

const strictSchema = (schema: JsonSchema): object => {
  const { format: _format, properties, items, ...rest } = schema;
  void _format;
  return { ...rest, ...(properties ? { properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, strictSchema(value)])), required: Object.keys(properties), additionalProperties: false } : {}), ...(items ? { items: strictSchema(items) } : {}) };
};
export const buildResponseRequest = (request: InferenceRequest | string) => {
  const req: InferenceRequest = typeof request === "string" ? { contents: [{ role: "user", parts: [{ text: request }] }] } : request;
  const config = req.generationConfig;
  return {
    model: INFERENCE_MODEL, store: false, reasoning: { effort: "none" },
    max_output_tokens: config?.maxOutputTokens ?? 4096,
    // Explicit with no selected boundaries avoids paying for one-off writes.
    prompt_cache_options: { mode: req.cache?.mode ?? "explicit", ttl: "30m" },
    ...(req.cache?.key ? { prompt_cache_key: req.cache.key } : {}),
    input: req.contents.map(content => ({
      role: content.role === "model" ? "assistant" : content.role,
      content: content.parts.map(part => ({
        ...("text" in part ? { type: "input_text", text: part.text } : { type: "input_image", image_url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, detail: "high" }),
        ...(part.cache === "reuse" ? { prompt_cache_breakpoint: { mode: "explicit" } } : {}),
      })),
    })),
    ...(config?.responseSchema ? { text: { format: { type: "json_schema", name: "wardrobe_result", strict: true, schema: strictSchema(config.responseSchema) } } } : config?.responseMimeType === "application/json" ? { text: { format: { type: "json_object" } } } : {}),
  };
};

type Usage = { input_tokens: number; output_tokens: number; input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } };
export function inferenceUsage(usage: Usage) {
  const input = usage.input_tokens;
  const output = usage.output_tokens;
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  const written = usage.input_tokens_details?.cache_write_tokens ?? 0;
  return { inputTokens: input, outputTokens: output, cachedTokens: cached, cacheWriteTokens: written, estimatedCostUsd: ((input - cached - written) * .1 + cached * .01 + written * .125 + output * .5) / 1e6 };
}

const responseSchema = Schema.Struct({
  status: Schema.String,
  output: Schema.Array(Schema.Struct({
    content: Schema.optional(Schema.Array(Schema.Struct({ type: Schema.String, text: Schema.optional(Schema.String) }))),
  })),
  usage: Schema.optional(Schema.Struct({
    input_tokens: Schema.Number,
    output_tokens: Schema.Number,
    input_tokens_details: Schema.optional(Schema.Struct({ cached_tokens: Schema.optional(Schema.Number), cache_write_tokens: Schema.optional(Schema.Number) })),
  })),
});

const make = Effect.gen(function* () {
  const google = yield* GeminiService;
  const post = (path: string, body: object | FormData) => Effect.tryPromise({
    try: async signal => {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new InferenceError("Missing OPENAI_API_KEY");
      const form = body instanceof FormData;
      const response = await fetch(`https://api.openai.com/v1/${path}`, { method: "POST", headers: { Authorization: `Bearer ${key}`, ...(!form ? { "Content-Type": "application/json" } : {}) }, body: form ? body : JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(50_000)]) });
      if (!response.ok) throw Object.assign(new Error(`OpenAI ${path} returned HTTP ${response.status}`), { status: response.status });
      return await response.json() as unknown;
    },
    catch: error => error instanceof InferenceError ? error : new InferenceError(error),
  });
  const generateContent: InferenceService["generateContent"] = request => Effect.gen(function* () {
    const raw = yield* post("responses", buildResponseRequest(request));
    const result = yield* Schema.decodeUnknownEffect(responseSchema)(raw).pipe(Effect.mapError(() => new InferenceError("Malformed model response", "invalid_response")));
    if (result.output?.some(item => item.content?.some(part => part.type === "refusal"))) return yield* Effect.fail(new InferenceError("Image or request could not be analyzed", "content_blocked"));
    if (result.status !== "completed") return yield* Effect.fail(new InferenceError("Incomplete model response", "invalid_response"));
    const text = result.output?.flatMap(item => item.content ?? []).filter(part => part.type === "output_text").map(part => part.text ?? "").join("");
    if (!text?.trim()) return yield* Effect.fail(new InferenceError("Empty model response", "invalid_response"));
    const usage = result.usage ? inferenceUsage(result.usage) : undefined;
    if (usage) yield* Effect.annotateCurrentSpan({ model: INFERENCE_MODEL, ...usage });
    return { response: { text: () => text, ...(usage ? { usageMetadata: { promptTokenCount: usage.inputTokens, candidatesTokenCount: usage.outputTokens, cachedTokenCount: usage.cachedTokens, cacheWriteTokenCount: usage.cacheWriteTokens } } : {}) } };
  }).pipe(Effect.withSpan("openai.generateContent", { attributes: { model: INFERENCE_MODEL } }));
  // Preserve Google's direct multimodal embeddings and the existing vector space.
  // No caption intermediary, reindexing, or changes to identity thresholds.
  const embedContent: InferenceService["embedContent"] = input => google.embedContent(input).pipe(Effect.mapError(error => new InferenceError(error)));
  return {
    generateContent, embedContent,
    batchEmbedContents: (request: BatchEmbeddingRequest) => google.batchEmbedContents(request).pipe(Effect.mapError(error => new InferenceError(error))),
    transcribe: (audio: { data: string; mimeType: string }) => Effect.gen(function* () {
      const extensions: Record<string, string> = { "audio/mp4": "mp4", "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav" };
      if (!extensions[audio.mimeType]) return yield* Effect.fail(new InferenceError("Unsupported audio format"));
      const form = new FormData();
      form.set("model", TRANSCRIPTION_MODEL);
      form.set("file", new Blob([Buffer.from(audio.data, "base64")], { type: audio.mimeType }), `recording.${extensions[audio.mimeType]}`);
      form.set("response_format", "json");
      const raw = yield* post("audio/transcriptions", form);
      const decoded = yield* Schema.decodeUnknownEffect(Schema.Struct({ text: Schema.String }))(raw).pipe(Effect.mapError(() => new InferenceError("Invalid transcript", "invalid_response")));
      const text = decoded.text;
      if (typeof text !== "string" || text.length > 4000) return yield* Effect.fail(new InferenceError("Invalid transcript", "invalid_response"));
      return text;
    }).pipe(Effect.withSpan("openai.transcribe", { attributes: { model: TRANSCRIPTION_MODEL } })),
  } satisfies InferenceService;
});
export const InferenceLayer = Layer.effect(InferenceService, make);
export const InferenceLive = InferenceLayer.pipe(Layer.provide(GeminiLive));
