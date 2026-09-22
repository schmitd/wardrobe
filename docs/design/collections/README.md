# Wardrobe collections and near-term Plan

Design review was approved for release on September 22 after adding weight to the neutral hanger and simplifying its rounded hook. The PR proceeds through the required merge and deployment checks.

This follows the September 21 design review and [product program #60](https://github.com/schmitd/wardrobe/issues/60). It supersedes the earlier use of “Plans” for moodboards on the web; existing saved collection records are retained.

## Review the interaction

- Wardrobe begins with compact editable style notes, then a horizontal collection rail. Collection circles compose actual member photos into small ensembles; empty collections use a quiet folder. Collections have immediate Pieces and Inspiration views, an edit control, and an Add from wardrobe picker.
- The entire shirt-shaped card opens its drawer. Labels, Collections, and My note are distinct; Manage changes membership and Save note persists the personal note. Neutral gray hangers have substantial rounded strokes, a simple curved hook, and a complete closed outline with an empty center, layered behind the garment photo so pieces overlap naturally. Lightly tinted garment silhouettes and shaped hanging tags retain the approved render's styling. Tags carry a collection affordance and an actual note indicator; the caption names the piece.
- Fits opens with Plan / Diary. Plan shows today plus six days, a description/dictation entry, nearby calendar context, and one selected outfit. The global Add action serves capture; duplicate upload cards are removed.
- Relevant collections are recalled automatically when generating a reviewed day or week. Already planned/worn outfits remain protected. Past planned outfits can still be corrected from Diary.

| Wardrobe | Item drawer | Plan |
| --- | --- | --- |
| ![Wardrobe on a phone](wardrobe-mobile.png) | ![Item labels, collections, and note](item-drawer-mobile.png) | ![Near-term outfit Plan](plan-mobile.png) |

[Original approved render](approved-render.png) · [Desktop Wardrobe](wardrobe-desktop.png)

The screenshots include the September 22 refinement: neutral hangers with an open center replace the original render's filled wooden shoulders, following David's real hanger reference. The final strokes have more weight and the hook has a simpler rounded curve.

Screenshots and the standalone gallery use synthetic garment illustrations, account data, and calendar events. The gallery renders the real components and stylesheet; external auth, storage, provider calls, and persistence boundaries are simulated. The application uses authenticated Convex functions, not gallery state.

## Run locally

```sh
bun install --frozen-lockfile
PROBE_PORT=4181 bun run apps/web/validation/browser/server.ts
```

Open `http://127.0.0.1:4181/` for Wardrobe and `/fits` for Plan / Diary. The synthetic gallery resets its data on full navigation; mutations persist within the current browser journey. No production credentials are needed.

```sh
PLAYWRIGHT_CHANNEL=chrome bun run probe:browser --plan docs/validation/collections.json --output output/playwright/collections-flow --port 4183
PLAYWRIGHT_CHANNEL=chrome bun run probe:browser --plan docs/validation/collections-edit.json --output output/playwright/collections-edit --port 4184
PLAYWRIGHT_CHANNEL=chrome bun run probe:browser --plan docs/validation/collections-inspiration.json --output output/playwright/collections-inspiration --port 4184
PLAYWRIGHT_CHANNEL=chrome bun run validate browser
bun test apps/web/confect/collections.integration.test.ts packages/shared/src/collection-context.test.ts
```

Omit `PLAYWRIGHT_CHANNEL=chrome` when using Playwright's installed Chromium, as CI does.

## Implementation scope and rollout checks

- This is the responsive web implementation. Native navigation and binaries are unchanged; existing native API fields remain compatible.
- Automatic collection recall uses bounded word/activity matching over up to 100 collections and recalls at most three. It includes owned collection pieces outside the recent inventory window and item notes in the generation prompt. Unmatched collections stay out of the prompt; the outfit model weighs the matched anchors against each day’s needs.
- Item notes are limited to 2,000 characters; up to 500 characters per item inform day and week generation. Collection membership in an item drawer is capped at 100 with an explicit truncation message; collection, owned-piece, and inspiration browsing are paginated. Ensemble previews scan at most 12 recent memberships for three authorized images per collection.
- Live Clerk/Gemini/Google Calendar delivery and a production Convex deployment were not exercised. Backend ownership, reactive cursor ranges/splitting, thumbnail updates, display-only projections, note persistence, and older-piece recall are covered by Convex integration tests. Calendar writes retain the consent revision captured before external reads, including across collection-context refreshes.

## Verification

- Full repository tests (119 web tests plus the workspace suites), lint, type checking, and production builds. Lint has three pre-existing warnings and no errors.
- Existing browser journeys cover past-outfit corrections, saved-but-stale feedback, multilingual week review, partial-calendar disclosure, and delayed try-on capture.
- The 29-step collection probe and separate edit and inspiration-upload probes cover full-card opening, labels, saving a note, Escape, collection creation, adding existing pieces, switching to inspiration, and removing membership.
- Browser layout checks at 320, 390, 767, 768, and 1280 pixels found no horizontal document/card overflow. At 390 × 844, the selected outfit's Use this fit action is visible above the bottom navigation.
