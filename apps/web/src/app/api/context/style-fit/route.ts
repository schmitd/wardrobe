import { Effect, Schema as EffectSchema } from "effect";
import { publicServerFailure } from "@/server/errors";
import { runInference } from "@/lib/run-effect";
import { InferenceService, SchemaType, type JsonSchema as Schema } from "@/services/InferenceService";
import {
  recommendedInferenceModel,
  type StyleFitRequest,
  type StyleFitResponse,
  type StyleFitVerdict,
} from "@wardrobe/shared";

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    verdict: { type: SchemaType.STRING },
    score: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
    reasons: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["verdict", "score", "summary", "reasons"],
};

const normalizeVerdict = (value: string): StyleFitVerdict => {
  if (
    value === "strong_fit" ||
    value === "good_fit" ||
    value === "mixed" ||
    value === "poor_fit" ||
    value === "unknown"
  ) {
    return value;
  }
  return "unknown";
};

const fallbackFit = (input: StyleFitRequest): StyleFitResponse => ({
  verdict: "unknown",
  score: 50,
  summary:
    "Personalized fit checks are not configured yet.",
  reasons: [
    input.title ? `Product title captured: ${input.title}` : "No product title was provided.",
    input.imageUrl ? "Product image URL was captured." : "No product image URL was provided.",
  ],
  model: "fallback",
});

const isAuthorized = (request: Request) => {
  const requiredToken = process.env.STYLE_FIT_API_TOKEN;
  if (!requiredToken) return true;

  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader === `Bearer ${requiredToken}`;
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = (await request.json()) as StyleFitRequest;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json(fallbackFit(input));
  }


  const prompt = `You are Wardrobe's context layer for shopping decisions.
Evaluate whether this clothing product is likely to fit the user's wardrobe and style intent.
Return JSON only with:
- verdict: one of strong_fit, good_fit, mixed, poor_fit, unknown
- score: integer 0-100
- summary: one sentence
- reasons: 2-4 concise bullets

Product:
${JSON.stringify(input, null, 2)}

Current context:
${input.userContext ?? "No authenticated wardrobe summary was supplied. Use product evidence only."}`;

  try {
  const result = await runInference(InferenceService.pipe(Effect.flatMap(inference => inference.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  }))));

  const parsed = EffectSchema.decodeUnknownSync(EffectSchema.Struct({
    verdict: EffectSchema.String, score: EffectSchema.Number,
    summary: EffectSchema.String, reasons: EffectSchema.Array(EffectSchema.String),
  }))(JSON.parse(result.response.text()));
  return Response.json({
    verdict: normalizeVerdict(parsed.verdict),
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    summary: parsed.summary,
    reasons: parsed.reasons.slice(0, 4),
    model: recommendedInferenceModel,
  } satisfies StyleFitResponse);
  } catch (error) {
    const failure = publicServerFailure(error);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
