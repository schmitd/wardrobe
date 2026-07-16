import sharp from "sharp";

export type NormalizedBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GarmentIdentityCandidate = {
  wardrobeItemId: string;
  score: number;
  imageUrl?: string | null;
  category?: string | null;
  description?: string | null;
};

export const GARMENT_AUTO_MATCH_SCORE = 0.92;
export const GARMENT_AUTO_MATCH_MARGIN = 0.06;
export const GARMENT_CONFIRM_SCORE = 0.72;

export const normalizeGarmentCategory = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (/shirt|blouse|sweater|cardigan|hoodie|tee|t-shirt|tank|top/.test(normalized)) return "top";
  if (/pants|trouser|jeans|skirt|shorts|legging|bottom/.test(normalized)) return "bottom";
  if (/jacket|coat|blazer|parka|outerwear/.test(normalized)) return "outerwear";
  if (/shoe|boot|sneaker|loafer|sandal|heel|footwear/.test(normalized)) return "footwear";
  if (/dress|jumpsuit|romper/.test(normalized)) return "one_piece";
  if (/bag|purse|tote|backpack/.test(normalized)) return "bag";
  if (/jewel|watch|belt|hat|scarf|accessory/.test(normalized)) return "accessory";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
};

export const classifyGarmentMatch = (candidates: GarmentIdentityCandidate[]) => {
  const [best, second] = candidates;
  if (!best) return { status: "unresolved" as const, confidence: 0, margin: 0 };
  const margin = best.score - (second?.score ?? 0);
  if (best.score >= GARMENT_AUTO_MATCH_SCORE && margin >= GARMENT_AUTO_MATCH_MARGIN) {
    return { status: "auto_matched" as const, confidence: best.score, margin, wardrobeItemId: best.wardrobeItemId };
  }
  if (best.score >= GARMENT_CONFIRM_SCORE) {
    return { status: "needs_confirmation" as const, confidence: best.score, margin };
  }
  return { status: "unresolved" as const, confidence: best.score, margin };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const cropGarmentRegion = async (input: Buffer, box: NormalizedBoundingBox) => {
  // Normalize EXIF orientation before applying boxes returned against the
  // visually upright image (especially important for phone camera photos).
  const oriented = await sharp(input, { failOn: "none" }).rotate().toBuffer();
  const image = sharp(oriented, { failOn: "none" });
  const metadata = await image.metadata();
  const imageWidth = metadata.width ?? 0;
  const imageHeight = metadata.height ?? 0;
  if (!imageWidth || !imageHeight) throw new Error("Image dimensions unavailable");

  const paddingX = box.width * 0.08;
  const paddingY = box.height * 0.08;
  const left = clamp(Math.floor((box.x - paddingX) * imageWidth), 0, imageWidth - 1);
  const top = clamp(Math.floor((box.y - paddingY) * imageHeight), 0, imageHeight - 1);
  const right = clamp(Math.ceil((box.x + box.width + paddingX) * imageWidth), left + 1, imageWidth);
  const bottom = clamp(Math.ceil((box.y + box.height + paddingY) * imageHeight), top + 1, imageHeight);

  return image
    .extract({ left, top, width: right - left, height: bottom - top })
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
};
