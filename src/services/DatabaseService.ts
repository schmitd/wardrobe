import { Context, Effect, Layer } from "effect"
import { db } from "../db"
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
}

export const DatabaseService = Context.GenericTag<DatabaseService>("DatabaseService")

const make = Effect.gen(function* () {
    return {
        getWardrobeItems: (userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    return await db.select({
                        id: wardrobeItems.id,
                        userId: wardrobeItems.userId,
                        imageUrl: wardrobeItems.imageUrl,
                        category: wardrobeItems.category,
                        description: wardrobeItems.description,
                        styleTags: wardrobeItems.styleTags,
                        createdAt: wardrobeItems.createdAt
                    })
                        .from(wardrobeItems)
                        .where(eq(wardrobeItems.userId, userId))
                        .orderBy(desc(wardrobeItems.createdAt));
                },
                catch: (error) => new DatabaseError(error),
            }),

        addWardrobeItems: (items: (typeof wardrobeItems.$inferInsert)[]) =>
            Effect.tryPromise({
                try: async () => {
                    if (items.length === 0) return;
                    await db.insert(wardrobeItems).values(items);
                },
                catch: (error) => new DatabaseError(error),
            }),

        deleteWardrobeItem: (itemId: string, userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    await db.delete(wardrobeItems)
                        .where(and(eq(wardrobeItems.id, itemId), eq(wardrobeItems.userId, userId)));
                },
                catch: (error) => new DatabaseError(error),
            }),

        getWardrobeItem: (itemId: string, userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    const result = await db.select({ description: wardrobeItems.description })
                        .from(wardrobeItems)
                        .where(and(eq(wardrobeItems.id, itemId), eq(wardrobeItems.userId, userId)));
                    return result[0];
                },
                catch: (error) => new DatabaseError(error),
            }),

        getProfile: (userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    const result = await db.select({ bio: profiles.bio })
                        .from(profiles)
                        .where(eq(profiles.userId, userId));
                    return result[0];
                },
                catch: (error) => new DatabaseError(error),
            }),

        updateProfile: (userId: string, bio: string) =>
            Effect.tryPromise({
                try: async () => {
                    await db.insert(profiles)
                        .values({ userId, bio, updatedAt: new Date() })
                        .onConflictDoUpdate({
                            target: profiles.userId,
                            set: { bio, updatedAt: new Date() }
                        });
                },
                catch: (error) => new DatabaseError(error),
            })
    }
})

export const DatabaseLive = Layer.effect(DatabaseService, make)
