import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const getUserId = async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

const now = () => Date.now();

// Records an uploaded storageId as belonging to the current user for a short-lived purpose
// (quick compare, selfie, etc). This allows server-side actions to safely fetch the uploaded
// bytes without forcing the upload to also create a wardrobe item.
export const registerUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    purpose: v.string(),
  },
  handler: async (ctx, { storageId, purpose }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("uploads")
      .withIndex("by_user_storage", (q) =>
        q.eq("userId", userId).eq("storageId", storageId)
      )
      .first();

    if (existing) return { ok: true as const };

    await ctx.db.insert("uploads", {
      userId,
      storageId,
      purpose,
      createdAt: now(),
    });

    return { ok: true as const };
  },
});

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

    if (item && item.userId === userId) return ctx.storage.getUrl(storageId);

    const upload = await ctx.db
      .query("uploads")
      .withIndex("by_user_storage", (q) =>
        q.eq("userId", userId).eq("storageId", storageId)
      )
      .first();

    if (!upload) throw new Error("Not found");

    return ctx.storage.getUrl(storageId);
  },
});
