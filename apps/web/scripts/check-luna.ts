// Explicit paid smoke check. Private responses remain under ignored output/.
import { Effect } from "effect";
import { resolve } from "node:path";
import { InferenceLive, InferenceService } from "../src/services/InferenceService";
import { analyzeImageFull, generateClosetBio } from "../src/server/inference/analysis";
import { compareGarmentCrops } from "../src/server/garmentIdentityDisambiguation";
import { analyzeImageTags, analyzeImageDescription } from "../src/server/wardrobeInference";
import { embedImage, embedText } from "../src/server/inference/shared";
import { preparePrivateCaptureOutput } from "./private-capture-output";

const [photo, audio, outputArg] = process.argv.slice(2);
if (!photo || !audio || !outputArg) throw new Error("Usage: bun scripts/check-luna.ts PRIVATE_PHOTO PRIVATE_WAV output/PRIVATE_RUN");
const output = await preparePrivateCaptureOutput(outputArg, resolve(import.meta.dir, "../../.."));
const image = { data: Buffer.from(await Bun.file(photo).arrayBuffer()).toString("base64"), mimeType: "image/jpeg" };
const result = await Effect.runPromise(Effect.gen(function* () {
  const service = yield* InferenceService;
  const analysis = yield* analyzeImageFull(image.data);
  const tags = yield* analyzeImageTags(image.data);
  const description = yield* analyzeImageDescription(image.data, { category: tags.category, styleTags: tags.style_tags });
  const bio = yield* generateClosetBio([analysis]);
  const comparison = yield* compareGarmentCrops({ query: image, candidates: [{ wardrobeItemId: "synthetic-same-photo", category: analysis.category, image }] });
  if (comparison.matchIndex !== 0) throw new Error("Identical-image control was not matched");
  const visual = yield* embedImage(image.data, image.mimeType, analysis.description);
  const text = yield* embedText(analysis.description);
  if (visual.length !== 768 || text.length !== 768 || [...visual, ...text].some(v => !Number.isFinite(v))) throw new Error("Embedding contract changed");
  const transcript = yield* service.transcribe({ data: Buffer.from(yield* Effect.promise(() => Bun.file(audio).arrayBuffer())).toString("base64"), mimeType: "audio/wav" });
  return { analysis, tags, description, bio, comparison, transcript, visualDimensions: visual.length, textDimensions: text.length };
}).pipe(Effect.provide(InferenceLive)));
await Bun.write(`${output}/result.private.json`, JSON.stringify(result, null, 2));
console.log({ imageAnalysis: "passed", bio: "passed", identicalImage: "matched", visualDimensions: result.visualDimensions, textDimensions: result.textDimensions, transcription: result.transcript.length ? "nonempty" : "empty" });
