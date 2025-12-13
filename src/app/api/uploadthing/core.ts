import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
    imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 5 } })
        .onUploadError((err: { error: { message: string } }) => {
            console.error("UploadThing Error for imageUploader:", err);
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Upload complete for userId:", metadata);
            console.log("file url", file.url);
            return { uploadedBy: "user" };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
