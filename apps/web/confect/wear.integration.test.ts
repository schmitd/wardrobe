import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { recordPhotoWear } from "./wearDomain";
import { deriveWear, isCurrentWearFact } from "@wardrobe/shared";

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
  const bob = t.withIdentity({ subject: "bob" });
  const data = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["photo"]));
    await ctx.db.insert("storageObjects", {
      storageId,
      userId: "alice",
      provenance: "upload",
      createdAt: 1,
    });
    await ctx.db.insert("uploads", {
      userId: "alice",
      storageId,
      purpose: "daily_fit_check",
      createdAt: 1,
    });
    const shirt = await ctx.db.insert("wardrobeItems", {
      userId: "alice",
      storageId,
      category: "Shirt",
      analysisStatus: "ready",
      createdAt: 1,
      updatedAt: 1,
    });
    const shoes = await ctx.db.insert("wardrobeItems", {
      userId: "alice",
      storageId,
      category: "Shoes",
      analysisStatus: "ready",
      createdAt: 1,
      updatedAt: 1,
    });
    const foreign = await ctx.db.insert("wardrobeItems", {
      userId: "bob",
      storageId,
      analysisStatus: "ready",
      createdAt: 1,
      updatedAt: 1,
    });
    const plan = await ctx.db.insert("outfitSuggestions", {
      userId: "alice",
      date: "2026-09-01",
      title: "Dinner",
      rationale: "A saved suggestion",
      context: [],
      itemIds: [shirt, shoes],
      missing: [],
      status: "suggested",
      calendarDerived: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const fit = await ctx.db.insert("fitChecks", {
      userId: "alice",
      storageId,
      type: "daily_fit_check",
      localDate: "2026-09-01",
      timezone: "America/New_York",
      createdAt: 1,
      updatedAt: 1,
    });
    const observedShirt = await ctx.db.insert("fitCheckItems", {
      userId: "alice",
      fitCheckId: fit,
      wardrobeItemId: shirt,
      source: "matched_existing",
      createdAt: 1,
    });
    const observedShoes = await ctx.db.insert("fitCheckItems", {
      userId: "alice",
      fitCheckId: fit,
      source: "observed_unresolved",
      createdAt: 1,
    });
    return {
      storageId,
      shirt,
      shoes,
      foreign,
      plan,
      fit,
      observedShirt,
      observedShoes,
    };
  });
  return { t, alice, bob, ...data };
}

test("untouched Calendar suggestions create neither plan revisions nor graph projection", async () => {
  const { t, alice, plan } = await fixture();
  await alice.query(api.planning.load, {});
  expect(await t.run((ctx) => ctx.db.query("planRevisions").collect())).toEqual(
    [],
  );
  expect(
    await t.run((ctx) => ctx.db.query("wearProjectionOutbox").collect()),
  ).toEqual([]);
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  expect(
    await t.run((ctx) => ctx.db.query("planRevisions").collect()),
  ).toHaveLength(1);
  expect(
    await t.run((ctx) => ctx.db.query("wearOccurrences").collect()),
  ).toEqual([]);
});

test("manual confirmation preserves intent, is idempotent, and rejects stale or foreign input", async () => {
  const { t, alice, bob, plan, shirt, shoes, foreign } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await expect(
    bob.mutation(api.planning.update, {
      id: plan,
      status: "worn",
      expectedRevision: 1,
      timezone: "America/New_York",
    }),
  ).rejects.toThrow();
  await expect(
    alice.mutation(api.planning.update, {
      id: plan,
      status: "worn",
      timezone: "America/New_York",
      expectedRevision: 0,
    }),
  ).rejects.toThrow();
  await expect(
    alice.mutation(api.planning.update, {
      id: plan,
      status: "worn",
      expectedRevision: 1,
      timezone: "America/New_York",
      itemIds: [foreign],
    }),
  ).rejects.toThrow();
  const args = {
    id: plan,
    status: "worn" as const,
    timezone: "America/New_York",
    expectedRevision: 1,
    itemIds: [shirt],
  };
  await alice.mutation(api.planning.update, args);
  await alice.mutation(api.planning.update, args);
  expect((await t.run((ctx) => ctx.db.get(plan)))?.itemIds).toEqual([
    shirt,
    shoes,
  ]);
  const [wear] = await alice.query(api.wear.list, {});
  expect(wear).toMatchObject({
    itemIds: [shirt],
    localDate: "2026-09-01",
    outcome: "worn_differently",
    revision: 1,
  });
  expect(
    await t.run((ctx) => ctx.db.query("wearEvidence").collect()),
  ).toHaveLength(1);
});

