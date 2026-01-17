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
import { AppLive } from '@/services';
import { DatabaseService } from '@/services/DatabaseService';

// Helper to fetch image as base64
// Helper to fetch image as base64 from Supabase Private Storage using new Service
const fetchImage = (pathOrUrl: string) =>
    Effect.gen(function* () {
        const supabaseService = yield* SupabaseService
        // If it's a full URL, we might need to download it (e.g. if we still support scraping). 
        // But for private uploads, we expect a path.

        // Assuming input is a path for now for the new flow.
        // We generate a short-lived signed URL to download it for analysis.
        const signedUrl = yield* supabaseService.createSignedUrl(pathOrUrl, 60);

        return yield* Effect.tryPromise({
            try: async () => {
                const response = await fetch(signedUrl);
                if (!response.ok) throw new Error(`Failed to fetch image from storage: ${response.statusText}`);
                const buffer = await response.arrayBuffer();
                return Buffer.from(buffer).toString('base64');
            },
            catch: (error) => new Error(`Failed to download image: ${String(error)}`)
        })
    })


export async function addItems(imageUrls: string[]) {
    const { userId, getToken } = await auth();

    if (!userId) {
        return { success: false, error: 'Unauthorized' };
    }

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const gemini = yield* GeminiService
        const dbService = yield* DatabaseService
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
            yield* dbService.addWardrobeItems(itemsToInsert);
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
        const dbService = yield* DatabaseService

        // 1. Fetch item details for Zep log
        const item = yield* dbService.getWardrobeItem(itemId, userId);

        if (!item) {
            yield* Effect.logWarning("Item not found or access denied", { itemId, userId })
            return { success: false, error: "Item not found" }
        }

        // 2. Delete from Database
        yield* dbService.deleteWardrobeItem(itemId, userId);

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

export async function updateBio(bio: string, analysis?: { skinTone: string, hairColor: string }) {
    const { userId, has } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const isPro = has({ plan: 'pro' });
    if (!isPro) return { success: false, error: "Pro feature only" };

    const program = Effect.gen(function* () {
        const dbService = yield* DatabaseService

        // Update Profile in Database
        yield* dbService.updateProfile(userId, bio);

        // Sync to Zep
        yield* ZepService.syncUserProfile(userId, {
            bio,
            skin_tone: analysis?.skinTone,
            hair_color: analysis?.hairColor
        });

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

export async function analyzeSelfie(imagePath: string) {
    const { userId, has } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const isPro = has({ plan: 'pro' });
    if (!isPro) return { success: false, error: "Pro feature only" };

    const program = Effect.gen(function* () {
        const gemini = yield* GeminiService

        yield* Effect.logInfo("Analying selfie", { userId });

        const imageBase64 = yield* fetchImage(imagePath);

        const prompt = `Analyze this selfie for fashion profiling. 
        Determine the user's skin tone (e.g. "Fair", "Olive", "Dark", "Medium") and hair color.
        Also generate a short "Style Bio" that describes them based on their look (e.g. "Casual chic with a focus on neutrals").
        Return JSON.`;

        const schema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                skin_tone: { type: SchemaType.STRING },
                hair_color: { type: SchemaType.STRING },
                bio: { type: SchemaType.STRING },
            },
            required: ["skin_tone", "hair_color", "bio"]
        };

        const result = yield* gemini.generateContent('gemini-2.5-flash-lite', {
            contents: [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
                ]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });

        const data = yield* Effect.try({
            try: () => JSON.parse(result.response.text()),
            catch: (e) => new Error("Failed to parse AI response: " + String(e))
        });

        return { success: true, data };

    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
            yield* Effect.logError("Error analyzing selfie", { userId, error: String(error) });
            return { success: false, error: "Failed to analyze selfie" };
        })),
        Effect.provide(AppLive)
    )

    return runServerAction(program);
}

