"use node";

import { entityFields, type EdgeType, type EntityType } from "@getzep/zep-cloud";

export const wardrobeEntityTypes = {
  WardrobeItem: {
    description:
      "A saved closet item owned by the user. Prefer this for physical garments, shoes, accessories, bags, outerwear, jewelry, and other wearable items already in the wardrobe.",
    fields: {
      item_kind: entityFields.text("Flexible garment role such as top, bottom, footwear, outerwear, accessory, bag, jewelry, or user-specific wording."),
      description: entityFields.text("Natural-language item description including visible color, material, silhouette, pattern, condition, and notable details."),
      colors: entityFields.text("Observed or user-described colors, color families, contrast level, or palette notes."),
      materials: entityFields.text("Observed or user-described fabrics, textures, finishes, or construction details."),
      source_ref: entityFields.text("Application reference such as Convex item id, upload id, URL, brand, retailer, or other stable identifier when available."),
    },
  },
  CandidateItem: {
    description:
      "An item being evaluated before it is added to the wardrobe. Use this for quick-compare uploads, shopping candidates, haul items, wishlist pieces, and possible replacements.",
    fields: {
      item_kind: entityFields.text("Flexible garment role such as top, bottom, footwear, outerwear, accessory, bag, jewelry, or user-specific wording."),
      description: entityFields.text("Natural-language candidate description including color, material, silhouette, pattern, and purchase context."),
      colors: entityFields.text("Candidate colors, color families, contrast level, or palette notes."),
      purchase_context: entityFields.text("Where the candidate came from, why it is being considered, price or brand details, or user intent when known."),
      source_ref: entityFields.text("Application reference such as quick-compare upload id, product URL, retailer URL, or other stable identifier when available."),
    },
  },
  WardrobeCollection: {
    description:
      "A user-defined wardrobe grouping or goal, including collections, seasons, moods, capsules, aesthetics, occasions, trips, hauls, and planned closet directions.",
    fields: {
      collection_kind: entityFields.text("Flexible grouping type such as season, capsule, mood, trip, occasion, haul, workwear, or user-defined category."),
      intent: entityFields.text("What the user wants this wardrobe or collection to accomplish."),
      timeframe: entityFields.text("Relevant time period such as spring, winter, upcoming trip dates, work season, or ongoing."),
      constraints: entityFields.text("Budget, climate, dress code, comfort, body, maintenance, sustainability, or other constraints."),
      mood_words: entityFields.text("User language for the desired feeling, aesthetic, or concept."),
    },
  },
  StyleConcept: {
    description:
      "A reusable style, concept, tag, garment role, silhouette, color idea, material, aesthetic, dress code, outfit function, or context of wear.",
    fields: {
      concept_kind: entityFields.text("Flexible concept type such as tag, aesthetic, silhouette, color, material, garment_role, occasion, dress_code, fit, or preference."),
      wording: entityFields.text("The user's or model's exact phrasing for the concept when available."),
      polarity: entityFields.text("Whether this is liked, disliked, neutral, aspirational, contextual, or unknown."),
      context: entityFields.text("Where or how the concept applies, such as office, formal, footwear, summer, travel, layering, or everyday wear."),
    },
  },
  ProfileAttribute: {
    description:
      "A user style-profile attribute that can evolve over time, including color season, skin tone, complexion, hair color, style bio, proportions, fit preferences, lifestyle, and constraints.",
    fields: {
      attribute_kind: entityFields.text("Flexible attribute type such as color_season, skin_tone, hair_color, style_bio, fit_preference, lifestyle, sizing, or constraint."),
      value_text: entityFields.text("Current or observed value for the profile attribute."),
      evidence: entityFields.text("Where the value came from, such as selfie analysis, user edit, outfit feedback, or inferred wardrobe pattern."),
      confidence: entityFields.text("Confidence level or uncertainty wording when available."),
    },
  },
  WearContext: {
    description:
      "A real or planned context where clothing is worn or evaluated, including daily fit checks, try-ons, occasions, events, weather, locations, activities, dress codes, and daily outfit situations.",
    fields: {
      context_kind: entityFields.text("Flexible context type such as occasion, event, activity, weather, location, dress_code, mood, or day_plan."),
      description: entityFields.text("Natural-language description of the wear context."),
      timeframe: entityFields.text("Date, season, time of day, recurrence, or planned/historical timing when known."),
      constraints: entityFields.text("Comfort, weather, mobility, formality, cultural, professional, or user-specific constraints."),
    },
  },
} satisfies Record<string, EntityType>;

