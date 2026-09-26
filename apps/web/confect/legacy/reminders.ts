import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "../../convex/_generated/server";
import type { MutationCtx, QueryCtx } from "../../convex/_generated/server";
import type { Doc } from "../../convex/_generated/dataModel";
import { internal } from "../../convex/_generated/api";
import { getAuthenticatedUserId } from "./authIdentity";
import {
  REMINDER_POLICY_VERSION,
  defaultReminders,
  evaluateReminder,
  reminderInstant,
  validateReminderPreferences,
  zonedClock,
  shiftDay,
} from "@wardrobe/shared";

const preferenceArgs = {
  daily: v.boolean(),
  planned: v.boolean(),
  timezone: v.string(),
  middayMinute: v.number(),
  quietStart: v.number(),
  quietEnd: v.number(),
  dailyCap: v.number(),
};
const fail = (message: string): never => {
  throw new ConvexError({ message });
};
async function owner(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthenticatedUserId(ctx);
  return id ?? fail("Sign in to manage reminders.");
}
const prefsFor = (ctx: QueryCtx | MutationCtx, userId: string) =>
  ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
export const settings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await owner(ctx),
      prefs = await prefsFor(ctx, userId);
    const installations = await ctx.db
      .query("notificationInstallations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(20);
    return {
      preferences: prefs
        ? {
            daily: prefs.daily,
            planned: prefs.planned,
            timezone: prefs.timezone,
            middayMinute: prefs.middayMinute,
            quietStart: prefs.quietStart,
            quietEnd: prefs.quietEnd,
            dailyCap: prefs.dailyCap,
          }
        : null,
      primaryInstallationId: prefs?.primaryInstallationId,
      installations: installations
        .filter((row) => !row.revokedAt)
        .map((row) => ({
          id: row._id,
          label: row.label,
          transport: row.transport,
        })),
      live: process.env.WARDROBE_NOTIFICATIONS_MODE === "live",
      webPublicKey: process.env.WEB_PUSH_PUBLIC_KEY ?? null,
    };
  },
});
export const preferences = mutation({
  args: {
    ...preferenceArgs,
    primaryInstallationId: v.optional(v.id("notificationInstallations")),
  },
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    validateReminderPreferences(args);
    const row = await prefsFor(ctx, userId);
    if (args.primaryInstallationId) {
      const install = await ctx.db.get(args.primaryInstallationId);
      if (install?.userId !== userId || install.revokedAt)
        return fail("Choose an available device.");
    }
    const value = {
      ...args,
      userId,
      revision: (row?.revision ?? 0) + 1,
      nextReconcileAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, value);
    else await ctx.db.insert("notificationPreferences", value);
    await ctx.scheduler.runAfter(0, internal.reminders.reconcile, { userId });
    return null;
  },
});
export const register = mutation({
  args: {
    installationId: v.string(),
    transport: v.union(v.literal("expo"), v.literal("web")),
    endpoint: v.string(),
    p256dh: v.optional(v.string()),
    auth: v.optional(v.string()),
    label: v.string(),
    timezone: v.string(),
    select: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    zonedClock(Date.now(), args.timezone);
    if (
      !/^[a-zA-Z0-9_-]{16,100}$/.test(args.installationId) ||
      args.label.length > 60
    )
      return fail("Invalid device registration.");
    if (
      args.transport === "expo" &&
      !/^(Expo|Exponent)PushToken\[[a-zA-Z0-9_-]+\]$/.test(args.endpoint)
    )
      return fail("Invalid push token.");
    if (args.transport === "web") {
      let url: URL;
      try {
        url = new URL(args.endpoint);
      } catch {
        return fail("Invalid push subscription.");
      }
      // A subscription is an outbound destination; allow only browser push services.
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        !(
          url.hostname === "fcm.googleapis.com" ||
          url.hostname === "updates.push.services.mozilla.com" ||
          url.hostname.endsWith(".push.apple.com") ||
          url.hostname === "web.push.apple.com" ||
          url.hostname.endsWith(".notify.windows.com")
        ) ||
        args.endpoint.length > 2048 ||
        !args.p256dh ||
        !args.auth ||
        args.p256dh.length > 200 ||
        args.auth.length > 100
      )
        return fail("Unsupported push subscription.");
    }
    const existing = await ctx.db
      .query("notificationInstallations")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();
    if (existing?.revokedAt && !args.select)
      return fail("Select this device again to enable reminders.");
    if (
      existing &&
      existing.userId !== userId &&
      existing.endpoint !== args.endpoint
    )
      return fail("Register this device again.");
    const duplicate = await ctx.db
      .query("notificationInstallations")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .take(21);
    if (duplicate.length > 20) return fail("Push registration needs review.");
    for (const row of duplicate)
      if (row._id !== existing?._id)
        await ctx.db.patch(row._id, {
          revokedAt: Date.now(),
          revision: row.revision + 1,
        });
    const value = {
      userId,
      installationId: args.installationId,
      transport: args.transport,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      label: args.label || (args.transport === "expo" ? "Phone" : "Browser"),
      revision: (existing?.revision ?? 0) + 1,
      revokedAt: undefined,
      lastSeenAt: Date.now(),
    };
    const id =
      existing?._id ??
      (await ctx.db.insert("notificationInstallations", value));
    if (existing) await ctx.db.patch(id, value);
    const prefs = await prefsFor(ctx, userId);
    if (!prefs)
      await ctx.db.insert("notificationPreferences", {
        ...defaultReminders(args.timezone),
        userId,
        ...(args.select ? { primaryInstallationId: id } : {}),
        revision: 1,
        nextReconcileAt: Date.now(),
        updatedAt: Date.now(),
      });
    else if (
      args.select ||
      (prefs.primaryInstallationId === id && prefs.timezone !== args.timezone)
    )
      await ctx.db.patch(prefs._id, {
        primaryInstallationId: id,
        timezone: args.timezone,
        revision: prefs.revision + 1,
        nextReconcileAt: Date.now(),
        updatedAt: Date.now(),
      });
    await ctx.scheduler.runAfter(0, internal.reminders.reconcile, { userId });
    return id;
  },
});
export const revoke = mutation({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    const row = await ctx.db
      .query("notificationInstallations")
      .withIndex("by_installation", (q) =>
        q.eq("installationId", args.installationId),
      )
      .unique();
    if (row?.userId === userId)
      await ctx.db.patch(row._id, {
        revokedAt: Date.now(),
        revision: row.revision + 1,
      });
    return null;
  },
});
export const capture = mutation({
  args: { active: v.boolean(), planId: v.optional(v.id("outfitSuggestions")) },
  handler: async (ctx, args) => {
    const userId = await owner(ctx),
      row = await prefsFor(ctx, userId);
    if (!row) return null;
    if (args.planId && (await ctx.db.get(args.planId))?.userId !== userId)
      return fail("Plan unavailable.");
    await ctx.db.patch(row._id, {
      captureUntil: args.active ? Date.now() + 600_000 : undefined,
      capturePlanId: args.active ? args.planId : undefined,
    });
    return null;
  },
});
export const schedule = mutation({
  args: {
    planId: v.id("outfitSuggestions"),
    expectedRevision: v.number(),
    timezone: v.string(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    calendarId: v.optional(v.string()),
    eventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await owner(ctx),
      plan = await ctx.db.get(args.planId);
    if (
      plan?.userId !== userId ||
      !["planned", "worn"].includes(plan.status) ||
      (plan.planRevision ?? 0) !== args.expectedRevision
    )
      return fail("Review the current accepted plan first.");
    zonedClock(Date.now(), args.timezone);
    if (
      args.startsAt !== undefined &&
      (!Number.isFinite(args.startsAt) ||
        zonedClock(args.startsAt, args.timezone).date !== plan.date ||
        args.startsAt > Date.now() + 366 * 86_400_000)
    )
      return fail("Choose a time on this plan's date.");
    if (
      args.endsAt !== undefined &&
      (args.startsAt === undefined ||
        !Number.isFinite(args.endsAt) ||
        args.endsAt <= args.startsAt ||
        args.endsAt > args.startsAt + 86_400_000)
    )
      return fail("Choose a valid end time.");
    if (
      (args.eventId && !args.calendarId) ||
      (args.calendarId && args.startsAt === undefined)
    )
      return fail("Choose a timed calendar event.");
    const calendar = args.calendarId
      ? await ctx.db
          .query("planningSettings")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique()
      : null;
    if (
      args.calendarId &&
      (!calendar?.calendarEnabled ||
        !calendar.calendarIds.includes(args.calendarId) ||
        !args.eventId ||
        args.eventId.length > 500)
    )
      return fail("Reconnect the selected calendar first.");
    await ctx.db.patch(plan._id, {
      reminderStartsAt: args.startsAt,
      reminderEndsAt: args.endsAt,
      reminderTimezone: args.timezone,
      reminderTimeConfirmedAt: args.calendarId ? undefined : Date.now(),
      reminderScheduleRevision: (plan.reminderScheduleRevision ?? 0) + 1,
      reminderCalendarId: args.calendarId,
      reminderEventId: args.eventId,
      reminderCalendarRevision: calendar?.calendarRevision ?? 0,
      reminderCalendarCheckedAt: undefined,
      reminderCalendarActive: args.calendarId ? false : undefined,
      reminderNextRefreshAt: args.calendarId ? Date.now() : undefined,
    });
    if (args.calendarId)
      await ctx.scheduler.runAfter(
        0,
        internal.reminderDelivery.refreshCalendar,
        { planId: plan._id },
      );
    await ctx.scheduler.runAfter(0, internal.reminders.reconcile, { userId });
    return null;
  },
});

export const reconcile = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const prefs = await prefsFor(ctx, userId);
    if (!prefs) return null;
    const now = Date.now();
    await ctx.db.patch(prefs._id, { nextReconcileAt: now + 6 * 3_600_000 });
    if (
      (!prefs.daily && !prefs.planned) ||
      !prefs.primaryInstallationId ||
      (await ctx.db
        .query("deletedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first())
    )
      return null;
    const today = zonedClock(now, prefs.timezone).date,
      through = shiftDay(today, 7);
    const plans = await ctx.db
      .query("outfitSuggestions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("date", today).lte("date", through),
      )
      .take(101);
    if (plans.length > 100) return null; // Unknown coverage must never become "no plans".
    const opportunities: {
      key: string;
      kind: Doc<"notificationIntents">["kind"];
      date: string;
      dueAt: number;
      expiresAt: number;
      plan?: Doc<"outfitSuggestions">;
    }[] = [];
    if (prefs.daily)
      for (let d = 0; d < 8; d++) {
        const date = shiftDay(today, d),
          dueAt = reminderInstant(date, prefs.middayMinute, prefs.timezone);
        opportunities.push({
          key: `daily:${date}`,
          kind: "daily_fit_due",
          date,
          dueAt,
          expiresAt: dueAt + 2 * 3_600_000,
        });
      }
    if (prefs.planned)
      for (const plan of plans.filter(
        (p) => p.status === "planned" && !p.notWornAt,
      )) {
        const dueAt =
          plan.reminderStartsAt ??
          reminderInstant(plan.date, prefs.middayMinute, prefs.timezone);
        opportunities.push({
          key: `plan:${plan._id}`,
          kind:
            plan.reminderStartsAt === undefined
              ? "untimed_plan_fit_due"
              : "planned_fit_due",
          date: plan.date,
          dueAt,
          expiresAt: Math.min(
            dueAt + (plan.reminderStartsAt === undefined ? 2 : 1) * 3_600_000,
            plan.reminderEndsAt ?? Infinity,
          ),
          plan,
        });
      }
    opportunities.sort(
      (a, b) => a.dueAt - b.dueAt || a.key.localeCompare(b.key),
    );
    for (const opportunity of opportunities) {
      if (opportunity.expiresAt <= now) continue;
      const old = await ctx.db
        .query("notificationIntents")
        .withIndex("by_user_key", (q) =>
          q.eq("userId", userId).eq("logicalKey", opportunity.key),
        )
        .unique();
      if (
        old?.reservationAt ||
        old?.state === "submitted" ||
        old?.state === "unknown"
      )
        continue;
      if (
        old &&
        old.policyVersion === REMINDER_POLICY_VERSION &&
        old.preferenceRevision === prefs.revision &&
        old.planRevision === opportunity.plan?.planRevision &&
        old.sourceRevision ===
          (opportunity.plan?.reminderScheduleRevision ?? 0) &&
        old.dueAt === opportunity.dueAt
      )
        continue;
      if (old?.jobId) await ctx.scheduler.cancel(old.jobId);
      const value = {
        userId,
        logicalKey: opportunity.key,
        kind: opportunity.kind,
        localDate: opportunity.date,
        planId: opportunity.plan?._id,
        planRevision: opportunity.plan?.planRevision,
        sourceRevision: opportunity.plan?.reminderScheduleRevision ?? 0,
        preferenceRevision: prefs.revision,
        policyVersion: REMINDER_POLICY_VERSION,
        scheduleRevision: (old?.scheduleRevision ?? 0) + 1,
        dueAt: opportunity.dueAt,
        expiresAt: opportunity.expiresAt,
        state: "scheduled" as const,
        reason: undefined,
        updatedAt: now,
      };
      const id =
        old?._id ??
        (await ctx.db.insert("notificationIntents", {
          ...value,
          createdAt: now,
        }));
      if (old) await ctx.db.patch(id, value);
      const jobId = await ctx.scheduler.runAt(
        Math.max(now, opportunity.dueAt),
        internal.reminderDelivery.deliver,
        { id, scheduleRevision: value.scheduleRevision },
      );
      await ctx.db.patch(id, { jobId });
    }
    return null;
  },
});

