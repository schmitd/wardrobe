import type { GenericId } from "convex/values";
import { Effect, Layer } from "effect";
import { FunctionImpl, GroupImpl, Impl } from "@confect/server";

import { MutationCtx, QueryCtx } from "./_generated/services";
import api from "./_generated/api";
import { ensureTraceContext } from "./trace";

const now = () => Date.now();

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const normalizeContentType = (value?: string | null) =>
  value?.split(";")[0]?.trim().toLowerCase() ?? null;

type AuthCtx = {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
};

const getUserId = async (ctx: AuthCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

const assertOwnedItem = async (
  ctx: {
    db: {
      get: (
        id: GenericId<"wardrobeItems">,
      ) => Promise<{ userId: string } | null>;
    };
    auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  },
  itemId: GenericId<"wardrobeItems">,
) => {
  const userId = await getUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const item = await ctx.db.get(itemId);
  if (!item || item.userId !== userId) throw new Error("Not found");

  return userId;
};

const validateUploadedImage = async (
  ctx: {
    storage: {
      getMetadata: (
        storageId: GenericId<"_storage">,
      ) => Promise<{ contentType: string | null; size: number } | null>;
    };
  },
  args: { storageId: GenericId<"_storage">; declaredContentType?: string | null },
) => {
  const metadata = await ctx.storage.getMetadata(args.storageId);
  if (!metadata) throw new Error("Uploaded file missing");

  const metadataContentType = normalizeContentType(metadata.contentType);
  if (!metadataContentType || !ALLOWED_IMAGE_CONTENT_TYPES.has(metadataContentType)) {
    throw new Error("Only JPEG, PNG, WEBP, GIF, HEIC, and HEIF images are allowed.");
  }

  if (metadata.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image is too large. Maximum upload size is 4 MB.");
  }

  const declaredContentType = normalizeContentType(args.declaredContentType);
  if (declaredContentType && declaredContentType !== metadataContentType) {
    throw new Error("Uploaded file type did not match the declared content type.");
  }
};

const wardrobeGroup = GroupImpl.make(api, "wardrobe").pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(api, "wardrobe", "listWardrobeItems", () =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) return [];

          const items = yield* Effect.promise(() =>
            ctx.db
              .query("wardrobeItems")
              .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
              .order("desc")
              .collect(),
          ).pipe(Effect.orDie);

          const withUrls = yield* Effect.promise(() =>
            Promise.all(
              items.map(async (item) => ({
                id: item._id,
                imageUrl: await ctx.storage.getUrl(item.storageId),
                category: item.category ?? null,
                description: item.description ?? null,
                styleTags: item.styleTags ?? null,
                analysisStatus: item.analysisStatus,
                analysisError: item.analysisError ?? null,
                createdAt: item.createdAt,
              })),
            ),
          ).pipe(Effect.orDie);

          return withUrls.filter(
            (
              item,
            ): item is {
              id: GenericId<"wardrobeItems">;
              imageUrl: string;
              category: string | null;
              description: string | null;
              styleTags: string[] | null;
              analysisStatus:
                | "queued"
                | "processing_tags"
                | "processing_description"
                | "processing_embedding"
                | "ready"
                | "error";
              analysisError: string | null;
              createdAt: number;
            } => item.imageUrl !== null,
          );
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "getUploadUrl", () =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          return yield* Effect.promise(() => ctx.storage.generateUploadUrl()).pipe(
            Effect.orDie,
          );
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "createWardrobeItem", (args) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          yield* Effect.promise(() =>
            validateUploadedImage(ctx, {
              storageId: args.storageId,
              declaredContentType: args.contentType,
            }),
          ).pipe(Effect.orDie);

          const { traceId, traceparent } = ensureTraceContext({
            traceId: args.traceId,
            traceparent: args.traceparent,
          });
          const timestamp = now();

          const itemId = yield* Effect.promise(() =>
            ctx.db.insert("wardrobeItems", {
              userId,
              storageId: args.storageId,
              clientFileName: args.clientFileName,
              contentType: args.contentType,
              analysisStatus: "queued",
              traceId,
              traceparent,
              createdAt: timestamp,
              updatedAt: timestamp,
            }),
          ).pipe(Effect.orDie);

          console.info("wardrobe.create", { traceId, traceparent, itemId, userId });

          return { id: itemId };
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "deleteWardrobeItem", ({ itemId, reason }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const item = yield* Effect.promise(() => ctx.db.get(itemId)).pipe(Effect.orDie);
          if (!item || item.userId !== userId) throw new Error("Not found");

          yield* Effect.promise(() => ctx.db.delete(itemId)).pipe(Effect.orDie);
          console.info("wardrobe.delete", { itemId, userId, reason });

          return { success: true as const };
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "getWardrobeItem", ({ itemId }) =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const item = yield* Effect.promise(() => ctx.db.get(itemId)).pipe(Effect.orDie);
          if (!item || item.userId !== userId) throw new Error("Not found");

          return item;
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "getWardrobeItemInternal", ({ itemId }) =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          return yield* Effect.promise(() => ctx.db.get(itemId)).pipe(Effect.orDie);
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "getWardrobeItemWithUrl", ({ itemId }) =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const item = yield* Effect.promise(() => ctx.db.get(itemId)).pipe(Effect.orDie);
          if (!item || item.userId !== userId) {
            throw new Error("Not found");
          }

          const imageUrl = yield* Effect.promise(() => ctx.storage.getUrl(item.storageId)).pipe(
            Effect.orDie,
          );
          if (!imageUrl) {
            throw new Error("Image not available");
          }

          return {
            ...item,
            imageUrl,
          };
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "listItemsForSimilarity", ({ limit }) =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const items = yield* Effect.promise(() =>
            ctx.db.query("wardrobeItems").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
          ).pipe(Effect.orDie);

          return items.filter((item) => Array.isArray(item.embedding)).slice(0, limit ?? 200);
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "setAnalysisStatus", ({ itemId, status }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() => assertOwnedItem(ctx, itemId)).pipe(Effect.orDie);

          yield* Effect.promise(() =>
            ctx.db.patch(itemId, {
              analysisStatus: status,
              updatedAt: now(),
            }),
          ).pipe(Effect.orDie);

          return null;
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "applyTags", ({ itemId, category, styleTags }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() => assertOwnedItem(ctx, itemId)).pipe(Effect.orDie);

          yield* Effect.promise(() =>
            ctx.db.patch(itemId, {
              category: category ?? undefined,
              styleTags: [...styleTags],
              updatedAt: now(),
            }),
          ).pipe(Effect.orDie);

          return null;
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "applyDescription", ({ itemId, category, description }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() => assertOwnedItem(ctx, itemId)).pipe(Effect.orDie);

          yield* Effect.promise(() =>
            ctx.db.patch(itemId, {
              category: category ?? undefined,
              description,
              updatedAt: now(),
            }),
          ).pipe(Effect.orDie);

          return null;
        }),
      ),
      FunctionImpl.make(api, "wardrobe", "applyEmbedding", ({ itemId, embedding }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() => assertOwnedItem(ctx, itemId)).pipe(Effect.orDie);

          yield* Effect.promise(() =>
            ctx.db.patch(itemId, {
              embedding: [...embedding],
              updatedAt: now(),
            }),
          ).pipe(Effect.orDie);

          return null;
        }),
      ),
      FunctionImpl.make(
        api,
        "wardrobe",
        "applyFullAnalysis",
        ({ itemId, category, description, styleTags, embedding }) =>
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            yield* Effect.promise(() => assertOwnedItem(ctx, itemId)).pipe(Effect.orDie);

            yield* Effect.promise(() =>
              ctx.db.patch(itemId, {
                category: category ?? undefined,
                description,
                styleTags: [...styleTags],
                embedding: [...embedding],
                analysisStatus: "ready",
                analysisError: undefined,
                updatedAt: now(),
              }),
            ).pipe(Effect.orDie);

            return null;
          }),
      ),
      FunctionImpl.make(api, "wardrobe", "setAnalysisError", ({ itemId, error }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          yield* Effect.promise(() => assertOwnedItem(ctx, itemId)).pipe(Effect.orDie);

          yield* Effect.promise(() =>
            ctx.db.patch(itemId, {
              analysisStatus: "error",
              analysisError: error,
              updatedAt: now(),
            }),
          ).pipe(Effect.orDie);

          return null;
        }),
      ),
    ),
  ),
);

