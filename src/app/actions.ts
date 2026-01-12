'use server';

import { Effect, Schedule } from 'effect'
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { SchemaType, Schema } from '@google/generative-ai';
import { fixedWindow, slidingWindow, request, Primitive, Product } from '@arcjet/next';
import { eq, and } from 'drizzle-orm';

import { runServerAction } from '@/lib/run-effect';
import { GeminiService } from '@/services/GeminiService';
import { SupabaseService } from '@/services/SupabaseService';
import { ArcjetService, BotDetectionRule } from '@/services/ArcjetService';
import { ZepService, WardrobeItemSync } from '@/services/ZepService';
import { SubscriptionService } from '@/services/SubscriptionService';
import { AppLive } from '@/services';
import { db } from '@/db';
import { wardrobeItems, profiles } from '@/db/schema';

// Helper to fetch image as base64
const fetchImage = (url: string) =>
    Effect.tryPromise({
        try: async () => {
            // SSRF Check
            try {
                const parsed = new URL(url);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    throw new Error(`Invalid protocol: ${parsed.protocol}`);
                }
                const isLocal = ['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(parsed.hostname);
                if (isLocal && process.env.NODE_ENV === 'production') {
                    throw new Error('Localhost access denied entirely in production');
                }
            } catch (e) {
                throw new Error(`Invalid URL: ${url}`);
            }

            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 10000); // 10s timeout
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                const buffer = await response.arrayBuffer();
                return Buffer.from(buffer).toString('base64');
            } catch (error) {
                clearTimeout(id);
                throw error;
            }
        },
        catch: (error) => new Error(`Failed to process image: ${String(error)}`) // Sanitized error
    })

export async function addItems(imageUrls: string[]) {
    const { userId, getToken } = await auth();

    if (!userId) {
        return { success: false, error: 'Unauthorized' };
    }

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const gemini = yield* GeminiService
        // SupabaseService removed for addItems as we use Drizzle

        // 1. Bot Detection
        const req = yield* Effect.promise(() => request())
        const botDecision = yield* arcjet.protect(req, { userId }, BotDetectionRule)

        if (botDecision.isDenied()) {
            yield* Effect.logWarning("Bot detected in addItems", { userId })
            return { success: false, error: 'Access denied' }
        }

        yield* Effect.logInfo("Starting batch item addition", { userId, imageCount: imageUrls.length })

        // 2. Fetch all images in parallel
        const images = yield* Effect.all(
            imageUrls.map((url, index) =>
                fetchImage(url).pipe(
                    Effect.map(base64 => ({ url, base64, index })),
                    Effect.tapError(e => Effect.logError(e.message)),
                    Effect.orElseSucceed(() => null)
                )
            ),
            { concurrency: 5 }
        )

        const validImages = images.filter((img): img is { url: string; base64: string; index: number } => img !== null)
        const failedCount = imageUrls.length - validImages.length

        if (validImages.length === 0) {
            return { success: false, error: 'No images could be fetched' }
        }

        // 3. Analyze Images in Batch
        const prompt = `Analyze these ${validImages.length} clothing items. 
For EACH item, extract category, color, material, and 3-5 style tags. 
Describe it in detail focusing on fashion elements. 
Return the data strictly complying with the schema, maintaining the order of images.`;

        const promptParts: any[] = [{ text: prompt }];
        validImages.forEach(img => {
            promptParts.push({
                inlineData: {
                    data: img.base64,
                    mimeType: "image/jpeg"
                }
            });
        });

        const schema: Schema = {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    category: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    style_tags: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING }
                    }
                },
                required: ["category", "description", "style_tags"]
            }
        };

        yield* Effect.logInfo("Sending batch request to Gemini", { userId })

        const geminiResult = yield* gemini.generateContent('gemini-2.5-flash-lite', {
            contents: [{ role: 'user', parts: promptParts }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        })

        const text = geminiResult.response.text()

        const metadataArrayEntry = yield* Effect.try({
            try: () => JSON.parse(text),
            catch: (e) => new Error("Failed to parse AI response: " + String(e))
        })

        const metadataArray = Array.isArray(metadataArrayEntry) ? metadataArrayEntry : [metadataArrayEntry];

        if (!Array.isArray(metadataArray)) {
            return { success: false, error: 'AI response invalid format' }
        }

        const count = Math.min(validImages.length, metadataArray.length)
        if (count !== validImages.length) {
            yield* Effect.logWarning("Mismatch between images and AI results", {
                imageCount: validImages.length,
                resultCount: metadataArray.length
            })
        }

        const alignedImages = validImages.slice(0, count)
        const alignedMetadata = metadataArray.slice(0, count)

        // 4. Generate Embeddings
        yield* Effect.logInfo("Generating embeddings in batch", { count: alignedMetadata.length })

        const embeddingRequests = alignedMetadata.map((metadata: any) => ({
            content: {
                role: 'user',
                parts: [{ text: `${metadata.description} ${metadata.style_tags.join(' ')}` }]
            }
        }));

        const batchEmbeddingResult = yield* gemini.batchEmbedContents({
            requests: embeddingRequests
        })

        // 5. Insert into Database (Drizzle)
        const itemsToInsert = metadataArray.map((metadata: any, i: number) => {
            const originalImage = validImages[i];
            if (!originalImage || !batchEmbeddingResult.embeddings[i]) return null;

            return {
                userId: userId,
                imageUrl: originalImage.url,
                category: metadata.category,
                description: metadata.description,
                styleTags: metadata.style_tags,
                embedding: batchEmbeddingResult.embeddings[i].values,
            }
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        if (itemsToInsert.length > 0) {
            yield* Effect.tryPromise({
                try: async () => {
                    await db.insert(wardrobeItems).values(itemsToInsert);
                },
                catch: (e) => new Error("Database insert failed: " + String(e))
            })
        }

        yield* Effect.sync(() => revalidatePath('/'))

        yield* Effect.logInfo("Successfully added items", { userId, successCount: itemsToInsert.length, failedCount })

        // 6. Sync to Zep
        const zepItems: WardrobeItemSync[] = itemsToInsert.map(item => ({
            description: item.description,
            category: item.category,
            style_tags: item.styleTags
        }));
        yield* ZepService.addWardrobeItems(userId, zepItems);

        return {
            success: true,
            count: itemsToInsert.length,
            failed: failedCount
        }

    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
            yield* Effect.logError("Error in addItems", { userId, error: error['message'] || String(error) })
            return { success: false, error: 'Failed to add items to wardrobe. Please try again.' }
        })),
        Effect.withSpan("action.addItems", { attributes: { userId } }),
        Effect.provide(AppLive)
    )

    return runServerAction(program)
}

