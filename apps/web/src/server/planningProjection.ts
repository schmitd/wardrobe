type InternalPlanningItem = {
  id: string;
  description: string;
  category: string;
  imageUrl: string | null;
};

export function projectPlanningItems<T extends InternalPlanningItem>(
  items: readonly T[],
) {
  return items.map(({ id, description, category, imageUrl }) => ({
    id,
    description,
    category,
    imageUrl,
  }));
}
