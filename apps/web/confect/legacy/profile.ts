import type { MutationCtx, QueryCtx } from "../../convex/_generated/server";
import type { AuthenticatedUser } from "./authIdentity";
import { v, type Infer } from "convex/values";
import { internalMutation, mutation, query } from "../../convex/_generated/server";
import { internal } from "../../convex/_generated/api";
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

    return readStyleBioContext(ctx, userId);
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

    const { counts, fingerprint } = await readStyleBioContext(ctx, userId);

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
        bioContextFingerprint: fingerprint,
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
        bioContextFingerprint: fingerprint,
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

export const generatedBioArgs = {
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
  };

const generatedBioValidator = v.object(generatedBioArgs);
export const saveGeneratedBio = mutation({
  args: generatedBioValidator,
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    return saveGeneratedBioForUser(ctx, args, user);
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
    if (await ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first()) return;
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

export async function readStyleBioContext(ctx: QueryCtx, userId: string) {
    const [profile, items, allFitChecks, collections, memberships, wears] = await Promise.all([
      ctx.db.query("profiles").withIndex("by_user", (q) => q.eq("userId", userId)).first(),
      ctx.db.query("wardrobeItems").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(301),
      ctx.db.query("fitChecks").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(51),
      ctx.db.query("wardrobes").withIndex("by_user_updatedAt", (q) => q.eq("userId", userId)).order("desc").take(101),
      ctx.db.query("wardrobeMemberships").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(501),
      ctx.db.query("wearOccurrences").withIndex("by_user", q => q.eq("userId", userId)).order("desc").take(51),
    ]);

    const readyItems = items.filter((item) => item.analysisStatus === "ready");
    const counts = {
      closetItemCount: readyItems.length,
      fitCheckCount: wears.filter(row => row.active).length + allFitChecks.filter(fit => fit.type === "daily_fit_check" && !fit.wearOccurrenceId).length,
      collectionCount: collections.length,
      collectionMembershipCount: memberships.length,
    };
    const contextLimited = items.length > 300 || allFitChecks.length > 50 || collections.length > 100 || memberships.length > 500;
    const fingerprint = `wear-v2:${styleBioContextFingerprint(counts)}:${wears.map(row => `${row._id}.${row.revision}`).join(",")}` + (contextLimited ? `:${items[0]?._id ?? ""}:${allFitChecks[0]?._id ?? ""}:${collections[0]?.updatedAt ?? ""}:${memberships[0]?._id ?? ""}` : "");
    const refreshState = getStyleBioRefreshState(profile, counts);
    const evidenceChanged = wears.length > 0 && fingerprint !== profile?.bioContextFingerprint;

    return {
      profile,
      counts,
      fingerprint,
      contextLimited,
      shouldRefresh: refreshState.refresh || evidenceChanged || (contextLimited && fingerprint !== profile?.bioContextFingerprint),
      rebuildFromEvidence: evidenceChanged,
      refreshReason: evidenceChanged ? "wear_evidence_changed" : contextLimited ? "recent_context_shift" : refreshState.reason,
      closetItems: readyItems.slice(0, 40).map((item) => ({
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? [],
      })),
      recentFits: await Promise.all(wears.filter(row => row.active && row.itemIds.length > 0).slice(0, 20).map(async row => {
        const pieces = await Promise.all(row.itemIds.slice(0, 12).map(id => ctx.db.get(id)));
        return { type: "actual_wear", description: pieces.filter(piece => piece?.userId === userId).map(piece => (piece!.description ?? piece!.category ?? "Saved piece").slice(0, 300)).join("; "), localDate: row.localDate ?? null, createdAt: row.createdAt };
      })),
      collections: collections.slice(0, 100).map((collection) => ({
        name: collection.name,
        description: collection.description ?? null,
        memberCount: memberships.filter((membership) => membership.wardrobeId === collection._id).length,
      })),
    };
}

export async function saveGeneratedBioForUser(ctx: MutationCtx, args: Infer<typeof generatedBioValidator>, user: AuthenticatedUser) {
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
}
