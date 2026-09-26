import { expect, test } from "bun:test";
import sharp from "sharp";
import {
  exportFitPixels,
  readFitImage,
  MAX_FIT_EXPORT_BYTES,
} from "./fitImage";

test("export bakes orientation, preserves framing, strips metadata and leaves source intact", async () => {
  const source = await sharp({
    create: { width: 80, height: 40, channels: 3, background: "red" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Artist: "Private person" } })
    .toBuffer();
  const before = Buffer.from(source);
  const output = await exportFitPixels(source, "png");
  const metadata = await sharp(output).metadata();
  expect({ width: metadata.width, height: metadata.height }).toEqual({
    width: 40,
    height: 80,
  });
  expect(metadata.exif).toBeUndefined();
  expect(metadata.orientation).toBeUndefined();
  expect(source.equals(before)).toBe(true);
});
test("export bounds pixels and streamed bytes even without content length", async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_FIT_EXPORT_BYTES));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    }),
  );
  await expect(readFitImage(response)).rejects.toThrow("too large");
  const source = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: "blue" },
  })
    .jpeg()
    .toBuffer();
  const output = await sharp(await exportFitPixels(source, "jpeg")).metadata();
  expect([output.width, output.height]).toEqual([2048, 1024]);
});
