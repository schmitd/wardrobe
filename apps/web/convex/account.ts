import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const deleteUserData = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) => {
    const [
      wardrobeItems,
      candidateItems,
      profiles,
      wardrobes,
      wardrobeMemberships,
      fitChecks,
      fitCheckItems,
      garmentObservations,
      uploads,
      subscriptions,
      profileBioRevisions,
    ] = await Promise.all([
      ctx.db
        .query("wardrobeItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("candidateItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("wardrobes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("wardrobeMemberships")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("fitChecks")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("fitCheckItems")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("garmentObservations")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("uploads")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("profileBioRevisions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    const storageIds = new Set([
      ...wardrobeItems.map((item) => item.storageId),
      ...candidateItems.flatMap((item) => (item.storageId ? [item.storageId] : [])),
      ...fitChecks.map((fitCheck) => fitCheck.storageId),
      ...garmentObservations.map((observation) => observation.cropStorageId),
      ...uploads.map((upload) => upload.storageId),
    ]);

    await Promise.all([...storageIds].map((storageId) => ctx.storage.delete(storageId)));
    await Promise.all(wardrobeItems.map((item) => ctx.db.delete(item._id)));
    await Promise.all(candidateItems.map((item) => ctx.db.delete(item._id)));
    await Promise.all(profiles.map((profile) => ctx.db.delete(profile._id)));
    await Promise.all(wardrobes.map((wardrobe) => ctx.db.delete(wardrobe._id)));
    await Promise.all(wardrobeMemberships.map((membership) => ctx.db.delete(membership._id)));
    await Promise.all(fitChecks.map((fitCheck) => ctx.db.delete(fitCheck._id)));
    await Promise.all(fitCheckItems.map((fitCheckItem) => ctx.db.delete(fitCheckItem._id)));
    await Promise.all(garmentObservations.map((observation) => ctx.db.delete(observation._id)));
    await Promise.all(uploads.map((upload) => ctx.db.delete(upload._id)));
    await Promise.all(subscriptions.map((subscription) => ctx.db.delete(subscription._id)));
    await Promise.all(profileBioRevisions.map((revision) => ctx.db.delete(revision._id)));

    return {
      wardrobeItems: wardrobeItems.length,
      candidateItems: candidateItems.length,
      profiles: profiles.length,
      wardrobes: wardrobes.length,
      wardrobeMemberships: wardrobeMemberships.length,
      fitChecks: fitChecks.length,
      fitCheckItems: fitCheckItems.length,
      garmentObservations: garmentObservations.length,
      uploads: uploads.length,
      subscriptions: subscriptions.length,
      profileBioRevisions: profileBioRevisions.length,
      storageObjects: storageIds.size,
    };
  },
});
