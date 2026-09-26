import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";

const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)]
  .map(path => [`./${path}`, () => import(`${directory}${path}`)]));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
async function drainScheduled(t: ReturnType<typeof convexTest<typeof schema.tables>>) {
  await t.finishAllScheduledFunctions(() => jest.runAllTimers());
}

test("forged legacy photo references never authorize attachment, display, promotion, or deletion", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice" });
  const bob = t.withIdentity({ subject: "bob" });
  const fixture = await t.run(async ctx => {
    const own = await ctx.storage.store(new Blob(["alice"]));
    const foreign = await ctx.storage.store(new Blob(["bob"]));
    for (const [storageId, userId] of [[own, "alice"], [foreign, "bob"]] as const)
      await ctx.db.insert("storageObjects", { storageId, userId, provenance: "upload", createdAt: 1 });
    await ctx.db.insert("uploads", { userId: "alice", storageId: foreign, purpose: "selfie", createdAt: 1 });
    const item = await ctx.db.insert("wardrobeItems", { userId: "alice", storageId: foreign, analysisStatus: "ready", createdAt: 1, updatedAt: 1 });
    const wardrobe = await ctx.db.insert("wardrobes", { userId: "alice", name: "Test", kind: "planned", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: wardrobe, itemId: item, membershipKind: "owned", createdAt: 1, updatedAt: 1 });
    const candidate = await ctx.db.insert("candidateItems", { userId: "alice", storageId: foreign, kind: "inspiration", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: wardrobe, candidateItemId: candidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    const fit = await ctx.db.insert("fitChecks", { userId: "alice", storageId: foreign, type: "daily_fit_check", createdAt: 1, updatedAt: 1 });
    const fitItem = await ctx.db.insert("fitCheckItems", { userId: "alice", fitCheckId: fit, source: "observed_unresolved", createdAt: 1 });
    const observation = await ctx.db.insert("garmentObservations", { userId: "alice", fitCheckId: fit, fitCheckItemId: fitItem, cropStorageId: foreign, category: "shirt", categoryKey: "top", description: "test", styleTags: [], boundingBox: { x: 0, y: 0, width: 1, height: 1 }, visualEmbedding: [], embeddingModel: "test", detectorModel: "test", resolutionStatus: "unresolved", candidateItemIds: [item], candidateScores: [1], createdAt: 1, updatedAt: 1 });
    return { own, foreign, item, wardrobe, observation, fit };
  });
  await expect(alice.mutation(api.storage.registerUpload, { storageId: fixture.foreign, purpose: "selfie" })).rejects.toThrow();
  await expect(alice.query(api.storage.getStorageUrl, { storageId: fixture.foreign })).rejects.toThrow();
  await expect(alice.mutation(api.wardrobe.createWardrobeItem, { storageId: fixture.foreign })).rejects.toThrow();
  await expect(alice.mutation(api.candidates.createInspiration, { storageId: fixture.foreign, wardrobeId: fixture.wardrobe })).rejects.toThrow();
  await expect(alice.mutation(api.fitChecks.promoteGarmentObservation, { observationId: fixture.observation })).rejects.toThrow();
  expect(await alice.query(api.storage.getLatestUploadByPurpose, { purpose: "selfie" })).toBeNull();
  expect(await alice.query(api.wardrobe.listWardrobeItems, {})).toEqual([]);
  expect(await alice.query(api.fitChecks.exportImage, { id: fixture.fit })).toBeNull();
  expect(await bob.query(api.fitChecks.exportImage, { id: fixture.fit })).toBeNull();
  const ownedFit = await t.run(ctx => ctx.db.insert("fitChecks", { userId: "alice", storageId: fixture.own, type: "daily_fit_check", createdAt: 1, updatedAt: 1 }));
  expect(await alice.query(api.fitChecks.exportImage, { id: ownedFit })).not.toBeNull();
  expect(await bob.query(api.fitChecks.exportImage, { id: ownedFit })).toBeNull();
  const fits = (await alice.query(api.fitChecks.listFitChecks, {})).filter(fit => fit._id === fixture.fit);
  expect(fits[0]?.imageUrl).toBeNull();
  expect(fits[0]?.observations[0]?.cropUrl).toBeNull();
  expect(fits[0]?.observations[0]?.candidates[0]?.imageUrl).toBeNull();
  expect((await alice.query(api.candidates.listInspirationByWardrobe, { wardrobeId: fixture.wardrobe }))[0]?.imageUrl).toBeNull();
  expect((await alice.query(api.garmentIdentityQueries.getVisualCandidateDetails, { itemIds: [fixture.item] }))[0]?.imageUrl).toBeNull();

  // The legitimate owner can reuse the same photo across registered purposes and items.
  await alice.mutation(api.storage.registerUpload, { storageId: fixture.own, purpose: "selfie" });
  expect((await alice.mutation(api.wardrobe.createWardrobeItem, { storageId: fixture.own })).created).toBe(true);
  expect((await alice.mutation(api.wardrobe.createWardrobeItem, { storageId: fixture.own })).created).toBe(false);
  expect(await bob.query(api.storage.getStorageUrl, { storageId: fixture.foreign })).toBeString();
  await t.mutation(internal.account.deleteUserData, { userId: "alice" });
  await drainScheduled(t);
  expect(await t.run(async ctx => (await ctx.storage.get(fixture.own)) !== null)).toBe(false);
  expect(await t.run(async ctx => (await ctx.storage.get(fixture.foreign)) !== null)).toBe(true);
  expect(await t.run(ctx => ctx.db.query("wardrobeItems").collect())).toEqual([]);
  await expect(alice.mutation(api.storage.registerUpload, { storageId: fixture.own, purpose: "selfie" })).rejects.toThrow();
});

test("upload tickets are single use and account deletion wins over an in-flight upload", async () => {
  const t = convexTest(schema, modules);
  const ticket = await t.run(ctx => ctx.db.insert("uploadTickets", { token: "synthetic-ticket", userId: "alice", state: "issued", expiresAt: Date.now() + 60_000 }));
  const claims = await Promise.allSettled([t.mutation(internal.uploads.claim, { token: "synthetic-ticket" }), t.mutation(internal.uploads.claim, { token: "synthetic-ticket" })]);
  expect(claims.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const storageId = await t.run(ctx => ctx.storage.store(new Blob(["in flight"])));
  await t.mutation(internal.account.deleteUserData, { userId: "alice" });
  await expect(t.mutation(internal.uploads.finalize, { ticketId: ticket, storageId })).rejects.toThrow();
  await drainScheduled(t);
  expect(await t.run(ctx => ctx.db.query("storageObjects").collect())).toEqual([]);
});

test("legacy import requires matching blob evidence and cannot replace a trusted owner", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async ctx => {
    const storageId = await ctx.storage.store(new Blob(["legacy"]));
    const row = await ctx.db.system.get(storageId);
    return { storageId, row: row! };
  });
  const approval = { storageId: fixture.storageId, userId: "alice", expectedSha256: fixture.row.sha256, expectedCreatedAt: fixture.row._creationTime, evidence: "Independent test uploader log reviewed for this exact object." };
  await expect(t.mutation(internal.storageMigration.approveReviewed, { ...approval, expectedSha256: "wrong" })).rejects.toThrow();
  await t.mutation(internal.storageMigration.approveReviewed, approval);
  await t.mutation(internal.storageMigration.approveReviewed, approval);
  await expect(t.mutation(internal.storageMigration.approveReviewed, { ...approval, userId: "bob" })).rejects.toThrow();
  expect((await t.query(internal.storageMigration.inventory, { pagination: { numItems: 50, cursor: null } })).page[0]?.trustedOwner).toBe("alice");
});
