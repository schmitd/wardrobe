import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs";
import { ZepService } from "@/services/ZepService";
import { Effect } from "effect";

async function handler(req: NextRequest) {
    const body = await req.json();
    const { userId, type, data } = body;

    if (!userId || !type || !data) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await Effect.runPromise(
        Effect.gen(function* () {
            yield* Effect.logInfo(`[QStash] Received ingest request for user ${userId}, type: ${type}`);

            if (type === 'wardrobe_item') {
                yield* ZepService.ingestWardrobeItems(userId, data);
            } else if (type === 'deletion_record') {
                yield* ZepService.ingestItemDeletion(userId, data.item, data.reason);
            } else if (type === 'user_profile') {
                yield* ZepService.ingestProfile(userId, data);
            } else {
                yield* Effect.logWarning(`[QStash] Unknown ingestion type: ${type}`);
            }
        }).pipe(
            Effect.catchAll((e: any) => Effect.logError(`[QStash] Ingestion failed: ${e.message || String(e)}`))
        )
    );

    return NextResponse.json({ success: true });
}

export const POST = verifySignatureAppRouter(handler);
