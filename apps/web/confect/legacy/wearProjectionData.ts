import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
} from "../../convex/_generated/server";
import { isCurrentWearFact } from "@wardrobe/shared";
import type { WearProjectionSnapshot } from "../wearProjectionPolicy";
import { internal } from "../../convex/_generated/api";

export const claim = internalMutation({
  args: { id: v.id("wearProjectionOutbox") },
  handler: async (ctx, { id }): Promise<WearProjectionSnapshot | null> => {
    const job = await ctx.db.get(id);
    if (
      !job ||
      job.state !== "pending" ||
      process.env.WARDROBE_WEAR_ZEP_MODE !== "live"
    )
      return null;
    if (
      await ctx.db
        .query("deletedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", job.userId))
        .first()
    )
      return null;
    const lock = await ctx.db
      .query("wearGraphLocks")
      .withIndex("by_user", (q) => q.eq("userId", job.userId))
      .unique();
    if (lock) {
      if (Date.now() - lock.startedAt < 600_000)
        await ctx.scheduler.runAfter(15_000, internal.wearGraph.project, {
          id,
        });
      else
        await ctx.db.patch(id, {
          state: "uncertain",
          failureKind: "previous_projection_unresolved",
          updatedAt: Date.now(),
        });
      return null;
    }
    const row = job.occurrenceId
      ? await ctx.db.get(job.occurrenceId)
      : job.planId
        ? await ctx.db.get(job.planId)
        : null;
    const revision =
      row && ("revision" in row ? row.revision : row.planRevision);
    if (!row || row.userId !== job.userId || revision !== job.revision) {
      await ctx.db.patch(id, { state: "superseded", updatedAt: Date.now() });
      return null;
    }
    await ctx.db.patch(id, {
      state: "sending",
      attempts: job.attempts + 1,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      600_000,
      internal.wearProjectionData.quarantineStalled,
      { id },
    );
    await ctx.db.insert("wearGraphLocks", {
      userId: job.userId,
      jobId: id,
      startedAt: Date.now(),
    });
    if (job.occurrenceId && "revision" in row) {
      const evidence = await ctx.db
        .query("wearEvidence")
        .withIndex("by_occurrence", (q) =>
          q.eq("occurrenceId", job.occurrenceId!),
        )
        .take(101);
      return {
        kind: "wear",
        userId: job.userId,
        id: row._id,
        revision: row.revision,
        localDate: row.localDate,
        timezone: row.timezone,
        recordedAt: job.recordedAt,
        active: row.active,
        itemIds: row.itemIds,
        planId: row.planId,
        planRevision: row.planRevision,
        outcome: row.outcome,
        evidenceIds: evidence
          .filter((e) => e.userId === job.userId && e.retractedAt === undefined)
          .map((e) => e._id),
      };
    }
    if (job.planId && "date" in row)
      return {
        kind: "plan",
        userId: job.userId,
        id: row._id,
        revision: job.revision,
        localDate: row.date,
        recordedAt: job.recordedAt,
        active: row.status !== "dismissed",
        itemIds: row.itemIds,
        evidenceIds: [],
      };
    return null;
  },
});

export const finish = internalMutation({
  args: {
    id: v.id("wearProjectionOutbox"),
    edgeIds: v.array(v.string()),
    taskIds: v.array(v.string()),
    nodeIds: v.array(
      v.object({ sourceRef: v.string(), uuid: v.string(), kind: v.string() }),
    ),
    failureKind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job || job.state !== "sending") return null;
    const row = job.occurrenceId
      ? await ctx.db.get(job.occurrenceId)
      : job.planId
        ? await ctx.db.get(job.planId)
        : null;
    const currentRevision =
      row && ("revision" in row ? row.revision : row.planRevision);
    const deleted = await ctx.db
      .query("deletedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", job.userId))
      .first();
    const edgeIds = [...new Set([...(job.edgeIds ?? []), ...args.edgeIds])];
    const taskIds = args.failureKind
      ? [...new Set([...(job.taskIds ?? []), ...args.taskIds])]
      : args.taskIds;
    const nodeIds = args.nodeIds.length ? args.nodeIds : (job.nodeIds ?? []);
    await ctx.db.patch(job._id, {
      state:
        deleted || currentRevision !== job.revision
          ? "superseded"
          : args.failureKind || args.taskIds.length
            ? "uncertain"
            : "delivered",
      edgeIds,
      nodeIds,
      taskIds,
      failureKind: args.failureKind,
      updatedAt: Date.now(),
    });
    if (
      ((!args.failureKind || args.failureKind === "superseded") &&
        !taskIds.length) ||
      deleted
    ) {
      const lock = await ctx.db
        .query("wearGraphLocks")
        .withIndex("by_user", (q) => q.eq("userId", job.userId))
        .unique();
      if (lock?.jobId === job._id) await ctx.db.delete(lock._id);
    }
    return { accountDeleted: Boolean(deleted), userId: job.userId };
  },
});

