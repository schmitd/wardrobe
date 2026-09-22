import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));
const previousFlag = process.env.GARMENT_PREVIEWS_ENABLED;
beforeEach(() => { jest.useFakeTimers(); process.env.GARMENT_PREVIEWS_ENABLED = "true"; });
afterEach(() => { jest.useRealTimers(); if (previousFlag === undefined) delete process.env.GARMENT_PREVIEWS_ENABLED; else process.env.GARMENT_PREVIEWS_ENABLED = previousFlag; });
async function fixture() {
  const t = convexTest(schema, modules);
  const itemId = await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["original"]));
    await ctx.db.insert("storageObjects", { storageId, userId: "alice", provenance: "upload", createdAt: 1 });
    return ctx.db.insert("wardrobeItems", { userId: "alice", storageId, analysisStatus: "ready", createdAt: 1, updatedAt: 1, embedding: [0.5] });
  });
  return { t, itemId, alice: t.withIdentity({ subject: "alice" }), bob: t.withIdentity({ subject: "bob" }) };
}

test("preview request authenticates ownership, respects flag, and coalesces duplicate requests", async () => {
  const { t, itemId, alice, bob } = await fixture();
  await expect(t.mutation(api.garmentPreviewData.request, { itemId })).rejects.toThrow();
  await expect(bob.mutation(api.garmentPreviewData.request, { itemId })).rejects.toThrow();
  expect(await bob.query(api.garmentPreviewData.status, { itemId })).toBeNull();
  process.env.GARMENT_PREVIEWS_ENABLED = "false";
  expect(await alice.mutation(api.garmentPreviewData.request, { itemId })).toBe(false);
  process.env.GARMENT_PREVIEWS_ENABLED = "true";
  expect(await alice.mutation(api.garmentPreviewData.request, { itemId })).toBe(true);
  expect(await alice.mutation(api.garmentPreviewData.request, { itemId })).toBe(false);
  expect(await t.mutation(internal.garmentPreviewData.claim, { itemId, revision: 1 })).not.toBeNull();
  expect(await t.mutation(internal.garmentPreviewData.claim, { itemId, revision: 1 })).toBeNull();
});

test("generated preview changes display only; restoring revokes the derivative and preserves identity evidence", async () => {
  const { t, itemId, alice } = await fixture();
  await alice.mutation(api.garmentPreviewData.request, { itemId });
  const source = (await t.mutation(internal.garmentPreviewData.claim, { itemId, revision: 1 }))!;
  const preview = await t.run(ctx => ctx.storage.store(new Blob(["preview"])));
  expect(await t.mutation(internal.garmentPreviewData.commit, { itemId, revision: 1, userId: "alice", sourceStorageId: source.storageId, storageId: preview })).toBe(true);
  await t.mutation(internal.garmentPreviewData.discard, { storageId: preview });
  expect(await t.run(async ctx => (await ctx.storage.get(preview)) !== null)).toBe(true);
  const display = await alice.query(api.wardrobe.listWardrobeItems, {});
  const original = await alice.query(api.wardrobe.getWardrobeItemWithUrl, { itemId });
  expect(display[0]?.imageUrl).not.toBe(original.imageUrl);
  expect(original.storageId).toBe(source.storageId);
  expect(original.embedding).toEqual([0.5]);
  await alice.mutation(api.garmentPreviewData.restore, { itemId });
  expect((await alice.query(api.wardrobe.listWardrobeItems, {}))[0]?.imageUrl).toBe(original.imageUrl);
  expect(await t.run(async ctx => (await ctx.storage.get(preview)) !== null)).toBe(false);
  expect(await t.run(async ctx => (await ctx.storage.get(source.storageId)) !== null)).not.toBeNull();
});

test("restore invalidates an in-flight result and stale failure cannot overwrite a new request", async () => {
  const { t, itemId, alice } = await fixture();
  await alice.mutation(api.garmentPreviewData.request, { itemId });
  const source = (await t.mutation(internal.garmentPreviewData.claim, { itemId, revision: 1 }))!;
  await alice.mutation(api.garmentPreviewData.restore, { itemId });
  const preview = await t.run(ctx => ctx.storage.store(new Blob(["late preview"])));
  expect(await t.mutation(internal.garmentPreviewData.commit, { itemId, revision: 1, userId: "alice", sourceStorageId: source.storageId, storageId: preview })).toBe(false);
  await t.mutation(internal.garmentPreviewData.discard, { storageId: preview });
  expect(await t.run(async ctx => (await ctx.storage.get(preview)) !== null)).toBe(false);
  await alice.mutation(api.garmentPreviewData.request, { itemId });
  await t.mutation(internal.garmentPreviewData.finish, { itemId, revision: 1, skipped: false });
  expect((await alice.query(api.garmentPreviewData.status, { itemId }))?.status).toBe("queued");
  await t.mutation(internal.garmentPreviewData.expire, { itemId, revision: 3 });
  expect((await alice.query(api.garmentPreviewData.status, { itemId }))?.status).toBe("error");
});

test("account or item deletion rejects late results; unowned source references cannot queue", async () => {
  const { t, itemId, alice } = await fixture();
  await alice.mutation(api.garmentPreviewData.request, { itemId });
  const source = (await t.mutation(internal.garmentPreviewData.claim, { itemId, revision: 1 }))!;
  const preview = await t.run(ctx => ctx.storage.store(new Blob(["preview"])));
  await t.run(ctx => ctx.db.insert("deletedAccounts", { userId: "alice", deletedAt: 1 }));
  const commitArgs = { itemId, revision: 1, userId: "alice", sourceStorageId: source.storageId, storageId: preview };
  expect(await t.mutation(internal.garmentPreviewData.commit, commitArgs)).toBe(false);
  await t.run(ctx => ctx.db.delete(itemId));
  expect(await t.mutation(internal.garmentPreviewData.commit, commitArgs)).toBe(false);
  const other = await fixture();
  await other.t.run(async ctx => { const blob = await ctx.storage.store(new Blob(["foreign"])); await ctx.db.insert("storageObjects", { storageId: blob, userId: "bob", provenance: "upload", createdAt: 1 }); await ctx.db.patch(other.itemId, { storageId: blob }); });
  expect(await other.alice.mutation(api.garmentPreviewData.request, { itemId: other.itemId })).toBe(false);
});

test("a poisoned preview reference cannot expose or delete another owner's photo", async () => {
  const { t, itemId, alice } = await fixture();
  const foreign = await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["private"]));
    await ctx.db.insert("storageObjects", { storageId, userId: "bob", provenance: "generated_preview", createdAt: 1 });
    await ctx.db.patch(itemId, { previewStorageId: storageId, previewStatus: "ready" });
    return storageId;
  });
  const original = await alice.query(api.wardrobe.getWardrobeItemWithUrl, { itemId });
  expect((await alice.query(api.wardrobe.listWardrobeItems, {}))[0]?.imageUrl).toBe(original.imageUrl);
  await alice.mutation(api.garmentPreviewData.restore, { itemId });
  expect(await t.run(async ctx => (await ctx.storage.get(foreign)) !== null)).not.toBeNull();
});
