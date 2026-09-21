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
