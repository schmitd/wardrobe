import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  defaultReminders,
  evaluateReminder,
  reminderInstant,
} from "@wardrobe/shared";
const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries(
  [...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map((path) => [
    `./${path}`,
    () => import(`${directory}${path}`),
  ]),
);
const originalMode = process.env.WARDROBE_NOTIFICATIONS_MODE,
  originalExpo = process.env.WARDROBE_EXPO_PUSH_ENABLED;
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-09-22T16:00:00Z"));
  process.env.WARDROBE_NOTIFICATIONS_MODE = "live";
  process.env.WARDROBE_EXPO_PUSH_ENABLED = "true";
});
afterEach(() => {
  jest.useRealTimers();
  if (originalMode === undefined)
    delete process.env.WARDROBE_NOTIFICATIONS_MODE;
  else process.env.WARDROBE_NOTIFICATIONS_MODE = originalMode;
  if (originalExpo === undefined) delete process.env.WARDROBE_EXPO_PUSH_ENABLED;
  else process.env.WARDROBE_EXPO_PUSH_ENABLED = originalExpo;
});
async function fixture() {
  const t = convexTest(schema, modules),
    alice = t.withIdentity({ subject: "alice" }),
    bob = t.withIdentity({ subject: "bob" });
  await alice.mutation(api.reminders.register, {
    installationId: "synthetic-phone-alice",
    transport: "expo",
    endpoint: "ExpoPushToken[synthetic-alice]",
    label: "Phone",
    timezone: "America/New_York",
    select: true,
  });
  await alice.mutation(api.reminders.preferences, {
    ...defaultReminders("America/New_York"),
    daily: true,
    planned: true,
  });
  await t.mutation(internal.reminders.reconcile, { userId: "alice" });
  const daily = await t.run((ctx) =>
    ctx.db
      .query("notificationIntents")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", "alice").eq("logicalKey", "daily:2026-09-22"),
      )
      .unique(),
  );
  return { t, alice, bob, daily: daily! };
}
test("the reminder policy handles DST, quiet hours, daily plan suppression, and travel", () => {
  expect(
    new Date(
      reminderInstant("2026-03-08", 150, "America/New_York"),
    ).toISOString(),
  ).toBe("2026-03-08T07:00:00.000Z");
  expect(
    new Date(
      reminderInstant("2026-11-01", 90, "America/New_York"),
    ).toISOString(),
  ).toBe("2026-11-01T05:30:00.000Z");
  const input = {
    now: Date.now(),
    dueAt: Date.now(),
    expiresAt: Date.now() + 3_600_000,
    kind: "daily_fit_due" as const,
    preferences: {
      ...defaultReminders("America/New_York"),
      daily: true,
      planned: true,
    },
    deviceReady: true,
    currentRevision: true,
    factsKnown: true,
    hasAcceptedPlan: false,
    hasDailyWear: false,
    hasCorrespondingEvidence: false,
    explicitlyNotWorn: false,
    calendarFresh: true,
    usedToday: 0,
  };
  expect(evaluateReminder(input)).toEqual({ action: "send" });
  expect(evaluateReminder({ ...input, hasAcceptedPlan: true })).toMatchObject({
    reason: "day_has_plan_or_wear",
  });
  expect(
    evaluateReminder({ ...input, lastDailyAt: Date.now() - 19 * 3_600_000 }),
  ).toMatchObject({ reason: "travel_daily_guard" });
  expect(
    evaluateReminder({ ...input, kind: "planned_fit_due", hasDailyWear: true }),
  ).toEqual({ action: "send" });
  expect(evaluateReminder({ ...input, calendarFresh: false })).toMatchObject({
    reason: "calendar_stale",
  });
  expect(evaluateReminder({ ...input, factsKnown: false })).toMatchObject({
    reason: "facts_unknown",
  });
});
test("one transactional reservation survives duplicate jobs and ambiguous completion", async () => {
  const { t, daily } = await fixture();
  const args = { id: daily._id, scheduleRevision: daily.scheduleRevision };
  const attemptId = await t.mutation(internal.reminders.claim, args);
  expect(attemptId).not.toBeNull();
  expect(await t.mutation(internal.reminders.claim, args)).toBeNull();
  expect(
    (await t.run((ctx) => ctx.db.query("notificationBudgets").collect()))[0]
      ?.count,
  ).toBe(1);
  expect(
    await t.query(internal.reminders.submission, { attemptId: attemptId! }),
  ).not.toBeNull();
  await t.mutation(internal.reminders.quarantine, { attemptId: attemptId! });
  await t.mutation(internal.reminders.reconcile, { userId: "alice" });
  expect((await t.run((ctx) => ctx.db.get(daily._id)))?.state).toBe("unknown");
  expect(await t.mutation(internal.reminders.claim, args)).toBeNull();
});
test("evidence recorded on another device wins the last check, even after budget reservation", async () => {
  const { t, daily } = await fixture();
  const attemptId = await t.mutation(internal.reminders.claim, {
    id: daily._id,
    scheduleRevision: daily.scheduleRevision,
  });
  await t.run((ctx) =>
    ctx.db.insert("wearOccurrences", {
      userId: "alice",
      localDate: "2026-09-22",
      timezone: "America/New_York",
      revision: 1,
      itemIds: [],
      unresolvedCount: 1,
      active: true,
      coverage: "partial",
      outcome: "unconfirmed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  expect(
    await t.query(internal.reminders.submission, { attemptId: attemptId! }),
  ).toBeNull();
});
test("device changes, foreign taps and account deletion cannot reuse a reserved send", async () => {
  const { t, alice, bob, daily } = await fixture();
  const attemptId = await t.mutation(internal.reminders.claim, {
    id: daily._id,
    scheduleRevision: daily.scheduleRevision,
  });
  expect(await bob.query(api.reminders.open, { id: daily._id })).toBeNull();
  const settings = await alice.query(api.reminders.settings, {});
  expect(JSON.stringify(settings)).not.toContain("ExpoPushToken");
  await alice.mutation(api.reminders.revoke, {
    installationId: "synthetic-phone-alice",
  });
  expect(
    await t.query(internal.reminders.submission, { attemptId: attemptId! }),
  ).toBeNull();
  await t.mutation(internal.account.deleteUserData, { userId: "alice" });
  expect(
    await t.query(internal.reminders.submission, { attemptId: attemptId! }),
  ).toBeNull();
});
test("a new browser registration does not silently replace the selected phone", async () => {
  const { alice } = await fixture();
  const before = await alice.query(api.reminders.settings, {});
  await alice.mutation(api.reminders.register, {
    installationId: "synthetic-phone-second",
    transport: "expo",
    endpoint: "ExpoPushToken[synthetic-second]",
    label: "Other phone",
    timezone: "America/New_York",
    select: false,
  });
  expect(
    (await alice.query(api.reminders.settings, {})).primaryInstallationId,
  ).toBe(before.primaryInstallationId);
  await expect(
    alice.mutation(api.reminders.register, {
      installationId: "synthetic-web-attacker",
      transport: "web",
      endpoint: "http://127.0.0.1/private",
      p256dh: "x",
      auth: "x",
      label: "Browser",
      timezone: "America/New_York",
      select: true,
    }),
  ).rejects.toThrow();
});
test("shadow evaluation records eligibility without consuming a send budget", async () => {
  const { t, daily } = await fixture();
  process.env.WARDROBE_NOTIFICATIONS_MODE = "shadow";
  expect(
    await t.mutation(internal.reminders.claim, {
      id: daily._id,
      scheduleRevision: daily.scheduleRevision,
    }),
  ).toBeNull();
  expect((await t.run((ctx) => ctx.db.get(daily._id)))?.state).toBe("shadow");
  expect(
    await t.run((ctx) => ctx.db.query("notificationAttempts").collect()),
  ).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.query("notificationBudgets").collect()),
  ).toEqual([]);
});

