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
            await zepClient.user.add({
                userId,
                email,
                firstName: name,
            });
        },
        catch: (e) => new Error("Failed to create Zep user: " + String(e))
    }).pipe(
        Effect.catchAll(e => Effect.logError(e.message)) // Log but don't fail the flow
    );
  }

  private static addMemory(userId: string, content: string, metadata?: Record<string, unknown>) {
    return Effect.gen(function* () {
        if (!zepClient) {
            yield* Effect.logWarning("ZEP_KEY not set, skipping memory addition");
            return;
        }

        const sessionId = `session_${userId}_${Date.now()}`;

        yield* Effect.tryPromise({
            try: async () => {
                // Ensure thread exists or just add messages (some SDKs auto-create, Zep Cloud usually does)
                // If not, we might need zepClient!.thread.create(...)
                // But addMessages usually works if threadId is provided.
                await zepClient!.thread.addMessages(sessionId, {
                    messages: [
                        {
                            role: "user",
                            content: content,
                            metadata: metadata,
                        }
                    ]
                });
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
          if (!zepClient) return;

          yield* Effect.tryPromise({
              try: async () => {
                await zepClient!.user.update(userId, {
                    metadata: {
                        bio: profile.bio,
                        skin_tone: profile.skin_tone,
                        hair_color: profile.hair_color
                    }
                });
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