test("late garment resolution propagates original-date wear without confirming unseen planned pieces", async () => {
  const { t, alice, plan, fit, shirt, shoes, observedShoes } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  const [partial] = await alice.query(api.wear.list, {});
  expect(partial).toMatchObject({
    itemIds: [shirt],
    unresolvedCount: 1,
    localDate: "2026-09-01",
  });
  await alice.mutation(api.wear.update, {
    id: partial!.id,
    expectedRevision: partial!.revision,
    action: "attach_plan",
    planId: plan,
    expectedPlanRevision: 1,
  });
  expect((await t.run((ctx) => ctx.db.get(plan)))?.status).toBe("planned");
  await t.run(async (ctx) => {
    await ctx.db.patch(observedShoes, {
      wardrobeItemId: shoes,
      source: "matched_existing",
    });
    await recordPhotoWear(ctx, fit);
  });
  const [resolved] = await alice.query(api.wear.list, {});
  expect(resolved).toMatchObject({
    localDate: "2026-09-01",
    unresolvedCount: 0,
    outcome: "confirmed_as_planned",
  });
  expect(new Set(resolved?.itemIds)).toEqual(new Set([shirt, shoes]));
  expect((await t.run((ctx) => ctx.db.get(plan)))?.status).toBe("worn");
  const revisionCount = await t.run((ctx) =>
    ctx.db.query("wearRevisions").collect(),
  );
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  expect(
    await t.run((ctx) => ctx.db.query("wearRevisions").collect()),
  ).toHaveLength(revisionCount.length);
});

test("a later photo joins manual wear only explicitly, and undo keeps independent photo support", async () => {
  const { t, alice, plan, fit, shirt } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await alice.mutation(api.planning.update, {
    id: plan,
    status: "worn",
    expectedRevision: 1,
    timezone: "America/New_York",
  });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  const before = await alice.query(api.wear.list, {});
  expect(before).toHaveLength(2);
  const photo = before.find((row) => !row.planId)!;
  await alice.mutation(api.wear.update, {
    id: photo.id,
    expectedRevision: photo.revision,
    action: "attach_plan",
    planId: plan,
    expectedPlanRevision: 1,
  });
  const [merged] = await alice.query(api.wear.list, {});
  expect(await alice.query(api.wear.list, {})).toHaveLength(1);
  await alice.mutation(api.wear.update, {
    id: merged!.id,
    expectedRevision: merged!.revision,
    action: "undo_manual",
  });
  const [after] = await alice.query(api.wear.list, {});
  expect(after).toMatchObject({
    itemIds: [shirt],
    canUndoManual: false,
    outcome: "unconfirmed",
  });
  expect(after?.photos).toHaveLength(1);
  expect((await t.run((ctx) => ctx.db.get(plan)))?.status).toBe("planned");
});

