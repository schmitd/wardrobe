import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@clerk/nextjs/server";
import { aj, botDetectionRule } from "@/lib/arcjet";
import { fixedWindow, slidingWindow } from "@arcjet/next";

const f = createUploadthing();

export const ourFileRouter = {
    imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
        .middleware(async ({ req }) => {
            const { userId, has } = await auth();
            if (!userId) throw new UploadThingError("Unauthorized");

            const isPro = has({ permission: 'compatibility_check' });
            const limit = isPro ? 20 : 5;

            // Bot detection
            const botDecision = await aj.withRule(botDetectionRule).protect(req, { userId });
            if (botDecision.isDenied()) {
                throw new UploadThingError("Bot detected");
            }

            const decision = await aj
                .withRule(
                    fixedWindow({
                        mode: "LIVE",
                        window: "1d",
                        max: limit,
                    })
                )
                .withRule(
                    slidingWindow({
                        mode: "LIVE",
                        interval: "10s",
                        max: 1,
                    })
                )
                .protect(req, { userId });

            if (decision.isDenied()) {
                throw new UploadThingError("Rate limit exceeded");
            }

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
