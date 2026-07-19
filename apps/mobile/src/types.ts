export type CaptureIntent = "my_wardrobe" | "just_trying";
export type CaptureScope = "single_piece" | "full_fit";

export type WardrobeItem = {
  id: string;
  imageUrl: string;
  category: string | null;
  description: string | null;
  styleTags: string[] | null;
  analysisStatus: string;
  createdAt: number;
};

export type FitCheck = {
  _id: string;
  imageUrl: string | null;
  type: "daily_fit_check" | "try_on" | "candidate_fit_check";
  transcription?: string;
  description?: string;
  createdAt: number;
  items: Array<{ _id: string; category?: string; description?: string }>;
};

export type Collection = {
  _id: string;
  name: string;
  description?: string;
  moodWords?: string[];
  updatedAt: number;
};

export type MobileBootstrap = {
  items: WardrobeItem[];
  fitChecks: FitCheck[];
  wardrobes: Collection[];
  profile: { bio?: string } | null;
  currentUser: { name?: string | null; email?: string | null } | null;
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
