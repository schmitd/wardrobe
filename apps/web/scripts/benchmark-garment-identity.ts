import { resolve, dirname, extname } from "node:path";
import { Effect } from "effect";

import { GeminiLive } from "@/services/GeminiService";
import {
  applyDirectGarmentComparison,
  classifyGarmentMatch,
  shouldDirectlyCompareGarments,
  type GarmentIdentityCandidate,
} from "@/server/garmentIdentity";
import {
  compareGarmentCrops,
  type DirectComparisonCandidate,
  type GarmentCropImage,
} from "@/server/garmentIdentityDisambiguation";

type BenchmarkCandidate = {
  wardrobeItemId: string;
  image: string;
  embeddingScore: number;
  category?: string | null;
  description?: string | null;
};

type BenchmarkCase = {
  id: string;
  queryImage: string;
  expectedWardrobeItemId: string | null;
  candidates: BenchmarkCandidate[];
};

type Prediction = {
  expected: string | null;
  predicted: string | null;
};

const quantile = (values: number[], fraction: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]! * 10) / 10;
};

const summarize = (predictions: Prediction[]) => {
  const correct = predictions.filter((item) => item.predicted === item.expected).length;
  const decided = predictions.filter((item) => item.predicted !== null);
  const correctDecisions = decided.filter((item) => item.predicted === item.expected).length;
  return {
    cases: predictions.length,
    accuracy: predictions.length ? correct / predictions.length : null,
    autoMatchCoverage: predictions.length ? decided.length / predictions.length : null,
    autoMatchPrecision: decided.length ? correctDecisions / decided.length : null,
  };
};

const mimeTypeFor = (path: string) => {
  switch (extname(path).toLowerCase()) {
    case ".png": return "image/png";
    case ".webp": return "image/webp";
    case ".heic": return "image/heic";
    default: return "image/jpeg";
  }
};

const readImage = async (baseDirectory: string, relativePath: string): Promise<GarmentCropImage> => {
  const path = resolve(baseDirectory, relativePath);
  const file = Bun.file(path);
  if (!await file.exists()) throw new Error(`Missing benchmark image: ${path}`);
  return { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: mimeTypeFor(path) };
};

const predictedItemId = (decision: ReturnType<typeof classifyGarmentMatch>) =>
  decision.status === "auto_matched" ? decision.wardrobeItemId : null;

const fixtureArgument = process.argv.find((argument) => argument.startsWith("--fixtures="))?.slice("--fixtures=".length);
const runModel = process.argv.includes("--model");
if (!fixtureArgument) {
  throw new Error("Usage: bun run benchmark:garment-identity --fixtures=path/to/fixtures.json [--model]");
}
if (runModel && !process.env.GEMINI_API_KEY) {
  throw new Error("--model requires GEMINI_API_KEY. No model benchmark was run.");
}

const fixturePath = resolve(process.cwd(), fixtureArgument);
const fixtureDirectory = dirname(fixturePath);
const cases = await Bun.file(fixturePath).json() as BenchmarkCase[];
if (!Array.isArray(cases) || !cases.length) throw new Error("Benchmark fixtures must be a non-empty JSON array.");

const embeddingPredictions: Prediction[] = [];
const directPredictions: Prediction[] = [];
const embeddingPolicyLatencyMs: number[] = [];
const directComparisonLatencyMs: number[] = [];
let fallbackEligibleCases = 0;
let modelCalls = 0;
let inputTokens = 0;
let outputTokens = 0;
let hasCompleteTokenUsage = true;

