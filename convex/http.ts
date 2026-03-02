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

type SyncPayload =
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

const MAX_ID_LENGTH = 128;
const MAX_TEXT_LENGTH = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getOptionalString = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getRequiredString = (
  input: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null => {
  const value = getOptionalString(input, key);
  if (!value || value.length > maxLength) {
    return null;
  }
  return value;
};

const parseSyncPayload = (payload: unknown): { ok: true; value: SyncPayload } | { ok: false } => {
  if (!isRecord(payload)) {
    return { ok: false };
  }

  const type = getRequiredString(payload, "type", 64);
  const userId = getRequiredString(payload, "userId", MAX_ID_LENGTH);
  if (!type || !userId) {
    return { ok: false };
  }

  const traceId = getOptionalString(payload, "traceId");
  const traceparent = getOptionalString(payload, "traceparent");

  if (type === "wardrobe_add") {
    const itemId = getRequiredString(payload, "itemId", MAX_ID_LENGTH);
    if (!itemId) {
      return { ok: false };
    }
    return { ok: true, value: { type, userId, itemId, traceId, traceparent } };
  }

  if (type === "wardrobe_delete") {
    const description = getRequiredString(payload, "description", MAX_TEXT_LENGTH);
    const reason = getRequiredString(payload, "reason", MAX_TEXT_LENGTH);
    if (!description || !reason) {
      return { ok: false };
    }
    return { ok: true, value: { type, userId, description, reason, traceId, traceparent } };
  }

  if (type === "profile_update") {
    const bio = getOptionalString(payload, "bio");
    const skinTone = getOptionalString(payload, "skinTone");
    const hairColor = getOptionalString(payload, "hairColor");

    if (
      (bio && bio.length > MAX_TEXT_LENGTH) ||
      (skinTone && skinTone.length > MAX_TEXT_LENGTH) ||
      (hairColor && hairColor.length > MAX_TEXT_LENGTH)
    ) {
      return { ok: false };
    }

    return {
      ok: true,
      value: {
        type,
        userId,
        bio,
        skinTone,
        hairColor,
        traceId,
        traceparent,
      },
    };
  }

  return { ok: false };
};

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

    const parsed = parseSyncPayload(payload);
    if (!parsed.ok) {
      return new Response("Invalid payload shape", { status: 400 });
    }
    const typedPayload = parsed.value;

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

      if (!item) {
        return new Response("ok");
      }

      if (item.userId !== typedPayload.userId) {
        console.warn("sync.wardrobe_add.owner_mismatch", {
          traceId,
          traceparent,
          itemId: typedPayload.itemId,
          payloadUserId: redactUserId(typedPayload.userId),
          itemUserId: redactUserId(item.userId),
        });
        return new Response("Forbidden", { status: 403 });
      }

      await addWardrobeItemsMemory(typedPayload.userId, [
        {
          category: item.category ?? null,
          description: item.description ?? null,
          styleTags: item.styleTags ?? null,
        },
      ]);
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
