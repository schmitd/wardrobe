import type { MutationCtx } from "../convex/_generated/server";
import { internal } from "../convex/_generated/api";
export async function scheduleReminderRefresh(
  ctx: MutationCtx,
  userId: string,
) {
  const prefs = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (prefs && (prefs.daily || prefs.planned))
    await ctx.scheduler.runAfter(0, internal.reminders.reconcile, { userId });
}
