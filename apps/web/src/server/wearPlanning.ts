export type WearPiece = { id: string; category: string; wearPolicy?: "after_each_wear" | "rewear" | "check"; wearReadyAt?: number };
export type WearRecord = { date: string; itemIds: readonly string[]; wornAt: number };
export function wearPolicy(piece: WearPiece) {
  if (piece.wearPolicy) return piece.wearPolicy;
  return /^(footwear|shoes|sneakers|boots|outerwear|jacket|coat|cardigan|accessories?|watch|smartwatch|jewelry|bag|belt|hat)$/i.test(piece.category) ? "rewear" : "check";
}
export function needsPreparation(piece: WearPiece, history: readonly WearRecord[]) {
  return wearPolicy(piece) === "after_each_wear" && history.some(wear => wear.wornAt > (piece.wearReadyAt ?? 0) && wear.itemIds.includes(piece.id));
}
/** Recorded wear and this week's choices are facts; cleanliness remains user-correctable. */
export function wearUsage(items: readonly WearPiece[], history: readonly WearRecord[]) {
  return new Map(items.map(piece => [piece.id, history.filter(wear => wear.itemIds.includes(piece.id)).length]));
}
