import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// Extract the selected artwork's pixels; never redraw or regenerate the mark.
const root = resolve(import.meta.dir, "..");
const source = resolve(root, "docs/brand/round-tuft/lint-round-tuft-source.png");
const ink = { r: 36, g: 20, b: 38 };
const lime = { r: 220, g: 230, b: 110, alpha: 1 };
const web = resolve(root, "apps/web/public/brand");
const native = resolve(root, "apps/mobile/assets");
await Promise.all([mkdir(web, { recursive: true }), mkdir(native, { recursive: true })]);

async function extract(left: number, top: number, width: number, height: number) {
  const { data } = await sharp(source).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.alloc(width * height * 4);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const luminance = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      // Remove the study sheet's near-white texture and retain antialiased edges.
      const coverage = Math.max(0, Math.min(1, (249 - luminance) / 224));
      const alpha = coverage < 0.1 ? 0 : Math.round(coverage * 255);
      const p = (y * width + x) * 4;
      pixels[p] = ink.r; pixels[p + 1] = ink.g; pixels[p + 2] = ink.b; pixels[p + 3] = alpha;
      if (alpha) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error("Selected artwork was not found");
  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
}

const mark = await extract(340, 185, 405, 365);
const lockup = await extract(340, 185, 935, 365);
await sharp(mark).resize({ width: 512 }).png().toFile(resolve(web, "lint-round-tuft-mark.png"));
await sharp(lockup).resize({ width: 720, height: 270, fit: "contain", background: "#00000000" }).png()
  .toFile(resolve(web, "lint-round-tuft-lockup.png"));

async function centeredMark(maxWidth: number, maxHeight: number) {
  return sharp(mark).resize({ width: maxWidth, height: maxHeight, fit: "inside" }).png().toBuffer();
}

// The opaque iOS/store icon leaves at least 14% margin on each side.
const appMark = await centeredMark(736, 736);
const appIcon = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: lime } })
  .composite([{ input: appMark, gravity: "center" }]).removeAlpha().png().toBuffer();
await Bun.write(resolve(native, "icon.png"), appIcon);

// Keep every foreground pixel inside Android's 66/108-diameter safe circle.
const { data, info } = await sharp(mark).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let radius = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3]) {
    radius = Math.max(radius, Math.hypot(x - (info.width - 1) / 2, y - (info.height - 1) / 2));
  }
}
const scale = 300 / radius;
const adaptiveMark = await centeredMark(Math.floor(info.width * scale), Math.floor(info.height * scale));
const foreground = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#00000000" } })
  .composite([{ input: adaptiveMark, gravity: "center" }]).png().toBuffer();
await Bun.write(resolve(native, "adaptive-icon.png"), foreground);
await Bun.write(resolve(native, "monochrome-icon.png"), foreground);
await sharp(appIcon).resize(180, 180).toFile(resolve(root, "apps/web/src/app/apple-icon.png"));
const favicon = await sharp(appIcon).resize(48, 48).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico[6] = 48; ico[7] = 48;
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(favicon.length, 14); ico.writeUInt32LE(22, 18);
await Bun.write(resolve(root, "apps/web/src/app/favicon.ico"), Buffer.concat([ico, favicon]));
console.log("Round Tuft assets extracted from the selected study; shape preserved, palette normalized.");
