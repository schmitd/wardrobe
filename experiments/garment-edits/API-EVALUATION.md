# AI Studio image-editing evaluation

Status on 2026-09-22: blocked by the available key's image-generation quota;
no generated API results and no application integration.

The existing `GEMINI_API_KEY` successfully listed all four image models below.
One real edit request per model, using the saved polo crop, returned HTTP 429
`RESOURCE_EXHAUSTED`. Each response identified free-tier per-project image-model
request and input-token limits of **0**. This is not evidence about output quality.
No retries were attempted. Available local Wardrobe environment copies contained
the same key. A fresh Vercel production environment export masks its key as
`[SENSITIVE]`, so that protected credential could not be compared or tested.

| Model | Intended evaluation role | Request result |
| --- | --- | --- |
| `gemini-3.1-flash-image` (Nano Banana 2) | Primary candidate: reference fidelity and cost balance | Zero quota |
| `gemini-3-pro-image` (Nano Banana Pro) | Higher-cost quality comparison | Zero quota |
| `gemini-3.1-flash-lite-image` | Lower-cost alternative | Zero quota |
| `gemini-2.5-flash-image` | Older-model availability control | Zero quota |

Google's [image-editing guide](https://ai.google.dev/gemini-api/docs/image-generation)
describes these models. Its [pricing](https://ai.google.dev/gemini-api/docs/pricing)
lists no free API tier for image generation. At the time of evaluation, 1K image
output was approximately $0.067 for Nano Banana 2 and $0.134 for Pro, plus input
and text/thinking charges. Confirm pricing before a larger evaluation.

## Resume

With image-model quota enabled on the existing project (or an authorized existing
billed key), run from the repository root. Keep credentials in an ignored local
environment file and never include their values in shell arguments or logs.

```sh
bun install --cwd experiments/garment-edits --frozen-lockfile
bun --env-file=.env.local experiments/garment-edits/evaluate-api.ts \
  /path/to/private/generative-v1 output/gemini-edit-evaluation
```

The input directory contains `0-before.jpg`, `1-before.jpg`, and `2-before.jpg`
from the earlier polo, trousers, and watch study. The default comparison makes at
most six requests, stops each model on its first error/empty response, and writes
private images, exact prompts, timing, token usage and decoded alpha metadata.
This pass uses crops alone; the prior Codex image-tool study also supplied full
photograph context. Do not treat them as a controlled head-to-head comparison.

Inspect every result against its input: color, material, logo placement, garment
shape, removed skin/objects, invented details and actual transparency (a PNG or
painted checkerboard is not proof of alpha). Extend beyond the three original
cases to patterned/logo clothing and difficult accessories before accepting broad
automatic use. If quality passes, implement separately stored generated previews
with original evidence retained for identity/matching, fallback on failure, and
an explicit route for existing items. Do not enable unassessed generation merely
because a model appears in the API list.
