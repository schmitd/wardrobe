export type CaptureScope = "single_piece" | "full_fit";

export type CaptureRoute = {
  scope: CaptureScope;
  confidence: number;
  needsReview: boolean;
  rationale: string;
};

export const normalizeCaptureRoute = (input: {
  capture_scope?: unknown;
  confidence?: unknown;
  rationale?: unknown;
  visible_garment_count?: unknown;
  is_catalog_set?: unknown;
}): CaptureRoute => {
  const recognizedScope =
    input.capture_scope === "single_piece" || input.capture_scope === "full_fit"
      ? input.capture_scope
      : null;
  const parsedConfidence = typeof input.confidence === "number" && Number.isFinite(input.confidence)
    ? input.confidence
    : 0;
  const confidence = Math.max(0, Math.min(1, parsedConfidence));

  return {
    // Multi-piece evidence takes precedence over a generic category/route label.
    // Unknown classification must not silently create one generic catalog item.
    scope: (input.is_catalog_set !== true && typeof input.visible_garment_count === "number" && Number.isInteger(input.visible_garment_count) && input.visible_garment_count >= 2)
      ? "full_fit" : recognizedScope ?? "full_fit",
    confidence,
    needsReview: false,
    rationale:
      typeof input.rationale === "string" && input.rationale.trim()
        ? input.rationale.trim().slice(0, 180)
        : "The photo framing did not make the capture type fully clear.",
  };
};
