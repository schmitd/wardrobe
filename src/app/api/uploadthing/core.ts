import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";
import { fixedWindow, slidingWindow, Primitive, Product } from "@arcjet/next";
import { Effect } from "effect";
import { runtime } from "@/lib/run-effect";
import { ArcjetService, ArcjetLive, BotDetectionRule } from "@/services/ArcjetService";

const f = createUploadthing();

export const ourFileRouter = {
    imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
        .middleware(async ({ req }) => {
            const { userId, has } = await auth();
            if (!userId) throw new UploadThingError("Unauthorized");

            const isPro = has({ permission: 'compatibility_check' });
            const limit = isPro ? 20 : 5;

            // Use Effect to run Arcjet protection
            await runtime.runPromise(
                Effect.gen(function* () {
                    const arcjet = yield* ArcjetService

                    // 1. Bot Detection
                    const botDecision = yield* arcjet.protect(req, { userId }, BotDetectionRule)
                    if (botDecision.isDenied()) {
                        yield* Effect.fail(new UploadThingError("Bot detected"))
                    }

                    // 2. Rate Limiting
                    const rateLimitRules: (Primitive | Product)[] = [
                        fixedWindow({ mode: "LIVE", window: "1d", max: limit }),
                        slidingWindow({ mode: "LIVE", interval: "10s", max: 1 })
                    ]

                    const rlDecision = yield* arcjet.protect(req, { userId }, rateLimitRules)
                    if (rlDecision.isDenied()) {
                        yield* Effect.fail(new UploadThingError("Rate limit exceeded"))
                    }
                }).pipe(
                    Effect.provide(ArcjetLive)
                )
            )

            return { uploadedBy: userId };
        })
        .onUploadError((err) => {
            console.error("UploadThing Error for imageUploader:", err);
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Upload complete for userId:", metadata.uploadedBy);
            console.log("file url", file.url);
            return { uploadedBy: metadata.uploadedBy };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
