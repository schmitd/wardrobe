# Design QA

## Comparison target

- Source visual truth path: `artifacts/audit/01-current-home-viewport.jpg`
- Implementation screenshot path: `artifacts/audit/05-production-mobile-home.jpg`
- Authenticated-result review screenshot: `artifacts/audit/07-review-try-on-desktop-viewport.jpg`
- Inspiration-intake review screenshot: `artifacts/audit/08-review-inspiration-intake-viewport.jpg`
- Inspiration-shelf review screenshot: `artifacts/audit/09-review-inspiration-shelf-viewport.jpg`
- Viewports: 390 × 844 mobile home; 1440 × 1000 desktop review; 390 × 844 mobile review
- State: signed-out home/action entry and non-persistent authenticated result fixtures
- Full-view comparison evidence: `artifacts/audit/current-vs-updated-mobile.jpg`
- Focused region comparison evidence: `artifacts/audit/action-dock-comparison.jpg`

## Findings

- No actionable P0/P1/P2 visual mismatches remain.
- The three actions now read as separate product concepts: Add, Try on, and Inspire. The signed-out Try on action opens authentication and never reuses the closet uploader.
- The result state leads with a decision and explanation, then shows vector matches as closet anchors. This keeps the old top-k evidence without making similarity the recommendation itself.
- Inspiration intake clearly accepts photo and/or source attribution and repeats that closet inventory is unchanged.

## Required fidelity surfaces

- Fonts and typography: Oswald and Space Grotesk are retained. Existing uppercase hierarchy, weights, and letter spacing remain consistent. Mobile headings wrap without clipping.
- Spacing and layout rhythm: the existing square cards, heavy borders, offset shadows, and panel spacing are preserved. The action dock fits 390 px without horizontal scroll.
- Colors and visual tokens: the existing plum, paper, lilac, black-border, and white-panel tokens are preserved. Emerald and amber appear only as semantic feedback states.
- Image quality and asset fidelity: production continues to render the user's Convex-backed photos through Next Image. The review route uses locally stored, high-resolution Unsplash fixtures with intentional crops.
- Copy and content: “Try on” explicitly says the candidate is not added. “Inspiration” explicitly says it is separate from closet inventory. “Closet anchors” describes top-k vectors as evidence.

## Interaction and browser checks

- Signed-out Try on opened the Clerk sign-in dialog instead of the closet uploader.
- Prototype review tabs switched among Try-on result, Inspiration intake, and Inspiration shelf.
- Mobile and desktop layouts were checked for horizontal overflow; none remains.
- Browser console was checked on the production build. No current errors were found. The only current warning is the expected local Clerk development-key warning.
- Automated validation: 27 tests passed; lint has zero errors; production build passed.

## Comparison history

1. P1: signed-out Try check reused the closet uploader. Fixed by gating Try on and Inspire behind sign-in while keeping Add available to the guest closet demo.
2. P2: two unrelated FABs had ambiguous hierarchy and the guest upload copy overflowed horizontally on mobile. Fixed with a three-action dock and normal wrapping inside the guest upload control.
3. P2: the legacy fixed Sign in pill overlapped the new action dock. Removed the duplicate pill because Sign in remains in the navbar and in the gated actions.
4. Post-fix evidence: `artifacts/audit/05-production-mobile-home.jpg` at 390 × 844 has `scrollWidth === clientWidth`; `artifacts/audit/07-review-try-on-desktop-viewport.jpg` shows the final result hierarchy.

## Follow-up polish

- P3: the local production check uses Clerk development keys, so the signed-in live data path should be exercised once on the deployed preview with the intended preview Clerk configuration.

final result: passed
