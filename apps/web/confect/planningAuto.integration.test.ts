import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { dateInZone, nextPlanningRun } from "../src/lib/planning-time";
import { sevenDays, shiftDay } from "@wardrobe/shared";
const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries(
  [...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map((path) => [
    `./${path}`,
    () => import(`${directory}${path}`),
  ]),
);
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
async function fixture() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice" });
  const item = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["shirt"]));
    return ctx.db.insert("wardrobeItems", {
      userId: "alice",
      storageId,
      category: "Shirt",
      analysisStatus: "ready",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  await alice.mutation(api.planningAutoData.configure, {
    timezone: "America/New_York",
  });
  const settings = () =>
    t.run((ctx) =>
      ctx.db
        .query("planningSettings")
        .withIndex("by_user", (q) => q.eq("userId", "alice"))
        .unique(),
    );
  const revision = (await settings())!.autoPlanRevision!;
  const args = { userId: "alice", revision };
  const dates = sevenDays(dateInZone("America/New_York"));
  const outfit = (date: string) => ({
    date,
    title: "Everyday",
    rationale: "Owned shirt",
    itemIds: [item],
    context: ["Owned wardrobe"],
    missing: ["Bottom"],
  });
  const commit = (outfits = dates.map(outfit)) =>
    t.mutation(internal.planningAutoData.commit, {
      ...args,
      outfits,
      calendarDerived: false,
      calendarRevision: 0,
    });
  return { t, alice, item, settings, args, dates, outfit, commit };
}

test("automatic planning coalesces visits and fills only absent dates, preserving manual races and dismissed days", async () => {
  const f = await fixture();
  await f.alice.mutation(api.planningAutoData.configure, {
    timezone: "America/New_York",
  });
  expect((await f.settings())!.autoPlanRevision).toBe(f.args.revision);
  expect(
    await f.t.mutation(internal.planningAutoData.claim, f.args),
  ).not.toBeNull();
  expect(
    await f.t.mutation(internal.planningAutoData.claim, f.args),
  ).toBeNull();
  for (const [index, status] of (
    ["planned", "worn", "dismissed", "suggested"] as const
  ).entries()) {
    await f.t.run((ctx) =>
      ctx.db.insert("outfitSuggestions", {
        ...f.outfit(f.dates[index]!),
        userId: "alice",
        title: `Keep ${status}`,
        status,
        calendarDerived: false,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
  }
  expect(await f.commit()).toBe(true);
  const saved = await f.t.run((ctx) =>
    ctx.db.query("outfitSuggestions").collect(),
  );
  expect(saved).toHaveLength(7);
  expect(saved.filter((row) => row.title.startsWith("Keep "))).toHaveLength(4);
  await f.t.mutation(internal.planningAutoData.finish, f.args);
  const next = (await f.settings())!;
  expect(next.autoPlanState).toBe("scheduled");
  expect(next.autoPlanNextAt).toBeGreaterThan(Date.now());
  await f.t.mutation(internal.planningAutoData.expire, f.args);
  expect((await f.settings())!.autoPlanRevision).toBe(next.autoPlanRevision);
});

test("pause and account deletion revoke in-flight automatic commits; an ordinary visit preserves pause", async () => {
  for (const action of ["pause", "delete"] as const) {
    const f = await fixture();
    await f.t.mutation(internal.planningAutoData.claim, f.args);
    if (action === "pause") {
      await f.alice.mutation(api.planningAutoData.configure, {
        timezone: "America/New_York",
        enabled: false,
      });
      await f.alice.mutation(api.planningAutoData.configure, {
        timezone: "America/New_York",
      });
      expect((await f.settings())!.autoPlanState).toBe("paused");
    } else
      await f.t.run((ctx) =>
        ctx.db.insert("deletedAccounts", {
          userId: "alice",
          deletedAt: Date.now(),
        }),
      );
    expect(await f.commit()).toBe(false);
    expect(
      await f.t.query(internal.planningAutoData.load, {
        ...f.args,
        week: f.dates[0]!,
      }),
    ).toBeNull();
    await f.t.mutation(internal.planningAutoData.finish, f.args);
    expect(
      await f.t.run((ctx) => ctx.db.query("outfitSuggestions").collect()),
    ).toEqual([]);
  }
});

test("automatic planning rejects stale calendar, changed timezone, foreign items and missing identity", async () => {
  const f = await fixture();
  await expect(
    f.t.mutation(api.planningAutoData.configure, { timezone: "UTC" }),
  ).rejects.toThrow();
  await expect(
    f.alice.mutation(api.planningAutoData.configure, { timezone: "bad-zone" }),
  ).rejects.toThrow();
  await f.t.mutation(internal.planningAutoData.claim, f.args);
  await f.t.run((ctx) => ctx.db.patch(f.item, { userId: "bob" }));
  await expect(f.commit()).rejects.toThrow();
  await f.t.run((ctx) => ctx.db.patch(f.item, { userId: "alice" }));
  await f.alice.mutation(api.planning.calendar, {
    enabled: true,
    calendarIds: ["primary"],
  });
  expect(await f.commit()).toBe(false);
  const changed = (await f.settings())!;
  expect(changed.autoPlanRevision).toBeGreaterThan(f.args.revision);
  await f.alice.mutation(api.planningAutoData.configure, {
    timezone: "Asia/Tokyo",
  });
  expect((await f.settings())!.autoPlanTimezone).toBe("Asia/Tokyo");
  expect(
    await f.t.mutation(internal.planningAutoData.claim, {
      userId: "alice",
      revision: changed.autoPlanRevision!,
    }),
  ).toBeNull();
});

test("transient generation gets one bounded retry; Calendar failure waits for recovery or the next day", async () => {
  const f = await fixture();
  await f.t.mutation(internal.planningAutoData.claim, f.args);
  await f.t.mutation(internal.planningAutoData.finish, {
    ...f.args,
    error: "generation",
  });
  const retry = (await f.settings())!;
  expect(retry.autoPlanAttempt).toBe(1);
  expect(retry.autoPlanNextAt! - Date.now()).toBeLessThanOrEqual(60000);
  await f.t.run((ctx) =>
    ctx.db.patch(retry._id, { autoPlanNextAt: Date.now() }),
  );
  const args = { userId: "alice", revision: retry.autoPlanRevision! };
  await f.t.mutation(internal.planningAutoData.claim, args);
  await f.t.mutation(internal.planningAutoData.finish, {
    ...args,
    error: "generation",
  });
  const next = (await f.settings())!;
  expect(next.autoPlanAttempt).toBe(0);
  expect(next.autoPlanNextAt).toBe(nextPlanningRun("America/New_York"));
  expect(next.autoPlanError).toBe("generation");
  await f.t.run((ctx) =>
    ctx.db.patch(next._id, { autoPlanNextAt: Date.now() }),
  );
  const calendarArgs = { userId: "alice", revision: next.autoPlanRevision! };
  await f.t.mutation(internal.planningAutoData.claim, calendarArgs);
  await f.t.mutation(internal.planningAutoData.finish, {
    ...calendarArgs,
    error: "calendar",
  });
  expect((await f.settings())!.autoPlanNextAt).toBe(
    nextPlanningRun("America/New_York"),
  );
  expect((await f.settings())!.autoPlanError).toBe("calendar");
});

test("daily scheduling follows local midnight across DST", () => {
  expect(
    new Date(
      nextPlanningRun("America/New_York", new Date("2026-03-08T06:00:00Z")),
    ).toISOString(),
  ).toBe("2026-03-09T04:01:00.000Z");
  expect(
    new Date(
      nextPlanningRun("America/New_York", new Date("2026-11-01T05:00:00Z")),
    ).toISOString(),
  ).toBe("2026-11-02T05:01:00.000Z");
});

test("a job crossing local midnight retries promptly and its old finish cannot defer the retry", async () => {
  const f = await fixture();
  await f.t.mutation(internal.planningAutoData.claim, f.args);
  expect(
    await f.commit(sevenDays(shiftDay(f.dates[0]!, -1)).map(f.outfit)),
  ).toBe(false);
  const retry = (await f.settings())!;
  expect(retry.autoPlanRevision).toBeGreaterThan(f.args.revision);
  expect(retry.autoPlanAttempt).toBe(1);
  expect(retry.autoPlanNextAt! - Date.now()).toBeLessThanOrEqual(60000);
  await f.t.mutation(internal.planningAutoData.finish, f.args);
  expect((await f.settings())!.autoPlanRevision).toBe(retry.autoPlanRevision);
  expect(
    await f.t.run((ctx) => ctx.db.query("outfitSuggestions").collect()),
  ).toEqual([]);
});
