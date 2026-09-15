# Native week-first planner prototype

Interactive implementation of the approved Plans mockup. It preserves Wardrobe / Capture / Fits and the Diary / Plans split. Isolated from the real mobile application and user data; do not ship these sample adapters as production behavior.

## Run

From the repository root, use `bun install --frozen-lockfile`. Then:

```sh
cd apps/planner-prototype
bun run typecheck
bun run test
NODE_OPTIONS=--dns-result-order=ipv4first bun run dev -- --localhost
```

Open `exp://127.0.0.1:8084` in Expo Go on the local iOS simulator. Xcode commands on this machine need `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. Start Metro without `--ios` if macOS blocks the CLI's Simulator-focus automation. If native module errors appear after changing dependencies, restart Expo Go and Metro.

## Try it

1. Open Fits → Plans. Browse all seven days, move weeks, or choose a starting day with the native date picker.
2. Open a day, swap an owned sample garment, and plan the outfit. Mark it worn separately to see it in Diary.
3. Describe your week → try the sample dictation. Edit any interpreted day/date. Generate only the affected suggestions; planned/worn outfits stay intact.
4. Calendar opens from the native header, including inside dictation. More options → Preview Calendar sign-in lets you exercise success, cancellation and failure. It does not access a Google account.
5. Change simulator text size/appearance. Long content remains scrollable. More options → Reset this preview clears only local demo state.

## Real versus simulated

| Real in this prototype                                                   | Deliberately simulated / not validated                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Native navigation, form sheets, date picker, segmented control, switches | Google OAuth and sample Work/Personal events                                |
| Editable transcript and interpreted-date correction                      | AI parsing: local full-weekday rule adapter only                            |
| Stateful seven-day suggestions, per-piece swaps, planned/worn lifecycle  | Outfit intelligence: deterministic six-garment adapter                      |
| Local draft/outfit persistence and protected bulk updates                | Spoken microphone transcription: system keyboard path not end-to-end tested |
| Light/dark and large-text layouts                                        | Android/web parity and full VoiceOver audit                                 |

This app sends no product requests or analytics. The local key is `wardrobe-native-design-week-v2`. Only sample data should be entered. Production integration must use existing Wardrobe authentication, APIs, Google authorization return handling and privacy-masked observability. Check native-module/runtime compatibility before deciding OTA versus a new binary; the date picker and segmented-control dependencies are native.

Validation details: [design review](../../docs/PLANS_NATIVE_REVIEW.md). The ignored `output/ios-planner/` folder contains actual simulator screenshots and an unedited walkthrough; it is not a generated mockup.

## Generated garment asset

Project asset: `assets/sample-garments.png`. Created with the built-in image generation tool on September 15, 2026. Six synthetic catalog garments; no personal photographs. The original atlas is rendered through native clipped views, not rewritten into cropped files.

Exact generation prompt:

> Create a single clean product-photo sprite atlas for a wardrobe app prototype. Canvas exactly square. Invisible regular 3-column by 2-row grid of SIX cells, equal cell widths and heights, all pure white background, no borders, absolutely no text or labels. Each clothing item is completely inside its own cell with generous white margin, centered and isolated, catalog front-view photography, no models/humans/hangers/logos, subtle realistic fabric texture. Top row left cell: one ecru long-sleeve button shirt. Top row center cell: one pair dark charcoal straight-leg trousers. Top row right cell: pair brown leather loafers. Bottom row left cell: one navy short-sleeve knit polo. Bottom row center cell: one pair olive straight-leg trousers. Bottom row right cell: pair plain white low-top sneakers. Ensure six entirely separated objects, precisely six equal cells; no objects cross cell boundaries. Shirts and trousers photographed front-on laid flat or invisible-mannequin; shoes three-quarter pair view. Photo-like, tasteful, gender-neutral styling. The top and bottom halves each contain exactly three items centered in their own cell. All background pure white. This is one application sprite atlas, not a UI mockup.
