import { ownedStorageUrl } from "../storageAccess";
import { ConvexError, v } from "convex/values";
import { mutation, query, internalMutation } from "../../convex/_generated/server";
import { internal } from "../../convex/_generated/api";
import { getAuthenticatedUserId } from "./authIdentity";
import { outfitFields, outfitStatus } from "./planningValidators";
import { shiftDay } from "@wardrobe/shared";

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
  args: { week: v.optional(v.string()), planId: v.optional(v.id("wardrobes")) },
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
    inventoryTruncated: v.boolean(),
  }),
  handler: async (ctx, { week, planId }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new ConvexError({ _tag: "NotAuthenticated", message: "Sign in to plan an outfit." });
    if (week && (!/^\d{4}-\d{2}-\d{2}$/.test(week) || !Number.isFinite(Date.parse(`${week}T12:00:00Z`)))) throw new ConvexError({ _tag: "PlanningInput", message: "Choose a valid week." });
    const [items, plans, history, profile, suggestions, settings] =
      await Promise.all([
        ctx.db
          .query("wardrobeItems")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(301),
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
        week ? ctx.db.query("outfitSuggestions")
          .withIndex("by_user_date", q => q.eq("userId", userId).gte("date", week).lte("date", shiftDay(week, 6)))
          .order("desc").take(100) : ctx.db
          .query("outfitSuggestions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(100),
        ctx.db
          .query("planningSettings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique(),
      ]);
    const selectedMemberships = planId && plans.some(plan => plan._id === planId)
      ? await ctx.db.query("wardrobeMemberships").withIndex("by_wardrobe", q => q.eq("wardrobeId", planId)).take(100)
      : [];
    const referenced = new Set([
      ...suggestions.flatMap(s => s.itemIds),
      ...selectedMemberships.flatMap(m => m.userId === userId && m.itemId ? [m.itemId] : []),
    ]);
    const inventory = new Map(items.slice(0, 300).map(i => [i._id, i]));
    for (const id of referenced) if (!inventory.has(id)) {
      const row = await ctx.db.get(id);
      if (row?.userId === userId) inventory.set(id, row);
    }
    return {
      items: await Promise.all(
        [...inventory.values()].map(async (i) => ({
          id: i._id,
          category: i.category ?? "Piece",
          description: i.description ?? "Un-described piece",
          imageUrl: await ownedStorageUrl(ctx, userId, i.storageId),
        })),
      ),
      plans: plans.map((p) => ({
          id: p._id,
          name: p.name,
          description: p.description ?? "",
          itemIds: p._id === planId ? selectedMemberships.flatMap(m => m.userId === userId && m.itemId ? [m.itemId] : []) : [],
        })),
      history: history.map((h) =>
        (h.transcription ?? h.description ?? "").slice(0, 1200),
      ),
      bio: (profile?.bio ?? "").slice(0, 4000),
      suggestions,
      calendarEnabled: settings?.calendarEnabled ?? false,
      calendarIds: settings?.calendarIds ?? [],
      calendarRevision: settings?.calendarRevision ?? 0,
      inventoryTruncated: items.length > 300,
    };
  },
});

export const reserveGeneration = mutation({
  args: {
    transcription: v.optional(v.boolean()),
    interpretation: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { transcription, interpretation }) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new ConvexError({ _tag: "NotAuthenticated", message: "Unauthorized" });
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const field = interpretation
      ? "lastInterpretationAt"
      : transcription
        ? "lastTranscriptionAt"
        : "lastGenerationAt";
    if (settings && Date.now() - (settings[field] ?? 0) < 30000)
      throw new ConvexError({ _tag: "PlanningLimit", message: "Please wait 30 seconds before trying again." });
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
    if (!userId) throw new ConvexError({ _tag: "NotAuthenticated", message: "Unauthorized" });
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
      throw new ConvexError({ _tag: "PlanningInput", message: "Invalid recommendation" });
    for (const id of args.itemIds)
      if ((await ctx.db.get(id))?.userId !== userId)
        throw new ConvexError({ _tag: "PlanningInput", message: "Piece unavailable" });
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
    if (existing.length >= 100) {
      const expired = existing.find(
        (o) => o.status !== "planned" && o.status !== "worn",
      );
      if (!expired)
        throw Error(
          "Your outfit history is full. Remove an old outfit before generating more.",
        );
      await ctx.db.delete(expired._id);
    }
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
      throw new ConvexError({ _tag: "PlanningInput", message: "Recommendation unavailable" });
    if (args.reason && args.reason.length > 500)
      throw new ConvexError({ _tag: "PlanningInput", message: "Keep your reason under 500 characters." });
    const chosen = args.itemIds ?? row.itemIds;
    if (args.itemIds || args.status === "planned" || args.status === "worn") {
      if (!chosen.length || chosen.length > 12)
        throw new ConvexError({ _tag: "PlanningInput", message: "Choose 1–12 pieces." });
      for (const id of chosen)
        if ((await ctx.db.get(id))?.userId !== userId)
          throw new ConvexError({ _tag: "PlanningInput", message: "Piece unavailable" });
    }
    if (args.status === "planned" && row.status !== "suggested")
      throw new ConvexError({ _tag: "PlanningInput", message: "Only a suggestion can be accepted." });
    if (args.status === "worn" && row.status !== "planned")
      throw new ConvexError({ _tag: "PlanningInput", message: "Accept this suggestion first." });
    if (row.status === "dismissed" || row.status === "worn")
      throw new ConvexError({ _tag: "PlanningInput", message: "This outfit is already finished." });
    if (args.status === "dismissed" && !args.reason?.trim())
      throw new ConvexError({ _tag: "PlanningInput", message: "Choose a dismissal reason." });
    if (args.status === "planned" && !(args.itemIds ?? row.itemIds).length)
      throw new ConvexError({ _tag: "PlanningInput", message: "Add owned pieces before accepting." });
    await ctx.db.patch(args.id, {
      ...(args.status ? { status: args.status } : {}),
      ...(args.itemIds ? { itemIds: [...new Set(args.itemIds)] } : {}),
      ...(args.reason ? { reason: args.reason } : {}),
      updatedAt: Date.now(),
    });
    return null;
  },
});