const storageGroup = GroupImpl.make(api, "storage").pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(api, "storage", "registerUpload", ({ storageId, purpose }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const existing = yield* Effect.promise(() =>
            ctx.db
              .query("uploads")
              .withIndex("by_user_storage", (q) => q.eq("userId", userId).eq("storageId", storageId))
              .first(),
          ).pipe(Effect.orDie);

          if (existing) return { ok: true as const };

          yield* Effect.promise(() =>
            ctx.db.insert("uploads", {
              userId,
              storageId,
              purpose,
              createdAt: now(),
            }),
          ).pipe(Effect.orDie);

          return { ok: true as const };
        }),
      ),
      FunctionImpl.make(api, "storage", "getStorageUrl", ({ storageId }) =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const item = yield* Effect.promise(() =>
            ctx.db
              .query("wardrobeItems")
              .filter((q) => q.eq(q.field("storageId"), storageId))
              .first(),
          ).pipe(Effect.orDie);

          if (item && item.userId === userId) {
            const imageUrl = yield* Effect.promise(() => ctx.storage.getUrl(storageId)).pipe(
              Effect.orDie,
            );
            if (!imageUrl) throw new Error("Not found");
            return imageUrl;
          }

          const upload = yield* Effect.promise(() =>
            ctx.db
              .query("uploads")
              .withIndex("by_user_storage", (q) => q.eq("userId", userId).eq("storageId", storageId))
              .first(),
          ).pipe(Effect.orDie);

          if (!upload) throw new Error("Not found");

          const imageUrl = yield* Effect.promise(() => ctx.storage.getUrl(storageId)).pipe(
            Effect.orDie,
          );
          if (!imageUrl) throw new Error("Not found");

          return imageUrl;
        }),
      ),
      FunctionImpl.make(api, "storage", "getStorageMetadata", ({ storageId }) =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const item = yield* Effect.promise(() =>
            ctx.db
              .query("wardrobeItems")
              .filter((q) => q.eq(q.field("storageId"), storageId))
              .first(),
          ).pipe(Effect.orDie);

          const ownsItem = Boolean(item && item.userId === userId);
          const upload = ownsItem
            ? null
            : yield* Effect.promise(() =>
                ctx.db
                  .query("uploads")
                  .withIndex("by_user_storage", (q) =>
                    q.eq("userId", userId).eq("storageId", storageId),
                  )
                  .first(),
              ).pipe(Effect.orDie);

          if (!ownsItem && !upload) throw new Error("Not found");

          const metadata = yield* Effect.promise(() => ctx.storage.getMetadata(storageId)).pipe(
            Effect.orDie,
          );
          if (!metadata) throw new Error("Not found");

          return {
            contentType: metadata.contentType,
            size: metadata.size,
            sha256: metadata.sha256,
          };
        }),
      ),
    ),
  ),
);

