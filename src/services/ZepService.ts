import { zepClient } from "@/lib/zep";
import { Effect } from "effect";

export interface WardrobeItemSync {
    description: string;
    category: string;
    style_tags: string[];
}

export interface UserProfileSync {
    bio?: string;
    skin_tone?: string;
    hair_color?: string;
}

export class ZepService {
    static createUser(userId: string, email?: string, name?: string) {
        return Effect.tryPromise({
            try: async () => {
                if (!zepClient) return;
                try {
                    await zepClient.user.add({
                        userId,
                        email,
                        firstName: name,
                    });
                } catch (e: any) {
                    if (e.message?.includes("already exists") || e.response?.status === 409 || e.response?.status === 400) {
                        // User already exists, this is fine
                        return;
                    }
                    throw e;
                }
            },
            catch: (e) => new Error("Failed to create Zep user: " + String(e))
        }).pipe(
            Effect.catchAll(e => Effect.logError(e.message)) // Log other errors
        );
    }

    private static addMemory(userId: string, content: string, metadata?: Record<string, unknown>) {
        return Effect.gen(function* () {
            if (!zepClient) {
                yield* Effect.logWarning("ZEP_KEY not set, skipping memory addition");
                return;
            }

            // Use a stable session ID per user to allow Zep to build a persistent graph/memory
            const sessionId = `session_${userId}_main`;

            yield* Effect.tryPromise({
                try: async () => {
                    try {
                        await zepClient!.thread.addMessages(sessionId, {
                            messages: [
                                {
                                    role: "user",
                                    content: content,
                                    metadata: metadata,
                                }
                            ]
                        });
                    } catch (e: any) {
                        const isNotFound =
                            e.message?.includes("thread not found") ||
                            e.message?.includes("not found") ||
                            e.message?.includes("404") ||
                            e.response?.status === 404 ||
                            e.code === 404 ||
                            String(e).includes("404") ||
                            String(e).includes("not found");

                        // If thread not found, create it and retry
                        if (isNotFound) {
                            try {
                                await zepClient!.thread.create({
                                    threadId: sessionId,
                                    userId: userId,
                                });
                            } catch (createError: any) {
                                // If create fails because it already exists (race condition), just continue
                                if (!createError.message?.includes("already exists") && createError.response?.status !== 409) {
                                    throw createError;
                                }
                            }

                            // Retry addMessages
                            await zepClient!.thread.addMessages(sessionId, {
                                messages: [
                                    {
                                        role: "user",
                                        content: content,
                                        metadata: metadata,
                                    }
                                ]
                            });
                        } else {
                            throw e;
                        }
                    }
                },
                catch: (e) => new Error("Failed to add Zep memory: " + String(e))
            });

            yield* Effect.logInfo(`Added memory to Zep for user ${userId}`);
        }).pipe(
            Effect.catchAll(e => Effect.logError(e.message))
        );
    }

    // Batch add items
    static addWardrobeItems(userId: string, items: WardrobeItemSync[]) {
        const itemDescriptions = items.map(item =>
            `- ${item.category}: ${item.description} (Style: ${item.style_tags.join(", ")})`
        ).join("\n");

        const message = `I just added the following items to my wardrobe:\n${itemDescriptions}`;

        return this.addMemory(userId, message, { type: "batch_upload", count: items.length });
    }

    static deleteWardrobeItem(userId: string, itemDescription: string, reason: string) {
        const message = `I removed an item from my wardrobe: "${itemDescription}". Reason: ${reason}.`;
        return this.addMemory(userId, message, { type: "item_deletion", reason });
    }

    static syncUserProfile(userId: string, profile: UserProfileSync) {
        return Effect.gen(function* () {
            if (!zepClient) {
                yield* Effect.logWarning("ZEP_KEY missing or client not initialized. Skipping user profile sync.");
                return;
            }

            yield* Effect.tryPromise({
                try: async () => {
                    try {
                        await zepClient!.user.update(userId, {
                            metadata: {
                                bio: profile.bio,
                                skin_tone: profile.skin_tone,
                                hair_color: profile.hair_color
                            }
                        });
                    } catch (e: any) {
                        // If user not found, create them and retry
                        if (e.message?.includes("not found") || e.response?.status === 404 || e.code === 404) {
                            console.log(`Zep user ${userId} not found, creating...`);
                            await zepClient!.user.add({
                                userId,
                                email: undefined, // We don't have email easily accessible here without auth context, but userId is sufficient
                                firstName: undefined,
                            });
                            // Retry update
                            await zepClient!.user.update(userId, {
                                metadata: {
                                    bio: profile.bio,
                                    skin_tone: profile.skin_tone,
                                    hair_color: profile.hair_color
                                }
                            });
                        } else {
                            throw e;
                        }
                    }
                },
                catch: (e) => new Error("Failed to update Zep user metadata: " + String(e))
            });

            // Also add a memory so it's part of the narrative context
            const message = `My profile details:\nBio: ${profile.bio || "N/A"}\nSkin Tone: ${profile.skin_tone || "N/A"}\nHair Color: ${profile.hair_color || "N/A"}`;
            yield* ZepService.addMemory(userId, message, { type: "profile_update" });
        }).pipe(
            Effect.catchAll(e => Effect.logError(e.message))
        );
    }
}