export async function addItem(imageUrl: string) {
    return addItems([imageUrl])
}

export async function deleteItem(itemId: string, reason: string) {
    const { userId } = await auth(); // Removed getToken as we don't need Supabase client
    if (!userId) return { success: false, error: 'Unauthorized' };

    const program = Effect.gen(function* () {
        // 1. Fetch item details for Zep log (Drizzle)
        const item = yield* Effect.promise(() =>
            db.select({ description: wardrobeItems.description })
              .from(wardrobeItems)
              .where(and(eq(wardrobeItems.id, itemId), eq(wardrobeItems.userId, userId)))
              .then(res => res[0])
        )

        if (!item) {
             yield* Effect.logWarning("Item not found or access denied", { itemId, userId })
             return { success: false, error: "Item not found" }
        }

        // 2. Delete from Database (Drizzle)
        yield* Effect.tryPromise({
            try: async () => {
                await db.delete(wardrobeItems)
                    .where(and(eq(wardrobeItems.id, itemId), eq(wardrobeItems.userId, userId)));
            },
            catch: (e) => new Error("Failed to delete item: " + String(e))
        })

        // 3. Sync to Zep (Log deletion)
        yield* ZepService.deleteWardrobeItem(userId, item.description || "Unknown item", reason);

        yield* Effect.sync(() => revalidatePath('/'))
        return { success: true }
    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
            yield* Effect.logError("Error in deleteItem", { userId, error: String(error) })
            return { success: false, error: 'Failed to delete item.' }
        })),
        Effect.provide(AppLive)
    )

    return runServerAction(program);
}

