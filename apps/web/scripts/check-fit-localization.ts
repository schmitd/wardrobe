// Local-only verification. Input and output images must never be committed.
import { Effect } from "effect";
import { resolve } from "node:path";
import sharp from "sharp";
import { analyzeFitPhoto } from "../src/server/inference/fitPhotoAnalysis";
import { InferenceLive, InferenceService } from "../src/services/InferenceService";
import { cropGarmentRegion } from "../src/server/garmentIdentity";
import { preparePrivateCaptureOutput } from "./private-capture-output";

const [input, outputArg, variant] = process.argv.slice(2);
if (!input || !outputArg)
  throw new Error(
    "Usage: bun scripts/check-fit-localization.ts PRIVATE_IMAGE output/PRIVATE_DIRECTORY",
  );
const output = await preparePrivateCaptureOutput(outputArg, resolve(import.meta.dir, "../../.."));
let bytes = Buffer.from(await Bun.file(input).arrayBuffer());
if (variant === "distant") {
  // Synthetic stress case, not evidence of the user's separate distant photo.
  const small = await sharp(bytes).rotate().resize({ width: 700 }).toBuffer();
  bytes = Buffer.from(
    await sharp(small)
      .extend({
        top: 500,
        bottom: 500,
        left: 500,
        right: 500,
        background: "#c5b9aa",
      })
      .jpeg({ quality: 90 })
      .toBuffer(),
  );
} else if (variant === "mirrored") {
  bytes = Buffer.from(
    await sharp(bytes).rotate().flop().jpeg({ quality: 90 }).toBuffer(),
  );
} else if (variant) throw new Error("Unknown fixture variant");
if (variant) await Bun.write(`${output}/input.private.jpg`, bytes);
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const live = yield* InferenceService;
    let call = 0;
    return yield* analyzeFitPhoto(
      bytes.toString("base64"),
      "daily_fit_check",
    ).pipe(
      Effect.provideService(InferenceService, {
        ...live,
        generateContent: (request) =>
          live.generateContent(request).pipe(
            Effect.tap((response) =>
              Effect.promise(async () => {
                // Contains image-derived private content; stays in ignored output only.
                await Bun.write(
                  `${output}/call-${++call}.private.json`,
                  response.response.text(),
                );
              }),
            ),
          ),
      }),
    );
  }).pipe(Effect.provide(InferenceLive)),
);
for (const [i, item] of result.items.entries()) {
  await Bun.write(
    `${output}/${i}-${item.category}.jpg`,
    await cropGarmentRegion(bytes, item.bounding_box),
  );
}
await Bun.write(
  `${output}/result.private.json`,
  JSON.stringify(result, null, 2),
);
console.log({
  itemCount: result.items.length,
  categories: result.items.map((i) => i.category),
});
