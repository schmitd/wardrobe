export type StyleFitVerdict = "strong_fit" | "good_fit" | "mixed" | "poor_fit" | "unknown";

export type StyleFitRequest = {
  imageUrl?: string;
  pageUrl?: string;
  title?: string;
  description?: string;
  userContext?: string;
};

export type StyleFitResponse = {
  verdict: StyleFitVerdict;
  score: number;
  summary: string;
  reasons: string[];
  model: string;
};

export const recommendedGoogleModel = "gemini-2.5-flash";
