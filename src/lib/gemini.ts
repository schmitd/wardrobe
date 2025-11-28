import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
export const textModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
export const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
