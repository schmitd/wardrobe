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

    return ctx.storage.getUrl(storageId);
  },
});
