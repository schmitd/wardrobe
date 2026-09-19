import { v } from "convex/values";
import { internalQuery, internalMutation } from "../../convex/_generated/server";
import { internal } from "../../convex/_generated/api";
import { generatedBioArgs, readStyleBioContext, saveGeneratedBioForUser } from "./profile";

export const load = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    if (await ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first()) return null;
    const job = await ctx.db.query("styleBioJobs").withIndex("by_user", q => q.eq("userId", userId)).unique();
    return job ? { revision: job.revision, context: await readStyleBioContext(ctx, userId) } : null;
  },
});
export const save = internalMutation({
  args: { ...generatedBioArgs, userId: v.string(), jobRevision: v.number() },
  handler: async (ctx, { userId, jobRevision, ...args }) => {
    if (await ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first()) return { success: false as const, reason: "account_deleted" };
    const job = await ctx.db.query("styleBioJobs").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (!job || job.revision !== jobRevision) return { success: false as const, reason: "context_changed" };
    return saveGeneratedBioForUser(ctx, args, { userId });
  },
});
export const finish = internalMutation({
  args: { userId: v.string(), revision: v.number(), success: v.boolean() },
  handler: async (ctx, { userId, revision, success }) => {
    const job = await ctx.db.query("styleBioJobs").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (!job) return null;
    const deleted = await ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first();
    const changed = job.revision !== revision;
    const attempts = changed ? 0 : job.attempts + 1;
    if (!deleted && (changed || (!success && attempts < 3))) {
      await ctx.db.patch(job._id, { attempts, queuedAt: Date.now(), updatedAt: Date.now() });
      await ctx.scheduler.runAfter(changed ? 1_000 : attempts * 30_000, internal.styleMemory.refresh, { userId });
    } else {
      if (!success && !deleted) console.warn("style_bio.refresh.exhausted", { attempts });
      await ctx.db.delete(job._id);
    }
    return null;
  },
});

// Scheduled actions can be interrupted by a process failure before their finally
// path runs. A bounded watchdog releases or retries the persisted job lease.
export const watchdog = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const job = await ctx.db.query("styleBioJobs").withIndex("by_user", q => q.eq("userId", userId)).unique();
    if (!job) return null;
    const deleted = await ctx.db.query("deletedAccounts").withIndex("by_user", q => q.eq("userId", userId)).first();
    if (deleted || job.attempts >= 2) { await ctx.db.delete(job._id); return null; }
    const remaining = job.queuedAt + 300_000 - Date.now();
    if (remaining <= 0) {
      await ctx.db.patch(job._id, { attempts: job.attempts + 1, queuedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.styleMemory.refresh, { userId });
    }
    await ctx.scheduler.runAfter(Math.max(1_000, remaining > 0 ? remaining : 300_000), internal.styleMemoryData.watchdog, { userId });
    return null;
  },
});
