
import { CLOTHING_TERMS } from '../lib/clothing-terms';
import { calculateCentroid, saveCentroid } from '../lib/embeddings';

async function main() {
    console.log("Starting manual centroid generation...");
    try {
        const centroid = await calculateCentroid(CLOTHING_TERMS);
        saveCentroid(centroid);
        console.log("SUCCESS: Centroid generated and saved.");
    } catch (error) {
        console.error("ERROR:", error);
        process.exit(1);
    }
}

main();
