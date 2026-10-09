export type WearPiece = { id: string; category: string; wearPolicy?: "after_each_wear" | "rewear" | "check"; wearReadyAt?: number };
export type WearRecord = { date: string; itemIds: readonly string[]; wornAt: number };
export type RecommendationSignal = { itemId: string; at: number };
const DAY = 86_400_000;
/** Labels inferred from the garment model determine defaults; legacy readiness fields stay stored but inert. */
export function wearPolicy(piece: WearPiece) {
  return /\b(footwear|shoes?|sneakers?|boots?|outerwear|jackets?|coats?|accessor(?:y|ies)|watch|smartwatch|jewel(?:ry|lery)|bags?|belts?|hats?|scarves|scarf|sunglasses)\b/i.test(piece.category) ? "rewear" : "after_each_wear";
}
/** Seven local calendar dates after an actual wear; future records cannot cool earlier days. */
export function onWearCooldown(piece: WearPiece, history: readonly WearRecord[], date: string) {
  if (wearPolicy(piece) === "rewear") return false;
  const target = Date.parse(`${date}T12:00:00Z`);
  return history.some(wear => {
    const age = target - Date.parse(`${wear.date}T12:00:00Z`);
    return wear.itemIds.includes(piece.id) && age >= 0 && age < 7 * DAY;
  });
}
/** Gentle temporary preference: one point per removal, 7-day half life, cap 3, expire after 28 days. */
export function recommendationBackoff(id: string, signals: readonly RecommendationSignal[], at: number) {
  return Math.min(3, signals.reduce((score, signal) => {
    const age = at - signal.at;
    return score + (signal.itemId === id && age >= 0 && age < 28 * DAY ? 2 ** (-age / (7 * DAY)) : 0);
  }, 0));
}
/** A cooled spare never excludes the only remaining garment in its slot. */
export function availablePieces<T extends WearPiece>(items: readonly T[], history: readonly WearRecord[], date: string) {
  return items.filter(piece => !onWearCooldown(piece, history, date) || !items.some(other =>
    other.id !== piece.id && clothingSlot(other.category) === clothingSlot(piece.category) && clothingSlot(piece.category) !== null && !onWearCooldown(other, history, date)));
}
export function wearUsage(items: readonly WearPiece[], history: readonly WearRecord[]) {
  return new Map(items.map(piece => [piece.id, new Set(history.filter(wear => wear.itemIds.includes(piece.id)).map(wear => wear.date)).size]));
}
/** Clothing variety excludes shoes, accessories and removable outer layers. */
export function clothingSlot(category: string): string | null {
  if (/^(top|shirt|t-shirt|tee|polo|sweater|cardigan|blouse|mens polo shirt)$/i.test(category)) return "top";
  if (/^(bottom|trousers|pants|chinos|jeans|shorts|skirt)$/i.test(category)) return "bottom";
  if (/^(dress|jumpsuit|one.?piece)$/i.test(category)) return "one-piece";
  return null;
}