test("try-ons never create actual wear; foreign revisions and future dates fail closed", async () => {
  const { t, alice, bob, fit } = await fixture();
  await t.run(async (ctx) => {
    await ctx.db.patch(fit, { type: "try_on" });
    await recordPhotoWear(ctx, fit);
  });
  expect(await alice.query(api.wear.list, {})).toEqual([]);
  await t.run(async (ctx) => {
    await ctx.db.patch(fit, { type: "daily_fit_check" });
    await recordPhotoWear(ctx, fit);
  });
  const [row] = await alice.query(api.wear.list, {});
  const args = {
    id: row!.id,
    expectedRevision: row!.revision,
    action: "set_date" as const,
    localDate: "2026-09-02",
    timezone: "America/New_York",
  };
  await expect(bob.mutation(api.wear.update, args)).rejects.toThrow();
  await expect(
    alice.mutation(api.wear.update, { ...args, expectedRevision: 0 }),
  ).rejects.toThrow();
  await expect(
    alice.mutation(api.wear.update, { ...args, localDate: "2099-01-01" }),
  ).rejects.toThrow();
  await alice.mutation(api.wear.update, args);
  expect((await alice.query(api.wear.list, {}))[0]?.localDate).toBe(
    "2026-09-02",
  );
  await t.mutation(internal.account.deleteUserData, { userId: "alice" });
  expect(await alice.query(api.wear.list, {})).toEqual([]);
});

test("superseded graph revisions and partial matches cannot promote intent into actual wear", () => {
  const current = {
    id: "wear1",
    revision: 2,
    active: true,
    itemIds: ["boots"],
  };
  expect(
    isCurrentWearFact(
      {
        ontologyVersion: 2,
        occurrenceId: "wear1",
        revision: 1,
        itemId: "sneakers",
      },
      current,
    ),
  ).toBe(false);
  expect(
    isCurrentWearFact(
      {
        ontologyVersion: 2,
        occurrenceId: "wear1",
        revision: 2,
        itemId: "boots",
      },
      current,
    ),
  ).toBe(true);
  expect(
    deriveWear(
      [{ kind: "photo", itemIds: ["shirt"], unresolvedCount: 0 }],
      ["shirt", "boots"],
    ).outcome,
  ).toBe("unconfirmed");
});

test("photo association requires one accepted context and preserves unknown pieces", async () => {
  const { t, alice, plan, fit } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  expect((await alice.query(api.wear.list, {}))[0]).toMatchObject({
    planId: plan,
    outcome: "unconfirmed",
    unresolvedCount: 1,
  });
  expect((await t.run((ctx) => ctx.db.get(plan)))?.status).toBe("planned");
});

test("editing intent after partial evidence leaves the original revision intact", async () => {
  const { t, alice, plan, fit, shirt } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  const [oldWear] = await alice.query(api.wear.list, {});
  await alice.mutation(api.planning.update, {
    id: plan,
    itemIds: [shirt],
    expectedRevision: 1,
  });
  expect(
    (await t.run((ctx) => ctx.db.get(plan)))?.wearOccurrenceId,
  ).toBeUndefined();
  expect((await t.run((ctx) => ctx.db.get(oldWear!.id)))?.planRevision).toBe(1);
  await alice.mutation(api.planning.update, {
    id: plan,
    status: "worn",
    expectedRevision: 2,
    timezone: "America/New_York",
  });
  expect(await alice.query(api.wear.list, {})).toHaveLength(2);
});

test("late resolution after manual-photo merge updates the canonical wear, and retraction cannot revive", async () => {
  const { t, alice, plan, fit, shoes, observedShoes } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await alice.mutation(api.planning.update, {
    id: plan,
    status: "worn",
    expectedRevision: 1,
    timezone: "America/New_York",
  });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  const photo = (await alice.query(api.wear.list, {})).find(
    (wear) => !wear.planId,
  )!;
  await alice.mutation(api.wear.update, {
    id: photo.id,
    expectedRevision: photo.revision,
    action: "attach_plan",
    planId: plan,
    expectedPlanRevision: 1,
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(observedShoes, {
      wardrobeItemId: shoes,
      source: "matched_existing",
    });
    await recordPhotoWear(ctx, fit);
  });
  const [merged] = await alice.query(api.wear.list, {});
  expect(merged?.unresolvedCount).toBe(0);
  expect(merged?.localDate).toBe("2026-09-01");
  await alice.mutation(api.wear.update, {
    id: merged!.id,
    expectedRevision: merged!.revision,
    action: "retract_photo",
    fitId: fit,
  });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  const [after] = await alice.query(api.wear.list, {});
  expect(after?.photos).toHaveLength(1);
  expect(after?.photos[0]?.countsAsWear).toBe(false);
  expect(after?.canUndoManual).toBe(true);
  expect(after?.itemIds).toHaveLength(2);
});

