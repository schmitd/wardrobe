import { Schema } from "effect";

const words = Schema.String.check(Schema.isNonEmpty(), Schema.isMaxLength(8000));
const tags = Schema.Array(Schema.String.check(Schema.isMaxLength(120))).check(Schema.isMaxLength(30));
const piece = Schema.Struct({ category: words, description: words, style_tags: tags });
const fitPiece = Schema.Struct({ ...piece.fields,
  bounding_box: Schema.optionalKey(Schema.Struct({ x: Schema.Number, y: Schema.Number, width: Schema.Number, height: Schema.Number })),
  confidence: Schema.optionalKey(Schema.Number),
});
const bio = Schema.Struct({ bio: Schema.String.check(Schema.isMaxLength(8000)) });
export const modelResponses = {
  routeCapture: Schema.Struct({ capture_scope: Schema.optionalKey(Schema.Literals(["single_piece", "full_fit"])), confidence: Schema.optionalKey(Schema.Number), rationale: Schema.optionalKey(Schema.String) }),
  analyzeImageFull: piece,
  analyzeInspirationImage: piece,
  analyzeImageTags: Schema.Struct({ category: Schema.optionalKey(words), style_tags: tags }),
  analyzeImageDescription: Schema.Struct({ category: Schema.optionalKey(words), description: words }),
  evaluateCompatibility: Schema.Struct({ score: Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 100 })), explanation: words, best_pairings: Schema.Array(Schema.Number.check(Schema.isInt())), worst_clashes: Schema.Array(Schema.Number.check(Schema.isInt())) }),
  analyzeSelfie: Schema.Struct({ skin_tone: Schema.String, complexion: Schema.String, hair_color: Schema.String, color_season: Schema.String }),
  analyzeFitCheckPhoto: Schema.Struct({ transcription: words, items: Schema.Array(fitPiece).check(Schema.isMaxLength(30)) }),
  generateClosetBio: bio,
  generateMaintainedStyleBio: bio,
  compareGarmentCrops: Schema.Struct({ match_index: Schema.Number, confidence: Schema.Number, rationale: Schema.String }),
} as const;
