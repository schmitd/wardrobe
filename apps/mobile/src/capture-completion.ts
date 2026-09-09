export type CaptureCompletion = "piece" | "fit" | "try_on";

export function captureCompletionDestination(completion: CaptureCompletion) {
  if (completion === "piece") return "/(tabs)/wardrobe" as const;
  if (completion === "fit") return "/(tabs)/fits" as const;
  return null; // Try-on has useful feedback to read before leaving.
}
