import type { Doc, Id } from "../convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../convex/_generated/server";
import { internal } from "../convex/_generated/api";
import { ownedStorageUrl } from "./storageAccess";

export async function queuePreview(ctx: MutationCtx, itemId: Id<"wardrobeItems">, automatic = true) {
  if (process.env.GARMENT_PREVIEWS_ENABLED !== "true") return false;
  const item = await ctx.db.get(itemId);
  if (!item || item.analysisStatus !== "ready" || (automatic && item.previewStatus)) return false;
  if (item.previewStatus === "queued" || item.previewStatus === "processing" || item.previewStatus === "ready") return false;
  if (!(await ownedStorageUrl(ctx, item.userId, item.storageId))) return false;
  const revision = (item.previewRevision ?? 0) + 1;
  await ctx.db.patch(itemId, { previewStatus: "queued", previewRevision: revision });
  await ctx.scheduler.runAfter(0, internal.garmentPreview.generate, { itemId, revision });
  await ctx.scheduler.runAfter(180_000, internal.garmentPreviewData.expire, { itemId, revision });
  return true;
}

/** Display-only projection. Inference and identity always use item.storageId. */
export async function wardrobeDisplayUrl(ctx: QueryCtx, userId: string, item: Doc<"wardrobeItems">) {
  if (item.userId !== userId) return null;
  if (item.previewStatus === "ready" && item.previewStorageId) {
    const preview = await ownedStorageUrl(ctx, userId, item.previewStorageId);
    if (preview) return preview;
  }
  return ownedStorageUrl(ctx, userId, item.storageId);
}
