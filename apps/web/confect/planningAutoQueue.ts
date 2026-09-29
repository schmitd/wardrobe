import { makeFunctionReference } from "convex/server";
import type { Doc } from "../convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../convex/_generated/server";
import { nextPlanningRun } from "../src/lib/planning-time";

const run = makeFunctionReference<
  "action",
  { userId: string; revision: number },
  null
>("planningAuto:generate");
export const expireAutoPlan = makeFunctionReference<
  "mutation",
  { userId: string; revision: number },
  null
>("planningAutoData:expire");
export async function activeAutoPlan(
  ctx: QueryCtx,
  userId: string,
  revision: number,
) {
  if (
    await ctx.db
      .query("deletedAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  )
    return null;
  const row = await ctx.db
    .query("planningSettings")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return row?.autoPlanEnabled && row.autoPlanRevision === revision ? row : null;
}
export async function queueAutoPlan(
  ctx: MutationCtx,
  row: Doc<"planningSettings">,
  when: number,
  error?: "calendar" | "generation",
  attempt = 0,
) {
  if (row.autoPlanJobId) {
    const job = await ctx.db.system.get(row.autoPlanJobId);
    if (job?.state.kind === "pending")
      await ctx.scheduler.cancel(row.autoPlanJobId);
  }
  const revision = (row.autoPlanRevision ?? 0) + 1;
  const jobId = await ctx.scheduler.runAt(when, run, {
    userId: row.userId,
    revision,
  });
  await ctx.db.patch(row._id, {
    autoPlanRevision: revision,
    autoPlanState: error ? "error" : "scheduled",
    autoPlanNextAt: when,
    autoPlanError: error,
    autoPlanAttempt: attempt,
    autoPlanJobId: jobId,
  });
}
export async function finishAutoPlan(
  ctx: MutationCtx,
  userId: string,
  revision: number,
  error?: "calendar" | "generation",
) {
  const row = await activeAutoPlan(ctx, userId, revision);
  if (!row || row.autoPlanState !== "running") return;
  const attempt = row.autoPlanAttempt ?? 0;
  // Calendar needs user recovery; transient generation gets one bounded retry.
  const retry = error === "generation" && attempt < 1;
  await queueAutoPlan(
    ctx,
    row,
    retry ? Date.now() + 60000 : nextPlanningRun(row.autoPlanTimezone ?? "UTC"),
    error,
    retry ? attempt + 1 : 0,
  );
}
