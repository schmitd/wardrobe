export type CaptureScope = "single_piece" | "full_fit";

export const CAPTURE_ROUTE_AUTO_CONFIDENCE = 0.74;

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
    scope: recognizedScope ?? "single_piece",
    confidence,
    needsReview: recognizedScope === null || confidence < CAPTURE_ROUTE_AUTO_CONFIDENCE,
    rationale:
      typeof input.rationale === "string" && input.rationale.trim()
        ? input.rationale.trim().slice(0, 180)
        : "The photo framing did not make the capture type fully clear.",
  };
};
