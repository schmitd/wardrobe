'use server';

import { Effect, Schedule } from 'effect'
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { SchemaType, Schema } from '@google/generative-ai';
import { fixedWindow, slidingWindow, request, Primitive, Product } from '@arcjet/next';

import { runServerAction } from '@/lib/run-effect';
import { GeminiService } from '@/services/GeminiService';
import { DatabaseService } from '@/services/DatabaseService';
import { ArcjetService } from '@/services/ArcjetService';
import { SupabaseService } from '@/services/SupabaseService';
import { AppLive } from '@/services';

export async function getUploadUrl(filename: string) {
    const { userId, has } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const isPro = has({ permission: 'compatibility_check' });

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const supabase = yield* SupabaseService

        const tier = isPro ? 'pro' : 'free'
        yield* Effect.logInfo(`Checking Arcjet protection`, { userId, isPro, tier })

        // 1. Bot Detection / Rate Limit
        const req = yield* Effect.promise(() => request())
        const decision = yield* arcjet.protect(req, { userId }, tier)

        if (decision.isDenied()) {
            const deniedResult = decision.results.find(res => res.isDenied())
            const arcjetReason = decision.reason.isBot() ? {
                type: 'Bot',
                ruleId: deniedResult?.ruleId,
                bots: decision.reason.denied
            } : decision.reason.isRateLimit() ? {
                type: 'RateLimit',
                ruleId: deniedResult?.ruleId,
                limit: decision.reason.max,
                remaining: decision.reason.remaining,
                reset: decision.reason.reset,
                window: decision.reason.window
            } : {
                type: 'Other',
                ruleId: deniedResult?.ruleId
            }
            yield* Effect.logWarning(`Arcjet denied in getUploadUrl`, { userId, arcjetReason })
            return { success: false, error: 'Access denied' }
        }

        // 2. Generate Path & URL
        // Use a random ID + sanitized filename
        const ext = filename.split('.').pop()
        const path = `${userId}/${crypto.randomUUID()}.${ext}`

        const { signedUrl, token } = yield* supabase.createSignedUploadUrl(path)

        return { success: true, url: signedUrl, path }
    }).pipe(
        Effect.catchAll(error => Effect.gen(function* () {
            yield* Effect.logError("Error in getUploadUrl", { userId, error })
            return { success: false, error: 'Failed to generate upload URL' }
        })),
        Effect.provide(AppLive)
    )

    return runServerAction(program)
}

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
    const { userId, has } = await auth();

    if (!userId) {
        return { success: false, error: 'Unauthorized' };
    }

    const isPro = has({ permission: 'compatibility_check' });

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const gemini = yield* GeminiService
        const dbService = yield* DatabaseService
        const supabase = yield* SupabaseService

        // 1. Bot Detection
        // We need to construct the request object for Arcjet
        const req = yield* Effect.promise(() => request())
        // Determine tier
        const botDecision = yield* arcjet.protect(req, { userId }, isPro ? 'pro' : 'free')

        if (botDecision.isDenied()) {
            const deniedResult = botDecision.results.find(res => res.isDenied())
            const arcjetReason = botDecision.reason.isBot() ? {
                type: 'Bot',
                ruleId: deniedResult?.ruleId,
                bots: botDecision.reason.denied
            } : botDecision.reason.isRateLimit() ? {
                type: 'RateLimit',
                ruleId: deniedResult?.ruleId,
                limit: botDecision.reason.max,
                remaining: botDecision.reason.remaining,
                reset: botDecision.reason.reset,
                window: botDecision.reason.window
            } : {
                type: 'Other',
                ruleId: deniedResult?.ruleId
            }
            yield* Effect.logWarning(`Arcjet denied in addItems`, { userId, arcjetReason })
            return { success: false, error: 'Access denied' }
        }

        yield* Effect.logInfo("Starting batch item addition", { userId, imageCount: imageUrls.length })

        // 2. Fetch all images in parallel
        // We use Effect.all with concurrency to fetch images
        const images = yield* Effect.all(
            imageUrls.map((urlOrPath, index) =>
                Effect.gen(function* () {
                    let urlToFetch = urlOrPath
                    // If it's a storage path (no protocol), sign it
                    if (!urlOrPath.startsWith('http')) {
                        urlToFetch = yield* supabase.createSignedUrl(urlOrPath, 60) // 1 min expiry
                    }
                    const base64 = yield* fetchImage(urlToFetch)
                    return { url: urlOrPath, base64, index } // Keep original identifier (path or url)
                }).pipe(
                    Effect.tapError(e => Effect.logError(e.message)), // Log errors but don't fail all?
                    Effect.orElseSucceed(() => null) // Return null on failure to keep going
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

        // Parse JSON safely
        // Parse JSON safely
        const metadataArrayEntry = yield* Effect.try({
            try: () => JSON.parse(text),
            catch: (e) => new Error("Failed to parse AI response: " + String(e))
        })

        // Ensure it's an array
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

        // Align data
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

        // 5. Insert into Database
        const itemsToInsert = metadataArray.map((metadata: any, i: number) => {
            const originalImage = validImages[i];
            // Check bounds
            if (!originalImage || !batchEmbeddingResult.embeddings[i]) return null;

            return {
                image_url: originalImage.url,
                category: metadata.category,
                description: metadata.description,
                style_tags: metadata.style_tags,
                embedding: batchEmbeddingResult.embeddings[i].values,
                user_id: userId,
            }
        }).filter(item => item !== null)

        if (itemsToInsert.length > 0) {
            yield* dbService.addWardrobeItems(itemsToInsert as any)
        }

        yield* Effect.sync(() => revalidatePath('/'))

        yield* Effect.logInfo("Successfully added items", { userId, successCount: itemsToInsert.length, failedCount })

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

export async function checkCompatibility(candidateUrl: string) {
    const { userId, has } = await auth();
    if (!userId) return { success: false, error: 'Unauthorized' };

    const program = Effect.gen(function* () {
        const arcjet = yield* ArcjetService
        const gemini = yield* GeminiService
        const dbService = yield* DatabaseService

        // 1. Rate Limiting / Bot Detection
        const req = yield* Effect.promise(() => request())
        const isPro = has({ permission: 'compatibility_check' });

        const decision = yield* arcjet.protect(req, { userId }, isPro ? 'pro' : 'free')

        if (decision.isDenied()) {
            const deniedResult = decision.results.find(res => res.isDenied())
            const arcjetReason = decision.reason.isBot() ? {
                type: 'Bot',
                ruleId: deniedResult?.ruleId,
                bots: decision.reason.denied
            } : decision.reason.isRateLimit() ? {
                type: 'RateLimit',
                ruleId: deniedResult?.ruleId,
                limit: decision.reason.max,
                remaining: decision.reason.remaining,
                reset: decision.reason.reset,
                window: decision.reason.window
            } : {
                type: 'Other',
                ruleId: deniedResult?.ruleId
            }
            yield* Effect.logWarning(`Arcjet denied in checkCompatibility`, { userId, arcjetReason })

            if (decision.reason.isRateLimit()) {
                return { success: false, error: 'Rate limit exceeded. Upgrade to Pro for more checks!' };
            }
            return { success: false, error: 'Access denied' }
        }

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
        const similarItems = yield* dbService.searchWardrobeItems(userId, queryEmbedding, 0.3, 5)

        // 7. Get Dissimilar
        // Note: Drizzle service returns array directly, not { data, error } object
        const allItems = yield* dbService.getDissimilarWardrobeItems(userId, queryEmbedding, 100)

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
        // Provide all services
        Effect.provide(AppLive)
    )

    return runServerAction(program)
}