const profileGroup = GroupImpl.make(api, "profile").pipe(
  Layer.provide(
    Layer.mergeAll(
      FunctionImpl.make(api, "profile", "getProfile", () =>
        Effect.gen(function* () {
          const ctx = yield* QueryCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) return null;

          const profile = yield* Effect.promise(() =>
            ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", userId))
              .first(),
          ).pipe(Effect.orDie);

          return profile ?? null;
        }),
      ),
      FunctionImpl.make(api, "profile", "updateBio", ({ bio }) =>
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
          if (!userId) throw new Error("Unauthorized");

          const existing = yield* Effect.promise(() =>
            ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", userId))
              .first(),
          ).pipe(Effect.orDie);

          if (existing) {
            yield* Effect.promise(() =>
              ctx.db.patch(existing._id, {
                bio,
                updatedAt: now(),
              }),
            ).pipe(Effect.orDie);
          } else {
            yield* Effect.promise(() =>
              ctx.db.insert("profiles", {
                userId,
                bio,
                updatedAt: now(),
              }),
            ).pipe(Effect.orDie);
          }

          return { success: true as const };
        }),
      ),
      FunctionImpl.make(
        api,
        "profile",
        "updateProfileAttributes",
        ({ bio, skinTone, hairColor }) =>
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            const userId = yield* Effect.promise(() => getUserId(ctx)).pipe(Effect.orDie);
            if (!userId) throw new Error("Unauthorized");

            const existing = yield* Effect.promise(() =>
              ctx.db
                .query("profiles")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .first(),
            ).pipe(Effect.orDie);

            const payload = {
              bio,
              skinTone,
              hairColor,
              updatedAt: now(),
            };

            if (existing) {
              yield* Effect.promise(() => ctx.db.patch(existing._id, payload)).pipe(
                Effect.orDie,
              );
            } else {
              yield* Effect.promise(() =>
                ctx.db.insert("profiles", {
                  userId,
                  ...payload,
                }),
              ).pipe(Effect.orDie);
            }

            return { success: true as const };
          }),
      ),
      FunctionImpl.make(
        api,
        "profile",
        "internalProfileUpdate",
        ({ userId, bio, skinTone, hairColor }) =>
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            const existing = yield* Effect.promise(() =>
              ctx.db
                .query("profiles")
                .withIndex("by_user", (q) => q.eq("userId", userId))
                .first(),
            ).pipe(Effect.orDie);

            const payload = {
              bio,
              skinTone,
              hairColor,
              updatedAt: now(),
            };

            if (existing) {
              yield* Effect.promise(() => ctx.db.patch(existing._id, payload)).pipe(
                Effect.orDie,
              );
            } else {
              yield* Effect.promise(() =>
                ctx.db.insert("profiles", {
                  userId,
                  ...payload,
                }),
              ).pipe(Effect.orDie);
            }

            return null;
          }),
      ),
    ),
  ),
);

export default Impl.finalize(
  Impl.make(api).pipe(
    Layer.provide(Layer.mergeAll(wardrobeGroup, storageGroup, profileGroup)),
  ),
);
