import { Effect } from "effect";
import { SchemaType, type Schema } from "@google/generative-ai";
import { GeminiService, GEMINI_FLASH_LITE_MODEL } from "../../services/GeminiService";
import { parseJson, withRetries } from "./shared";
export const generateMaintainedStyleBio = (input: {
  currentBio: string;
  manualAnchor: string;
  refreshReason: string;
  closetItems: { category: string | null; description: string | null; styleTags: string[] }[];
  recentFits: { type: string; description: string | null; createdAt: number }[];
  collections: { name: string; description: string | null; memberCount: number }[];
  graphFacts: string[];
}) => Effect.gen(function* () {
  const gemini = yield* GeminiService;
  const schema: Schema = {
    type: SchemaType.OBJECT,
    properties: { bio: { type: SchemaType.STRING } },
    required: ["bio"],
  };
  const prompt = `You maintain a living first-person style notebook for one person. Write 45-90 words about how they actually dress and what they are exploring.

Rules:
- Treat MANUAL ANCHOR as the user's own words. Preserve its voice, commitments, and specific preferences unless newer evidence directly contradicts them.
- Make an incremental edit to CURRENT BIO. Do not churn phrasing merely to sound fresh.
- Ground every claim in the supplied closet, fit diary, collections, or graph facts. Empty evidence means an honest starter note about building the closet, not invented taste.
- Describe clothing, color, silhouette, texture, repetition, outfit habits, and open style questions. Never sound like LinkedIn, a résumé, a brand manifesto, or a personality assessment.
- Never infer profession, status, competence, gender identity, or lifestyle from a selfie or appearance.
- Do not mention AI, graphs, data, uploads, or this prompt.

REFRESH REASON: ${input.refreshReason}
CURRENT BIO: ${input.currentBio || "(none yet)"}
MANUAL ANCHOR: ${input.manualAnchor || "(none yet)"}
CLOSET: ${JSON.stringify(input.closetItems)}
RECENT FITS: ${JSON.stringify(input.recentFits)}
COLLECTIONS: ${JSON.stringify(input.collections)}
GRAPH FACTS: ${JSON.stringify(input.graphFacts)}`;

  const result = yield* gemini.generateContent(GEMINI_FLASH_LITE_MODEL, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: schema },
  });
  return yield* parseJson(result.response.text(), "generateMaintainedStyleBio");
}).pipe(withRetries);
