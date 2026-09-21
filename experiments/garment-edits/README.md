# Generative garment editing evaluation

The segmentation prototype is parked at David's request. This separate local study uses the built-in image generation/editing tool with the original verified item crop and full source photograph as context. Three initial edits and one edge-refinement attempt were executed. The tool does not expose an exact backend model version; this is not a measured GPT Image versus Nano Banana comparison. No API key or application inference integration was added.

Generate images with the built-in image editing tool using the saved prompts. For each item, supply its crop as the first image and the full photograph as the second. This package does not invoke a provider itself. Place the original crops at `output/cutout-prototype/generative-v1/{0,1,2}-before.jpg`, selected results at `{0,1,2}-generated.png`, and the additional pants attempt at `1-refinement.png`. These local inputs are intentionally absent from Git.

Install dependencies, rebuild the gallery from those private outputs, and serve locally:

```sh
bun install --cwd experiments/garment-edits --frozen-lockfile
bun experiments/garment-edits/generative-study.ts
bun experiments/garment-edits/serve.ts generative-v1 4919
```

Open http://127.0.0.1:4919/. Images and evidence remain ignored under `output/cutout-prototype/generative-v1/`. The three selected files are `0-generated.png`, `1-generated.png`, and `2-generated.png`. The additional `1-refinement.png` is retained for comparison. Exact initial prompts are in `generative-prompts.json`; the refinement prompt is in `generative-refinement-prompt.json`. Built-in original outputs were copied without modifying the pixels or alpha.

## Findings

- Polo: removes person and phone and reconstructs occluded cloth. Visually useful, but texture, emblem sharpness and hidden construction are generated rather than recovered.
- Trousers: produces a plausible complete pair. The input ends at the thigh, so waistband, pockets, length and lower-leg silhouette cannot be verified. An edge-only refinement also changed fabric details. The initial tool preview suggested exterior haze; decoded alpha samples and browser compositing showed a largely clear exterior, so that initial impression is not counted as a confirmed defect.
- Watch: removes skin but invents detailed case/strap geometry from only 72 by 50 pixels. This output cannot establish actual item identity; request a clearer photo or retain the original instead of automatically accepting it.

This limited study supports trying optional generated catalog previews, not replacing source evidence or claiming accurate recovery of hidden details. Store a derivative separately from the original and keep matching/identity anchored in source evidence if this proceeds. More fixtures are needed before product integration: patterned clothing and logos, layered garments, jewelry, footwear, multiple similar items, lighting changes and failed/ambiguous reconstructions.

Validation: standalone TypeScript check passes; all three initial outputs have real alpha channels; browser loaded all images with no horizontal overflow, and checkerboard controls worked. No production data changed, no deployment, no benchmark or latency/cost claim.
