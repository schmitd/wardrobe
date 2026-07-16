import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthenticatedUserId } from "./authIdentity";

export const getGarmentObservations = query({
  args: { observationIds: v.array(v.id("garmentObservations")) },
  handler: async (ctx, { observationIds }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const observations = await Promise.all(observationIds.map((id) => ctx.db.get(id)));
    return observations.map((observation) => observation?.userId === userId ? observation : null);
  },
});

export const getVisualCandidateDetails = query({
  args: { itemIds: v.array(v.id("wardrobeItems")) },
  handler: async (ctx, { itemIds }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const details = await Promise.all(itemIds.map(async (id) => {
      const item = await ctx.db.get(id);
      if (!item || item.userId !== userId) return null;
      return {
        id: item._id,
        imageUrl: await ctx.storage.getUrl(item.storageId),
        category: item.category ?? null,
        description: item.description ?? null,
      };
    }));
    return details.filter((detail) => detail !== null);
  },
});
