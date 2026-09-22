# Garment image API evaluation

Evaluated 2026-09-22. The earlier merged study (PR #99) contained prompts and a local gallery, not an application integration. This change adds the first live catalog-preview workflow.

## Results

The older local Gemini key listed image models but had zero free-tier image quota. The existing Wardrobe AI Studio project already had billing enabled and a restricted working key; no billing change was needed. Nine paid Gemini edits were evaluated, including stricter extraction prompts.

| Candidate | Observed result |
| --- | --- |
| `gemini-3.1-flash-image` | Three original-prompt edits succeeded in about 8–9 seconds each, but returned opaque JPEGs with painted checkerboards. The polo emblem moved sides. Two refinement edits still had fidelity defects. |
| `gemini-3-pro-image` | Three original-prompt edits succeeded in about 15–17 seconds. Outputs were opaque; the initial polo lost its emblem. A stricter extraction prompt improved fidelity but still required chroma-key processing. |
| `gpt-image-2.5-sunburst`, medium, 1024 square | Three original-prompt edits succeeded in 13.6–16.2 seconds. All decoded as PNG with nonconstant alpha, including fully transparent pixels. Polo emblem position and overall appearance were retained. Trousers reconstructed unseen fabric plausibly. The 72×50 watch cannot establish reliable accessory identity. |
| Same OpenAI model, production generic prompt | Two additional successful edits (polo, trousers), 15.8 and 14.1 seconds. Actual service validation accepted alpha. Suitable as explicitly generative display previews; hidden construction remains invented. |

The first three OpenAI requests used approximately **$0.01968, $0.01885 and $0.01451**, calculated from returned token usage and the published text-input $5, image-input $8 and output-image $30 per million token rates. These are sample estimates, not fixed per-image prices or invoice totals. [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [image guide](https://developers.openai.com/api/docs/guides/image-generation).

The evaluated OpenAI outputs improve substantially on Gemini for this use case. Accept for a controlled rollout with originals retained, user restore controls, and tiny crops rejected before a paid request. This small sample does **not** establish universal logo, pattern, material, or accessory fidelity. No automatic bulk regeneration is included.

## Reproduce

Use Bun and ignored environment/output files. Never commit user photos, provider responses or credentials.

```sh
bun --env-file=.private/ai-studio.env experiments/garment-edits/evaluate-api.ts \
  /path/to/private/generative-v1 output/gemini-edit-evaluation
bun --env-file=.env.local experiments/garment-edits/evaluate-openai.ts \
  /path/to/private/generative-v1 output/openai-edit-evaluation
```

Inputs are `0-before.jpg`, `1-before.jpg`, `2-before.jpg`. Each evaluator stops a model on its first error/empty output without a paid retry. It saves private images, prompts, elapsed time, usage and alpha statistics. This API evaluation used crops alone; the original Codex tool study supplied full-photo context too, so it is not a controlled comparison with that tool.

Inspect against the original and composite the actual alpha on colored backgrounds. Checking the extension or viewing RGB channels alone cannot establish transparency. Production prompt and validation live in `apps/web/src/services/GarmentPreviewService.ts`; the fixture-specific evaluator is not the product prompt.

## Text model assessment

Existing Wardrobe analysis defaults to Gemini 2.5 Flash-Lite, with Gemini 2.5 Flash for fit detection and some fallbacks. Embeddings remain Gemini embedding 2 at 768 dimensions.

GPT-6 Luna is available to the new project key. One real polo-analysis request with strict JSON schema, reasoning `none`, and no response storage succeeded in 3.07 seconds: 545 input and 60 output tokens, approximately $0.0000845 at Standard rates. It returned valid short category, description and style tags. This is a smoke test, not evidence of equal intelligence or a cost-per-success frontier across all tasks.

Current Standard text rates per million tokens: Gemini 2.5 Flash-Lite $0.10 input / $0.40 output; GPT-6 Luna $0.10 / $0.50. GPT-6 Luna is a credible comparison candidate, but token counts, vision handling, reasoning, retries, and task accuracy determine total cost. Keep current text/embedding routing until a representative task suite establishes the tradeoff. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
