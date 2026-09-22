import { FunctionImpl } from "@confect/server";
import { Effect } from "effect";
import schema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import { CurrentUser } from "./middleware/RequireUser.spec";
import { ownedStorageUrl } from "./storageAccess";
import spec from "./wardrobe.spec";
import { CollectionInput } from "./collectionContracts";

export const pageCollections = FunctionImpl.make(
  schema,
  spec,
  "pageCollections",
  ({ paginationOpts }) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const { userId } = yield* CurrentUser;
      const result = yield* Effect.promise(() =>
        ctx.db
          .query("wardrobes")
          .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
          .order("desc")
          .paginate({
            ...paginationOpts,
            numItems: Math.max(1, Math.min(24, paginationOpts.numItems)),
            maximumRowsRead: 24,
            maximumBytesRead: 1_000_000,
          }),
      );
      const page = yield* Effect.forEach(result.page, (collection) =>
        Effect.gen(function* () {
          // One pagination per invocation; thumbnail fan-out stays bounded separately.
          const memberships = yield* Effect.promise(() =>
            ctx.db
              .query("wardrobeMemberships")
              .withIndex("by_wardrobe", (q) =>
                q.eq("wardrobeId", collection._id),
              )
              .order("desc")
              .take(12),
          );
          const previews: Array<{
            id: string;
            imageUrl: string;
            category: string | null;
          }> = [];
          const seen = new Set<string>();
          for (const member of memberships) {
            if (member.userId !== userId) continue;
            const id = member.itemId ?? member.candidateItemId;
            if (!id || seen.has(id)) continue;
            const piece = yield* Effect.promise(() => ctx.db.get(id));
            if (!piece || piece.userId !== userId || !piece.storageId) continue;
            const imageUrl = yield* Effect.promise(() =>
              ownedStorageUrl(ctx, userId, piece.storageId!),
            );
            if (!imageUrl) continue;
            seen.add(id);
            previews.push({ id, imageUrl, category: piece.category ?? null });
            if (previews.length === 3) break;
          }
          return {
            _id: collection._id,
            name: collection.name,
            description: collection.description ?? null,
            previews,
          };
        }),
      );
      return {
        ...result,
        page,
      };
    }),
);