// One transaction for a reviewed week: a concurrent accept/worn action always wins.
export const saveWeek = mutation({
  args: {
    outfits: v.array(
      v.object({
        date: v.string(),
        title: v.string(),
        rationale: v.string(),
        context: v.array(v.string()),
        itemIds: v.array(v.id("wardrobeItems")),
        missing: v.array(v.string()),
      }),
    ),
    calendarDerived: v.boolean(),
    calendarRevision: v.optional(v.number()),
  },
  returns: v.object({ updated: v.number(), kept: v.number() }),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new ConvexError({ _tag: "NotAuthenticated", message: "Unauthorized" });
    if (
      !args.outfits.length ||
      args.outfits.length > 7 ||
      new Set(args.outfits.map((o) => o.date)).size !== args.outfits.length
    )
      throw new ConvexError({ _tag: "PlanningInput", message: "Choose 1–7 distinct dates." });
    if (args.calendarDerived) {
      const settings = await ctx.db
        .query("planningSettings")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      if (
        !settings?.calendarEnabled ||
        args.calendarRevision !== (settings.calendarRevision ?? 0)
      )
        throw new ConvexError({ _tag: "PlanningInput", message: "Calendar connection changed. Try again." });
    }
    let updated = 0,
      kept = 0;
    for (const outfit of args.outfits) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(outfit.date) ||
        !Number.isFinite(Date.parse(`${outfit.date}T12:00:00Z`)) ||
        new Date(`${outfit.date}T12:00:00Z`).toISOString().slice(0, 10) !==
          outfit.date ||
        !outfit.title.trim() ||
        outfit.title.length > 160 ||
        !outfit.rationale.trim() ||
        outfit.rationale.length > 2400 ||
        outfit.itemIds.length > 12 ||
        outfit.missing.length > 8 ||
        outfit.missing.some((s) => !s.trim() || s.length > 300) ||
        outfit.context.length > 10 ||
        outfit.context.some((s) => s.length > 300)
      )
        throw new ConvexError({ _tag: "PlanningInput", message: "Invalid recommendation." });
      const existing = await ctx.db
        .query("outfitSuggestions")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", outfit.date),
        )
        .order("desc")
        .take(100);
      if (existing.some((o) => o.status === "planned" || o.status === "worn")) {
        kept++;
        continue;
      }
      for (const id of outfit.itemIds)
        if ((await ctx.db.get(id))?.userId !== userId)
          throw new ConvexError({ _tag: "PlanningInput", message: "Piece unavailable." });
      if (!outfit.itemIds.length && !outfit.missing.length)
        throw new ConvexError({ _tag: "PlanningInput", message: "Recommendation has no pieces or explanation." });
      const previous = existing.find((o) => o.status === "suggested");
      const value = {
        ...outfit,
        itemIds: [...new Set(outfit.itemIds)],
        calendarDerived: args.calendarDerived,
        updatedAt: Date.now(),
      };
      if (previous) await ctx.db.patch(previous._id, value);
      else {
        // Match the existing 100-entry privacy retention limit without evicting
        // an accepted outfit or another day in this atomic batch.
        const retained = await ctx.db
          .query("outfitSuggestions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("asc")
          .take(100);
        if (retained.length >= 100) {
          const expired = retained.find(
            (o) =>
              o.status !== "planned" &&
              o.status !== "worn" &&
              !args.outfits.some((day) => day.date === o.date),
          );
          if (!expired)
            throw Error(
              "Your outfit history is full. Remove an old outfit before generating more.",
            );
          await ctx.db.delete(expired._id);
        }
        await ctx.db.insert("outfitSuggestions", {
          ...value,
          userId,
          status: "suggested",
          createdAt: Date.now(),
        });
      }
      updated++;
    }
    return { updated, kept };
  },
});

export const calendar = mutation({
  args: { enabled: v.boolean(), calendarIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new ConvexError({ _tag: "NotAuthenticated", message: "Unauthorized" });
    if (
      args.calendarIds.length > 10 ||
      args.calendarIds.some((id) => !id || id.length > 300) ||
      (args.enabled && !args.calendarIds.length)
    )
      throw new ConvexError({ _tag: "PlanningInput", message: "Choose 1–10 calendars." });
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