export async function getBio() {
    const { userId } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const program = Effect.gen(function* () {
        const dbService = yield* DatabaseService
        const result = yield* dbService.getProfile(userId);
        return { success: true, bio: result?.bio || '' }
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

        // 1. Rate Limiting / Bot Detection
        const req = yield* Effect.promise(() => request())
        const botDecision = yield* arcjet.protect(req, { userId }, BotDetectionRule)
        if (botDecision.isDenied()) return { success: false, error: 'Access denied' }

        // Check rate limits using Clerk Billing
        const isPro = has({ plan: 'pro' });
        const limit = isPro ? 20 : 3;
        yield* Effect.logInfo("Rate limit check", { userId, isPro, limit });

        const rateLimitRules: (Primitive | Product)[] = [
            fixedWindow({ mode: "LIVE", window: "1d", max: limit }),
            slidingWindow({ mode: "LIVE", interval: "10s", max: 1 })
        ]
        const rlDecision = yield* arcjet.protect(req, { userId }, rateLimitRules)
        yield* Effect.logInfo("Arcjet rate limit decision", { denied: rlDecision.isDenied() });

        if (rlDecision.isDenied()) {
            return { success: false, error: 'Rate limit exceeded. Upgrade to Pro for more checks!' };
        }

        // 2. Fetch Candidate Image
        yield* Effect.logInfo("Step: Fetching candidate image", { candidateUrl });
        const imageBase64 = yield* fetchImage(candidateUrl)
        yield* Effect.logInfo("Step: Image fetched successfully", { length: imageBase64.length });

        // 3. Analyze Candidate
        yield* Effect.logInfo("Step: Analyzing candidate with Gemini");
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
        yield* Effect.logInfo("Step: Candidate analyzed", { category: candidateMetadata.category });

        // 4. Generate Style Query
        yield* Effect.logInfo("Step: Generating style query");
        const queryPrompt = `Given this clothing item description: "${candidateMetadata.description}" and style tags: "${candidateMetadata.style_tags.join(', ')}", generate a search query to find compatible items in a wardrobe. For example, if the item is a "Red leather jacket", the query might be "Black jeans, white t-shirt, boots, edgy style". Return just the query string.`;

        const queryResult = yield* gemini.generateContent('gemini-2.5-flash-lite', queryPrompt)
        const styleQuery = queryResult.response.text().trim()
        yield* Effect.logInfo("Step: Style query generated", { styleQuery });

        // 5. Generate Embedding
        yield* Effect.logInfo("Step: Generating embedding");
        const embeddingResult = yield* gemini.embedContent(styleQuery)
        const queryEmbedding = embeddingResult.embedding.values
        yield* Effect.logInfo("Step: Embedding generated", { dimensions: queryEmbedding.length });

        // Search Wardrobe via Drizzle
        yield* Effect.logInfo("Step: Searching wardrobe via Drizzle");
        const dbService = yield* DatabaseService;
        const similarItems = yield* dbService.matchWardrobeItems(userId, queryEmbedding, 0.3, 5);
        yield* Effect.logInfo("Step: Wardrobe search complete", { matchCount: similarItems.length });

        // Get all items for dissimilarity calculation
        const allItems = yield* dbService.getAllWardrobeItemsWithEmbedding(userId, 100);

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

        // Generate signed URLs for all items
        const supabaseService = yield* SupabaseService;
        const signedSimilarItems = yield* Effect.all(
            similarItems.map(item =>
                supabaseService.createSignedUrl(item.image_url, 3600).pipe(
                    Effect.map(signedUrl => ({ ...item, image_url: signedUrl })),
                    Effect.catchAll(e => {
                        Effect.logWarning("Failed to sign URL for similar item", { id: item.id, error: String(e) });
                        return Effect.succeed(null);
                    })
                )
            ),
            { concurrency: 5 }
        ).pipe(Effect.map(items => items.filter((item): item is NonNullable<typeof item> => item !== null)));
        const signedDissimilarItems = yield* Effect.all(
            dissimilarItems.map((item: any) =>
                supabaseService.createSignedUrl(item.image_url, 3600).pipe(
                    Effect.map(signedUrl => ({ ...item, image_url: signedUrl })),
                    Effect.catchAll(e => {
                        Effect.logWarning("Failed to sign URL for dissimilar item", { id: item.id, error: String(e) });
                        return Effect.succeed(null);
                    })
                )
            ),
            { concurrency: 5 }
        ).pipe(Effect.map(items => items.filter((item): item is NonNullable<typeof item> => item !== null)));

        return {
            success: true,
            candidate: candidateMetadata,
            similarItems: signedSimilarItems,
            dissimilarItems: signedDissimilarItems,
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
