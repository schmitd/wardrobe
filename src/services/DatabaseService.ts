import { Effect, Context, Layer } from "effect"
import { db } from "../db"
import { wardrobeItems } from "../db/schema"
import { eq, sql, cosineDistance, desc } from "drizzle-orm"

export class DatabaseError extends Error {
    readonly _tag = "DatabaseError"
    constructor(public error: unknown) {
        super(typeof error === 'object' && error !== null && 'message' in error ? (error as any).message : String(error))
    }
}

export interface WardrobeItemInsert {
    user_id: string
    image_url: string
    category: string
    description: string
    style_tags: string[]
    embedding: number[]
}

export interface DatabaseService {
    readonly addWardrobeItems: (items: WardrobeItemInsert[]) => Effect.Effect<void, DatabaseError>
    readonly getWardrobeItems: (userId: string) => Effect.Effect<any[], DatabaseError>
    readonly searchWardrobeItems: (userId: string, queryEmbedding: number[], matchThreshold: number, matchCount: number) => Effect.Effect<any[], DatabaseError>
    readonly getDissimilarWardrobeItems: (userId: string, queryEmbedding: number[], limit: number) => Effect.Effect<any[], DatabaseError>
}

export const DatabaseService = Context.GenericTag<DatabaseService>("DatabaseService")

const make = Effect.gen(function* () {
    if (!process.env.DATABASE_URL) {
        return yield* Effect.fail(new DatabaseError("Missing DATABASE_URL environment variable"))
    }

    return {
        addWardrobeItems: (items: WardrobeItemInsert[]) =>
            Effect.tryPromise({
                try: async () => {
                    await db.insert(wardrobeItems).values(items.map(item => ({
                        userId: item.user_id,
                        imageUrl: item.image_url,
                        category: item.category,
                        description: item.description,
                        styleTags: item.style_tags,
                        embedding: item.embedding,
                    })))
                },
                catch: (error) => new DatabaseError(error),
            }),

        getWardrobeItems: (userId: string) =>
            Effect.tryPromise({
                try: async () => {
                    return await db.select({
                        id: wardrobeItems.id,
                        user_id: wardrobeItems.userId,
                        image_url: wardrobeItems.imageUrl,
                        category: wardrobeItems.category,
                        description: wardrobeItems.description,
                        style_tags: wardrobeItems.styleTags,
                        created_at: wardrobeItems.createdAt
                    })
                        .from(wardrobeItems)
                        .where(eq(wardrobeItems.userId, userId))
                        .orderBy(desc(wardrobeItems.createdAt));
                },
                catch: (error) => new DatabaseError(error),
            }),

        searchWardrobeItems: (userId: string, queryEmbedding: number[], matchThreshold: number, matchCount: number) =>
            Effect.tryPromise({
                try: async () => {
                    const similarity = sql<number>`1 - (${wardrobeItems.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;
                    return await db.select({
                        id: wardrobeItems.id,
                        image_url: wardrobeItems.imageUrl,
                        category: wardrobeItems.category,
                        description: wardrobeItems.description,
                        style_tags: wardrobeItems.styleTags,
                        similarity: similarity,
                    })
                        .from(wardrobeItems)
                        .where(sql`${wardrobeItems.userId} = ${userId} AND ${similarity} > ${matchThreshold}`)
                        .orderBy(sql`${similarity} DESC`) // Note: ORDER BY similarity DESC means highest similarity first. The original used ORDER BY embedding <=> query ASC (distance ascending), which is equivalent.
                        .limit(matchCount);
                },
                catch: (error) => new DatabaseError(error),
            }),

        getDissimilarWardrobeItems: (userId: string, queryEmbedding: number[], limit: number) =>
            Effect.tryPromise({
                try: async () => {
                     // Get all items to calculate similarity in-memory as per original logic,
                     // OR we can do it in DB. The original logic fetched 100 items and filtered in JS.
                     // Let's replicate the fetching behavior.
                     // Original: fetch 100 items, calculate similarity, sort, take top 3 dissimilar (< 0.5)

                     const items = await db.select({
                         id: wardrobeItems.id,
                         image_url: wardrobeItems.imageUrl,
                         category: wardrobeItems.category,
                         description: wardrobeItems.description,
                         style_tags: wardrobeItems.styleTags,
                         embedding: wardrobeItems.embedding
                     })
                     .from(wardrobeItems)
                     .where(eq(wardrobeItems.userId, userId))
                     .limit(100);

                     return items;
                },
                catch: (error) => new DatabaseError(error)
            })
    }
})

export const DatabaseLive = Layer.effect(DatabaseService, make)
