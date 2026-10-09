import { expect, mock, test } from "bun:test";
import { convexTest } from "convex-test";
import { Effect, Layer } from "effect";
import type { Zep } from "@getzep/zep-cloud";
const sdk = await import("@getzep/zep-cloud");
let edges: Zep.EntityEdge[] = [];
let nodes = new Map<string, Zep.EntityNode>();
let maintainedFacts: string[] = [];
process.env.ZEP_KEY = "synthetic-no-network";
mock.module("@getzep/zep-cloud", () => ({ ...sdk, ZepClient: class {
  graph = { search: async () => ({ edges }), node: { get: async (uuid: string) => { const node = nodes.get(uuid); if (!node) throw new Error("Synthetic missing node"); return node; } }, setOntology: async () => {} };
  user = { get: async () => ({}), update: async () => ({}), listUserSummaryInstructions: async () => ({ instructions: [] }), addUserSummaryInstructions: async () => {} };
} }));
mock.module("../src/server/inference/styleBio", () => ({ generateMaintainedStyleBio: ({ graphFacts }: { graphFacts: string[] }) => { maintainedFacts = graphFacts; return Effect.succeed({ bio: "Synthetic maintained bio" }); } }));
mock.module("../src/services/InferenceService", () => ({ InferenceLive: Layer.empty }));
const schema = (await import("../convex/schema")).default;
const { api, internal } = await import("../convex/_generated/api");
const directory = new URL("../convex/", import.meta.url).pathname;
const modules = Object.fromEntries([...new Bun.Glob("**/*.{ts,js}").scanSync(directory)].map(path => [`./${path}`, () => import(`${directory}${path}`)]));
const node = (uuid: string, name: string, attributes: Record<string, unknown> = {}, labels: string[] = []): Zep.EntityNode => ({ uuid, name, attributes, labels, createdAt: "2026-01-01", summary: "Synthetic" });
const edge = (fact: string, sourceNodeUuid: string, targetNodeUuid: string, name = "MEMBER_OF_WARDROBE", attributes: Record<string, unknown> = {}): Zep.EntityEdge => ({ uuid: fact, fact, sourceNodeUuid, targetNodeUuid, name, attributes, createdAt: "2026-01-01" });

