import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";

const now = () => Date.now();
const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return profile ?? null;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return getAuthenticatedUser(ctx);
  },
});

export const updateBio = mutation({
  args: {
    bio: v.string(),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { bio, traceId: argTraceId, traceparent: argTraceparent }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user.userId;
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
        user,
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
    complexion: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    colorSeason: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { bio, skinTone, complexion, hairColor, colorSeason, traceId: argTraceId, traceparent: argTraceparent }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user.userId;
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
      complexion,
      hairColor,
      colorSeason,
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
        user,
        ...(bio !== undefined ? { bio } : {}),
        ...(skinTone !== undefined ? { skinTone } : {}),
        ...(complexion !== undefined ? { complexion } : {}),
        ...(hairColor !== undefined ? { hairColor } : {}),
        ...(colorSeason !== undefined ? { colorSeason } : {}),
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
    complexion: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    colorSeason: v.optional(v.string()),
  },
  handler: async (ctx, { userId, bio, skinTone, complexion, hairColor, colorSeason }) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const payload = {
      bio,
      skinTone,
      complexion,
      hairColor,
      colorSeason,
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
