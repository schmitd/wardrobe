import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";
import { getStyleBioRefreshState, styleBioContextFingerprint } from "./styleBioPolicy";

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

export const getStyleBioContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return null;

    const [profile, items, allFitChecks, collections, memberships] = await Promise.all([
      ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      ctx.db.query("wardrobeItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("fitChecks").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").collect(),
      ctx.db.query("wardrobes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("wardrobeMemberships").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    const readyItems = items.filter((item) => item.analysisStatus === "ready");
    const counts = {
      closetItemCount: readyItems.length,
      fitCheckCount: allFitChecks.length,
      collectionCount: collections.length,
      collectionMembershipCount: memberships.length,
    };
    const refreshState = getStyleBioRefreshState(profile, counts);

    return {
      profile,
      counts,
      fingerprint: styleBioContextFingerprint(counts),
      shouldRefresh: refreshState.refresh,
      refreshReason: refreshState.reason,
      closetItems: readyItems.slice(-40).map((item) => ({
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? [],
      })),
      recentFits: allFitChecks.slice(0, 20).map((fit) => ({
        type: fit.type,
        description: fit.transcription ?? fit.description ?? null,
        createdAt: fit.createdAt,
      })),
      collections: collections.map((collection) => ({
        name: collection.name,
        description: collection.description ?? null,
        memberCount: memberships.filter((membership) => membership.wardrobeId === collection._id).length,
      })),
    };
  },
});

export const updateBio = mutation({
  args: {
    bio: v.string(),
    source: v.optional(v.union(v.literal("manual"), v.literal("guest_import"))),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { bio, source = "manual", traceId: argTraceId, traceparent: argTraceparent }) => {
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

    const [items, fitChecks, collections, memberships] = await Promise.all([
      ctx.db.query("wardrobeItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("fitChecks").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("wardrobes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("wardrobeMemberships").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    const counts = {
      closetItemCount: items.filter((item) => item.analysisStatus === "ready").length,
      fitCheckCount: fitChecks.length,
      collectionCount: collections.length,
      collectionMembershipCount: memberships.length,
    };

    const timestamp = now();
    const revisionId = await ctx.db.insert("profileBioRevisions", {
      userId,
      bio,
      source,
      reason: source === "manual" ? "user_edit" : "guest_import",
      ...(existing?.bioRevisionId ? { parentRevisionId: existing.bioRevisionId } : {}),
      createdAt: timestamp,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        bio,
        bioSource: source,
        ...(source === "manual" ? { bioManualAnchor: bio, bioLastManualEditAt: timestamp } : {}),
        bioRevisionId: revisionId,
        bioContextFingerprint: styleBioContextFingerprint(counts),
        bioClosetItemCount: counts.closetItemCount,
        bioFitCheckCount: counts.fitCheckCount,
        bioCollectionCount: counts.collectionCount,
        bioCollectionMembershipCount: counts.collectionMembershipCount,
        bioGeneratedAt: timestamp,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        bio,
        bioSource: source,
        ...(source === "manual" ? { bioManualAnchor: bio, bioLastManualEditAt: timestamp } : {}),
        bioRevisionId: revisionId,
        bioContextFingerprint: styleBioContextFingerprint(counts),
        bioClosetItemCount: counts.closetItemCount,
        bioFitCheckCount: counts.fitCheckCount,
        bioCollectionCount: counts.collectionCount,
        bioCollectionMembershipCount: counts.collectionMembershipCount,
        bioGeneratedAt: timestamp,
        updatedAt: timestamp,
      });
    }

    try {
      const runId = await retrier.run(ctx, internal.zepSync.syncProfileUpdate, {
        userId,
        user,
        bio,
        bioSource: source,
        bioRevisionId: revisionId,
        ...(existing?.bioRevisionId ? { previousBioRevisionId: existing.bioRevisionId } : {}),
        updateReason: source === "manual" ? "user_edit" : "guest_import",
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

export const saveGeneratedBio = mutation({
  args: {
    bio: v.string(),
    reason: v.string(),
    contextFingerprint: v.string(),
    closetItemCount: v.number(),
    fitCheckCount: v.number(),
    collectionCount: v.number(),
    collectionMembershipCount: v.number(),
    baseRevisionId: v.optional(v.id("profileBioRevisions")),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const { traceId, traceparent } = ensureTraceContext(args);
    const existing = await ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", user.userId)).first();

    if (existing?.bioRevisionId !== args.baseRevisionId) {
      return { success: false as const, reason: "profile_changed" as const };
    }

    const timestamp = now();
    const revisionId = await ctx.db.insert("profileBioRevisions", {
      userId: user.userId,
      bio: args.bio,
      source: "agent",
      reason: args.reason,
      ...(existing?.bioRevisionId ? { parentRevisionId: existing.bioRevisionId } : {}),
      contextFingerprint: args.contextFingerprint,
      createdAt: timestamp,
    });
    const payload = {
      bio: args.bio,
      bioSource: "agent",
      bioContextFingerprint: args.contextFingerprint,
      bioClosetItemCount: args.closetItemCount,
      bioFitCheckCount: args.fitCheckCount,
      bioCollectionCount: args.collectionCount,
      bioCollectionMembershipCount: args.collectionMembershipCount,
      bioGeneratedAt: timestamp,
      bioRevisionId: revisionId,
      updatedAt: timestamp,
    };
    if (existing) await ctx.db.patch(existing._id, payload);
    else await ctx.db.insert("profiles", { userId: user.userId, ...payload });

    try {
      await retrier.run(ctx, internal.zepSync.syncProfileUpdate, {
        userId: user.userId,
        user,
        bio: args.bio,
        bioSource: "agent",
        bioRevisionId: revisionId,
        ...(existing?.bioRevisionId ? { previousBioRevisionId: existing.bioRevisionId } : {}),
        updateReason: args.reason,
        traceId,
        traceparent,
      });
    } catch (error) {
      console.warn("zep.sync.generated_bio.enqueue_failed", { traceId, userId: user.userId, message: toErrorMessage(error) });
    }
    return { success: true as const, revisionId };
  },
});

export const updateProfileAttributes = mutation({
  args: {
    skinTone: v.optional(v.string()),
    complexion: v.optional(v.string()),
    hairColor: v.optional(v.string()),
    colorSeason: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, { skinTone, complexion, hairColor, colorSeason, traceId: argTraceId, traceparent: argTraceparent }) => {
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
