import { ConvexError } from "convex/values";
import {
  deriveWear,
  validateWearDate,
  WEAR_ONTOLOGY_VERSION,
} from "@wardrobe/shared";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { MutationCtx } from "../convex/_generated/server";
import { scheduleStyleBioRefresh } from "./styleBioQueue";
import { internal } from "../convex/_generated/api";

export async function queueWearProjection(
  ctx: MutationCtx,
  input: {
    userId: string;
    occurrenceId?: Id<"wearOccurrences">;
    planId?: Id<"outfitSuggestions">;
    revision: number;
  },
) {
  const timestamp = Date.now();
  const live = process.env.WARDROBE_WEAR_ZEP_MODE === "live";
  const id = await ctx.db.insert("wearProjectionOutbox", {
    ...input,
    ontologyVersion: WEAR_ONTOLOGY_VERSION,
    state: live ? "pending" : "shadow",
    attempts: 0,
    recordedAt: timestamp,
    updatedAt: timestamp,
  });
  if (live) await ctx.scheduler.runAfter(0, internal.wearGraph.project, { id });
}

export const wearError = (message: string): never => {
  throw new ConvexError({ _tag: "PlanningInput", message });
};

export async function requireWearItems(
  ctx: MutationCtx,
  userId: string,
  ids: Id<"wardrobeItems">[],
) {
  if (!ids.length || ids.length > 30 || new Set(ids).size !== ids.length)
    wearError("Choose 1–30 distinct pieces.");
  for (const id of ids)
    if ((await ctx.db.get(id))?.userId !== userId)
      wearError("Piece unavailable.");
}

/** A suggestion becomes a stable plan occurrence only on explicit acceptance. */
export async function snapshotPlan(
  ctx: MutationCtx,
  row: Doc<"outfitSuggestions">,
  itemIds = row.itemIds,
) {
  const revision = (row.planRevision ?? 0) + 1;
  await ctx.db.insert("planRevisions", {
    userId: row.userId,
    planId: row._id,
    revision,
    itemIds,
    date: row.date,
    title: row.title,
    context: row.context,
    recordedAt: Date.now(),
  });
  await ctx.db.patch(row._id, {
    planRevision: revision,
    wearOccurrenceId: undefined,
  });
  await queueWearProjection(ctx, {
    userId: row.userId,
    planId: row._id,
    revision,
  });
  return revision;
}