async function dayFacts(
  ctx: QueryCtx | MutationCtx,
  job: Doc<"notificationIntents">,
) {
  const prefs = await prefsFor(ctx, job.userId);
  if (!prefs) return null;
  const install = prefs.primaryInstallationId
    ? await ctx.db.get(prefs.primaryInstallationId)
    : null;
  const plans = await ctx.db
    .query("outfitSuggestions")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", job.userId).eq("date", job.localDate),
    )
    .take(101);
  const wears = await ctx.db
    .query("wearOccurrences")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", job.userId).eq("localDate", job.localDate),
    )
    .take(101);
  const budget = await ctx.db
    .query("notificationBudgets")
    .withIndex("by_user", (q) => q.eq("userId", job.userId))
    .unique();
  const deleted = await ctx.db
    .query("deletedAccounts")
    .withIndex("by_user", (q) => q.eq("userId", job.userId))
    .first();
  return { prefs, install, plans, wears, budget, deleted };
}

async function policyFacts(
  ctx: QueryCtx | MutationCtx,
  job: Doc<"notificationIntents">,
  ownReservation = false,
  shared?: NonNullable<Awaited<ReturnType<typeof dayFacts>>>,
) {
  const day = shared ?? (await dayFacts(ctx, job));
  if (!day) return null;
  const { prefs, install, plans, wears, budget, deleted } = day;
  const plan = job.planId ? await ctx.db.get(job.planId) : null;
  const corresponding = plan?.wearOccurrenceId
    ? await ctx.db.get(plan.wearOccurrenceId)
    : null;
  const settings = plan?.reminderCalendarId
    ? await ctx.db
        .query("planningSettings")
        .withIndex("by_user", (q) => q.eq("userId", job.userId))
        .unique()
    : null;
  const calendarFresh = !plan?.reminderCalendarId
    ? !plan?.reminderStartsAt || Boolean(plan.reminderTimeConfirmedAt)
    : Boolean(
        settings?.calendarEnabled &&
          settings.calendarIds.includes(plan.reminderCalendarId) &&
          (settings.calendarRevision ?? 0) === plan.reminderCalendarRevision &&
          plan.reminderCalendarActive &&
          Date.now() - (plan.reminderCalendarCheckedAt ?? 0) <= 900_000,
      );
  return {
    day,
    prefs,
    install,
    plan,
    budget,
    decision: evaluateReminder({
      now: Date.now(),
      dueAt: job.dueAt,
      expiresAt: job.expiresAt,
      kind: job.kind,
      preferences: prefs,
      deviceReady: Boolean(
        install &&
          install.userId === job.userId &&
          !install.revokedAt &&
          Date.now() - install.lastSeenAt < 90 * 86_400_000,
      ),
      currentRevision:
        job.policyVersion === REMINDER_POLICY_VERSION &&
        !deleted &&
        prefs.revision === job.preferenceRevision &&
        (!job.planId ||
          Boolean(
            plan?.userId === job.userId &&
              plan.status === "planned" &&
              plan.planRevision === job.planRevision &&
              (plan.reminderScheduleRevision ?? 0) === job.sourceRevision,
          )),
      factsKnown: plans.length <= 100 && wears.length <= 100,
      hasAcceptedPlan: plans.some(
        (p) => ["planned", "worn"].includes(p.status) && !p.notWornAt,
      ),
      hasDailyWear: wears.some((w) => w.active),
      hasCorrespondingEvidence: Boolean(
        corresponding?.userId === job.userId && corresponding.active,
      ),
      explicitlyNotWorn: Boolean(plan?.notWornAt),
      calendarFresh,
      captureUntil:
        !job.planId ||
        !prefs.capturePlanId ||
        prefs.capturePlanId === job.planId
          ? prefs.captureUntil
          : undefined,
      usedToday:
        !ownReservation &&
        budget?.localDate === zonedClock(Date.now(), prefs.timezone).date
          ? budget.count
          : 0,
      lastReservedAt: ownReservation ? undefined : budget?.lastReservedAt,
      lastDailyAt: ownReservation ? undefined : budget?.lastDailyAt,
    }),
  };
}
export const claim = internalMutation({
  args: { id: v.id("notificationIntents"), scheduleRevision: v.number() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (
      !job ||
      job.state !== "scheduled" ||
      job.scheduleRevision !== args.scheduleRevision
    )
      return null;
    const facts = await policyFacts(ctx, job);
    if (!facts) return null;
    if (facts.decision.action === "defer") {
      const jobId = await ctx.scheduler.runAt(
        facts.decision.until,
        internal.reminderDelivery.deliver,
        args,
      );
      await ctx.db.patch(job._id, { jobId });
      return null;
    }
    if (facts.decision.action === "suppress") {
      await ctx.db.patch(job._id, {
        state: Date.now() >= job.expiresAt ? "expired" : "suppressed",
        reason: facts.decision.reason,
        updatedAt: Date.now(),
      });
      return null;
    }
    const peers = await ctx.db
      .query("notificationIntents")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", job.userId).eq("localDate", job.localDate),
      )
      .take(101);
    if (peers.length > 100) {
      await ctx.db.patch(job._id, {
        state: "suppressed",
        reason: "facts_unknown",
        updatedAt: Date.now(),
      });
      return null;
    }
    const earlier = peers.filter(
      (peer) =>
        peer._id !== job._id &&
        peer.state === "scheduled" &&
        (peer.dueAt < job.dueAt ||
          (peer.dueAt === job.dueAt &&
            peer.logicalKey.localeCompare(job.logicalKey) < 0)),
    );
    for (const peer of earlier) {
      const candidate = await policyFacts(ctx, peer, false, facts.day);
      if (candidate?.decision.action === "send") {
        const jobId = await ctx.scheduler.runAfter(
          1_000,
          internal.reminderDelivery.deliver,
          args,
        );
        await ctx.db.patch(job._id, { jobId });
        return null;
      }
    }
    if (process.env.WARDROBE_NOTIFICATIONS_MODE !== "live") {
      await ctx.db.patch(job._id, {
        state: "shadow",
        reason: "eligible_shadow",
        updatedAt: Date.now(),
      });
      return null;
    }
    const { prefs, install, budget } = facts;
    if (!install) return null;
    if (
      process.env[
        install.transport === "expo"
          ? "WARDROBE_EXPO_PUSH_ENABLED"
          : "WARDROBE_WEB_PUSH_ENABLED"
      ] !== "true"
    ) {
      await ctx.db.patch(job._id, {
        state: "suppressed",
        reason: "transport_disabled",
        updatedAt: Date.now(),
      });
      return null;
    }
    const now = Date.now(),
      date = zonedClock(now, prefs.timezone).date;
    const value = {
      userId: job.userId,
      localDate: date,
      count: (budget?.localDate === date ? budget.count : 0) + 1,
      lastReservedAt: now,
      lastDailyAt: job.kind === "daily_fit_due" ? now : budget?.lastDailyAt,
    };
    if (budget) await ctx.db.patch(budget._id, value);
    else await ctx.db.insert("notificationBudgets", value);
    await ctx.db.patch(job._id, {
      state: "claimed",
      reservationAt: now,
      updatedAt: now,
    });
    const attemptId = await ctx.db.insert("notificationAttempts", {
      userId: job.userId,
      intentId: job._id,
      installationId: install._id,
      installationRevision: install.revision,
      preferenceRevision: prefs.revision,
      outcome: "reserved",
      receiptChecks: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(60_000, internal.reminders.quarantine, {
      attemptId,
    });
    return attemptId;
  },
});
export const submission = internalQuery({
  args: { attemptId: v.id("notificationAttempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get(attemptId);
    if (
      !attempt ||
      attempt.outcome !== "reserved" ||
      process.env.WARDROBE_NOTIFICATIONS_MODE !== "live"
    )
      return null;
    const job = await ctx.db.get(attempt.intentId);
    if (!job || job.state !== "claimed" || job.expiresAt <= Date.now())
      return null;
    const facts = await policyFacts(ctx, job, true);
    if (
      !facts ||
      !facts.install ||
      facts.install._id !== attempt.installationId ||
      facts.install.revision !== attempt.installationRevision ||
      facts.prefs.revision !== attempt.preferenceRevision
    )
      return null;
    // Our own reservation must not fail its final cap/cooldown check. All other reasons still veto.
    if (facts.decision.action !== "send") return null;
    if (
      process.env[
        facts.install.transport === "expo"
          ? "WARDROBE_EXPO_PUSH_ENABLED"
          : "WARDROBE_WEB_PUSH_ENABLED"
      ] !== "true"
    )
      return null;
    return {
      transport: facts.install.transport,
      endpoint: facts.install.endpoint,
      p256dh: facts.install.p256dh,
      auth: facts.install.auth,
      expiresAt: job.expiresAt,
      reminderId: job._id,
      kind: job.kind,
    };
  },
});
export const finish = internalMutation({
  args: {
    attemptId: v.id("notificationAttempts"),
    outcome: v.union(
      v.literal("provider_accepted"),
      v.literal("provider_handoff"),
      v.literal("definite_rejection"),
      v.literal("unknown"),
    ),
    ticket: v.optional(v.string()),
    errorKind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (
      !attempt ||
      !["reserved", "provider_accepted"].includes(attempt.outcome)
    )
      return null;
    await ctx.db.patch(attempt._id, {
      outcome: args.outcome,
      providerTicket: args.ticket ?? attempt.providerTicket,
      errorKind: args.errorKind,
      updatedAt: Date.now(),
    });
    const job = await ctx.db.get(attempt.intentId);
    if (job)
      await ctx.db.patch(job._id, {
        state:
          args.outcome === "unknown"
            ? "unknown"
            : args.outcome === "definite_rejection"
              ? "suppressed"
              : "submitted",
        reason: args.errorKind,
        updatedAt: Date.now(),
      });
    if (args.errorKind === "device_unregistered") {
      const install = await ctx.db.get(attempt.installationId);
      if (install?.revision === attempt.installationRevision)
        await ctx.db.patch(install._id, {
          revokedAt: Date.now(),
          revision: install.revision + 1,
        });
    }
    if (args.outcome === "provider_accepted" && args.ticket)
      await ctx.scheduler.runAfter(900_000, internal.reminderDelivery.receipt, {
        attemptId: attempt._id,
      });
    return null;
  },
});
export const quarantine = internalMutation({
  args: { attemptId: v.id("notificationAttempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get(attemptId);
    if (attempt?.outcome !== "reserved") return null;
    await ctx.db.patch(attempt._id, {
      outcome: "unknown",
      errorKind: "action_completion_unknown",
      updatedAt: Date.now(),
    });
    const job = await ctx.db.get(attempt.intentId);
    if (job)
      await ctx.db.patch(job._id, {
        state: "unknown",
        reason: "action_completion_unknown",
        updatedAt: Date.now(),
      });
    return null;
  },
});
export const receiptAttempt = internalMutation({
  args: { attemptId: v.id("notificationAttempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get(attemptId);
    if (
      !attempt ||
      attempt.outcome !== "provider_accepted" ||
      !attempt.providerTicket ||
      attempt.receiptChecks >= 3
    )
      return null;
    await ctx.db.patch(attempt._id, {
      receiptChecks: attempt.receiptChecks + 1,
    });
    if (attempt.receiptChecks < 2)
      await ctx.scheduler.runAfter(900_000, internal.reminderDelivery.receipt, {
        attemptId,
      });
    return { ticket: attempt.providerTicket };
  },
});
export const open = query({
  args: { id: v.id("notificationIntents") },
  handler: async (ctx, { id }) => {
    const userId = await owner(ctx),
      job = await ctx.db.get(id);
    if (job?.userId !== userId) return null;
    const plan = job.planId ? await ctx.db.get(job.planId) : null;
    if (job.planId && plan?.userId !== userId) return null;
    const wear = plan?.wearOccurrenceId
      ? await ctx.db.get(plan.wearOccurrenceId)
      : null;
    return {
      planId: plan?._id,
      planRevision: plan?.planRevision,
      date: plan?.date ?? job.localDate,
      resolved: Boolean(
        (wear?.userId === userId && wear.active) || plan?.notWornAt,
      ),
      expired: job.expiresAt <= Date.now(),
    };
  },
});
export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oldIntents = await ctx.db
      .query("notificationIntents")
      .withIndex("by_updated", (q) => q.lte("updatedAt", now - 30 * 86_400_000))
      .take(100);
    for (const intent of oldIntents)
      if (intent.expiresAt < now) await ctx.db.delete(intent._id);
    const oldAttempts = await ctx.db
      .query("notificationAttempts")
      .withIndex("by_created", (q) => q.lte("createdAt", now - 30 * 86_400_000))
      .take(100);
    for (const attempt of oldAttempts) await ctx.db.delete(attempt._id);
    const oldInstallations = await ctx.db
      .query("notificationInstallations")
      .withIndex("by_seen", (q) => q.lte("lastSeenAt", now - 90 * 86_400_000))
      .take(50);
    for (const installation of oldInstallations)
      await ctx.db.delete(installation._id);
    const revoked = await ctx.db
      .query("notificationInstallations")
      .withIndex("by_revoked", (q) =>
        q.gte("revokedAt", 0).lte("revokedAt", now - 30 * 86_400_000),
      )
      .take(50);
    for (const installation of revoked) await ctx.db.delete(installation._id);
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_reconcile", (q) => q.lte("nextReconcileAt", now))
      .take(25);
    for (const row of prefs) {
      await ctx.db.patch(row._id, { nextReconcileAt: now + 6 * 3_600_000 });
      await ctx.scheduler.runAfter(0, internal.reminders.reconcile, {
        userId: row.userId,
      });
    }
    const calendarPlans = await ctx.db
      .query("outfitSuggestions")
      .withIndex("by_reminder_refresh", (q) =>
        q.gte("reminderNextRefreshAt", 0).lte("reminderNextRefreshAt", now),
      )
      .take(25);
    for (const plan of calendarPlans) {
      if (
        plan.status !== "planned" ||
        !plan.reminderCalendarId ||
        !plan.reminderStartsAt ||
        plan.reminderStartsAt < now - 3_600_000
      ) {
        await ctx.db.patch(plan._id, { reminderNextRefreshAt: undefined });
        continue;
      }
      if (plan.reminderStartsAt > now + 8 * 86_400_000) {
        await ctx.db.patch(plan._id, {
          reminderNextRefreshAt: plan.reminderStartsAt - 7 * 86_400_000,
        });
        continue;
      }
      await ctx.db.patch(plan._id, { reminderNextRefreshAt: now + 600_000 });
      await ctx.scheduler.runAfter(
        0,
        internal.reminderDelivery.refreshCalendar,
        { planId: plan._id },
      );
    }
    return null;
  },
});
export const calendarSource = internalQuery({
  args: { planId: v.id("outfitSuggestions") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (
      !plan?.reminderCalendarId ||
      !plan.reminderEventId ||
      plan.status !== "planned" ||
      !plan.reminderStartsAt ||
      plan.reminderStartsAt < Date.now() - 3_600_000 ||
      plan.reminderStartsAt > Date.now() + 8 * 86_400_000
    )
      return null;
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", plan.userId))
      .unique();
    const prefs = await prefsFor(ctx, plan.userId);
    if (
      !prefs?.planned ||
      !settings?.calendarEnabled ||
      !settings.calendarIds.includes(plan.reminderCalendarId) ||
      (settings.calendarRevision ?? 0) !== plan.reminderCalendarRevision ||
      (await ctx.db
        .query("deletedAccounts")
        .withIndex("by_user", (q) => q.eq("userId", plan.userId))
        .first())
    )
      return null;
    return {
      userId: plan.userId,
      calendarId: plan.reminderCalendarId,
      eventId: plan.reminderEventId,
      revision: plan.reminderScheduleRevision ?? 0,
      timezone: plan.reminderTimezone ?? prefs.timezone,
    };
  },
});
export const calendarResult = internalMutation({
  args: {
    planId: v.id("outfitSuggestions"),
    revision: v.number(),
    active: v.boolean(),
    startsAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || (plan.reminderScheduleRevision ?? 0) !== args.revision)
      return null;
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", plan.userId))
      .unique();
    if (
      !settings?.calendarEnabled ||
      (settings.calendarRevision ?? 0) !== plan.reminderCalendarRevision
    )
      return null;
    // A date change cannot rewrite the accepted plan's historical intent.
    const active =
      args.active &&
      args.startsAt !== undefined &&
      zonedClock(args.startsAt, plan.reminderTimezone ?? "UTC").date ===
        plan.date;
    const changed =
      active !== plan.reminderCalendarActive ||
      (active &&
        (args.startsAt !== plan.reminderStartsAt ||
          args.endsAt !== plan.reminderEndsAt));
    await ctx.db.patch(plan._id, {
      reminderCalendarActive: active,
      reminderCalendarCheckedAt: Date.now(),
      ...(active
        ? { reminderStartsAt: args.startsAt, reminderEndsAt: args.endsAt }
        : {}),
      reminderScheduleRevision:
        (plan.reminderScheduleRevision ?? 0) + (changed ? 1 : 0),
      reminderNextRefreshAt: Date.now() + 600_000,
    });
    if (changed)
      await ctx.scheduler.runAfter(0, internal.reminders.reconcile, {
        userId: plan.userId,
      });
    return null;
  },
});

/** Drop provider identifiers after disconnection or calendar selection changes; accepted intent remains. */
export const clearCalendarLinks = internalMutation({
  args: { userId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { userId, paginationOpts }): Promise<null> => {
    const settings = await ctx.db
      .query("planningSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const page = await ctx.db
      .query("outfitSuggestions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .paginate(paginationOpts);
    for (const plan of page.page) {
      if (
        plan.reminderCalendarId &&
        (!settings?.calendarEnabled ||
          !settings.calendarIds.includes(plan.reminderCalendarId) ||
          (settings.calendarRevision ?? 0) !== plan.reminderCalendarRevision)
      ) {
        await ctx.db.patch(plan._id, {
          reminderCalendarId: undefined,
          reminderEventId: undefined,
          reminderCalendarRevision: undefined,
          reminderCalendarCheckedAt: undefined,
          reminderCalendarActive: undefined,
          reminderNextRefreshAt: undefined,
          reminderTimeConfirmedAt: undefined,
          reminderScheduleRevision: (plan.reminderScheduleRevision ?? 0) + 1,
        });
      }
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.reminders.clearCalendarLinks, {
        userId,
        paginationOpts: { numItems: 50, cursor: page.continueCursor },
      });
    return null;
  },
});