test("explicit not-worn is reversible, creates no wear or graph event, and cannot hide photo evidence", async () => {
  const { t, alice, plan, fit } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  const count = (
    await t.run((ctx) => ctx.db.query("wearProjectionOutbox").collect())
  ).length;
  await alice.mutation(api.planning.update, {
    id: plan,
    notWorn: true,
    expectedRevision: 1,
    timezone: "America/New_York",
  });
  expect((await t.run((ctx) => ctx.db.get(plan)))?.notWornAt).toBeNumber();
  expect(await alice.query(api.wear.list, {})).toEqual([]);
  expect(
    await t.run((ctx) => ctx.db.query("wearProjectionOutbox").collect()),
  ).toHaveLength(count);
  await alice.mutation(api.planning.update, {
    id: plan,
    notWorn: false,
    expectedRevision: 1,
    timezone: "America/New_York",
  });
  await t.run((ctx) => recordPhotoWear(ctx, fit));
  await expect(
    alice.mutation(api.planning.update, {
      id: plan,
      notWorn: true,
      expectedRevision: 1,
      timezone: "America/New_York",
    }),
  ).rejects.toThrow();
});

test("graph candidates are rebuilt from current owned records after correction and account deletion", async () => {
  const { t, alice, plan, shirt, shoes } = await fixture();
  await alice.mutation(api.planning.update, { id: plan, status: "planned" });
  await alice.mutation(api.planning.update, {
    id: plan,
    status: "worn",
    expectedRevision: 1,
    timezone: "America/New_York",
  });
  const [wear] = await alice.query(api.wear.list, {});
  const candidates = [
    {
      ontologyVersion: 2,
      occurrenceId: wear!.id,
      revision: wear!.revision,
      itemId: shoes,
    },
  ];
  expect(
    await t.query(internal.wearProjectionData.currentFacts, {
      userId: "alice",
      candidates,
    }),
  ).toHaveLength(1);
  await alice.mutation(api.wear.update, {
    id: wear!.id,
    expectedRevision: wear!.revision,
    action: "correct",
    itemIds: [shirt],
  });
  expect(
    await t.query(internal.wearProjectionData.currentFacts, {
      userId: "alice",
      candidates,
    }),
  ).toEqual([]);
  expect(
    await t.query(internal.wearProjectionData.currentFacts, {
      userId: "bob",
      candidates,
    }),
  ).toEqual([]);
});

test("unconfirmed plans remain reachable through bounded pages beyond recent history", async () => {
  const { t, alice, shirt } = await fixture();
  await t.run(async (ctx) => {
    for (let n = 0; n < 25; n++)
      await ctx.db.insert("outfitSuggestions", {
        userId: "alice",
        date: "2020-01-01",
        title: `Old plan ${n}`,
        rationale: "Saved intent",
        context: [],
        itemIds: [shirt],
        missing: [],
        status: "planned",
        calendarDerived: false,
        createdAt: 1,
        updatedAt: 1,
      });
  });
  const first = await alice.query(api.wear.pendingPlans, {
    through: "2026-09-22",
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(first.page).toHaveLength(20);
  expect(first.isDone).toBe(false);
  const second = await alice.query(api.wear.pendingPlans, {
    through: "2026-09-22",
    paginationOpts: { numItems: 20, cursor: first.continueCursor },
  });
  expect(second.page).toHaveLength(5);
  expect(second.page[0]?.pieces[0]?.id).toBe(shirt);
  expect(
    new Set([...first.page, ...second.page].map((plan) => plan.id)).size,
  ).toBe(25);
});