export async function newWear(
  ctx: MutationCtx,
  userId: string,
  input: {
    planId?: Id<"outfitSuggestions">;
    planRevision?: number;
    localDate?: string;
    timezone?: string;
  },
) {
  validateWearDate(input.localDate, input.timezone);
  return ctx.db.insert("wearOccurrences", {
    userId,
    ...input,
    revision: 0,
    itemIds: [],
    unresolvedCount: 0,
    active: false,
    coverage: "partial",
    outcome: "unconfirmed",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function reviseWear(
  ctx: MutationCtx,
  occurrenceId: Id<"wearOccurrences">,
  reason: Doc<"wearRevisions">["reason"],
) {
  const occurrence = await ctx.db.get(occurrenceId);
  if (!occurrence) return wearError("Outfit unavailable.");
  const evidence = await ctx.db
    .query("wearEvidence")
    .withIndex("by_occurrence", (q) => q.eq("occurrenceId", occurrenceId))
    .take(101);
  if (evidence.length > 100)
    wearError(
      "This outfit has reached its evidence limit. Start a separate outfit.",
    );
  if (evidence.some((e) => e.userId !== occurrence.userId))
    wearError("Outfit evidence unavailable.");
  const plan =
    occurrence.planId && occurrence.planRevision
      ? await ctx.db
          .query("planRevisions")
          .withIndex("by_plan_revision", (q) =>
            q
              .eq("planId", occurrence.planId!)
              .eq("revision", occurrence.planRevision!),
          )
          .unique()
      : null;
  if (plan && plan.userId !== occurrence.userId) wearError("Plan unavailable.");
  const derived = deriveWear(evidence, plan?.itemIds);
  const revision = occurrence.revision + 1;
  const itemIds = derived.itemIds as Id<"wardrobeItems">[];
  const recordedAt = Date.now();
  await ctx.db.patch(occurrenceId, {
    revision,
    itemIds,
    unresolvedCount: derived.unresolvedCount,
    active: derived.supported,
    coverage: derived.coverage,
    outcome: derived.outcome,
    updatedAt: recordedAt,
  });
  await ctx.db.insert("wearRevisions", {
    userId: occurrence.userId,
    occurrenceId,
    revision,
    itemIds,
    evidenceIds: evidence
      .filter((e) => e.retractedAt === undefined)
      .map((e) => e._id),
    localDate: occurrence.localDate,
    timezone: occurrence.timezone,
    unresolvedCount: derived.unresolvedCount,
    active: derived.supported,
    reason,
    recordedAt,
  });
  // Shadow-only until typed projection and current-revision retrieval pass probes.
  await queueWearProjection(ctx, {
    userId: occurrence.userId,
    occurrenceId,
    revision,
  });
  if (occurrence.planId) {
    const current = await ctx.db.get(occurrence.planId);
    if (
      current?.userId === occurrence.userId &&
      current.planRevision === occurrence.planRevision
    ) {
      await ctx.db.patch(current._id, {
        wearOccurrenceId: occurrenceId,
        status: derived.outcome === "unconfirmed" ? "planned" : "worn",
        updatedAt: recordedAt,
      });
    }
  }
  return occurrenceId;
}

export async function affirmPlan(
  ctx: MutationCtx,
  row: Doc<"outfitSuggestions">,
  input: {
    itemIds: Id<"wardrobeItems">[];
    timezone: string;
    expectedRevision?: number;
  },
) {
  if (row.status === "worn" && !row.planRevision)
    wearError(
      "This older outfit has no preserved plan snapshot. Keep it in history and record a new fit photo to add evidence.",
    );
  if (input.expectedRevision !== (row.planRevision ?? 0))
    wearError("This plan changed. Review it before confirming.");
  await requireWearItems(ctx, row.userId, input.itemIds);
  validateWearDate(row.date, input.timezone);
  const planRevision = row.planRevision ?? (await snapshotPlan(ctx, row));
  const existing = row.wearOccurrenceId
    ? await ctx.db.get(row.wearOccurrenceId)
    : null;
  if (
    existing &&
    (existing.userId !== row.userId ||
      existing.planId !== row._id ||
      existing.planRevision !== planRevision)
  )
    wearError("Outfit unavailable.");
  const occurrenceId =
    existing?._id ??
    (await newWear(ctx, row.userId, {
      planId: row._id,
      planRevision,
      localDate: row.date,
      timezone: input.timezone,
    }));
  const evidence = await ctx.db
    .query("wearEvidence")
    .withIndex("by_occurrence", (q) => q.eq("occurrenceId", occurrenceId))
    .take(101);
  const manual = evidence.find(
    (e) => e.kind === "manual" && e.retractedAt === undefined,
  );
  if (manual) {
    if (
      manual.itemIds.length === input.itemIds.length &&
      manual.itemIds.every((id) => input.itemIds.includes(id))
    )
      return occurrenceId;
    wearError(
      "This outfit is already confirmed. Use Edit actual outfit to correct it.",
    );
  }
  const revision = (existing?.revision ?? 0) + 1;
  await ctx.db.insert("wearEvidence", {
    userId: row.userId,
    occurrenceId,
    key: `manual:${row._id}:${planRevision}:${revision}`,
    kind: "manual",
    itemIds: input.itemIds,
    unresolvedCount: 0,
    sourceRevision: revision,
    recordedAt: Date.now(),
  });
  await reviseWear(ctx, occurrenceId, "manual");
  await scheduleStyleBioRefresh(ctx, row.userId);
  return occurrenceId;
}

/** Used by every daily-fit entry point and by later garment identity resolution. */
export async function recordPhotoWear(
  ctx: MutationCtx,
  fitCheckId: Id<"fitChecks">,
) {
  const fit = await ctx.db.get(fitCheckId);
  if (!fit || fit.type !== "daily_fit_check" || fit.wearRetractedAt) return;
  const items = await ctx.db
    .query("fitCheckItems")
    .withIndex("by_fit_check", (q) => q.eq("fitCheckId", fitCheckId))
    .take(31);
  if (items.length > 30 || items.some((item) => item.userId !== fit.userId))
    wearError("Fit evidence unavailable.");
  const itemIds: Id<"wardrobeItems">[] = [];
  for (const item of items) {
    if (
      item.wardrobeItemId &&
      (item.source === "matched_existing" ||
        item.source === "created_from_fit_check")
    ) {
      if ((await ctx.db.get(item.wardrobeItemId))?.userId !== fit.userId)
        wearError("Piece unavailable.");
      itemIds.push(item.wardrobeItemId);
    }
  }
  const unresolvedCount = items.filter(
    (item) =>
      !item.wardrobeItemId ||
      (item.source !== "matched_existing" &&
        item.source !== "created_from_fit_check"),
  ).length;
  const occurrence = fit.wearOccurrenceId
    ? await ctx.db.get(fit.wearOccurrenceId)
    : null;
  if (occurrence && occurrence.userId !== fit.userId)
    wearError("Outfit unavailable.");
  // A single accepted, date-only intention can supply context, never identities.
  // Existing occurrences require explicit association so two outfits remain distinct.
  const sameDay =
    !occurrence && fit.localDate
      ? await ctx.db
          .query("outfitSuggestions")
          .withIndex("by_user_date", (q) =>
            q.eq("userId", fit.userId).eq("date", fit.localDate!),
          )
          .take(101)
      : [];
  const accepted = sameDay.filter(
    (plan) => plan.status === "planned" && !plan.notWornAt,
  );
  const candidate =
    sameDay.length <= 100 &&
    accepted.length === 1 &&
    !accepted[0]!.wearOccurrenceId &&
    itemIds.some((id) => accepted[0]!.itemIds.includes(id))
      ? accepted[0]
      : undefined;
  const planRevision = candidate
    ? (candidate.planRevision ?? (await snapshotPlan(ctx, candidate)))
    : undefined;
  const occurrenceId =
    occurrence?._id ??
    (await newWear(ctx, fit.userId, {
      localDate: fit.localDate,
      timezone: fit.timezone,
      planId: candidate?._id,
      planRevision,
    }));
  const existing = await ctx.db
    .query("wearEvidence")
    .withIndex("by_fit", (q) => q.eq("fitCheckId", fitCheckId))
    .take(101);
  if (
    existing.length > 100 ||
    existing.some(
      (e) =>
        e.userId !== fit.userId ||
        (e.retractedAt === undefined && e.occurrenceId !== occurrenceId),
    )
  )
    wearError("Fit evidence unavailable.");
  const current = existing.find((e) => e.retractedAt === undefined);
  const distinctIds = [...new Set(itemIds)];
  if (
    current &&
    current.unresolvedCount === unresolvedCount &&
    current.itemIds.length === distinctIds.length &&
    current.itemIds.every((id) => distinctIds.includes(id))
  )
    return occurrenceId;
  if (current) await ctx.db.patch(current._id, { retractedAt: Date.now() });
  const sourceRevision = existing.length + 1;
  await ctx.db.insert("wearEvidence", {
    userId: fit.userId,
    occurrenceId,
    key: `photo:${fitCheckId}:${sourceRevision}`,
    kind: "photo",
    fitCheckId,
    itemIds: distinctIds,
    unresolvedCount,
    sourceRevision,
    recordedAt: Date.now(),
  });
  await ctx.db.patch(fitCheckId, { wearOccurrenceId: occurrenceId });
  return reviseWear(ctx, occurrenceId, current ? "correction" : "photo");
}
