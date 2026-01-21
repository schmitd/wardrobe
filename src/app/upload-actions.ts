'use server';

import { Effect } from 'effect';
import { auth } from '@clerk/nextjs/server';
import { request } from '@arcjet/next';
import { runServerAction } from '@/lib/run-effect';
import { ArcjetService, BotDetectionRule } from '@/services/ArcjetService';
import { SupabaseService } from '@/services/SupabaseService';
import { AppLive } from '@/services';
export async function getUploadUrl(filename: string, contentType: string) {
    const { userId, has } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    // Validate that the file is an image
    if (!contentType.startsWith('image/')) {
        return { success: false, error: 'Only image files are allowed' };
    }

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const supabaseService = yield* SupabaseService

        // Bot Detection & Rate Limiting (re-using logic from checkCompatibility logic roughly)
        const req = yield* Effect.promise(() => request());
        const detectionRule = BotDetectionRule;
        const decision = yield* arcjet.protect(req, { userId }, detectionRule);

        if (decision.isDenied()) {
            return { success: false, error: 'Access denied' };
        }

        const isPro = has({ plan: 'pro' });
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        // Dynamic path: <users>/<userId>/<random>-<filename>
        const path = `users/${userId}/${Math.random().toString(36).slice(2)}-${sanitizedFilename}`;

        const uploadData = yield* supabaseService.createSignedUploadUrl(path);

        return { success: true, url: uploadData.signedUrl, token: uploadData.token, path: uploadData.path };

    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
            yield* Effect.logError("Error generating upload URL", { userId, error: String(error) });
            return { success: false, error: String(error) };
        })),
        Effect.provide(AppLive)
    )

    return runServerAction(program);
}
