const DEFAULT_MAX_SIZE = 1024;
const MAX_ALLOWED_SIZE = 8192;
const DEFAULT_QUALITY = 0.82;

const sanitizeMaxSize = (value?: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MAX_SIZE;
  return Math.min(MAX_ALLOWED_SIZE, Math.max(1, Math.round(numeric)));
};

const sanitizeQuality = (value?: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_QUALITY;
  return Math.min(1, Math.max(0, numeric));
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });

const DEFAULT_MAX_SIZE = 1024;
const MAX_CANVAS_SIZE = 8192;
const DEFAULT_QUALITY = 0.82;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeMaxSize = (value?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_SIZE;
  return Math.max(1, Math.round(clampNumber(parsed, 1, MAX_CANVAS_SIZE)));
};

const sanitizeQuality = (value?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_QUALITY;
  return clampNumber(parsed, 0, 1);
};

export const downscaleToJpegDataUrl = async (
  file: File,
  opts?: { maxSize?: number; quality?: number }
) => {
  const maxSize = sanitizeMaxSize(opts?.maxSize);
  const quality = sanitizeQuality(opts?.quality);

  // Decode the image.
  const originalDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw new Error("Invalid image dimensions");

  const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(img, 0, 0, outW, outH);

  // Force JPEG to keep payload sizes small and predictable.
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, mimeType: "image/jpeg" as const };
};

export const dataUrlToFile = (dataUrl: string, fileName: string) => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL");
  const mimeType = match[1] || "application/octet-stream";
  const base64 = match[2] || "";
  let bin = "";
  try {
    bin = atob(base64);
  } catch {
    throw new Error("Invalid base64 payload");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const safeName = fileName.trim() || "upload.jpg";
  return new File([bytes], safeName, { type: mimeType });
};
