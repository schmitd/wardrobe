import { resolve, relative, isAbsolute } from "node:path";
const root = resolve(import.meta.dir, "../../output/cutout-prototype", process.argv[2] ?? "local-second");
const allowedRoot = resolve(import.meta.dir, "../../output/cutout-prototype");
if (relative(allowedRoot, root).startsWith("..") || isAbsolute(relative(allowedRoot, root))) throw new Error("Invalid study directory");
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.argv[3] ?? 4918),
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    const suffix = relative(root, file);
    if (suffix.startsWith("..") || isAbsolute(suffix) || !/\.(?:html|png|jpg)$/.test(file)) return new Response("Not found", { status: 404 });
    const data = Bun.file(file);
    if (!await data.exists()) return new Response("Not found", { status: 404 });
    return new Response(data, { headers: { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
  },
});
console.log(`Private cutout study: ${server.url}`);
