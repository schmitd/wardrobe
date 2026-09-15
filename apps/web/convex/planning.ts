import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUserId } from "./authIdentity";
import { outfitFields, outfitStatus } from "./planningValidators";

const item = v.object({
  id: v.id("wardrobeItems"),
  category: v.string(),
  description: v.string(),
  imageUrl: v.union(v.string(), v.null()),
});
const suggestion = v.object({
  ...outfitFields,
  _id: v.id("outfitSuggestions"),
  _creationTime: v.number(),
});
export const load = query({
  args: {},
  returns: v.object({
    items: v.array(item),
    plans: v.array(
      v.object({
        id: v.id("wardrobes"),
        name: v.string(),
        description: v.string(),
        itemIds: v.array(v.id("wardrobeItems")),
      }),
    ),
    history: v.array(v.string()),
    bio: v.string(),
    suggestions: v.array(suggestion),
    calendarEnabled: v.boolean(),
    calendarIds: v.array(v.string()),
    calendarRevision: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Sign in to plan an outfit.");
    const [items, plans, history, profile, suggestions, settings] =
      await Promise.all([
        ctx.db
          .query("wardrobeItems")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(300),
        ctx.db
          .query("wardrobes")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(100),
        ctx.db
          .query("fitChecks")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(20),
        ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .first(),
        ctx.db
          .query("outfitSuggestions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(100),
        ctx.db
          .query("planningSettings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      ]);
    return {
      items: await Promise.all(
        items.map(async (i) => ({
          id: i._id,
          category: i.category ?? "Piece",
          description: i.description ?? "Un-described piece",
          imageUrl: await ctx.storage.getUrl(i.storageId),
        })),
      ),
      plans: await Promise.all(
        plans.map(async (p) => ({
          id: p._id,
          name: p.name,
          description: p.description ?? "",
          itemIds: (
            await ctx.db
              .query("wardrobeMemberships")
              .withIndex("by_wardrobe", (q) => q.eq("wardrobeId", p._id))
              .take(100)
          ).flatMap((m) => (m.userId === userId && m.itemId ? [m.itemId] : [])),
        })),
      ),
      history: history.map((h) =>
        (h.transcription ?? h.description ?? "").slice(0, 1200),
      ),
      bio: (profile?.bio ?? "").slice(0, 4000),
      suggestions,
      calendarEnabled: settings?.calendarEnabled ?? false,
      calendarIds: settings?.calendarIds ?? [],
      calendarRevision: settings?.calendarRevision ?? 0,
    };
  },
});

export const reserveGeneration = mutation({
  args: { transcription: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { transcription }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const field = transcription ? "lastTranscriptionAt" : "lastGenerationAt";
    if (settings && Date.now() - (settings[field] ?? 0) < 30000)
      throw new Error("Please wait 30 seconds before trying again.");
    if (settings) await ctx.db.patch(settings._id, { [field]: Date.now() });
    else
      await ctx.db.insert("planningSettings", {
        userId,
        calendarEnabled: false,
        calendarIds: [],
        lastGenerationAt: 0,
        [field]: Date.now(),
        updatedAt: Date.now(),
      });
    return null;
  },
});

export const save = mutation({
  args: {
    date: v.string(),
    title: v.string(),
    rationale: v.string(),
    context: v.array(v.string()),
    itemIds: v.array(v.id("wardrobeItems")),
    missing: v.array(v.string()),
    calendarDerived: v.boolean(),
    calendarRevision: v.optional(v.number()),
  },
  returns: v.id("outfitSuggestions"),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (
      args.title.length > 160 ||
      args.rationale.length > 2400 ||
      args.itemIds.length > 12 ||
      args.context.length > 10 ||
      args.context.some((s) => s.length > 300) ||
      args.missing.length > 8 ||
      args.missing.some((s) => s.length > 300) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(args.date)
    )
      throw new Error("Invalid recommendation");
    for (const id of args.itemIds)
      if ((await ctx.db.get(id))?.userId !== userId)
        throw new Error("Piece unavailable");
    if (args.calendarDerived) {
      const settings = await ctx.db
        .query("planningSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (
        !settings?.calendarEnabled ||
        args.calendarRevision !== (settings.calendarRevision ?? 0)
      )
        throw new Error(
          "Calendar connection changed. Generate again with your current settings.",
        );
    }
    // Bound retained private planning history. Oldest suggestions expire, not unrelated wardrobe data.
    const existing = await ctx.db
      .query("outfitSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("asc")
      .take(100);
    if (existing.length >= 100) await ctx.db.delete(existing[0]._id);
    const { calendarRevision: _revision, ...outfit } = args;
    return ctx.db.insert("outfitSuggestions", {
      ...outfit,
      userId,
      status: "suggested",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("outfitSuggestions"),
    status: v.optional(outfitStatus),
    itemIds: v.optional(v.array(v.id("wardrobeItems"))),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx),
      row = await ctx.db.get(args.id);
    if (!userId || row?.userId !== userId)
      throw new Error("Recommendation unavailable");
    if (args.reason && args.reason.length > 500)
      throw new Error("Keep your reason under 500 characters.");
    const chosen = args.itemIds ?? row.itemIds;
    if (args.itemIds || args.status === "planned" || args.status === "worn") {
      if (!chosen.length || chosen.length > 12)
        throw new Error("Choose 1–12 pieces.");
      for (const id of chosen)
        if ((await ctx.db.get(id))?.userId !== userId)
          throw new Error("Piece unavailable");
    }
    if (args.status === "planned" && row.status !== "suggested")
      throw new Error("Only a suggestion can be accepted.");
    if (args.status === "worn" && row.status !== "planned")
      throw new Error("Accept this suggestion first.");
    if (row.status === "dismissed" || row.status === "worn")
      throw new Error("This outfit is already finished.");
    if (args.status === "dismissed" && !args.reason?.trim())
      throw new Error("Choose a dismissal reason.");
    if (args.status === "planned" && !(args.itemIds ?? row.itemIds).length)
      throw new Error("Add owned pieces before accepting.");
    await ctx.db.patch(args.id, {
      ...(args.status ? { status: args.status } : {}),
      ...(args.itemIds ? { itemIds: [...new Set(args.itemIds)] } : {}),
      ...(args.reason ? { reason: args.reason } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const calendar = mutation({
  args: { enabled: v.boolean(), calendarIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (
      args.calendarIds.length > 10 ||
      args.calendarIds.some((id) => !id || id.length > 300) ||
      (args.enabled && !args.calendarIds.length)
    )
      throw new Error("Choose 1–10 calendars.");
    const row = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const values = {
      calendarEnabled: args.enabled,
      calendarIds: args.enabled ? [...new Set(args.calendarIds)] : [],
      calendarRevision: (row?.calendarRevision ?? 0) + 1,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, values);
    else
      await ctx.db.insert("planningSettings", {
        userId,
        ...values,
        lastGenerationAt: 0,
      });
    if (!args.enabled) {
      const suggestions = await ctx.db
        .query("outfitSuggestions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(100);
      for (const row of suggestions)
        if (row.calendarDerived) await ctx.db.delete(row._id);
    }
    return null;
  },
});

// Bounded deletion continues until all private planning data is removed on account deletion.
export const deleteUserData = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("outfitSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    for (const row of rows) await ctx.db.delete(row._id);
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);
    for (const row of settings) await ctx.db.delete(row._id);
    if (rows.length === 100 || settings.length === 100)
      await ctx.scheduler.runAfter(0, internal.planning.deleteUserData, {
        userId,
      });
    return null;
  },
});
