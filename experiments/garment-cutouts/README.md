# Garment cutout study

A local, offline-after-download evaluation of background removal for the verified crops from PR #84. This experiment has its own dependencies and lockfile; it is not imported by the application and does not alter stored wardrobe photos.

Run from the repository root:

```sh
bun install --cwd experiments/garment-cutouts --frozen-lockfile
bun experiments/garment-cutouts/run.ts /private/capture/result.private.json study-name /private/original.jpg
bun experiments/garment-cutouts/serve.ts study-name
```

Open http://127.0.0.1:4918/. The gallery compares the original crop with a transparent PNG, offers contrasting backgrounds, and provides PNG downloads. Results, original copies, and the model cache stay under ignored `output/`. No application credential is needed. The HTTP server binds only to loopback and serves image/HTML files from the chosen study.

The clothing parser uses the original photo for context, then maps its mask into each crop using the same padding and geometry. Running it on an isolated pants crop removed most of the pants incorrectly; source context substantially improved that result. Accessories use SlimSAM with automatically selected center/edge points. The candidate selection favors masks that retain the center, respect edge background points, and meet the experimental model-score cutoff.

Only alpha changes for visible pixels. Fully transparent RGB pixels are cleared so removed surroundings cannot be recovered by discarding alpha. Every generated PNG is decoded and checked against those rules. Occluded fabric is not reconstructed.

## Results and limits

On the existing private regression photo, local inference produced three masks. With cached models, startup took about 0.35 seconds; the shared clothing pass took about 1.3 seconds; crop mapping took about 0.05 seconds total, and the accessory pass about 2.8 seconds. These are single-run CPU observations, not mobile or server benchmarks.

- Pants: visually useful separation of the visible garment from its surroundings.
- Shirt: main fabric is separated, but small skin remnants and edge errors remain near the occluding arm. The empty area under the arm reflects missing source pixels.
- Watch: still retains wrist/skin and is not an acceptable finished cutout. A high predicted mask score did not establish garment accuracy.

This is a reviewable prototype, not production-ready background removal. A production candidate needs more garment/accessory fixtures, explicit mask rejection/fallback, suitable deployment/licensing, and mobile performance checks. The original crop remains the fallback.

An initial Gemini segmentation experiment returned an undecodable mask; later requests reached a quota limit. That approach was not accepted. The working local evaluation makes no provider inference calls.

## Models and license boundary

- [Xenova/segformer_b2_clothes](https://huggingface.co/Xenova/segformer_b2_clothes), pinned to `cb6ac44e641faa309f29561c1afe08d87ef52631`, q8 model about 28.8 MB.
- [Xenova/slimsam-77-uniform](https://huggingface.co/Xenova/slimsam-77-uniform), pinned to `5850ab45f587c112167512ffef949107115e26a0`, q8 encoder/decoder about 13.8 MB combined, Apache-2.0.

The clothing model's [upstream card](https://huggingface.co/mattmdjaga/segformer_b2_clothes) links to the [SegFormer license](https://github.com/NVlabs/SegFormer/blob/master/LICENSE), which limits use to non-commercial research/evaluation. It must not be deployed as Wardrobe's commercial background-removal model without an appropriate license or replacement. No weights are committed or redistributed by this experiment.

Validation: the standalone TypeScript check passes; actual inference produced PNGs; visible RGB preservation and clearing of transparent pixels passed; the browser gallery loaded all six images and its background controls worked without horizontal overflow.
