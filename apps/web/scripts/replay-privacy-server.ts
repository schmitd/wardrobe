// Local-only synthetic-data serializer check. Sends nothing to PostHog.
import { resolve } from "node:path";
const bundle = await Bun.build({ entrypoints: [resolve(import.meta.dir, "replay-privacy-fixture.js")], target: "browser" });
if (!bundle.success) throw new Error("Fixture bundle failed");
const html = `<!doctype html><html><head><title>Replay privacy test</title></head><body><main>
<img width="80" height="80" src="/PRIVATE_PHOTO" alt="PRIVATE_NOTE">
<p>PRIVATE_NOTE</p><input value="PRIVATE_NOTE"><input type="password" value="PRIVATE_PASSWORD">
<input type="hidden" value="PRIVATE_FILE"><input type="file" data-filename="PRIVATE_FILE">
<div style="background-image:url('/PRIVATE_PHOTO');width:80px;height:80px"></div>
<video poster="/PRIVATE_PHOTO"></video><canvas width="80" height="80"></canvas>
</main><output>Running…</output><script src="/recorder.js"></script><script src="/fixture.js"></script></body></html>`;
Bun.serve({ hostname: "127.0.0.1", port: 4319, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/fixture.js") return new Response(bundle.outputs[0], { headers: { "Content-Type": "application/javascript" } });
  if (path === "/recorder.js") return new Response(Bun.file(resolve(import.meta.dir, "../../../node_modules/posthog-js/dist/recorder.js")), { headers: { "Content-Type": "application/javascript" } });
  if (path === "/") return new Response(html, { headers: { "Content-Type": "text/html" } });
  return new Response(null, { status: 404 });
} });
console.log("Synthetic replay privacy check at http://127.0.0.1:4319");
