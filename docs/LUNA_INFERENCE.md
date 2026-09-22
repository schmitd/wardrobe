# Luna generation with Google multimodal embeddings

All application text and vision generation uses `gpt-6-luna` through the shared Effect `InferenceService`. This includes catalog analysis, capture routing/localization and crop verification, direct garment comparison, compatibility, style memory, shopping context, and day/week planning. Reasoning is explicitly `none`; the existing bounded output budgets and application response validators remain in force. Audio uses `gpt-4o-mini-transcribe`, since Luna is not the transcription endpoint. There is no Gemini generation fallback.

Google remains the embedding provider. `GeminiService` still sends original image bytes and optional context directly to `gemini-embedding-2`, with 768 output dimensions. Text queries and batch embeddings use the same model and dimensions. No captions substitute for image embeddings. This change does not modify vector indexes, stored embeddings, identity thresholds, or ownership checks, and requires no data migration.

## Provider boundary

`InferenceService` converts application schemas to strict Responses API JSON schemas and decodes the provider envelope before returning text to operation-specific validators. Refusals, incomplete responses, malformed envelopes, and empty generation output fail safely. HTTP 429/5xx and transport failures retain transient classification for existing bounded workflow retries; authentication and malformed-success failures do not receive blanket retries. Effect interruption reaches the native fetch signal. Requests use `store: false`.

The Google capability is memoized with the generation layer in the shared runtime. Embedding-only calls do not require an OpenAI key. The complete layer requires `GEMINI_API_KEY` because Google embeddings remain an application capability.

## Cache policy

One-off requests use explicit caching without a breakpoint, avoiding unnecessary cache writes. Parts explicitly marked `cache: "reuse"` create a provider cache boundary. The crop verification/repair loop marks its stable instructions and original-photo prefix; variable crop labels and images follow it. The repair verification can reuse that prefix. A repair is not guaranteed, so a first verification may incur a write without a later read. Provider eligibility and hits are measured rather than assumed. There are currently no application Responses tool-call loops; tool results must be explicitly selected for reuse if such loops are added.

Provider cache TTL is 30 minutes. `store: false` disables saved Responses objects, not provider prompt caching. No application cache stores photos or transcripts. Cache usage is separate from application persistence and authorization; every operation continues to perform its normal ownership checks.

Server spans record model, ordinary input/output totals, cached tokens, written tokens, and estimated cost, without prompts, images, response content, cache keys, or raw provider errors. The September 22, 2026 Luna estimate uses $0.10 ordinary input, $0.125 cache writes, $0.01 cache reads, and $0.50 output per million tokens. Writes replace ordinary input charges for those tokens; they are not added twice. Update these rates when provider pricing changes.

## Evaluation and validation

The initial comparison used 60 primary calls across 15 Wardrobe fixtures, plus eight controls. Luna's calendar interpretation cost about $0.053 per 1,000 calls versus $3.351 for the existing Gemini Flash configuration in this small sample; disabling Flash thinking reduced cost but failed two of four date controls. Luna vision averaged about $0.060 per 1,000 calls versus $0.066 for uncached Flash Lite. Other tasks were mixed: Luna used more tokens on some compatibility/bio/query responses, with better grounding or complementary queries on several fixtures. These are bounded fixture results, not a general quality or cost ranking.

A separate four-call shared-prefix check measured 55.7% lower total cost including the cache write; tool-result reuse also returned valid owned-item selections. All 11 cache checks completed successfully. Private input/output artifacts remain local and ignored.

The integrated service passed live garment analysis, closet bio, an identical-image comparison control, synthetic-audio transcription, and direct Google image/text embeddings (768 finite values each). The saved synthetic distant-photo fixture produced three verified pieces (shirt, trousers, watch) in 11.9 seconds. Crops were visually inspected. This single fixture and the identical-image control do not establish broad localization or instance-matching accuracy.

Deterministic checks cover malformed/refused/incomplete provider responses, transient versus permanent HTTP failures, interruption, embedding passthrough, multipart audio, and cache accounting. Repository tests, types, lint, builds, generated adapter drift, and three browser journeys pass. Browser fixtures do not prove live authentication, Calendar access, or persistence with the paid model.

Repeat the paid service check with existing local credentials and private files:

```sh
cd apps/web
bun --env-file=/path/to/private/env scripts/check-luna.ts /path/to/private/photo.jpg /path/to/synthetic.wav ../../output/private-luna-run
bun --env-file=/path/to/private/env scripts/check-fit-localization.ts /path/to/private/photo.jpg ../../output/private-luna-localization
```

## Rollout

Configure the existing `OPENAI_API_KEY` in both the web host and Convex before deploying. Keep `GEMINI_API_KEY` in both environments. Scheduled style-memory actions execute in Convex; setting the web host's environment alone is insufficient. The OpenAI project must permit Responses and audio transcription. Local paid checks verified these endpoints with the project key; no production environment change or deployment is part of this PR.

After deployment, verify signed-in capture, direct existing-item matching, planning, transcription, scheduled style-memory generation, and safe Axiom span ingestion. Monitor accepted crop counts, latency, errors, and token/cache usage. Existing stored vectors remain valid when reverting this generation migration.

Sources: [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [speech to text](https://developers.openai.com/api/docs/guides/speech-to-text).
