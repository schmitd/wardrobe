import { embeddingModel } from './gemini';
import fs from 'fs';
import path from 'path';

const CENTROID_FILE_PATH = path.join(process.cwd(), 'src/lib/clothing-centroid.json');

// Calculate the centroid (average vector) of a list of terms
export async function calculateCentroid(terms: string[]): Promise<number[]> {
    console.log(`Calculating centroid for ${terms.length} terms...`);

    // Batch requests to avoid hitting rate limits or payload size limits
    const BATCH_SIZE = 20;
    let allEmbeddings: number[][] = [];

    for (let i = 0; i < terms.length; i += BATCH_SIZE) {
        const batch = terms.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(terms.length / BATCH_SIZE)}...`);

        try {
            // Embed each term individually to get a precise vector for each
            const promises = batch.map(term => embeddingModel.embedContent(term));
            const results = await Promise.all(promises);
            const embeddings = results.map(r => r.embedding.values);
            allEmbeddings.push(...embeddings);
        } catch (error) {
            console.error(`Error embedding batch starting at index ${i}:`, error);
            // Continue with other batches? Or throw? For now, let's throw to ensure quality.
            throw error;
        }
    }

    if (allEmbeddings.length === 0) {
        throw new Error("No embeddings generated.");
    }

    const dimensions = allEmbeddings[0].length;
    const centroid = new Array(dimensions).fill(0);

    // Sum all vectors
    for (const embedding of allEmbeddings) {
        for (let j = 0; j < dimensions; j++) {
            centroid[j] += embedding[j];
        }
    }

    // Divide by count to get average
    for (let j = 0; j < dimensions; j++) {
        centroid[j] /= allEmbeddings.length;
    }

    // Normalize the centroid (optional, but good for cosine similarity operations)
    const magnitude = Math.sqrt(centroid.reduce((sum, val) => sum + val * val, 0));
    for (let j = 0; j < dimensions; j++) {
        centroid[j] /= magnitude;
    }

    return centroid;
}

// Save centroid to file
export function saveCentroid(centroid: number[]) {
    fs.writeFileSync(CENTROID_FILE_PATH, JSON.stringify(centroid));
    console.log(`Centroid saved to ${CENTROID_FILE_PATH}`);
}

// Load centroid from file
export function loadCentroid(): number[] | null {
    if (!fs.existsSync(CENTROID_FILE_PATH)) {
        console.warn(`Centroid file not found at ${CENTROID_FILE_PATH}`);
        return null;
    }
    const data = fs.readFileSync(CENTROID_FILE_PATH, 'utf-8');
    return JSON.parse(data);
}

// Project an embedding away from the centroid
// v_new = v - (v . c) * c
// This removes the component of v that is parallel to c (the centroid)
export function projectEmbedding(embedding: number[], centroid: number[] | null): number[] {
    if (!centroid) {
        return embedding;
    }

    // Ensure centroid is unit vector (it should be if calculated by calculateCentroid)
    // But let's calculate dot product assuming it is.

    let dotProduct = 0;
    for (let i = 0; i < embedding.length; i++) {
        dotProduct += embedding[i] * centroid[i];
    }

    const newEmbedding = new Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
        newEmbedding[i] = embedding[i] - (dotProduct * centroid[i]);
    }

    return newEmbedding;
}