for (const benchmarkCase of cases) {
  if (!benchmarkCase.id || !Array.isArray(benchmarkCase.candidates)) throw new Error("Each fixture needs id and candidates.");
  const candidates: GarmentIdentityCandidate[] = benchmarkCase.candidates.map((candidate) => ({
    wardrobeItemId: candidate.wardrobeItemId,
    score: candidate.embeddingScore,
    imageUrl: candidate.image,
    category: candidate.category,
    description: candidate.description,
  }));
  const embeddingStart = performance.now();
  const embeddingDecision = classifyGarmentMatch(candidates);
  embeddingPolicyLatencyMs.push(performance.now() - embeddingStart);
  embeddingPredictions.push({
    expected: benchmarkCase.expectedWardrobeItemId,
    predicted: predictedItemId(embeddingDecision),
  });

  if (!shouldDirectlyCompareGarments(embeddingDecision, candidates)) {
    directPredictions.push({
      expected: benchmarkCase.expectedWardrobeItemId,
      predicted: predictedItemId(embeddingDecision),
    });
    continue;
  }
  fallbackEligibleCases += 1;
  if (!runModel) continue;

  const comparisonStart = performance.now();
  const query = await readImage(fixtureDirectory, benchmarkCase.queryImage);
  const modelCandidates: DirectComparisonCandidate[] = await Promise.all(
    benchmarkCase.candidates.slice(0, 3).map(async (candidate) => ({
      wardrobeItemId: candidate.wardrobeItemId,
      category: candidate.category,
      description: candidate.description,
      image: await readImage(fixtureDirectory, candidate.image),
    }))
  );
  const comparison = await Effect.runPromise(
    compareGarmentCrops({ query, candidates: modelCandidates }).pipe(Effect.provide(GeminiLive))
  );
  directComparisonLatencyMs.push(performance.now() - comparisonStart);
  modelCalls += 1;
  if (comparison.inputTokens === null || comparison.outputTokens === null) {
    hasCompleteTokenUsage = false;
  } else {
    inputTokens += comparison.inputTokens;
    outputTokens += comparison.outputTokens;
  }
  const directDecision = applyDirectGarmentComparison(embeddingDecision, candidates.slice(0, 3), comparison);
  directPredictions.push({
    expected: benchmarkCase.expectedWardrobeItemId,
    predicted: predictedItemId(directDecision),
  });
}

const inputPrice = Number(process.env.BENCHMARK_INPUT_USD_PER_MILLION_TOKENS);
const outputPrice = Number(process.env.BENCHMARK_OUTPUT_USD_PER_MILLION_TOKENS);
const hasPricing = Number.isFinite(inputPrice) && inputPrice >= 0 && Number.isFinite(outputPrice) && outputPrice >= 0;
const estimatedModelCostUsd = runModel && hasCompleteTokenUsage && hasPricing
  ? (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000
  : null;

console.log(JSON.stringify({
  fixturePath,
  limitations: [
    "Embedding scores are supplied by fixtures, so embeddingPolicyLatencyMs excludes query embedding generation and vector retrieval.",
    "Direct comparison latency includes local fixture reads plus the model request; production candidate network fetch can differ.",
    "Cost is emitted only from returned token usage and caller-supplied current per-million-token prices.",
  ],
  embeddingOnly: {
    ...summarize(embeddingPredictions),
    policyLatencyMs: {
      p50: quantile(embeddingPolicyLatencyMs, 0.5),
      p95: quantile(embeddingPolicyLatencyMs, 0.95),
    },
  },
  directComparisonFallback: runModel ? {
    ...summarize(directPredictions),
    eligibleCases: fallbackEligibleCases,
    modelCalls,
    callRate: cases.length ? modelCalls / cases.length : null,
    latencyMs: {
      p50: quantile(directComparisonLatencyMs, 0.5),
      p95: quantile(directComparisonLatencyMs, 0.95),
    },
    tokenUsage: hasCompleteTokenUsage ? { inputTokens, outputTokens } : null,
    estimatedModelCostUsd,
  } : {
    skipped: true,
    eligibleCases: fallbackEligibleCases,
    reason: "Pass --model with GEMINI_API_KEY to measure model-backed comparison.",
  },
}, null, 2));
