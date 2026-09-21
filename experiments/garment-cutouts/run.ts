// Local experiment only. Does not upload results, mutate records, or change capture.
// Run from the repository root with an existing private application environment.
import { mkdir } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import sharp from "sharp";
import { Schema } from "effect";
import { pipeline, SamModel, SamProcessor, AutoProcessor, RawImage, env } from "@huggingface/transformers";

const root = resolve(import.meta.dir, "../..");
const [inputArg, runName = "latest", originalPhoto] = process.argv.slice(2);
if (!inputArg || !/^[a-z0-9-]{1,60}$/.test(runName)) {
  throw new Error("Usage: bun experiments/garment-cutouts/run.ts PRIVATE_CAPTURE_RESULT.json run-name [PRIVATE_ORIGINAL_PHOTO]");
}
const input = resolve(inputArg);
const output = resolve(root, "output/cutout-prototype", runName);
await mkdir(output, { recursive: true, mode: 0o700 });
const Capture = Schema.Struct({ items: Schema.Array(Schema.Struct({ category: Schema.String, description: Schema.String, bounding_box: Schema.optionalKey(Schema.Struct({ x: Schema.Number, y: Schema.Number, width: Schema.Number, height: Schema.Number })) })).check(Schema.isMaxLength(12)) });
const capture = Schema.decodeUnknownSync(Capture)(JSON.parse(await Bun.file(input).text()));
type Row = { index: number; category: string; before: string; after?: string; download?: string; durationMs: number; retainedFraction?: number; rgbPreserved?: boolean; error?: string; method?: string };
const rows: Row[] = [];
const clothingModel = "Xenova/segformer_b2_clothes";
const samModel = "Xenova/slimsam-77-uniform";
env.cacheDir = resolve(root, "output/model-cache");
env.allowLocalModels = false;
const loadStarted = Date.now();
const segmenter = await pipeline("image-segmentation", clothingModel, { dtype: "q8", device: "cpu", revision: "cb6ac44e641faa309f29561c1afe08d87ef52631" });
const sam = await SamModel.from_pretrained(samModel, { dtype: "q8", device: "cpu", revision: "5850ab45f587c112167512ffef949107115e26a0" });
const processor = await AutoProcessor.from_pretrained(samModel, { revision: "5850ab45f587c112167512ffef949107115e26a0" });
const loadMs = Date.now() - loadStarted;
if (!(processor instanceof SamProcessor)) throw new Error("Unexpected accessory processor");
console.log({ status: "local-models-ready", loadMs });
const contextStarted = Date.now();
const originalContext = originalPhoto ? await sharp(originalPhoto).rotate().removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true }) : undefined;
const contextualSegments = originalContext ? (await segmenter(new RawImage(new Uint8ClampedArray(originalContext.data), originalContext.info.width, originalContext.info.height, 3))).flat() : undefined;
const contextInferenceMs = Date.now() - contextStarted;
const labels: Record<string, string[]> = {
  top: ["Upper-clothes"], outerwear: ["Upper-clothes"], bottom: ["Pants", "Skirt"],
  dress: ["Dress"], footwear: ["Left-shoe", "Right-shoe"], bag: ["Bag"],
};
try {

for (const [index, item] of capture.items.entries()) {
  if (!/^[a-z_]+$/.test(item.category)) throw new Error("Invalid category filename");
  const source = Buffer.from(await Bun.file(resolve(dirname(input), `${index}-${item.category}.jpg`)).arrayBuffer());
  const before = `${index}-before.jpg`;
  await Bun.write(resolve(output, before), source);
  const started = Date.now();
  try {
    const original = await sharp(source).rotate().removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
    const { width, height } = original.info;
    const rawImage = new RawImage(new Uint8ClampedArray(original.data), width, height, 3);
    const alpha = Buffer.alloc(width * height);
    const acceptedLabels = labels[item.category];
    let method: string;
    if (acceptedLabels) {
      const segments = contextualSegments ?? (await segmenter(rawImage)).flat();
      for (const segment of segments) {
        if (!segment.label || !acceptedLabels.includes(segment.label)) continue;
        let data: Uint8Array | Uint8ClampedArray = segment.mask.data;
        if (originalContext && item.bounding_box) {
          const box = item.bounding_box;
          const fullWidth = originalContext.info.width;
          const fullHeight = originalContext.info.height;
          const left = Math.max(0, Math.floor((box.x - box.width * 0.08) * fullWidth));
          const top = Math.max(0, Math.floor((box.y - box.height * 0.08) * fullHeight));
          const right = Math.min(fullWidth, Math.ceil((box.x + box.width * 1.08) * fullWidth));
          const bottom = Math.min(fullHeight, Math.ceil((box.y + box.height * 1.08) * fullHeight));
          data = await sharp(Buffer.from(data), { raw: { width: fullWidth, height: fullHeight, channels: 1 } }).extract({ left, top, width: right - left, height: bottom - top }).resize(width, height, { kernel: "linear" }).greyscale().raw().toBuffer();
        }
        if (data.length !== alpha.length) throw new Error("Unexpected semantic mask shape");
        for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = Math.max(alpha[pixel], data[pixel]);
      }
      method = originalContext ? "Local clothing segmentation with source context" : "Local clothing segmentation";
    } else {
      // The detector already supplied a tight crop. Its interior provides a
      // foreground center and background-edge prompts for unsupported accessories.
      const inputs = await processor(rawImage, { input_points: [[[width / 2, height / 2], [width / 2, height * 0.02], [width / 2, height * 0.98], [width * 0.02, height / 2], [width * 0.98, height / 2]]], input_labels: [[1, 0, 0, 0, 0]] });
      const result = await sam(inputs);
      const masks = await processor.post_process_masks(result.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
      const scores = Array.from(result.iou_scores.data as Float32Array);
      const values = masks[0].data;
      const pointPixel = (x: number, y: number) => Math.min(height - 1, Math.floor(y * height)) * width + Math.min(width - 1, Math.floor(x * width));
      const candidates = scores.map((score, i) => {
        const offset = i * alpha.length;
        const positive = Number(values[offset + pointPixel(0.5, 0.5)]) > 0;
        const negativeHits = [[0.5, 0.02], [0.5, 0.98], [0.02, 0.5], [0.98, 0.5]].filter(([x,y]) => Number(values[offset + pointPixel(x,y)]) > 0).length;
        return { index: i, score, positive, negativeHits };
      });
      const selected = candidates.filter(candidate => candidate.positive && candidate.score >= 0.85).sort((a,b) => a.negativeHits - b.negativeHits || b.score - a.score)[0];
      if (!selected) throw new Error("No mask retained the target center");
      const best = selected.index;
      console.log({ maskCandidates: candidates, selectedMask: best });
      for (let pixel = 0; pixel < alpha.length; pixel++) alpha[pixel] = Number(values[best * alpha.length + pixel]) > 0 ? 255 : 0;
      method = "Local accessory segmentation from crop center and edges";
      for (const tensor of Object.values(result)) if (tensor && typeof tensor === "object" && "dispose" in tensor) (tensor as { dispose: () => void }).dispose();
    }
    const retained = alpha.reduce((sum, value) => sum + (value >= 128 ? 1 : 0), 0);
    if (!retained) throw new Error("Empty segmentation mask");
    const after = `${index}-cutout.png`;
    const visibleRgb = Buffer.from(original.data);
    for (let pixel = 0; pixel < alpha.length; pixel++) {
      if (alpha[pixel] === 0) visibleRgb.fill(0, pixel * 3, pixel * 3 + 3);
    }
    const cutout = await sharp(visibleRgb, { raw: original.info }).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
    await Bun.write(resolve(output, after), cutout);
    await Bun.write(resolve(output, `${index}-mask.png`), await sharp(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer());
    const decoded = await sharp(cutout).removeAlpha().raw().toBuffer();
    const rgbPreserved = decoded.equals(visibleRgb);
    if (!rgbPreserved) throw new Error("Unexpected visible-pixel change or uncleared transparent pixel");
    const download = `${index}-item.png`;
    await Bun.write(resolve(output, download), await sharp(cutout).trim({ threshold: 1 }).png().toBuffer());
    rows.push({ index, category: item.category, before, after, download, durationMs: Date.now() - started, retainedFraction: retained / (width * height), rgbPreserved, method });
    console.log({ index, category: item.category, status: "mask-produced", durationMs: Date.now() - started, rgbPreserved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rows.push({ index, category: item.category, before, durationMs: Date.now() - started, error: message });
    console.log({ index, category: item.category, status: "failed", message: message.slice(0, 200) });
  }
}

} finally {
  await segmenter.dispose();
  await sam.dispose();
}
await Bun.write(resolve(output, "result.private.json"), JSON.stringify({ models: [clothingModel, samModel], loadMs, contextInferenceMs, rows }, null, 2));
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wardrobe · Item cutout study</title>
<style>body{margin:0;background:#f3f1ec;color:#222;font:16px/1.5 system-ui}main{max-width:1040px;margin:auto;padding:36px 24px}h1{font-size:32px;line-height:1.1;letter-spacing:-1px;margin:8px 0 16px}p{max-width:700px;color:#555}.tag{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#766746}nav{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0}button,a{font:inherit;color:inherit}button{border:1px solid #ccc;border-radius:20px;padding:6px 16px;background:white;cursor:pointer}button[aria-pressed=true]{background:#222;color:white}article{margin:28px 0 42px}h2{font-size:18px;text-transform:capitalize}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{font-size:13px;margin:8px 0;color:#555}.frame{height:400px;border:1px solid #ddd;border-radius:14px;overflow:hidden;display:grid;place-items:center;background:#eee}.frame img{width:100%;height:100%;min-width:0;min-height:0;object-fit:contain}.cutout{background-color:#fff;background-image:linear-gradient(45deg,#e6e6e6 25%,transparent 25%),linear-gradient(-45deg,#e6e6e6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6e6e6 75%),linear-gradient(-45deg,transparent 75%,#e6e6e6 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}.white .cutout{background:#fff}.dark .cutout{background:#23282b}.accent .cutout{background:#dec3a0}.meta{font-size:13px;color:#666}.error{padding:20px;color:#8b3028}@media(max-width:600px){main{padding:24px 16px}.pair{gap:8px}.frame{height:280px}h1{font-size:27px}}</style>
<main><div class="tag">Wardrobe / Local prototype</div><h1>Keep the item. Remove the surroundings.</h1><p>Existing garment crops with a locally computed transparency mask. The original colors and texture are preserved. Hidden fabric stays hidden, and low-resolution details stay low-resolution.</p><p class="meta">Shared clothing analysis: ${(contextInferenceMs / 1000).toFixed(1)}s · Model startup: ${(loadMs / 1000).toFixed(1)}s. Per-item times appear below. Transparent pixels are cleared.</p><nav aria-label="Cutout background">${["checker","white","dark","accent"].map((x,i)=>`<button data-bg="${x}" aria-pressed="${i===0}">${x[0].toUpperCase()+x.slice(1)}</button>`).join("")}</nav>
${rows.map(row=>`<article><h2>${escape(row.category)}</h2><div class="pair"><figure><div class="frame"><img src="${row.before}" alt="Original ${escape(row.category)} crop"></div><figcaption>Original crop</figcaption></figure><figure><div class="frame cutout">${row.after?`<img src="${row.after}" alt="${escape(row.category)} with surroundings removed">`:`<div class="error">No usable mask was produced. Original retained.</div>`}</div><figcaption>Item cutout</figcaption></figure></div><div class="meta">${escape(row.method ?? "No usable segmentation")} · ${(row.durationMs/1000).toFixed(1)} seconds${row.rgbPreserved?" · Visible source pixels preserved":""}${row.download?` · <a href="${row.download}" download>Download transparent PNG</a>`:""}</div></article>`).join("")}
<p class="meta">Private evaluation only. Nothing in this study is saved to your wardrobe or deployed. Mask quality needs visual review, especially around hands, occlusion, and small accessories.</p></main><script>document.querySelectorAll('[data-bg]').forEach(button=>button.onclick=()=>{document.body.className=button.dataset.bg;document.querySelectorAll('[data-bg]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)))})</script></html>`;
await Bun.write(resolve(output, "index.html"), html);
console.log({ gallery: relative(root, resolve(output, "index.html")), successful: rows.filter(row => row.after).length, total: rows.length });

// Optional serving is a separate explicit command, so model execution exits.
export { output, rows };
