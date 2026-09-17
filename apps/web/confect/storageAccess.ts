import { Context, Effect, Layer } from "effect";
import type { Id } from "../convex/_generated/dataModel";
import type { QueryCtx } from "../convex/_generated/server";
import { StorageNotOwned } from "./errors";

type StorageContext = Pick<QueryCtx, "db" | "storage">;

/** Only this table establishes ownership. Application references never grant it. */
const make = (ctx: StorageContext, userId: string) => {
  const owner = (storageId: Id<"_storage">) => Effect.promise(() => ctx.db
    .query("storageObjects").withIndex("by_storage", q => q.eq("storageId", storageId)).unique());

  const requireOwned = (storageId: Id<"_storage">) => owner(storageId).pipe(Effect.flatMap(record =>
    record?.userId === userId
      ? Effect.succeed(record)
      : Effect.fail(new StorageNotOwned({ message: "Photo unavailable. Please upload it again." })),
  ));

  const url = (storageId: Id<"_storage">) => owner(storageId).pipe(Effect.flatMap(record =>
    record?.userId === userId ? Effect.promise(() => ctx.storage.getUrl(storageId)) : Effect.succeed(null),
  ));

  return { requireOwned, url };
};

export class StorageAccess extends Context.Service<StorageAccess, ReturnType<typeof make>>()("wardrobe/StorageAccess") {
  static layer = (ctx: StorageContext, userId: string) => Layer.succeed(StorageAccess, make(ctx, userId));
}

// Promise adapters keep unchanged Convex endpoints on the same ownership policy.
export const requireOwnedStorage = (ctx: StorageContext, userId: string, storageId: Id<"_storage">) =>
  Effect.runPromise(make(ctx, userId).requireOwned(storageId));

export const ownedStorageUrl = (ctx: StorageContext, userId: string, storageId: Id<"_storage">) =>
  Effect.runPromise(make(ctx, userId).url(storageId));
