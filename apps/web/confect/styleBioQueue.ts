import type { MutationCtx } from "../convex/_generated/server";
import { internal } from "../convex/_generated/api";
/** Coalesce writes in the committing transaction; background work survives the client. */
export async function scheduleStyleBioRefresh(ctx: MutationCtx, userId: string) {
  const pending = await ctx.db.query("styleBioJobs").withIndex("by_user", q => q.eq("userId", userId)).unique();
  if (pending) { await ctx.db.patch(pending._id, { revision: pending.revision + 1, updatedAt: Date.now() }); return; }
  await ctx.db.insert("styleBioJobs", { userId, revision: 1, attempts: 0, queuedAt: Date.now(), updatedAt: Date.now() });
  await ctx.scheduler.runAfter(1_000, internal.styleMemory.refresh, { userId });
  await ctx.scheduler.runAfter(300_000, internal.styleMemoryData.watchdog, { userId });
}
