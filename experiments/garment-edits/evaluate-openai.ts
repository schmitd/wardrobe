import { resolve } from "node:path";
import sharp from "sharp";
import prompts from "./generative-prompts.json";

const [inputDirectory, outputDirectory, model = "gpt-image-2.5-sunburst"] = process.argv.slice(2);
if (!inputDirectory || !outputDirectory) throw new Error("Usage: bun evaluate-openai.ts <fixtures> <output> [model]");
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is unavailable");
for (const index of [0, 1, 2]) {
  const prompt = prompts.prompts[index]!
    .replace(/image 2 is supporting original-photo context\./i, "Only this crop is available; no second image is supplied.")
    .replace("Image 1 is the edit target", "The supplied image is the edit target");
  const form = new FormData();
  form.set("model", model);
  form.set("image[]", Bun.file(resolve(inputDirectory, `${index}-before.jpg`)), "garment.jpg");
  form.set("prompt", prompt);
  form.set("background", "transparent");
  form.set("output_format", "png");
  form.set("quality", "medium");
  form.set("size", "1024x1024");
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form,
    signal: AbortSignal.timeout(180_000),
  });
  const result = await response.json() as {
    data?: Array<{ b64_json?: string }>; usage?: unknown;
    error?: { code?: string; type?: string; message?: string };
  };
  const files = [];
  for (const [imageIndex, image] of (result.data ?? []).entries()) {
    if (!image.b64_json) continue;
    const bytes = Buffer.from(image.b64_json, "base64");
    const metadata = await sharp(bytes).metadata();
    const stats = await sharp(bytes).stats();
    const file = `${model}-${index}-${imageIndex}.${metadata.format ?? "bin"}`;
    await Bun.write(resolve(outputDirectory, file), bytes);
    files.push({ file, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha,
      alpha: metadata.hasAlpha ? stats.channels.at(-1) : undefined });
  }
  const record = { model, item: index, status: response.status, elapsedMs: Date.now() - started,
    error: result.error, usage: result.usage, prompt, files };
  await Bun.write(resolve(outputDirectory, `${model}-${index}.json`), JSON.stringify(record, null, 2));
  console.log(JSON.stringify({ model, item: index, status: response.status, elapsedMs: record.elapsedMs,
    files, error: result.error }));
  if (!response.ok || !files.length) { process.exitCode = 1; break; }
}
