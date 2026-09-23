import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { validateWearDate, canSupportPlan } from "@wardrobe/shared";
import { mutation, query } from "../../convex/_generated/server";
import { getAuthenticatedUserId } from "./authIdentity";
import {
  requireWearItems,
  reviseWear,
  recordPhotoWear,
  snapshotPlan,
  wearError,
} from "../wearDomain";
import { ownedStorageUrl } from "../storageAccess";
import { scheduleStyleBioRefresh } from "../styleBioQueue";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("wearOccurrences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const projected = await Promise.all(
      rows.map(async (row) => {
        const evidence = await ctx.db
          .query("wearEvidence")
          .withIndex("by_occurrence", (q) => q.eq("occurrenceId", row._id))
          .take(101);
        const active = evidence.filter(
          (e) => e.userId === userId && e.retractedAt === undefined,
        );
        const photoIds = [
          ...new Set(
            evidence.flatMap((e) => (e.fitCheckId ? [e.fitCheckId] : [])),
          ),
        ];
        const photos = await Promise.all(
          photoIds.map(async (id) => {
            const fit = await ctx.db.get(id);
            if (fit?.userId !== userId || fit.wearOccurrenceId !== row._id)
              return null;
            return {
              id,
              imageUrl: await ownedStorageUrl(ctx, userId, fit.storageId),
              countsAsWear: !fit.wearRetractedAt,
            };
          }),
        );
        if (!row.active && photos.every((photo) => photo === null)) return null;
        const pieces = await Promise.all(
          row.itemIds.map(async (id) => {
            const item = await ctx.db.get(id);
            if (item?.userId !== userId)
              return {
                id,
                category: "Unavailable piece",
                description: "",
                imageUrl: null,
              };
            return {
              id,
              category: item.category ?? "Piece",
              description: item.description ?? "",
              imageUrl: await ownedStorageUrl(ctx, userId, item.storageId),
            };
          }),
        );
        return {
          id: row._id,
          revision: row.revision,
          planId: row.planId,
          localDate: row.localDate,
          timezone: row.timezone,
          itemIds: row.itemIds,
          pieces,
          photos: photos.filter((p) => p !== null),
          unresolvedCount: row.unresolvedCount,
          coverage: row.coverage,
          outcome: row.outcome,
          canUndoManual: active.some(
            (e) => e.kind === "manual" || e.kind === "correction",
          ),
          recordedAt: row.createdAt,
        };
      }),
    );
    return projected.filter((row) => row !== null);
  },
});

