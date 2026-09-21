import { authenticated, digest, MAX_BODY_BYTES, parseEvent } from "./events";
import type { Store } from "./store";

export function receiver(secret: string, actors: string[], store: Store, wake: () => void) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/github") return new Response("Not found", { status: 404 });
    if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return new Response("Too large", { status: 413 });
    // Bound streaming requests too, including absent or dishonest Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return new Response("Missing body", { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return new Response("Too large", { status: 413 }); }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks);
    if (!authenticated(body, request.headers.get("x-hub-signature-256"), secret)) return new Response("Unauthorized", { status: 401 });
    const delivery = request.headers.get("x-github-delivery") ?? "";
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(delivery)) return new Response("Invalid delivery", { status: 400 });
    let payload: unknown;
    try { payload = JSON.parse(body.toString()); } catch { return new Response("Invalid JSON", { status: 400 }); }
    const event = parseEvent(request.headers.get("x-github-event"), payload, actors);
    if (!event) return new Response("Ignored", { status: 202 });
    let inserted: boolean;
    try { inserted = store.receive(delivery, digest(body), event); }
    catch (error) { if (String(error) === "Error: Queue full") return new Response("Queue full; redeliver later", { status: 503 }); throw error; }
    if (inserted) wake();
    return new Response(inserted ? "Queued" : "Duplicate", { status: 202 });
  };
}
