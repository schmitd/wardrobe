import { FunctionImpl } from "@confect/server";
import { Effect } from "effect";
import schema from "./_generated/schema";
import { MutationCtx, QueryCtx } from "./_generated/services";
import { CurrentUser } from "./middleware/RequireUser.spec";
import { ownedStorageUrl } from "./storageAccess";
import spec from "./wardrobe.spec";
import { CollectionInput } from "./collectionContracts";

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
        page: items.filter((i) => i !== null),
        isDone: result.isDone,
        continueCursor: result.continueCursor,
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
