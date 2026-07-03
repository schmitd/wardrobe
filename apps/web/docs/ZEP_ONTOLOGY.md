# Zep Wardrobe Ontology

This ontology is intentionally flexible. Zep recommends starting with a small number of generic custom entity and edge types, then expanding after observing extraction and retrieval quality. Zep also classifies each node or edge as at most one type, limits custom ontology size, and `setOntology` overwrites the previous custom ontology for the selected project, users, or graphs.

The source definitions live in `apps/web/convex/zepOntology.ts`. `setWardrobeOntology` in `apps/web/convex/zep.ts` applies them when explicitly invoked; it is not run automatically during normal app requests.

## Entity Types

- `WardrobeItem`: saved closet items already owned by the user.
- `CandidateItem`: quick-compare uploads, shopping candidates, haul items, wishlist pieces, and possible replacements.
- `WardrobeCollection`: collections, seasons, moods, capsules, aesthetics, occasions, trips, hauls, and planned closet directions.
- `StyleConcept`: reusable tags, garment roles, aesthetics, silhouettes, colors, materials, dress codes, contexts, preferences, and dislikes.
- `ProfileAttribute`: evolving user profile attributes such as color season, skin tone, hair color, style bio, fit preferences, lifestyle, and constraints.
- `WearContext`: real or planned situations where clothing is worn or evaluated, including events, weather, locations, activities, dress codes, and daily outfit contexts.

We rely on Zep's default `User` entity rather than redefining a custom user type.

## Edge Types

- `ADDED_TO_WARDROBE`: user saved or imported a wardrobe item.
- `REMOVED_FROM_WARDROBE`: user removed, archived, sold, donated, lost, damaged, replaced, or retired an item, preserving the reason.
- `COMPARED_CANDIDATE`: user compared a candidate item against their wardrobe, profile, or collection.
- `HAS_STYLE_CONCEPT`: any wardrobe-domain entity expresses a tag, role, aesthetic, material, color, occasion, or preference.
- `MEMBER_OF_WARDROBE`: item or candidate belongs to, is intended for, or was evaluated against a wardrobe collection.
- `CURATES_WARDROBE`: user creates, maintains, wants, edits, or builds around a collection or style goal.
- `PROFILE_ATTRIBUTE_SET`: user's profile attribute was stated, inferred, confirmed, corrected, or updated.
- `STYLE_RELATION`: flexible relation such as complements, clashes, duplicates, replaces, fills a gap, anchors, pairs well with, or avoids.
- `WORN_FOR`: item, candidate, or collection was worn, planned, recommended, or rejected for a wear context.

## Ingestion Guidance

Keep Zep messages narrative enough for extraction, but include stable application references in metadata or text when available.

Item addition:

```text
I added a wardrobe item.
Item id: <Convex wardrobeItems id>
Kind: footwear
Description: black leather loafers with a slim almond toe
Style concepts: polished, office, leather, minimal
Added reason: staple work shoe
```

Item removal:

```text
I removed a wardrobe item.
Item id: <Convex wardrobeItems id>
Description: cropped beige cardigan
Removal reason: poor fit in the shoulders
Replacement intent: wants a more structured knit layer
```

Candidate comparison:

```text
I compared a candidate item against my wardrobe.
Candidate upload id: <storage id or comparison id>
Kind: outerwear
Description: oversized olive waxed jacket
Style concepts: utilitarian, casual, weatherproof
Verdict: possible fit
Score: 0.72
Rationale: complements denim and boots, but may duplicate an existing casual jacket
Similar wardrobe item ids: <ids>
Clashing wardrobe item ids: <ids>
```

Profile update:

```text
My style profile was updated.
Attribute: hair_color
Previous value: dark brown
Current value: warm medium brown
Evidence: selfie analysis confirmed by user edit
```

Collection goal:

```text
I am building a wardrobe collection.
Collection kind: season
Intent: early fall office capsule
Mood words: crisp, polished, relaxed
Constraints: walkable shoes, variable weather, business casual
```

## Design Notes

- Do not encode every clothing category as an entity type. Use `item_kind` and `StyleConcept` so users can express their own closet language.
- Candidate comparisons should be ingested even when the user does not buy the item. Rejections, duplicates, and "almost but not quite" decisions are high-value style memory.
- Deletion reasons are not just audit logs; they create replacement and preference signals.
- Profile changes should be represented as time-aware updates rather than overwriting all context into a single static biography.
- `StyleConcept` should absorb both model-generated tags and user-authored concepts. It can represent "footwear", "top", "office", "romantic", "too boxy", or "winter palette" without forcing a rigid taxonomy.
