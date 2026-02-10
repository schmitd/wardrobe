import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const now = () => Date.now();

const getUserId = async (ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile ?? null;
  },
});

export const updateBio = mutation({
  args: {
    bio: v.string(),
  },
  handler: async (ctx, { bio }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        bio,
        updatedAt: now(),
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        bio,
        updatedAt: now(),
      });
    }

    return { success: true };
  },
});

export const internalProfileUpdate = mutation({
  args: {
    userId: v.string(),
    bio: v.optional(v.string()),
    skinTone: v.optional(v.string()),
    hairColor: v.optional(v.string()),
  },
  handler: async (ctx, { userId, bio, skinTone, hairColor }) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const payload = {
      bio,
      skinTone,
      hairColor,
      updatedAt: now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("profiles", {
        userId,
        ...payload,
      });
    }
  },
});
