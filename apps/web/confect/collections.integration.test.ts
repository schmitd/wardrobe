import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries(
  [...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map((path) => [
    `./${path}`,
    () => import(`${directory}${path}`),
  ]),
);
async function fixture() {
  const t = convexTest(schema, modules);
  const rows = await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["owned photo"]));
    await ctx.db.insert("storageObjects", {
      storageId,
      userId: "alice",
      provenance: "upload",
      createdAt: 1,
    });
    const item = await ctx.db.insert("wardrobeItems", {
      storageId,
      userId: "alice",
      analysisStatus: "ready",
      note: "Sleeves run long",
      category: "Overshirt",
      styleTags: ["Navy", "Cotton"],
      embedding: [1, 2, 3],
      createdAt: 1,
      updatedAt: 1,
    });
    const foreign = await ctx.db.insert("wardrobeItems", {
      storageId,
      userId: "bob",
      analysisStatus: "ready",
      note: "Private",
      createdAt: 1,
      updatedAt: 1,
    });
    const work = await ctx.db.insert("wardrobes", {
      userId: "alice",
      name: "Work edit",
      kind: "locus",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const other = await ctx.db.insert("wardrobes", {
      userId: "bob",
      name: "Secret collection",
      kind: "locus",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    for (const [userId, wardrobeId, itemId] of [
      ["alice", work, item],
      ["bob", work, foreign],
      ["alice", other, item],
    ] as const)
      await ctx.db.insert("wardrobeMemberships", {
        userId,
        wardrobeId,
        itemId,
        membershipKind: "owned",
        createdAt: 1,
        updatedAt: 1,
      });
    return { item, foreign, work, other, storageId };
  });
  return {
    t,
    ...rows,
    alice: t.withIdentity({ subject: "alice" }),
    bob: t.withIdentity({ subject: "bob" }),
  };
}
test("item notes require the owner, persist, enforce bounds, and never return foreign collection names", async () => {
  const { t, alice, bob, item } = await fixture();
  await expect(
    t.mutation(api.wardrobe.saveNote, { itemId: item, note: "x" }),
  ).rejects.toThrow();
  await expect(
    bob.mutation(api.wardrobe.saveNote, { itemId: item, note: "x" }),
  ).rejects.toThrow();
  expect(
    await bob.query(api.wardrobe.itemDetails, { itemId: item }),
  ).toBeNull();
  await expect(
    alice.mutation(api.wardrobe.saveNote, {
      itemId: item,
      note: "x".repeat(2001),
    }),
  ).rejects.toThrow();
  await alice.mutation(api.wardrobe.saveNote, {
    itemId: item,
    note: "  Roll sleeves  ",
  });
  const details = await alice.query(api.wardrobe.itemDetails, { itemId: item });
  expect(details?.note).toBe("Roll sleeves");
  expect(details?.collections.map((c) => c.name)).toEqual(["Work edit"]);
  await alice.mutation(api.wardrobe.saveNote, { itemId: item, note: "" });
  expect(
    (await alice.query(api.wardrobe.itemDetails, { itemId: item }))?.note,
  ).toBe("");
});
test("collection pages enforce every ownership boundary and project no embeddings", async () => {
  const { alice, bob, item, work } = await fixture();
  const args = {
    wardrobeId: work,
    paginationOpts: { numItems: 24, cursor: null },
  };
  expect((await bob.query(api.wardrobe.pagePieces, args)).page).toEqual([]);
  const result = await alice.query(api.wardrobe.pagePieces, args);
  expect(result.page.map((p) => p.id)).toEqual([item]);
  expect(result.page[0]?.note).toBe("Sleeves run long");
  expect(result.page[0]).not.toHaveProperty("embedding");
});
test("ensemble previews page safely, reject poisoned references, and follow membership changes", async () => {
  const { t, alice, item, foreign, work } = await fixture();
  const args = { paginationOpts: { numItems: 50, cursor: null } };
  await expect(t.query(api.wardrobe.pageCollections, args)).rejects.toThrow();
  await t.run(async (ctx) => {
    // An owned membership must not turn a foreign item or storage object into a preview.
    const foreignStorage = await ctx.storage.store(new Blob(["private photo"]));
    await ctx.db.insert("storageObjects", {
      storageId: foreignStorage,
      userId: "bob",
      provenance: "upload",
      createdAt: 1,
    });
    const poisoned = await ctx.db.insert("wardrobeItems", {
      userId: "alice",
      storageId: foreignStorage,
      analysisStatus: "ready",
      createdAt: 1,
      updatedAt: 1,
    });
    for (const itemId of [foreign, poisoned])
      await ctx.db.insert("wardrobeMemberships", {
        userId: "alice",
        wardrobeId: work,
        itemId,
        membershipKind: "owned",
        createdAt: 1,
        updatedAt: 1,
      });
    for (let i = 0; i < 26; i++)
      await ctx.db.insert("wardrobes", {
        userId: "alice",
        name: `Collection ${i}`,
        kind: "locus",
        status: "active",
        createdAt: i + 2,
        updatedAt: i + 2,
      });
  });
  const first = await alice.query(api.wardrobe.pageCollections, args);
  expect(first.page).toHaveLength(24);
  expect(first.isDone).toBe(false);
  const second = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: { numItems: 24, cursor: first.continueCursor },
  });
  expect(second.isDone).toBe(true);
  // Reactive clients pin each loaded range with endCursor and ask to split it
  // when inserts/edits grow that range. Both halves must cover it without gaps.
  const boundedRange = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: {
      numItems: 2,
      cursor: null,
      endCursor: first.continueCursor,
    },
  });
  expect(boundedRange.page.map((c) => c._id)).toEqual(
    first.page.map((c) => c._id),
  );
  const split = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: {
      numItems: 2,
      cursor: null,
      endCursor: second.continueCursor,
    },
  });
  expect(split.pageStatus).toBe("SplitRequired");
  expect(split.splitCursor).toBeTruthy();
  const left = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: {
      numItems: 2,
      cursor: null,
      endCursor: split.splitCursor!,
    },
  });
  const right = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: {
      numItems: 2,
      cursor: split.splitCursor!,
      endCursor: second.continueCursor,
    },
  });
  expect([...left.page, ...right.page].map((c) => c._id)).toEqual(
    [...first.page, ...second.page].map((c) => c._id),
  );
  const preview = second.page.find((c) => c._id === work)!;
  expect(preview.previews.map((p) => p.id)).toEqual([item]);
  expect(preview.previews[0]).not.toHaveProperty("embedding");
  expect(
    [...first.page, ...second.page].some((c) => c.name === "Secret collection"),
  ).toBe(false);
  await t.run(async (ctx) => {
    const membership = await ctx.db
      .query("wardrobeMemberships")
      .withIndex("by_wardrobe_item", (q) =>
        q.eq("wardrobeId", work).eq("itemId", item),
      )
      .unique();
    await ctx.db.delete(membership!._id);
  });
  const after = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: { numItems: 24, cursor: first.continueCursor },
  });
  expect(after.page.find((c) => c._id === work)?.previews).toEqual([]);
});
test("inspiration pages isolate owners and return only display fields", async () => {
  const { t, alice, bob, work, storageId } = await fixture();
  const reference = await t.run(async (ctx) => {
    let owned = "";
    for (const [userId, membershipUser] of [
      ["alice", "alice"],
      ["bob", "alice"],
      ["alice", "bob"],
    ]) {
      const candidateItemId = await ctx.db.insert("candidateItems", {
        userId,
        storageId,
        kind: "inspiration",
        status: "saved",
        description: "Reference",
        embedding: [3, 2, 1],
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("wardrobeMemberships", {
        userId: membershipUser,
        wardrobeId: work,
        candidateItemId,
        membershipKind: "inspiration",
        createdAt: 1,
        updatedAt: 1,
      });
      if (userId === "alice" && membershipUser === "alice")
        owned = candidateItemId;
    }
    return owned;
  });
  const args = {
    wardrobeId: work,
    paginationOpts: { numItems: 2, cursor: null },
  };
  await expect(t.query(api.wardrobe.pageInspiration, args)).rejects.toThrow();
  expect((await bob.query(api.wardrobe.pageInspiration, args)).page).toEqual(
    [],
  );
  const first = await alice.query(api.wardrobe.pageInspiration, args);
  expect(first.isDone).toBe(false);
  expect(first.page).toEqual([]);
  const next = await alice.query(api.wardrobe.pageInspiration, {
    ...args,
    paginationOpts: { numItems: 2, cursor: first.continueCursor },
  });
  expect(next.page.map((r) => String(r._id))).toEqual([reference]);
  expect(next.page[0]?.imageUrl).toBeTruthy();
  expect(Object.keys(next.page[0]!).sort()).toEqual([
    "_id",
    "category",
    "description",
    "imageUrl",
  ]);
  const collections = await alice.query(api.wardrobe.pageCollections, {
    paginationOpts: { numItems: 12, cursor: null },
  });
  expect(
    collections.page.find((c) => c._id === work)?.previews.map((p) => p.id),
  ).toContain(reference);
});
test("automatic calendar recall includes older collection pieces beyond the recent inventory window", async () => {
  const { t, alice, item, work, storageId } = await fixture();
  await t.run(async (ctx) => {
    for (let i = 0; i < 301; i++)
      await ctx.db.insert("wardrobeItems", {
        storageId,
        userId: "alice",
        analysisStatus: "ready",
        createdAt: i + 2,
        updatedAt: i + 2,
      });
  });
  const data = await alice.query(api.planning.load, {
    context: "Client meeting",
  });
  expect(data.inventoryTruncated).toBe(true);
  expect(data.items.find((i) => i.id === item)?.note).toBe("Sleeves run long");
  expect(data.plans.find((p) => p.id === work)?.itemIds).toEqual([item]);
  expect(data.items.some((i) => i.note === "Private")).toBe(false);
});
