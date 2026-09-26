export type StyleFitVerdict =
  | "strong_fit"
  | "good_fit"
  | "mixed"
  | "poor_fit"
  | "unknown";

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

export const recommendedInferenceModel = "gpt-6-luna";
export * from "./planning";
export * from "./planning-week";
export * from "./uploads";
export * from "./mobile";
export * from "./collection-context";
export * from "./wear";
