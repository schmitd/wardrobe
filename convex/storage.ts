import { v } from "convex/values";
import { query } from "./_generated/server";

const getUserId = async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

export const getStorageUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const item = await ctx.db
      .query("wardrobeItems")
      .filter((q) => q.eq(q.field("storageId"), storageId))
      .first();

    if (!item || item.userId !== userId) {
      throw new Error("Not found");
    }

    return ctx.storage.getUrl(storageId);
  },
});
