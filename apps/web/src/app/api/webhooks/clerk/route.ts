import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { internal } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { NextRequest, NextResponse } from "next/server";

import { createTraceContext } from "@/lib/trace";

type ClerkUserDeletedEvent = {
  type: "user.deleted";
  data: {
    id?: string | null;
  };
};

type InternalCleanupApi = {
  account: {
    deleteUserData: FunctionReference<"mutation">;
  };
};

const getConvexAdminToken = () => {
  const token = process.env.CONVEX_DEPLOY_KEY;
  if (!token) {
    throw new Error("CONVEX_DEPLOY_KEY is not set");
  }
  return token;
};

const getConvexClient = () => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }

  const client = new ConvexHttpClient(convexUrl);
  (client as ConvexHttpClient & { setAdminAuth: (token: string) => void }).setAdminAuth(
    getConvexAdminToken()
  );
  return client;
};

const isUserDeletedEvent = (event: unknown): event is ClerkUserDeletedEvent => {
  if (typeof event !== "object" || event === null) return false;
  const candidate = event as { type?: unknown; data?: unknown };
  if (candidate.type !== "user.deleted") return false;
  return typeof candidate.data === "object" && candidate.data !== null;
};

export async function POST(req: NextRequest) {
  let event: unknown;

  try {
    event = await verifyWebhook(req);
  } catch (error) {
    console.warn("clerk.webhook.verify_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (!isUserDeletedEvent(event)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const userId = event.data.id;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const convex = getConvexClient();
  const trace = createTraceContext();

  const [convexResult, zepResult] = await Promise.all([
    convex.mutation(
      (internal as unknown as InternalCleanupApi).account.deleteUserData,
      { userId }
    ),
    convex.action(
      internal.zepSync.deleteUserGraph as unknown as FunctionReference<"action">,
      { userId, ...trace }
    ),
  ]);

  console.info("clerk.webhook.user_deleted.cleaned", {
    userId,
    traceId: trace.traceId,
    convexResult,
    zepResult,
  });

  return NextResponse.json({
    received: true,
    userId,
    convex: convexResult,
    zep: zepResult,
  });
}
