# Design

## Design Language

Wardrobe is a product UI with a playful closet metaphor. The rack item card is the expressive centerpiece: its shirt-on-hanger shape, physical hang tag, and photo-derived accent color should remain the most colorful and idiosyncratic object on the screen. Surrounding app chrome should support that metaphor with restraint.

The previous color pass went wrong by treating every supplied color as decorative. In product UI, color carries meaning. Green and pink/red read as state, so using them for ordinary panels made the interface feel incoherent and louder than the workflow required.

## Color Roles

Primary ink: `#310A31`
- Main text, active navigation, high-contrast structural anchors.
- Use for readable type on pale surfaces.

Shell blue: `#B5CEDE`
- App shell, navigation, low-emphasis support panels, neutral preview surfaces.
- Use as the main non-rack color family when the app needs personality before uploads.

Warm amber: `#EAC99A`
- Primary action surfaces, upload prompts, onboarding emphasis, and inviting empty states.
- Use for calls to action when the action is not destructive or error-related.

Success green: `#96CFB7`
- Success states, positive compatibility matches, valid/active input affordances, completed work.
- Do not use as a generic decorative panel color.

Danger pink: `#D43A7B`
- Errors, destructive actions, clashes, failed analysis, urgent recovery.
- Do not use as a promotional accent or general account/settings surface.

Rack item accents:
- Generated from each item photo and applied only inside rack item cards.
- Do not normalize these into the app palette; their variability is the point.

## Surfaces

Use square, light app panels with `2px` black borders and a soft offset shadow around `5px 5px 0 rgb(0 0 0 / 0.18)`. Avoid the earlier heavy `4px` borders and hard `8px` black shadows except where a component is intentionally imitating physical rack material.

Default panels are white to pale lilac. Support panels use sky or amber washes. Green and pink washes are reserved for semantic success/danger areas only.

## Components

Buttons remain square and direct. Primary non-destructive actions use amber with ink text. Destructive actions use ink or danger treatment with clear destructive copy. Avoid pill badges; metadata should read as compact garment notes, labels, or physical hang tags.

The bottom rack action stack should float above content like app controls, but should not obscure the rack. It should feel like a tool dock, not a marketing CTA cluster.

## Accessibility

Maintain WCAG 2.2 AA contrast. Body text should use ink or a dark hue-specific shade, never gray on colored backgrounds. Motion should be functional and respect reduced motion.
