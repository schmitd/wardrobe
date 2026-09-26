# Design

## Design Language

Wardrobe is a product UI with a playful closet metaphor. The rack item card is the expressive centerpiece: its shirt-on-hanger shape, physical hang tag, and photo-derived accent color should remain the most colorful and idiosyncratic object on the screen. Surrounding app chrome should support that metaphor with restraint.

The previous color passes went wrong in two ways. First, the supplied green and red/pink were treated as decoration even though users read them as state. Second, the blue/orange shell started to feel like a generic product palette laid over the rack metaphor. The app palette now starts from wardrobe materials: aubergine ink, chalk paper, mauve shell surfaces, and a sharp citron action color. Semantic green and danger pink remain available only when the interface is communicating state.

## Color Roles

Primary ink: `#241426`
- Main text, active navigation, high-contrast structural anchors.
- Use for readable type on pale surfaces.

Chalk paper: `#F7F3F5`
- Page background and quiet product surfaces.
- Use as the dominant neutral so rack item photo accents stay visually important.

Mauve shell: `#D8C9DC`
- App shell, navigation, low-emphasis support panels, neutral preview surfaces.
- Use as the main non-rack color family when the app needs personality before uploads.

Citron action: `#DCE66E`
- Primary action surfaces, upload prompts, onboarding emphasis, and inviting empty states.
- Use for calls to action when the action is not destructive or error-related.

Success green: `#3F7C5D`
- Success states, positive compatibility matches, valid/active input affordances, completed work.
- Do not use as a generic decorative panel color.

Danger pink: `#B93267`
- Errors, destructive actions, clashes, failed analysis, urgent recovery.
- Do not use as a promotional accent or general account/settings surface.

Rack item accents:
- Generated from each item photo and applied only inside rack item cards.
- Do not normalize these into the app palette; their variability is the point.

## Surfaces

Use square, light app panels with `1px` aubergine borders and a soft offset shadow around `3px 3px 0 rgb(36 20 38 / 0.11)`. The rack item card itself can keep a stronger illustrated outline because it is imitating physical rack material.

Default panels are white to chalk. Support panels use mauve or citron washes. Green and pink washes are reserved for semantic success/danger areas only.

## Components

Buttons remain square and direct. Primary non-destructive actions use citron with ink text, but app chrome should stay lighter than rack cards. Destructive actions use ink or danger treatment with clear destructive copy. Avoid pill badges; metadata should read as compact garment notes, labels, or physical hang tags.

Item removal lives at the bottom of the item detail drawer, after labels, collections, and notes. Confirm removal there with a reason; keep destructive controls off the rack cards. Pending analysis uses one small card badge without an additional blocking Processing overlay.

The guest demo starts with the closet bio concept, not a generic landing hero. Upload instructions sit as normal document structure, followed by a single clear `Add Clothes` button. Do not show an empty bio textarea before analysis; the editable bio appears only after the analysis has produced a draft.

If the guest demo hits its free limit, interrupt the flow with a clear blocking panel. The panel should explain that the demo is paused and offer both `Sign up` and `Sign in` actions so the user can continue without hunting for the next step.

The bottom rack action stack should float above content like app controls, but should not obscure the rack. It should feel like a tool dock, not a marketing CTA cluster.

The central Add control opens the existing capture menu. Keep capture in that one global entry point.

## Navigation And Hierarchy

Signed-in navigation is deliberately limited to **Wardrobe** and **Fits**, with **Add** as a prominent global action. On mobile, keep Add centered between those two destinations. On wider screens, keep the same order and hierarchy. Account, privacy, and sign-out live behind the header account affordance; do not restore Profile, Plans, or settings as peer tabs.

Style notes lead Wardrobe as two quiet lines of text with an edit affordance, without an enclosing panel. The collection rail follows immediately. Use one editable note for fit, color, comfort, body, and lifestyle context. Do not render complexion, hair color, season, or body type as separate profile cards, scores, or navigation.

## Collections And Fits

The Fits page is a visual diary. Its calendar uses the user’s own outfit photos as the primary activity signal and leaves unrecorded days quiet. Avoid numerical streak counters, longest-streak language, progress badges, or other gamified score surfaces.

Fit check, Try on, and inspiration use one direct photo button. It opens the device-native picker so mobile platforms can offer camera or library and desktop uses its normal file picker. Do not use drag-and-drop zones, two competing camera/library controls, or an upload form modal for a single photo.

Try-on feedback should read like a considered styling note, not a shopping scorecard. Lead with the verdict and explanation, ground it in a few owned closet anchors, and make the ownership boundary explicit. Compatibility colors are semantic: green for strong fit, pink only for a genuinely difficult fit, and neutral mauve/ink for mixed results.

Collections are named, user-described groups within Wardrobe. Use a condensed horizontal rail with an All pieces entry. Each circle composes up to three actual member images into an ensemble, with contained photos and a clear selected ring. The selected collection exposes Pieces and Inspiration side by side as immediate view controls; neither belongs below a long list of the other. Add existing owned pieces through a compact picker.

The full shirt-shaped card opens a bottom drawer on phones and a side drawer on larger screens. Preserve photo-derived accents and contain the whole garment photo. Use a neutral gray hanger with substantial rounded strokes, a simple rounded hook, curved shoulders, a complete closed outline, and an empty center. Draw the entire hanger behind the garment photo so the item can overlap it; do not fill the hanger or imply wood. Retain the lightly tinted garment silhouette and vertically hanging shaped tag. Tags show a collection affordance and a personal-note indicator; put the category and details arrow in the caption. In the drawer, show attribute Labels, Collections with Manage, and My note with an explicit Save action.

Fits starts with a Plan / Diary switch. Plan uses a seven-day strip and one selected outfit, with a short dictation prompt and calendar context nearby. Put Use this fit beside the outfit and keep swapping and explanations available as compact disclosures. No manual collection selector or duplicate capture cards. Past planned outfits can be corrected from Diary.

The approved design permits rounded rails, day selectors, and drawer corners where the approved mock uses them; keep the distinctive garment shapes and physical tags as the visual focus.

## Accessibility

Maintain WCAG 2.2 AA contrast. Body text should use ink or a dark hue-specific shade, never gray on colored backgrounds. Motion should be functional and respect reduced motion.
