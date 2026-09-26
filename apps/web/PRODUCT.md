# Product

## Register

product

## Users

Style-curious, savvy consumers who want a more useful view of their closet than a generic upload grid. They care about fit, visual compatibility, and shopping decisions, but they are not looking for a luxury editorial experience or a blank AI assistant wrapper. They use the app to build a personal Wardrobe, understand individual items, and compare whether a garment works with their Wardrobe or styling goals.

## Product Purpose

Wardrobe is a closet manager and shopping companion. It helps users upload clothing items, retain structured style analysis, and compare pieces against their wardrobe context. Success means users can quickly recognize their items, trust the analysis, and make better outfit or shopping decisions without the interface getting in the way.

## Product Architecture

The signed-in experience has two primary destinations and one global action:

- **Wardrobe** contains the owned catalog, compact editable **Your style** notes, and **Collections**. Collections group owned pieces and saved inspiration around a mood, occasion, or routine. They live in a short horizontal rail directly under style notes.
- **Fits** opens with an immediate **Plan / Diary** switch. **Plan** means outfit recommendations for today and the next six days. **Diary** holds outfit history, try-ons, and corrections to past planned outfits.
- **Add** is the global capture action. Fits does not repeat large Fit check / Try on upload cards.

Account, privacy, authentication, and sign-out stay behind the header account affordance. Do not add Profile, Collections, or Plan as primary destinations. Legacy `/profile` and `/wardrobes` links route to their home inside Wardrobe. Existing wardrobe records remain the collection data model; no migration renames or replaces saved collections.

Open the entire item card to view its labels, manage collection membership, and leave a personal note. A shaped hang tag carries a collection affordance and a personal-note indicator; the caption names the piece. The entire card is the tap target. Attribute labels, collection membership, and personal notes are distinct sections.

Planning recalls relevant collections from reviewed activities or calendar events. It does not require a manual collection selection. Users can inspect the context, adjust pieces, accept a suggestion, and later confirm what they wore. Existing planned and worn outfits remain protected from regeneration.

## Brand Personality

Playful, specific, and useful. The product should feel designed around clothes and closet behavior, not around generic productivity software. It can use expressive moments where they clarify the wardrobe metaphor, but routine controls should stay familiar, legible, and task-focused.

## Anti-references

Avoid fashion editorial layouts, generic SaaS/dashboard templates, and common AI-interface tropes. Do not drift into brutalism as a shortcut for visual distinctiveness. Avoid excess pills, endless badge clusters, generic rounded cards, decorative gradients, and other Codex-pattern UI flourishes that make the product feel templated.

## Design Principles

Keep the rack metaphor central where it helps recognition: item rack cards should continue to read like shirts on hangers (upright compact cards in the catalog; sideways cards may remain in other surfaces), with neutral hangers, substantial rounded strokes, and physical hang tags. The upright hanger has a simple rounded hook and a complete closed outline with an empty center, layered behind the item photo. Collection circles show an ensemble of their actual pieces or inspiration; use a quiet folder only when no preview is available.

Make the interface playful through product-specific structure, not through arbitrary decoration. The clothing metaphor should explain the screen and make it memorable.

Use familiar product affordances for actions, forms, navigation, loading, and errors. Delight belongs in the wardrobe objects and transitions, not in reinvented controls.

Prefer specificity over genericism. Labels, empty states, and visual treatments should describe wardrobe work directly rather than using broad AI or SaaS language.

Keep visual density intentional. Metadata and style tags are useful, but they should not collapse into an overfilled field of pills or badges.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Maintain keyboard-accessible flows, visible focus states, readable contrast, meaningful image alt text for wardrobe items, and reduced-motion alternatives for any animation. No additional known user needs are currently specified.

## Interaction and copy contract (September 26, 2026)

User requests and later corrections outrank prior assistant proposals, generated renders and existing copy. See [the evidence and selected patterns](../../docs/design/add-action/README.md).

- Add has two equal actions: **Add owned outfit** and **Try on outfit**. It asks intent once; image routing remains automatic. No preselected ownership action or option subtitle.
- Reveal choices from their trigger with connected open/close motion. The + becomes × while open. Keyboard focus, dismissal, reduced motion and native safe areas are part of the interaction.
- Show the photo or useful result first. Titles and controls should carry routine tasks without an explanatory subtitle. Copy must help someone decide, recover, or understand a real limitation; do not narrate AI/provider/embedding/matching internals.
- Preparing an item photo is automatic. No original-photo switch or completed catalog-preview panel. Keep original evidence internally and fallback safely on failure.
- One task has one loading status and one completion signal. Do not add routine confirmations for automatically saved work.
- User-authored notes, useful styling advice, permissions, actual destructive consequences, and incomplete-data warnings are meaningful content and stay available.
- Do not infer ownership, dislike, wear, or preference from a default selection or from silence.
