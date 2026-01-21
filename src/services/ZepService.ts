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
        return Effect.gen(function* () {
            if (!zepClient) {
                yield* Effect.logWarning("ZEP_KEY not set, skipping user creation");
                return;
            }

            yield* Effect.tryPromise({
                try: async () => {
                    try {
                        await zepClient!.user.add({
                            userId,
                            email,
                            firstName: name,
                        });
                        console.log(`Successfully created Zep user: ${userId}`);
                    } catch (e: any) {
                        const isAlreadyExists =
                            e.message?.includes("already exists") ||
                            e.response?.status === 409 ||
                            e.response?.status === 400 ||
                            String(e).includes("Conflict");

                        if (isAlreadyExists) {
                            // User already exists, this is fine
                            return;
                        }
                        throw e;
                    }
                },
                catch: (e) => new Error(`Failed to create Zep user ${userId}: ${String(e)}`)
            });
        }).pipe(
            Effect.catchAll(e => Effect.logError(e.message))
        );
    }

    private static addEpisode(userId: string, data: string, type: "json" | "text" = "text") {
        return Effect.gen(function* () {
            if (!zepClient) {
                yield* Effect.logWarning("ZEP_KEY not set, skipping episode addition");
                return;
            }

            yield* Effect.tryPromise({
                try: async () => {
                    await zepClient!.graph.add({
                        userId,
                        data,
                        type: type as any, // Cast to any if strictly typed enum in SDK, but typically string union works
                    });
                },
                catch: (e) => new Error("Failed to add Zep episode: " + String(e))
            });

            yield* Effect.logInfo(`Added episode to Zep for user ${userId}`);
        }).pipe(
            Effect.catchAll(e => Effect.logError(e.message))
        );
    }

    // Ingest items as a JSON episode
    static ingestWardrobeItems(userId: string, items: WardrobeItemSync[]) {
        const data = JSON.stringify({
            type: "wardrobe_item",
            action: "added",
            items: items,
            timestamp: new Date().toISOString()
        });
        return this.addEpisode(userId, data, "json");
    }

    static ingestItemDeletion(userId: string, itemDescription: string, reason: string) {
        const data = JSON.stringify({
            type: "deletion_record",
            action: "deleted",
            item: itemDescription,
            reason: reason,
            timestamp: new Date().toISOString()
        });
        return this.addEpisode(userId, data, "json");
    }

    static ingestProfile(userId: string, profile: UserProfileSync) {
        // We still update the user metadata in Zep for generic personalization
        const updateUserMetadata = Effect.gen(function* () {
            if (!zepClient) return;

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
                        // If user not found, try create and retry (same logic as before)
                        if (e.message?.includes("not found") || e.response?.status === 404 || e.code === 404) {
                            await zepClient!.user.add({ userId });
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
        });

        // Add an episode for the narrative context
        const data = JSON.stringify({
            type: "user_profile",
            action: "updated",
            profile: profile,
            timestamp: new Date().toISOString()
        });

        return Effect.all([
            updateUserMetadata,
            this.addEpisode(userId, data, "json")
        ], { concurrency: "unbounded" }).pipe(
            Effect.catchAll(e => Effect.logError(e.message))
        );
    }
}

