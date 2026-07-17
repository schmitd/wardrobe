# Unified capture roadmap

## Product contract

The capture entry point asks the user for intent and lets vision decide photo scope.

| User intent | Visual scope | Result |
| --- | --- | --- |
| My wardrobe | Single piece | Add and analyze one owned closet item |
| My wardrobe | Full fit | Record the fit; auto-link only high-confidence existing garments |
| Just trying | Single piece | Closet compatibility feedback; never add to the owned rack |
| Just trying | Full fit | Outfit-level compatibility feedback; never add detected garments to the owned rack |

`Just trying` currently remains part of Fits history and Zep context, matching the existing try-on behavior, while staying outside the owned rack.

The user should not classify the image before capture. The router proceeds automatically above its confidence threshold. Below the threshold it asks only “One piece or full fit?” and then continues. Garment identity uses the existing policy: strong, unambiguous matches auto-link; lower-confidence candidates remain unresolved until the user nudges them in the fit review.

## Phase 1: mobile-first web

- A centered `+` is the only persistent capture action.
- Tapping it exposes `My wardrobe` and `Just trying` without opening a modal.
- Choosing intent opens the system photo picker, which can offer camera and library sources on mobile.
- A lightweight visual request routes `single_piece` versus `full_fit`.
- Existing item processing, fit recording, garment matching, compatibility, history, and Zep flows remain the downstream systems of record.
- Desktop uses the same controller through one `Add` action in the top navigation.

## Phase 2: Expo custom camera

### Route shape

```text
app/
  _layout.tsx                 root stack
  (tabs)/
    _layout.tsx               native tabs
    rack/
    fits/
    wardrobes/
    profile/
  capture/
    _layout.tsx               headerless modal stack
    index.tsx                 custom camera
    review.tsx                low-confidence correction only
```

### Camera behavior

- Eagerly request camera permission and lazily request photo-library permission.
- Show `My wardrobe / Just trying` directly above the shutter, as selected in the Camera Intent design.
- Provide gallery, shutter, flip-camera, and flash controls with platform-native symbols and haptics.
- Preserve the selected intent through the upload and routing request.
- Start with the last-used lens; first use defaults to the front camera during onboarding and the rear camera elsewhere.
- Compress and normalize orientation on-device before upload while preserving enough detail for garment crops and embeddings.
- If offline, retain a local pending capture and resume idempotently when connectivity returns.

### Shared contract

Move these types into `@wardrobe/shared` before the native camera ships:

```ts
type CaptureIntent = "my_wardrobe" | "just_trying";
type CaptureScope = "single_piece" | "full_fit";

type CaptureRoute = {
  intent: CaptureIntent;
  scope: CaptureScope;
  confidence: number;
  needsReview: boolean;
  captureId: string;
};
```

The server should accept an idempotency key and return a durable `captureId`. Both web and Expo can then resume the same state machine without duplicating a closet item or fit.

## Recommended backlog

1. **Consolidate visual routing and analysis.** The web phase uses a cheap routing pass followed by the existing item or fit analysis. Return reusable common detections from one model request to reduce latency and cost without coupling persistence to uncertain output.
2. **Create an authenticated capture API for Expo.** Replace the current proof-of-concept mobile client with signed upload, route, status, retry, and result endpoints using the shared contract.
3. **Choose the native tab treatment.** Prefer platform-native tabs with a center capture destination. Use a custom raised circular control only if exact visual parity outweighs native tab behavior and accessibility.
4. **Add capture-quality guidance.** Detect blur, poor light, missing full-body framing, or a garment occupying too little of the frame before upload when possible.
5. **Add durable upload recovery.** Background retries, idempotency, cancellation, and visible pending state are needed before production mobile release.
6. **Instrument router quality.** Record model scope, confidence, user correction, latency, downstream success, and add-versus-try intent. Never send the image itself to analytics.
7. **Clarify try-only retention.** Keep the existing behavior by default: try-ons appear in Fits/Zep but never in the owned rack. Add a private-session mode later only if users need ephemeral try-ons.
8. **Prepare face-aware photo discovery separately.** Treat future camera-roll face matching as an explicit-consent, on-device feature with platform permission review; it should not block the wardrobe capture architecture.

## Release gates for Phase 2

- Expo Go camera and gallery flows pass on one current iOS and one current Android device.
- Denied, limited, and revoked permissions recover without dead ends.
- Every intent/scope quadrant reaches the correct downstream result.
- Repeated upload retries do not duplicate items or fit history.
- Low-confidence scope and garment identity can be corrected with at most one lightweight review step.
- Native capture and system-picker fallback produce equivalent server records.
