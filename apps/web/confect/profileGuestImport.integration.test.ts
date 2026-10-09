import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { retrier } from "./legacy/retrier";
import type { Doc } from "../convex/_generated/dataModel";

const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));
let sync: ReturnType<typeof spyOn<typeof retrier, "run">>;
beforeEach(() => {
  sync = spyOn(retrier, "run").mockResolvedValue("synthetic-sync" as Awaited<ReturnType<typeof retrier.run>>);
});
afterEach(() => sync.mockRestore());

function fixture() {
  const t = convexTest(schema, modules);
  return { t, alice: t.withIdentity({ subject: "alice" }) };
}

const usedProfiles: Array<[string, Partial<Doc<"profiles">>, boolean]> = [
  ["manual notes", { bio: "Keep my manual notes", bioSource: "manual", bioManualAnchor: "Keep my manual notes" }, true],
  ["agent notes", { bio: "Keep my generated notes", bioSource: "agent" }, true],
  ["legacy notes without revision metadata", { bio: "Keep legacy notes" }, false],
  ["blank current bio with detached history", { bio: "" }, true],
  ["blank current bio with manual anchor only", { bio: "", bioManualAnchor: "Prior manual notes" }, false],
  ["explicitly cleared manual notes", { bio: "", bioManualAnchor: "", bioLastManualEditAt: 1 }, false],
  ["blank current bio with source metadata", { bio: "", bioSource: "agent" }, false],
];
for (const [name, profile, history] of usedProfiles) {
  test(`guest import preserves ${name}, revisions and memory sync`, async () => {
    const { t, alice } = fixture();
    await t.run(async ctx => {
      if (history) await ctx.db.insert("profileBioRevisions", { userId: "alice", bio: "Previous notes", source: "manual", reason: "user_edit", createdAt: 1 });
      await ctx.db.insert("profiles", { userId: "alice", updatedAt: 1, ...profile });
    });
    const before = await alice.query(api.profile.getProfile, {});
    const revisions = await t.run(ctx => ctx.db.query("profileBioRevisions").collect());
    expect(await alice.mutation(api.profile.updateBio, { bio: "Guest fixture notes", source: "guest_import" })).toEqual({ success: true });
    expect(await alice.query(api.profile.getProfile, {})).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("profileBioRevisions").collect())).toEqual(revisions);
    expect(sync).not.toHaveBeenCalled();
  });
}

test("guest import seeds a new profile once; retry preserves first seed", async () => {
  const { t, alice } = fixture();
  await alice.mutation(api.profile.updateBio, { bio: "First guest notes", source: "guest_import" });
  const seeded = await alice.query(api.profile.getProfile, {});
  expect(seeded?.bio).toBe("First guest notes");
  expect(seeded?.bioSource).toBe("guest_import");
  expect(sync).toHaveBeenCalledTimes(1);
  await alice.mutation(api.profile.updateBio, { bio: "Later guest notes", source: "guest_import" });
  expect(await alice.query(api.profile.getProfile, {})).toEqual(seeded);
  expect(await t.run(ctx => ctx.db.query("profileBioRevisions").collect())).toHaveLength(1);
  expect(sync).toHaveBeenCalledTimes(1);
});

test("unused attributes-only profile can be seeded; foreign history does not block it", async () => {
  const { t, alice } = fixture();
  await t.run(async ctx => {
    await ctx.db.insert("profiles", { userId: "alice", skinTone: "synthetic", bio: "", updatedAt: 1 });
    await ctx.db.insert("profileBioRevisions", { userId: "bob", bio: "Other account", source: "manual", reason: "user_edit", createdAt: 1 });
  });
  await alice.mutation(api.profile.updateBio, { bio: "Guest seed", source: "guest_import" });
  const profile = await alice.query(api.profile.getProfile, {});
  expect(profile?.bio).toBe("Guest seed");
  expect(profile?.skinTone).toBe("synthetic");
  expect(sync).toHaveBeenCalledTimes(1);
});

test("detached history also protects an account whose profile row is missing", async () => {
  const { t, alice } = fixture();
  await t.run(ctx => ctx.db.insert("profileBioRevisions", { userId: "alice", bio: "Old notes", source: "agent", reason: "closet_shift", createdAt: 1 }));
  await alice.mutation(api.profile.updateBio, { bio: "Guest seed", source: "guest_import" });
  expect(await alice.query(api.profile.getProfile, {})).toBeNull();
  expect(await t.run(ctx => ctx.db.query("profileBioRevisions").collect())).toHaveLength(1);
  expect(sync).not.toHaveBeenCalled();
});

test("empty guest bio creates no profile, revision or memory synchronization", async () => {
  const { t, alice } = fixture();
  for (const bio of ["", "   "]) await alice.mutation(api.profile.updateBio, { bio, source: "guest_import" });
  expect(await alice.query(api.profile.getProfile, {})).toBeNull();
  expect(await t.run(ctx => ctx.db.query("profileBioRevisions").collect())).toEqual([]);
  expect(sync).not.toHaveBeenCalled();
});

test("explicit manual edits still replace and clear existing notes", async () => {
  const { t, alice } = fixture();
  await alice.mutation(api.profile.updateBio, { bio: "Guest seed", source: "guest_import" });
  await alice.mutation(api.profile.updateBio, { bio: "My deliberate edit", source: "manual" });
  expect((await alice.query(api.profile.getProfile, {}))?.bioManualAnchor).toBe("My deliberate edit");
  await alice.mutation(api.profile.updateBio, { bio: "" });
  const cleared = await alice.query(api.profile.getProfile, {});
  expect(cleared?.bio).toBe("");
  expect(cleared?.bioSource).toBe("manual");
  expect(cleared?.bioManualAnchor).toBe("");
  expect(await t.run(ctx => ctx.db.query("profileBioRevisions").collect())).toHaveLength(3);
  expect(sync).toHaveBeenCalledTimes(3);
});

test("guest no-op still requires authenticated identity", async () => {
  const { t } = fixture();
  await expect(t.mutation(api.profile.updateBio, { bio: "", source: "guest_import" })).rejects.toThrow("Unauthorized");
  expect(sync).not.toHaveBeenCalled();
});
