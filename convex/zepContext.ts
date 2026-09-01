"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const getUserId = async (ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}) => {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
};

export const searchStyleContext = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<string | null> => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      return await ctx.runAction(internal.zepSync.searchContext, { userId, query });
    } catch (error) {
      console.warn("zep.context.search_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
});

export const rememberTryOn = action({
  args: {
    category: v.string(),
    description: v.string(),
    styleTags: v.array(v.string()),
    score: v.number(),
    verdict: v.optional(v.string()),
    explanation: v.string(),
    closetAnchors: v.array(v.string()),
    traceId: v.optional(v.string()),
    traceparent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    try {
      await ctx.runAction(internal.zepSync.recordTryOn, { userId, ...args });
      return { remembered: true as const };
    } catch (error) {
      console.warn("zep.try_on.remember_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { remembered: false as const };
    }
  },
});
