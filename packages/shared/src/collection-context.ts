// A conservative, bounded first-pass recall. Unmatched collections stay out of
// the prompt; the outfit model still decides how relevant recalled anchors are.
const stop = new Set(
  "a an and are as at be by for from i in is it my of on or the to with your this that today tomorrow week day outfit pieces collection edit saved ideas".split(
    " ",
  ),
);
const groups = [
  [
    "work",
    "office",
    "client",
    "meeting",
    "meetings",
    "presentation",
    "business",
    "professional",
    "interview",
    "tailoring",
  ],
  ["dinner", "restaurant", "date", "evening", "night", "cocktail"],
  ["hike", "hiking", "trail", "outdoor", "outdoors", "camping"],
  ["workout", "gym", "fitness", "running", "exercise"],
  ["wedding", "formal", "ceremony", "blacktie"],
  ["beach", "swim", "swimming", "pool", "seaside"],
  ["travel", "airport", "flight", "flying", "trip"],
];
function words(text: string) {
  return new Set(
    text
      .toLocaleLowerCase()
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((w) => w.length > 2 && !stop.has(w)) ?? [],
  );
}
export function recallCollections<
  T extends { id: string; name: string; description?: string | null },
>(collections: readonly T[], context: string): T[] {
  const query = words(context.slice(0, 4000));
  if (!query.size) return [];
  return collections
    .slice(0, 100)
    .map((collection, index) => {
      const terms = words(
        `${collection.name} ${collection.description ?? ""}`.slice(0, 1500),
      );
      let score = [...terms].filter((term) => query.has(term)).length * 2;
      for (const group of groups)
        if (group.some((w) => terms.has(w)) && group.some((w) => query.has(w)))
          score += 1;
      return { collection, score, index };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((c) => c.collection);
}