async function fixture() {
  const t = convexTest(schema, modules);
  const rows = await t.run(async ctx => {
    const collection = await ctx.db.insert("wardrobes", { userId: "alice", name: "Synthetic removed collection", kind: "locus", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("wardrobes", { userId: "alice", name: "Synthetic active collection", kind: "locus", status: "active", createdAt: 1, updatedAt: 1 });
    const foreign = await ctx.db.insert("wardrobes", { userId: "bob", name: "Foreign", kind: "locus", status: "active", createdAt: 1, updatedAt: 1 });
    const candidate = await ctx.db.insert("candidateItems", { userId: "alice", kind: "inspiration", status: "active", createdAt: 1, updatedAt: 1 });
    const purchase = await ctx.db.insert("candidateItems", { userId: "alice", kind: "purchase", status: "active", createdAt: 1, updatedAt: 1 });
    const member = await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: collection, candidateItemId: candidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    const otherMember = await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: other, candidateItemId: candidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    // A poisoned relationship must not authorize recalling a foreign collection.
    await ctx.db.insert("wardrobeMemberships", { userId: "alice", wardrobeId: foreign, candidateItemId: candidate, membershipKind: "inspiration", createdAt: 1, updatedAt: 1 });
    return { collection, other, foreign, candidate, purchase, member, otherMember };
  });
  nodes = new Map([
    ["candidate", node("candidate", `Candidate ${rows.candidate}`, { item_id: rows.candidate, reference_mode: "associative" }, ["CandidateItem"])],
    ["collection", node("collection", `Wardrobe ${rows.collection}`, { source_ref: rows.collection })],
    ["other", node("other", `Wardrobe ${rows.other}`, { source_ref: rows.other })],
    ["foreign", node("foreign", `Wardrobe ${rows.foreign}`, { source_ref: rows.foreign })],
    ["purchase", node("purchase", `Candidate ${rows.purchase}`, { item_id: rows.purchase }, ["CandidateItem"])],
    ["user", node("user", "Synthetic user")], ["style", node("style", "Synthetic style")],
    ["unknown", node("unknown", "Candidate legacy description", {}, ["CandidateItem"])],
  ]);
  edges = [edge("removed-collection-fact", "candidate", "collection"), edge("active-other-collection-fact", "candidate", "other"), edge("foreign-collection-fact", "candidate", "foreign"), edge("shared-candidate-style-fact", "candidate", "style", "HAS_STYLE_CONCEPT"), edge("unrelated-preference", "user", "style", "STYLE_RELATION"), edge("unknown-legacy-candidate-fact", "unknown", "collection"), edge("unrelated-unsaved-comparison", "unknown", "style", "STYLE_RELATION"), edge("unrelated-owned-candidate", "purchase", "style", "HAS_STYLE_CONCEPT"), { ...edge("invalid-fact", "user", "style", "STYLE_RELATION"), invalidAt: "2026-01-01" }, { ...edge("expired-fact", "user", "style", "STYLE_RELATION"), expiredAt: "2026-01-01" }, edge("inferred-removed-collection-fact", "candidate", "collection", "INSPIRES_COLLECTION"), edge("inferred-active-collection-fact", "candidate", "other", "INSPIRES_COLLECTION"), edge("unverifiable-inspiration-family", "user", "collection", "INSPIRES_COLLECTION")];
  return { t, ...rows, alice: t.withIdentity({ subject: "alice" }), bob: t.withIdentity({ subject: "bob" }) };
}
async function recall(f: Awaited<ReturnType<typeof fixture>>) {
  const planning = await f.alice.action(api.zepSync.searchStyleContext, { query: "Synthetic planning context" });
  const bio = await f.alice.action(api.zepSync.getStyleBioGraphContext, {});
  return { planning: planning.map(row => row.fact), bio: bio.map(row => row.slice(row.indexOf(": ") + 2)) };
}
test("planning and maintained-bio recall exclude removed membership but preserve unrelated/shared/other-collection facts; restore reactivates", async () => {
  const f = await fixture();
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, { wardrobeId: f.collection, membershipId: f.member, removed: true });
  const expected = ["active-other-collection-fact", "shared-candidate-style-fact", "unrelated-preference", "unrelated-unsaved-comparison", "unrelated-owned-candidate", "inferred-active-collection-fact"];
  expect(await recall(f)).toEqual({ planning: expected, bio: expected });
  await f.t.action(internal.styleMemory.refresh, { userId: "alice" });
  expect(maintainedFacts.map(row => row.slice(row.indexOf(": ") + 2))).toEqual(expected);
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, { wardrobeId: f.collection, membershipId: f.member, removed: false });
  const restored = ["removed-collection-fact", ...expected.slice(0, -1), "inferred-removed-collection-fact", "inferred-active-collection-fact"];
  expect(await recall(f)).toEqual({ planning: restored, bio: restored });
  await f.t.run(async ctx => expect((await ctx.db.get(f.otherMember))?.removed).toBeUndefined());
});
test("a candidate with no active collection is omitted; reversed references and archive/owner checks cannot revive it", async () => {
  const f = await fixture();
  edges.push(edge("reversed-membership", "collection", "candidate"));
  await f.alice.mutation(api.wardrobe.setInspirationRemoved, { wardrobeId: f.collection, membershipId: f.member, removed: true });
  await f.alice.mutation(api.wardrobe.archiveCollection, { wardrobeId: f.other, archived: true });
  expect(await recall(f)).toEqual({ planning: ["unrelated-preference", "unrelated-unsaved-comparison", "unrelated-owned-candidate"], bio: ["unrelated-preference", "unrelated-unsaved-comparison", "unrelated-owned-candidate"] });
  await expect(f.t.action(api.zepSync.searchStyleContext, { query: "Synthetic" })).rejects.toThrow();
  expect(await f.bob.action(api.zepSync.searchStyleContext, { query: "Synthetic" })).toEqual([{ fact: "unrelated-preference", relation: "STYLE_RELATION", relevance: null }, { fact: "unrelated-unsaved-comparison", relation: "STYLE_RELATION", relevance: null }]);
  await f.alice.mutation(api.wardrobe.archiveCollection, { wardrobeId: f.other, archived: false });
  expect((await recall(f)).planning).toEqual(["active-other-collection-fact", "shared-candidate-style-fact", "unrelated-preference", "unrelated-unsaved-comparison", "unrelated-owned-candidate", "inferred-active-collection-fact"]);
  nodes.delete("candidate");
  expect((await recall(f)).planning).toEqual(["unrelated-preference", "unrelated-unsaved-comparison", "unrelated-owned-candidate"]);
});
