import { Context, Effect, Layer } from "effect"
import { db, withRLS } from "../db"
import { wardrobeItems, profiles } from "../db/schema"
import { eq, desc, sql, and } from "drizzle-orm"
import { WardrobeItemSync } from "./ZepService"

export class DatabaseError extends Error {
    readonly _tag = "DatabaseError"
    constructor(public error: unknown) {
        super(String(error))
    }
}

export interface DatabaseService {
    readonly getWardrobeItems: (userId: string) => Effect.Effect<{
        id: string;
        userId: string;
        imageUrl: string;
        category: string | null;
        description: string | null;
        styleTags: string[] | null;
        createdAt: Date;
    }[], DatabaseError>
    readonly addWardrobeItems: (items: (typeof wardrobeItems.$inferInsert)[]) => Effect.Effect<void, DatabaseError>
    readonly deleteWardrobeItem: (itemId: string, userId: string) => Effect.Effect<void, DatabaseError>
    readonly getWardrobeItem: (itemId: string, userId: string) => Effect.Effect<{ description: string | null } | undefined, DatabaseError>
    readonly getProfile: (userId: string) => Effect.Effect<{ bio: string | null } | undefined, DatabaseError>
    readonly updateProfile: (userId: string, bio: string) => Effect.Effect<void, DatabaseError>
    readonly matchWardrobeItems: (userId: string, queryEmbedding: number[], threshold: number, count: number) => Effect.Effect<{
        id: string;
        image_url: string;
        category: string | null;
        description: string | null;
        style_tags: string[] | null;
        similarity: number;
    }[], DatabaseError>
    readonly getAllWardrobeItemsWithEmbedding: (userId: string, limit: number) => Effect.Effect<{
        id: string;
        image_url: string;
        category: string | null;
        description: string | null;
        style_tags: string[] | null;
        embedding: number[];
    }[], DatabaseError>
}

export const DatabaseService = Context.GenericTag<DatabaseService>("DatabaseService")

const make = Effect.gen(function* () {
    return {
        getWardrobeItems: (userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    return await withRLS(userId, async (tx) => {
                        return await tx.select({
                            id: wardrobeItems.id,
                            userId: wardrobeItems.userId,
                            imageUrl: wardrobeItems.imageUrl,
                            category: wardrobeItems.category,
                            description: wardrobeItems.description,
                            styleTags: wardrobeItems.styleTags,
                            createdAt: wardrobeItems.createdAt
                        })
                            .from(wardrobeItems)
                            // We can remove the explicit where clause and rely on RLS,
                            // but keeping it doesn't hurt and ensures query planner uses index if available.
                            // However, the goal is to rely on RLS.
                            // Let's remove the explicit filter to prove RLS works,
                            // OR keep it for defense in depth.
                            // The user said: "I am concerned that any single developer could forget to do this"
                            // So we should demonstrate that RLS covers us.
                            // But for performance, the filter is good.
                            // I will keep the filter but the policy is the main guard.
                            .where(eq(wardrobeItems.userId, userId))
                            .orderBy(desc(wardrobeItems.createdAt));
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        addWardrobeItems: (items: (typeof wardrobeItems.$inferInsert)[]) =>
            Effect.tryPromise({
                try: async () => {
                    if (items.length === 0) return;
                    // For insert, RLS with check will ensure we can't insert for another user.
                    // We need to pick a userId for the context.
                    // Assuming all items belong to the same user.
                    const userId = items[0]?.userId;
                    if (!userId) return;

                    await withRLS(userId, async (tx) => {
                        await tx.insert(wardrobeItems).values(items);
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        deleteWardrobeItem: (itemId: string, userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    await withRLS(userId, async (tx) => {
                        await tx.delete(wardrobeItems)
                            .where(eq(wardrobeItems.id, itemId));
                            // RLS ensures we only delete own items.
                            // I removed `and(eq(wardrobeItems.userId, userId))` to rely on RLS partially,
                            // but `where id = itemId` is still needed to target the row.
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        getWardrobeItem: (itemId: string, userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    return await withRLS(userId, async (tx) => {
                        const result = await tx.select({ description: wardrobeItems.description })
                            .from(wardrobeItems)
                            .where(eq(wardrobeItems.id, itemId));
                        return result[0];
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        getProfile: (userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    return await withRLS(userId, async (tx) => {
                        const result = await tx.select({ bio: profiles.bio })
                            .from(profiles)
                            .where(eq(profiles.userId, userId));
                        return result[0];
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        updateProfile: (userId: string, bio: string) =>
            Effect.tryPromise({
                try: async () => {
                    await withRLS(userId, async (tx) => {
                        await tx.insert(profiles)
                            .values({ userId, bio, updatedAt: new Date() })
                            .onConflictDoUpdate({
                                target: profiles.userId,
                                set: { bio, updatedAt: new Date() }
                            });
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        matchWardrobeItems: (userId: string, queryEmbedding: number[], threshold: number, count: number) =>
            Effect.tryPromise({
                try: async () => {
                    const embeddingStr = `[${queryEmbedding.join(',')}]`;
                    return await withRLS(userId, async (tx) => {
                        const result = await tx.execute(sql`
                            SELECT
                                id,
                                image_url,
                                category,
                                description,
                                style_tags,
                                1 - (embedding <=> ${embeddingStr}::vector) AS similarity
                            FROM wardrobe_items
                            WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
                            ORDER BY embedding <=> ${embeddingStr}::vector
                            LIMIT ${count}
                        `);
                        // Note: Removed `user_id = ${userId}` from WHERE clause.
                        // RLS `view_own_wardrobe_items` should auto-filter by current_setting('request.jwt.claim.sub')

                        return result as unknown as {
                            id: string;
                            image_url: string;
                            category: string | null;
                            description: string | null;
                            style_tags: string[] | null;
                            similarity: number;
                        }[];
                    });
                },
                catch: (error) => new DatabaseError(error),
            }),

        getAllWardrobeItemsWithEmbedding: (userId: string, limit: number) =>
            Effect.tryPromise({
                try: async () => {
                    return await withRLS(userId, async (tx) => {
                        const result = await tx.execute(sql`
                            SELECT id, image_url, category, description, style_tags, embedding
                            FROM wardrobe_items
                            LIMIT ${limit}
                        `);
                        // Removed WHERE user_id = ${userId}. RLS should handle it.

                        return result as unknown as {
                            id: string;
                            image_url: string;
                            category: string | null;
                            description: string | null;
                            style_tags: string[] | null;
                            embedding: number[];
                        }[];
                    });
                },
                catch: (error) => new DatabaseError(error),
            })
    }
})

export const DatabaseLive = Layer.effect(DatabaseService, make)