export const update = mutation({
  args: {
    id: v.id("wearOccurrences"),
    expectedRevision: v.number(),
    action: v.union(
      v.literal("undo_manual"),
      v.literal("correct"),
      v.literal("set_date"),
      v.literal("attach_plan"),
      v.literal("detach_plan"),
      v.literal("retract_photo"),
      v.literal("restore_photo"),
    ),
    itemIds: v.optional(v.array(v.id("wardrobeItems"))),
    localDate: v.optional(v.string()),
    timezone: v.optional(v.string()),
    fitId: v.optional(v.id("fitChecks")),
    planId: v.optional(v.id("outfitSuggestions")),
    expectedPlanRevision: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    const row = await ctx.db.get(args.id);
    if (!userId || row?.userId !== userId)
      return wearError("Outfit unavailable.");
    if (row.revision !== args.expectedRevision)
      return wearError("This outfit changed. Review it again before saving.");
    const evidence = await ctx.db
      .query("wearEvidence")
      .withIndex("by_occurrence", (q) => q.eq("occurrenceId", row._id))
      .take(101);
    if (evidence.length > 100 || evidence.some((e) => e.userId !== userId))
      return wearError("Outfit evidence unavailable.");
    const active = evidence.filter((e) => e.retractedAt === undefined);
    const now = Date.now();
    if (args.action === "undo_manual") {
      for (const e of active.filter(
        (e) => e.kind === "manual" || e.kind === "correction",
      ))
        await ctx.db.patch(e._id, { retractedAt: now });
      await reviseWear(ctx, row._id, "undo");
    } else if (args.action === "restore_photo") {
      const fit = args.fitId ? await ctx.db.get(args.fitId) : null;
      if (!fit || fit.userId !== userId || fit.wearOccurrenceId !== row._id)
        return wearError("Fit unavailable.");
      await ctx.db.patch(fit._id, { wearRetractedAt: undefined });
      await recordPhotoWear(ctx, fit._id);
    } else if (args.action === "retract_photo") {
      const fit = args.fitId ? await ctx.db.get(args.fitId) : null;
      if (!fit || fit.userId !== userId || fit.wearOccurrenceId !== row._id)
        return wearError("Fit unavailable.");
      for (const e of active.filter((e) => e.fitCheckId === fit._id))
        await ctx.db.patch(e._id, { retractedAt: now });
      await ctx.db.patch(fit._id, { wearRetractedAt: now });
      await reviseWear(ctx, row._id, "undo");
    } else if (args.action === "detach_plan") {
      if (active.some((e) => e.kind === "manual"))
        return wearError(
          "Undo the manual confirmation before moving this photo out of its plan.",
        );
      const plan = row.planId ? await ctx.db.get(row.planId) : null;
      if (plan?.userId === userId && plan.wearOccurrenceId === row._id)
        await ctx.db.patch(plan._id, {
          wearOccurrenceId: undefined,
          status: "planned",
        });
      await ctx.db.patch(row._id, {
        planId: undefined,
        planRevision: undefined,
      });
      await reviseWear(ctx, row._id, "correction");
    } else if (args.action === "correct") {
      const ids = args.itemIds ?? [];
      await requireWearItems(ctx, userId, ids);
      for (const e of active.filter((e) => e.kind === "correction"))
        await ctx.db.patch(e._id, { retractedAt: now });
      await ctx.db.insert("wearEvidence", {
        userId,
        occurrenceId: row._id,
        key: `correction:${row._id}:${row.revision + 1}`,
        kind: "correction",
        itemIds: ids,
        unresolvedCount: 0,
        sourceRevision: row.revision + 1,
        recordedAt: now,
      });
      await reviseWear(ctx, row._id, "correction");
    } else if (args.action === "set_date") {
      if (!args.localDate || !args.timezone)
        return wearError("Choose when you wore this outfit.");
      validateWearDate(args.localDate, args.timezone);
      if (row.planId) {
        const plan = await ctx.db.get(row.planId);
        if (plan?.userId !== userId || plan.date !== args.localDate)
          return wearError(
            "This photo is attached to a different plan date. Review its plan first.",
          );
      }
      await ctx.db.patch(row._id, {
        localDate: args.localDate,
        timezone: args.timezone,
      });
      for (const fitId of new Set(
        active.flatMap((e) => (e.fitCheckId ? [e.fitCheckId] : [])),
      )) {
        const fit = await ctx.db.get(fitId);
        if (fit?.userId !== userId || fit.wearOccurrenceId !== row._id)
          return wearError("Fit unavailable.");
        await ctx.db.patch(fitId, {
          localDate: args.localDate,
          timezone: args.timezone,
          updatedAt: now,
        });
      }
      await reviseWear(ctx, row._id, "date");
    } else {
      const plan = args.planId ? await ctx.db.get(args.planId) : null;
      if (
        !plan ||
        plan.userId !== userId ||
        (plan.status !== "planned" && plan.status !== "worn") ||
        plan.notWornAt
      )
        return wearError("Accepted plan unavailable.");
      if (row.planId && row.planId !== plan._id)
        return wearError("This photo already belongs to another plan.");
      if (!row.localDate || row.localDate !== plan.date)
        return wearError(
          "Confirm the photo's wear date before linking this plan.",
        );
      if (args.expectedPlanRevision !== (plan.planRevision ?? 0))
        return wearError("This plan changed. Review its pieces again.");
      if (!canSupportPlan(row.itemIds, plan.itemIds))
        return wearError(
          "No planned pieces have been identified. Confirm the pieces or record this as a separate outfit.",
        );
      const planRevision = plan.planRevision ?? (await snapshotPlan(ctx, plan));
      const target = plan.wearOccurrenceId
        ? await ctx.db.get(plan.wearOccurrenceId)
        : null;
      if (
        target &&
        (target.userId !== userId ||
          target.planId !== plan._id ||
          target.planRevision !== planRevision)
      )
        return wearError("Plan evidence unavailable.");
      if (target && target._id !== row._id) {
        // Only explicit user association merges a photo with manual confirmation.
        const targetEvidence = await ctx.db
          .query("wearEvidence")
          .withIndex("by_occurrence", (q) => q.eq("occurrenceId", target._id))
          .take(101);
        if (
          targetEvidence.length + active.length > 100 ||
          targetEvidence.some((e) => e.userId !== userId)
        )
          return wearError("Plan evidence unavailable.");
        const manual = targetEvidence.find(
          (e) =>
            (e.kind === "manual" || e.kind === "correction") &&
            e.retractedAt === undefined,
        );
        if (manual && row.itemIds.some((id) => !target.itemIds.includes(id)))
          return wearError(
            "The photo differs from your confirmation. Edit the actual outfit first.",
          );
        for (const e of active) {
          // Preserve the old evidence/revision; copy support into the canonical occurrence.
          await ctx.db.patch(e._id, { retractedAt: now });
          const { _id: _eId, _creationTime: _created, ...value } = e;
          await ctx.db.insert("wearEvidence", {
            ...value,
            occurrenceId: target._id,
            key: `attach:${e._id}:${target._id}`,
            recordedAt: now,
          });
          if (e.fitCheckId) {
            const fit = await ctx.db.get(e.fitCheckId);
            if (fit?.userId !== userId || fit.wearOccurrenceId !== row._id)
              return wearError("Fit unavailable.");
            await ctx.db.patch(fit._id, { wearOccurrenceId: target._id });
          }
        }
        await reviseWear(ctx, row._id, "correction");
        await reviseWear(ctx, target._id, "photo");
      } else {
        await ctx.db.patch(row._id, { planId: plan._id, planRevision });
        await reviseWear(ctx, row._id, "photo");
      }
    }
    await scheduleStyleBioRefresh(ctx, userId);
    return null;
  },
});

export const pendingPlans = query({
  args: { paginationOpts: paginationOptsValidator, through: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Sign in to review outfit plans.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.through))
      throw new Error("Invalid date.");
    const result = await ctx.db
      .query("outfitSuggestions")
      .withIndex("by_user_status_date", (q) =>
        q
          .eq("userId", userId)
          .eq("status", "planned")
          .lte("date", args.through),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 20),
      });
    const page = await Promise.all(
      result.page.map(async (plan) => ({
        id: plan._id,
        date: plan.date,
        title: plan.title,
        itemIds: plan.itemIds,
        revision: plan.planRevision ?? 0,
        notWornAt: plan.notWornAt,
        pieces: (
          await Promise.all(
            plan.itemIds.map(async (id) => {
              const item = await ctx.db.get(id);
              return item?.userId === userId
                ? {
                    id,
                    category: item.category ?? "Piece",
                    imageUrl: await ownedStorageUrl(
                      ctx,
                      userId,
                      item.storageId,
                    ),
                  }
                : null;
            }),
          )
        ).filter((piece) => piece !== null),
      })),
    );
    return { ...result, page };
  },
});