async function acceptedPlan(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  overrides: Record<string, unknown> = {},
) {
  return t.run((ctx) =>
    ctx.db.insert("outfitSuggestions", {
      userId: "alice",
      date: "2026-09-22",
      title: "Evening",
      rationale: "",
      context: [],
      itemIds: [],
      missing: [],
      status: "planned",
      calendarDerived: false,
      planRevision: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    }),
  );
}
test("simultaneous plans select a stable winner, preserve the shared cap, and defer during capture", async () => {
  const { t, alice } = await fixture();
  await acceptedPlan(t);
  await acceptedPlan(t);
  await t.mutation(internal.reminders.reconcile, { userId: "alice" });
  const jobs = (
    await t.run((ctx) => ctx.db.query("notificationIntents").collect())
  )
    .filter((j) => j.planId)
    .sort((a, b) => a.logicalKey.localeCompare(b.logicalKey));
  expect(jobs).toHaveLength(2);
  await alice.mutation(api.reminders.capture, { active: true });
  expect(
    await t.mutation(internal.reminders.claim, {
      id: jobs[0]!._id,
      scheduleRevision: jobs[0]!.scheduleRevision,
    }),
  ).toBeNull();
  expect((await t.run((ctx) => ctx.db.get(jobs[0]!._id)))?.state).toBe(
    "scheduled",
  );
  await alice.mutation(api.reminders.capture, { active: false });
  expect(
    await t.mutation(internal.reminders.claim, {
      id: jobs[1]!._id,
      scheduleRevision: jobs[1]!.scheduleRevision,
    }),
  ).toBeNull();
  const attempt = await t.mutation(internal.reminders.claim, {
    id: jobs[0]!._id,
    scheduleRevision: jobs[0]!.scheduleRevision,
  });
  expect(attempt).not.toBeNull();
  expect(
    await t.mutation(internal.reminders.claim, {
      id: jobs[1]!._id,
      scheduleRevision: jobs[1]!.scheduleRevision,
    }),
  ).toBeNull();
  expect(
    (await t.run((ctx) => ctx.db.query("notificationBudgets").collect()))[0]
      ?.count,
  ).toBe(1);
});
test("a morning photo does not resolve an evening plan; partial corresponding evidence does", async () => {
  const { t } = await fixture();
  const planId = await acceptedPlan(t, {
    reminderStartsAt: Date.now(),
    reminderTimeConfirmedAt: Date.now(),
    reminderScheduleRevision: 1,
  });
  await t.run((ctx) =>
    ctx.db.insert("wearOccurrences", {
      userId: "alice",
      localDate: "2026-09-22",
      revision: 1,
      itemIds: [],
      unresolvedCount: 1,
      active: true,
      coverage: "partial",
      outcome: "unconfirmed",
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  await t.mutation(internal.reminders.reconcile, { userId: "alice" });
  const job = await t.run((ctx) =>
    ctx.db
      .query("notificationIntents")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", "alice").eq("logicalKey", `plan:${planId}`),
      )
      .unique(),
  );
  const attemptId = await t.mutation(internal.reminders.claim, {
    id: job!._id,
    scheduleRevision: job!.scheduleRevision,
  });
  expect(attemptId).not.toBeNull();
  await t.run(async (ctx) => {
    const wear = await ctx.db.insert("wearOccurrences", {
      userId: "alice",
      planId,
      planRevision: 1,
      localDate: "2026-09-22",
      revision: 1,
      itemIds: [],
      unresolvedCount: 2,
      active: true,
      coverage: "partial",
      outcome: "unconfirmed",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.patch(planId, { wearOccurrenceId: wear });
  });
  expect(
    await t.query(internal.reminders.submission, { attemptId: attemptId! }),
  ).toBeNull();
});
test("calendar reschedules invalidate old jobs; stale or disconnected grants never authorize a send", async () => {
  const { t, alice } = await fixture();
  const calendar = await t.run((ctx) =>
    ctx.db.insert("planningSettings", {
      userId: "alice",
      calendarEnabled: true,
      calendarIds: ["selected"],
      calendarRevision: 1,
      lastGenerationAt: 0,
      updatedAt: 1,
    }),
  );
  const planId = await acceptedPlan(t);
  await alice.mutation(api.reminders.schedule, {
    planId,
    expectedRevision: 1,
    timezone: "America/New_York",
    startsAt: Date.now(),
    calendarId: "selected",
    eventId: "exact-event",
  });
  await t.mutation(internal.reminders.calendarResult, {
    planId,
    revision: 1,
    active: true,
    startsAt: Date.now(),
  });
  await t.mutation(internal.reminders.reconcile, { userId: "alice" });
  const old = await t.run((ctx) =>
    ctx.db
      .query("notificationIntents")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", "alice").eq("logicalKey", `plan:${planId}`),
      )
      .unique(),
  );
  await t.mutation(internal.reminders.calendarResult, {
    planId,
    revision: 2,
    active: true,
    startsAt: Date.now() + 3_600_000,
  });
  expect(
    await t.mutation(internal.reminders.claim, {
      id: old!._id,
      scheduleRevision: old!.scheduleRevision,
    }),
  ).toBeNull();
  await t.run((ctx) =>
    ctx.db.patch(calendar, {
      calendarEnabled: false,
      calendarIds: [],
      calendarRevision: 2,
    }),
  );
  expect(
    await t.query(internal.reminders.calendarSource, { planId }),
  ).toBeNull();
  await t.mutation(internal.reminders.clearCalendarLinks, {
    userId: "alice",
    paginationOpts: { numItems: 50, cursor: null },
  });
  const plan = await t.run((ctx) => ctx.db.get(planId));
  expect(plan?.reminderEventId).toBeUndefined();
  expect(plan?.reminderCalendarId).toBeUndefined();
  expect(plan?.status).toBe("planned");
  expect(plan?.planRevision).toBe(1);
});
test("provider handoff receipts do not authorize a second submission", async () => {
  const { t, daily } = await fixture();
  const attemptId = (await t.mutation(internal.reminders.claim, {
    id: daily._id,
    scheduleRevision: daily.scheduleRevision,
  }))!;
  await t.mutation(internal.reminders.finish, {
    attemptId,
    outcome: "provider_accepted",
    ticket: "synthetic-ticket",
  });
  expect(
    await t.mutation(internal.reminders.receiptAttempt, { attemptId }),
  ).toEqual({ ticket: "synthetic-ticket" });
  await t.mutation(internal.reminders.finish, {
    attemptId,
    outcome: "provider_handoff",
  });
  expect(
    await t.query(internal.reminders.submission, { attemptId }),
  ).toBeNull();
  expect(
    await t.mutation(internal.reminders.receiptAttempt, { attemptId }),
  ).toBeNull();
});

test("revoked devices need explicit re-selection and only the selected device updates timezone", async () => {
  const { alice } = await fixture();
  const primary = {
    installationId: "synthetic-phone-alice",
    transport: "expo" as const,
    endpoint: "ExpoPushToken[synthetic-alice]",
    label: "Phone",
    timezone: "America/Los_Angeles",
    select: false,
  };
  await alice.mutation(api.reminders.register, primary);
  expect(
    (await alice.query(api.reminders.settings, {})).preferences?.timezone,
  ).toBe("America/Los_Angeles");
  await alice.mutation(api.reminders.register, {
    ...primary,
    installationId: "synthetic-phone-other",
    endpoint: "ExpoPushToken[synthetic-other]",
    timezone: "Asia/Tokyo",
  });
  expect(
    (await alice.query(api.reminders.settings, {})).preferences?.timezone,
  ).toBe("America/Los_Angeles");
  await alice.mutation(api.reminders.revoke, {
    installationId: primary.installationId,
  });
  await expect(alice.mutation(api.reminders.register, primary)).rejects.toThrow(
    "Select this device again",
  );
  await alice.mutation(api.reminders.register, { ...primary, select: true });
  expect(
    (await alice.query(api.reminders.settings, {})).installations,
  ).toHaveLength(2);
});
