import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Receiver } from "@upstash/qstash";
import {
  addWardrobeItemsMemory,
  deleteWardrobeItemMemory,
  updateProfileMemory,
} from "./zep";
import { ensureTraceContext } from "./trace";

const http = httpRouter();

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
});

const verifyQStash = async (req: Request, body: string) => {
  const signature = req.headers.get("Upstash-Signature") ?? "";
  if (!signature) return false;

  try {
    return await receiver.verify({
      signature,
      body,
      url: req.url,
    });
  } catch (error) {
    console.warn("QStash signature verification failed", error);
    return false;
  }
};

http.route({
  path: "/zep/sync",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const verified = await verifyQStash(req, body);

    if (!verified) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(body) as
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
      traceId: payload.traceId,
      traceparent: payload.traceparent ?? headerTraceparent,
    });
    console.info("qstash.zep.sync", {
      traceId,
      traceparent,
      type: payload.type,
      userId: payload.userId,
    });

    if (payload.type === "wardrobe_add") {
      const item = await ctx.runQuery(api.wardrobe.getWardrobeItem, {
        itemId: payload.itemId,
      });

      if (item) {
        await addWardrobeItemsMemory(payload.userId, [
          {
            category: item.category ?? null,
            description: item.description ?? null,
            styleTags: item.styleTags ?? null,
          },
        ]);
      }
    }

    if (payload.type === "wardrobe_delete") {
      await deleteWardrobeItemMemory(
        payload.userId,
        payload.description,
        payload.reason
      );
    }

    if (payload.type === "profile_update") {
      await updateProfileMemory(payload.userId, {
        bio: payload.bio ?? null,
        skinTone: payload.skinTone ?? null,
        hairColor: payload.hairColor ?? null,
      });
    }

    return new Response("ok");
  }),
});

export default http;
