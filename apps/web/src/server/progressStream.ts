/** Progress is disposable; a disconnected reader must not interrupt persistence. */
export function progressStream<T>(signal: AbortSignal, produce: (send: (event: T) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  let disconnected = signal.aborted;
  const disconnect = () => { disconnected = true; };
  signal.addEventListener("abort", disconnect, { once: true });
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: T) => {
        if (disconnected) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
        catch { disconnected = true; }
      };
      try { await produce(send); }
      finally {
        signal.removeEventListener("abort", disconnect);
        if (!disconnected) { try { controller.close(); } catch { disconnected = true; } }
      }
    },
    cancel: disconnect,
  });
}
