export type CaptureIntent = "my_wardrobe" | "just_trying";
export type CaptureScope = "single_piece" | "full_fit";

export type WardrobeItem = {
  id: string;
  imageUrl: string;
  category: string | null;
  description: string | null;
  styleTags: string[] | null;
  analysisStatus: string;
  analysisError?: string | null;
  createdAt: number;
};

export type GarmentCandidate = {
  id: string;
  imageUrl: string | null;
  category: string | null;
  description: string | null;
  score: number;
};

export type GarmentObservation = {
  id: string;
  category: string;
  description: string;
  cropUrl: string | null;
  resolutionStatus: "auto_matched" | "needs_confirmation" | "confirmed" | "unresolved" | "promoted_new" | "rejected";
  matchScore: number | null;
  candidates: GarmentCandidate[];
};

export type FitCheck = {
  id: string;
  imageUrl: string | null;
  type: "daily_fit_check" | "try_on" | "candidate_fit_check";
  transcription: string | null;
  description: string | null;
  createdAt: number;
  items: Array<{ id: string; category: string | null; description: string | null }>;
  observations: GarmentObservation[];
};

export type CollectionItem = {
  _id: string;
  membershipKind: string;
  item: Pick<WardrobeItem, "id" | "imageUrl" | "category" | "description" | "styleTags">;
};

export type Inspiration = {
  id: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  category: string | null;
  description: string | null;
  styleTags: string[];
  createdAt: number;
};

export type Collection = {
  _id: string;
  name: string;
  description?: string;
  moodWords?: string[];
  updatedAt: number;
  items: CollectionItem[];
  inspirations: Inspiration[];
};

export type MobileBootstrap = {
  items: WardrobeItem[];
  fitChecks: FitCheck[];
  wardrobes: Collection[];
  profile: {
    bio: string | null;
    skinTone: string | null;
    complexion: string | null;
    hairColor: string | null;
    colorSeason: string | null;
  } | null;
  currentUser: { name?: string | null; email?: string | null } | null;
  latestSelfie: { storageId: string; url: string; createdAt: number } | null;
};

export type SelfieAnalysis = {
  skin_tone: string;
  complexion: string;
  hair_color: string;
  color_season: string;
};

export type CaptureRoute = {
  scope: CaptureScope;
  confidence: number;
  rationale: string;
  needsReview: boolean;
};

export type CompatibilityResult = {
  storageId: string;
  candidate: { category: string; description: string; style_tags: string[] };
  similarItems: Array<WardrobeItem & { similarity: number }>;
  dissimilarItems: Array<WardrobeItem & { similarity: number }>;
  evaluation: { score: number; explanation: string } | null;
  message?: string;
};
