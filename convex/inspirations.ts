import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";

const getUserId = async (ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const listInspirations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    if (!userId) return [];

    const inspirations = await ctx.db
      .query("inspirations")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      inspirations.map(async (item) => ({
        id: item._id,
        imageUrl: item.storageId ? await ctx.storage.getUrl(item.storageId) : null,
        sourceUrl: item.sourceUrl ?? null,
        note: item.note ?? null,
        category: item.category ?? null,
        description: item.description ?? null,
        styleTags: item.styleTags ?? null,
        createdAt: item.createdAt,
      }))
    );
  },
});

export const createInspiration = mutation({
  args: {
    storageId: v.optional(v.id("_storage")),
    sourceUrl: v.optional(v.string()),
    note: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    styleTags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.float64())),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (!args.storageId && !args.sourceUrl) {
      throw new Error("An inspiration image or source URL is required");
    }

    if (args.storageId) {
      const upload = await ctx.db
        .query("uploads")
        .withIndex("by_user_storage", (q) =>
          q.eq("userId", userId).eq("storageId", args.storageId!)
        )
        .first();
      if (!upload) throw new Error("Inspiration upload not found");
    }

    const { traceId, traceparent } = ensureTraceContext(args);
    const timestamp = Date.now();
    const inspirationId = await ctx.db.insert("inspirations", {
      userId,
      storageId: args.storageId,
      sourceUrl: args.sourceUrl,
      note: args.note,
      category: args.category,
      description: args.description,
      styleTags: args.styleTags,
      embedding: args.embedding,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      await retrier.run(ctx, internal.zepSync.syncInspirationAdd, {
        userId,
        inspirationId,
        sourceUrl: args.sourceUrl,
        note: args.note,
        category: args.category,
        description: args.description,
        styleTags: args.styleTags,
        traceId,
        traceparent,
      });
    } catch (error) {
      console.warn("zep.sync.inspiration_add.enqueue_failed", {
        traceId,
        inspirationId,
        message: toErrorMessage(error),
      });
    }

    return { id: inspirationId };
  },
});
