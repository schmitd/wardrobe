'use server';

import { visionModel, embeddingModel, textModel } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { loadCentroid, projectEmbedding } from '@/lib/embeddings';
import { auth } from '@clerk/nextjs/server';

async function fetchImage(url: string) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

export async function addItem(imageUrl: string) {
    try {
        const session = await auth();
        const userId = session.userId;

        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

        const imageBase64 = await fetchImage(imageUrl);

        // 1. Analyze Image
        const prompt = "Analyze this clothing item. Extract category, color, material, and 3-5 style tags. Describe it in detail focusing on fashion elements. Return JSON with keys: category, description, style_tags (array of strings).";
        const result = await visionModel.generateContent([
            prompt,
            { inlineData: { data: imageBase64, mimeType: "image/jpeg" } } // Assuming JPEG for now, or detect
        ]);
        const response = await result.response;
        const text = response.text();

        // Clean up JSON if needed (Gemini sometimes adds markdown)
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const metadata = JSON.parse(jsonStr);

        // 2. Generate Embedding
        const embeddingInput = `${metadata.description} ${metadata.style_tags.join(' ')}`;
        const embeddingResult = await embeddingModel.embedContent(embeddingInput);
        let embedding = embeddingResult.embedding.values;

        // 2.5 Project Embedding (Refinement)
        const centroid = loadCentroid();
        if (centroid) {
            embedding = projectEmbedding(embedding, centroid);
        }

        // 3. Store in Supabase
        const { error } = await supabase.from('wardrobe_items').insert({
            image_url: imageUrl,
            category: metadata.category,
            description: metadata.description,
            style_tags: metadata.style_tags,
            embedding: embedding,
            user_id: userId,
        });

        if (error) throw error;

        revalidatePath('/');
        return { success: true, metadata };
    } catch (error) {
        console.error("Error adding item:", error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to process item' };
    }
}

export async function checkCompatibility(candidateUrl: string) {
    try {
        const session = await auth();
        const userId = session.userId;

        if (!userId) {
            return { success: false, error: 'Unauthorized' };
        }

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
        let queryEmbedding = embeddingResult.embedding.values;

        // 3.5 Project Query Embedding (Refinement)
        const centroid = loadCentroid();
        if (centroid) {
            queryEmbedding = projectEmbedding(queryEmbedding, centroid);
        }

        // 4. Search Wardrobe for SIMILAR items
        const { data: similarItems, error: similarError } = await supabase.rpc('match_wardrobe_items', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5,
            match_count: 5,
            p_user_id: userId
        });

        if (similarError) throw similarError;

        // 5. Also get DISSIMILAR items (lowest similarity scores)
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
