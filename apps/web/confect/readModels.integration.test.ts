import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("mobile bootstrap and cursor pages are bounded, account-scoped, and omit model vectors", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice" });
  await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["photo"]));
    await ctx.db.insert("storageObjects", { storageId, userId: "alice", provenance: "upload", createdAt: 1 });
    for (let i = 0; i < 70; i++) await ctx.db.insert("wardrobeItems", { userId: "alice", storageId, analysisStatus: "ready", createdAt: i, updatedAt: i, embedding: [0.1, 0.2] });
    for (let i = 0; i < 31; i++) await ctx.db.insert("wardrobes", { userId: "alice", name: `Plan ${i}`, kind: "locus", status: "active", createdAt: i, updatedAt: i });
    for (let i = 0; i < 25; i++) {
      const fitCheckId = await ctx.db.insert("fitChecks", { userId: "alice", storageId, type: "daily_fit_check", createdAt: i, updatedAt: i });
      const fitCheckItemId = await ctx.db.insert("fitCheckItems", { userId: "alice", fitCheckId, source: "observed_unresolved", createdAt: i });
      await ctx.db.insert("garmentObservations", { userId: "alice", fitCheckId, fitCheckItemId, cropStorageId: storageId, category: "Shirt", categoryKey: "top", description: "A shirt", styleTags: [], boundingBox: { x: 0, y: 0, width: 1, height: 1 }, visualEmbedding: Array(768).fill(0.1), semanticEmbedding: Array(768).fill(0.2), embeddingModel: "test", detectorModel: "test", resolutionStatus: "unresolved", candidateItemIds: [], candidateScores: [], createdAt: i, updatedAt: i });
    }
  });
  const first = await alice.query(api.mobile.bootstrap, {});
  expect(first.items).toHaveLength(48);
  expect(first.wardrobes).toHaveLength(30);
  expect(first.fitChecks).toHaveLength(20);
  expect(first.wardrobes[0]?.detailsLoaded).toBe(false);
  expect(JSON.stringify(first)).not.toMatch(/visualEmbedding|semanticEmbedding|embeddingModel/);
  const rest = await alice.query(api.wardrobe.pageWardrobeItems, { paginationOpts: { numItems: 1000, cursor: first.closetCursor ?? null } });
  expect(rest.page).toHaveLength(22);
  expect(rest.isDone).toBe(true);
  expect(new Set([...first.items, ...rest.page].map(item => item.id)).size).toBe(70);
  const fits = await alice.query(api.mobile.fits, { paginationOpts: { numItems: 20, cursor: first.fitsCursor ?? null } });
  expect(fits.page).toHaveLength(5);
  const webFits = await alice.query(api.fitChecks.pageFitChecks, { paginationOpts: { numItems: 20, cursor: null } });
  expect(JSON.stringify(webFits)).not.toMatch(/visualEmbedding|semanticEmbedding|embeddingModel/);
  const bob = await t.withIdentity({ subject: "bob" }).query(api.mobile.bootstrap, {});
  expect(bob.items).toEqual([]);
  expect(bob.fitChecks).toEqual([]);
  expect(bob.wardrobes).toEqual([]);
});

test("shared style-memory jobs coalesce writes and reject generation based on stale context or manual notes", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice" });
  await alice.mutation(api.wardrobes.createWardrobe, { name: "First plan" });
  const initial = await t.query(internal.styleMemoryData.load, { userId: "alice" });
  expect(initial?.revision).toBe(1);
  await alice.mutation(api.wardrobes.createWardrobe, { name: "Another plan" });
  const pending = await t.run(ctx => ctx.db.query("styleBioJobs").collect());
  expect(pending).toHaveLength(1);
  expect(pending[0]?.revision).toBe(2);
  const oldArgs = { userId: "alice", jobRevision: initial!.revision, bio: "Old generated note", reason: "collection_shift", contextFingerprint: initial!.context.fingerprint, ...initial!.context.counts };
  expect(await t.mutation(internal.styleMemoryData.save, oldArgs)).toEqual({ success: false, reason: "context_changed" });
  const current = await t.query(internal.styleMemoryData.load, { userId: "alice" });
  await alice.mutation(api.profile.updateBio, { bio: "My own new notes." });
  expect(await t.mutation(internal.styleMemoryData.save, { ...oldArgs, jobRevision: current!.revision })).toEqual({ success: false, reason: "profile_changed" });
  expect((await alice.query(api.profile.getProfile, {}))?.bio).toBe("My own new notes.");
  await t.mutation(internal.account.deleteUserData, { userId: "alice" });
  await t.finishAllScheduledFunctions(() => jest.runAllTimers());
  expect(await t.query(internal.styleMemoryData.load, { userId: "alice" })).toBeNull();
});
