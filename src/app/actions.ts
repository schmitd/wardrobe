'use server';



import { visionModel, embeddingModel, textModel } from '@/lib/gemini';
import { createAuthenticatedClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { SchemaType, Schema } from '@google/generative-ai';
import { aj } from '@/lib/arcjet';
import { fixedWindow, slidingWindow } from '@arcjet/next';

async function fetchImage(url: string) {
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
}

// Reusing the existing addItem function for single items, but here is the batch version
export async function addItems(imageUrls: string[]) {
    try {


        console.log("addItems: Starting for", imageUrls.length, "urls");
        const { userId, getToken } = await auth();

        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        const supabaseToken = await getToken();
        if (!supabaseToken) {
            console.error("Failed to get Supabase token");
            return { success: false, error: 'Authorization failed' };
        }

        const supabase = createAuthenticatedClient(supabaseToken);

        // 1. Fetch all images in parallel
        const imageResults = await Promise.allSettled(imageUrls.map(url => fetchImage(url)));

        const validImages: { url: string; base64: string; index: number }[] = [];
        const failedUrls: string[] = [];

        imageResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                validImages.push({ url: imageUrls[index], base64: result.value, index });
            } else {
                console.error(`Failed to fetch query image ${imageUrls[index]}:`, result.reason);
                failedUrls.push(imageUrls[index]);
            }
        });

        if (validImages.length === 0) {
            return { success: false, error: 'No images could be fetched' };
        }

        // 2. Analyze Images in Batch
        // Minimal prompt since schema handles structure
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

        console.log("addItems: Sending batch request to Gemini with", validImages.length, "images...");
        const result = await visionModel.generateContent({
            contents: [{ role: 'user', parts: promptParts }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        console.log("addItems: Gemini request completed.");

        const response = await result.response;
        const text = response.text();

        // No cleanup needed with Structured Output
        let metadataArray: any[];
        try {
            metadataArray = JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse batch JSON:", text);
            return { success: false, error: 'Failed to parse AI response' };
        }

        if (!Array.isArray(metadataArray)) {
            console.error("AI response is not an array:", metadataArray);
            return { success: false, error: 'AI response invalid format' };
        }

        if (metadataArray.length !== validImages.length) {
            console.warn(`Mismatch in result count. Sent ${validImages.length}, got ${metadataArray.length}. Trying to map by index.`);
            // This is risky, but if the model fails to return exact count
            // We might have to abort or try to match.
            // For now, proceed if we can, or just slice/fill.
        }

        // 3. Generate Embeddings in Batch (up to 100 at once)
        console.log("addItems: Generating embeddings in batch for", metadataArray.length, "items");

        const embeddingRequests = metadataArray.map(metadata => ({
            content: {
                role: 'user',
                parts: [{ text: `${metadata.description} ${metadata.style_tags.join(' ')}` }]
            }
        }));

        const batchEmbeddingResult = await embeddingModel.batchEmbedContents({
            requests: embeddingRequests
        });

        // 4. Combine embeddings with metadata
        const itemsToInsert = metadataArray.map((metadata, i) => {
            const originalImage = validImages[i];
            if (!originalImage || !batchEmbeddingResult.embeddings[i]) return null;

            const embedding = batchEmbeddingResult.embeddings[i].values;

            return {
                image_url: originalImage.url,
                category: metadata.category,
                description: metadata.description,
                style_tags: metadata.style_tags,
                embedding: embedding,
                user_id: userId,
            };
        });

        const cleanItemsToInsert = itemsToInsert.filter(item => item !== null);

        if (cleanItemsToInsert.length > 0) {
            const { error } = await supabase.from('wardrobe_items').insert(cleanItemsToInsert);
            if (error) {
                console.error("Supabase batch insert error:", error);
                throw error;
            }
        }

        revalidatePath('/');
        return {
            success: true,
            count: cleanItemsToInsert.length,
            failed: failedUrls.length
        };

    } catch (error) {
        console.error("Error adding items batch:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : JSON.stringify(error)
        };
    }
}

export async function addItem(imageUrl: string) {
    try {
        console.log("addItem: Starting for url", imageUrl);
        return await addItems([imageUrl]);
    } catch (error) {
        console.error("Error adding item:", error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to process item' };
    }
}

export async function checkCompatibility(candidateUrl: string) {
    try {


        const { userId, getToken, has } = await auth();

        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        const isPro = has({ permission: 'compatibility_check' });
        const limit = isPro ? 20 : 3;

        const decision = await aj
            .withRule(
                fixedWindow({
                    mode: "LIVE",
                    window: "1d",
                    max: limit,
                })
            )
            .withRule(
                slidingWindow({
                    mode: "LIVE",
                    interval: "10s",
                    max: 1,
                })
            )
            .protect({}, { userId });

        if (decision.isDenied()) {
            return { success: false, error: 'Rate limit exceeded. Upgrade to Pro for more checks!' };
        }

        const supabaseToken = await getToken();
        if (!supabaseToken) {
            return { success: false, error: 'Authorization failed' };
        }

        const supabase = createAuthenticatedClient(supabaseToken);

        const imageBase64 = await fetchImage(candidateUrl);

        // 1. Analyze Candidate
        const prompt = "Analyze this clothing item. Extract category, color, material, and 3-5 style tags. Describe it in detail focusing on fashion elements. Return JSON with keys: category, description, style_tags (array of strings).";
        const result = await visionModel.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
        ]);
        const response = await result.response;
        const text = response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const candidateMetadata = JSON.parse(jsonStr);

        // 2. Generate Style Query
        const queryPrompt = `Given this clothing item description: "${candidateMetadata.description}" and style tags: "${candidateMetadata.style_tags.join(', ')}", generate a search query to find compatible items in a wardrobe. For example, if the item is a "Red leather jacket", the query might be "Black jeans, white t-shirt, boots, edgy style". Return just the query string.`;
        const queryResult = await textModel.generateContent(queryPrompt);
        const styleQuery = queryResult.response.text().trim();

        // 3. Generate Embedding for Query
        const embeddingResult = await embeddingModel.embedContent(styleQuery);
        const queryEmbedding = embeddingResult.embedding.values;

        // 4. Search Wardrobe for SIMILAR items
        const { data: similarItems, error: similarError } = await supabase.rpc('match_wardrobe_items', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 5,
            p_user_id: userId
        });

        if (similarError) throw similarError;

        // 5. Also get DISSIMILAR items (lowest similarity scores)
        // XXX seems inefficent that we are getting all items and then filtering them
        const { data: allItems, error: allError } = await supabase
            .from('wardrobe_items')
            .select('id, image_url, category, description, style_tags, embedding')
            .eq('user_id', userId)
            .limit(100);

        if (allError) throw allError;

        // Calculate similarity for all items and get the most dissimilar ones
        const dissimilarItems = allItems
            .map((item: any) => {
                // Calculate cosine distance manually
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
            .sort((a, b) => a.similarity - b.similarity) // Sort by LOWEST similarity
            .slice(0, 3) // Get top 3 most dissimilar
            .filter(item => item.similarity < 0.5); // Only include if actually dissimilar

        // If there are no similar items AND no dissimilar items, skip LLM critique
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

        // 6. Evaluate Fit with CRITICAL eye
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

Consider:
1. Does this item PAIR WELL with existing wardrobe pieces?
2. Does it fill a GAP or is it REDUNDANT?
3. Are there COLOR CLASHES with existing items?
4. Does it match the OVERALL STYLE of the wardrobe?

Return JSON with keys:
- score (number 0-100): Your critical compatibility score
- explanation (string): Focus on how it compares to the WARDROBE, not its internal quality
- best_pairings (array of indices): Which wardrobe items it pairs best with
- worst_clashes (array of indices): Which wardrobe items it clashes with most (if any)`;

        const evalResult = await textModel.generateContent(evaluationPrompt);
        const evalText = evalResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(evalText);

        return {
            success: true,
            candidate: candidateMetadata,
            similarItems,
            dissimilarItems,
            evaluation
        };

    } catch (error) {
        console.error("Error checking compatibility:", error);
        return { success: false, error: 'Failed to check compatibility' };
    }
}


