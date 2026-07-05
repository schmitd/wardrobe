import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUser, getAuthenticatedUserId } from "./authIdentity";
import { retrier } from "./retrier";
import { ensureTraceContext } from "./trace";

const now = () => Date.now();

const omitUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const enqueueWardrobeSync = async (
  ctx: Parameters<typeof retrier.run>[0],
  input: {
    user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>;
    wardrobe: {
      _id: string;
      name: string;
      kind: string;
      description?: string;
      status: string;
      moodWords?: string[];
    };
    item?: {
      _id: string;
      category?: string;
      description?: string;
      styleTags?: string[];
    };
    membershipKind?: string;
    rationale?: string;
    traceId?: string;
    traceparent?: string;
  }
) => {
  const { traceId, traceparent } = ensureTraceContext(input);
  try {
    await retrier.run(ctx, internal.zepSync.syncWardrobeCollection, {
        userId: input.user.userId,
        user: input.user,
        wardrobeId: input.wardrobe._id,
        name: input.wardrobe.name,
        kind: input.wardrobe.kind,
        status: input.wardrobe.status,
        moodWords: input.wardrobe.moodWords ?? [],
        ...(input.wardrobe.description ? { description: input.wardrobe.description } : {}),
        ...(input.item
          ? {
            item: {
              itemId: input.item._id,
              category: input.item.category ?? null,
              description: input.item.description ?? null,
              styleTags: input.item.styleTags ?? null,
            },
          }
          : {}),
        ...(input.membershipKind ? { membershipKind: input.membershipKind } : {}),
        ...(input.rationale ? { rationale: input.rationale } : {}),
        traceId,
        traceparent,
      });
  } catch (error) {
    console.warn("zep.sync.wardrobe_collection.enqueue_failed", {
      traceId,
      traceparent,
      userId: input.user.userId,
      wardrobeId: input.wardrobe._id,
      message: toErrorMessage(error),
    });
  }
};

export const listWardrobes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) return [];

    return ctx.db
      .query("wardrobes")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createWardrobe = mutation({
  args: {
    name: v.string(),
    kind: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    moodWords: v.optional(v.array(v.string())),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const timestamp = now();
    const wardrobeId = await ctx.db.insert("wardrobes", {
      userId: user.userId,
      name: args.name,
      kind: args.kind ?? "style_locus",
      description: args.description,
      status: args.status ?? "active",
      moodWords: args.moodWords,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await enqueueWardrobeSync(ctx, {
      user,
      wardrobe: {
        _id: wardrobeId,
        name: args.name,
        kind: args.kind ?? "style_locus",
        description: args.description,
        status: args.status ?? "active",
        moodWords: args.moodWords,
      },
      traceId: args.traceId,
      traceparent: args.traceparent,
    });

    return { id: wardrobeId };
  },
});

export const updateWardrobe = mutation({
  args: {
    wardrobeId: v.id("wardrobes"),
    name: v.optional(v.string()),
    kind: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    moodWords: v.optional(v.array(v.string())),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const wardrobe = await ctx.db.get(args.wardrobeId);
    if (!wardrobe || wardrobe.userId !== user.userId) throw new Error("Not found");

    const patch = omitUndefined({
      name: args.name,
      kind: args.kind,
      description: args.description,
      status: args.status,
      moodWords: args.moodWords,
      updatedAt: now(),
    });
    await ctx.db.patch(args.wardrobeId, patch);

    const updated = { ...wardrobe, ...patch };
    await enqueueWardrobeSync(ctx, {
      user,
      wardrobe: {
        _id: args.wardrobeId,
        name: updated.name,
        kind: updated.kind,
        description: updated.description,
        status: updated.status,
        moodWords: updated.moodWords,
      },
      traceId: args.traceId,
      traceparent: args.traceparent,
    });

    return { success: true };
  },
});

export const addItemToWardrobe = mutation({
  args: {
    wardrobeId: v.id("wardrobes"),
    itemId: v.id("wardrobeItems"),
    membershipKind: v.optional(v.string()),
    rationale: v.optional(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx);
    if (!user) throw new Error("Unauthorized");

    const [wardrobe, item] = await Promise.all([
      ctx.db.get(args.wardrobeId),
      ctx.db.get(args.itemId),
    ]);

    if (!wardrobe || wardrobe.userId !== user.userId) throw new Error("Wardrobe not found");
    if (!item || item.userId !== user.userId) throw new Error("Item not found");

    const existing = await ctx.db
      .query("wardrobeMemberships")
      .withIndex("by_wardrobe_item", (q) =>
        q.eq("wardrobeId", args.wardrobeId).eq("itemId", args.itemId)
      )
      .first();

    const timestamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        membershipKind: args.membershipKind ?? existing.membershipKind,
        rationale: args.rationale ?? existing.rationale,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("wardrobeMemberships", {
        userId: user.userId,
        wardrobeId: args.wardrobeId,
        itemId: args.itemId,
        membershipKind: args.membershipKind ?? "included",
        rationale: args.rationale,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    await ctx.db.patch(args.itemId, {
      wardrobeId: args.wardrobeId,
      updatedAt: timestamp,
    });

    await enqueueWardrobeSync(ctx, {
      user,
      wardrobe: {
        _id: args.wardrobeId,
        name: wardrobe.name,
        kind: wardrobe.kind,
        description: wardrobe.description,
        status: wardrobe.status,
        moodWords: wardrobe.moodWords,
      },
      item: {
        _id: args.itemId,
        category: item.category,
        description: item.description,
        styleTags: item.styleTags,
      },
      membershipKind: args.membershipKind ?? "included",
      rationale: args.rationale,
      traceId: args.traceId,
      traceparent: args.traceparent,
    });

    return { success: true };
  },
});

export const removeItemFromWardrobe = mutation({
  args: {
    wardrobeId: v.id("wardrobes"),
    itemId: v.id("wardrobeItems"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("wardrobeMemberships")
      .withIndex("by_wardrobe_item", (q) =>
        q.eq("wardrobeId", args.wardrobeId).eq("itemId", args.itemId)
      )
      .first();

    if (existing && existing.userId === userId) {
      await ctx.db.delete(existing._id);
    }

    const item = await ctx.db.get(args.itemId);
    if (item?.userId === userId && item.wardrobeId === args.wardrobeId) {
      await ctx.db.patch(args.itemId, {
        wardrobeId: undefined,
        updatedAt: now(),
      });
    }

    return { success: true };
  },
});