export async function updateBio(bio: string) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const isPro = await SubscriptionService.isProUser(userId);
    if (!isPro) return { success: false, error: "Pro feature only" };

    const program = Effect.gen(function* () {
         // Update Profile in Database (Drizzle)
         yield* Effect.tryPromise({
            try: async () => {
                await db.insert(profiles)
                    .values({ userId, bio, updatedAt: new Date() })
                    .onConflictDoUpdate({
                        target: profiles.userId,
                        set: { bio, updatedAt: new Date() }
                    });
            },
            catch: (e) => new Error("Database update failed: " + String(e))
         })

         // Sync to Zep
         yield* ZepService.syncUserProfile(userId, { bio });

         yield* Effect.sync(() => revalidatePath('/profile'))
         return { success: true }
    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
             yield* Effect.logError("Error updating bio", { userId, error: String(error) });
             return { success: false, error: "Failed to update bio" };
        })),
        Effect.provide(AppLive)
    )
    return runServerAction(program);
}

export async function getBio() {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const program = Effect.gen(function* () {
         const result = yield* Effect.tryPromise({
            try: async () => {
                return await db.select({ bio: profiles.bio })
                    .from(profiles)
                    .where(eq(profiles.userId, userId));
            },
            catch: (e) => new Error("Database fetch failed: " + String(e))
         })

         return { success: true, bio: result[0]?.bio || '' }
    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
             yield* Effect.logError("Error fetching bio", { userId, error: String(error) });
             return { success: false, error: "Failed to fetch bio" };
        })),
        Effect.provide(AppLive)
    )
    return runServerAction(program);
}

