import type { MobileBootstrap } from "@wardrobe/shared";
import { api } from "../../convex/_generated/api";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../../convex/_generated/server";
import { getAuthenticatedUser } from "./authIdentity";
import { ownedStorageUrl } from "../storageAccess";
import { projectWardrobeItems } from "./wardrobe";
import { projectFitChecks } from "./fitChecks";

export const bootstrap = query({
  args: {},
  handler: async (ctx): Promise<MobileBootstrap> => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const userId = user.userId;
    const [items, fits, plans, profile, selfie] = await Promise.all([
      ctx.db.query("wardrobeItems").withIndex("by_user_createdAt", q => q.eq("userId", userId)).order("desc").paginate({ numItems: 48, cursor: null, maximumRowsRead: 48 }),
      ctx.runQuery(api.mobile.fits, { paginationOpts: { numItems: 20, cursor: null } }),
      ctx.runQuery(api.mobile.plans, { paginationOpts: { numItems: 30, cursor: null } }),
      ctx.db.query("profiles").withIndex("by_user", q => q.eq("userId", userId)).first(),
      ctx.db.query("uploads").withIndex("by_user_purpose_createdAt", q => q.eq("userId", userId).eq("purpose", "selfie")).order("desc").first(),
    ]);
    const selfieUrl = selfie ? await ownedStorageUrl(ctx, userId, selfie.storageId) : null;
    return {
      items: await projectWardrobeItems(ctx, userId, items.page),
      closetCursor: items.isDone ? null : items.continueCursor,
      plansCursor: plans.isDone ? null : plans.continueCursor,
      fitsCursor: fits.isDone ? null : fits.continueCursor,
      fitChecks: fits.page,
      wardrobes: plans.page.map(plan => ({ _id: plan._id, name: plan.name, description: plan.description, moodWords: plan.moodWords, updatedAt: plan.updatedAt, items: [], inspirations: [], detailsLoaded: false })),
      profile: profile ? { bio: profile.bio ?? null, skinTone: profile.skinTone ?? null, complexion: profile.complexion ?? null, hairColor: profile.hairColor ?? null, colorSeason: profile.colorSeason ?? null } : null,
      currentUser: { name: user.fullName ?? null, email: user.email ?? null },
      latestSelfie: selfie && selfieUrl ? { storageId: selfie.storageId, url: selfieUrl, createdAt: selfie.createdAt } : null,
    };
  },
});

export const plans = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const result = await ctx.db.query("wardrobes").withIndex("by_user_updatedAt", q => q.eq("userId", user.userId)).order("desc").paginate({ ...paginationOpts, numItems: Math.max(1, Math.min(50, paginationOpts.numItems)), maximumRowsRead: 50 });
    return { ...result, page: result.page.map(plan => ({ _id: plan._id, name: plan.name, description: plan.description, moodWords: plan.moodWords, updatedAt: plan.updatedAt, items: [], inspirations: [], detailsLoaded: false })) };
  },
});

export const collection = query({
  args: { wardrobeId: v.id("wardrobes"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { wardrobeId, paginationOpts }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const plan = await ctx.db.get(wardrobeId);
    if (!plan || plan.userId !== user.userId) return null;
    const membersPage = await ctx.db.query("wardrobeMemberships").withIndex("by_wardrobe", q => q.eq("wardrobeId", wardrobeId)).paginate({ ...paginationOpts, numItems: Math.max(1, Math.min(100, paginationOpts.numItems)), maximumRowsRead: 100 });
    const members = membersPage.page;
    const references = (await Promise.all(members.filter(member => member.candidateItemId).map(member => ctx.db.get(member.candidateItemId!)))).filter(item => item !== null).filter(item => item.userId === user.userId);
    const items = await Promise.all(members.slice(0, 100).map(async membership => {
      const item = membership.itemId ? await ctx.db.get(membership.itemId) : null;
      if (!item || item.userId !== user.userId) return null;
      const [view] = await projectWardrobeItems(ctx, user.userId, [item]);
      return view ? { _id: membership._id, membershipKind: membership.membershipKind, item: view } : null;
    }));
    const inspirations = await Promise.all(references.slice(0, 100).filter(item => item.kind === "inspiration").map(async item => ({ id: item._id, imageUrl: item.storageId ? await ownedStorageUrl(ctx, user.userId, item.storageId) : null, sourceUrl: item.sourceUrl ?? null, category: item.category ?? null, description: item.description ?? null, styleTags: item.styleTags ?? [], createdAt: item.createdAt })));
    return { _id: plan._id, name: plan.name, description: plan.description, moodWords: plan.moodWords, updatedAt: plan.updatedAt, items: items.filter(item => item !== null), inspirations, detailsLoaded: true, cursor: membersPage.isDone ? null : membersPage.continueCursor };
  },
});

function mobileFits(fitChecks: Awaited<ReturnType<typeof projectFitChecks>>) { return fitChecks.map(fit => ({ id: fit._id, imageUrl: fit.imageUrl, type: fit.type, transcription: fit.transcription ?? null, description: fit.description ?? null, createdAt: fit.createdAt,
        localDate: fit.localDate, timezone: fit.timezone, wearOccurrenceId: fit.wearOccurrenceId,
        items: fit.items.map(item => ({ id: item._id, category: item.category ?? null, description: item.description ?? null })),
        observations: fit.observations.map(observation => ({ id: observation._id, category: observation.category, description: observation.description, cropUrl: observation.cropUrl, resolutionStatus: observation.resolutionStatus, matchScore: observation.matchScore ?? null, candidates: observation.candidates })),
      })); }

export const fits = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");
    const result = await ctx.db.query("fitChecks").withIndex("by_user", q => q.eq("userId", user.userId)).order("desc").paginate({ ...paginationOpts, numItems: Math.max(1, Math.min(20, paginationOpts.numItems)), maximumRowsRead: 20 });
    return { ...result, page: mobileFits(await projectFitChecks(ctx, user.userId, result.page)) };
  },
});