export const pagePieces = FunctionImpl.make(
  schema,
  spec,
  "pagePieces",
  ({ wardrobeId, paginationOpts }) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const { userId } = yield* CurrentUser;
      const collection = yield* Effect.promise(() => ctx.db.get(wardrobeId));
      if (!collection || collection.userId !== userId)
        return { page: [], isDone: true, continueCursor: "" };
      const result = yield* Effect.promise(() =>
        ctx.db
          .query("wardrobeMemberships")
          .withIndex("by_wardrobe", (q) => q.eq("wardrobeId", wardrobeId))
          .order("desc")
          .paginate({
            ...paginationOpts,
            numItems: Math.max(1, Math.min(48, paginationOpts.numItems)),
            maximumRowsRead: 100,
            maximumBytesRead: 1_000_000,
          }),
      );
      const items = yield* Effect.forEach(result.page, (m) =>
        Effect.gen(function* () {
          if (m.userId !== userId || !m.itemId) return null;
          const item = yield* Effect.promise(() => ctx.db.get(m.itemId!));
          if (!item || item.userId !== userId) return null;
          const imageUrl = yield* Effect.promise(() =>
            ownedStorageUrl(ctx, userId, item.storageId),
          );
          if (!imageUrl) return null;
          return {
            id: item._id,
            imageUrl,
            category: item.category ?? null,
            description: item.description ?? null,
            styleTags: item.styleTags ?? null,
            note: item.note ?? "",
            analysisStatus: item.analysisStatus,
            analysisError: item.analysisError ?? null,
            createdAt: item.createdAt,
          };
        }),
      );
      return {
        ...result,
        page: items.filter((i) => i !== null),
      };
    }),
);
export const itemDetails = FunctionImpl.make(
  schema,
  spec,
  "itemDetails",
  ({ itemId }) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const { userId } = yield* CurrentUser;
      const item = yield* Effect.promise(() => ctx.db.get(itemId));
      if (!item || item.userId !== userId) return null;
      const memberships = yield* Effect.promise(() =>
        ctx.db
          .query("wardrobeMemberships")
          .withIndex("by_item", (q) => q.eq("itemId", itemId))
          .take(101),
      );
      const collections = yield* Effect.forEach(
        memberships.slice(0, 100),
        (m) =>
          Effect.gen(function* () {
            if (m.userId !== userId) return null;
            const collection = yield* Effect.promise(() =>
              ctx.db.get(m.wardrobeId),
            );
            return collection?.userId === userId
              ? { id: collection._id, name: collection.name }
              : null;
          }),
      );
      return {
        note: item.note ?? "",
        collections: collections.filter((c) => c !== null),
        truncated: memberships.length > 100,
      };
    }),
);
export const itemCollectionMembership = FunctionImpl.make(
  schema,
  spec,
  "itemCollectionMembership",
  ({ itemId, wardrobeId }) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const { userId } = yield* CurrentUser;
      const [item, collection] = yield* Effect.promise(() =>
        Promise.all([ctx.db.get(itemId), ctx.db.get(wardrobeId)]),
      );
      if (item?.userId !== userId || collection?.userId !== userId) return false;
      const membership = yield* Effect.promise(() =>
        ctx.db
          .query("wardrobeMemberships")
          .withIndex("by_wardrobe_item", (q) =>
            q.eq("wardrobeId", wardrobeId).eq("itemId", itemId),
          )
          .first(),
      );
      return membership?.userId === userId;
    }),
);
export const pageInspiration = FunctionImpl.make(
  schema,
  spec,
  "pageInspiration",
  ({ wardrobeId, paginationOpts }) =>
    Effect.gen(function* () {
      const ctx = yield* QueryCtx;
      const { userId } = yield* CurrentUser;
      const collection = yield* Effect.promise(() => ctx.db.get(wardrobeId));
      if (!collection || collection.userId !== userId)
        return { page: [], isDone: true, continueCursor: "" };
      const result = yield* Effect.promise(() =>
        ctx.db
          .query("wardrobeMemberships")
          .withIndex("by_wardrobe", (q) => q.eq("wardrobeId", wardrobeId))
          .order("desc")
          .paginate({
            ...paginationOpts,
            numItems: Math.max(1, Math.min(48, paginationOpts.numItems)),
            maximumRowsRead: 100,
            maximumBytesRead: 1_000_000,
          }),
      );
      const references = yield* Effect.forEach(result.page, (member) =>
        Effect.gen(function* () {
          if (member.userId !== userId || !member.candidateItemId) return null;
          const reference = yield* Effect.promise(() =>
            ctx.db.get(member.candidateItemId!),
          );
          if (
            !reference ||
            reference.userId !== userId ||
            reference.kind !== "inspiration"
          )
            return null;
          const imageUrl = reference.storageId
            ? yield* Effect.promise(() =>
                ownedStorageUrl(ctx, userId, reference.storageId!),
              )
            : null;
          return {
            _id: reference._id,
            category: reference.category ?? null,
            description: reference.description ?? null,
            imageUrl,
          };
        }),
      );
      return {
        ...result,
        page: references.filter((r) => r !== null),
      };
    }),
);
export const saveNote = FunctionImpl.make(
  schema,
  spec,
  "saveNote",
  ({ itemId, note }) =>
    Effect.gen(function* () {
      const ctx = yield* MutationCtx;
      const { userId } = yield* CurrentUser;
      const item = yield* Effect.promise(() => ctx.db.get(itemId));
      if (!item || item.userId !== userId)
        return yield* new CollectionInput({
          message: "This piece is no longer available.",
        });
      if (note.length > 2000)
        return yield* new CollectionInput({
          message: "Keep item notes under 2,000 characters.",
        });
      yield* Effect.promise(() =>
        ctx.db.patch(itemId, { note: note.trim(), updatedAt: Date.now() }),
      );
      return null;
    }),
);