// checkCompatibility remains largely unchanged but uses SupabaseService for vector search RPC
export async function checkCompatibility(candidateUrl: string) {
    const { userId, getToken, has } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const gemini = yield* GeminiService
        const supabaseService = yield* SupabaseService

        // 1. Rate Limiting / Bot Detection
        const req = yield* Effect.promise(() => request())

        // Check bot first
        const botDecision = yield* arcjet.protect(req, { userId }, BotDetectionRule)
        if (botDecision.isDenied()) return { success: false, error: 'Access denied' }

        // Check rate limits
        const isPro = has({ permission: 'compatibility_check' });
        const limit = isPro ? 20 : 3;

        const rateLimitRules: (Primitive | Product)[] = [
            fixedWindow({ mode: "LIVE", window: "1d", max: limit }),
            slidingWindow({ mode: "LIVE", interval: "10s", max: 1 })
        ]

        const rlDecision = yield* arcjet.protect(req, { userId }, rateLimitRules)
        if (rlDecision.isDenied()) {
            return { success: false, error: 'Rate limit exceeded. Upgrade to Pro for more checks!' };
        }

        const token = yield* Effect.promise(() => getToken())
        if (!token) return { success: false, error: 'Authorization failed' }

        const supabase = yield* supabaseService.getClient(token)

        // 2. Fetch Candidate Image
        const imageBase64 = yield* fetchImage(candidateUrl)

        // 3. Analyze Candidate
        const analysisPrompt = "Analyze this clothing item. Extract category, color, material, and 3-5 style tags. Describe it in detail focusing on fashion elements. Return JSON with keys: category, description, style_tags (array of strings).";

        const evaluationSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                category: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                style_tags: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING }
                }
            },
            required: ["category", "description", "style_tags"]
        };

        const analysisResult = yield* gemini.generateContent('gemini-2.5-flash-lite', {
            contents: [{
                role: 'user',
                parts: [
                    { text: analysisPrompt },
                    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: evaluationSchema,
            }
        })

        const candidateMetadata = yield* Effect.try({
            try: () => JSON.parse(analysisResult.response.text()),
            catch: (e) => new Error("Failed to parse AI response: " + String(e))
        })

        // 4. Generate Style Query
        const queryPrompt = `Given this clothing item description: "${candidateMetadata.description}" and style tags: "${candidateMetadata.style_tags.join(', ')}", generate a search query to find compatible items in a wardrobe. For example, if the item is a "Red leather jacket", the query might be "Black jeans, white t-shirt, boots, edgy style". Return just the query string.`;

        const queryResult = yield* gemini.generateContent('gemini-2.5-flash-lite', queryPrompt)
        const styleQuery = queryResult.response.text().trim()

        // 5. Generate Embedding
        const embeddingResult = yield* gemini.embedContent(styleQuery)
        const queryEmbedding = embeddingResult.embedding.values

        // 6. Search Wardrobe
        const { data: similarItems, error: similarError } = yield* Effect.promise(() =>
            supabase.rpc('match_wardrobe_items', {
                query_embedding: queryEmbedding,
                match_threshold: 0.3,
                match_count: 5,
                p_user_id: userId
            })
        )

        if (similarError) return yield* Effect.fail(new Error(similarError.message))

        // 7. Get Dissimilar
        // Using Supabase here for simplicity as we have the client and it works for now.
        // Could be refactored to Drizzle later.
        const { data: allItems, error: allError } = yield* Effect.promise(() =>
            supabase
                .from('wardrobe_items')
                .select('id, image_url, category, description, style_tags, embedding')
                .eq('user_id', userId)
                .limit(100)
        )

        if (allError) return yield* Effect.fail(new Error(allError.message))

        const dissimilarItems = allItems
            .map((item: any) => {
                const embedding = item.embedding;
                let dotProduct = 0;
                let normA = 0;
                let normB = 0;
                for (let i = 0; i < queryEmbedding.length; i++) {
                    dotProduct += queryEmbedding[i] * embedding[i];
                    normA += queryEmbedding[i] * queryEmbedding[i];
                    normB += embedding[i] * embedding[i];
                }
                const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
                return { ...item, similarity };
            })
            .sort((a: any, b: any) => a.similarity - b.similarity)
            .slice(0, 3)
            .filter((item: any) => item.similarity < 0.5);

        if ((similarItems?.length ?? 0) === 0 && dissimilarItems.length === 0) {
            return {
                success: true,
                candidate: candidateMetadata,
                similarItems: [],
                dissimilarItems: [],
                evaluation: null,
                message: "The item does not relate to any pieces in your wardrobe, but it also does not clash with existing items."
            };
        }

        // 8. Evaluate Fit
        const evaluationPrompt = `You are a professional fashion stylist with high standards. Your job is to critically evaluate whether a candidate clothing item fits well with an existing wardrobe.

CANDIDATE ITEM:
${JSON.stringify(candidateMetadata)}

WARDROBE ITEMS (Most Compatible):
${similarItems.length > 0 ? similarItems.map((item: any, i: number) => `${i}. ${item.category}: ${item.description} (similarity: ${Math.round(item.similarity * 100)}%)`).join('\n') : 'No similar items found in wardrobe.'}

${dissimilarItems.length > 0 ? `\nWARDROBE ITEMS (Least Compatible - Potential Clashes):
${dissimilarItems.map((item: any, i: number) => `${i}. ${item.category}: ${item.description} (similarity: ${Math.round(item.similarity * 100)}%)`).join('\n')}` : ''}

CRITICAL EVALUATION GUIDELINES:
- Focus ONLY on how well this candidate fits with the EXISTING WARDROBE ITEMS listed above
- Do NOT evaluate the candidate item's internal consistency or standalone quality
- Be CRITICAL and HONEST - most items should score 40-70%, not 90%+
- Score 90-100%: Perfect match, complements multiple wardrobe items, fills a gap
- Score 70-89%: Good fit, works well with several items
- Score 50-69%: Acceptable, works with some items but limited versatility
- Score 30-49%: Poor fit, clashes with most items or redundant
- Score 0-29%: Terrible fit, completely incompatible with wardrobe style

Return JSON with keys:
- score (number 0-100): Your critical compatibility score
- explanation (string): Focus on how it compares to the WARDROBE, not its internal quality
- best_pairings (array of indices): Which wardrobe items it pairs best with
- worst_clashes (array of indices): Which wardrobe items it clashes with most (if any)`;

        const compatibilitySchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                score: { type: SchemaType.NUMBER },
                explanation: { type: SchemaType.STRING },
                best_pairings: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.NUMBER }
                },
                worst_clashes: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.NUMBER }
                }
            },
            required: ["score", "explanation", "best_pairings", "worst_clashes"]
        };

        const evalResult = yield* gemini.generateContent('gemini-2.5-flash-lite', {
            contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: compatibilitySchema,
            }
        })

        const evaluation = yield* Effect.try({
            try: () => JSON.parse(evalResult.response.text()),
            catch: (e) => new Error("Failed to parse evaluation response: " + String(e))
        })

        return {
            success: true,
            candidate: candidateMetadata,
            similarItems,
            dissimilarItems,
            evaluation
        };

    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
            yield* Effect.logError("Error in checkCompatibility", { userId, error: String(error) })
            return { success: false, error: 'Failed to check compatibility. Please try again.' }
        })),
        Effect.withSpan("action.checkCompatibility", { attributes: { userId } }),
        Effect.provide(AppLive)
    )

    return runServerAction(program)
}
