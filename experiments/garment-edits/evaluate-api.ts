import { resolve } from "node:path";
import sharp from "sharp";
import prompts from "./generative-prompts.json";

// Private fixtures and provider outputs must remain outside version control.
const [inputDirectory, outputDirectory, ...requestedModels] = process.argv.slice(2);
if (!inputDirectory || !outputDirectory) {
  throw new Error("Usage: bun evaluate-api.ts <private fixture directory> <private output directory> [models...]");
}
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === "[SENSITIVE]") throw new Error("GEMINI_API_KEY is unavailable");
const models = requestedModels.length ? requestedModels : ["gemini-3.1-flash-image", "gemini-3-pro-image"];
const allowedModels = new Set([
  "gemini-3.1-flash-image", "gemini-3-pro-image",
  "gemini-3.1-flash-lite-image", "gemini-2.5-flash-image",
]);
if (models.some(model => !allowedModels.has(model))) throw new Error("Unsupported evaluation model");

type Response = {
  error?: { code?: number; status?: string; message?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ thought?: boolean; inlineData?: { mimeType: string; data: string } }> };
  }>;
  usageMetadata?: unknown;
};

for (const model of models) {
  for (const index of [0, 1, 2]) {
    const input = await Bun.file(resolve(inputDirectory, `${index}-before.jpg`)).arrayBuffer();
    // This pass deliberately measures what the crop alone can establish.
    const prompt = prompts.prompts[index]!
      .replace(/image 2 is supporting original-photo context\./i, "Only this crop is available; no second image is supplied.")
      .replace("Image 1 is the edit target", "The supplied image is the edit target");
    const started = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: Buffer.from(input).toString("base64") } },
        ] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { imageSize: "1K", aspectRatio: "1:1" } },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const result = await response.json() as Response;
    const images = result.candidates?.[0]?.content?.parts?.filter(part => part.inlineData && !part.thought) ?? [];
    const files = [];
    for (const [imageIndex, part] of images.entries()) {
      const bytes = Buffer.from(part.inlineData!.data, "base64");
      const metadata = await sharp(bytes).metadata();
      const file = `${model}-${index}-${imageIndex}.${metadata.format ?? "bin"}`;
      await Bun.write(resolve(outputDirectory, file), bytes);
      const stats = await sharp(bytes).stats();
      files.push({ file, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha,
        alpha: metadata.hasAlpha ? stats.channels.at(-1) : undefined });
    }
    const record = { model, item: index, status: response.status, elapsedMs: Date.now() - started,
      finishReason: result.candidates?.[0]?.finishReason, error: result.error,
      usage: result.usageMetadata, prompt, files };
    await Bun.write(resolve(outputDirectory, `${model}-${index}.json`), JSON.stringify(record, null, 2));
    console.log(JSON.stringify({ model, item: index, status: response.status, elapsedMs: record.elapsedMs,
      images: files.length, error: result.error?.status }));
    if (!response.ok || !files.length) {
      process.exitCode = 1;
      // Do not retry zero quota, refusals, or empty output and incur accidental spend.
      break;
    }
  }
}
