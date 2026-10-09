import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { readStyleBioContext } from "./legacy/profile";
const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));

async function fixture() {
  const t = convexTest(schema, modules);
  const rows = await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["synthetic disposable inspiration"]));
    await ctx.db.insert("storageObjects", { storageId, userId: "alice", provenance: "upload", createdAt: 1 });
    const collection = await ctx.db.insert("wardrobes", { userId: "alice", name: "Synthetic skate", kind: "locus", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("wardrobes", { userId: "alice", name: "Synthetic second", kind: "locus", status: "active", createdAt: 1, updatedAt: 1 });
    const candidate = await ctx.db.insert("candidateItems", { userId: "alice", storageId, kind: "inspiration", status: "active", description: "Synthetic reference", createdAt: 1, updatedAt: 1 });
    const member = await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: collection, candidateItemId: candidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    const otherMember = await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: other, candidateItemId: candidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    const item = await ctx.db.insert("wardrobeItems", { userId: "alice", storageId, analysisStatus: "ready", createdAt: 1, updatedAt: 1 });
    const owned = await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: collection, itemId: item, membershipKind: "owned", createdAt: 1, updatedAt: 1 });
    const foreignCandidate = await ctx.db.insert("candidateItems", { userId: "bob", kind: "inspiration", status: "active", createdAt: 1, updatedAt: 1 });
    const poisoned = await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: collection, candidateItemId: foreignCandidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    const fit = await ctx.db.insert("fitChecks", { userId: "alice", storageId, type: "daily_fit_check", createdAt: 1, updatedAt: 1 });
    return { storageId, collection, other, candidate, member, otherMember, item, owned, poisoned, fit };
  });
  return { t, ...rows, alice: t.withIdentity({ subject: "alice" }), bob: t.withIdentity({ subject: "bob" }) };
}
const paginationOpts = { numItems: 24, cursor: null };
test("remove persists, excludes collection context, preserves shared records and restores; retries are idempotent", async () => {
  const f = await fixture();
  const args = { wardrobeId: f.collection, membershipId: f.member, removed: true };
  expect((await f.alice.query(api.wardrobe.pageInspiration, { wardrobeId: f.collection, paginationOpts })).page.map(row => row.membershipId)).toEqual([f.member]);
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, args);
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, args);
  expect((await f.alice.query(api.wardrobe.pageInspiration, { wardrobeId: f.collection, paginationOpts })).page).toEqual([]);
  expect((await f.alice.query(api.wardrobe.pageInspiration, { wardrobeId: f.collection, removed: true, paginationOpts })).page.map(row => row.membershipId)).toEqual([f.member]);
  expect(await f.alice.query(api.candidates.listInspirationByWardrobe, { wardrobeId: f.collection })).toEqual([]);
  expect((await f.alice.query(api.mobile.collection, { wardrobeId: f.collection, paginationOpts }))?.inspirations).toEqual([]);
  expect((await f.alice.query(api.candidates.listInspirationByWardrobe, { wardrobeId: f.other })).map(row => row._id)).toEqual([f.candidate]);
  await f.t.run(async ctx => {
    expect((await ctx.db.get(f.member))?.removed).toBe(true);
    expect((await ctx.db.get(f.otherMember))?.removed).toBeUndefined();
    expect(await ctx.db.get(f.candidate)).not.toBeNull();
    expect(await ctx.db.get(f.item)).not.toBeNull();
    expect(await ctx.db.get(f.fit)).not.toBeNull();
    expect(await ctx.storage.getUrl(f.storageId)).not.toBeNull();
    expect((await readStyleBioContext(ctx, "alice")).collections.find(row => row.name === "Synthetic skate")?.memberCount).toBe(2);
    expect((await ctx.db.query("styleBioJobs").collect())[0]?.revision).toBe(1);
  });
  await expect(f.alice.mutation(api.candidates.enrichInspiration, { candidateItemId: f.candidate, category: "Synthetic", description: "Synthetic", styleTags: [], embedding: [] })).rejects.toThrow();
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, { ...args, removed: false });
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, { ...args, removed: false });
  expect((await f.alice.query(api.wardrobe.pageInspiration, { wardrobeId: f.collection, paginationOpts })).page).toHaveLength(1);
  expect((await f.alice.query(api.wardrobe.pageInspiration, { wardrobeId: f.collection, removed: true, paginationOpts })).page).toEqual([]);
  await f.t.run(async ctx => expect((await ctx.db.query("styleBioJobs").collect())[0]?.revision).toBe(2));
});
test("anonymous, cross-user, wrong collection, owned-piece and poisoned source requests are denied", async () => {
  const f = await fixture();
  const args = { wardrobeId: f.collection, membershipId: f.member, removed: true };
  await expect(f.t.mutation(api.wardrobe.setInspirationRemoved, args)).rejects.toThrow();
  for (const removed of [true, false]) await expect(f.bob.mutation(api.wardrobe.setInspirationRemoved, { ...args, removed })).rejects.toThrow();
  for (const override of [{ wardrobeId: f.other }, { membershipId: f.owned }, { membershipId: f.poisoned }]) await expect(f.alice.mutation(api.wardrobe.setInspirationRemoved, { ...args, ...override })).rejects.toThrow();
  expect((await f.bob.query(api.wardrobe.pageInspiration, { wardrobeId: f.collection, removed: true, paginationOpts })).page).toEqual([]);
  await f.t.run(async ctx => expect((await ctx.db.get(f.member))?.removed).toBeUndefined());
});
