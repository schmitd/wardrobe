import sharp from "sharp";

export const MAX_FIT_EXPORT_BYTES = 25 * 1024 * 1024;
export async function exportFitPixels(
  input: Uint8Array,
  format: "jpeg" | "png",
) {
  if (!input.byteLength || input.byteLength > MAX_FIT_EXPORT_BYTES)
    throw new Error("This image is too large to prepare.");
  const pixels = sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    });
  // Sharp strips metadata unless explicitly retained. Never call withMetadata.
  return format === "png"
    ? pixels.png().toBuffer()
    : pixels.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
export async function readFitImage(response: Response) {
  if (
    !response.ok ||
    Number(response.headers.get("content-length")) > MAX_FIT_EXPORT_BYTES ||
    !response.body
  )
    throw new Error("This photo could not be loaded.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_FIT_EXPORT_BYTES)
        throw new Error("This photo is too large to prepare.");
      chunks.push(chunk.value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks, size);
}
