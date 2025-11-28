'use server';

import { visionModel, embeddingModel, textModel } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

async function fetchImage(url: string) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

export async function addItem(imageUrl: string) {
    try {
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
        const embedding = embeddingResult.embedding.values;

        // 3. Store in Supabase
        const { error } = await supabase.from('wardrobe_items').insert({
            image_url: imageUrl,
            category: metadata.category,
            description: metadata.description,
            style_tags: metadata.style_tags,
            embedding: embedding,
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

        // 4. Search Wardrobe
        const { data: similarItems, error } = await supabase.rpc('match_wardrobe_items', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5, // Adjust as needed
            match_count: 5
        });

        if (error) throw error;

        // 5. Evaluate Fit
        const evaluationPrompt = `
      Candidate Item: ${JSON.stringify(candidateMetadata)}
      
      Wardrobe Items Found:
      ${similarItems.map((item: any) => `- ${item.category}: ${item.description}`).join('\n')}
      
      Question: Is this candidate item a good fit for the wardrobe based on the retrieved items? Explain why based on color theory and style coherence. Provide a score from 0 to 100.
      Return JSON with keys: score (number), explanation (string), best_pairings (array of indices from the list above, 0-indexed).
    `;

        const evalResult = await textModel.generateContent(evaluationPrompt);
        const evalText = evalResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const evaluation = JSON.parse(evalText);

        return {
            success: true,
            candidate: candidateMetadata,
            similarItems,
            evaluation
        };

    } catch (error) {
        console.error("Error checking compatibility:", error);
        return { success: false, error: 'Failed to check compatibility' };
    }
}