export const wardrobeEdgeTypes = {
  ADDED_TO_WARDROBE: {
    description:
      "The user added or saved a wardrobe item. Use for item uploads, batch imports, migrations, and confirmed purchases moved from candidate to wardrobe.",
    fields: {
      added_reason: entityFields.text("Why the item was added, if known."),
      source_ref: entityFields.text("Application item id, upload id, batch id, or product URL when available."),
      event_time: entityFields.text("When the add happened, expressed exactly as provided."),
    },
    sourceTargets: [{ source: "User", target: "WardrobeItem" }],
  },
  REMOVED_FROM_WARDROBE: {
    description:
      "The user removed, archived, sold, donated, lost, damaged, replaced, or otherwise retired a wardrobe item. Preserve the user's reason.",
    fields: {
      removal_reason: entityFields.text("The user's stated reason, such as disliked style, damaged/lost, poor fit, duplicate, sold, donated, or other custom wording."),
      replacement_intent: entityFields.text("Whether this creates a replacement opportunity or related shopping need."),
      event_time: entityFields.text("When the removal happened, expressed exactly as provided."),
    },
    sourceTargets: [{ source: "User", target: "WardrobeItem" }],
  },
  COMPARED_CANDIDATE: {
    description:
      "The user compared a candidate item against their wardrobe, profile, or collection. Use for compatibility checks even if the candidate is rejected.",
    fields: {
      verdict: entityFields.text("Overall judgment such as strong fit, possible fit, weak fit, reject, duplicate, fills gap, or needs more context."),
      score: entityFields.float("Compatibility score when provided by the app."),
      rationale: entityFields.text("Concise reason for the verdict, including wardrobe fit and user-style fit."),
      source_ref: entityFields.text("Application upload id, product URL, trace id, or comparison id when available."),
      event_time: entityFields.text("When the comparison happened, expressed exactly as provided."),
    },
    sourceTargets: [{ source: "User", target: "CandidateItem" }],
  },
  HAS_STYLE_CONCEPT: {
    description:
      "An item, candidate, collection, profile attribute, or wear context expresses or is associated with a style concept, tag, role, aesthetic, material, color, or occasion.",
    fields: {
      relevance: entityFields.text("How the concept applies, such as primary category, generated tag, user tag, inferred, aspirational, disliked, or contextual."),
      confidence: entityFields.text("Confidence or uncertainty wording when available."),
    },
    sourceTargets: [
      { source: "WardrobeItem", target: "StyleConcept" },
      { source: "CandidateItem", target: "StyleConcept" },
      { source: "WardrobeCollection", target: "StyleConcept" },
      { source: "ProfileAttribute", target: "StyleConcept" },
      { source: "WearContext", target: "StyleConcept" },
    ],
  },
  MEMBER_OF_WARDROBE: {
    description:
      "An item or candidate belongs to, is intended for, or was evaluated against a user-defined wardrobe collection, season, capsule, mood, haul, or goal.",
    fields: {
      membership_kind: entityFields.text("How the item relates, such as included, planned, candidate, rejected, wishlist, replacement, staple, orphan, or uncertain."),
      rationale: entityFields.text("Why the item does or does not belong in the collection."),
    },
    sourceTargets: [
      { source: "WardrobeItem", target: "WardrobeCollection" },
      { source: "CandidateItem", target: "WardrobeCollection" },
    ],
  },
  CURATES_WARDROBE: {
    description:
      "The user creates, maintains, wants, edits, or builds around a wardrobe collection, season, capsule, mood, haul, or style goal.",
    fields: {
      intent: entityFields.text("The user's purpose or goal for the collection."),
      status: entityFields.text("Collection status such as active, planned, stale, complete, paused, archived, or exploratory."),
    },
    sourceTargets: [{ source: "User", target: "WardrobeCollection" }],
  },
  PROFILE_ATTRIBUTE_SET: {
    description:
      "The user's profile attribute was stated, inferred, confirmed, corrected, or updated. Use this edge to preserve profile evolution over time.",
    fields: {
      update_kind: entityFields.text("Whether the value was created, edited, confirmed, corrected, inferred, or contradicted."),
      previous_value: entityFields.text("Previous value when known."),
      event_time: entityFields.text("When the profile update happened, expressed exactly as provided."),
    },
    sourceTargets: [{ source: "User", target: "ProfileAttribute" }],
  },
  STYLE_RELATION: {
    description:
      "A flexible style relationship between two wardrobe-domain nodes, such as complements, clashes with, duplicates, replaces, fills a gap, anchors, requires, or pairs well with.",
    fields: {
      relation_kind: entityFields.text("The specific relationship, such as complements, clashes, duplicates, replaces, fills_gap, anchors, pairs_with, or avoids."),
      rationale: entityFields.text("Why this relationship exists."),
      strength: entityFields.text("Strength or confidence such as high, medium, low, uncertain, or a numeric similarity if provided."),
    },
    sourceTargets: [
      { source: "CandidateItem", target: "WardrobeItem" },
      { source: "WardrobeItem", target: "WardrobeItem" },
      { source: "CandidateItem", target: "StyleConcept" },
      { source: "WardrobeItem", target: "StyleConcept" },
      { source: "CandidateItem", target: "WardrobeCollection" },
      { source: "WardrobeItem", target: "WardrobeCollection" },
    ],
  },
  WORN_FOR: {
    description:
      "An item, candidate, or collection was worn, tried on, planned, recommended, or rejected for a wear context such as a daily fit check, try-on, event, daily outfit, weather, location, or dress code.",
    fields: {
      usage_kind: entityFields.text("How it was used, such as worn, planned, recommended, rejected, avoided, packed, or repeated."),
      feedback: entityFields.text("User or model feedback about how it worked in that context."),
      event_time: entityFields.text("When the wear event happened or is planned, expressed exactly as provided."),
    },
    sourceTargets: [
      { source: "WardrobeItem", target: "WearContext" },
      { source: "CandidateItem", target: "WearContext" },
      { source: "WardrobeCollection", target: "WearContext" },
    ],
  },
} satisfies Record<string, EdgeType>;
