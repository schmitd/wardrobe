import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  addWardrobeItemsMemory,
  deleteWardrobeItemMemory,
  updateProfileMemory,
} from "./zep";
import { ensureTraceContext } from "./trace";

const http = httpRouter();

const syncSecret = process.env.WARDROBE_SYNC_SHARED_SECRET ?? "";

const constantTimeEqual = (a: string, b: string) => {
  if (a.length === 0 || b.length !== a.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
};

const verifySyncRequest = (req: Request) => {
  if (!syncSecret) {
    return true;
  }

  const headerSecret = req.headers.get("x-wardrobe-sync-secret") ?? "";
  return constantTimeEqual(syncSecret, headerSecret);
};

const redactUserId = (userId: string) =>
  userId.length <= 8 ? "[redacted]" : `${userId.slice(0, 4)}...${userId.slice(-4)}`;

http.route({
  path: "/zep/sync",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!verifySyncRequest(req)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.text();

    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response("Invalid JSON payload", { status: 400 });
    }

    const typedPayload = payload as
      | {
          type: "wardrobe_add";
          userId: string;
          itemId: string;
          traceId?: string;
          traceparent?: string;
        }
      | {
          type: "wardrobe_delete";
          userId: string;
          description: string;
          reason: string;
          traceId?: string;
          traceparent?: string;
        }
      | {
          type: "profile_update";
          userId: string;
          bio?: string;
          skinTone?: string;
          hairColor?: string;
          traceId?: string;
          traceparent?: string;
        };

    const headerTraceparent = req.headers.get("traceparent");
    const { traceId, traceparent } = ensureTraceContext({
      traceId: typedPayload.traceId,
      traceparent: typedPayload.traceparent ?? headerTraceparent,
    });
    console.info("qstash.zep.sync", {
      traceId,
      traceparent,
      type: typedPayload.type,
      userId: redactUserId(typedPayload.userId),
    });

    if (typedPayload.type === "wardrobe_add") {
      const item = await ctx.runQuery(internal.wardrobe.getWardrobeItemInternal, {
        itemId: typedPayload.itemId as Id<"wardrobeItems">,
      });

      if (item) {
        await addWardrobeItemsMemory(typedPayload.userId, [
          {
            category: item.category ?? null,
            description: item.description ?? null,
            styleTags: item.styleTags ?? null,
          },
        ]);
      }
    }

    if (typedPayload.type === "wardrobe_delete") {
      await deleteWardrobeItemMemory(
        typedPayload.userId,
        typedPayload.description,
        typedPayload.reason
      );
    }

    if (typedPayload.type === "profile_update") {
      await updateProfileMemory(typedPayload.userId, {
        bio: typedPayload.bio ?? null,
        skinTone: typedPayload.skinTone ?? null,
        hairColor: typedPayload.hairColor ?? null,
      });
    }

    return new Response("ok");
  }),
});

export default http;
