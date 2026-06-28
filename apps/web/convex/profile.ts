import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";

const now = () => Date.now();
const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { bio, traceId: argTraceId, traceparent: argTraceparent }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const { traceId, traceparent } = ensureTraceContext({
      traceId: argTraceId,
      traceparent: argTraceparent,
    });

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

    try {
      const runId = await retrier.run(ctx, internal.zepSync.syncProfileUpdate, {
        userId,
        bio,
        traceId,
        traceparent,
      });
      console.info("zep.sync.profile_update.enqueued", {
        traceId,
        traceparent,
        userId,
        runId,
      });
    } catch (error) {
      console.warn("zep.sync.profile_update.enqueue_failed", {
        traceId,
        traceparent,
        userId,
        message: toErrorMessage(error),
      });
    }

    return { success: true };
  },
});

export const updateProfileAttributes = mutation({
  args: {
    bio: v.optional(v.string()),
    skinTone: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { bio, skinTone, hairColor, traceId: argTraceId, traceparent: argTraceparent }) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const { traceId, traceparent } = ensureTraceContext({
      traceId: argTraceId,
      traceparent: argTraceparent,
    });

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

    try {
      const runId = await retrier.run(ctx, internal.zepSync.syncProfileUpdate, {
        userId,
        bio,
        skinTone,
        hairColor,
        traceId,
        traceparent,
      });
      console.info("zep.sync.profile_update.enqueued", {
        traceId,
        traceparent,
        userId,
        runId,
      });
    } catch (error) {
      console.warn("zep.sync.profile_update.enqueue_failed", {
        traceId,
        traceparent,
        userId,
        message: toErrorMessage(error),
      });
    }

    return { success: true };
  },
});

export const internalProfileUpdate = internalMutation({
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
