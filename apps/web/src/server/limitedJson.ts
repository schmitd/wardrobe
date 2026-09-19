import { RequestFailure } from "./errors";
export async function limitedJson(
  request: Request,
  limit: number,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RequestFailure({ status: 413, message: "The request is too large." });
  const reader = request.body?.getReader();
  if (!reader) throw new RequestFailure({ status: 400, message: "The request body is missing." });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        void reader.cancel().catch(() => {});
        throw new RequestFailure({ status: 413, message: "The request is too large." });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestFailure({ status: 400, message: "The request body must be valid JSON." }); }
}
