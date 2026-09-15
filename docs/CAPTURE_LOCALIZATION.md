# Capture correctness, not crop-repair UX

Issue: #82. Product direction updated September 15, 2026.

The user should take one photo and receive a decomposed outfit. Manual recropping and asking users to move closer are not the primary solution. Automatic focusing, better localization and internal validation must carry the work. Never hallucinate detail that the source does not contain.

## Pipeline

1. Route worn multi-piece outfits to decomposition, including distant/partial outfits. Unknown routing never silently creates a generic catalog item.
2. Normalize EXIF orientation before detection. Use Gemini 2.5 Flash with thinking disabled for bounded localization latency, instead of Flash Lite's free-form xywh predictions.
3. Use Google's documented `[ymin, xmin, ymax, xmax] / 1000` box convention. Reject malformed/degenerate geometry rather than converting it to a one-pixel crop.
4. Detect the outfit extent, extract a closer view from original pixels, and detect individual garments in that view. Map coordinates back using the exact integer extraction rectangle.
5. Independently inspect the resulting garment crops. Failed items receive an automatic contextual close-up and one re-localization pass, followed by another check. Limit refinement to four items with concurrency two. No user decision screen is added.
6. Only verified crops enter garment matching/storage. Keep the original photo. Render garment images without a second destructive cover crop.

The verification model is not ground truth. Low-quality results can still pass, and missing detections can still occur. Keep human-reviewed regression fixtures and field failure rates as the quality gate; never claim perfect first-shot accuracy from these samples.

## Local evaluation

Private files stay in ignored `output/`; no photos, model responses, descriptions or source URLs are committed.

```sh
cd apps/web
bun --env-file=/path/to/private/env scripts/check-fit-localization.ts /path/to/private/photo.jpg ../../output/private-capture-run
# Optional stress variants: distant or mirrored
bun --env-file=/path/to/private/env scripts/check-fit-localization.ts /path/to/private/photo.jpg ../../output/private-distant-run distant
```

Initial evidence on the reported watch photo:

- Stored old crop: mostly forearm, watch at lower edge; native cover rendering hid it entirely.
- Initial dynamic-thinking candidate: 87 seconds; watch failed validation and was omitted. Not accepted as the fix.
- Tuned no-thinking candidate: separate top, bottom and watch accepted in repeated runs (approximately 13–37 seconds); watch was visually inspected inside the new crop.
- Synthetic distant fixture: three separate pieces, about 12 seconds. This is not the user's separate distant selfie.
- Mirrored fixture: three separate pieces, about 38 seconds on a successful run. An earlier verifier call timed out; requests now have a bounded automatic timeout retry.

Still required for a broader accuracy claim: the actual distant failure photo, diverse outfits/accessories, low-light/occlusion cases, physical-device capture, and deployed operational validation. These timings cover localization, not upload and all downstream embedding/storage work.

## Native design direction

The HTML component zoo is superseded, not an approved implementation spec. The next iOS design pass should use native navigation titles/toolbars, grouped form sections, native date-picker presentation, system sheets and standard text input/dictation behavior. Do not skin a web form to look vaguely iOS-like. Keep Android's platform conventions too. Any new native control dependency must be checked against the shipped runtime before claiming OTA compatibility.

## Sources

- [Google image understanding and bounding boxes](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Google thinking-budget configuration](https://ai.google.dev/gemini-api/docs/generate-content/thinking)

## Release

Server changes reach native and web clients without a binary update. Non-clipping native image presentation is a JS-only OTA candidate for compatible runtimes. Do not silently rewrite existing saved crops or upload private regression images to deployment artifacts.