export const references = internalQuery({
  args: { id: v.id("wearProjectionOutbox") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (!job) return { edgeIds: [], nodeIds: [] };
    const previous = job.occurrenceId
      ? await ctx.db
          .query("wearProjectionOutbox")
          .withIndex("by_occurrence_revision", (q) =>
            q.eq("occurrenceId", job.occurrenceId).lt("revision", job.revision),
          )
          .order("desc")
          .take(100)
      : await ctx.db
          .query("wearProjectionOutbox")
          .withIndex("by_plan_revision", (q) =>
            q.eq("planId", job.planId).lt("revision", job.revision),
          )
          .order("desc")
          .take(100);
    const aggregate = job.occurrenceId
      ? await ctx.db.get(job.occurrenceId)
      : job.planId
        ? await ctx.db.get(job.planId)
        : null;
    const refs = [
      ...new Set([
        job.occurrenceId ?? job.planId ?? "",
        ...(aggregate?.itemIds ?? []),
        ...(aggregate && "planId" in aggregate && aggregate.planId
          ? [aggregate.planId]
          : []),
      ]),
    ];
    const nodes = await Promise.all(
      refs.map((sourceRef) =>
        ctx.db
          .query("wearGraphNodes")
          .withIndex("by_user_ref", (q) =>
            q.eq("userId", job.userId).eq("sourceRef", sourceRef),
          )
          .unique(),
      ),
    );
    const completedIndex = previous.findIndex(
      (row) => row.state === "delivered",
    );
    const relevant =
      completedIndex < 0 ? previous : previous.slice(0, completedIndex + 1);
    return {
      edgeIds: [
        ...new Set(
          relevant
            .filter((row) => row.userId === job.userId)
            .flatMap((row) => row.edgeIds ?? []),
        ),
      ],
      nodeIds: nodes.flatMap((node) =>
        node
          ? [{ sourceRef: node.sourceRef, uuid: node.uuid, kind: node.kind }]
          : [],
      ),
    };
  },
});

export const progress = internalMutation({
  args: {
    id: v.id("wearProjectionOutbox"),
    edgeIds: v.array(v.string()),
    taskIds: v.array(v.string()),
    nodeIds: v.array(
      v.object({ sourceRef: v.string(), uuid: v.string(), kind: v.string() }),
    ),
  },
  handler: async (ctx, { id, ...value }) => {
    const job = await ctx.db.get(id);
    if (!job || job.state !== "sending") return false;
    if (
      value.edgeIds.length > 64 ||
      value.taskIds.length > 64 ||
      value.nodeIds.length > 64
    )
      throw new Error("Projection references exceeded limits");
    await ctx.db.patch(id, { ...value, updatedAt: Date.now() });
    for (const node of value.nodeIds) {
      const existing = await ctx.db
        .query("wearGraphNodes")
        .withIndex("by_user_ref", (q) =>
          q.eq("userId", job.userId).eq("sourceRef", node.sourceRef),
        )
        .unique();
      if (
        existing &&
        (existing.uuid !== node.uuid || existing.kind !== node.kind)
      )
        throw new Error("Graph identity conflict");
      if (!existing)
        await ctx.db.insert("wearGraphNodes", { userId: job.userId, ...node });
    }
    const row = job.occurrenceId
      ? await ctx.db.get(job.occurrenceId)
      : job.planId
        ? await ctx.db.get(job.planId)
        : null;
    const deleted = await ctx.db
      .query("deletedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", job.userId))
      .first();
    return (
      !deleted &&
      row?.userId === job.userId &&
      ("revision" in row ? row.revision : row.planRevision) === job.revision
    );
  },
});

export const currentFacts = internalQuery({
  args: {
    userId: v.string(),
    candidates: v.optional(
      v.array(
        v.object({
          ontologyVersion: v.number(),
          occurrenceId: v.string(),
          revision: v.number(),
          itemId: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, { userId, candidates }) => {
    if (
      await ctx.db
        .query("deletedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first()
    )
      return [];
    if (candidates && candidates.length > 30)
      throw new Error("Too many wear candidates");
    const rows = candidates
      ? (
          await Promise.all(
            [...new Set(candidates.map((c) => c.occurrenceId))].map((id) => {
              const normalized = ctx.db.normalizeId("wearOccurrences", id);
              return normalized ? ctx.db.get(normalized) : null;
            }),
          )
        ).filter((row) => row?.userId === userId)
      : await ctx.db
          .query("wearOccurrences")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(20);
    const facts: { fact: string; relation: string; relevance: null }[] = [];
    for (const row of rows) {
      if (!row?.active || !row.itemIds.length) continue;
      const ids = candidates
        ? row.itemIds.filter((itemId) =>
            candidates.some(
              (c) =>
                c.itemId === itemId &&
                isCurrentWearFact(c, {
                  id: row._id,
                  revision: row.revision,
                  itemIds: row.itemIds,
                  active: row.active,
                }),
            ),
          )
        : row.itemIds;
      for (const itemId of ids.slice(0, 12)) {
        const item = await ctx.db.get(itemId);
        if (item?.userId !== userId) continue;
        facts.push({
          fact: `${row.localDate ?? "Wear date unknown"}: wore ${(item.description || item.category || "a saved piece").slice(0, 300)}.`,
          relation: "WORE_ITEM",
          relevance: null,
        });
      }
    }
    return facts.slice(0, 30);
  },
});

/** An action crash is uncertain; a timeout is never permission to resubmit. */
export const quarantineStalled = internalMutation({
  args: { id: v.id("wearProjectionOutbox") },
  handler: async (ctx, { id }) => {
    const job = await ctx.db.get(id);
    if (job?.state === "sending")
      await ctx.db.patch(id, {
        state: "uncertain",
        failureKind: "action_completion_unknown",
        updatedAt: Date.now(),
      });
    return null;
  },
});

/** Operator-only release step, deliberately separate from enabling the flag. */
export const activateShadowBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.WARDROBE_WEAR_ZEP_MODE !== "live")
      throw new Error("Live projection gate is disabled");
    const jobs = await ctx.db
      .query("wearProjectionOutbox")
      .withIndex("by_state", (q) => q.eq("state", "shadow"))
      .take(25);
    for (const job of jobs) {
      await ctx.db.patch(job._id, { state: "pending", updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.wearGraph.project, {
        id: job._id,
      });
    }
    return { activated: jobs.length };
  },
});
